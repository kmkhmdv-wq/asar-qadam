const express = require('express');
const router = express.Router();
const db = require('../db');
const { authMiddleware, requireRoles, logAuditAction } = require('../auth');
const { checkScheduleConflict } = require('../services/conflictChecker');

router.use(authMiddleware);

// Helper to compute end_time
function calculateEndTime(startTime, durationMinutes = 45) {
  const [h, m] = startTime.split(':').map(Number);
  const totalMins = h * 60 + m + Number(durationMinutes);
  const endH = Math.floor(totalMins / 60);
  const endM = totalMins % 60;
  return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
}

// Get sessions
router.get('/', (req, res) => {
  const { startDate, endDate, specialistId } = req.query;
  const user = req.user;

  let query = `
    SELECT 
      s.*,
      c.full_name as child_name,
      c.parent_name,
      c.parent_phone,
      c.has_asthma,
      c.has_epilepsy,
      c.has_allergy,
      c.allergy_details,
      c.chronic_diseases,
      sp.full_name as specialist_name,
      sp.specialty as specialist_specialty,
      a.status as attendance_status,
      a.is_billable as attendance_billable
    FROM schedule_sessions s
    JOIN children c ON s.child_id = c.id
    JOIN specialists sp ON s.specialist_id = sp.id
    LEFT JOIN attendance a ON s.id = a.session_id
    WHERE 1=1
  `;
  const params = [];

  // Enforce specialist privacy: specialists can only see their own schedule
  if (user.role === 'specialist') {
    if (!user.specialist_id) {
      return res.json({ sessions: [] });
    }
    query += ' AND s.specialist_id = ?';
    params.push(user.specialist_id);
  } else if (specialistId && specialistId !== 'all') {
    query += ' AND s.specialist_id = ?';
    params.push(specialistId);
  }

  if (startDate) {
    query += ' AND s.date >= ?';
    params.push(startDate);
  }
  if (endDate) {
    query += ' AND s.date <= ?';
    params.push(endDate);
  }

  query += ' ORDER BY s.date ASC, s.start_time ASC';

  const rawSessions = db.prepare(query).all(...params);

  const sessions = rawSessions.map(s => ({
    ...s,
    hasMedicalAlert: !!(s.has_asthma || s.has_epilepsy || s.has_allergy || s.chronic_diseases)
  }));

  res.json({ sessions });
});

// Create session with STRICT conflict detection
router.post('/', requireRoles('owner', 'director', 'admin'), (req, res) => {
  const {
    child_id,
    specialist_id,
    direction,
    date,
    start_time,
    duration_minutes = 45,
    price,
    specialist_rate,
    comment
  } = req.body;

  if (!child_id || !specialist_id || !date || !start_time) {
    return res.status(400).json({ error: 'Заполните обязательные поля: ребёнок, специалист, дата и время начала' });
  }

  const calculatedEndTime = calculateEndTime(start_time, duration_minutes);

  // Server-side Double Booking & Conflict Check
  const conflict = checkScheduleConflict({
    specialistId: specialist_id,
    date,
    startTime: start_time,
    endTime: calculatedEndTime
  });

  if (conflict.hasConflict) {
    return res.status(409).json({
      error: conflict.error,
      conflictingSession: conflict.conflictingSession
    });
  }

  // Determine price and specialist rate if not explicitly supplied
  const child = db.prepare('SELECT custom_price, direction as default_direction, full_name FROM children WHERE id = ?').get(child_id);
  const specialist = db.prepare('SELECT default_percentage, base_rate, specialty, full_name FROM specialists WHERE id = ?').get(specialist_id);

  const sessionPrice = price || (child && child.custom_price) || (specialist && specialist.base_rate) || 8000;
  const sessionRate = specialist_rate || (specialist && specialist.default_percentage) || 50;
  const sessionDirection = direction || (child && child.default_direction) || (specialist && specialist.specialty) || 'Терапия';

  const result = db.prepare(`
    INSERT INTO schedule_sessions (
      child_id, specialist_id, direction, date, start_time, end_time,
      duration_minutes, price, specialist_rate, comment, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'scheduled')
  `).run(
    child_id,
    specialist_id,
    sessionDirection,
    date,
    start_time,
    calculatedEndTime,
    duration_minutes,
    sessionPrice,
    sessionRate,
    comment || null
  );

  logAuditAction({
    userId: req.user.id,
    userName: req.user.name,
    userRole: req.user.role,
    action: 'SESSION_CREATED',
    entityType: 'schedule_sessions',
    entityId: result.lastInsertRowid,
    details: `Запись ребёнка ${child ? child.full_name : child_id} к специалисту ${specialist ? specialist.full_name : specialist_id} на ${date} ${start_time}-${calculatedEndTime}`,
    ipAddress: req.ip
  });

  res.json({
    success: true,
    id: result.lastInsertRowid,
    endTime: calculatedEndTime,
    message: 'Занятие успешно добавлено в расписание'
  });
});

// Update session (e.g. drag & drop, reschedule) with conflict check
router.put('/:id', requireRoles('owner', 'director', 'admin'), (req, res) => {
  const sessionId = req.params.id;
  const {
    child_id,
    specialist_id,
    direction,
    date,
    start_time,
    duration_minutes,
    price,
    specialist_rate,
    comment,
    status
  } = req.body;

  const current = db.prepare('SELECT * FROM schedule_sessions WHERE id = ?').get(sessionId);
  if (!current) {
    return res.status(404).json({ error: 'Занятие не найдено' });
  }

  const newDate = date || current.date;
  const newStartTime = start_time || current.start_time;
  const newDuration = duration_minutes || current.duration_minutes;
  const newEndTime = (start_time || duration_minutes) ? calculateEndTime(newStartTime, newDuration) : current.end_time;
  const targetSpecialistId = specialist_id || current.specialist_id;

  // Conflict check if time/date/specialist changed
  if (date || start_time || duration_minutes || specialist_id) {
    const conflict = checkScheduleConflict({
      specialistId: targetSpecialistId,
      date: newDate,
      startTime: newStartTime,
      endTime: newEndTime,
      excludeSessionId: sessionId
    });

    if (conflict.hasConflict) {
      return res.status(409).json({
        error: conflict.error,
        conflictingSession: conflict.conflictingSession
      });
    }
  }

  db.prepare(`
    UPDATE schedule_sessions SET
      child_id = COALESCE(?, child_id),
      specialist_id = COALESCE(?, specialist_id),
      direction = COALESCE(?, direction),
      date = COALESCE(?, date),
      start_time = COALESCE(?, start_time),
      end_time = ?,
      duration_minutes = COALESCE(?, duration_minutes),
      price = COALESCE(?, price),
      specialist_rate = COALESCE(?, specialist_rate),
      comment = COALESCE(?, comment),
      status = COALESCE(?, status),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    child_id,
    specialist_id,
    direction,
    date,
    start_time,
    newEndTime,
    duration_minutes,
    price,
    specialist_rate,
    comment,
    status,
    sessionId
  );

  logAuditAction({
    userId: req.user.id,
    userName: req.user.name,
    userRole: req.user.role,
    action: 'SESSION_UPDATED',
    entityType: 'schedule_sessions',
    entityId: sessionId,
    details: `Перенос/изменение занятия ID ${sessionId} на ${newDate} ${newStartTime}-${newEndTime}`,
    ipAddress: req.ip
  });

  res.json({ success: true, message: 'Занятие успешно обновлено' });
});

// Delete or cancel session
router.delete('/:id', requireRoles('owner', 'director', 'admin'), (req, res) => {
  const sessionId = req.params.id;
  const session = db.prepare('SELECT s.*, c.full_name as child_name FROM schedule_sessions s JOIN children c ON s.child_id = c.id WHERE s.id = ?').get(sessionId);

  if (!session) {
    return res.status(404).json({ error: 'Занятие не найдено' });
  }

  db.prepare('DELETE FROM schedule_sessions WHERE id = ?').run(sessionId);

  logAuditAction({
    userId: req.user.id,
    userName: req.user.name,
    userRole: req.user.role,
    action: 'SESSION_DELETED',
    entityType: 'schedule_sessions',
    entityId: sessionId,
    details: `Удалена запись ребёнка ${session.child_name} на ${session.date} ${session.start_time}`,
    ipAddress: req.ip
  });

  res.json({ success: true, message: 'Занятие удалено' });
});

// Copy schedule to next week
router.post('/copy-week', requireRoles('owner', 'director', 'admin'), (req, res) => {
  const { sourceWeekStart, targetWeekStart } = req.body;

  if (!sourceWeekStart || !targetWeekStart) {
    return res.status(400).json({ error: 'Укажите дату начала исходной недели и целевой недели' });
  }

  // Get sessions of the source week (7 days)
  const sourceSessions = db.prepare(`
    SELECT * FROM schedule_sessions 
    WHERE date >= ? AND date <= date(?, '+6 days')
      AND status NOT IN ('cancelled_center', 'cancelled_parent')
  `).all(sourceWeekStart, sourceWeekStart);

  let copied = 0;
  let skippedConflicts = 0;

  const insertStmt = db.prepare(`
    INSERT INTO schedule_sessions (
      child_id, specialist_id, direction, date, start_time, end_time,
      duration_minutes, price, specialist_rate, comment, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'scheduled')
  `);

  const srcDate = new Date(sourceWeekStart);
  const tgtDate = new Date(targetWeekStart);
  const dayOffset = Math.round((tgtDate - srcDate) / (1000 * 60 * 60 * 24));

  for (const session of sourceSessions) {
    // Calculate new date
    const origDate = new Date(session.date);
    origDate.setDate(origDate.getDate() + dayOffset);
    const newDateStr = origDate.toISOString().split('T')[0];

    // Conflict check on target slot
    const conflict = checkScheduleConflict({
      specialistId: session.specialist_id,
      date: newDateStr,
      startTime: session.start_time,
      endTime: session.end_time
    });

    if (conflict.hasConflict) {
      skippedConflicts++;
      continue;
    }

    insertStmt.run(
      session.child_id,
      session.specialist_id,
      session.direction,
      newDateStr,
      session.start_time,
      session.end_time,
      session.duration_minutes,
      session.price,
      session.specialist_rate,
      session.comment
    );
    copied++;
  }

  logAuditAction({
    userId: req.user.id,
    userName: req.user.name,
    userRole: req.user.role,
    action: 'WEEK_SCHEDULE_COPIED',
    entityType: 'schedule_sessions',
    details: `Скопировано ${copied} занятий с ${sourceWeekStart} на ${targetWeekStart}. Пропущено конфликтов: ${skippedConflicts}`,
    ipAddress: req.ip
  });

  res.json({
    success: true,
    copied,
    skippedConflicts,
    message: `Скопировано ${copied} занятий на следующую неделю. (Конфликтов пропущено: ${skippedConflicts})`
  });
});

module.exports = router;
