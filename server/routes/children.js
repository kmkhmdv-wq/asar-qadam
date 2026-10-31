const express = require('express');
const router = express.Router();
const db = require('../db');
const { authMiddleware, requireRoles, logAuditAction } = require('../auth');

router.use(authMiddleware);

// Helper to calculate exact age in years and months
function calculateAge(birthDateStr) {
  if (!birthDateStr) return { years: 0, months: 0, label: '—' };
  const birthDate = new Date(birthDateStr);
  const today = new Date();
  
  let years = today.getFullYear() - birthDate.getFullYear();
  let months = today.getMonth() - birthDate.getMonth();
  
  if (months < 0 || (months === 0 && today.getDate() < birthDate.getDate())) {
    years--;
    months += 12;
  }
  
  const getYearWord = (y) => {
    if (y % 10 === 1 && y % 100 !== 11) return 'год';
    if ([2, 3, 4].includes(y % 10) && ![12, 13, 14].includes(y % 100)) return 'года';
    return 'лет';
  };

  const getMonthWord = (m) => {
    if (m % 10 === 1 && m % 100 !== 11) return 'месяц';
    if ([2, 3, 4].includes(m % 10) && ![12, 13, 14].includes(m % 100)) return 'месяца';
    return 'месяцев';
  };

  const label = `${years} ${getYearWord(years)} ${months > 0 ? `${months} ${getMonthWord(months)}` : ''}`.trim();
  return { years, months, label };
}

// 1. List active children
router.get('/', (req, res) => {
  const user = req.user;
  let query = `
    SELECT 
      c.*,
      s.full_name as specialist_name,
      s.specialty as specialist_specialty
    FROM children c
    LEFT JOIN specialists s ON c.assigned_specialist_id = s.id
    WHERE c.is_active = 1 AND (c.status = 'active' OR c.status IS NULL)
  `;
  const params = [];

  // If role is specialist, only see their assigned children or children who have sessions with them
  if (user.role === 'specialist') {
    if (user.specialist_id) {
      query += ` AND (
        c.assigned_specialist_id = ? 
        OR c.id IN (SELECT child_id FROM schedule_sessions WHERE specialist_id = ?)
      )`;
      params.push(user.specialist_id, user.specialist_id);
    } else {
      return res.json({ children: [] });
    }
  }

  query += ' ORDER BY c.full_name ASC';
  const rawChildren = db.prepare(query).all(...params);

  const children = rawChildren.map(c => {
    const age = calculateAge(c.birth_date);
    return {
      ...c,
      ageYears: age.years,
      ageMonths: age.months,
      ageLabel: age.label,
      hasMedicalAlert: !!(c.has_asthma || c.has_epilepsy || c.has_allergy || c.chronic_diseases)
    };
  });

  res.json({ children });
});

// 2. List archived children (for Children Archive section)
router.get('/archived', requireRoles('owner', 'director', 'admin'), (req, res) => {
  const query = `
    SELECT 
      c.*,
      s.full_name as specialist_name,
      s.specialty as specialist_specialty,
      u.name as archived_by_name
    FROM children c
    LEFT JOIN specialists s ON c.assigned_specialist_id = s.id
    LEFT JOIN users u ON c.archived_by = u.id
    WHERE c.is_active = 0 OR c.status = 'archived'
    ORDER BY c.archived_at DESC, c.full_name ASC
  `;
  const rawChildren = db.prepare(query).all();

  const children = rawChildren.map(c => {
    const age = calculateAge(c.birth_date);
    return {
      ...c,
      ageYears: age.years,
      ageMonths: age.months,
      ageLabel: age.label,
      hasMedicalAlert: !!(c.has_asthma || c.has_epilepsy || c.has_allergy || c.chronic_diseases)
    };
  });

  res.json({ archivedChildren: children });
});

// 3. Get individual child full digital card
router.get('/:id', (req, res) => {
  const childId = req.params.id;
  const user = req.user;

  // Specialist check
  if (user.role === 'specialist' && user.specialist_id) {
    const allowed = db.prepare(`
      SELECT id FROM children 
      WHERE id = ? AND (
        assigned_specialist_id = ? 
        OR id IN (SELECT child_id FROM schedule_sessions WHERE specialist_id = ?)
      )
    `).get(childId, user.specialist_id, user.specialist_id);

    if (!allowed) {
      return res.status(403).json({ error: 'У вас нет доступа к карточке этого ребёнка' });
    }
  }

  const child = db.prepare(`
    SELECT c.*, s.full_name as specialist_name, s.specialty as specialist_specialty
    FROM children c
    LEFT JOIN specialists s ON c.assigned_specialist_id = s.id
    WHERE c.id = ?
  `).get(childId);

  if (!child) {
    return res.status(404).json({ error: 'Ребёнок не найден' });
  }

  const age = calculateAge(child.birth_date);

  // Attendance history
  const attendanceHistory = db.prepare(`
    SELECT a.*, s.full_name as specialist_name, sc.direction, sc.start_time, sc.end_time
    FROM attendance a
    JOIN specialists s ON a.specialist_id = s.id
    LEFT JOIN schedule_sessions sc ON a.session_id = sc.id
    WHERE a.child_id = ?
    ORDER BY a.date DESC, a.created_at DESC
    LIMIT 50
  `).all(childId);

  // Payment & financial history (restricted for specialists)
  let financialHistory = [];
  if (['owner', 'director', 'admin'].includes(user.role)) {
    financialHistory = db.prepare(`
      SELECT ft.*, s.full_name as specialist_name
      FROM financial_transactions ft
      LEFT JOIN specialists s ON ft.specialist_id = s.id
      WHERE ft.child_id = ?
      ORDER BY ft.created_at DESC
      LIMIT 50
    `).all(childId);
  }

  // Upcoming scheduled sessions
  const upcomingSessions = db.prepare(`
    SELECT s.*, sp.full_name as specialist_name
    FROM schedule_sessions s
    JOIN specialists sp ON s.specialist_id = sp.id
    WHERE s.child_id = ? AND s.date >= date('now')
    ORDER BY s.date ASC, s.start_time ASC
    LIMIT 20
  `).all(childId);

  res.json({
    child: {
      ...child,
      ageYears: age.years,
      ageMonths: age.months,
      ageLabel: age.label,
      hasMedicalAlert: !!(child.has_asthma || child.has_epilepsy || child.has_allergy || child.chronic_diseases)
    },
    attendanceHistory,
    financialHistory,
    upcomingSessions
  });
});

// 4. Create child card (admin, director, owner)
router.post('/', requireRoles('owner', 'director', 'admin'), (req, res) => {
  const {
    full_name,
    birth_date,
    gender,
    parent_name,
    parent_phone,
    parent_phone_extra,
    admission_date,
    diagnosis,
    development_notes,
    has_asthma,
    has_epilepsy,
    has_allergy,
    allergy_details,
    chronic_diseases,
    contraindications,
    notes,
    assigned_specialist_id,
    direction,
    sessions_per_week,
    custom_price,
    balance
  } = req.body;

  if (!full_name || !birth_date || !parent_name || !parent_phone) {
    return res.status(400).json({ error: 'Заполните обязательные поля: ФИО, дата рождения, родитель и контактный телефон' });
  }

  const result = db.prepare(`
    INSERT INTO children (
      full_name, birth_date, gender, parent_name, parent_phone, parent_phone_extra,
      admission_date, diagnosis, development_notes, has_asthma, has_epilepsy,
      has_allergy, allergy_details, chronic_diseases, contraindications, notes,
      assigned_specialist_id, direction, sessions_per_week, custom_price, balance,
      status, is_active
    ) VALUES (
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      'active', 1
    )
  `).run(
    full_name.trim(),
    birth_date,
    gender || 'male',
    parent_name.trim(),
    parent_phone.trim(),
    parent_phone_extra || null,
    admission_date || new Date().toISOString().split('T')[0],
    diagnosis || null,
    development_notes || null,
    has_asthma ? 1 : 0,
    has_epilepsy ? 1 : 0,
    has_allergy ? 1 : 0,
    allergy_details || null,
    chronic_diseases || null,
    contraindications || null,
    notes || null,
    assigned_specialist_id || null,
    direction || null,
    sessions_per_week || 2,
    custom_price || null,
    balance || 0
  );

  logAuditAction({
    userId: req.user.id,
    userName: req.user.name,
    userRole: req.user.role,
    action: 'CHILD_CREATED',
    entityType: 'children',
    entityId: result.lastInsertRowid,
    details: `Создана карточка воспитанника: ${full_name}`,
    ipAddress: req.ip
  });

  // Telegram notification
  let specName = null;
  if (assigned_specialist_id) {
    const sp = db.prepare('SELECT full_name FROM specialists WHERE id = ?').get(assigned_specialist_id);
    if (sp) specName = sp.full_name;
  }
  const { notifyNewChild } = require('../services/telegramService');
  notifyNewChild({
    fullName: full_name.trim(),
    birthDate: birth_date,
    parentName: parent_name.trim(),
    parentPhone: parent_phone.trim(),
    diagnosis,
    assignedSpecialist: specName,
    direction
  }).catch(err => console.warn('[Telegram Notify Error]:', err.message));

  res.json({ success: true, id: result.lastInsertRowid, message: 'Карточка ребёнка успешно создана' });
});


// 5. Update child card (admin, director, owner)
router.put('/:id', requireRoles('owner', 'director', 'admin'), (req, res) => {
  const childId = req.params.id;
  const {
    full_name,
    birth_date,
    gender,
    parent_name,
    parent_phone,
    parent_phone_extra,
    admission_date,
    diagnosis,
    development_notes,
    has_asthma,
    has_epilepsy,
    has_allergy,
    allergy_details,
    chronic_diseases,
    contraindications,
    notes,
    assigned_specialist_id,
    direction,
    sessions_per_week,
    custom_price,
    balance
  } = req.body;

  db.prepare(`
    UPDATE children SET
      full_name = ?, birth_date = ?, gender = ?, parent_name = ?, parent_phone = ?, parent_phone_extra = ?,
      admission_date = ?, diagnosis = ?, development_notes = ?, has_asthma = ?, has_epilepsy = ?,
      has_allergy = ?, allergy_details = ?, chronic_diseases = ?, contraindications = ?, notes = ?,
      assigned_specialist_id = ?, direction = ?, sessions_per_week = ?, custom_price = ?, balance = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    full_name.trim(),
    birth_date,
    gender,
    parent_name.trim(),
    parent_phone.trim(),
    parent_phone_extra || null,
    admission_date,
    diagnosis || null,
    development_notes || null,
    has_asthma ? 1 : 0,
    has_epilepsy ? 1 : 0,
    has_allergy ? 1 : 0,
    allergy_details || null,
    chronic_diseases || null,
    contraindications || null,
    notes || null,
    assigned_specialist_id || null,
    direction || null,
    sessions_per_week || 2,
    custom_price || null,
    balance || 0,
    childId
  );

  logAuditAction({
    userId: req.user.id,
    userName: req.user.name,
    userRole: req.user.role,
    action: 'CHILD_UPDATED',
    entityType: 'children',
    entityId: childId,
    details: `Обновлена карточка ребёнка ${full_name}`,
    ipAddress: req.ip
  });

  res.json({ success: true, message: 'Данные ребёнка успешно обновлены' });
});

// 6. Archive child (disappears from active roster, preserves all history)
router.post('/:id/archive', requireRoles('owner', 'director', 'admin'), (req, res) => {
  const childId = req.params.id;
  const { reason } = req.body;
  const child = db.prepare('SELECT full_name FROM children WHERE id = ?').get(childId);
  
  if (!child) {
    return res.status(404).json({ error: 'Ребёнок не найден' });
  }

  // Cancel future scheduled sessions or mark them
  db.prepare(`
    UPDATE schedule_sessions 
    SET status = 'cancelled_center', comment = 'Карточка ребёнка перенесена в архив', updated_at = CURRENT_TIMESTAMP
    WHERE child_id = ? AND date >= date('now') AND status = 'scheduled'
  `).run(childId);

  db.prepare(`
    UPDATE children SET 
      is_active = 0, 
      status = 'archived',
      archived_at = CURRENT_TIMESTAMP,
      archived_by = ?,
      archive_reason = ?,
      updated_at = CURRENT_TIMESTAMP 
    WHERE id = ?
  `).run(req.user.id, reason || 'Архивировано сотрудником', childId);

  logAuditAction({
    userId: req.user.id,
    userName: req.user.name,
    userRole: req.user.role,
    action: 'CHILD_ARCHIVED',
    entityType: 'children',
    entityId: childId,
    details: `Карточка ребёнка «${child.full_name}» перенесена в архив. Причина: ${reason || '—'}`,
    ipAddress: req.ip
  });

  res.json({ success: true, message: `Карточка «${child.full_name}» успешно перенесена в архив` });
});

// 7. Restore child from archive
router.post('/:id/restore', requireRoles('owner', 'director', 'admin'), (req, res) => {
  const childId = req.params.id;
  const child = db.prepare('SELECT full_name FROM children WHERE id = ?').get(childId);
  
  if (!child) {
    return res.status(404).json({ error: 'Ребёнок не найден' });
  }

  db.prepare(`
    UPDATE children SET 
      is_active = 1, 
      status = 'active',
      archived_at = NULL,
      archive_reason = NULL,
      updated_at = CURRENT_TIMESTAMP 
    WHERE id = ?
  `).run(childId);

  logAuditAction({
    userId: req.user.id,
    userName: req.user.name,
    userRole: req.user.role,
    action: 'CHILD_RESTORED',
    entityType: 'children',
    entityId: childId,
    details: `Карточка ребёнка «${child.full_name}» восстановлена из архива в действующий список`,
    ipAddress: req.ip
  });

  res.json({ success: true, message: `Карточка «${child.full_name}» восстановлена в активный список` });
});

// 8. Hard Delete (Owner and Director only)
router.delete('/:id/hard-delete', requireRoles('owner', 'director'), (req, res) => {
  const childId = req.params.id;
  const child = db.prepare('SELECT full_name FROM children WHERE id = ?').get(childId);
  
  if (!child) {
    return res.status(404).json({ error: 'Ребёнок не найден' });
  }

  // Clean future sessions
  db.prepare('DELETE FROM schedule_sessions WHERE child_id = ? AND date >= date("now")').run(childId);
  // Delete child (attendance & past sessions have cascade or set null, financial transactions have ON DELETE SET NULL)
  db.prepare('DELETE FROM children WHERE id = ?').run(childId);

  logAuditAction({
    userId: req.user.id,
    userName: req.user.name,
    userRole: req.user.role,
    action: 'CHILD_DELETED',
    entityType: 'children',
    entityId: childId,
    details: `Полное удаление карточки ребёнка «${child.full_name}»`,
    ipAddress: req.ip
  });

  res.json({ success: true, message: `Карточка «${child.full_name}» удалена навсегда` });
});

module.exports = router;
