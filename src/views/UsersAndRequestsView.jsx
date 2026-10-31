import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { SvgIcon } from '../components/icons/CustomIcons';
import { Modal } from '../components/Modal';

export const UsersAndRequestsView = () => {
  const { user, canManageUsers } = useAuth();
  const [users, setUsers] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [specialists, setSpecialists] = useState([]);
  const [loading, setLoading] = useState(true);

  // Approval modal state
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [assignRole, setAssignRole] = useState('specialist');
  const [linkSpecialistId, setLinkSpecialistId] = useState('');
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);

  // Direct employee creation modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    email: '',
    phone: '+7 ',
    password: 'password123',
    role: 'specialist',
    specialistId: ''
  });

  const [toastMessage, setToastMessage] = useState(null);

  useEffect(() => {
    fetchUsersData();
    fetchSpecialists();
  }, []);

  const fetchUsersData = async () => {
    setLoading(true);
    try {
      const [uRes, pRes] = await Promise.all([
        fetch('/api/users', {
          headers: { Authorization: `Bearer ${localStorage.getItem('asar_token')}` }
        }),
        fetch('/api/users/pending', {
          headers: { Authorization: `Bearer ${localStorage.getItem('asar_token')}` }
        })
      ]);

      const uData = await uRes.json();
      const pData = await pRes.json();

      setUsers(uData.users || []);
      setPendingRequests(pData.requests || []);
    } catch (err) {
      console.error('Error fetching users:', err);
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

  const handleOpenApproveModal = (reqItem) => {
    setSelectedRequest(reqItem);
    setAssignRole(reqItem.role || 'specialist');
    setLinkSpecialistId('');
    setIsApproveModalOpen(true);
  };

  const handleApprove = async (e) => {
    e.preventDefault();
    if (!selectedRequest) return;

    try {
      const res = await fetch('/api/users/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('asar_token')}`
        },
        body: JSON.stringify({
          userId: selectedRequest.id,
          assignedRole: assignRole,
          specialistId: linkSpecialistId || null
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка одобрения');

      setIsApproveModalOpen(false);
      setToastMessage(data.message);
      setTimeout(() => setToastMessage(null), 5000);
      fetchUsersData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleBlockUser = async (userId, currentStatus) => {
    const newStatus = currentStatus === 'blocked' ? 'active' : 'blocked';
    if (!confirm(`Вы действительно хотите изменить статус пользователя на «${newStatus}»?`)) return;

    try {
      const res = await fetch('/api/users/status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('asar_token')}`
        },
        body: JSON.stringify({ userId, status: newStatus })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка');

      fetchUsersData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleCreateEmployee = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/users/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('asar_token')}`
        },
        body: JSON.stringify(createForm)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка создания');

      setIsCreateModalOpen(false);
      setToastMessage(data.message);
      setTimeout(() => setToastMessage(null), 5000);
      fetchUsersData();
    } catch (err) {
      alert(err.message);
    }
  };

  if (!canManageUsers) {
    return (
      <div style={{ padding: '60px 32px', textAlign: 'center' }}>
        <h2 style={{ color: 'var(--brand-accent)' }}>Доступ ограничен</h2>
        <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>
          Управление пользователями и заявками доступно только Владельцу и Руководителю центра.
        </p>
      </div>
    );
  }

  const roleRussianLabels = {
    owner: 'Владелец центра',
    director: 'Руководитель',
    admin: 'Администратор',
    specialist: 'Специалист'
  };

  return (
    <div style={{ padding: '24px 32px', maxWidth: '1440px', margin: '0 auto' }}>

      {/* SECTION 1: ASYMMETRIC OVERVIEW */}
      <div className="asym-section">
        {/* Dominant Element (3fr) */}
        <div className="asym-dominant-card" style={{ borderLeft: '4px solid var(--color-raspberry)' }}>
          <div>
            <span className="text-label" style={{ color: 'var(--color-raspberry)' }}>Модуль доступа и авторизации</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap-tight)', marginTop: '8px', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '32px', fontWeight: '900', color: 'var(--text-bright)' }}>
                {pendingRequests.length} заявок на регистрацию
              </h2>
              <p className="text-subtitle" style={{ fontSize: '16px' }}>
                Пользователи получают доступ к рабочей части CRM только после подтверждения руководством и назначения роли.
              </p>
            </div>

            <div style={{
              display: 'flex',
              gap: '20px',
              padding: '14px 18px',
              background: 'var(--surface-secondary)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
              marginBottom: '20px'
            }}>
              <div>
                <span className="text-label-muted" style={{ fontSize: '10px' }}>Ожидают одобрения:</span>
                <div style={{ fontSize: '18px', fontWeight: '800', color: pendingRequests.length > 0 ? 'var(--color-raspberry)' : 'var(--text-bright)' }}>
                  {pendingRequests.length} человек
                </div>
              </div>
              <div style={{ borderLeft: '1px solid var(--border-subtle)', paddingLeft: '20px' }}>
                <span className="text-label-muted" style={{ fontSize: '10px' }}>Всего пользователей в системе:</span>
                <div style={{ fontSize: '18px', fontWeight: '800', color: 'var(--color-teal)' }}>
                  {users.length} аккаунтов
                </div>
              </div>
            </div>
          </div>

          <div>
            <button onClick={() => setIsCreateModalOpen(true)} className="btn-primary-cta">
              <SvgIcon name="plus" size={16} color="#FFFFFF" />
              <span>Создать сотрудника напрямую</span>
            </button>
          </div>
        </div>

        {/* Secondary RBAC Rules Card (2fr) */}
        <div className="asym-secondary-card" style={{ borderTop: '3px solid var(--color-blue)' }}>
          <span className="text-label-muted" style={{ marginBottom: '12px' }}>Матрица прав доступа (RBAC)</span>
          <div style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.6 }}>
            <p><strong style={{ color: 'var(--color-gold)' }}>1. Владелец:</strong> полный доступ, прибыль, управление ролями и всеми финансами.</p>
            <p style={{ marginTop: '6px' }}><strong style={{ color: 'var(--color-raspberry)' }}>2. Руководитель:</strong> табель, расписание, одобрение заявок, зарплаты специалистов.</p>
            <p style={{ marginTop: '6px' }}><strong style={{ color: 'var(--color-blue)' }}>3. Администратор:</strong> операционный ввод расписания, приём оплат.</p>
            <p style={{ marginTop: '6px' }}><strong style={{ color: 'var(--color-teal)' }}>4. Специалист:</strong> персональный табель и карточки только своих детей.</p>
          </div>
        </div>
      </div>

      {toastMessage && (
        <div style={{
          background: 'var(--color-green-light)',
          border: '1px solid var(--color-green)',
          color: 'var(--color-green)',
          padding: '12px 16px',
          borderRadius: '8px',
          marginBottom: '20px',
          fontWeight: '700'
        }}>
          {toastMessage}
        </div>
      )}

      {/* SECTION 2: PENDING REGISTRATION REQUESTS */}
      <div style={{ marginBottom: 'var(--margin-section)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap-tight)' }}>
            <span className="text-label" style={{ color: 'var(--color-raspberry)' }}>Новые заявки</span>
            <h3 className="text-h3" style={{ fontSize: '22px' }}>
              Заявки на регистрацию в CRM ({pendingRequests.length})
            </h3>
          </div>
        </div>

        {pendingRequests.length === 0 ? (
          <div style={{
            background: 'var(--surface-primary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '10px',
            padding: '28px',
            textAlign: 'center',
            color: 'var(--text-secondary)'
          }}>
            Все поступившие заявки обработаны. Ожидающих пользователей нет.
          </div>
        ) : (
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
                  <th>ИМЯ КАНДИДАТА</th>
                  <th>КОНТАКТ (EMAIL / ТЕЛЕФОН)</th>
                  <th>ДАТА ПОДАЧИ</th>
                  <th>СТАТУС</th>
                  <th>ДЕЙСТВИЕ</th>
                </tr>
              </thead>
              <tbody>
                {pendingRequests.map(req => (
                  <tr key={req.id}>
                    <td>
                      <strong style={{ color: 'var(--text-bright)', fontSize: '15px' }}>{req.name}</strong>
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>
                      {req.email || req.phone}
                    </td>
                    <td style={{ fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                      {req.created_at ? req.created_at.substring(0, 16) : '—'}
                    </td>
                    <td>
                      <span style={{
                        padding: '4px 10px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: '800',
                        textTransform: 'uppercase',
                        background: 'var(--color-pink)',
                        color: 'var(--color-raspberry)',
                        border: '1px solid rgba(200, 63, 120, 0.3)'
                      }}>
                        Ожидает одобрения
                      </span>
                    </td>
                    <td>
                      <button
                        onClick={() => handleOpenApproveModal(req)}
                        className="btn-primary-cta"
                        style={{ padding: '6px 14px', fontSize: '12px' }}
                      >
                        Одобрить и назначить роль
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SECTION 3: ALL USERS LIST */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap-tight)' }}>
            <span className="text-label" style={{ color: 'var(--color-teal)' }}>Реестр учётных записей</span>
            <h3 className="text-h3" style={{ fontSize: '20px' }}>
              Все пользователи системы ({users.length})
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
                <th>ИМЯ</th>
                <th>РОЛЬ В СИСТЕМЕ</th>
                <th>КОНТАКТ</th>
                <th>СПЕЦИАЛИЗАЦИЯ</th>
                <th>СТАТУС</th>
                <th>БЛОКИРОВКА</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => {
                const roleStyles = {
                  owner: { bg: 'var(--color-gold-light)', color: 'var(--color-gold)', border: 'rgba(232, 188, 85, 0.3)' },
                  director: { bg: 'var(--color-pink)', color: 'var(--color-raspberry)', border: 'rgba(200, 63, 120, 0.3)' },
                  admin: { bg: 'var(--color-blue-light)', color: 'var(--color-blue)', border: 'rgba(104, 184, 229, 0.3)' },
                  specialist: { bg: 'var(--color-teal-light)', color: 'var(--color-teal)', border: 'rgba(56, 185, 173, 0.3)' }
                }[u.role] || { bg: 'var(--surface-secondary)', color: 'var(--text-primary)', border: 'var(--border-subtle)' };

                return (
                  <tr key={u.id}>
                    <td>
                      <strong style={{ color: 'var(--text-bright)' }}>{u.name}</strong>
                    </td>
                    <td>
                      <span style={{
                        padding: '3px 10px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: '700',
                        background: roleStyles.bg,
                        color: roleStyles.color,
                        border: `1px solid ${roleStyles.border}`
                      }}>
                        {roleRussianLabels[u.role] || u.role}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                      {u.email || u.phone}
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                      {u.specialty || '—'}
                    </td>
                    <td>
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: '700',
                        background: u.status === 'active' ? 'var(--color-green-light)' : u.status === 'blocked' ? 'var(--color-pink)' : 'var(--color-gold-light)',
                        color: u.status === 'active' ? 'var(--color-green)' : u.status === 'blocked' ? 'var(--color-raspberry)' : 'var(--color-gold)'
                      }}>
                        {u.status === 'active' ? 'Активен' : u.status === 'blocked' ? 'Заблокирован' : 'Ожидает'}
                      </span>
                    </td>
                    <td>
                      {u.role !== 'owner' && (
                        <button
                          onClick={() => handleBlockUser(u.id, u.status)}
                          className="btn-secondary"
                          style={{
                            padding: '4px 10px',
                            fontSize: '11px',
                            color: u.status === 'blocked' ? 'var(--color-teal)' : 'var(--color-raspberry)'
                          }}
                        >
                          {u.status === 'blocked' ? 'Разблокировать' : 'Заблокировать'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* APPROVE REGISTRATION MODAL */}
      {selectedRequest && (
        <Modal
          isOpen={isApproveModalOpen}
          onClose={() => setIsApproveModalOpen(false)}
          title={`Одобрение заявки: ${selectedRequest.name}`}
          subtitle={`${selectedRequest.email || selectedRequest.phone} · Назначение уровня доступа`}
        >
          <form onSubmit={handleApprove}>
            <div style={{ marginBottom: '16px' }}>
              <label className="text-label-muted">Назначить роль в системе:</label>
              <select
                value={assignRole}
                onChange={e => setAssignRole(e.target.value)}
                className="form-select"
                required
              >
                <option value="specialist">Специалист (Ограниченный доступ к своим детям)</option>
                <option value="admin">Администратор (Расписание, дети, приём оплат)</option>
                <option value="director">Руководитель центра (Практически полный доступ)</option>
                {user.role === 'owner' && (
                  <option value="owner">Владелец центра (Полный доступ ко всей бухгалтерии)</option>
                )}
              </select>
            </div>

            {assignRole === 'specialist' && (
              <div style={{ marginBottom: '20px' }}>
                <label className="text-label-muted">Связать с профилем специалиста:</label>
                <select
                  value={linkSpecialistId}
                  onChange={e => setLinkSpecialistId(e.target.value)}
                  className="form-select"
                >
                  <option value="">Не привязывать (создать новый позже)</option>
                  {specialists.map(sp => (
                    <option key={sp.id} value={sp.id}>{sp.full_name} ({sp.specialty})</option>
                  ))}
                </select>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button type="button" onClick={() => setIsApproveModalOpen(false)} className="btn-secondary">
                Отмена
              </button>
              <button type="submit" className="btn-primary-cta">
                Одобрить и предоставить доступ
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* DIRECT EMPLOYEE CREATION MODAL */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Создание сотрудника"
        subtitle="Добавление учётной записи непосредственно из панели управления"
      >
        <form onSubmit={handleCreateEmployee}>
          <div style={{ marginBottom: '14px' }}>
            <label className="text-label-muted">ФИО сотрудника:</label>
            <input
              type="text"
              value={createForm.name}
              onChange={e => setCreateForm({ ...createForm, name: e.target.value })}
              className="form-input"
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
            <div>
              <label className="text-label-muted">Email:</label>
              <input
                type="email"
                value={createForm.email}
                onChange={e => setCreateForm({ ...createForm, email: e.target.value })}
                className="form-input"
              />
            </div>
            <div>
              <label className="text-label-muted">Телефон:</label>
              <input
                type="text"
                value={createForm.phone}
                onChange={e => setCreateForm({ ...createForm, phone: e.target.value })}
                className="form-input"
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
            <div>
              <label className="text-label-muted">Пароль:</label>
              <input
                type="text"
                value={createForm.password}
                onChange={e => setCreateForm({ ...createForm, password: e.target.value })}
                className="form-input"
                required
              />
            </div>
            <div>
              <label className="text-label-muted">Роль:</label>
              <select
                value={createForm.role}
                onChange={e => setCreateForm({ ...createForm, role: e.target.value })}
                className="form-select"
              >
                <option value="specialist">Специалист</option>
                <option value="admin">Администратор</option>
                <option value="director">Руководитель</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button type="button" onClick={() => setIsCreateModalOpen(false)} className="btn-secondary">
              Отмена
            </button>
            <button type="submit" className="btn-primary-cta">
              Создать сотрудника
            </button>
          </div>
        </form>
      </Modal>

    </div>
  );
};
