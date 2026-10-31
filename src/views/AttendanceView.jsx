import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { SvgIcon } from '../components/icons/CustomIcons';
import { Modal } from '../components/Modal';
import { MedicalAlertBadge } from '../components/MedicalAlertBadge';

export const AttendanceView = () => {
  const { user, isSpecialist } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Mark attendance modal
  const [activeSession, setActiveSession] = useState(null);
  const [status, setStatus] = useState('present');
  const [isBillable, setIsBillable] = useState(true);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successToast, setSuccessToast] = useState(null);

  useEffect(() => {
    fetchSessions();
  }, [selectedDate, user]);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      let url = `/api/schedule?startDate=${selectedDate}&endDate=${selectedDate}`;
      if (isSpecialist && user?.specialist_id) {
        url += `&specialistId=${user.specialist_id}`;
      }

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${localStorage.getItem('asar_token')}` }
      });
      const data = await res.json();
      setSessions(data.sessions || []);
    } catch (err) {
      console.error('Error fetching sessions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenMarkModal = (session) => {
    setActiveSession(session);
    setStatus(session.attendance_status || 'present');
    setIsBillable(session.attendance_billable !== undefined ? !!session.attendance_billable : true);
    setNotes('');
  };

  const handleSaveAttendance = async (e) => {
    e.preventDefault();
    if (!activeSession) return;
    setSubmitting(true);

    try {
      const res = await fetch('/api/attendance/mark', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('asar_token')}`
        },
        body: JSON.stringify({
          sessionId: activeSession.id,
          status,
          isBillableOverride: isBillable,
          notes
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка сохранения');

      setActiveSession(null);
      setSuccessToast(`Посещаемость зафиксирована: ${data.message}`);
      setTimeout(() => setSuccessToast(null), 4000);
      fetchSessions();
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const statusRussianLabels = {
    present: 'Пришёл',
    absent: 'Не пришёл',
    cancelled_center: 'Отменено центром',
    cancelled_parent: 'Отменено родителем',
    rescheduled: 'Перенесено'
  };

  return (
    <div style={{ padding: '28px 32px', maxWidth: '1440px', margin: '0 auto' }}>
      
      {/* SECTION 1: ASYMMETRIC CONTROLS */}
      <div className="asym-section">
        {/* Dominant Element */}
        <div className="asym-dominant-card" style={{ borderLeft: '4px solid var(--color-green)' }}>
          <div>
            <span className="text-label" style={{ color: 'var(--color-green-dark)' }}>Учёт посещаемости и табель</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '8px', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '32px', fontWeight: '900', color: 'var(--text-dark)' }}>
                {sessions.filter(s => s.attendance_status).length} из {sessions.length} занятий отмечено
              </h2>
              <p className="text-subtitle">
                После отметки посещаемости информация мгновенно рассчитывается и заносится в финансовый модуль и зарплатную ведомость.
              </p>
            </div>

            <div style={{
              display: 'flex',
              gap: '20px',
              padding: '12px 16px',
              background: 'var(--surface-subtle)',
              border: '1px solid var(--border-light)',
              borderRadius: 'var(--radius-sm)',
              marginBottom: '16px'
            }}>
              <div>
                <span className="text-label-muted" style={{ fontSize: '10px' }}>Присутствовали:</span>
                <div style={{ fontSize: '18px', fontWeight: '800', color: 'var(--color-green-dark)' }}>
                  {sessions.filter(s => s.attendance_status === 'present').length}
                </div>
              </div>
              <div style={{ borderLeft: '1px solid var(--border-medium)', paddingLeft: '16px' }}>
                <span className="text-label-muted" style={{ fontSize: '10px' }}>Пропуски:</span>
                <div style={{ fontSize: '18px', fontWeight: '800', color: 'var(--color-raspberry)' }}>
                  {sessions.filter(s => s.attendance_status === 'absent').length}
                </div>
              </div>
              <div style={{ borderLeft: '1px solid var(--border-medium)', paddingLeft: '16px' }}>
                <span className="text-label-muted" style={{ fontSize: '10px' }}>Ожидают отметки:</span>
                <div style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-secondary)' }}>
                  {sessions.filter(s => !s.attendance_status).length}
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button 
              onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
              className="btn-primary-cta"
            >
              <SvgIcon name="calendar" size={16} color="#FFFFFF" />
              <span>Перейти на сегодня</span>
            </button>
          </div>
        </div>

        {/* Secondary Date Picker Card */}
        <div className="asym-secondary-card">
          <span className="text-label-muted" style={{ marginBottom: '12px' }}>Выбор даты табеля</span>
          <div style={{ marginBottom: '16px' }}>
            <label className="text-label-muted" style={{ fontSize: '10px', display: 'block', marginBottom: '4px' }}>
              Дата занятий:
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="form-input"
            />
          </div>
          <div style={{ marginTop: 'auto', fontSize: '13px', color: 'var(--text-secondary)' }}>
            Специалист отмечает статус сразу после завершения сессии. Пропущенные занятия тарифицируются в зависимости от причины.
          </div>
        </div>
      </div>

      {successToast && (
        <div style={{
          background: 'var(--color-green-light)',
          border: '1px solid var(--color-green)',
          color: 'var(--color-green-dark)',
          padding: '12px 16px',
          borderRadius: 'var(--radius-sm)',
          marginBottom: '20px',
          fontWeight: '700'
        }}>
          {successToast}
        </div>
      )}

      {/* SECTION 2: SESSIONS TABLE */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <span className="text-label">Список занятий</span>
            <h3 className="text-h3" style={{ fontSize: '20px' }}>
              Сессии на выбранную дату ({selectedDate})
            </h3>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            Загрузка занятий...
          </div>
        ) : sessions.length === 0 ? (
          <div style={{
            background: 'var(--surface-white)',
            border: '1px solid var(--border-light)',
            padding: '40px',
            borderRadius: 'var(--radius-md)',
            textAlign: 'center',
            color: 'var(--text-secondary)'
          }}>
            На эту дату занятия не назначены.
          </div>
        ) : (
          <div style={{
            background: 'var(--surface-white)',
            border: '1px solid var(--border-light)',
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>ВРЕМЯ</th>
                  <th>РЕБЁНОК</th>
                  <th>СПЕЦИАЛИСТ</th>
                  <th>НАПРАВЛЕНИЕ</th>
                  <th>МЕД. ВНИМАНИЕ</th>
                  <th>ТЕКУЩИЙ СТАТУС</th>
                  <th>ДЕЙСТВИЕ</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map(s => (
                  <tr key={s.id}>
                    <td style={{ fontFamily: 'monospace', fontWeight: '800', color: 'var(--color-teal-dark)' }}>
                      {s.start_time} - {s.end_time}
                    </td>
                    <td>
                      <strong style={{ color: 'var(--text-dark)' }}>{s.child_name}</strong>
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>
                      {s.specialist_name}
                    </td>
                    <td>
                      <span style={{
                        background: 'var(--color-teal-light)',
                        color: 'var(--color-teal-dark)',
                        padding: '3px 8px',
                        borderRadius: 'var(--radius-xs)',
                        fontSize: '12px',
                        fontWeight: '600'
                      }}>
                        {s.direction}
                      </span>
                    </td>
                    <td>
                      {s.hasMedicalAlert ? (
                        <MedicalAlertBadge child={s} compact={true} />
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                    <td>
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: 'var(--radius-xs)',
                        fontSize: '11px',
                        fontWeight: '800',
                        textTransform: 'uppercase',
                        background: s.attendance_status === 'present' ? 'var(--color-green-light)' : 
                                    s.attendance_status === 'absent' ? 'var(--color-raspberry-light)' : 'var(--surface-subtle)',
                        color: s.attendance_status === 'present' ? 'var(--color-green-dark)' : 
                               s.attendance_status === 'absent' ? 'var(--color-raspberry-dark)' : 'var(--text-secondary)',
                        border: '1px solid var(--border-light)'
                      }}>
                        {statusRussianLabels[s.attendance_status] || 'Не отмечено'}
                      </span>
                    </td>
                    <td>
                      <button
                        onClick={() => handleOpenMarkModal(s)}
                        className="btn-secondary"
                        style={{ padding: '6px 12px', fontSize: '12px' }}
                      >
                        {s.attendance_status ? 'Изменить' : 'Отметить'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MARK ATTENDANCE MODAL */}
      {activeSession && (
        <Modal
          isOpen={!!activeSession}
          onClose={() => setActiveSession(null)}
          title={`Отметка посещаемости: ${activeSession.child_name}`}
          subtitle={`${activeSession.date} · ${activeSession.start_time} - ${activeSession.end_time} · Специалист: ${activeSession.specialist_name}`}
        >
          <form onSubmit={handleSaveAttendance}>
            {activeSession.hasMedicalAlert && (
              <div style={{ marginBottom: '14px' }}>
                <MedicalAlertBadge child={activeSession} />
              </div>
            )}

            <div style={{ marginBottom: '16px' }}>
              <label className="text-label-muted" style={{ display: 'block', marginBottom: '8px' }}>
                Выберите статус посещения:
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                {[
                  { id: 'present', label: 'Пришёл (Занятие проведено)', color: 'var(--color-green)' },
                  { id: 'absent', label: 'Не пришёл (Пропуск)', color: 'var(--color-raspberry)' },
                  { id: 'cancelled_center', label: 'Отменено центром', color: 'var(--color-gold)' },
                  { id: 'cancelled_parent', label: 'Отменено родителем', color: 'var(--color-blue)' },
                  { id: 'rescheduled', label: 'Перенесено', color: 'var(--color-teal)' }
                ].map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setStatus(item.id);
                      if (item.id === 'present') setIsBillable(true);
                      else if (item.id === 'absent') setIsBillable(true);
                      else setIsBillable(false);
                    }}
                    style={{
                      padding: '10px 12px',
                      background: status === item.id ? item.color : 'var(--surface-subtle)',
                      color: status === item.id ? '#FFFFFF' : 'var(--text-dark)',
                      border: '1px solid var(--border-medium)',
                      borderRadius: 'var(--radius-sm)',
                      fontWeight: status === item.id ? '800' : '600',
                      fontSize: '13px',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Billable Setting */}
            <div style={{
              background: 'var(--surface-subtle)',
              border: '1px solid var(--border-light)',
              padding: '12px 14px',
              borderRadius: 'var(--radius-sm)',
              marginBottom: '16px'
            }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={isBillable}
                  onChange={e => setIsBillable(e.target.checked)}
                />
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-dark)' }}>
                    Начислить оплату за занятие (Оплачиваемое)
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    Сумма: {activeSession.price?.toLocaleString('ru-RU')} ₸ (Доля центра 50% / Доля специалиста 50%)
                  </div>
                </div>
              </label>
            </div>

            {/* Notes */}
            <div style={{ marginBottom: '20px' }}>
              <label className="text-label-muted" style={{ display: 'block', marginBottom: '6px' }}>
                Комментарий к посещению / Заметки по занятию:
              </label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="form-textarea"
                rows={3}
                placeholder="Динамика ребёнка, реакция на упражнения, домашнее задание..."
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                type="button"
                onClick={() => setActiveSession(null)}
                className="btn-secondary"
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="btn-primary-cta"
              >
                {submitting ? 'Сохранение...' : 'Зафиксировать посещаемость'}
              </button>
            </div>
          </form>
        </Modal>
      )}

    </div>
  );
};
