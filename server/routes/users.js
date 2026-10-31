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
router.get('/pending', async (req, res) => {
  try {
    const { data: suRequests, error } = await db.supabase
      .from('users')
      .select('id, name, first_name, last_name, middle_name, email, phone, role, status, branch, created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (!error && suRequests) {
      // Sync into local SQLite
      for (const r of suRequests) {
        try {
          db.prepare(`
            INSERT OR REPLACE INTO users (id, name, first_name, last_name, middle_name, email, phone, role, status, branch, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(r.id, r.name, r.first_name, r.last_name, r.middle_name, r.email, r.phone, r.role, r.status, r.branch, r.created_at);
        } catch (e) {}
      }
      return res.json({ requests: suRequests });
    }
  } catch (err) {
    console.warn('[Supabase pending fetch warn]:', err.message);
  }

  const requests = db.prepare(`
    SELECT id, name, first_name, last_name, middle_name, email, phone, role, status, branch, created_at
    FROM users
    WHERE status = 'pending'
    ORDER BY created_at DESC
  `).all();
  res.json({ requests });
});

// 3. Approve user registration and assign role & branch
const handleApprove = async (req, res) => {
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

  // 1. Update in Supabase (Cloud truth)
  try {
    await db.supabase
      .from('users')
      .update({
        status: 'active',
        role: targetRole,
        specialist_id: specialistId || null,
        branch: branch || 'Астана — Центр',
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (specialistId) {
      await db.supabase.from('specialists').update({ user_id: userId }).eq('id', specialistId);
    }
    console.log(`[Supabase] User #${userId} approved with role ${targetRole}`);
  } catch (err) {
    console.warn('[Supabase Approve Warn]:', err.message);
  }

  // 2. Update local SQLite
  db.prepare(`
    UPDATE users 
    SET status = 'active', role = ?, specialist_id = ?, branch = COALESCE(?, branch), updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(targetRole, specialistId || null, branch || 'Астана — Центр', userId);

  if (specialistId) {
    db.prepare('UPDATE specialists SET user_id = ? WHERE id = ?').run(userId, specialistId);
  }

  const userName = user ? user.name : `Пользователь #${userId}`;

  logAuditAction({
    userId: req.user.id,
    userName: req.user.name,
    userRole: req.user.role,
    action: 'USER_APPROVED',
    entityType: 'users',
    entityId: userId,
    details: `Одобрена заявка ${userName}: роль «${targetRole}», филиал «${branch || 'Астана — Центр'}» (Supabase)`,
    ipAddress: req.ip
  });

  res.json({ success: true, message: `Пользователь ${userName} успешно одобрен в Supabase и получил роль ${targetRole}` });
};

router.post('/approve', handleApprove);
router.post('/:id/approve', handleApprove);

// 4. Reject registration request
router.post('/reject', async (req, res) => {
  const { userId, reason } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);

  // 1. Delete from Supabase
  try {
    await db.supabase.from('users').delete().eq('id', userId);
    console.log(`[Supabase] Registration request #${userId} rejected and removed`);
  } catch (err) {
    console.warn('[Supabase Reject Warn]:', err.message);
  }

  // 2. Delete from local SQLite
  db.prepare('DELETE FROM users WHERE id = ?').run(userId);

  const userName = user ? user.name : `Пользователь #${userId}`;

  logAuditAction({
    userId: req.user.id,
    userName: req.user.name,
    userRole: req.user.role,
    action: 'USER_REJECTED',
    entityType: 'users',
    entityId: userId,
    details: `Отклонена заявка на регистрацию: ${userName}. Причина: ${reason || 'Не соответствует требованиям'}`,
    ipAddress: req.ip
  });

  res.json({ success: true, message: `Заявка пользователя ${userName} отклонена` });
});

// 5. Block / Unblock user
router.post('/status', async (req, res) => {
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

  // 1. Update in Supabase
  try {
    await db.supabase.from('users').update({ status, updated_at: new Date().toISOString() }).eq('id', userId);
  } catch (err) {
    console.warn('[Supabase Status Warn]:', err.message);
  }

  // 2. Update local SQLite
  db.prepare('UPDATE users SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, userId);

  logAuditAction({
    userId: req.user.id,
    userName: req.user.name,
    userRole: req.user.role,
    action: status === 'blocked' ? 'USER_BLOCKED' : 'USER_STATUS_CHANGED',
    entityType: 'users',
    entityId: userId,
    details: `Статус пользователя ${target.name} изменён на «${status}» (Supabase)`,
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
router.post('/create', async (req, res) => {
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

  let newUserId = null;

  // 1. Insert directly into Supabase
  try {
    const { data: suUser, error: suErr } = await db.supabase
      .from('users')
      .insert({
        name: fullName,
        first_name: fName || fullName,
        last_name: lName,
        middle_name: mName || null,
        email: email || null,
        phone: phone || null,
        password_hash: passwordHash,
        role,
        status: 'active',
        specialist_id: specialistId || null,
        branch: branch || 'Астана — Центр',
        phone_confirmed: 1,
        email_confirmed: 1
      })
      .select()
      .single();

    if (!suErr && suUser) {
      newUserId = suUser.id;
      console.log(`[Supabase] Employee created with ID: ${newUserId}`);
    }
  } catch (err) {
    console.warn('[Supabase Create Employee Warn]:', err.message);
  }

  // 2. Mirror into local SQLite
  if (newUserId) {
    db.prepare(`
      INSERT OR REPLACE INTO users (
        id, name, first_name, last_name, middle_name, email, phone, 
        password_hash, role, status, specialist_id, branch, phone_confirmed, email_confirmed
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, 1, 1)
    `).run(
      newUserId,
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
  } else {
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
    newUserId = result.lastInsertRowid;
  }

  if (specialistId) {
    try {
      await db.supabase.from('specialists').update({ user_id: newUserId }).eq('id', specialistId);
    } catch (e) {}
    db.prepare('UPDATE specialists SET user_id = ? WHERE id = ?').run(newUserId, specialistId);
  }

  logAuditAction({
    userId: req.user.id,
    userName: req.user.name,
    userRole: req.user.role,
    action: 'EMPLOYEE_CREATED',
    entityType: 'users',
    entityId: newUserId,
    details: `Создан аккаунт сотрудника ${fullName} с ролью «${role}» в Supabase (филиал: ${branch || 'Астана — Центр'})`,
    ipAddress: req.ip
  });

  res.json({ success: true, message: 'Сотрудник успешно создан в Supabase', userId: newUserId });
});


module.exports = router;
