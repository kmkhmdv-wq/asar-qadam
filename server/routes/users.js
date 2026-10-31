const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../db');
const { authMiddleware, requireRoles, logAuditAction } = require('../auth');

// All endpoints require director or owner access
router.use(authMiddleware);
router.use(requireRoles('owner', 'director'));

// 1. List all registered users
router.get('/', (req, res) => {
  const users = db.prepare(`
    SELECT u.id, u.name, u.first_name, u.last_name, u.middle_name, u.email, u.phone, 
           u.role, u.status, u.specialist_id, u.branch, u.avatar_url, u.created_at,
           s.specialty, s.full_name as specialist_name
    FROM users u
    LEFT JOIN specialists s ON u.specialist_id = s.id
    ORDER BY u.created_at DESC
  `).all();
  res.json({ users });
});

// 2. List pending registration requests
router.get('/pending', (req, res) => {
  const requests = db.prepare(`
    SELECT id, name, first_name, last_name, middle_name, email, phone, role, status, branch, created_at
    FROM users
    WHERE status = 'pending'
    ORDER BY created_at DESC
  `).all();
  res.json({ requests });
});

// 3. Approve user registration and assign role & branch
const handleApprove = (req, res) => {
  const userId = req.params.id || req.body.userId;
  const targetRole = req.body.assignedRole || req.body.role;
  const { specialistId, branch } = req.body;

  if (!userId || !targetRole) {
    return res.status(400).json({ error: 'Необходимо указать ID пользователя и назначаемую роль' });
  }

  // Only owner can assign 'owner' or 'director' role
  if ((targetRole === 'owner' || targetRole === 'director') && req.user.role !== 'owner') {
    return res.status(403).json({ error: 'Только Владелец может назначать роли Руководителя или Владельца' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) {
    return res.status(404).json({ error: 'Пользователь не найден' });
  }

  db.prepare(`
    UPDATE users 
    SET status = 'active', role = ?, specialist_id = ?, branch = COALESCE(?, branch), updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(targetRole, specialistId || null, branch || 'Астана — Центр', userId);

  // If linked to specialist, link user_id in specialists
  if (specialistId) {
    db.prepare('UPDATE specialists SET user_id = ? WHERE id = ?').run(userId, specialistId);
  }

  logAuditAction({
    userId: req.user.id,
    userName: req.user.name,
    userRole: req.user.role,
    action: 'USER_APPROVED',
    entityType: 'users',
    entityId: userId,
    details: `Одобрена заявка ${user.name}: роль «${targetRole}», филиал «${branch || 'Астана — Центр'}»`,
    ipAddress: req.ip
  });

  res.json({ success: true, message: `Пользователь ${user.name} успешно одобрен и получил роль ${targetRole}` });
};

router.post('/approve', handleApprove);
router.post('/:id/approve', handleApprove);

// 4. Reject registration request
router.post('/reject', (req, res) => {
  const { userId, reason } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) {
    return res.status(404).json({ error: 'Пользователь не найден' });
  }

  db.prepare('DELETE FROM users WHERE id = ?').run(userId);

  logAuditAction({
    userId: req.user.id,
    userName: req.user.name,
    userRole: req.user.role,
    action: 'USER_REJECTED',
    entityType: 'users',
    entityId: userId,
    details: `Отклонена заявка на регистрацию: ${user.name} (${user.email || user.phone}). Причина: ${reason || 'Не соответствует требованиям'}`,
    ipAddress: req.ip
  });

  res.json({ success: true, message: `Заявка пользователя ${user.name} отклонена` });
});

// 5. Block / Unblock user
router.post('/status', (req, res) => {
  const { userId, status } = req.body;
  if (!['pending', 'active', 'blocked'].includes(status)) {
    return res.status(400).json({ error: 'Некорректный статус' });
  }

  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!target) {
    return res.status(404).json({ error: 'Пользователь не найден' });
  }

  if (target.role === 'owner' && req.user.role !== 'owner') {
    return res.status(403).json({ error: 'Нельзя изменить статус Владельца' });
  }

  db.prepare('UPDATE users SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, userId);

  logAuditAction({
    userId: req.user.id,
    userName: req.user.name,
    userRole: req.user.role,
    action: status === 'blocked' ? 'USER_BLOCKED' : 'USER_STATUS_CHANGED',
    entityType: 'users',
    entityId: userId,
    details: `Статус пользователя ${target.name} изменён на «${status}»`,
    ipAddress: req.ip
  });

  res.json({ success: true, message: 'Статус пользователя обновлен' });
});

// 6. Edit employee work profile by owner / director
router.put('/:id/work-profile', (req, res) => {
  const targetId = req.params.id;
  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(targetId);
  if (!target) {
    return res.status(404).json({ error: 'Сотрудник не найден' });
  }

  const {
    first_name,
    last_name,
    middle_name,
    role,
    branch,
    specialist_id,
    status
  } = req.body;

  if (role && (role === 'owner' || target.role === 'owner') && req.user.role !== 'owner') {
    return res.status(403).json({ error: 'Только Владелец может изменять роль Владельца' });
  }

  const fName = first_name !== undefined ? (first_name || '').trim() : target.first_name;
  const lName = last_name !== undefined ? (last_name || '').trim() : target.last_name;
  const mName = middle_name !== undefined ? (middle_name || '').trim() : target.middle_name;
  const fullName = `${fName} ${lName}`.trim() || target.name;

  db.prepare(`
    UPDATE users SET
      name = ?,
      first_name = ?,
      last_name = ?,
      middle_name = ?,
      role = COALESCE(?, role),
      branch = COALESCE(?, branch),
      specialist_id = ?,
      status = COALESCE(?, status),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    fullName,
    fName,
    lName,
    mName || null,
    role || null,
    branch || null,
    specialist_id !== undefined ? (specialist_id || null) : target.specialist_id,
    status || null,
    targetId
  );

  // If linked specialist exists, sync name
  if (specialist_id || target.specialist_id) {
    const spId = specialist_id || target.specialist_id;
    db.prepare('UPDATE specialists SET full_name = ?, first_name = ?, last_name = ?, branch = COALESCE(?, branch) WHERE id = ?').run(
      fullName, fName, lName, branch || null, spId
    );
  }

  logAuditAction({
    userId: req.user.id,
    userName: req.user.name,
    userRole: req.user.role,
    action: 'USER_WORK_PROFILE_UPDATED',
    entityType: 'users',
    entityId: targetId,
    details: `Руководство обновило рабочие параметры сотрудника ${fullName} (роль: ${role || target.role}, филиал: ${branch || target.branch})`,
    ipAddress: req.ip
  });

  res.json({ success: true, message: 'Рабочий профиль сотрудника успешно обновлен' });
});

// 7. Reset employee password by admin / director
router.post('/:id/reset-password', (req, res) => {
  const targetId = req.params.id;
  const { new_password } = req.body;
  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(targetId);
  if (!target) {
    return res.status(404).json({ error: 'Сотрудник не найден' });
  }

  const pwd = new_password || 'password123';
  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync(pwd, salt);

  db.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(passwordHash, targetId);

  logAuditAction({
    userId: req.user.id,
    userName: req.user.name,
    userRole: req.user.role,
    action: 'USER_PASSWORD_RESET_BY_ADMIN',
    entityType: 'users',
    entityId: targetId,
    details: `Сброшен пароль сотрудника ${target.name}`,
    ipAddress: req.ip
  });

  res.json({ success: true, message: `Пароль сотрудника ${target.name} сброшен на «${pwd}»` });
});

// 8. Create employee directly from admin panel
router.post('/create', (req, res) => {
  const {
    first_name,
    last_name,
    middle_name,
    name,
    email,
    phone,
    password,
    role,
    branch,
    specialistId
  } = req.body;

  const fName = (first_name || '').trim();
  const lName = (last_name || '').trim();
  const mName = (middle_name || '').trim();
  const fullName = name ? name.trim() : `${fName} ${lName}`.trim();

  if (!fullName || !password || !role) {
    return res.status(400).json({ error: 'Заполните обязательные поля: ФИО, пароль, роль' });
  }

  // Check unique
  const existing = db.prepare('SELECT id FROM users WHERE (email IS NOT NULL AND email = ?) OR (phone IS NOT NULL AND phone = ?)').get(email || '__none__', phone || '__none__');
  if (existing) {
    return res.status(400).json({ error: 'Пользователь с таким email или телефоном уже существует' });
  }

  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync(password, salt);

  const result = db.prepare(`
    INSERT INTO users (
      name, first_name, last_name, middle_name, email, phone, 
      password_hash, role, status, specialist_id, branch, phone_confirmed, email_confirmed
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, 1, 1)
  `).run(
    fullName,
    fName || fullName,
    lName,
    mName || null,
    email || null,
    phone || null,
    passwordHash,
    role,
    specialistId || null,
    branch || 'Астана — Центр'
  );

  const newUserId = result.lastInsertRowid;
  if (specialistId) {
    db.prepare('UPDATE specialists SET user_id = ? WHERE id = ?').run(newUserId, specialistId);
  }

  logAuditAction({
    userId: req.user.id,
    userName: req.user.name,
    userRole: req.user.role,
    action: 'EMPLOYEE_CREATED',
    entityType: 'users',
    entityId: newUserId,
    details: `Создан аккаунт сотрудника ${fullName} с ролью «${role}» (филиал: ${branch || 'Астана — Центр'})`,
    ipAddress: req.ip
  });

  res.json({ success: true, message: 'Сотрудник успешно создан', userId: newUserId });
});

module.exports = router;
