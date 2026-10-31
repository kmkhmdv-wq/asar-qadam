const express = require('express');
const router = express.Router();
const db = require('../db');
const { authMiddleware, requireRoles, logAuditAction } = require('../auth');

router.use(authMiddleware);

// 1. Get all directions (accessible to all authenticated users)
router.get('/', (req, res) => {
  const directions = db.prepare(`
    SELECT * FROM directions 
    ORDER BY is_active DESC, name ASC
  `).all();

  // For each direction, calculate how many specialists have this direction
  const specialists = db.prepare('SELECT id, full_name, directions, specialty, is_active FROM specialists WHERE is_active = 1').all();

  const formatted = directions.map(dir => {
    const assignedSpecialists = specialists.filter(sp => {
      try {
        const dirs = JSON.parse(sp.directions || '[]');
        return dirs.includes(dir.name) || sp.specialty.toLowerCase().includes(dir.name.toLowerCase());
      } catch (e) {
        return false;
      }
    });

    return {
      ...dir,
      specialists_count: assignedSpecialists.length,
      assigned_specialists: assignedSpecialists.map(s => ({ id: s.id, name: s.full_name }))
    };
  });

  res.json({ directions: formatted });
});

// 2. Create direction (director, owner)
router.post('/', requireRoles('owner', 'director'), (req, res) => {
  const { name, description, color } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Укажите название направления работы' });
  }

  const existing = db.prepare('SELECT id FROM directions WHERE LOWER(name) = LOWER(?)').get(name.trim());
  if (existing) {
    return res.status(400).json({ error: 'Направление с таким названием уже существует' });
  }

  const code = name.trim().toLowerCase().replace(/[^a-z0-9а-яё]/gi, '_');

  const result = db.prepare(`
    INSERT INTO directions (name, code, description, color, is_active)
    VALUES (?, ?, ?, ?, 1)
  `).run(name.trim(), code, description || null, color || '#38B9AD');

  logAuditAction({
    userId: req.user.id,
    userName: req.user.name,
    userRole: req.user.role,
    action: 'DIRECTION_CREATED',
    entityType: 'directions',
    entityId: result.lastInsertRowid,
    details: `Создано новое направление работы: ${name.trim()}`,
    ipAddress: req.ip
  });

  res.json({
    success: true,
    id: result.lastInsertRowid,
    message: `Направление «${name.trim()}» успешно добавлено`
  });
});

// 3. Update direction (director, owner)
router.put('/:id', requireRoles('owner', 'director'), (req, res) => {
  const dirId = req.params.id;
  const { name, description, color, is_active } = req.body;

  const current = db.prepare('SELECT * FROM directions WHERE id = ?').get(dirId);
  if (!current) {
    return res.status(404).json({ error: 'Направление не найдено' });
  }

  if (name && name.trim().toLowerCase() !== current.name.toLowerCase()) {
    const existing = db.prepare('SELECT id FROM directions WHERE LOWER(name) = LOWER(?) AND id != ?').get(name.trim(), dirId);
    if (existing) {
      return res.status(400).json({ error: 'Направление с таким названием уже существует' });
    }
  }

  const newName = name ? name.trim() : current.name;

  db.prepare(`
    UPDATE directions SET
      name = ?,
      description = COALESCE(?, description),
      color = COALESCE(?, color),
      is_active = COALESCE(?, is_active)
    WHERE id = ?
  `).run(
    newName,
    description !== undefined ? description : null,
    color || null,
    is_active !== undefined ? (is_active ? 1 : 0) : null,
    dirId
  );

  // If name changed, update specialists where old name was used in JSON directions
  if (newName !== current.name) {
    const specs = db.prepare('SELECT id, directions FROM specialists').all();
    for (const sp of specs) {
      try {
        let dirs = JSON.parse(sp.directions || '[]');
        if (dirs.includes(current.name)) {
          dirs = dirs.map(d => d === current.name ? newName : d);
          db.prepare('UPDATE specialists SET directions = ? WHERE id = ?').run(JSON.stringify(dirs), sp.id);
        }
      } catch (e) {}
    }
  }

  logAuditAction({
    userId: req.user.id,
    userName: req.user.name,
    userRole: req.user.role,
    action: 'DIRECTION_UPDATED',
    entityType: 'directions',
    entityId: dirId,
    details: `Обновлено направление работы ID ${dirId}: ${newName}`,
    ipAddress: req.ip
  });

  res.json({ success: true, message: 'Направление работы успешно обновлено' });
});

// 4. Delete / Deactivate direction
router.delete('/:id', requireRoles('owner', 'director'), (req, res) => {
  const dirId = req.params.id;
  const current = db.prepare('SELECT * FROM directions WHERE id = ?').get(dirId);
  if (!current) {
    return res.status(404).json({ error: 'Направление не найдено' });
  }

  // Soft deactivate
  db.prepare('UPDATE directions SET is_active = 0 WHERE id = ?').run(dirId);

  logAuditAction({
    userId: req.user.id,
    userName: req.user.name,
    userRole: req.user.role,
    action: 'DIRECTION_DEACTIVATED',
    entityType: 'directions',
    entityId: dirId,
    details: `Деактивировано направление работы: ${current.name}`,
    ipAddress: req.ip
  });

  res.json({ success: true, message: `Направление «${current.name}» деактивировано` });
});

module.exports = router;
