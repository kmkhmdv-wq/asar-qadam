const db = require('../db');

/**
 * Checks for scheduling conflicts for a specialist on a given date and time range.
 * Overlap formula: (existing.start < requested.end) AND (existing.end > requested.start)
 */
function checkScheduleConflict({ specialistId, date, startTime, endTime, excludeSessionId = null }) {
  const specialist = db.prepare('SELECT * FROM specialists WHERE id = ?').get(specialistId);
  if (!specialist) {
    return { hasConflict: true, error: 'Специалист не найден' };
  }

  // 1. Check specialist active status
  if (!specialist.is_active) {
    return { hasConflict: true, error: 'Специалист деактивирован' };
  }

  // 2. Check work days
  const dateObj = new Date(date + 'T00:00:00');
  const dayIndex = dateObj.getDay(); // 0 is Sunday, 1 is Monday...
  const daysMap = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const dayKey = daysMap[dayIndex];

  let workDays = [];
  try {
    workDays = JSON.parse(specialist.work_days || '[]');
  } catch (e) {
    workDays = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  }

  if (!workDays.includes(dayKey)) {
    const ruDays = {
      mon: 'понедельник', tue: 'вторник', wed: 'среда',
      thu: 'четверг', fri: 'пятница', sat: 'суббота', sun: 'воскресенье'
    };
    return {
      hasConflict: true,
      error: `У специалиста ${specialist.full_name} выходной в этот день (${ruDays[dayKey] || dayKey})`
    };
  }

  // 3. Check work hours boundary (warning/soft check or strict)
  if (startTime < specialist.work_hours_start || endTime > specialist.work_hours_end) {
    return {
      hasConflict: true,
      error: `Время ${startTime}-${endTime} выходит за рамки рабочего графика специалиста (${specialist.work_hours_start} - ${specialist.work_hours_end})`
    };
  }

  // 4. Strict Overlap Check with existing sessions
  let query = `
    SELECT s.*, c.full_name as child_name 
    FROM schedule_sessions s
    JOIN children c ON s.child_id = c.id
    WHERE s.specialist_id = ? 
      AND s.date = ? 
      AND s.status NOT IN ('cancelled_center', 'cancelled_parent')
      AND (s.start_time < ? AND s.end_time > ?)
  `;
  const params = [specialistId, date, endTime, startTime];

  if (excludeSessionId) {
    query += ' AND s.id != ?';
    params.push(excludeSessionId);
  }

  const conflictingSessions = db.prepare(query).all(...params);

  if (conflictingSessions.length > 0) {
    const conflict = conflictingSessions[0];
    return {
      hasConflict: true,
      error: `Специалист уже занят в это время! Конфликт с занятием: ${conflict.child_name} (${conflict.start_time} - ${conflict.end_time})`,
      conflictingSession: conflict
    };
  }

  return { hasConflict: false };
}

module.exports = {
  checkScheduleConflict
};
