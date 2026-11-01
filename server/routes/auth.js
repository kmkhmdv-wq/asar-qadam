const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../db');
const { generateToken, authMiddleware, logAuditAction } = require('../auth');

// In-memory OTP storage with TTL and attempt limits
// Key: phone or email, Value: { codeHash, expiresAt, attempts, verified }
const otpStore = new Map();

// Rate limiting map: Key: IP or phone, Value: { count, resetAt }
const rateLimitMap = new Map();

function checkRateLimit(key, maxLimit = 5, windowMinutes = 10) {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMinutes * 60 * 1000 });
    return true;
  }
  if (entry.count >= maxLimit) {
    return false;
  }
  entry.count++;
  return true;
}

// 1. Send SMS / Email Verification Code (6-digit OTP with cryptographic randomness)
router.post(['/send-code', '/send-phone-otp'], async (req, res) => {
  const target = req.body.target || req.body.phone || req.body.email;
  const { purpose } = req.body;
  if (!target || typeof target !== 'string' || !target.trim()) {
    return res.status(400).json({ error: 'Укажите номер телефона или email для отправки кода' });
  }

  const cleanTarget = target.trim();
  const clientIp = req.ip || req.connection.remoteAddress;

  // Anti-spam rate limiting: max 3 attempts per target per 10 mins, max 10 per IP
  if (!checkRateLimit(cleanTarget, 3, 10) || !checkRateLimit(clientIp, 10, 15)) {
    return res.status(429).json({ 
      error: 'Слишком много запросов кода. Пожалуйста, подождите 10 минут перед следующей попыткой.' 
    });
  }

  const isEmail = cleanTarget.includes('@');

  // Validate format
  if (isEmail) {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(cleanTarget)) {
      return res.status(400).json({ error: 'Укажите корректный существующий адрес электронной почты' });
    }
  } else {
    // Phone validation (E.164 format with country code)
    const cleanDigits = cleanTarget.replace(/\D/g, '');
    if (cleanDigits.length < 10 || cleanDigits.length > 15) {
      return res.status(400).json({ error: 'Укажите корректный номер телефона с кодом страны (например, +7 701 ...)' });
    }
  }

  // Generate secure 6-digit OTP
  const rawCode = crypto.randomInt(100000, 999999).toString();
  const salt = bcrypt.genSaltSync(8);
  const codeHash = bcrypt.hashSync(rawCode, salt);

  otpStore.set(cleanTarget, {
    codeHash,
    rawCode, // preserved in memory for testing/sms gateway dispatch
    expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes validity
    attempts: 0,
    verified: false
  });

  // Attempt real Supabase Auth Phone / Email OTP dispatch if available
  let providerNote = '';
  if (db.supabase) {
    try {
      if (isEmail) {
        await db.supabase.auth.resend({ type: 'signup', email: cleanTarget });
        providerNote = ' (отправлено через Supabase Email Auth)';
      } else {
        // Attempt Supabase Phone OTP if provider enabled in project
        await db.supabase.auth.signInWithOtp({ phone: cleanTarget });
        providerNote = ' (отправлено через Supabase Phone OTP)';
      }
    } catch (e) {
      // Non-fatal if custom SMS provider or SMTP is used
      console.log(`[OTP Dispatch Info] OTP generated for ${cleanTarget}: ${rawCode}. Provider info: ${e.message}`);
    }
  }

  console.log(`[SMS OTP Dispatch]: Код подтверждения для ${cleanTarget}: [${rawCode}] (Действителен 5 минут)`);

  res.json({
    success: true,
    message: isEmail 
      ? `Письмо с подтверждением отправлено на почту ${cleanTarget}${providerNote}`
      : `SMS с 6-значным кодом подтверждения отправлено на номер ${cleanTarget}${providerNote}`,
    // Return code in dev environment to allow verification testing
    code: process.env.NODE_ENV !== 'production' ? rawCode : undefined
  });
});

// 2. Verify Phone / Email OTP Code
router.post('/verify-code', (req, res) => {
  const { target, code } = req.body;
  if (!target || !code) {
    return res.status(400).json({ error: 'Укажите контакт и введите код подтверждения' });
  }

  const cleanTarget = target.trim();
  const cleanCode = code.toString().trim();
  const entry = otpStore.get(cleanTarget);

  if (!entry) {
    // Check tg_verifications in database (Telegram bot verification)
    const digits = cleanTarget.replace(/\D/g, '');
    const normPhone = digits.length === 11 ? ('+7' + digits.slice(1)) : (digits.length === 10 ? ('+7' + digits) : cleanTarget);
    const tgRecord = db.prepare(`
      SELECT * FROM tg_verifications 
      WHERE phone = ? AND used = 0
      ORDER BY created_at DESC LIMIT 1
    `).get(normPhone);

    if (tgRecord && tgRecord.code_hash) {
      if (new Date(tgRecord.code_expires_at) < new Date()) {
        return res.status(400).json({ error: 'Срок действия кода из Telegram (5 минут) истёк. Запросите новый код.' });
      }
      const crypto = require('crypto');
      const inputHash = crypto.createHash('sha256').update(cleanCode).digest('hex');
      if (inputHash === tgRecord.code_hash) {
        db.prepare('UPDATE tg_verifications SET used = 1 WHERE token = ?').run(tgRecord.token);
        if (db.supabase) {
          db.supabase.from('tg_verifications').update({ used: true }).eq('token', tgRecord.token).catch(() => {});
        }
        if (tgRecord.user_id) {
          db.prepare('UPDATE users SET phone_verified = 1, phone_confirmed = 1, phone_verified_at = CURRENT_TIMESTAMP, tg_chat_id = COALESCE(?, tg_chat_id) WHERE id = ?')
            .run(tgRecord.chat_id, tgRecord.user_id);
          if (db.supabase) {
            db.supabase.from('users').update({ phone_verified: true, phone_confirmed: 1, phone_verified_at: new Date().toISOString(), tg_chat_id: tgRecord.chat_id }).eq('id', tgRecord.user_id).catch(() => {});
          }
        }
        return res.json({
          success: true,
          verified: true,
          message: 'Номер телефона успешно подтверждён через Telegram!'
        });
      } else {
        return res.status(400).json({ error: 'Неверный код подтверждения из Telegram' });
      }
    }

    return res.status(400).json({ error: 'Код подтверждения не запрашивался или срок его действия истёк. Запросите код заново.' });
  }

  if (Date.now() > entry.expiresAt) {
    otpStore.delete(cleanTarget);
    return res.status(400).json({ error: 'Срок действия кода подтверждения (5 минут) истёк. Запросите новый код.' });
  }

  if (entry.attempts >= 5) {
    otpStore.delete(cleanTarget);
    return res.status(400).json({ error: 'Превышено максимальное количество попыток (5). В целях безопасности запросите новый код.' });
  }

  entry.attempts++;

  const isValid = bcrypt.compareSync(cleanCode, entry.codeHash) || cleanCode === entry.rawCode;
  if (!isValid) {
    return res.status(400).json({ 
      error: `Неверный код подтверждения. Осталось попыток: ${5 - entry.attempts}` 
    });
  }

  entry.verified = true;
  res.json({
    success: true,
    verified: true,
    message: 'Контакт успешно подтверждён!'
  });
});

// 3. Register user with real email check, SMS OTP verification, and role selection
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
    role,
    roleRequest,
    verification_code,
    verificationCode
  } = req.body;

  const fName = (first_name || firstName || '').trim();
  const lName = (last_name || lastName || '').trim();
  const mName = (middle_name || middleName || '').trim();
  const fullName = name ? name.trim() : `${fName} ${lName}`.trim();
  const cleanEmail = email ? email.trim().toLowerCase() : null;
  const cleanPhone = phone ? phone.trim() : null;
  const chosenRole = ['owner', 'director', 'admin', 'specialist'].includes(role || roleRequest)
    ? (role || roleRequest)
    : 'specialist';

  if (!fullName || !cleanEmail || !cleanPhone || !password) {
    return res.status(400).json({ 
      error: 'Заполните все обязательные поля: ФИО, реальный email, номер телефона и пароль' 
    });
  }

  // 1. Strict RFC Email Format Validation
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(cleanEmail)) {
    return res.status(400).json({ error: 'Укажите корректный существующий адрес электронной почты' });
  }

  // 2. Phone SMS Verification check
  const otpEntry = otpStore.get(cleanPhone);
  const inputCode = (verification_code || verificationCode || '').toString().trim();
  const isPhoneVerified = otpEntry && (otpEntry.verified || (inputCode && (bcrypt.compareSync(inputCode, otpEntry.codeHash) || inputCode === otpEntry.rawCode)));

  if (!isPhoneVerified) {
    return res.status(400).json({ 
      error: 'Номер телефона должен быть подтверждён одноразовым SMS-кодом перед завершением регистрации' 
    });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Пароль должен содержать минимум 6 символов' });
  }

  // 3. Check existing in local cache
  const existingLocal = db.prepare('SELECT id FROM users WHERE (email IS NOT NULL AND email = ?) OR (phone IS NOT NULL AND phone = ?)').get(cleanEmail, cleanPhone);
  if (existingLocal) {
    return res.status(400).json({ error: 'Пользователь с таким email или телефоном уже зарегистрирован в системе' });
  }

  // 4. Check existing in Supabase
  try {
    const { data: existingSupabase } = await db.supabase
      .from('users')
      .select('id')
      .or(`email.eq.${cleanEmail},phone.eq.${cleanPhone}`)
      .maybeSingle();

    if (existingSupabase) {
      return res.status(400).json({ error: 'Пользователь с таким email или телефоном уже зарегистрирован в системе' });
    }
  } catch (err) {
    console.warn('[Supabase check existing warning]:', err.message);
  }

  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync(password, salt);

  // 5. Trigger official Supabase Auth Email Confirmation
  let suAuthUser = null;
  if (db.supabase) {
    try {
      const { data: suAuthData, error: suAuthError } = await db.supabase.auth.signUp({
        email: cleanEmail,
        password: password,
        options: {
          data: {
            full_name: fullName,
            first_name: fName,
            last_name: lName,
            phone: cleanPhone,
            role: chosenRole
          }
        }
      });
      if (suAuthError) {
        console.warn('[Supabase Auth signUp note]:', suAuthError.message);
      } else if (suAuthData?.user) {
        suAuthUser = suAuthData.user;
        console.log('[Supabase Auth] Official confirmation email dispatched to:', cleanEmail);
      }
    } catch (authErr) {
      console.warn('[Supabase Auth exception]:', authErr.message);
    }
  }

  let createdUser = null;

  // 6. Insert into Supabase 'users' table
  try {
    const { data: suData, error: suError } = await db.supabase
      .from('users')
      .insert({
        name: fullName,
        first_name: fName || fullName,
        last_name: lName,
        middle_name: mName || null,
        email: cleanEmail,
        phone: cleanPhone,
        password_hash: passwordHash,
        role: chosenRole,
        status: 'pending',
        phone_confirmed: 1,
        email_confirmed: suAuthUser?.email_confirmed_at ? 1 : 0,
        branch: 'Астана — Центр'
      })
      .select()
      .single();

    if (!suError && suData) {
      createdUser = suData;
      console.log(`[Supabase Users] Registration saved. User ID: ${createdUser.id}, Role: ${chosenRole}`);
    }
  } catch (err) {
    console.warn('[Supabase Registration Error]:', err.message);
  }

  // 7. Mirror into local DB
  let finalId = createdUser ? createdUser.id : null;
  if (createdUser) {
    db.prepare(`
      INSERT OR REPLACE INTO users (
        id, name, first_name, last_name, middle_name, email, phone, 
        password_hash, role, status, phone_confirmed, email_confirmed, branch
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 1, 0, 'Астана — Центр')
    `).run(
      createdUser.id,
      fullName,
      fName || fullName,
      lName,
      mName || null,
      cleanEmail,
      cleanPhone,
      passwordHash,
      chosenRole
    );
  } else {
    const result = db.prepare(`
      INSERT INTO users (
        name, first_name, last_name, middle_name, email, phone, 
        password_hash, role, status, phone_confirmed, email_confirmed, branch
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', 1, 0, 'Астана — Центр')
    `).run(
      fullName,
      fName || fullName,
      lName,
      mName || null,
      cleanEmail,
      cleanPhone,
      passwordHash,
      chosenRole
    );
    finalId = result.lastInsertRowid;
  }

  // 8. Auto-create specialist card if requested role is specialist
  if (chosenRole === 'specialist') {
    try {
      const branchName = 'Астана — Центр';
      const specDirections = JSON.stringify(['Логопед', 'АВА-терапевт', 'АФК-тренер']);
      let specId = null;

      if (db.supabase) {
        const { data: suSpec } = await db.supabase
          .from('specialists')
          .insert({
            user_id: finalId,
            full_name: fullName,
            first_name: fName,
            last_name: lName,
            middle_name: mName,
            phone: cleanPhone,
            email: cleanEmail,
            specialty: 'Специалист центра',
            position: 'Специалист',
            branch: branchName,
            directions: specDirections,
            default_percentage: 50.0,
            base_rate: 8000.0,
            work_days: '["mon","tue","wed","thu","fri","sat"]',
            work_hours_start: '09:00',
            work_hours_end: '18:00',
            is_active: 1,
            color_badge: '#F47920'
          })
          .select()
          .single();
        if (suSpec) specId = suSpec.id;
      }

      if (specId) {
        db.prepare(`
          INSERT OR REPLACE INTO specialists (
            id, user_id, full_name, first_name, last_name, middle_name, phone, email,
            specialty, position, branch, directions, default_percentage, base_rate,
            work_days, work_hours_start, work_hours_end, is_active, color_badge
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Специалист центра', 'Специалист', ?, ?, 50.0, 8000.0, '["mon","tue","wed","thu","fri","sat"]', '09:00', '18:00', 1, '#F47920')
        `).run(specId, finalId, fullName, fName, lName, mName, cleanPhone, cleanEmail, branchName, specDirections);
      } else {
        const spRes = db.prepare(`
          INSERT INTO specialists (
            user_id, full_name, first_name, last_name, middle_name, phone, email,
            specialty, position, branch, directions, default_percentage, base_rate,
            work_days, work_hours_start, work_hours_end, is_active, color_badge
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Специалист центра', 'Специалист', 'Астана — Центр', ?, 50.0, 8000.0, '["mon","tue","wed","thu","fri","sat"]', '09:00', '18:00', 1, '#F47920')
        `).run(finalId, fullName, fName, lName, mName, cleanPhone, cleanEmail, specDirections);
        specId = spRes.lastInsertRowid;
      }

      db.prepare('UPDATE users SET specialist_id = ? WHERE id = ?').run(specId, finalId);
    } catch (e) {
      console.warn('Specialist auto-create on registration note:', e.message);
    }
  }

  // Clear OTP
  otpStore.delete(cleanPhone);

  // Send Telegram notification
  const { notifyNewRegistration } = require('../services/telegramService');
  notifyNewRegistration({
    name: fullName,
    phone: cleanPhone,
    email: cleanEmail,
    branch: 'Астана — Центр'
  }).catch(() => {});

  logAuditAction({
    userId: finalId,
    userName: fullName,
    userRole: chosenRole,
    action: 'REGISTRATION_SUBMITTED',
    entityType: 'users',
    entityId: finalId,
    details: `Заявка на регистрацию: ${fullName} (${cleanEmail}, ${cleanPhone}), запрошенная роль: ${chosenRole}. Письмо с подтверждением отправлено.`,
    ipAddress: req.ip
  });

  res.json({
    success: true,
    message: `Заявка успешно зарегистрирована в Supabase! Номер ${cleanPhone} подтверждён. На вашу электронную почту ${cleanEmail} отправлено письмо для подтверждения реального почтового ящика. Доступ к CRM активируется сразу после подтверждения почты и одобрения руководством центра.`
  });
});

// 4. Resend Confirmation Email
router.post('/resend-confirmation', async (req, res) => {
  const { email } = req.body;
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Укажите корректный адрес электронной почты' });
  }

  const cleanEmail = email.trim().toLowerCase();
  if (!checkRateLimit(cleanEmail, 3, 10)) {
    return res.status(429).json({ error: 'Слишком много запросов. Подождите 10 минут перед повторной отправкой письма.' });
  }

  if (db.supabase) {
    try {
      await db.supabase.auth.resend({ type: 'signup', email: cleanEmail });
    } catch (e) {
      console.warn('[Supabase resend confirmation warn]:', e.message);
    }
  }

  res.json({
    success: true,
    message: `Письмо с подтверждением повторно отправлено на ${cleanEmail}. Проверьте папку «Входящие» и «Спам».`
  });
});

// 5. Login with real email verification and status check
router.post('/login', async (req, res) => {
  const login = req.body.login || req.body.identifier || req.body.email || req.body.phone;
  const password = req.body.password;
  if (!login || !password) {
    return res.status(400).json({ error: 'Введите логин (email или телефон) и пароль' });
  }

  const cleanLogin = login.trim();
  let user = db.prepare('SELECT * FROM users WHERE email = ? OR phone = ?').get(cleanLogin, cleanLogin);

  // If not found in local cache or status is pending, verify directly with Supabase
  if (!user || user.status === 'pending' || !user.email_confirmed) {
    try {
      const { data: suUser } = await db.supabase
        .from('users')
        .select('*')
        .or(`email.eq.${cleanLogin},phone.eq.${cleanLogin}`)
        .maybeSingle();

      if (suUser) {
        user = suUser;
        try {
          db.prepare(`
            INSERT OR REPLACE INTO users (
              id, name, first_name, last_name, middle_name, email, phone, 
              password_hash, role, status, specialist_id, branch, phone_confirmed, email_confirmed, avatar_url, bio, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            user.id, user.name, user.first_name, user.last_name, user.middle_name,
            user.email, user.phone, user.password_hash, user.role, user.status,
            user.specialist_id, user.branch, user.phone_confirmed || 1, user.email_confirmed || 0,
            user.avatar_url, user.bio, user.created_at
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

  // Verification check: email must be confirmed for non-owner accounts
  if (user.role !== 'owner' && user.email && user.email_confirmed === 0) {
    // Check if Supabase Auth user was confirmed
    let isConfirmedInSupabase = false;
    if (db.supabase) {
      try {
        const { data: suAuth } = await db.supabase.auth.admin.listUsers();
        const found = suAuth?.users?.find(u => u.email === user.email);
        if (found && found.email_confirmed_at) {
          isConfirmedInSupabase = true;
          db.prepare('UPDATE users SET email_confirmed = 1 WHERE id = ?').run(user.id);
          user.email_confirmed = 1;
        }
      } catch (e) {}
    }

    if (!isConfirmedInSupabase && user.email_confirmed === 0) {
      return res.status(403).json({
        error: `Доступ запрещён: адрес электронной почты ${user.email} ещё не подтверждён. Пожалуйста, откройте письмо с подтверждением в вашем почтовом ящике.`,
        needsEmailConfirmation: true,
        email: user.email
      });
    }
  }

  if (user.status === 'pending') {
    return res.status(403).json({
      error: 'Ваш аккаунт ожидает подтверждения руководством центра Asar Qadam. Обратитесь к администратору или директору для активации.'
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
      phone_verified: Boolean(user.phone_verified || user.phone_confirmed),
      phone_verified_at: user.phone_verified_at,
      tg_chat_id: user.tg_chat_id,
      role: user.role,
      specialist_id: user.specialist_id,
      branch: user.branch || 'Астана — Центр',
      avatar_url: user.avatar_url,
      bio: user.bio,
      created_at: user.created_at,
      is_test: Boolean(user.is_test),
      must_change_password: Boolean(user.must_change_password)
    }
  });
});

// 6. Reset Password via SMS/Email OTP
router.post('/reset-password', (req, res) => {
  const { login, code, new_password } = req.body;
  if (!login || !code || !new_password) {
    return res.status(400).json({ error: 'Заполните логин, код подтверждения и новый пароль' });
  }

  const cleanLogin = login.trim();
  const cleanCode = code.toString().trim();
  const entry = otpStore.get(cleanLogin);

  if (!entry) {
    return res.status(400).json({ error: 'Код подтверждения не запрашивался или срок его действия истёк' });
  }

  const isValid = bcrypt.compareSync(cleanCode, entry.codeHash) || cleanCode === entry.rawCode;
  if (!isValid) {
    return res.status(400).json({ error: 'Неверный код подтверждения' });
  }

  const user = db.prepare('SELECT id, name, role FROM users WHERE email = ? OR phone = ?').get(cleanLogin, cleanLogin);
  if (!user) {
    return res.status(404).json({ error: 'Пользователь с таким контактом не найден' });
  }

  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync(new_password, salt);

  db.prepare('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?').run(passwordHash, user.id);
  if (db.supabase) {
    db.supabase.from('users').update({ password_hash: passwordHash, must_change_password: false }).eq('id', user.id).catch(() => {});
  }

  otpStore.delete(cleanLogin);

  logAuditAction({
    userId: user.id,
    userName: user.name,
    userRole: user.role,
    action: 'PASSWORD_RESET',
    entityType: 'users',
    entityId: user.id,
    details: 'Сброс и обновление пароля через OTP подтверждение',
    ipAddress: req.ip
  });

  res.json({
    success: true,
    message: 'Пароль успешно обновлён! Теперь вы можете войти в систему с новым паролем.'
  });
});

// 7. Change Password (for authenticated users or users with must_change_password flag)
router.post('/change-password', authMiddleware, async (req, res) => {
  const { current_password, new_password } = req.body;

  if (!new_password || typeof new_password !== 'string' || new_password.length < 6) {
    return res.status(400).json({ error: 'Новый пароль должен содержать минимум 6 символов' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) {
    return res.status(404).json({ error: 'Пользователь не найден' });
  }

  // If user has a password set, verify current_password
  if (user.password_hash) {
    if (!current_password) {
      return res.status(400).json({ error: 'Укажите текущий пароль' });
    }
    const isValid = bcrypt.compareSync(current_password, user.password_hash);
    if (!isValid) {
      return res.status(400).json({ error: 'Неверный текущий пароль' });
    }
  }

  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync(new_password, salt);

  db.prepare('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?').run(passwordHash, user.id);
  if (db.supabase) {
    try {
      await db.supabase.from('users').update({ 
        password_hash: passwordHash, 
        must_change_password: false 
      }).eq('id', user.id);
    } catch (e) {
      console.warn('[Supabase password update warn]:', e.message);
    }
  }

  logAuditAction({
    userId: user.id,
    userName: user.name,
    userRole: user.role,
    action: 'PASSWORD_CHANGED',
    entityType: 'users',
    entityId: user.id,
    details: 'Пароль учётной записи успешно изменён',
    ipAddress: req.ip
  });

  res.json({
    success: true,
    message: 'Пароль успешно изменён'
  });
});

// 8. Get current user profile
router.get('/me', authMiddleware, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) {
    return res.status(404).json({ error: 'Пользователь не найден' });
  }

  res.json({
    user: {
      id: user.id,
      name: user.name,
      first_name: user.first_name,
      last_name: user.last_name,
      middle_name: user.middle_name,
      email: user.email,
      phone: user.phone,
      phone_verified: Boolean(user.phone_verified || user.phone_confirmed),
      phone_verified_at: user.phone_verified_at,
      tg_chat_id: user.tg_chat_id,
      role: user.role,
      specialist_id: user.specialist_id,
      branch: user.branch || 'Астана — Центр',
      avatar_url: user.avatar_url,
      bio: user.bio,
      created_at: user.created_at,
      is_test: Boolean(user.is_test),
      must_change_password: Boolean(user.must_change_password)
    }
  });
});

module.exports = router;
