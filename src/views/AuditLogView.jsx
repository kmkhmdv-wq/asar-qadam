import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { SvgIcon } from '../components/icons/CustomIcons';

export const AuditLogView = () => {
  const { user, canManageUsers } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/audit?limit=100', {
        headers: { Authorization: `Bearer ${localStorage.getItem('asar_token')}` }
      });
      const data = await res.json();
      setLogs(data.logs || []);
    } catch (err) {
      console.error('Error fetching audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!canManageUsers) {
    return (
      <div style={{ padding: '60px 32px', textAlign: 'center' }}>
        <h2 style={{ color: 'var(--brand-accent)' }}>Доступ ограничен</h2>
        <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>
          Журнал аудита доступен только Владельцу и Руководителю центра.
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px 32px', maxWidth: '1440px', margin: '0 auto' }}>

      {/* SECTION 1: ASYMMETRIC HEADER */}
      <div className="asym-section">
        {/* Dominant Element (3fr) */}
        <div className="asym-dominant-card" style={{ borderLeft: '4px solid var(--color-blue)' }}>
          <div>
            <span className="text-label" style={{ color: 'var(--color-blue)' }}>Безопасность и сохранность данных</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap-tight)', marginTop: '8px', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '32px', fontWeight: '900', color: 'var(--text-bright)' }}>
                {logs.length} зарегистрированных системных событий
              </h2>
              <p className="text-subtitle" style={{ fontSize: '16px' }}>
                Все важные действия (создание детей, перенос занятий, отметки табеля, выплаты зарплат и запросы AI) фиксируются в неизменяемом журнале.
              </p>
            </div>

            <div style={{
              display: 'flex',
              gap: '20px',
              padding: '14px 18px',
              background: 'var(--surface-secondary)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
              marginBottom: '16px'
            }}>
              <div>
                <span className="text-label-muted" style={{ fontSize: '10px' }}>Хранилище:</span>
                <div style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-bright)' }}>
                  SQLite WAL + Foreign Keys
                </div>
              </div>
              <div style={{ borderLeft: '1px solid var(--border-subtle)', paddingLeft: '20px' }}>
                <span className="text-label-muted" style={{ fontSize: '10px' }}>Финансовые транзакции:</span>
                <div style={{ fontSize: '16px', fontWeight: '800', color: 'var(--color-green)' }}>
                  Неизменяемый реестр
                </div>
              </div>
            </div>
          </div>

          <div>
            <button onClick={fetchLogs} className="btn-primary-cta">
              <SvgIcon name="audit" size={16} color="#FFFFFF" />
              <span>Обновить журнал событий</span>
            </button>
          </div>
        </div>

        {/* Secondary Info Card (2fr) */}
        <div className="asym-secondary-card" style={{ borderTop: '3px solid var(--color-gold)' }}>
          <span className="text-label-muted" style={{ marginBottom: '12px' }}>Политика аудита и защиты</span>
          <div style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.6 }}>
            <p>• Финансовые операции нельзя бесследно стереть: используются корректировочные проводки.</p>
            <p style={{ marginTop: '6px' }}>• Защита персональных и медицинских данных детей (доступ только закреплённым специалистам).</p>
            <p style={{ marginTop: '6px' }}>• Автоматическое хеширование паролей (Bcrypt salt 10).</p>
          </div>
        </div>
      </div>

      {/* SECTION 2: AUDIT LOGS TABLE */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap-tight)' }}>
            <span className="text-label" style={{ color: 'var(--color-teal)' }}>Протокол действий</span>
            <h3 className="text-h3" style={{ fontSize: '20px' }}>
              Хронологическая лента аудита
            </h3>
          </div>
        </div>

        <div style={{
          background: 'var(--surface-primary)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '10px',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-subtle)'
        }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>ВРЕМЯ</th>
                <th>СОТРУДНИК / РОЛЬ</th>
                <th>ДЕЙСТВИЕ</th>
                <th>СУЩНОСТЬ</th>
                <th>ПОДРОБНОСТИ</th>
                <th>IP АДРЕС</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr key={log.id}>
                  <td style={{ fontFamily: 'monospace', fontSize: '12px', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>
                    {log.created_at}
                  </td>
                  <td>
                    <div>
                      <strong style={{ color: 'var(--text-bright)' }}>{log.user_name || 'Система'}</strong>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--color-teal)', fontWeight: '700', textTransform: 'uppercase' }}>
                      {log.user_role}
                    </div>
                  </td>
                  <td>
                    <span style={{
                      padding: '3px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: '800',
                      background: 'var(--color-teal-light)',
                      color: 'var(--color-teal)',
                      border: '1px solid rgba(56, 185, 173, 0.25)'
                    }}>
                      {log.action}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                    {log.entity_type} {log.entity_id ? `#${log.entity_id}` : ''}
                  </td>
                  <td style={{ color: 'var(--text-primary)', fontSize: '13px' }}>
                    {log.details}
                  </td>
                  <td style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--text-muted)' }}>
                    {log.ip_address}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
