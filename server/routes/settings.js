const express = require('express');
const router = express.Router();
const db = require('../db');
const { authMiddleware, requireRoles, logAuditAction } = require('../auth');

router.use(authMiddleware);

// Get system settings
router.get('/', requireRoles('owner', 'director'), (req, res) => {
  const rows = db.prepare('SELECT key, value FROM system_settings').all();
  const settings = {};
  for (const r of rows) {
    settings[r.key] = r.value;
  }
  res.json({ settings });
});

// Update settings (Owner only)
router.post('/', requireRoles('owner'), (req, res) => {
  const { settings } = req.body;
  if (!settings || typeof settings !== 'object') {
    return res.status(400).json({ error: 'Неверный формат настроек' });
  }

  const upsert = db.prepare(`
    INSERT INTO system_settings (key, value, updated_at) 
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
  `);

  for (const [key, val] of Object.entries(settings)) {
    upsert.run(key, String(val));
  }

  logAuditAction({
    userId: req.user.id,
    userName: req.user.name,
    userRole: req.user.role,
    action: 'SETTINGS_UPDATED',
    entityType: 'system_settings',
    details: JSON.stringify(settings),
    ipAddress: req.ip
  });

  res.json({ success: true, message: 'Системные настройки успешно обновлены' });
});

module.exports = router;
