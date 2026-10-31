const express = require('express');
const router = express.Router();
const db = require('../db');
const { authMiddleware, logAuditAction } = require('../auth');
const { recordAttendanceAndFinance } = require('../services/accountingEngine');

router.use(authMiddleware);

// Get attendance history
router.get('/', (req, res) => {
  const { date, childId, specialistId } = req.query;
  const user = req.user;

  let query = `
    SELECT 
      a.*,
      c.full_name as child_name,
      c.has_asthma, c.has_epilepsy, c.has_allergy, c.chronic_diseases,
      s.full_name as specialist_name,
      sc.start_time, sc.end_time, sc.direction, sc.price
    FROM attendance a
    JOIN children c ON a.child_id = c.id
    JOIN specialists s ON a.specialist_id = s.id
    LEFT JOIN schedule_sessions sc ON a.session_id = sc.id
    WHERE 1=1
  `;
  const params = [];

  if (user.role === 'specialist') {
    if (!user.specialist_id) return res.json({ records: [] });
    query += ' AND a.specialist_id = ?';
    params.push(user.specialist_id);
  } else if (specialistId && specialistId !== 'all') {
    query += ' AND a.specialist_id = ?';
    params.push(specialistId);
  }

  if (date) {
    query += ' AND a.date = ?';
    params.push(date);
  }
  if (childId) {
    query += ' AND a.child_id = ?';
    params.push(childId);
  }

  query += ' ORDER BY a.date DESC, a.created_at DESC';

  const records = db.prepare(query).all(...params);
  res.json({ records });
});

// Mark attendance
router.post('/mark', (req, res) => {
  const { sessionId, status, notes, isBillableOverride } = req.body;

  if (!sessionId || !status) {
    return res.status(400).json({ error: 'Укажите ID занятия и статус посещения' });
  }

  const validStatuses = ['present', 'absent', 'cancelled_center', 'cancelled_parent', 'rescheduled'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Некорректный статус посещаемости' });
  }

  // Permission check for specialists
  if (req.user.role === 'specialist') {
    const session = db.prepare('SELECT specialist_id FROM schedule_sessions WHERE id = ?').get(sessionId);
    if (!session || session.specialist_id !== req.user.specialist_id) {
      return res.status(403).json({ error: 'Вы можете отмечать посещаемость только для своих занятий' });
    }
  }

  // Determine if billable
  let isBillable = false;
  if (isBillableOverride !== undefined) {
    isBillable = !!isBillableOverride;
  } else {
    // Default rules:
    // present -> billable (100%)
    // absent -> billable by default unless excused (as per center rules)
    // cancelled_center -> NOT billable
    // cancelled_parent -> NOT billable
    // rescheduled -> NOT billable
    if (status === 'present') {
      isBillable = true;
    } else if (status === 'absent') {
      // Check center setting
      const setting = db.prepare("SELECT value FROM system_settings WHERE key = 'unexcused_absence_billable'").get();
      isBillable = setting ? setting.value === '1' : true;
    } else {
      isBillable = false;
    }
  }

  try {
    const result = recordAttendanceAndFinance({
      sessionId,
      status,
      isBillable,
      notes,
      userId: req.user.id
    });

    logAuditAction({
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'ATTENDANCE_MARKED',
      entityType: 'attendance',
      entityId: result.attendanceId,
      details: `Отмечена посещаемость для сессии ${sessionId}: ${status} (Оплачиваемое: ${isBillable ? 'Да' : 'Нет'})`,
      ipAddress: req.ip
    });

    res.json({
      success: true,
      attendanceId: result.attendanceId,
      status,
      isBillable,
      message: 'Посещаемость зафиксирована, бухгалтерские данные обновлены'
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Ошибка сохранения посещаемости' });
  }
});

module.exports = router;
