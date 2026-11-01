import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { SvgIcon } from '../components/icons/CustomIcons';
import { Modal } from '../components/Modal';

export const UsersAndRequestsView = () => {
  const { user, canManageUsers, reloadUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [specialists, setSpecialists] = useState([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

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
    specialistId: '',
    branch: 'Астана — Центр'
  });

  // Edit employee modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({
    first_name: '',
    last_name: '',
    middle_name: '',
    email: '',
    phone: '',
    role: 'specialist',
    branch: 'Астана — Центр',
    specialty: ''
  });

  // Reset password modal
  const [isResetPwdModalOpen, setIsResetPwdModalOpen] = useState(false);
  const [resetTargetUser, setResetTargetUser] = useState(null);
  const [newPasswordVal, setNewPasswordVal] = useState('AsarQadam2026!');

  const [showTestAccounts, setShowTestAccounts] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchUsersData(showTestAccounts);
    fetchSpecialists();
  }, [showTestAccounts]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 5000);
  };

  const fetchUsersData = async (includeTest = showTestAccounts) => {
    setLoading(true);
    try {
      const [uRes, pRes] = await Promise.all([
        fetch(`/api/users?include_test=${includeTest ? 'true' : 'false'}`, {
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

  // 1. Dynamic Role Change (Instant Promotion / Demotion in Supabase)
  const handleFastRoleChange = async (targetUser, newRole) => {
    if (targetUser.role === newRole) return;

    if (targetUser.role === 'owner' && user?.role !== 'owner') {
      alert('Только Владелец может управлять ролью Владельца');
      return;
    }
    if (newRole === 'director' && user?.role !== 'owner') {
      alert('Только Владелец может назначать роль Руководителя');
      return;
    }

    const previousRole = targetUser.role;

    // Optimistic UI update
    setUsers(prev => prev.map(u => u.id === targetUser.id ? { ...u, role: newRole } : u));

    try {
      const res = await fetch(`/api/users/${targetUser.id}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('asar_token')}`
        },
        body: JSON.stringify({ role: newRole })
      });

      const data = await res.json();
      if (!res.ok) {
        // Rollback on error
        setUsers(prev => prev.map(u => u.id === targetUser.id ? { ...u, role: previousRole } : u));
        throw new Error(data.error || 'Ошибка изменения роли');
      }

      showToast(data.message || `Роль сотрудника ${targetUser.name} обновлена на «${roleRussianLabels[newRole] || newRole}»`);

      // If user modified their own role, refresh context immediately
      if (targetUser.id === user?.id && reloadUser) {
        reloadUser();
      }

      fetchUsersData();
    } catch (err) {
      alert(err.message);
    }
  };

  // 2. Open Edit Employee Modal
  const handleOpenEdit = (emp) => {
    setEditingUser(emp);
    setEditForm({
      first_name: emp.first_name || '',
      last_name: emp.last_name || '',
      middle_name: emp.middle_name || '',
      email: emp.email || '',
      phone: emp.phone || '',
      role: emp.role || 'specialist',
      branch: emp.branch || 'Астана — Центр',
      specialty: emp.specialty || ''
    });
    setIsEditModalOpen(true);
  };

  // 3. Submit Edit Employee
  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingUser) return;
    setActionLoading(true);

    try {
      const res = await fetch(`/api/users/${editingUser.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('asar_token')}`
        },
        body: JSON.stringify(editForm)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка обновления данных');

      setIsEditModalOpen(false);
      showToast(data.message || 'Данные сотрудника успешно обновлены в Supabase');

      if (editingUser.id === user?.id && reloadUser) {
        reloadUser();
      }

      fetchUsersData();
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // 4. Reset Password
  const handleOpenResetPwd = (emp) => {
    setResetTargetUser(emp);
    setNewPasswordVal('AsarQadam2026!');
    setIsResetPwdModalOpen(true);
  };

  const handleExecuteResetPassword = async (e) => {
    e.preventDefault();
    if (!resetTargetUser) return;

    try {
      const res = await fetch(`/api/users/${resetTargetUser.id}/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('asar_token')}`
        },
        body: JSON.stringify({ new_password: newPasswordVal })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка сброса пароля');

      setIsResetPwdModalOpen(false);
      showToast(data.message);
    } catch (err) {
      alert(err.message);
    }
  };

  // 5. Block / Unblock User
  const handleToggleBlock = async (emp) => {
    const newStatus = emp.status === 'blocked' ? 'active' : 'blocked';
    const actionLabel = newStatus === 'blocked' ? 'заблокировать' : 'разблокировать';

    // Optimistic UI update
    setUsers(prev => prev.map(u => u.id === emp.id ? { ...u, status: newStatus } : u));

    try {
      const res = await fetch('/api/users/status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('asar_token')}`
        },
        body: JSON.stringify({ userId: emp.id, status: newStatus })
      });
      const data = await res.json();
      if (!res.ok) {
        setUsers(prev => prev.map(u => u.id === emp.id ? { ...u, status: emp.status } : u));
        throw new Error(data.error || 'Ошибка');
      }

      showToast(`Сотрудник ${emp.name} ${newStatus === 'blocked' ? 'заблокирован' : 'активирован'}`);
      fetchUsersData();
    } catch (err) {
      alert(err.message);
    }
  };

  // 6. Direct Employee Creation
  const handleCreateEmployee = async (e) => {
    e.preventDefault();
    setActionLoading(true);
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
      showToast(data.message || 'Сотрудник успешно создан в системе');
      fetchUsersData();
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // 7. Approve Registration Request
  const handleOpenApproveModal = (reqItem) => {
    setSelectedRequest(reqItem);
    setAssignRole(reqItem.role || 'specialist');
    setLinkSpecialistId('');
    setIsApproveModalOpen(true);
  };

  const handleApprove = async (e) => {
    e.preventDefault();
    if (!selectedRequest) return;
    setActionLoading(true);

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
      showToast(data.message || 'Заявка одобрена, сотрудник активирован в CRM');
      fetchUsersData();
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  if (!canManageUsers) {
    return (
      <div style={{ padding: '60px 32px', textAlign: 'center' }}>
        <h2 style={{ color: '#F47920' }}>Доступ ограничен</h2>
        <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>
          Раздел «Команда и роли» доступен только Руководителю, Администратору и Владельцу центра.
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

  const roleBadgeStyles = {
    owner: { bg: 'var(--color-gold-light)', color: 'var(--color-gold-dark)', border: '1px solid var(--color-gold)' },
    director: { bg: 'var(--color-raspberry-light)', color: 'var(--color-raspberry-dark)', border: '1px solid var(--color-raspberry)' },
    admin: { bg: 'var(--color-blue-light)', color: 'var(--color-blue-dark)', border: '1px solid var(--color-blue)' },
    specialist: { bg: 'var(--color-teal-light)', color: 'var(--color-teal-dark)', border: '1px solid var(--color-teal)' }
  };

  // Filter & Search logic
  const filteredUsers = users.filter(u => {
    const matchesSearch = 
      (u.name && u.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (u.email && u.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (u.phone && u.phone.includes(searchQuery));

    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const realUsers = users.filter(u => !u.is_test);
  const countSpecialists = realUsers.filter(u => u.role === 'specialist').length;
  const countDirectors = realUsers.filter(u => u.role === 'director').length;
  const countAdmins = realUsers.filter(u => u.role === 'admin').length;

  return (
    <div style={{ padding: '24px 32px', maxWidth: '1440px', margin: '0 auto' }}>
      
      {/* Toast Notification */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '24px',
          background: 'var(--surface-white)',
          border: '2px solid #F47920',
          color: 'var(--text-dark)',
          padding: '14px 20px',
          borderRadius: '10px',
          boxShadow: '0 8px 30px rgba(0, 0, 0, 0.25)',
          zIndex: 10002,
          fontWeight: '700',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <SvgIcon name="check" size={18} color="#F47920" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* SECTION 1: ASYMMETRIC DOMINANT OVERVIEW */}
      <div className="asym-section">
        {/* Dominant Element (3fr) */}
        <div className="asym-dominant-card" style={{ borderLeft: '4px solid #F47920' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <span className="text-label" style={{ color: '#F47920' }}>Команда Asar Qadam & Динамический RBAC</span>
              <span style={{
                background: 'rgba(244, 121, 32, 0.12)',
                color: '#F47920',
                fontSize: '11px',
                fontWeight: '800',
                padding: '2px 8px',
                borderRadius: 'var(--radius-full)'
              }}>
                Ролевая модель
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '6px', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '34px', fontWeight: '900', color: 'var(--text-dark)', letterSpacing: '-0.02em' }}>
                {realUsers.length} активных сотрудников
              </h2>
              <p className="text-subtitle">
                Динамическое управление правами: изменение роли сотрудника мгновенно активирует соответствующие права и обновляет интерфейс без необходимости повторной регистрации.
              </p>
            </div>

            {/* Role Breakdown Stat Pills */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '12px',
              padding: '14px 16px',
              background: 'var(--surface-subtle)',
              border: '1px solid var(--border-light)',
              borderRadius: 'var(--radius-sm)',
              marginBottom: '20px'
            }}>
              <div>
                <span className="text-label-muted" style={{ fontSize: '10px' }}>Специалисты (Терапевты):</span>
                <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--color-teal)', marginTop: '2px' }}>
                  {countSpecialists}
                </div>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Свои дети и табель</span>
              </div>
              <div>
                <span className="text-label-muted" style={{ fontSize: '10px' }}>Администраторы:</span>
                <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--color-blue-dark)', marginTop: '2px' }}>
                  {countAdmins}
                </div>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Расписание, биллинг, дети</span>
              </div>
              <div>
                <span className="text-label-muted" style={{ fontSize: '10px' }}>Руководство филиала:</span>
                <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--color-raspberry)', marginTop: '2px' }}>
                  {countDirectors}
                </div>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Аналитика, отчёты, команда</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button 
              type="button"
              onClick={() => setIsCreateModalOpen(true)} 
              className="btn-primary-cta"
            >
              <SvgIcon name="plus" size={16} color="#FFFFFF" />
              <span>+ Зарегистрировать сотрудника</span>
            </button>
          </div>
        </div>

        {/* Secondary Subordinate Card (2fr) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Pending Registrations Card */}
          <div className="asym-secondary-card" style={{ borderLeft: '4px solid var(--color-raspberry)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="text-label-muted" style={{ color: 'var(--color-raspberry)' }}>Входящие заявки</span>
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
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              {pendingRequests.length > 0 ? 'Требуется рассмотрение и назначение роли' : 'Все кандидаты одобрены'}
            </div>
          </div>

          {/* Cloud DB Sync Status */}
          <div className="asym-secondary-card" style={{ borderLeft: '4px solid var(--color-green)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="text-label-muted" style={{ color: 'var(--color-green-dark)' }}>Статус прав в облаке</span>
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
            <div style={{ fontSize: '16px', fontWeight: '800', color: 'var(--color-green-dark)', marginTop: '6px' }}>
              ● Синхронизировано с Supabase
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Изменения ролей защищены RLS и проверяются на сервере
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: PENDING REGISTRATIONS (IF ANY) */}
      {pendingRequests.length > 0 && (
        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <span className="text-label" style={{ color: 'var(--color-raspberry)' }}>Новые кандидаты</span>
              <h3 className="text-h3" style={{ fontSize: '20px' }}>
                Заявки на регистрацию ({pendingRequests.length})
              </h3>
            </div>
          </div>

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
                  <th>КАНДИДАТ</th>
                  <th>КОНТАКТ</th>
                  <th>ДАТА ПОДАЧИ</th>
                  <th>ЗАПРОШЕННАЯ РОЛЬ</th>
                  <th>ДЕЙСТВИЕ</th>
                </tr>
              </thead>
              <tbody>
                {pendingRequests.map(req => (
                  <tr key={req.id}>
                    <td>
                      <strong style={{ color: 'var(--text-dark)', fontSize: '15px' }}>{req.name}</strong>
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>
                      {req.email || req.phone}
                    </td>
                    <td style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                      {req.created_at ? req.created_at.substring(0, 16) : '—'}
                    </td>
                    <td>
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: '700',
                        background: 'var(--surface-subtle)',
                        color: 'var(--text-dark)'
                      }}>
                        {roleRussianLabels[req.role] || req.role}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
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
        </div>
      )}

      {/* SECTION 3: EMPLOYEES & ROLE MANAGEMENT DIRECTORY */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '16px', flexWrap: 'wrap', gap: '14px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <span className="text-label">Реестр команды</span>
            <h3 className="text-h3" style={{ fontSize: '20px' }}>
              Список всех сотрудников ({filteredUsers.length} из {users.length})
            </h3>
          </div>

          {/* Search & Role Filter Controls */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="Поиск по имени, email, телефону..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="form-input"
              style={{ width: '260px', padding: '7px 12px', fontSize: '13px' }}
            />

            <select
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value)}
              className="form-select"
              style={{ width: '180px', padding: '7px 12px', fontSize: '13px' }}
            >
              <option value="all">Все роли</option>
              <option value="specialist">Специалисты</option>
              <option value="admin">Администраторы</option>
              <option value="director">Руководители</option>
              <option value="owner">Владельцы</option>
            </select>

            {/* Filter: Show QA test accounts (default off) */}
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              fontSize: '12px',
              color: showTestAccounts ? '#F47920' : 'var(--text-secondary)',
              fontWeight: '700',
              background: showTestAccounts ? 'rgba(244, 121, 32, 0.1)' : 'var(--surface-subtle)',
              border: showTestAccounts ? '1px solid #F47920' : '1px solid var(--border-light)',
              padding: '6px 12px',
              borderRadius: '6px',
              userSelect: 'none'
            }}>
              <input
                type="checkbox"
                checked={showTestAccounts}
                onChange={e => setShowTestAccounts(e.target.checked)}
                style={{ accentColor: '#F47920', cursor: 'pointer' }}
              />
              <span>Показать тестовые аккаунты (QA)</span>
            </label>
          </div>
        </div>

        {/* Directory Table */}
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
                <th>СОТРУДНИК</th>
                <th>ТЕКУЩАЯ РОЛЬ (ИЗМЕНИТЬ)</th>
                <th>КОНТАКТЫ</th>
                <th>СПЕЦИАЛЬНОСТЬ / ФИЛИАЛ</th>
                <th>СТАТУС</th>
                <th>ДЕЙСТВИЯ</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '36px 20px', color: 'var(--text-secondary)' }}>
                    Сотрудники не найдены по заданным критериям.
                  </td>
                </tr>
              ) : (
                filteredUsers.map(u => {
                  const roleStyle = roleBadgeStyles[u.role] || roleBadgeStyles.specialist;
                  const isCurrentLoggedUser = u.id === user?.id;

                  return (
                    <tr key={u.id}>
                      {/* Name & Avatar */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{
                            width: '34px',
                            height: '34px',
                            borderRadius: '50%',
                            background: roleStyle.bg,
                            color: roleStyle.color,
                            fontWeight: '800',
                            fontSize: '13px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: roleStyle.border,
                            flexShrink: 0
                          }}>
                            {u.name ? u.name.charAt(0) : 'U'}
                          </div>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <strong style={{ color: 'var(--text-dark)', fontSize: '14px' }}>
                                {u.name}
                              </strong>
                              {Boolean(u.is_test) && (
                                <span style={{
                                  fontSize: '10px',
                                  fontWeight: '800',
                                  color: '#F47920',
                                  background: 'rgba(244, 121, 32, 0.12)',
                                  border: '1px solid rgba(244, 121, 32, 0.4)',
                                  padding: '1px 6px',
                                  borderRadius: '4px'
                                }}>
                                  QA ТЕСТ
                                </span>
                              )}
                            </div>
                            {isCurrentLoggedUser && (
                              <span style={{ fontSize: '10px', color: '#F47920', fontWeight: '800' }}>
                                (Вы)
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Dynamic Role Switcher Select */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <select
                            value={u.role}
                            onChange={(e) => handleFastRoleChange(u, e.target.value)}
                            disabled={u.role === 'owner' && user?.role !== 'owner'}
                            className="form-select"
                            style={{
                              padding: '5px 10px',
                              fontSize: '12px',
                              fontWeight: '700',
                              background: roleStyle.bg,
                              color: roleStyle.color,
                              border: roleStyle.border,
                              borderRadius: '6px',
                              cursor: (u.role === 'owner' && user?.role !== 'owner') ? 'not-allowed' : 'pointer'
                            }}
                            title="Изменить роль сотрудника (мгновенное обновление RBAC)"
                          >
                            <option value="specialist">Специалист</option>
                            <option value="admin">Администратор</option>
                            <option value="director">Руководитель</option>
                            {user?.role === 'owner' && (
                              <option value="owner">Владелец</option>
                            )}
                          </select>
                        </div>
                      </td>

                      {/* Contacts */}
                      <td>
                        <div style={{ fontSize: '13px', color: 'var(--text-dark)' }}>{u.email || '—'}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                          {u.phone || '—'}
                        </div>
                      </td>

                      {/* Specialty / Branch */}
                      <td>
                        <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-dark)' }}>
                          {u.specialty || (u.role === 'specialist' ? 'Терапевт центра' : 'Администрация')}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                          {u.branch || 'Астана — Центр'}
                        </div>
                      </td>

                      {/* Status */}
                      <td>
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: '800',
                          textTransform: 'uppercase',
                          background: u.status === 'active' ? 'var(--color-green-light)' : 'var(--color-raspberry-light)',
                          color: u.status === 'active' ? 'var(--color-green-dark)' : 'var(--color-raspberry-dark)'
                        }}>
                          {u.status === 'active' ? 'Активен' : 'Заблокирован'}
                        </span>
                      </td>

                      {/* Action Buttons */}
                      <td>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(u)}
                            className="btn-secondary"
                            style={{ padding: '5px 10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                            title="Редактировать данные сотрудника"
                          >
                            <SvgIcon name="edit" size={13} color="var(--text-main)" />
                            <span>Изменить</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenResetPwd(u)}
                            className="btn-secondary"
                            style={{ padding: '5px 8px', fontSize: '12px' }}
                            title="Сбросить пароль"
                          >
                            <SvgIcon name="lock" size={13} color="var(--text-secondary)" />
                          </button>

                          {u.role !== 'owner' && (
                            <button
                              type="button"
                              onClick={() => handleToggleBlock(u)}
                              className="btn-secondary"
                              style={{
                                padding: '5px 10px',
                                fontSize: '12px',
                                color: u.status === 'blocked' ? 'var(--color-teal)' : 'var(--color-raspberry)'
                              }}
                              title={u.status === 'blocked' ? 'Разблокировать сотрудника' : 'Заблокировать сотрудника'}
                            >
                              {u.status === 'blocked' ? 'Включить' : 'Блок'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: EDIT EMPLOYEE PROFILE */}
      {isEditModalOpen && editingUser && (
        <Modal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          title={`Редактирование: ${editingUser.name}`}
          subtitle="Изменение профиля сотрудника и прав доступа"
        >
          <form onSubmit={handleSaveEdit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
              <div>
                <label className="text-label-muted">Имя:</label>
                <input
                  type="text"
                  value={editForm.first_name}
                  onChange={e => setEditForm({ ...editForm, first_name: e.target.value })}
                  className="form-input"
                  required
                />
              </div>
              <div>
                <label className="text-label-muted">Фамилия:</label>
                <input
                  type="text"
                  value={editForm.last_name}
                  onChange={e => setEditForm({ ...editForm, last_name: e.target.value })}
                  className="form-input"
                  required
                />
              </div>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label className="text-label-muted">Отчество (если есть):</label>
              <input
                type="text"
                value={editForm.middle_name}
                onChange={e => setEditForm({ ...editForm, middle_name: e.target.value })}
                className="form-input"
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
              <div>
                <label className="text-label-muted">Email (логин):</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                  className="form-input"
                  required
                />
              </div>
              <div>
                <label className="text-label-muted">Телефон:</label>
                <input
                  type="text"
                  value={editForm.phone}
                  onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                  className="form-input"
                  required
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
              <div>
                <label className="text-label-muted">Роль доступа (RBAC):</label>
                <select
                  value={editForm.role}
                  onChange={e => setEditForm({ ...editForm, role: e.target.value })}
                  className="form-select"
                  disabled={editingUser.role === 'owner' && user?.role !== 'owner'}
                >
                  <option value="specialist">Специалист</option>
                  <option value="admin">Администратор</option>
                  <option value="director">Руководитель</option>
                  {user?.role === 'owner' && (
                    <option value="owner">Владелец</option>
                  )}
                </select>
              </div>

              <div>
                <label className="text-label-muted">Филиал центра:</label>
                <select
                  value={editForm.branch}
                  onChange={e => setEditForm({ ...editForm, branch: e.target.value })}
                  className="form-select"
                >
                  <option value="Астана — Центр">Астана — Центр</option>
                  <option value="Алматы — Филиал 1">Алматы — Филиал 1</option>
                  <option value="Шымкент — Филиал 2">Шымкент — Филиал 2</option>
                </select>
              </div>
            </div>

            <div style={{ marginBottom: '22px' }}>
              <label className="text-label-muted">Специализация (для карточки терапевта):</label>
              <input
                type="text"
                value={editForm.specialty}
                onChange={e => setEditForm({ ...editForm, specialty: e.target.value })}
                className="form-input"
                placeholder="Логопед-дефектолог, АФК-инструктор..."
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button 
                type="button" 
                onClick={() => setIsEditModalOpen(false)} 
                className="btn-secondary"
              >
                Отмена
              </button>
              <button 
                type="submit" 
                disabled={actionLoading}
                className="btn-primary-cta"
              >
                {actionLoading ? 'Сохранение...' : 'Сохранить изменения'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL 2: RESET PASSWORD */}
      {isResetPwdModalOpen && resetTargetUser && (
        <Modal
          isOpen={isResetPwdModalOpen}
          onClose={() => setIsResetPwdModalOpen(false)}
          title={`Сброс пароля: ${resetTargetUser.name}`}
          subtitle="Установка нового пароля для входа в систему"
        >
          <form onSubmit={handleExecuteResetPassword}>
            <div style={{ marginBottom: '18px' }}>
              <label className="text-label-muted">Новый временный пароль:</label>
              <input
                type="text"
                value={newPasswordVal}
                onChange={e => setNewPasswordVal(e.target.value)}
                className="form-input"
                required
                minLength={6}
              />
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginTop: '4px' }}>
                Сотрудник сможет войти с этим паролем и изменить его в личном профиле.
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button 
                type="button" 
                onClick={() => setIsResetPwdModalOpen(false)} 
                className="btn-secondary"
              >
                Отмена
              </button>
              <button 
                type="submit" 
                className="btn-primary-cta"
              >
                Установить новый пароль
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL 3: DIRECT EMPLOYEE CREATION */}
      {isCreateModalOpen && (
        <Modal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          title="Регистрация нового сотрудника"
          subtitle="Создание учётной записи с мгновенным назначением роли"
        >
          <form onSubmit={handleCreateEmployee}>
            <div style={{ marginBottom: '14px' }}>
              <label className="text-label-muted">ФИО сотрудника:</label>
              <input
                type="text"
                value={createForm.name}
                onChange={e => setCreateForm({ ...createForm, name: e.target.value })}
                className="form-input"
                placeholder="Алия Жумабаева"
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
              <div>
                <label className="text-label-muted">Email (логин):</label>
                <input
                  type="email"
                  value={createForm.email}
                  onChange={e => setCreateForm({ ...createForm, email: e.target.value })}
                  className="form-input"
                  placeholder="aliya@asarqadam.kz"
                  required
                />
              </div>
              <div>
                <label className="text-label-muted">Телефон:</label>
                <input
                  type="text"
                  value={createForm.phone}
                  onChange={e => setCreateForm({ ...createForm, phone: e.target.value })}
                  className="form-input"
                  placeholder="+7 701 ..."
                  required
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
              <div>
                <label className="text-label-muted">Начальный пароль:</label>
                <input
                  type="text"
                  value={createForm.password}
                  onChange={e => setCreateForm({ ...createForm, password: e.target.value })}
                  className="form-input"
                  required
                  minLength={6}
                />
              </div>

              <div>
                <label className="text-label-muted">Роль доступа (RBAC):</label>
                <select
                  value={createForm.role}
                  onChange={e => setCreateForm({ ...createForm, role: e.target.value })}
                  className="form-select"
                >
                  <option value="specialist">Специалист</option>
                  <option value="admin">Администратор</option>
                  <option value="director">Руководитель</option>
                  {user?.role === 'owner' && (
                    <option value="owner">Владелец</option>
                  )}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
              <button 
                type="button" 
                onClick={() => setIsCreateModalOpen(false)} 
                className="btn-secondary"
              >
                Отмена
              </button>
              <button 
                type="submit" 
                disabled={actionLoading}
                className="btn-primary-cta"
              >
                {actionLoading ? 'Создание...' : 'Создать сотрудника'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL 4: APPROVE REQUEST */}
      {isApproveModalOpen && selectedRequest && (
        <Modal
          isOpen={isApproveModalOpen}
          onClose={() => setIsApproveModalOpen(false)}
          title={`Одобрение заявки: ${selectedRequest.name}`}
          subtitle={`${selectedRequest.email || selectedRequest.phone} · Назначение роли`}
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
                <option value="specialist">Специалист (Доступ к своим детям и табелю)</option>
                <option value="admin">Администратор (Расписание, биллинг, команда)</option>
                <option value="director">Руководитель центра (Аналитика и отчёты)</option>
                {user?.role === 'owner' && (
                  <option value="owner">Владелец центра (Полный доступ)</option>
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
                  <option value="">Автоматически создать новую карточку специалиста</option>
                  {specialists.map(sp => (
                    <option key={sp.id} value={sp.id}>{sp.full_name} ({sp.specialty})</option>
                  ))}
                </select>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button 
                type="button" 
                onClick={() => setIsApproveModalOpen(false)} 
                className="btn-secondary"
              >
                Отмена
              </button>
              <button 
                type="submit" 
                disabled={actionLoading}
                className="btn-primary-cta"
              >
                {actionLoading ? 'Активация...' : 'Активировать сотрудника'}
              </button>
            </div>
          </form>
        </Modal>
      )}

    </div>
  );
};
