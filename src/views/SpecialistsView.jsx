import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { SvgIcon } from '../components/icons/CustomIcons';
import { Modal } from '../components/Modal';

export const SpecialistsView = () => {
  const { user, canManageUsers } = useAuth();
  const [activeTab, setActiveTab] = useState('active'); // 'active' | 'directions' | 'archive'

  const [specialists, setSpecialists] = useState([]);
  const [directions, setDirections] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeactivateModalOpen, setIsDeactivateModalOpen] = useState(false);
  const [isDirModalOpen, setIsDirModalOpen] = useState(false);

  // Selected Specialist for Edit / Deactivate
  const [selectedSpecialist, setSelectedSpecialist] = useState(null);
  const [deactivateFutureSessions, setDeactivateFutureSessions] = useState([]);
  const [transferTargetId, setTransferTargetId] = useState('');

  // Form for Add Specialist
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    middle_name: '',
    phone: '+7 ',
    email: '',
    position: 'Специалист',
    specialty: 'Логопед',
    directions: ['Логопед'],
    branch: 'Астана — Центр',
    start_date: new Date().toISOString().split('T')[0],
    default_percentage: 50.0,
    base_rate: 8000.0,
    work_hours_start: '09:00',
    work_hours_end: '18:00',
    session_duration_minutes: 45,
    work_days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
    notes: '',
    create_user_account: true,
    user_password: 'password123'
  });

  // Form for Direction
  const [dirForm, setDirForm] = useState({
    id: null,
    name: '',
    description: '',
    color: '#38B9AD'
  });

  const [toastMsg, setToastMsg] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [spRes, dirRes] = await Promise.all([
        fetch('/api/specialists?include_inactive=true', {
          headers: { Authorization: `Bearer ${localStorage.getItem('asar_token')}` }
        }),
        fetch('/api/directions', {
          headers: { Authorization: `Bearer ${localStorage.getItem('asar_token')}` }
        })
      ]);

      const spData = await spRes.json();
      const dirData = await dirRes.json();

      setSpecialists(spData.specialists || []);
      setDirections(dirData.directions || []);
    } catch (err) {
      console.error('Error fetching specialists data:', err);
    } finally {
      setLoading(false);
    }
  };

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4500);
  };

  // Open Edit Modal
  const handleOpenEdit = (sp) => {
    setSelectedSpecialist(sp);
    setFormData({
      first_name: sp.first_name || '',
      last_name: sp.last_name || '',
      middle_name: sp.middle_name || '',
      phone: sp.phone || '',
      email: sp.email || '',
      position: sp.position || 'Специалист',
      specialty: sp.specialty || '',
      directions: sp.directionsList || [sp.specialty],
      branch: sp.branch || 'Астана — Центр',
      start_date: sp.start_date || '2024-01-15',
      default_percentage: sp.default_percentage || 50.0,
      base_rate: sp.base_rate || 8000.0,
      work_hours_start: sp.work_hours_start || '09:00',
      work_hours_end: sp.work_hours_end || '18:00',
      session_duration_minutes: sp.session_duration_minutes || 45,
      work_days: sp.workDays || ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
      notes: sp.notes || ''
    });
    setIsEditModalOpen(true);
  };

  // Submit Create Specialist
  const handleCreateSpecialist = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/specialists', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('asar_token')}`
        },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка добавления специалиста');

      setIsAddModalOpen(false);
      showToast(data.message || 'Специалист успешно добавлен');
      fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  // Submit Update Specialist
  const handleUpdateSpecialist = async (e) => {
    e.preventDefault();
    if (!selectedSpecialist) return;

    try {
      const res = await fetch(`/api/specialists/${selectedSpecialist.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('asar_token')}`
        },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка обновления');

      setIsEditModalOpen(false);
      showToast('Данные специалиста успешно обновлены');
      fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  // Open Deactivate Confirmation
  const handleOpenDeactivate = async (sp) => {
    setSelectedSpecialist(sp);
    setTransferTargetId('');
    try {
      const res = await fetch(`/api/specialists/${sp.id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('asar_token')}` }
      });
      const data = await res.json();
      setDeactivateFutureSessions(data.specialist?.futureSessionsCount ? [1] : []);
    } catch (e) {
      setDeactivateFutureSessions([]);
    }
    setIsDeactivateModalOpen(true);
  };

  // Confirm Deactivation
  const handleConfirmDeactivate = async () => {
    if (!selectedSpecialist) return;
    try {
      const res = await fetch(`/api/specialists/${selectedSpecialist.id}/deactivate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('asar_token')}`
        },
        body: JSON.stringify({ transfer_to_specialist_id: transferTargetId || null })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка');

      setIsDeactivateModalOpen(false);
      showToast(data.message);
      fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  // Reactivate Specialist
  const handleReactivate = async (spId) => {
    try {
      const res = await fetch(`/api/specialists/${spId}/activate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('asar_token')}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка');

      showToast(data.message);
      fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  // Instant Specialist Deletion (1-click without confirmation modal as required)
  const handleDeleteSpecialist = async (sp) => {
    const spId = sp.id;
    const spName = sp.full_name;

    // Optimistically remove immediately from view
    setSpecialists(prev => prev.filter(s => s.id !== spId));
    showToast(`Специалист «${spName}» удалён`);

    try {
      const res = await fetch(`/api/specialists/${spId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('asar_token')}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка удаления');
      fetchData();
    } catch (err) {
      showToast('Ошибка при удалении: ' + err.message);
      fetchData();
    }
  };

  // Quick approve pending specialist account
  const handleQuickApprove = async (sp) => {
    if (!confirm(`Одобрить доступ в систему для специалиста ${sp.full_name}?`)) return;
    try {
      const res = await fetch(`/api/users/approve/${sp.user_id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('asar_token')}`
        },
        body: JSON.stringify({
          assignedRole: 'specialist',
          branch: sp.branch || 'Астана — Центр',
          specialistId: sp.id
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка при одобрении');
      showToast(`Сотрудник ${sp.full_name} успешно одобрен и получил доступ к системе`);
      fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  // Direction Modal submit
  const handleSaveDirection = async (e) => {
    e.preventDefault();
    try {
      const isEdit = !!dirForm.id;
      const url = isEdit ? `/api/directions/${dirForm.id}` : '/api/directions';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('asar_token')}`
        },
        body: JSON.stringify(dirForm)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка');

      setIsDirModalOpen(false);
      showToast(data.message || 'Направление успешно сохранено');
      fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  // Deactivate Direction
  const handleDeactivateDirection = async (dirId) => {
    if (!confirm('Деактивировать это направление работы?')) return;
    try {
      const res = await fetch(`/api/directions/${dirId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('asar_token')}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка');

      showToast(data.message);
      fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  const dayLabels = {
    mon: 'Пн', tue: 'Вт', wed: 'Ср', thu: 'Чт', fri: 'Пт', sat: 'Сб', sun: 'Вс'
  };

  const activeSpecialists = specialists.filter(s => s.is_active === 1);
  const inactiveSpecialists = specialists.filter(s => s.is_active === 0);

  return (
    <div style={{ padding: '24px 32px', maxWidth: '1440px', margin: '0 auto' }}>
      
      {/* SECTION 1: ASYMMETRIC HEADER */}
      <div className="asym-section">
        {/* Dominant Element */}
        <div className="asym-dominant-card" style={{ borderLeft: '4px solid var(--color-teal)' }}>
          <div>
            <span className="text-label" style={{ color: 'var(--color-teal)' }}>Команда коррекционного центра</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap-tight)', marginTop: '8px', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '32px', fontWeight: '900', color: 'var(--text-bright)' }}>
                {activeSpecialists.length} практикующих специалистов
              </h2>
              <p className="text-subtitle" style={{ fontSize: '16px' }}>
                {directions.length} направлений работы: Логопедия, АВА-терапия, АФК, Сенсорная интеграция, Адаптивное тхэквондо и Нейропсихология Asar Qadam.
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
                <span className="text-label-muted" style={{ fontSize: '10px' }}>Базовый сплит:</span>
                <div style={{ fontSize: '18px', fontWeight: '800', color: 'var(--color-teal)' }}>
                  50% специалист / 50% центр
                </div>
              </div>
              <div style={{ borderLeft: '1px solid var(--border-subtle)', paddingLeft: '20px' }}>
                <span className="text-label-muted" style={{ fontSize: '10px' }}>Действующие филиалы:</span>
                <div style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-bright)' }}>
                  г. Астана · г. Алматы
                </div>
              </div>
            </div>
          </div>

          {canManageUsers && (
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button onClick={() => setIsAddModalOpen(true)} className="btn-primary-cta">
                <SvgIcon name="plus" size={16} color="#FFFFFF" />
                <span>Добавить специалиста</span>
              </button>
              <button
                onClick={() => {
                  setDirForm({ id: null, name: '', description: '', color: '#38B9AD' });
                  setIsDirModalOpen(true);
                }}
                className="btn-secondary"
                style={{ borderColor: 'rgba(56, 185, 173, 0.4)', color: 'var(--color-teal)' }}
              >
                + Направление
              </button>
            </div>
          )}
        </div>

        {/* Secondary Info Card */}
        <div className="asym-secondary-card" style={{ borderTop: '3px solid var(--color-gold)' }}>
          <span className="text-label-muted" style={{ marginBottom: '12px' }}>Управление направлениями и штатом</span>
          <div style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.6 }}>
            Один специалист может вести несколько направлений. При деактивации сотрудника вся история его занятий и начислений сохраняется, а будущие записи можно перенести.
          </div>
          <div style={{ marginTop: 'auto', paddingTop: '16px', fontSize: '12px', color: 'var(--color-teal)', fontWeight: '700' }}>
            Центр Asar Qadam · Единая система штата
          </div>
        </div>
      </div>

      {toastMsg && (
        <div style={{
          background: 'var(--color-green-light)',
          border: '1px solid var(--color-green)',
          color: 'var(--color-green)',
          padding: '12px 18px',
          borderRadius: '8px',
          marginBottom: '20px',
          fontWeight: '700'
        }}>
          ✓ {toastMsg}
        </div>
      )}

      {/* SECTION 2: TABS */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid var(--border-subtle)',
        marginBottom: '24px',
        gap: '8px'
      }}>
        <button
          type="button"
          onClick={() => setActiveTab('active')}
          style={{
            padding: '10px 18px',
            background: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'active' ? '3px solid var(--color-teal)' : '3px solid transparent',
            color: activeTab === 'active' ? 'var(--color-teal)' : 'var(--text-muted)',
            fontWeight: activeTab === 'active' ? '800' : '600',
            fontSize: '15px',
            cursor: 'pointer'
          }}
        >
          Штатные специалисты ({activeSpecialists.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('directions')}
          style={{
            padding: '10px 18px',
            background: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'directions' ? '3px solid var(--color-gold)' : '3px solid transparent',
            color: activeTab === 'directions' ? 'var(--color-gold)' : 'var(--text-muted)',
            fontWeight: activeTab === 'directions' ? '800' : '600',
            fontSize: '15px',
            cursor: 'pointer'
          }}
        >
          Направления работы ({directions.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('archive')}
          style={{
            padding: '10px 18px',
            background: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'archive' ? '3px solid var(--color-raspberry)' : '3px solid transparent',
            color: activeTab === 'archive' ? 'var(--color-raspberry)' : 'var(--text-muted)',
            fontWeight: activeTab === 'archive' ? '800' : '600',
            fontSize: '15px',
            cursor: 'pointer'
          }}
        >
          Архив / Неактивные ({inactiveSpecialists.length})
        </button>
      </div>

      {/* TAB 1: ACTIVE SPECIALISTS */}
      {activeTab === 'active' && (
        <div>
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              Загрузка специалистов...
            </div>
          ) : activeSpecialists.length === 0 ? (
            <div style={{
              padding: '48px 24px',
              textAlign: 'center',
              background: 'var(--surface-primary)',
              border: '1px dashed var(--border-medium)',
              borderRadius: '12px',
              margin: '16px 0'
            }}>
              <h3 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-bright)', marginBottom: '8px' }}>
                Список специалистов пуст
              </h3>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '18px', maxWidth: '480px', margin: '0 auto 18px auto' }}>
                В штате центра пока нет специалистов. Нажмите «Добавить специалиста», чтобы внести первого сотрудника в систему.
              </p>
              {canManageUsers && (
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(true)}
                  className="btn-primary-cta"
                  style={{ padding: '10px 20px', fontSize: '14px', margin: '0 auto' }}
                >
                  Добавить специалиста
                </button>
              )}
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
              gap: '18px'
            }}>
              {activeSpecialists.map(sp => (
                <div
                  key={sp.id}
                  style={{
                    background: 'var(--surface-primary)',
                    border: '1px solid var(--border-subtle)',
                    borderLeft: '4px solid var(--color-teal)',
                    padding: '20px',
                    borderRadius: '12px',
                    boxShadow: 'var(--shadow-subtle)',
                    display: 'flex',
                    flexDirection: 'column'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <div style={{
                        width: '46px',
                        height: '46px',
                        borderRadius: '50%',
                        background: 'var(--color-teal-light)',
                        color: 'var(--color-teal)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: '900',
                        fontSize: '18px',
                        overflow: 'hidden'
                      }}>
                        {sp.avatar_url ? (
                          <img src={sp.avatar_url} alt={sp.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          sp.full_name?.[0] || 'С'
                        )}
                      </div>
                      <div>
                        <h4 style={{ fontSize: '17px', fontWeight: '800', color: 'var(--text-bright)', margin: '0 0 2px 0' }}>
                          {sp.full_name}
                        </h4>
                        <span style={{ fontSize: '13px', color: 'var(--color-teal)', fontWeight: '700' }}>
                          {sp.position || 'Специалист'} · {sp.branch || 'Астана — Центр'}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      {sp.user_status === 'pending' && (
                        <span style={{
                          background: 'rgba(244, 121, 32, 0.12)',
                          border: '1px solid rgba(244, 121, 32, 0.4)',
                          color: '#F47920',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: '800'
                        }}>
                          Новая заявка
                        </span>
                      )}
                      <span style={{
                        background: 'var(--color-teal-light)',
                        padding: '3px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: '700',
                        color: 'var(--color-teal)'
                      }}>
                        ID #{sp.id}
                      </span>
                    </div>
                  </div>

                  {/* Directions pills */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', margin: '8px 0' }}>
                    {(sp.directionsList || [sp.specialty]).map((d, i) => (
                      <span
                        key={i}
                        style={{
                          background: 'var(--surface-secondary)',
                          border: '1px solid var(--border-subtle)',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          color: 'var(--text-primary)',
                          fontWeight: '600'
                        }}
                      >
                        {d}
                      </span>
                    ))}
                  </div>

                  {/* Info table */}
                  <div style={{
                    padding: '12px 14px',
                    background: 'var(--surface-secondary)',
                    borderRadius: '8px',
                    margin: '10px 0',
                    fontSize: '13px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Телефон:</span>
                      <strong style={{ color: 'var(--text-bright)' }}>{sp.phone}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Рабочие часы:</span>
                      <strong style={{ color: 'var(--text-bright)' }}>{sp.work_hours_start} — {sp.work_hours_end}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Тарифная ставка:</span>
                      <strong style={{ color: 'var(--color-green)' }}>
                        {sp.base_rate?.toLocaleString('ru-RU')} ₸ ({sp.default_percentage}%)
                      </strong>
                    </div>
                  </div>

                  {/* Days */}
                  <div style={{ marginBottom: '14px' }}>
                    <span className="text-label-muted" style={{ fontSize: '10px', display: 'block', marginBottom: '6px' }}>
                      Рабочие дни:
                    </span>
                    <div style={{ display: 'flex', gap: '5px' }}>
                      {['mon', 'tue', 'wed', 'thu', 'fri', 'sat'].map(day => {
                        const isActive = sp.workDays?.includes(day);
                        return (
                          <span
                            key={day}
                            style={{
                              padding: '2px 7px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: '700',
                              background: isActive ? 'var(--color-teal-light)' : 'var(--surface-secondary)',
                              color: isActive ? 'var(--color-teal)' : 'var(--text-muted)',
                              border: isActive ? '1px solid rgba(56, 185, 173, 0.3)' : '1px solid transparent'
                            }}
                          >
                            {dayLabels[day]}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  {/* Actions for Manager */}
                  {canManageUsers && (
                    <div style={{
                      marginTop: 'auto',
                      paddingTop: '12px',
                      borderTop: '1px solid var(--border-subtle)',
                      display: 'flex',
                      gap: '8px',
                      justifyContent: 'flex-end',
                      alignItems: 'center',
                      flexWrap: 'wrap'
                    }}>
                      {sp.user_status === 'pending' && sp.user_id && (
                        <button
                          onClick={() => handleQuickApprove(sp)}
                          style={{
                            background: '#F47920',
                            color: '#FFFFFF',
                            border: 'none',
                            padding: '6px 12px',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: '800',
                            cursor: 'pointer'
                          }}
                        >
                          Одобрить доступ
                        </button>
                      )}
                      <button
                        onClick={() => handleOpenEdit(sp)}
                        className="btn-secondary"
                        style={{ padding: '6px 12px', fontSize: '12px' }}
                      >
                        Редактировать
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteSpecialist(sp)}
                        className="btn-secondary"
                        style={{
                          padding: '6px 12px',
                          fontSize: '12px',
                          color: '#F47920',
                          borderColor: 'rgba(244, 121, 32, 0.4)',
                          cursor: 'pointer'
                        }}
                        title="Удалить специалиста в 1 клик"
                      >
                        Удалить
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: DIRECTIONS */}
      {activeTab === 'directions' && (
        <div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
            gap: '18px'
          }}>
            {directions.map(dir => (
              <div
                key={dir.id}
                style={{
                  background: 'var(--surface-primary)',
                  border: '1px solid var(--border-subtle)',
                  borderTop: `4px solid ${dir.color || 'var(--color-teal)'}`,
                  padding: '22px',
                  borderRadius: '12px',
                  boxShadow: 'var(--shadow-subtle)',
                  display: 'flex',
                  flexDirection: 'column'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <h4 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-bright)', margin: 0 }}>
                    {dir.name}
                  </h4>
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: '700',
                    background: dir.is_active ? 'var(--color-green-light)' : 'var(--color-pink)',
                    color: dir.is_active ? 'var(--color-green)' : 'var(--color-raspberry)'
                  }}>
                    {dir.is_active ? 'Активно' : 'Отключено'}
                  </span>
                </div>

                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, margin: '8px 0 16px 0', minHeight: '40px' }}>
                  {dir.description || 'Описание направления работы не заполнено.'}
                </p>

                <div style={{
                  padding: '10px 14px',
                  background: 'var(--surface-secondary)',
                  borderRadius: '6px',
                  marginBottom: '16px',
                  fontSize: '12px'
                }}>
                  <div style={{ color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Закреплено специалистов ({dir.specialists_count}):
                  </div>
                  <div style={{ fontWeight: '700', color: 'var(--text-bright)' }}>
                    {dir.assigned_specialists?.length > 0 
                      ? dir.assigned_specialists.map(s => s.name).join(', ')
                      : 'Специалисты пока не назначены'}
                  </div>
                </div>

                {canManageUsers && (
                  <div style={{ marginTop: 'auto', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setDirForm({
                          id: dir.id,
                          name: dir.name,
                          description: dir.description || '',
                          color: dir.color || '#38B9AD'
                        });
                        setIsDirModalOpen(true);
                      }}
                      className="btn-secondary"
                      style={{ padding: '6px 12px', fontSize: '12px' }}
                    >
                      Редактировать
                    </button>
                    {dir.is_active === 1 && (
                      <button
                        type="button"
                        onClick={() => handleDeactivateDirection(dir.id)}
                        className="btn-secondary"
                        style={{ padding: '6px 12px', fontSize: '12px', color: 'var(--color-raspberry)' }}
                      >
                        Деактивировать
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: INACTIVE SPECIALISTS */}
      {activeTab === 'archive' && (
        <div>
          {inactiveSpecialists.length === 0 ? (
            <div style={{
              background: 'var(--surface-primary)',
              border: '1px solid var(--border-subtle)',
              padding: '36px',
              borderRadius: '12px',
              textAlign: 'center',
              color: 'var(--text-secondary)'
            }}>
              В архиве нет деактивированных сотрудников. Все специалисты активны.
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
              gap: '18px'
            }}>
              {inactiveSpecialists.map(sp => (
                <div
                  key={sp.id}
                  style={{
                    background: 'var(--surface-primary)',
                    border: '1px solid var(--border-subtle)',
                    borderLeft: '4px solid var(--color-raspberry)',
                    padding: '20px',
                    borderRadius: '12px',
                    boxShadow: 'var(--shadow-subtle)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div>
                      <h4 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-muted)' }}>
                        {sp.full_name}
                      </h4>
                      <span style={{ fontSize: '13px', color: 'var(--color-raspberry)', fontWeight: '700' }}>
                        Деактивирован (архив)
                      </span>
                    </div>
                    <span style={{
                      background: 'var(--color-pink)',
                      padding: '3px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: '700',
                      color: 'var(--color-raspberry)'
                    }}>
                      ID #{sp.id}
                    </span>
                  </div>

                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '10px 0' }}>
                    Специализация: {sp.specialty} · Филиал: {sp.branch}
                  </p>

                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '14px' }}>
                    <button
                      type="button"
                      onClick={() => handleReactivate(sp.id)}
                      className="btn-primary-cta"
                      style={{ padding: '6px 14px', fontSize: '12px' }}
                    >
                      Восстановить в активные
                    </button>
                    {(user?.role === 'owner' || user?.role === 'director') && (
                      <button
                        type="button"
                        onClick={() => handleDeleteSpecialist(sp)}
                        className="btn-secondary"
                        style={{ padding: '6px 12px', fontSize: '12px', color: '#F47920', borderColor: 'rgba(244, 121, 32, 0.4)' }}
                        title="Удалить специалиста в 1 клик"
                      >
                        Удалить
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: ADD SPECIALIST */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Добавление специалиста в штат"
        subtitle="Регистрация нового сотрудника и настройка условий работы"
      >
        <form onSubmit={handleCreateSpecialist}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '14px' }}>
            <div>
              <label className="text-label-muted">Имя *:</label>
              <input
                type="text"
                className="form-input"
                value={formData.first_name}
                onChange={e => setFormData({ ...formData, first_name: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="text-label-muted">Фамилия *:</label>
              <input
                type="text"
                className="form-input"
                value={formData.last_name}
                onChange={e => setFormData({ ...formData, last_name: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="text-label-muted">Отчество:</label>
              <input
                type="text"
                className="form-input"
                value={formData.middle_name}
                onChange={e => setFormData({ ...formData, middle_name: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
            <div>
              <label className="text-label-muted">Телефон *:</label>
              <input
                type="text"
                className="form-input"
                value={formData.phone}
                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="text-label-muted">Email:</label>
              <input
                type="email"
                className="form-input"
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
            <div>
              <label className="text-label-muted">Должность:</label>
              <input
                type="text"
                className="form-input"
                value={formData.position}
                onChange={e => setFormData({ ...formData, position: e.target.value })}
                placeholder="Инструктор / Терапевт..."
                required
              />
            </div>
            <div>
              <label className="text-label-muted">Филиал:</label>
              <select
                className="form-select"
                value={formData.branch}
                onChange={e => setFormData({ ...formData, branch: e.target.value })}
              >
                <option value="Астана — Центр">Астана — Центр (ул. Достык)</option>
                <option value="Алматы — Самал">Алматы — Самал (пр. Достык)</option>
              </select>
            </div>
          </div>

          {/* Direction multi-selection */}
          <div style={{ marginBottom: '14px' }}>
            <label className="text-label-muted">Направления работы (выберите одно или несколько):</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px' }}>
              {directions.map(dir => {
                const isSelected = formData.directions.includes(dir.name);
                return (
                  <button
                    key={dir.id}
                    type="button"
                    onClick={() => {
                      const updated = isSelected 
                        ? formData.directions.filter(d => d !== dir.name)
                        : [...formData.directions, dir.name];
                      setFormData({ 
                        ...formData, 
                        directions: updated,
                        specialty: updated[0] || 'Специалист' 
                      });
                    }}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: '700',
                      background: isSelected ? 'var(--color-teal-light)' : 'var(--surface-secondary)',
                      color: isSelected ? 'var(--color-teal)' : 'var(--text-primary)',
                      border: isSelected ? '1px solid var(--color-teal)' : '1px solid var(--border-subtle)',
                      cursor: 'pointer'
                    }}
                  >
                    {isSelected ? '✓ ' : '+ '} {dir.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '14px' }}>
            <div>
              <label className="text-label-muted">Тариф за занятие (₸):</label>
              <input
                type="number"
                className="form-input"
                value={formData.base_rate}
                onChange={e => setFormData({ ...formData, base_rate: Number(e.target.value) })}
                required
              />
            </div>
            <div>
              <label className="text-label-muted">Доля специалиста (%):</label>
              <input
                type="number"
                className="form-input"
                value={formData.default_percentage}
                onChange={e => setFormData({ ...formData, default_percentage: Number(e.target.value) })}
                required
              />
            </div>
            <div>
              <label className="text-label-muted">Длительность (мин):</label>
              <input
                type="number"
                className="form-input"
                value={formData.session_duration_minutes}
                onChange={e => setFormData({ ...formData, session_duration_minutes: Number(e.target.value) })}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <div>
              <label className="text-label-muted">Начало работы:</label>
              <input
                type="time"
                className="form-input"
                value={formData.work_hours_start}
                onChange={e => setFormData({ ...formData, work_hours_start: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="text-label-muted">Конец работы:</label>
              <input
                type="time"
                className="form-input"
                value={formData.work_hours_end}
                onChange={e => setFormData({ ...formData, work_hours_end: e.target.value })}
                required
              />
            </div>
          </div>

          {/* User Account Option */}
          <div style={{
            padding: '12px 14px',
            background: 'var(--surface-secondary)',
            borderRadius: '8px',
            border: '1px solid var(--border-subtle)',
            marginBottom: '20px'
          }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '700', color: 'var(--text-bright)' }}>
              <input
                type="checkbox"
                checked={formData.create_user_account}
                onChange={e => setFormData({ ...formData, create_user_account: e.target.checked })}
              />
              Создать индивидуальный рабочий аккаунт для специалиста
            </label>
            {formData.create_user_account && (
              <div style={{ marginTop: '8px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Логином будет указанный телефон или email. Временный пароль:
                </span>
                <input
                  type="text"
                  className="form-input"
                  style={{ marginTop: '4px' }}
                  value={formData.user_password}
                  onChange={e => setFormData({ ...formData, user_password: e.target.value })}
                />
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button type="button" onClick={() => setIsAddModalOpen(false)} className="btn-secondary">
              Отмена
            </button>
            <button type="submit" className="btn-primary-cta">
              Сохранить специалиста
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: EDIT SPECIALIST */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={`Редактирование: ${selectedSpecialist?.full_name}`}
        subtitle="Изменение рабочих параметров, ставки и направлений специалиста"
      >
        <form onSubmit={handleUpdateSpecialist}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '14px' }}>
            <div>
              <label className="text-label-muted">Имя *:</label>
              <input
                type="text"
                className="form-input"
                value={formData.first_name}
                onChange={e => setFormData({ ...formData, first_name: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="text-label-muted">Фамилия *:</label>
              <input
                type="text"
                className="form-input"
                value={formData.last_name}
                onChange={e => setFormData({ ...formData, last_name: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="text-label-muted">Отчество:</label>
              <input
                type="text"
                className="form-input"
                value={formData.middle_name}
                onChange={e => setFormData({ ...formData, middle_name: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
            <div>
              <label className="text-label-muted">Телефон *:</label>
              <input
                type="text"
                className="form-input"
                value={formData.phone}
                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="text-label-muted">Email:</label>
              <input
                type="email"
                className="form-input"
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
            <div>
              <label className="text-label-muted">Должность:</label>
              <input
                type="text"
                className="form-input"
                value={formData.position}
                onChange={e => setFormData({ ...formData, position: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="text-label-muted">Филиал:</label>
              <select
                className="form-select"
                value={formData.branch}
                onChange={e => setFormData({ ...formData, branch: e.target.value })}
              >
                <option value="Астана — Центр">Астана — Центр (ул. Достык)</option>
                <option value="Алматы — Самал">Алматы — Самал (пр. Достык)</option>
              </select>
            </div>
          </div>

          {/* Direction multi-selection */}
          <div style={{ marginBottom: '14px' }}>
            <label className="text-label-muted">Направления работы:</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px' }}>
              {directions.map(dir => {
                const isSelected = formData.directions?.includes(dir.name);
                return (
                  <button
                    key={dir.id}
                    type="button"
                    onClick={() => {
                      const updated = isSelected 
                        ? formData.directions.filter(d => d !== dir.name)
                        : [...(formData.directions || []), dir.name];
                      setFormData({ 
                        ...formData, 
                        directions: updated,
                        specialty: updated[0] || 'Специалист' 
                      });
                    }}
                    style={{
                      padding: '5px 11px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: '700',
                      background: isSelected ? 'var(--color-teal-light)' : 'var(--surface-secondary)',
                      color: isSelected ? 'var(--color-teal)' : 'var(--text-primary)',
                      border: isSelected ? '1px solid var(--color-teal)' : '1px solid var(--border-subtle)',
                      cursor: 'pointer'
                    }}
                  >
                    {isSelected ? '✓ ' : '+ '} {dir.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '14px' }}>
            <div>
              <label className="text-label-muted">Тарифная ставка (₸):</label>
              <input
                type="number"
                className="form-input"
                value={formData.base_rate}
                onChange={e => setFormData({ ...formData, base_rate: Number(e.target.value) })}
                required
              />
            </div>
            <div>
              <label className="text-label-muted">Доля специалиста (%):</label>
              <input
                type="number"
                className="form-input"
                value={formData.default_percentage}
                onChange={e => setFormData({ ...formData, default_percentage: Number(e.target.value) })}
                required
              />
            </div>
            <div>
              <label className="text-label-muted">Длительность (мин):</label>
              <input
                type="number"
                className="form-input"
                value={formData.session_duration_minutes}
                onChange={e => setFormData({ ...formData, session_duration_minutes: Number(e.target.value) })}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
            <div>
              <label className="text-label-muted">Начало работы:</label>
              <input
                type="time"
                className="form-input"
                value={formData.work_hours_start}
                onChange={e => setFormData({ ...formData, work_hours_start: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="text-label-muted">Конец работы:</label>
              <input
                type="time"
                className="form-input"
                value={formData.work_hours_end}
                onChange={e => setFormData({ ...formData, work_hours_end: e.target.value })}
                required
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button type="button" onClick={() => setIsEditModalOpen(false)} className="btn-secondary">
              Отмена
            </button>
            <button type="submit" className="btn-primary-cta">
              Сохранить изменения
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 3: DEACTIVATE SPECIALIST */}
      <Modal
        isOpen={isDeactivateModalOpen}
        onClose={() => setIsDeactivateModalOpen(false)}
        title={`Деактивация сотрудника: ${selectedSpecialist?.full_name}`}
        subtitle="Специалист будет скрыт из активного списка. История занятий и выплат останется неизменной."
      >
        <div>
          {deactivateFutureSessions.length > 0 && (
            <div style={{
              background: 'var(--color-pink)',
              border: '1px solid rgba(200, 63, 120, 0.4)',
              color: 'var(--color-raspberry)',
              padding: '14px',
              borderRadius: '8px',
              marginBottom: '16px',
              fontSize: '13px',
              lineHeight: 1.5
            }}>
              <strong>Внимание!</strong> У специалиста имеются запланированные будущие занятия.
              Вы можете перенести их на другого активного специалиста:
              <div style={{ marginTop: '10px' }}>
                <label className="text-label-muted">Перенести занятия на:</label>
                <select
                  className="form-select"
                  value={transferTargetId}
                  onChange={e => setTransferTargetId(e.target.value)}
                >
                  <option value="">Не переносить (отменить будущие слоты)</option>
                  {activeSpecialists.filter(s => s.id !== selectedSpecialist?.id).map(s => (
                    <option key={s.id} value={s.id}>{s.full_name} ({s.specialty})</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <p style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.6 }}>
            При деактивации специалиста:
            <br />• Он исчезнет из формы добавления новых занятий и активного реестра.
            <br />• Все прошлые проведённые сессии и начисленные зарплаты сохранятся.
            <br />• Сотрудника можно восстановить в любой момент из вкладки «Архив».
          </p>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
            <button type="button" onClick={() => setIsDeactivateModalOpen(false)} className="btn-secondary">
              Отмена
            </button>
            <button
              type="button"
              onClick={handleConfirmDeactivate}
              className="btn-primary-cta"
              style={{ background: 'var(--color-raspberry)' }}
            >
              Подтвердить деактивацию
            </button>
          </div>
        </div>
      </Modal>

      {/* MODAL 4: DIRECTION ADD / EDIT */}
      <Modal
        isOpen={isDirModalOpen}
        onClose={() => setIsDirModalOpen(false)}
        title={dirForm.id ? 'Редактирование направления' : 'Новое направление работы'}
        subtitle="Направления используются в карточках детей, расписании и штате"
      >
        <form onSubmit={handleSaveDirection}>
          <div style={{ marginBottom: '14px' }}>
            <label className="text-label-muted">Название направления *:</label>
            <input
              type="text"
              className="form-input"
              value={dirForm.name}
              onChange={e => setDirForm({ ...dirForm, name: e.target.value })}
              placeholder="Например: Адаптивное плавание / Арт-терапия..."
              required
            />
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label className="text-label-muted">Описание:</label>
            <textarea
              className="form-input"
              rows={3}
              value={dirForm.description}
              onChange={e => setDirForm({ ...dirForm, description: e.target.value })}
              placeholder="Цели и специфика занятий по данному направлению..."
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label className="text-label-muted">Цветовой маркер направления:</label>
            <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
              {[
                { hex: '#38B9AD', label: 'Бирюзовый' },
                { hex: '#70B77E', label: 'Зелёный' },
                { hex: '#E8BC55', label: 'Золотой' },
                { hex: '#68B8E5', label: 'Голубой' },
                { hex: '#C83F78', label: 'Малиновый' }
              ].map(c => (
                <button
                  key={c.hex}
                  type="button"
                  onClick={() => setDirForm({ ...dirForm, color: c.hex })}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    background: c.hex,
                    color: '#FFFFFF',
                    border: dirForm.color === c.hex ? '3px solid #45424B' : 'none',
                    fontWeight: '700',
                    fontSize: '11px',
                    cursor: 'pointer'
                  }}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button type="button" onClick={() => setIsDirModalOpen(false)} className="btn-secondary">
              Отмена
            </button>
            <button type="submit" className="btn-primary-cta">
              Сохранить направление
            </button>
          </div>
        </form>
      </Modal>

    </div>
  );
};
