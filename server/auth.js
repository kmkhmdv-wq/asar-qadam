const jwt = require('jsonwebtoken');
const db = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'asar_qadam_super_secret_jwt_key_2026';

function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      phone: user.phone,
      name: user.name,
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role,
      specialist_id: user.specialist_id,
      branch: user.branch || 'Астана — Центр'
    },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  let token = (authHeader && authHeader.startsWith('Bearer ')) ? authHeader.split(' ')[1] : null;

  if (!token || token === 'null' || token === 'undefined') {
    return res.status(401).json({ error: 'Необходима авторизация. Пожалуйста, выполните вход.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = db.prepare(`
      SELECT id, name, first_name, last_name, middle_name, email, phone, role, status, 
             specialist_id, branch, avatar_url, bio, created_at
      FROM users 
      WHERE id = ?
    `).get(decoded.id);

    if (!user) {
      return res.status(401).json({ error: 'Пользователь не найден' });
    }
    if (user.status === 'pending') {
      return res.status(403).json({ error: 'Ваш аккаунт ожидает подтверждения руководителем центра.' });
    }
    if (user.status === 'blocked') {
      return res.status(403).json({ error: 'Ваш аккаунт заблокирован.' });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Неверный или просроченный токен авторизации' });
  }
}

function requireRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Необходима авторизация' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: `Доступ запрещён для роли «${req.user.role}». Требуется: ${allowedRoles.join(', ')}` 
      });
    }
    next();
  };
}

function logAuditAction({ userId, userName, userRole, action, entityType, entityId, details, ipAddress }) {
  try {
    db.prepare(`
      INSERT INTO audit_logs (user_id, user_name, user_role, action, entity_type, entity_id, details, ip_address)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      userId || null,
      userName || 'Система',
      userRole || 'system',
      action,
      entityType,
      entityId || null,
      typeof details === 'object' ? JSON.stringify(details) : (details || ''),
      ipAddress || '127.0.0.1'
    );
  } catch (err) {
    console.error('Audit log error:', err);
  }
}

module.exports = {
  generateToken,
  authMiddleware,
  requireRoles,
  logAuditAction
};
