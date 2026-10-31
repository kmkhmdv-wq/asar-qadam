const express = require('express');
const router = express.Router();
const db = require('../db');
const { authMiddleware, requireRoles } = require('../auth');

router.use(authMiddleware);
router.use(requireRoles('owner', 'director'));

// Get audit logs
router.get('/', (req, res) => {
  const { limit = 100 } = req.query;

  const logs = db.prepare(`
    SELECT * FROM audit_logs 
    ORDER BY created_at DESC 
    LIMIT ?
  `).all(Number(limit));

  res.json({ logs });
});

module.exports = router;
