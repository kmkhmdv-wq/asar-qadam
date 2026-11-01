const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../db');
const { authMiddleware, requireRoles, logAuditAction } = require('../auth');

router.use(authMiddleware);

// Helper: Auto-sync any registered user with role 'specialist' into specialists table
async function ensureAllSpecialistsSynced() {
  try {
    const unlinkedUsers = db.prepare(`
      SELECT * FROM users 
      WHERE role = 'specialist' 
        AND (specialist_id IS NULL OR specialist_id NOT IN (SELECT id FROM specialists))
    `).all();

    for (const u of unlinkedUsers) {
      let spec = db.prepare('SELECT id FROM specialists WHERE user_id = ? OR (email IS NOT NULL AND email = ?) OR (phone IS NOT NULL AND phone = ?)').get(u.id, u.email || '__none__', u.phone || '__none__');

      if (spec) {
        db.prepare('UPDATE users SET specialist_id = ? WHERE id = ?').run(spec.id, u.id);
        db.prepare('UPDATE specialists SET user_id = ? WHERE id = ?').run(u.id, spec.id);
        continue;
      }

      const fullName = u.name || `${u.first_name || ''} ${u.last_name || ''}`.trim() || 'Специалист';
      const parts = fullName.split(/\s+/);
      const fName = u.first_name || parts[0] || 'Специалист';
      const lName = u.last_name || parts.slice(1).join(' ') || '';
      const mName = u.middle_name || null;
      const phone = u.phone || '';
      const email = u.email || null;
      const branch = u.branch || 'Астана — Центр';
      const specialty = 'Специалист центра';
      const directions = JSON.stringify(['Логопед', 'АВА-терапевт', 'АФК-тренер']);
      const isActive = u.status === 'blocked' ? 0 : 1;
      const isTest = u.is_test ? 1 : 0;

      // 1. Insert into Supabase
      let newSpecId = null;
      if (db.supabase) {
        try {
          const { data: suSpec } = await db.supabase
            .from('specialists')
            .insert({
              user_id: u.id,
              full_name: fullName,
              first_name: fName,
              last_name: lName,
              middle_name: mName,
              phone,
              email,
              specialty,
              position: 'Специалист',
              branch,
              directions,
              default_percentage: 50.0,
              base_rate: 8000.0,
              work_days: '["mon","tue","wed","thu","fri","sat"]',
              work_hours_start: '09:00',
              work_hours_end: '18:00',
              is_active: isActive,
              is_test: Boolean(u.is_test),
              color_badge: '#F47920'
            })
            .select()
            .single();

          if (suSpec) newSpecId = suSpec.id;
        } catch (err) {
          console.warn('[Supabase spec sync warn]:', err.message);
        }
      }

      // 2. Insert into SQLite
      if (newSpecId) {
        db.prepare(`
          INSERT OR REPLACE INTO specialists (
            id, user_id, full_name, first_name, last_name, middle_name, phone, email,
            specialty, position, branch, directions, default_percentage, base_rate,
            work_days, work_hours_start, work_hours_end, is_active, color_badge, is_test
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Специалист', ?, ?, 50.0, 8000.0, '["mon","tue","wed","thu","fri","sat"]', '09:00', '18:00', ?, '#F47920', ?)
        `).run(newSpecId, u.id, fullName, fName, lName, mName, phone, email, specialty, branch, directions, isActive, isTest);
      } else {
        const res = db.prepare(`
          INSERT INTO specialists (
            user_id, full_name, first_name, last_name, middle_name, phone, email,
            specialty, position, branch, directions, default_percentage, base_rate,
            work_days, work_hours_start, work_hours_end, is_active, color_badge, is_test
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Специалист', ?, ?, 50.0, 8000.0, '["mon","tue","wed","thu","fri","sat"]', '09:00', '18:00', ?, '#F47920', ?)
        `).run(u.id, fullName, fName, lName, mName, phone, email, specialty, branch, directions, isActive, isTest);
        newSpecId = res.lastInsertRowid;
      }

      db.prepare('UPDATE users SET specialist_id = ? WHERE id = ?').run(newSpecId, u.id);
      if (db.supabase) {
        db.supabase.from('users').update({ specialist_id: newSpecId }).eq('id', u.id).catch(() => {});
      }
    }
  } catch (e) {
    console.warn('[Sync specialists error]:', e.message);
  }
}

// 1. Get all specialists (active or all)
router.get('/', async (req, res) => {
  // Always ensure all registered specialist users are synced and visible
  await ensureAllSpecialistsSynced();

  const { include_inactive, branch, include_test } = req.query;
  let query = `
    SELECT s.*, u.email as user_email, u.status as user_status, u.role as user_role,
           COALESCE(s.is_test, 0) as is_test
    FROM specialists s
    LEFT JOIN users u ON s.user_id = u.id
    WHERE 1=1
  `;
  const params = [];

  if (include_test !== 'true') {
    query += ' AND (s.is_test = 0 OR s.is_test IS NULL) AND (u.is_test = 0 OR u.is_test IS NULL)';
  }

  if (include_inactive !== 'true') {
    query += ' AND s.is_active = 1';
  }

  if (branch && branch !== 'all') {
    query += ' AND s.branch = ?';
    params.push(branch);
  }

  query += ' ORDER BY s.is_active DESC, s.full_name ASC';
  const specialists = db.prepare(query).all(...params);

  const formatted = specialists.map(s => {
    let workDays = [];
    let directionsList = [];
    try {
      workDays = JSON.parse(s.work_days || '[]');
    } catch (e) {
      workDays = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    }
    try {
      directionsList = JSON.parse(s.directions || '[]');
    } catch (e) {
      directionsList = [s.specialty];
    }
    return {
      ...s,
      workDays,
      directionsList
    };
  });

  res.json({ specialists: formatted });
});

// 2. Get specialist by id
router.get('/:id', (req, res) => {
  const specialist = db.prepare(`
    SELECT s.*, u.email as user_email, u.status as user_status, u.role as user_role
    FROM specialists s
    LEFT JOIN users u ON s.user_id = u.id
    WHERE s.id = ?
  `).get(req.params.id);

  if (!specialist) {
    return res.status(404).json({ error: 'Специалист не найден' });
  }

  let workDays = [];
  let directionsList = [];
  try {
    workDays = JSON.parse(specialist.work_days || '[]');
  } catch (e) {
    workDays = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  }
  try {
    directionsList = JSON.parse(specialist.directions || '[]');
  } catch (e) {
    directionsList = [specialist.specialty];
  }

  const assignedChildrenCount = db.prepare('SELECT COUNT(id) as count FROM children WHERE assigned_specialist_id = ? AND is_active = 1').get(req.params.id).count;
  const futureSessionsCount = db.prepare("SELECT COUNT(id) as count FROM schedule_sessions WHERE specialist_id = ? AND date >= date('now') AND status = 'scheduled'").get(req.params.id).count;

  res.json({
    specialist: {
      ...specialist,
      workDays,
      directionsList,
      assignedChildrenCount,
      futureSessionsCount
    }
  });
});

// 3. Create specialist (director, owner)
router.post('/', requireRoles('owner', 'director'), (req, res) => {
  const {
    first_name,
    last_name,
    middle_name,
    full_name,
    phone,
    email,
    position,
    specialty,
    directions,
    branch,
    start_date,
    work_days,
    work_hours_start,
    work_hours_end,
    session_duration_minutes,
    default_percentage,
    base_rate,
    color_badge,
    notes,
    create_user_account,
    user_password
  } = req.body;

  const fName = (first_name || '').trim();
  const lName = (last_name || '').trim();
  const mName = (middle_name || '').trim();
  const computedFullName = full_name ? full_name.trim() : `${fName} ${lName}`.trim();

  if (!computedFullName || !phone) {
    return res.status(400).json({ error: 'Заполните обязательные поля: ФИО и номер телефона' });
  }

  const workDaysJson = Array.isArray(work_days) ? JSON.stringify(work_days) : JSON.stringify(['mon', 'tue', 'wed', 'thu', 'fri', 'sat']);
  const directionsJson = Array.isArray(directions) ? JSON.stringify(directions) : (typeof directions === 'string' ? directions : JSON.stringify([specialty || 'Логопед']));
  const primarySpecialty = specialty || (Array.isArray(directions) && directions[0] ? directions[0] : 'Специалист');

  const result = db.prepare(`
    INSERT INTO specialists (
      full_name, first_name, last_name, middle_name, phone, email,
      position, specialty, directions, branch, start_date,
      default_percentage, base_rate, work_days, work_hours_start, work_hours_end,
      session_duration_minutes, color_badge, notes, is_active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `).run(
    computedFullName,
    fName || computedFullName,
    lName,
    mName || null,
    phone,
    email || null,
    position || 'Специалист',
    primarySpecialty,
    directionsJson,
    branch || 'Астана — Центр',
    start_date || new Date().toISOString().split('T')[0],
    default_percentage || 50.0,
    base_rate || 8000.0,
    workDaysJson,
    work_hours_start || '09:00',
    work_hours_end || '18:00',
    session_duration_minutes || 45,
    color_badge || '#38B9AD',
    notes || null
  );

  const newSpecialistId = result.lastInsertRowid;

  // Optional: automatically create a linked user account for this specialist
  let createdUserId = null;
  if (create_user_account && (email || phone)) {
    const salt = bcrypt.genSaltSync(10);
    const pwd = user_password || 'password123';
    const pwdHash = bcrypt.hashSync(pwd, salt);

    const existingUser = db.prepare('SELECT id FROM users WHERE (email IS NOT NULL AND email = ?) OR (phone IS NOT NULL AND phone = ?)').get(email || '__none__', phone || '__none__');
    if (!existingUser) {
      const uRes = db.prepare(`
        INSERT INTO users (
          name, first_name, last_name, middle_name, email, phone, 
          password_hash, role, status, specialist_id, branch
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'specialist', 'active', ?, ?)
      `).run(
        computedFullName,
        fName,
        lName,
        mName || null,
        email || null,
        phone,
        pwdHash,
        newSpecialistId,
        branch || 'Астана — Центр'
      );
      createdUserId = uRes.lastInsertRowid;
      db.prepare('UPDATE specialists SET user_id = ? WHERE id = ?').run(createdUserId, newSpecialistId);
    }
  }

  logAuditAction({
    userId: req.user.id,
    userName: req.user.name,
    userRole: req.user.role,
    action: 'SPECIALIST_CREATED',
    entityType: 'specialists',
    entityId: newSpecialistId,
    details: `Создана карточка специалиста: ${computedFullName} (${primarySpecialty}, филиал: ${branch || 'Астана — Центр'})`,
    ipAddress: req.ip
  });

  res.json({ 
    success: true, 
    id: newSpecialistId, 
    userId: createdUserId,
    message: `Специалист «${computedFullName}» успешно добавлен в команду Asar Qadam` 
  });
});

// 4. Update specialist (director, owner)
router.put('/:id', requireRoles('owner', 'director'), (req, res) => {
  const specialistId = req.params.id;
  const current = db.prepare('SELECT * FROM specialists WHERE id = ?').get(specialistId);
  if (!current) {
    return res.status(404).json({ error: 'Специалист не найден' });
  }

  const {
    first_name,
    last_name,
    middle_name,
    full_name,
    phone,
    email,
    position,
    specialty,
    directions,
    branch,
    start_date,
    work_days,
    work_hours_start,
    work_hours_end,
    session_duration_minutes,
    default_percentage,
    base_rate,
    notes,
    is_active
  } = req.body;

  const fName = first_name !== undefined ? (first_name || '').trim() : current.first_name;
  const lName = last_name !== undefined ? (last_name || '').trim() : current.last_name;
  const mName = middle_name !== undefined ? (middle_name || '').trim() : current.middle_name;
  const computedFullName = full_name ? full_name.trim() : (fName ? `${fName} ${lName}`.trim() : current.full_name);

  const workDaysJson = Array.isArray(work_days) ? JSON.stringify(work_days) : (work_days || current.work_days);
  const directionsJson = Array.isArray(directions) ? JSON.stringify(directions) : (directions || current.directions);

  db.prepare(`
    UPDATE specialists SET
      full_name = ?,
      first_name = ?,
      last_name = ?,
      middle_name = ?,
      phone = COALESCE(?, phone),
      email = COALESCE(?, email),
      position = COALESCE(?, position),
      specialty = COALESCE(?, specialty),
      directions = COALESCE(?, directions),
      branch = COALESCE(?, branch),
      start_date = COALESCE(?, start_date),
      work_days = COALESCE(?, work_days),
      work_hours_start = COALESCE(?, work_hours_start),
      work_hours_end = COALESCE(?, work_hours_end),
      session_duration_minutes = COALESCE(?, session_duration_minutes),
      default_percentage = COALESCE(?, default_percentage),
      base_rate = COALESCE(?, base_rate),
      notes = COALESCE(?, notes),
      is_active = COALESCE(?, is_active)
    WHERE id = ?
  `).run(
    computedFullName,
    fName,
    lName,
    mName,
    phone || null,
    email || null,
    position || null,
    specialty || null,
    directionsJson || null,
    branch || null,
    start_date || null,
    workDaysJson || null,
    work_hours_start || null,
    work_hours_end || null,
    session_duration_minutes || null,
    default_percentage !== undefined ? default_percentage : null,
    base_rate !== undefined ? base_rate : null,
    notes || null,
    is_active !== undefined ? (is_active ? 1 : 0) : null,
    specialistId
  );

  // If specialist has a linked user account, keep full name, phone, email in sync
  if (current.user_id) {
    db.prepare(`
      UPDATE users SET
        name = ?,
        first_name = ?,
        last_name = ?,
        middle_name = ?,
        phone = COALESCE(?, phone),
        email = COALESCE(?, email),
        branch = COALESCE(?, branch),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      computedFullName,
      fName,
      lName,
      mName,
      phone || null,
      email || null,
      branch || null,
      current.user_id
    );
  }

  logAuditAction({
    userId: req.user.id,
    userName: req.user.name,
    userRole: req.user.role,
    action: 'SPECIALIST_UPDATED',
    entityType: 'specialists',
    entityId: specialistId,
    details: `Обновлены данные специалиста: ${computedFullName}`,
    ipAddress: req.ip
  });

  res.json({ success: true, message: 'Данные специалиста успешно обновлены' });
});

// 5. Deactivate specialist (disappears from active roster, preserves history)
router.post('/:id/deactivate', requireRoles('owner', 'director'), (req, res) => {
  const specialistId = req.params.id;
  const { transfer_to_specialist_id } = req.body;

  const current = db.prepare('SELECT full_name FROM specialists WHERE id = ?').get(specialistId);
  if (!current) {
    return res.status(404).json({ error: 'Специалист не найден' });
  }

  // Check future scheduled sessions
  const futureSessions = db.prepare(`
    SELECT id, child_id, date, start_time, end_time, direction
    FROM schedule_sessions
    WHERE specialist_id = ? AND date >= date('now') AND status = 'scheduled'
  `).all(specialistId);

  // If sessions exist and transfer specialist provided, transfer them!
  if (futureSessions.length > 0 && transfer_to_specialist_id) {
    db.prepare(`
      UPDATE schedule_sessions 
      SET specialist_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE specialist_id = ? AND date >= date('now') AND status = 'scheduled'
    `).run(transfer_to_specialist_id, specialistId);
  }

  // Mark specialist as inactive
  db.prepare('UPDATE specialists SET is_active = 0 WHERE id = ?').run(specialistId);

  logAuditAction({
    userId: req.user.id,
    userName: req.user.name,
    userRole: req.user.role,
    action: 'SPECIALIST_DEACTIVATED',
    entityType: 'specialists',
    entityId: specialistId,
    details: `Деактивирован специалист ${current.full_name}. Будущих занятий: ${futureSessions.length}`,
    ipAddress: req.ip
  });

  res.json({
    success: true,
    message: `Специалист «${current.full_name}» деактивирован. Вся история работы и выплат сохранена.`,
    transferredSessionsCount: transfer_to_specialist_id ? futureSessions.length : 0,
    remainingFutureSessions: !transfer_to_specialist_id ? futureSessions.length : 0
  });
});

// 6. Reactivate specialist
router.post('/:id/activate', requireRoles('owner', 'director'), (req, res) => {
  const specialistId = req.params.id;
  const current = db.prepare('SELECT full_name FROM specialists WHERE id = ?').get(specialistId);
  if (!current) {
    return res.status(404).json({ error: 'Специалист не найден' });
  }

  db.prepare('UPDATE specialists SET is_active = 1 WHERE id = ?').run(specialistId);

  logAuditAction({
    userId: req.user.id,
    userName: req.user.name,
    userRole: req.user.role,
    action: 'SPECIALIST_ACTIVATED',
    entityType: 'specialists',
    entityId: specialistId,
    details: `Восстановлен активный статус специалиста ${current.full_name}`,
    ipAddress: req.ip
  });

  res.json({ success: true, message: `Специалист «${current.full_name}» снова активен` });
});

// 7. Delete Specialist Immediately (Owner and Director)
router.delete('/:id', requireRoles('owner', 'director'), async (req, res) => {
  const specialistId = req.params.id;
  const current = db.prepare('SELECT full_name FROM specialists WHERE id = ?').get(specialistId);
  if (!current) {
    return res.status(404).json({ error: 'Специалист не найден' });
  }

  // Preserve financial history by nullifying specialist_id in transactions and attendance
  db.prepare('UPDATE children SET assigned_specialist_id = NULL WHERE assigned_specialist_id = ?').run(specialistId);
  db.prepare('UPDATE financial_transactions SET specialist_id = NULL WHERE specialist_id = ?').run(specialistId);
  db.prepare('UPDATE attendance SET specialist_id = NULL WHERE specialist_id = ?').run(specialistId);
  db.prepare('UPDATE payouts SET specialist_id = NULL WHERE specialist_id = ?').run(specialistId);
  db.prepare('UPDATE users SET specialist_id = NULL WHERE specialist_id = ?').run(specialistId);
  db.prepare('DELETE FROM schedule_sessions WHERE specialist_id = ?').run(specialistId);
  db.prepare('DELETE FROM specialists WHERE id = ?').run(specialistId);

  // Direct Supabase double-check
  if (db.supabase) {
    try {
      await db.supabase.from('children').update({ assigned_specialist_id: null }).eq('assigned_specialist_id', specialistId);
      await db.supabase.from('financial_transactions').update({ specialist_id: null }).eq('specialist_id', specialistId);
      await db.supabase.from('attendance').update({ specialist_id: null }).eq('specialist_id', specialistId);
      await db.supabase.from('users').update({ specialist_id: null }).eq('specialist_id', specialistId);
      await db.supabase.from('schedule_sessions').delete().eq('specialist_id', specialistId);
      await db.supabase.from('specialists').delete().eq('id', specialistId);
    } catch (e) {
      console.warn('[Supabase Direct Delete Warning]:', e.message);
    }
  }

  logAuditAction({
    userId: req.user.id,
    userName: req.user.name,
    userRole: req.user.role,
    action: 'SPECIALIST_DELETED',
    entityType: 'specialists',
    entityId: specialistId,
    details: `Удален специалист: ${current.full_name}`,
    ipAddress: req.ip
  });

  res.json({ success: true, message: `Специалист «${current.full_name}» удалён` });
});

module.exports = router;
