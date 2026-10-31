import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { SvgIcon } from '../components/icons/CustomIcons';
import { MedicalAlertBadge } from '../components/MedicalAlertBadge';

export const DashboardView = ({ onNavigate }) => {
  const { user, canAccessAccounting } = useAuth();
  const [finance, setFinance] = useState(null);
  const [childrenList, setChildrenList] = useState([]);
  const [todaySessions, setTodaySessions] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, [user]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const todayStr = new Date().toISOString().split('T')[0];

      // Fetch sessions for today
      const sessRes = await fetch(`/api/schedule?startDate=${todayStr}&endDate=${todayStr}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('asar_token')}` }
      });
      const sessData = await sessRes.json();
      setTodaySessions(sessData.sessions || []);

      // Fetch children
      const childRes = await fetch('/api/children', {
        headers: { Authorization: `Bearer ${localStorage.getItem('asar_token')}` }
      });
      const childData = await childRes.json();
      setChildrenList(childData.children || []);

      // Fetch finance summary if authorized
      if (canAccessAccounting) {
        const finRes = await fetch('/api/finance/summary', {
          headers: { Authorization: `Bearer ${localStorage.getItem('asar_token')}` }
        });
        const finData = await finRes.json();
        setFinance(finData.summary);
      }

      // Fetch pending registration requests if owner/director
      if (['owner', 'director'].includes(user?.role)) {
        const reqRes = await fetch('/api/users/pending', {
          headers: { Authorization: `Bearer ${localStorage.getItem('asar_token')}` }
        });
        const reqData = await reqRes.json();
        setPendingRequests(reqData.requests || []);
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const childrenWithAlerts = childrenList.filter(c => c.hasMedicalAlert);

  return (
    <div style={{ padding: '28px 32px', maxWidth: '1440px', margin: '0 auto' }}>
      
      {/* SECTION 1: ASYMMETRIC OVERVIEW */}
      <div className="asym-section">
        {/* Dominant Element (3fr) */}
        <div className="asym-dominant-card">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="text-label">Ключевой показатель центра</span>
                <span style={{
                  background: 'var(--color-teal-light)',
                  color: 'var(--color-teal-dark)',
                  fontSize: '11px',
                  fontWeight: '700',
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-full)'
                }}>
                  Октябрь 2026
                </span>
              </div>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Asia/Almaty</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '18px' }}>
              <h2 style={{ fontSize: '38px', fontWeight: '900', color: 'var(--text-dark)', letterSpacing: '-0.02em' }}>
                {canAccessAccounting && finance
                  ? `${(finance.month?.month_gross || 0).toLocaleString('ru-RU')} ₸`
                  : `${todaySessions.length} занятий сегодня`}
              </h2>
              <div className="text-subtitle">
                {canAccessAccounting 
                  ? 'Совокупная выручка центра за текущий месяц (100% подтверждено табелем)' 
                  : `Текущая загрузка специалистов на сегодня: ${todaySessions.length} слотов`}
              </div>
            </div>

            {/* Financial Breakdown Pills */}
            {canAccessAccounting && finance && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '12px',
                padding: '16px',
                background: 'var(--surface-subtle)',
                border: '1px solid var(--border-light)',
                borderRadius: 'var(--radius-sm)',
                marginBottom: '20px'
              }}>
                <div>
                  <div className="text-label-muted" style={{ fontSize: '10px' }}>Чистая доля центра (50%)</div>
                  <div style={{ fontSize: '18px', fontWeight: '800', color: 'var(--color-teal)', marginTop: '2px' }}>
                    {(finance.month?.month_center || 0).toLocaleString('ru-RU')} ₸
                  </div>
                </div>
                <div>
                  <div className="text-label-muted" style={{ fontSize: '10px' }}>Фонд специалистов (50%)</div>
                  <div style={{ fontSize: '18px', fontWeight: '800', color: 'var(--color-green-dark)', marginTop: '2px' }}>
                    {(finance.month?.month_specialist || 0).toLocaleString('ru-RU')} ₸
                  </div>
                </div>
                <div>
                  <div className="text-label-muted" style={{ fontSize: '10px' }}>Остаток к выплате</div>
                  <div style={{ fontSize: '18px', fontWeight: '800', color: 'var(--color-gold-dark)', marginTop: '2px' }}>
                    {(finance.outstandingPayroll || 0).toLocaleString('ru-RU')} ₸
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Primary Action Buttons */}
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button 
              onClick={() => onNavigate('schedule')}
              className="btn-primary-cta"
            >
              <SvgIcon name="calendar" size={16} color="#FFFFFF" />
              <span>Интерактивное расписание</span>
            </button>
            {canAccessAccounting && (
              <button 
                onClick={() => onNavigate('accounting')}
                className="btn-secondary"
              >
                <span>Бухгалтерский отчёт</span>
              </button>
            )}
          </div>
        </div>

        {/* Secondary Subordinate Cards Stack (2fr) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          
          {/* Card 1: Children - Golden Yellow Theme */}
          <div 
            className="asym-secondary-card" 
            onClick={() => onNavigate('children')} 
            style={{ cursor: 'pointer', borderLeft: '4px solid var(--color-gold)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="text-label-muted" style={{ color: 'var(--color-gold-dark)' }}>База воспитанников</span>
              <div style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                background: 'var(--color-gold-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <SvgIcon name="child" size={15} color="var(--color-gold-dark)" />
              </div>
            </div>
            <div style={{ fontSize: '26px', fontWeight: '800', color: 'var(--text-dark)', marginTop: '4px' }}>
              {childrenList.length} детей
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              {childrenWithAlerts.length} требуют особого медицинского контроля (астма / аллергии)
            </div>
          </div>

          {/* Card 2: Today Sessions & Attendance - Green Theme */}
          <div 
            className="asym-secondary-card" 
            onClick={() => onNavigate('attendance')} 
            style={{ cursor: 'pointer', borderLeft: '4px solid var(--color-green)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="text-label-muted" style={{ color: 'var(--color-green-dark)' }}>Занятия сегодня</span>
              <div style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                background: 'var(--color-green-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <SvgIcon name="check" size={15} color="var(--color-green-dark)" />
              </div>
            </div>
            <div style={{ fontSize: '26px', fontWeight: '800', color: 'var(--text-dark)', marginTop: '4px' }}>
              {todaySessions.length} слотов
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Отмечено в табеле: {todaySessions.filter(s => s.attendance_status).length} из {todaySessions.length}
            </div>
          </div>

          {/* Card 3: Pending Registration Requests - Raspberry Theme */}
          {['owner', 'director'].includes(user?.role) && (
            <div 
              className="asym-secondary-card" 
              onClick={() => onNavigate('users')} 
              style={{ cursor: 'pointer', borderLeft: '4px solid var(--color-raspberry)' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="text-label-muted" style={{ color: 'var(--color-raspberry)' }}>Заявки на регистрацию</span>
                <div style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  background: 'var(--color-raspberry-light)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <SvgIcon name="users" size={15} color="var(--color-raspberry)" />
                </div>
              </div>
              <div style={{ fontSize: '26px', fontWeight: '800', color: pendingRequests.length > 0 ? 'var(--color-raspberry)' : 'var(--text-dark)', marginTop: '4px' }}>
                {pendingRequests.length} ожидают
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                {pendingRequests.length > 0 ? 'Требуется подтверждение руководства' : 'Все кандидаты рассмотрены'}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* SECTION 2: MEDICAL ALERTS (Raspberry / Pink Healthcare Theme) */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginBottom: '14px' }}>
          <span className="text-label-raspberry">Медицинский контроль центра</span>
          <h3 className="text-h3" style={{ fontSize: '20px' }}>
            Особые медицинские протоколы (Астма / Эпилепсия / Аллергия)
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            Специалисты обязаны сверить протокол перед началом каждого индивидуального занятия.
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
          gap: '16px'
        }}>
          {childrenWithAlerts.slice(0, 3).map((child) => (
            <div 
              key={child.id}
              style={{
                background: 'var(--surface-white)',
                border: '1px solid var(--border-light)',
                borderLeft: '4px solid var(--color-raspberry)',
                padding: '16px',
                borderRadius: 'var(--radius-sm)',
                boxShadow: 'var(--shadow-sm)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                <h4 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-dark)' }}>
                  {child.full_name}
                </h4>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{child.ageLabel}</span>
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-main)', marginBottom: '8px' }}>
                {child.diagnosis || 'Коррекционная программа'}
              </div>
              <MedicalAlertBadge child={child} />
            </div>
          ))}
        </div>
      </div>

      {/* SECTION 3: UPCOMING SCHEDULE FOR TODAY */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '14px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <span className="text-label">Оперативный план</span>
            <h3 className="text-h3" style={{ fontSize: '20px' }}>
              Расписание занятий на сегодня
            </h3>
          </div>
          <button onClick={() => onNavigate('schedule')} className="btn-secondary" style={{ fontSize: '13px' }}>
            Открыть полную сетку →
          </button>
        </div>

        {todaySessions.length === 0 ? (
          <div style={{
            background: 'var(--surface-white)',
            border: '1px solid var(--border-light)',
            padding: '32px',
            borderRadius: 'var(--radius-sm)',
            textAlign: 'center',
            color: 'var(--text-secondary)'
          }}>
            На сегодня занятий не запланировано или все слоты завершены.
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
                  <th>СТАТУС</th>
                </tr>
              </thead>
              <tbody>
                {todaySessions.slice(0, 6).map((s) => (
                  <tr key={s.id}>
                    <td style={{ fontWeight: '700', fontFamily: 'monospace', color: 'var(--color-teal-dark)' }}>
                      {s.start_time} - {s.end_time}
                    </td>
                    <td style={{ fontWeight: '700', color: 'var(--text-dark)' }}>
                      {s.child_name}
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
                        <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>—</span>
                      )}
                    </td>
                    <td>
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: 'var(--radius-xs)',
                        fontSize: '11px',
                        fontWeight: '700',
                        textTransform: 'uppercase',
                        background: s.attendance_status === 'present' ? 'var(--color-green-light)' : 'var(--surface-subtle)',
                        color: s.attendance_status === 'present' ? 'var(--color-green-dark)' : 'var(--text-secondary)',
                        border: '1px solid var(--border-light)'
                      }}>
                        {s.attendance_status ? (s.attendance_status === 'present' ? 'Пришёл' : s.attendance_status) : 'Запланировано'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};
