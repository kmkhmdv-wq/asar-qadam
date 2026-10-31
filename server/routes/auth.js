const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../db');
const { generateToken, authMiddleware, logAuditAction } = require('../auth');

// 1. Send SMS / Email Verification Code (Simulated with code '1234')
router.post('/send-code', (req, res) => {
  const { target, purpose } = req.body;
  if (!target) {
    return res.status(400).json({ error: 'Укажите номер телефона или email для отправки кода' });
  }

  // Generate 4-digit code (simulated SMS / email delivery)
  const code = '1234';

  res.json({
    success: true,
    code, // returned so the UI / tester can easily see and enter it
    message: `Код подтверждения отправлен на ${target}: 1234`
  });
});

// 2. Register user (status='pending')
router.post('/register', async (req, res) => {
  const {
    first_name,
    firstName,
    last_name,
    lastName,
    middle_name,
    middleName,
    name,
    email,
    phone,
    password,
    verification_code,
    verificationCode,
    roleRequest
  } = req.body;

  const fName = (first_name || firstName || '').trim();
  const lName = (last_name || lastName || '').trim();
  const mName = (middle_name || middleName || '').trim();
  const fullName = name ? name.trim() : `${fName} ${lName}`.trim();
  const vCode = verification_code || verificationCode;

  if (!fullName || (!email && !phone) || !password) {
    return res.status(400).json({ 
      error: 'Пожалуйста, заполните имя, фамилию, контакт (email или телефон) и пароль' 
    });
  }

  // Verification code check (simulated '1234' or any 4-digit code)
  if (vCode && vCode !== '1234') {
    return res.status(400).json({ error: 'Неверный код подтверждения (для теста используйте 1234)' });
  }

  // Check existing in local cache
  const existingLocal = db.prepare('SELECT id FROM users WHERE (email IS NOT NULL AND email = ?) OR (phone IS NOT NULL AND phone = ?)').get(email || '__none__', phone || '__none__');
  if (existingLocal) {
    return res.status(400).json({ error: 'Пользователь с таким email или телефоном уже зарегистрирован в системе' });
  }

  // Check existing in Supabase
  try {
    const { data: existingSupabase } = await db.supabase
      .from('users')
      .select('id')
      .or(`email.eq.${email || '__none__'},phone.eq.${phone || '__none__'}`)
      .maybeSingle();

    if (existingSupabase) {
      return res.status(400).json({ error: 'Пользователь с таким email или телефоном уже зарегистрирован в системе' });
    }
  } catch (err) {
    console.warn('[Supabase check existing warning]:', err.message);
  }

  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync(password, salt);

  let createdUser = null;

  // 1. Insert directly into Supabase (Permanent cloud storage for registrations)
  try {
    const { data: suData, error: suError } = await db.supabase
      .from('users')
      .insert({
        name: fullName,
        first_name: fName || fullName,
        last_name: lName,
        middle_name: mName || null,
        email: email || null,
        phone: phone || null,
        password_hash: passwordHash,
        role: 'specialist',
        status: 'pending',
        phone_confirmed: 1,
        email_confirmed: 1,
        branch: 'Астана — Центр'
      })
      .select()
      .single();

    if (!suError && suData) {
      createdUser = suData;
      console.log(`[Supabase] Registration application stored successfully. User ID: ${createdUser.id}`);
    } else if (suError) {
      console.warn('[Supabase Registration Insert Warn]:', suError.message);
    }
  } catch (err) {
    console.warn('[Supabase Registration Error]:', err.message);
  }

  // 2. Also mirror into local database
  let localId = createdUser ? createdUser.id : null;
  try {
    if (createdUser) {
      db.prepare(`
        INSERT OR REPLACE INTO users (
          id, name, first_name, last_name, middle_name, email, phone, 
          password_hash, role, status, phone_confirmed, email_confirmed, branch
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'specialist', 'pending', 1, 1, 'Астана — Центр')
      `).run(
        createdUser.id,
        fullName,
        fName || fullName,
        lName,
        mName || null,
        email || null,
        phone || null,
        passwordHash
      );
    } else {
      const result = db.prepare(`
        INSERT INTO users (
          name, first_name, last_name, middle_name, email, phone, 
          password_hash, role, status, phone_confirmed, email_confirmed
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, 'specialist', 'pending', 1, 1)
      `).run(
        fullName,
        fName || fullName,
        lName,
        mName || null,
        email || null,
        phone || null,
        passwordHash
      );
      localId = result.lastInsertRowid;
    }
  } catch (e) {
    console.warn('Local insert warning:', e.message);
  }

  const finalId = createdUser ? createdUser.id : localId;

  logAuditAction({
    userId: finalId,
    userName: fullName,
    userRole: 'guest',
    action: 'REGISTRATION_SUBMITTED',
    entityType: 'users',
    entityId: finalId,
    details: `Подана заявка на регистрацию в Supabase: ${fullName} (${email || phone}). Статус: Ожидает одобрения.`,
    ipAddress: req.ip
  });

  res.json({
    success: true,
    message: 'Заявка на регистрацию успешно сохранена в Supabase! Доступ к CRM откроется сразу после подтверждения руководителем или владельцем центра.'
  });
});

// 3. Login
router.post('/login', async (req, res) => {
  const { login, password } = req.body;
  if (!login || !password) {
    return res.status(400).json({ error: 'Введите логин (email или телефон) и пароль' });
  }

  const cleanLogin = login.trim();
  let user = db.prepare('SELECT * FROM users WHERE email = ? OR phone = ?').get(cleanLogin, cleanLogin);

  // If not found in local cache or status is pending, verify directly with Supabase
  if (!user || user.status === 'pending') {
    try {
      const { data: suUser } = await db.supabase
        .from('users')
        .select('*')
        .or(`email.eq.${cleanLogin},phone.eq.${cleanLogin}`)
        .maybeSingle();

      if (suUser) {
        user = suUser;
        // Mirror to local SQLite
        try {
          db.prepare(`
            INSERT OR REPLACE INTO users (
              id, name, first_name, last_name, middle_name, email, phone, 
              password_hash, role, status, specialist_id, branch, avatar_url, bio, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            user.id, user.name, user.first_name, user.last_name, user.middle_name,
            user.email, user.phone, user.password_hash, user.role, user.status,
            user.specialist_id, user.branch, user.avatar_url, user.bio, user.created_at
          );
        } catch (e) {}
      }
    } catch (err) {
      console.warn('[Supabase live user check warn]:', err.message);
    }
  }

  if (!user) {
    return res.status(401).json({ error: 'Неверный логин или пароль' });
  }

  const validPassword = bcrypt.compareSync(password, user.password_hash);
  if (!validPassword) {
    return res.status(401).json({ error: 'Неверный логин или пароль' });
  }

  if (user.status === 'pending') {
    return res.status(403).json({
      error: 'Ваш аккаунт ожидает подтверждения руководителем центра. Пожалуйста, обратитесь к руководству для активации.'
    });
  }

  if (user.status === 'blocked') {
    return res.status(403).json({ error: 'Ваш аккаунт заблокирован администрацией центра.' });
  }

  const token = generateToken(user);

  logAuditAction({
    userId: user.id,
    userName: user.name,
    userRole: user.role,
    action: 'USER_LOGIN',
    entityType: 'users',
    entityId: user.id,
    details: 'Успешный вход в систему',
    ipAddress: req.ip
  });

  res.json({
    success: true,
    token,
    user: {
      id: user.id,
      name: user.name,
      first_name: user.first_name,
      last_name: user.last_name,
      middle_name: user.middle_name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      specialist_id: user.specialist_id,
      branch: user.branch || 'Астана — Центр',
      avatar_url: user.avatar_url,
      bio: user.bio,
      created_at: user.created_at
    }
  });
});


// 4. Password Recovery
router.post('/reset-password', (req, res) => {
  const { login, code, new_password } = req.body;
  if (!login || !new_password) {
    return res.status(400).json({ error: 'Укажите контакт и новый пароль' });
  }

  if (code && code !== '1234') {
    return res.status(400).json({ error: 'Неверный код подтверждения (для теста используйте 1234)' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ? OR phone = ?').get(login.trim(), login.trim());
  if (!user) {
    return res.status(404).json({ error: 'Пользователь с таким контактом не найден' });
  }

  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync(new_password, salt);

  db.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(passwordHash, user.id);

  logAuditAction({
    userId: user.id,
    userName: user.name,
    userRole: user.role,
    action: 'PASSWORD_RESET',
    entityType: 'users',
    entityId: user.id,
    details: 'Восстановление пароля по коду подтверждения',
    ipAddress: req.ip
  });

  res.json({ success: true, message: 'Пароль успешно изменён. Теперь вы можете войти в систему.' });
});

// 5. Current user info
router.get('/me', authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

// 6. User Profile Management (Available to ALL roles: Owner, Director, Admin, Specialist)
router.get('/profile', authMiddleware, (req, res) => {
  const user = req.user;
  let specialistData = null;

  if (user.specialist_id) {
    specialistData = db.prepare('SELECT * FROM specialists WHERE id = ?').get(user.specialist_id);
    if (specialistData) {
      try {
        specialistData.workDays = JSON.parse(specialistData.work_days || '[]');
        specialistData.directionsList = JSON.parse(specialistData.directions || '[]');
      } catch (e) {
        specialistData.workDays = [];
        specialistData.directionsList = [];
      }
    }
  }

  res.json({ user, specialist: specialistData });
});

router.put('/profile', authMiddleware, (req, res) => {
  const userId = req.user.id;
  const {
    first_name,
    last_name,
    middle_name,
    phone,
    email,
    avatar_url,
    bio,
    current_password,
    new_password,
    verification_code
  } = req.body;

  const userInDb = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!userInDb) {
    return res.status(404).json({ error: 'Пользователь не найден' });
  }

  // Check unique email/phone if changed
  if (email && email !== userInDb.email) {
    const existing = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email, userId);
    if (existing) {
      return res.status(400).json({ error: 'Этот email уже используется другим сотрудником' });
    }
    if (verification_code && verification_code !== '1234') {
      return res.status(400).json({ error: 'Неверный код подтверждения смены email (код: 1234)' });
    }
  }

  if (phone && phone !== userInDb.phone) {
    const existing = db.prepare('SELECT id FROM users WHERE phone = ? AND id != ?').get(phone, userId);
    if (existing) {
      return res.status(400).json({ error: 'Этот номер телефона уже используется другим сотрудником' });
    }
    if (verification_code && verification_code !== '1234') {
      return res.status(400).json({ error: 'Неверный код подтверждения смены телефона (код: 1234)' });
    }
  }

  // Password change validation
  let newPasswordHash = userInDb.password_hash;
  if (new_password) {
    if (!current_password) {
      return res.status(400).json({ error: 'Для смены пароля необходимо ввести текущий пароль' });
    }
    const isCurrentValid = bcrypt.compareSync(current_password, userInDb.password_hash);
    if (!isCurrentValid) {
      return res.status(400).json({ error: 'Текущий пароль указан неверно' });
    }
    const salt = bcrypt.genSaltSync(10);
    newPasswordHash = bcrypt.hashSync(new_password, salt);
  }

  const fName = first_name !== undefined ? (first_name || '').trim() : (userInDb.first_name || '');
  const lName = last_name !== undefined ? (last_name || '').trim() : (userInDb.last_name || '');
  const mName = middle_name !== undefined ? (middle_name || '').trim() : userInDb.middle_name;
  const fullName = `${fName} ${lName}`.trim() || userInDb.name;

  db.prepare(`
    UPDATE users SET
      name = ?,
      first_name = ?,
      last_name = ?,
      middle_name = ?,
      phone = COALESCE(?, phone),
      email = COALESCE(?, email),
      avatar_url = COALESCE(?, avatar_url),
      bio = COALESCE(?, bio),
      password_hash = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    fullName,
    fName,
    lName,
    mName || null,
    phone || null,
    email || null,
    avatar_url || null,
    bio || null,
    newPasswordHash,
    userId
  );

  // If user is linked to a specialist, synchronize specialist details so schedules & rosters stay consistent!
  if (userInDb.specialist_id) {
    db.prepare(`
      UPDATE specialists SET
        full_name = ?,
        first_name = ?,
        last_name = ?,
        middle_name = ?,
        phone = COALESCE(?, phone),
        email = COALESCE(?, email),
        avatar_url = COALESCE(?, avatar_url)
      WHERE id = ?
    `).run(
      fullName,
      fName,
      lName,
      mName || null,
      phone || null,
      email || null,
      avatar_url || null,
      userInDb.specialist_id
    );
  }

  const updatedUser = db.prepare(`
    SELECT id, name, first_name, last_name, middle_name, email, phone, role, status, 
           specialist_id, branch, avatar_url, bio, created_at
    FROM users 
    WHERE id = ?
  `).get(userId);

  const newToken = generateToken(updatedUser);

  logAuditAction({
    userId,
    userName: fullName,
    userRole: updatedUser.role,
    action: 'PROFILE_UPDATED',
    entityType: 'users',
    entityId: userId,
    details: `Пользователь обновил личные данные профиля (ФИО: ${fullName})`,
    ipAddress: req.ip
  });

  res.json({
    success: true,
    message: 'Личные данные профиля успешно сохранены',
    token: newToken,
    user: updatedUser
  });
});

// 7. Quick Role Switcher for paired testing of all 4 roles
router.post('/switch-role', (req, res) => {
  const { role } = req.body;
  if (!['owner', 'director', 'admin', 'specialist'].includes(role)) {
    return res.status(400).json({ error: 'Недопустимая роль' });
  }

  const user = db.prepare("SELECT * FROM users WHERE role = ? AND status = 'active' LIMIT 1").get(role);
  if (!user) {
    return res.status(404).json({ error: `Тестовый пользователь с ролью ${role} не найден` });
  }

  const token = generateToken(user);
  res.json({
    success: true,
    token,
    user: {
      id: user.id,
      name: user.name,
      first_name: user.first_name,
      last_name: user.last_name,
      middle_name: user.middle_name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      specialist_id: user.specialist_id,
      branch: user.branch || 'Астана — Центр',
      avatar_url: user.avatar_url,
      bio: user.bio,
      created_at: user.created_at
    }
  });
});

module.exports = router;
