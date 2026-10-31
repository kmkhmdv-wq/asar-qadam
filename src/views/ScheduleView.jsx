import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { SvgIcon } from '../components/icons/CustomIcons';
import { Modal } from '../components/Modal';
import { MedicalAlertBadge } from '../components/MedicalAlertBadge';

export const ScheduleView = () => {
  const { user, canManageSchedule, isSpecialist } = useAuth();
  
  // State
  const [sessions, setSessions] = useState([]);
  const [specialists, setSpecialists] = useState([]);
  const [childrenList, setChildrenList] = useState([]);
  const [selectedSpecialist, setSelectedSpecialist] = useState(isSpecialist && user.specialist_id ? String(user.specialist_id) : 'all');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [loading, setLoading] = useState(true);

  // Modals state
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [selectedSessionDetail, setSelectedSessionDetail] = useState(null);
  const [conflictError, setConflictError] = useState(null);
  const [copySuccessMessage, setCopySuccessMessage] = useState(null);

  // Mobile Day Selection (0 = Mon, 5 = Sat)
  const [selectedDayIdx, setSelectedDayIdx] = useState(0);

  // Reschedule & Attendance Modals State
  const [rescheduleData, setRescheduleData] = useState({
    isOpen: false,
    session: null,
    newDate: '',
    newStartTime: '',
    newSpecialistId: '',
    error: null
  });

  const [attendanceModal, setAttendanceModal] = useState({
    isOpen: false,
    session: null,
    status: 'present',
    notes: '',
    loading: false
  });

  // Booking form state
  const [formData, setFormData] = useState({
    child_id: '',
    specialist_id: '',
    direction: 'Логопедия',
    date: '',
    start_time: '09:00',
    duration_minutes: 45,
    price: 8000,
    comment: ''
  });

  // Drag and drop state
  const [draggedSession, setDraggedSession] = useState(null);

  useEffect(() => {
    fetchSpecialists();
    fetchChildren();
  }, []);

  useEffect(() => {
    fetchSchedule();
  }, [currentDate, selectedSpecialist]);

  const handleOpenReschedule = (session) => {
    setRescheduleData({
      isOpen: true,
      session,
      newDate: session.date,
      newStartTime: session.start_time,
      newSpecialistId: session.specialist_id,
      error: null
    });
  };

  const handleSaveReschedule = async (e) => {
    e.preventDefault();
    setRescheduleData(prev => ({ ...prev, error: null }));
    try {
      const res = await fetch(`/api/schedule/${rescheduleData.session.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('asar_token')}`
        },
        body: JSON.stringify({
          date: rescheduleData.newDate,
          start_time: rescheduleData.newStartTime,
          specialist_id: rescheduleData.newSpecialistId
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setRescheduleData(prev => ({ ...prev, error: data.error || 'Ошибка при переносе занятия' }));
        return;
      }
      setRescheduleData({ isOpen: false, session: null, newDate: '', newStartTime: '', newSpecialistId: '', error: null });
      if (selectedSessionDetail?.id === rescheduleData.session.id) {
        setSelectedSessionDetail(null);
      }
      fetchSchedule();
    } catch (err) {
      setRescheduleData(prev => ({ ...prev, error: err.message }));
    }
  };

  const handleOpenAttendance = (session) => {
    setAttendanceModal({
      isOpen: true,
      session,
      status: session.attendance_status || 'present',
      notes: '',
      loading: false
    });
  };

  const handleSaveAttendance = async (statusToSave) => {
    if (!attendanceModal.session) return;
    setAttendanceModal(prev => ({ ...prev, loading: true }));
    try {
      const res = await fetch('/api/attendance/mark', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('asar_token')}`
        },
        body: JSON.stringify({
          sessionId: attendanceModal.session.id,
          status: statusToSave,
          notes: attendanceModal.notes
        })
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Ошибка сохранения посещаемости');
        return;
      }
      setAttendanceModal({ isOpen: false, session: null, status: 'present', notes: '', loading: false });
      if (selectedSessionDetail?.id === attendanceModal.session.id) {
        setSelectedSessionDetail(null);
      }
      fetchSchedule();
    } catch (err) {
      alert(`Ошибка: ${err.message}`);
    }
  };

  const getWeekRange = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    const saturday = new Date(monday);
    saturday.setDate(monday.getDate() + 5);

    return {
      startDate: monday.toISOString().split('T')[0],
      endDate: saturday.toISOString().split('T')[0],
      monday
    };
  };

  const fetchSchedule = async () => {
    setLoading(true);
    try {
      const { startDate, endDate } = getWeekRange(currentDate);
      let url = `/api/schedule?startDate=${startDate}&endDate=${endDate}`;
      if (selectedSpecialist !== 'all') {
        url += `&specialistId=${selectedSpecialist}`;
      }

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${localStorage.getItem('asar_token')}` }
      });
      const data = await res.json();
      setSessions(data.sessions || []);
    } catch (err) {
      console.error('Error fetching schedule:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSpecialists = async () => {
    try {
      const res = await fetch('/api/specialists', {
        headers: { Authorization: `Bearer ${localStorage.getItem('asar_token')}` }
      });
      const data = await res.json();
      setSpecialists(data.specialists || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchChildren = async () => {
    try {
      const res = await fetch('/api/children', {
        headers: { Authorization: `Bearer ${localStorage.getItem('asar_token')}` }
      });
      const data = await res.json();
      setChildrenList(data.children || []);
    } catch (err) {
      console.error(err);
    }
  };

  const { monday } = getWeekRange(currentDate);
  const weekDays = [];
  const dayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
  for (let i = 0; i < 6; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    weekDays.push({
      dateStr,
      dayName: dayNames[i],
      dateNumber: d.getDate(),
      fullDateFormatted: `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`,
      isToday: dateStr === new Date().toISOString().split('T')[0]
    });
  }

  const timeSlots = [
    '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'
  ];

  const handleOpenBooking = (dateStr, timeStr) => {
    if (!canManageSchedule) return;
    setConflictError(null);
    const defaultSpec = selectedSpecialist !== 'all' ? selectedSpecialist : (specialists[0]?.id || '');
    
    setFormData({
      child_id: childrenList[0]?.id || '',
      specialist_id: defaultSpec,
      direction: 'Логопедия',
      date: dateStr,
      start_time: timeStr,
      duration_minutes: 45,
      price: 8000,
      comment: ''
    });
    setIsBookingModalOpen(true);
  };

  const handleCreateSession = async (e) => {
    e.preventDefault();
    setConflictError(null);

    try {
      const res = await fetch('/api/schedule', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('asar_token')}`
        },
        body: JSON.stringify(formData)
      });

      const data = await res.json();

      if (!res.ok) {
        setConflictError(data.error || 'Ошибка при бронировании занятия');
        return;
      }

      setIsBookingModalOpen(false);
      fetchSchedule();
    } catch (err) {
      setConflictError(err.message || 'Сетевая ошибка');
    }
  };

  const handleDragStart = (session) => {
    if (!canManageSchedule) return;
    setDraggedSession(session);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = async (targetDateStr, targetTimeStr) => {
    if (!draggedSession || !canManageSchedule) return;
    setConflictError(null);

    try {
      const res = await fetch(`/api/schedule/${draggedSession.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('asar_token')}`
        },
        body: JSON.stringify({
          date: targetDateStr,
          start_time: targetTimeStr
        })
      });

      const data = await res.json();
      if (!res.ok) {
        alert(`Ошибка переноса: ${data.error}`);
        return;
      }

      setDraggedSession(null);
      fetchSchedule();
    } catch (err) {
      alert(`Ошибка: ${err.message}`);
    }
  };

  const handleCopyWeek = async () => {
    if (!confirm('Скопировать расписание текущей недели на следующую неделю? Конфликтующие слоты будут автоматически пропущены.')) {
      return;
    }
    const { startDate } = getWeekRange(currentDate);
    const targetMonday = new Date(monday);
    targetMonday.setDate(monday.getDate() + 7);
    const targetWeekStart = targetMonday.toISOString().split('T')[0];

    try {
      const res = await fetch('/api/schedule/copy-week', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('asar_token')}`
        },
        body: JSON.stringify({
          sourceWeekStart: startDate,
          targetWeekStart: targetWeekStart
        })
      });
      const data = await res.json();
      setCopySuccessMessage(data.message);
      setTimeout(() => setCopySuccessMessage(null), 5000);
    } catch (err) {
      alert(`Ошибка копирования: ${err.message}`);
    }
  };

  const findSessionsForSlot = (dateStr, timeStr) => {
    return sessions.filter(s => {
      if (s.date !== dateStr) return false;
      const sStart = s.start_time.substring(0, 5);
      const slotHour = timeStr.substring(0, 2);
      return sStart.startsWith(slotHour);
    });
  };

  return (
    <div style={{ padding: '24px 32px', maxWidth: '1600px', margin: '0 auto' }}>
      
      {/* Top Filter and Navigation Bar */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        background: 'var(--surface-white)',
        border: '1px solid var(--border-light)',
        padding: '16px 20px',
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-sm)',
        marginBottom: '20px'
      }}>
        {/* Date navigators */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button 
            onClick={() => {
              const prev = new Date(currentDate);
              prev.setDate(currentDate.getDate() - 7);
              setCurrentDate(prev);
            }}
            className="btn-secondary"
            style={{ padding: '8px 12px' }}
          >
            ← Пред. неделя
          </button>
          <button 
            onClick={() => setCurrentDate(new Date())}
            className="btn-secondary"
            style={{ padding: '8px 14px' }}
          >
            Сегодня
          </button>
          <button 
            onClick={() => {
              const next = new Date(currentDate);
              next.setDate(currentDate.getDate() + 7);
              setCurrentDate(next);
            }}
            className="btn-secondary"
            style={{ padding: '8px 12px' }}
          >
            След. неделя →
          </button>
          <span style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-dark)', marginLeft: '10px' }}>
            {weekDays[0].fullDateFormatted} — {weekDays[5].fullDateFormatted}.{monday.getFullYear()}
          </span>
        </div>

        {/* Specialist Selector & Quick Action CTA */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {!isSpecialist && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="text-label-muted" style={{ fontSize: '11px' }}>Специалист:</span>
              <select 
                value={selectedSpecialist}
                onChange={(e) => setSelectedSpecialist(e.target.value)}
                className="form-select"
                style={{ width: '220px', padding: '8px 12px' }}
              >
                <option value="all">Все специалисты центра</option>
                {specialists.map(sp => (
                  <option key={sp.id} value={sp.id}>{sp.full_name} ({sp.specialty})</option>
                ))}
              </select>
            </div>
          )}

          {canManageSchedule && (
            <>
              <button 
                onClick={handleCopyWeek}
                className="btn-secondary"
                style={{ padding: '8px 14px' }}
              >
                Копировать на след. неделю
              </button>
              <button 
                onClick={() => handleOpenBooking(weekDays[0].dateStr, '09:00')}
                className="btn-primary-cta"
                style={{ padding: '8px 16px', fontSize: '13px' }}
              >
                <SvgIcon name="plus" size={15} color="#FFFFFF" />
                <span>Записать ребёнка</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Copy notification */}
      {copySuccessMessage && (
        <div style={{
          background: 'var(--color-green-light)',
          border: '1px solid var(--color-green)',
          color: 'var(--color-green-dark)',
          padding: '12px 16px',
          borderRadius: 'var(--radius-sm)',
          marginBottom: '16px',
          fontWeight: '700'
        }}>
          {copySuccessMessage}
        </div>
      )}

      {/* Legend Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '20px',
        padding: '10px 18px',
        background: 'var(--surface-white)',
        border: '1px solid var(--border-light)',
        borderRadius: 'var(--radius-sm)',
        marginBottom: '16px',
        fontSize: '12px'
      }}>
        <span className="text-label-muted" style={{ fontSize: '11px' }}>Обозначения:</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '12px', height: '12px', background: 'var(--bg-main)', border: '1px dashed var(--border-medium)', borderRadius: '2px' }} />
          <span style={{ color: 'var(--text-secondary)' }}>Свободный слот (нажмите для записи)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '12px', height: '12px', background: 'var(--surface-white)', borderLeft: '3px solid var(--color-teal)', border: '1px solid var(--border-light)', borderLeftWidth: '3px', borderLeftColor: 'var(--color-teal)', borderRadius: '2px' }} />
          <span style={{ color: 'var(--text-secondary)' }}>Занято (защита от повторной записи)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ color: 'var(--color-raspberry)', fontWeight: '800' }}>[МЕД]</span>
          <span style={{ color: 'var(--text-secondary)' }}>Медицинское предупреждение (астма / аллергия)</span>
        </div>
      </div>

      {/* MOBILE SCHEDULE EXPERIENCE (Touch Cards & Day Tabs) */}
      <div className="mobile-only" style={{ marginBottom: '24px' }}>
        {/* Day Pills Bar */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(6, 1fr)',
          gap: '6px',
          marginBottom: '14px'
        }}>
          {weekDays.map((day, idx) => {
            const isSelected = selectedDayIdx === idx;
            const daySessionsCount = sessions.filter(s => s.date === day.dateStr && (selectedSpecialist === 'all' || String(s.specialist_id) === String(selectedSpecialist))).length;
            return (
              <button
                key={day.dateStr}
                onClick={() => setSelectedDayIdx(idx)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: '8px 4px',
                  borderRadius: 'var(--radius-sm)',
                  border: isSelected ? '2px solid var(--color-teal)' : '1px solid var(--border-light)',
                  background: isSelected ? 'var(--color-teal)' : (day.isToday ? 'var(--color-teal-light)' : 'var(--surface-white)'),
                  color: isSelected ? '#FFFFFF' : (day.isToday ? 'var(--color-teal-dark)' : 'var(--text-dark)'),
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: isSelected ? '0 2px 6px rgba(56, 185, 173, 0.3)' : 'none'
                }}
              >
                <span style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase' }}>
                  {day.dayName}
                </span>
                <span style={{ fontSize: '16px', fontWeight: '800', marginTop: '2px' }}>
                  {day.dateNumber}
                </span>
                {daySessionsCount > 0 && (
                  <span style={{
                    fontSize: '9px',
                    fontWeight: '800',
                    borderRadius: '10px',
                    padding: '1px 5px',
                    marginTop: '2px',
                    background: isSelected ? '#FFFFFF' : 'var(--color-teal)',
                    color: isSelected ? 'var(--color-teal)' : '#FFFFFF'
                  }}>
                    {daySessionsCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Selected Day Info & Add Button */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '12px'
        }}>
          <div>
            <span style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-dark)' }}>
              {weekDays[selectedDayIdx]?.dayName}, {weekDays[selectedDayIdx]?.fullDateFormatted}
            </span>
            {weekDays[selectedDayIdx]?.isToday && (
              <span style={{
                fontSize: '10px',
                fontWeight: '800',
                color: 'var(--color-teal-dark)',
                background: 'var(--color-teal-light)',
                padding: '2px 6px',
                borderRadius: 'var(--radius-full)',
                marginLeft: '8px'
              }}>
                СЕГОДНЯ
              </span>
            )}
          </div>

          {canManageSchedule && (
            <button
              onClick={() => handleOpenBooking(weekDays[selectedDayIdx]?.dateStr, '09:00')}
              className="btn-primary-cta"
              style={{ padding: '6px 12px', fontSize: '12px' }}
            >
              <SvgIcon name="plus" size={14} color="#FFFFFF" />
              <span>Записать</span>
            </button>
          )}
        </div>

        {/* List of Mobile Cards for Selected Day */}
        {(() => {
          const activeDay = weekDays[selectedDayIdx];
          if (!activeDay) return null;
          const daySessions = sessions
            .filter(s => s.date === activeDay.dateStr && (selectedSpecialist === 'all' || String(s.specialist_id) === String(selectedSpecialist)))
            .sort((a, b) => a.start_time.localeCompare(b.start_time));

          if (daySessions.length === 0) {
            return (
              <div style={{
                background: 'var(--surface-white)',
                border: '1px dashed var(--border-medium)',
                borderRadius: 'var(--radius-md)',
                padding: '32px 16px',
                textAlign: 'center',
                color: 'var(--text-secondary)'
              }}>
                <div style={{ fontSize: '14px', fontWeight: '700', marginBottom: '8px' }}>
                  Нет запланированных занятий на этот день
                </div>
                {canManageSchedule && (
                  <button
                    onClick={() => handleOpenBooking(activeDay.dateStr, '09:00')}
                    className="btn-secondary"
                    style={{ fontSize: '12px', marginTop: '6px' }}
                  >
                    + Записать ребёнка на {activeDay.dayName}
                  </button>
                )}
              </div>
            );
          }

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {daySessions.map(session => {
                const statusLabels = {
                  present: { label: 'Присутствовал', color: 'var(--color-green-dark)', bg: 'var(--color-green-light)' },
                  absent: { label: 'Пропуск', color: 'var(--color-raspberry)', bg: 'var(--color-raspberry-light)' },
                  cancelled_parent: { label: 'Отмена родителем', color: 'var(--text-secondary)', bg: 'var(--surface-subtle)' },
                  cancelled_center: { label: 'Отмена центром', color: 'var(--text-secondary)', bg: 'var(--surface-subtle)' }
                };
                const statusInfo = statusLabels[session.attendance_status] || { label: 'Ожидается', color: 'var(--color-teal-dark)', bg: 'var(--color-teal-light)' };

                return (
                  <div
                    key={session.id}
                    className="mobile-schedule-card"
                    style={{
                      borderLeft: session.hasMedicalAlert ? '4px solid var(--color-raspberry)' : '4px solid var(--color-teal)'
                    }}
                  >
                    {/* Top Row: Time & Status */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{
                        fontSize: '13px',
                        fontWeight: '800',
                        color: 'var(--text-dark)',
                        background: 'var(--surface-subtle)',
                        padding: '3px 8px',
                        borderRadius: '6px'
                      }}>
                        {session.start_time} - {session.end_time}
                      </span>
                      <span style={{
                        fontSize: '11px',
                        fontWeight: '700',
                        color: statusInfo.color,
                        background: statusInfo.bg,
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-full)'
                      }}>
                        {statusInfo.label}
                      </span>
                    </div>

                    {/* Child Name */}
                    <div style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-dark)', marginBottom: '4px' }}>
                      {session.child_name}
                    </div>

                    {/* Medical Alert Warning */}
                    {session.hasMedicalAlert && (
                      <div style={{
                        background: 'var(--color-raspberry-light)',
                        color: 'var(--color-raspberry)',
                        border: '1px solid var(--color-raspberry)',
                        borderRadius: '6px',
                        padding: '6px 10px',
                        fontSize: '12px',
                        fontWeight: '700',
                        marginBottom: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}>
                        <span>⚠️ [МЕД]</span>
                        <span>{session.chronic_diseases || session.allergy_details || 'Внимание к медицинскому протоколу'}</span>
                      </div>
                    )}

                    {/* Specialist & Direction */}
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      <strong>{session.specialist_name}</strong> · {session.direction}
                    </div>

                    {/* Parent Phone */}
                    {session.parent_phone && (
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '10px' }}>
                        Родитель: {session.parent_name || '—'} (<a href={`tel:${session.parent_phone}`} style={{ color: 'var(--color-teal-dark)', fontWeight: '600' }}>{session.parent_phone}</a>)
                      </div>
                    )}

                    {/* Action buttons */}
                    <div style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '6px',
                      paddingTop: '8px',
                      borderTop: '1px solid var(--border-light)'
                    }}>
                      <button
                        onClick={() => handleOpenAttendance(session)}
                        className="btn-secondary"
                        style={{ flex: 1, padding: '6px 8px', fontSize: '11px', fontWeight: '700', color: 'var(--color-teal-dark)' }}
                      >
                        Посещаемость
                      </button>
                      <button
                        onClick={() => handleOpenReschedule(session)}
                        className="btn-secondary"
                        style={{ flex: 1, padding: '6px 8px', fontSize: '11px', fontWeight: '700' }}
                      >
                        Перенести
                      </button>
                      <button
                        onClick={() => setSelectedSessionDetail(session)}
                        className="btn-secondary"
                        style={{ padding: '6px 10px', fontSize: '11px' }}
                      >
                        Детали
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>

      {/* Spreadsheet Calendar Grid (Desktop View) */}
      <div className="desktop-only" style={{
        background: 'var(--surface-white)',
        border: '1px solid var(--border-light)',
        borderRadius: 'var(--radius-md)',
        overflowX: 'auto',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          tableLayout: 'fixed',
          minWidth: '1000px'
        }}>
          {/* Header Days of Week */}
          <thead>
            <tr>
              <th style={{
                width: '88px',
                padding: '14px 10px',
                background: 'var(--surface-subtle)',
                borderRight: '1px solid var(--border-light)',
                borderBottom: '1px solid var(--border-light)',
                font: 'var(--font-label)',
                color: 'var(--text-secondary)',
                textAlign: 'center'
              }}>
                ВРЕМЯ
              </th>
              {weekDays.map(day => (
                <th key={day.dateStr} style={{
                  padding: '12px 14px',
                  background: day.isToday ? 'var(--color-teal-light)' : 'var(--surface-subtle)',
                  borderRight: '1px solid var(--border-light)',
                  borderBottom: day.isToday ? '2px solid var(--color-teal)' : '1px solid var(--border-light)',
                  textAlign: 'left'
                }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                    <span style={{
                      fontSize: '18px',
                      fontWeight: '800',
                      color: day.isToday ? 'var(--color-teal-dark)' : 'var(--text-dark)'
                    }}>
                      {day.dateNumber}
                    </span>
                    <span style={{
                      fontSize: '12px',
                      fontWeight: '700',
                      textTransform: 'uppercase',
                      color: day.isToday ? 'var(--color-teal-dark)' : 'var(--text-secondary)',
                      letterSpacing: '0.04em'
                    }}>
                      {day.dayName}
                    </span>
                    {day.isToday && (
                      <span style={{
                        background: 'var(--color-teal)',
                        color: '#FFFFFF',
                        fontSize: '9px',
                        fontWeight: '800',
                        padding: '1px 6px',
                        borderRadius: 'var(--radius-full)',
                        marginLeft: 'auto'
                      }}>
                        СЕГОДНЯ
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          {/* Time Slot Rows */}
          <tbody>
            {timeSlots.map(timeStr => (
              <tr key={timeStr}>
                {/* Time Column */}
                <td style={{
                  padding: '10px 8px',
                  textAlign: 'center',
                  fontFamily: 'monospace',
                  fontSize: '13px',
                  fontWeight: '700',
                  color: 'var(--text-secondary)',
                  borderRight: '1px solid var(--border-light)',
                  borderBottom: '1px solid var(--border-light)',
                  background: 'var(--surface-subtle)'
                }}>
                  {timeStr}
                </td>

                {/* Day Columns */}
                {weekDays.map(day => {
                  const slotSessions = findSessionsForSlot(day.dateStr, timeStr);
                  const isOccupied = slotSessions.length > 0;

                  return (
                    <td 
                      key={day.dateStr + timeStr}
                      onDragOver={handleDragOver}
                      onDrop={() => handleDrop(day.dateStr, timeStr)}
                      style={{
                        padding: '6px',
                        verticalAlign: 'top',
                        borderRight: '1px solid var(--border-light)',
                        borderBottom: '1px solid var(--border-light)',
                        background: isOccupied ? 'var(--surface-white)' : 'transparent',
                        height: '76px'
                      }}
                    >
                      {isOccupied ? (
                        slotSessions.map(sess => (
                          <div
                            key={sess.id}
                            draggable={canManageSchedule}
                            onDragStart={() => handleDragStart(sess)}
                            onClick={() => setSelectedSessionDetail(sess)}
                            style={{
                              background: 'var(--surface-white)',
                              border: '1px solid var(--border-medium)',
                              borderLeft: '4px solid var(--color-teal)',
                              padding: '8px 10px',
                              borderRadius: 'var(--radius-xs)',
                              cursor: 'pointer',
                              boxShadow: 'var(--shadow-sm)',
                              position: 'relative',
                              transition: 'all 0.15s ease'
                            }}
                            onMouseEnter={e => e.currentTarget.style.boxShadow = 'var(--shadow-hover)'}
                            onMouseLeave={e => e.currentTarget.style.boxShadow = 'var(--shadow-sm)'}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                              <span style={{ fontSize: '11px', fontFamily: 'monospace', fontWeight: '700', color: 'var(--color-teal-dark)' }}>
                                {sess.start_time} - {sess.end_time}
                              </span>
                              {sess.hasMedicalAlert && (
                                <span style={{
                                  background: 'var(--color-raspberry)',
                                  color: '#FFFFFF',
                                  fontSize: '9px',
                                  fontWeight: '900',
                                  padding: '1px 5px',
                                  borderRadius: '2px'
                                }}>
                                  МЕД
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-dark)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {sess.child_name}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                              {sess.specialist_name?.split(' ')[0]} · {sess.direction}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div 
                          onClick={() => handleOpenBooking(day.dateStr, timeStr)}
                          style={{
                            height: '100%',
                            minHeight: '60px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: '1px dashed transparent',
                            borderRadius: 'var(--radius-xs)',
                            color: 'transparent',
                            cursor: canManageSchedule ? 'pointer' : 'default',
                            transition: 'all 0.15s ease'
                          }}
                          onMouseEnter={(e) => {
                            if (canManageSchedule) {
                              e.currentTarget.style.borderColor = 'var(--color-teal)';
                              e.currentTarget.style.color = 'var(--color-teal)';
                              e.currentTarget.style.background = 'var(--color-teal-light)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = 'transparent';
                            e.currentTarget.style.color = 'transparent';
                            e.currentTarget.style.background = 'transparent';
                          }}
                        >
                          <span style={{ fontSize: '11px', fontWeight: '700' }}>+ Записать</span>
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* MODAL 1: NEW BOOKING WITH DOUBLE BOOKING PROTECTION */}
      <Modal
        isOpen={isBookingModalOpen}
        onClose={() => setIsBookingModalOpen(false)}
        title="Запись ребёнка на занятие"
        subtitle="Интеллектуальное расписание Asar Qadam"
      >
        <form onSubmit={handleCreateSession}>
          {conflictError && (
            <div style={{
              background: 'var(--color-raspberry-light)',
              border: '2px solid var(--color-raspberry)',
              color: 'var(--color-raspberry-dark)',
              padding: '12px 16px',
              borderRadius: 'var(--radius-sm)',
              marginBottom: '16px',
              fontSize: '13px',
              fontWeight: '700'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <SvgIcon name="alert" size={17} color="var(--color-raspberry)" />
                <span>КОНФЛИКТ В РАСПИСАНИИ (ЗАЩИТА ОТ ДВОЙНОЙ ЗАПИСИ):</span>
              </div>
              <div style={{ marginTop: '6px' }}>
                {conflictError}
              </div>
            </div>
          )}

          {/* Child select */}
          <div style={{ marginBottom: '14px' }}>
            <label className="text-label-muted" style={{ display: 'block', marginBottom: '6px' }}>
              Выберите ребёнка:
            </label>
            <select
              value={formData.child_id}
              onChange={(e) => setFormData({ ...formData, child_id: e.target.value })}
              className="form-select"
              required
            >
              {childrenList.map(c => (
                <option key={c.id} value={c.id}>
                  {c.full_name} {c.hasMedicalAlert ? '⚠️ [Мед. внимание]' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Medical warning for selected child */}
          {(() => {
            const selectedChild = childrenList.find(c => String(c.id) === String(formData.child_id));
            return selectedChild && selectedChild.hasMedicalAlert ? (
              <MedicalAlertBadge child={selectedChild} />
            ) : null;
          })()}

          {/* Specialist select */}
          <div style={{ marginBottom: '14px' }}>
            <label className="text-label-muted" style={{ display: 'block', marginBottom: '6px' }}>
              Специалист центра:
            </label>
            <select
              value={formData.specialist_id}
              onChange={(e) => setFormData({ ...formData, specialist_id: e.target.value })}
              className="form-select"
              required
            >
              {specialists.map(sp => (
                <option key={sp.id} value={sp.id}>
                  {sp.full_name} — {sp.specialty}
                </option>
              ))}
            </select>
          </div>

          {/* Direction & Price */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
            <div>
              <label className="text-label-muted" style={{ display: 'block', marginBottom: '6px' }}>
                Направление:
              </label>
              <input
                type="text"
                value={formData.direction}
                onChange={(e) => setFormData({ ...formData, direction: e.target.value })}
                className="form-input"
                placeholder="Логопедия / АФК / ABA"
                required
              />
            </div>
            <div>
              <label className="text-label-muted" style={{ display: 'block', marginBottom: '6px' }}>
                Стоимость занятия (₸):
              </label>
              <input
                type="number"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                className="form-input"
                required
              />
            </div>
          </div>

          {/* Date, Time, Duration */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '12px', marginBottom: '14px' }}>
            <div>
              <label className="text-label-muted" style={{ display: 'block', marginBottom: '6px' }}>
                Дата:
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="form-input"
                required
              />
            </div>
            <div>
              <label className="text-label-muted" style={{ display: 'block', marginBottom: '6px' }}>
                Начало:
              </label>
              <input
                type="time"
                value={formData.start_time}
                onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                className="form-input"
                required
              />
            </div>
            <div>
              <label className="text-label-muted" style={{ display: 'block', marginBottom: '6px' }}>
                Длительность:
              </label>
              <select
                value={formData.duration_minutes}
                onChange={(e) => setFormData({ ...formData, duration_minutes: Number(e.target.value) })}
                className="form-select"
              >
                <option value={30}>30 мин</option>
                <option value={45}>45 мин</option>
                <option value={60}>60 мин</option>
              </select>
            </div>
          </div>

          {/* Comments */}
          <div style={{ marginBottom: '20px' }}>
            <label className="text-label-muted" style={{ display: 'block', marginBottom: '6px' }}>
              Комментарий / Задачи занятия:
            </label>
            <input
              type="text"
              value={formData.comment}
              onChange={(e) => setFormData({ ...formData, comment: e.target.value })}
              className="form-input"
              placeholder="Индивидуальные задачи занятия..."
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button
              type="button"
              onClick={() => setIsBookingModalOpen(false)}
              className="btn-secondary"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="btn-primary-cta"
            >
              Зафиксировать запись
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: SESSION DETAIL & ACTIONS */}
      {selectedSessionDetail && (
        <Modal
          isOpen={!!selectedSessionDetail}
          onClose={() => setSelectedSessionDetail(null)}
          title={`Занятие: ${selectedSessionDetail.child_name}`}
          subtitle={`${selectedSessionDetail.date} · ${selectedSessionDetail.start_time} - ${selectedSessionDetail.end_time}`}
        >
          <div>
            {selectedSessionDetail.hasMedicalAlert && (
              <MedicalAlertBadge child={selectedSessionDetail} />
            )}

            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '12px',
              padding: '16px',
              background: 'var(--surface-subtle)',
              border: '1px solid var(--border-light)',
              borderRadius: 'var(--radius-sm)',
              margin: '16px 0'
            }}>
              <div>
                <span className="text-label-muted" style={{ fontSize: '10px' }}>Специалист</span>
                <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-dark)', marginTop: '2px' }}>
                  {selectedSessionDetail.specialist_name}
                </div>
              </div>
              <div>
                <span className="text-label-muted" style={{ fontSize: '10px' }}>Направление</span>
                <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-dark)', marginTop: '2px' }}>
                  {selectedSessionDetail.direction}
                </div>
              </div>
              <div>
                <span className="text-label-muted" style={{ fontSize: '10px' }}>Стоимость</span>
                <div style={{ fontSize: '15px', fontWeight: '800', color: 'var(--color-teal-dark)', marginTop: '2px' }}>
                  {selectedSessionDetail.price?.toLocaleString('ru-RU')} ₸
                </div>
              </div>
              <div>
                <span className="text-label-muted" style={{ fontSize: '10px' }}>Контакты родителя</span>
                <div style={{ fontSize: '14px', color: 'var(--text-dark)', marginTop: '2px' }}>
                  {selectedSessionDetail.parent_name || 'Родитель'} ({selectedSessionDetail.parent_phone || '—'})
                </div>
              </div>
            </div>

            {selectedSessionDetail.comment && (
              <div style={{ fontSize: '13px', color: 'var(--text-main)', marginBottom: '20px' }}>
                <strong>Примечание:</strong> {selectedSessionDetail.comment}
              </div>
            )}

            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '10px',
              marginTop: '20px',
              paddingTop: '16px',
              borderTop: '1px solid var(--border-light)'
            }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => handleOpenAttendance(selectedSessionDetail)}
                  className="btn-primary-cta"
                  style={{ padding: '8px 14px', fontSize: '13px' }}
                >
                  <SvgIcon name="check" size={15} color="#FFFFFF" />
                  <span>Посещаемость</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenReschedule(selectedSessionDetail)}
                  className="btn-secondary"
                  style={{ padding: '8px 14px', fontSize: '13px' }}
                >
                  Перенести занятие
                </button>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                {canManageSchedule && (
                  <button
                    onClick={async () => {
                      if (confirm('Удалить эту запись из расписания?')) {
                        await fetch(`/api/schedule/${selectedSessionDetail.id}`, {
                          method: 'DELETE',
                          headers: { Authorization: `Bearer ${localStorage.getItem('asar_token')}` }
                        });
                        setSelectedSessionDetail(null);
                        fetchSchedule();
                      }
                    }}
                    className="btn-secondary"
                    style={{ color: 'var(--color-raspberry)', borderColor: 'var(--color-raspberry-light)', padding: '8px 12px', fontSize: '13px' }}
                  >
                    Удалить
                  </button>
                )}
                <button
                  onClick={() => setSelectedSessionDetail(null)}
                  className="btn-secondary"
                  style={{ padding: '8px 14px', fontSize: '13px' }}
                >
                  Закрыть
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL 3: RESCHEDULE SESSION (ПЕРЕНОС ЗАНЯТИЯ С ПРОВЕРКОЙ КОНФЛИКТОВ) */}
      {rescheduleData.isOpen && rescheduleData.session && (
        <Modal
          isOpen={rescheduleData.isOpen}
          onClose={() => setRescheduleData({ isOpen: false, session: null, newDate: '', newStartTime: '', newSpecialistId: '', error: null })}
          title={`Перенос занятия: ${rescheduleData.session.child_name}`}
          subtitle="Защита от двойной записи и перекрестных конфликтов"
        >
          <form onSubmit={handleSaveReschedule}>
            {rescheduleData.error && (
              <div style={{
                background: 'var(--color-raspberry-light)',
                border: '2px solid var(--color-raspberry)',
                color: 'var(--color-raspberry-dark)',
                padding: '12px 16px',
                borderRadius: 'var(--radius-sm)',
                marginBottom: '16px',
                fontSize: '13px',
                fontWeight: '700'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <SvgIcon name="alert" size={17} color="var(--color-raspberry)" />
                  <span>КОНФЛИКТ ПРИ ПЕРЕНОСЕ:</span>
                </div>
                <div style={{ marginTop: '6px' }}>{rescheduleData.error}</div>
              </div>
            )}

            <div style={{ marginBottom: '14px' }}>
              <label className="text-label-muted" style={{ display: 'block', marginBottom: '6px' }}>
                Специалист:
              </label>
              <select
                value={rescheduleData.newSpecialistId}
                onChange={(e) => setRescheduleData({ ...rescheduleData, newSpecialistId: e.target.value })}
                className="form-select"
                required
              >
                {specialists.map(sp => (
                  <option key={sp.id} value={sp.id}>
                    {sp.full_name} ({sp.specialty})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
              <div>
                <label className="text-label-muted" style={{ display: 'block', marginBottom: '6px' }}>
                  Новая дата:
                </label>
                <input
                  type="date"
                  value={rescheduleData.newDate}
                  onChange={(e) => setRescheduleData({ ...rescheduleData, newDate: e.target.value })}
                  className="form-input"
                  required
                />
              </div>
              <div>
                <label className="text-label-muted" style={{ display: 'block', marginBottom: '6px' }}>
                  Новое время начала:
                </label>
                <input
                  type="time"
                  value={rescheduleData.newStartTime}
                  onChange={(e) => setRescheduleData({ ...rescheduleData, newStartTime: e.target.value })}
                  className="form-input"
                  required
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setRescheduleData({ isOpen: false, session: null, newDate: '', newStartTime: '', newSpecialistId: '', error: null })}
                className="btn-secondary"
              >
                Отмена
              </button>
              <button
                type="submit"
                className="btn-primary-cta"
              >
                Сохранить перенос
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL 4: QUICK ATTENDANCE MARKING */}
      {attendanceModal.isOpen && attendanceModal.session && (
        <Modal
          isOpen={attendanceModal.isOpen}
          onClose={() => setAttendanceModal({ isOpen: false, session: null, status: 'present', notes: '', loading: false })}
          title={`Отметка посещаемости: ${attendanceModal.session.child_name}`}
          subtitle={`${attendanceModal.session.date} · ${attendanceModal.session.start_time} - ${attendanceModal.session.end_time} · ${attendanceModal.session.specialist_name}`}
        >
          <div>
            <div className="text-label-muted" style={{ marginBottom: '10px' }}>
              Выберите статус посещения:
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
              <button
                type="button"
                onClick={() => handleSaveAttendance('present')}
                disabled={attendanceModal.loading}
                style={{
                  padding: '14px 10px',
                  borderRadius: 'var(--radius-sm)',
                  border: '2px solid var(--color-green)',
                  background: 'var(--color-green-light)',
                  color: 'var(--color-green-dark)',
                  fontWeight: '800',
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <SvgIcon name="check" size={20} color="var(--color-green-dark)" />
                <span>Присутствовал</span>
                <span style={{ fontSize: '10px', fontWeight: '500', opacity: 0.85 }}>Урок состоялся (100% списание)</span>
              </button>

              <button
                type="button"
                onClick={() => handleSaveAttendance('absent')}
                disabled={attendanceModal.loading}
                style={{
                  padding: '14px 10px',
                  borderRadius: 'var(--radius-sm)',
                  border: '2px solid var(--color-raspberry)',
                  background: 'var(--color-raspberry-light)',
                  color: 'var(--color-raspberry-dark)',
                  fontWeight: '800',
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <SvgIcon name="close" size={20} color="var(--color-raspberry)" />
                <span>Пропуск / Неявка</span>
                <span style={{ fontSize: '10px', fontWeight: '500', opacity: 0.85 }}>Без уважительной причины</span>
              </button>

              <button
                type="button"
                onClick={() => handleSaveAttendance('cancelled_parent')}
                disabled={attendanceModal.loading}
                className="btn-secondary"
                style={{ padding: '12px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}
              >
                <span style={{ fontWeight: '700' }}>Отмена родителем</span>
                <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Заблаговременное предупреждение</span>
              </button>

              <button
                type="button"
                onClick={() => handleSaveAttendance('cancelled_center')}
                disabled={attendanceModal.loading}
                className="btn-secondary"
                style={{ padding: '12px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}
              >
                <span style={{ fontWeight: '700' }}>Отмена центром</span>
                <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>По инициативе центра / специалиста</span>
              </button>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label className="text-label-muted" style={{ display: 'block', marginBottom: '6px' }}>
                Комментарий к посещению (необязательно):
              </label>
              <input
                type="text"
                value={attendanceModal.notes}
                onChange={(e) => setAttendanceModal({ ...attendanceModal, notes: e.target.value })}
                className="form-input"
                placeholder="Заметки о ходе занятия или причине пропуска..."
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setAttendanceModal({ isOpen: false, session: null, status: 'present', notes: '', loading: false })}
                className="btn-secondary"
              >
                Отмена
              </button>
            </div>
          </div>
        </Modal>
      )}

    </div>
  );
};
