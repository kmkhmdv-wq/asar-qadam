import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { SvgIcon } from '../components/icons/CustomIcons';
import { MedicalAlertBadge } from '../components/MedicalAlertBadge';
import { ChildDetailModal } from './ChildDetailModal';
import { Modal } from '../components/Modal';

export const ChildrenView = () => {
  const { user, canEditChildren } = useAuth();
  const [activeTab, setActiveTab] = useState('active'); // 'active' | 'archive'
  const [children, setChildren] = useState([]);
  const [archivedChildren, setArchivedChildren] = useState([]);
  const [specialists, setSpecialists] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedSpecialist, setSelectedSpecialist] = useState('all');
  const [filterMedicalAlertsOnly, setFilterMedicalAlertsOnly] = useState(false);

  // Modals
  const [selectedChildId, setSelectedChildId] = useState(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  useEffect(() => {
    fetchChildren();
    fetchSpecialists();
  }, [user]);

  const fetchChildren = async () => {
    setLoading(true);
    try {
      const [resActive, resArchived] = await Promise.all([
        fetch('/api/children', {
          headers: { Authorization: `Bearer ${localStorage.getItem('asar_token')}` }
        }),
        fetch('/api/children/archived', {
          headers: { Authorization: `Bearer ${localStorage.getItem('asar_token')}` }
        })
      ]);

      const dataActive = await resActive.json();
      const dataArchived = await resArchived.json();

      setChildren(dataActive.children || []);
      setArchivedChildren(dataArchived.archivedChildren || []);
    } catch (err) {
      console.error('Error fetching children:', err);
    } finally {
      setLoading(false);
    }
  };

  const [newChild, setNewChild] = useState({
    full_name: '',
    birth_date: '2020-01-01',
    gender: 'male',
    parent_name: '',
    parent_phone: '+7 ',
    parent_phone_extra: '',
    admission_date: new Date().toISOString().split('T')[0],
    diagnosis: '',
    development_notes: '',
    has_asthma: 0,
    has_epilepsy: 0,
    has_allergy: 0,
    allergy_details: '',
    chronic_diseases: '',
    contraindications: '',
    notes: '',
    assigned_specialist_id: '',
    direction: 'Логопедия',
    sessions_per_week: 2,
    custom_price: 8000,
    balance: 0
  });

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

  const handleCreateChild = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/children', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('asar_token')}`
        },
        body: JSON.stringify(newChild)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка при создании');
      setIsAddModalOpen(false);
      fetchChildren();
      setNewChild({
        full_name: '',
        birth_date: '2020-01-01',
        gender: 'male',
        parent_name: '',
        parent_phone: '+7 ',
        parent_phone_extra: '',
        admission_date: new Date().toISOString().split('T')[0],
        diagnosis: '',
        development_notes: '',
        has_asthma: 0,
        has_epilepsy: 0,
        has_allergy: 0,
        allergy_details: '',
        chronic_diseases: '',
        contraindications: '',
        notes: '',
        assigned_specialist_id: '',
        direction: 'Логопедия',
        sessions_per_week: 2,
        custom_price: 8000,
        balance: 0
      });
    } catch (err) {
      alert(err.message);
    }
  };

  const handleRestoreChild = async (childId, e) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/children/${childId}/restore`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('asar_token')}` }
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Ошибка');
      alert(json.message);
      fetchChildren();
    } catch (err) {
      alert(err.message);
    }
  };

  const filteredChildren = children.filter(c => {
    const matchesSearch = c.full_name.toLowerCase().includes(search.toLowerCase()) ||
                          (c.parent_name && c.parent_name.toLowerCase().includes(search.toLowerCase())) ||
                          (c.diagnosis && c.diagnosis.toLowerCase().includes(search.toLowerCase()));

    const matchesSpecialist = selectedSpecialist === 'all' || String(c.assigned_specialist_id) === String(selectedSpecialist);
    const matchesAlerts = !filterMedicalAlertsOnly || c.hasMedicalAlert;

    return matchesSearch && matchesSpecialist && matchesAlerts;
  });

  const filteredArchived = archivedChildren.filter(c => {
    return c.full_name.toLowerCase().includes(search.toLowerCase()) ||
           (c.parent_name && c.parent_name.toLowerCase().includes(search.toLowerCase()));
  });

  return (
    <div style={{ padding: '28px 32px', maxWidth: '1440px', margin: '0 auto' }}>

      {/* TABS: ACTIVE vs ARCHIVE */}
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
          Действующие воспитанники ({children.length})
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
          Архив детей ({archivedChildren.length})
        </button>
      </div>

      {activeTab === 'active' ? (
        <>
          {/* SECTION 1: ASYMMETRIC HEADER & MEDICAL KPI */}
          <div className="asym-section">
            {/* Dominant Card */}
            <div className="asym-dominant-card" style={{ borderLeft: '4px solid var(--color-gold)' }}>
              <div>
                <span className="text-label" style={{ color: 'var(--color-gold-dark)' }}>Реестр воспитанников Asar Qadam</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '8px', marginBottom: '16px' }}>
                  <h2 style={{ fontSize: '32px', fontWeight: '900', color: 'var(--text-dark)' }}>
                    {children.length} активных цифровых карточек
                  </h2>
                  <p className="text-subtitle">
                    Центр ведёт строгий учёт индивидуальных карточек с медицинскими протоколами и автоматическим контролем возраста.
                  </p>
                </div>
                <div style={{
                  display: 'flex',
                  gap: '16px',
                  padding: '12px 16px',
                  background: 'var(--surface-subtle)',
                  border: '1px solid var(--border-light)',
                  borderRadius: 'var(--radius-sm)',
                  marginBottom: '20px'
                }}>
                  <div>
                    <span className="text-label-muted" style={{ fontSize: '10px' }}>С медицинским контролем:</span>
                    <div style={{ fontSize: '18px', fontWeight: '800', color: 'var(--color-raspberry)' }}>
                      {children.filter(c => c.hasMedicalAlert).length} детей
                    </div>
                  </div>
                  <div style={{ borderLeft: '1px solid var(--border-medium)', paddingLeft: '16px' }}>
                    <span className="text-label-muted" style={{ fontSize: '10px' }}>Средний возраст:</span>
                    <div style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-dark)' }}>
                      5.2 лет
                    </div>
                  </div>
                </div>
              </div>

              {canEditChildren && (
                <div>
                  <button onClick={() => setIsAddModalOpen(true)} className="btn-primary-cta">
                    <SvgIcon name="plus" size={16} color="#FFFFFF" />
                    <span>Зарегистрировать нового ребёнка</span>
                  </button>
                </div>
              )}
            </div>

            {/* Secondary Filter Controls Card */}
            <div className="asym-secondary-card">
              <span className="text-label-muted" style={{ marginBottom: '12px' }}>Фильтры базы детей</span>
              
              <div style={{ marginBottom: '12px' }}>
                <label className="text-label-muted" style={{ fontSize: '10px', display: 'block', marginBottom: '4px' }}>Поиск по ФИО или диагнозу:</label>
                <input
                  type="text"
                  placeholder="Введите имя ребёнка..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="form-input"
                />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label className="text-label-muted" style={{ fontSize: '10px', display: 'block', marginBottom: '4px' }}>Специалист:</label>
                <select
                  value={selectedSpecialist}
                  onChange={e => setSelectedSpecialist(e.target.value)}
                  className="form-select"
                >
                  <option value="all">Все специалисты</option>
                  {specialists.map(sp => (
                    <option key={sp.id} value={sp.id}>{sp.full_name}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginTop: 'auto', paddingTop: '10px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: 'var(--text-dark)' }}>
                  <input
                    type="checkbox"
                    checked={filterMedicalAlertsOnly}
                    onChange={e => setFilterMedicalAlertsOnly(e.target.checked)}
                  />
                  <span style={{ fontWeight: '600', color: 'var(--color-raspberry)' }}>Показать только с мед. предупреждениями (⚠️)</span>
                </label>
              </div>
            </div>
          </div>

      {/* SECTION 2: CHILDREN CARDS GRID */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <span className="text-label">Список детей</span>
            <h3 className="text-h3" style={{ fontSize: '20px' }}>
              Найдено: {filteredChildren.length}
            </h3>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            Загрузка базы детей...
          </div>
        ) : filteredChildren.length === 0 ? (
          <div style={{
            background: 'var(--surface-white)',
            border: '1px solid var(--border-light)',
            padding: '40px',
            textAlign: 'center',
            color: 'var(--text-secondary)',
            borderRadius: 'var(--radius-md)'
          }}>
            Дети по заданным критериям не найдены.
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
            gap: '16px'
          }}>
            {filteredChildren.map(child => (
              <div
                key={child.id}
                onClick={() => setSelectedChildId(child.id)}
                style={{
                  background: 'var(--surface-white)',
                  border: '1px solid var(--border-light)',
                  borderLeft: child.hasMedicalAlert ? '4px solid var(--color-raspberry)' : '4px solid var(--color-teal)',
                  padding: '18px',
                  borderRadius: 'var(--radius-sm)',
                  boxShadow: 'var(--shadow-card)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.boxShadow = 'var(--shadow-hover)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.boxShadow = 'var(--shadow-card)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <div>
                    <h4 style={{ fontSize: '17px', fontWeight: '800', color: 'var(--text-dark)' }}>
                      {child.full_name}
                    </h4>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      Возраст: {child.ageLabel}
                    </span>
                  </div>
                  {child.hasMedicalAlert && (
                    <MedicalAlertBadge child={child} compact={true} />
                  )}
                </div>

                <div style={{ fontSize: '13px', color: 'var(--text-main)', marginBottom: '14px' }}>
                  {child.diagnosis || 'Без диагноза'}
                </div>

                <div style={{
                  padding: '10px 12px',
                  background: 'var(--surface-subtle)',
                  borderRadius: 'var(--radius-xs)',
                  fontSize: '12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <span style={{ color: 'var(--text-secondary)' }}>Специалист: </span>
                    <strong style={{ color: 'var(--text-dark)' }}>{child.specialist_name?.split(' ')[0] || 'Не назначен'}</strong>
                  </div>
                  <div style={{ color: 'var(--color-teal)', fontWeight: '700' }}>
                    Карточка →
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
        </>
      ) : (
        /* ARCHIVE TAB CONTENT */
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <span className="text-label" style={{ color: 'var(--color-raspberry)' }}>Архивные карточки</span>
              <h3 className="text-h3" style={{ fontSize: '20px' }}>
                В архиве: {filteredArchived.length} детей
              </h3>
            </div>
          </div>

          {filteredArchived.length === 0 ? (
            <div style={{
              background: 'var(--surface-primary)',
              border: '1px solid var(--border-subtle)',
              padding: '36px',
              borderRadius: '12px',
              textAlign: 'center',
              color: 'var(--text-secondary)'
            }}>
              В архиве нет карточек. Все воспитанники находятся в активном списке.
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
              gap: '16px'
            }}>
              {filteredArchived.map(child => (
                <div
                  key={child.id}
                  style={{
                    background: 'var(--surface-primary)',
                    border: '1px solid var(--border-subtle)',
                    borderLeft: '4px solid var(--color-raspberry)',
                    padding: '20px',
                    borderRadius: '12px',
                    boxShadow: 'var(--shadow-subtle)',
                    display: 'flex',
                    flexDirection: 'column'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div>
                      <h4 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-bright)', margin: 0 }}>
                        {child.full_name}
                      </h4>
                      <span style={{ fontSize: '12px', color: 'var(--color-raspberry)', fontWeight: '700' }}>
                        В архиве с {child.archived_at ? child.archived_at.substring(0, 10) : '—'}
                      </span>
                    </div>
                    <span style={{
                      padding: '2px 8px',
                      background: 'var(--color-pink)',
                      color: 'var(--color-raspberry)',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: '700'
                    }}>
                      ID #{child.id}
                    </span>
                  </div>

                  <div style={{
                    padding: '10px 12px',
                    background: 'var(--surface-secondary)',
                    borderRadius: '6px',
                    margin: '10px 0',
                    fontSize: '12px'
                  }}>
                    <div style={{ marginBottom: '4px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Причина: </span>
                      <strong style={{ color: 'var(--text-bright)' }}>{child.archive_reason || 'Завершение курса'}</strong>
                    </div>
                    <div style={{ marginBottom: '4px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Родитель: </span>
                      <span style={{ color: 'var(--text-bright)' }}>{child.parent_name} ({child.parent_phone})</span>
                    </div>
                    {child.diagnosis && (
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Диагноз: </span>
                        <span style={{ color: 'var(--text-bright)' }}>{child.diagnosis}</span>
                      </div>
                    )}
                  </div>

                  <div style={{
                    marginTop: 'auto',
                    paddingTop: '12px',
                    borderTop: '1px solid var(--border-subtle)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <button
                      type="button"
                      onClick={() => setSelectedChildId(child.id)}
                      className="btn-secondary"
                      style={{ padding: '6px 12px', fontSize: '12px' }}
                    >
                      Карточка
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleRestoreChild(child.id, e)}
                      className="btn-primary-cta"
                      style={{ padding: '6px 14px', fontSize: '12px' }}
                    >
                      Восстановить в активные
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* DETAIL MODAL */}
      {selectedChildId && (
        <ChildDetailModal
          childId={selectedChildId}
          isOpen={!!selectedChildId}
          onClose={() => setSelectedChildId(null)}
          onRefresh={fetchChildren}
        />
      )}

      {/* NEW CHILD REGISTRATION MODAL */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Новая цифровая карточка ребёнка"
        subtitle="Регистрация воспитанника в центре Asar Qadam"
        maxWidth="740px"
      >
        <form onSubmit={handleCreateChild}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
            <div>
              <label className="text-label-muted">ФИО ребёнка:</label>
              <input
                type="text"
                className="form-input"
                placeholder="Имя и Фамилия"
                value={newChild.full_name}
                onChange={e => setNewChild({ ...newChild, full_name: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="text-label-muted">Дата рождения:</label>
              <input
                type="date"
                className="form-input"
                value={newChild.birth_date}
                onChange={e => setNewChild({ ...newChild, birth_date: e.target.value })}
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
            <div>
              <label className="text-label-muted">ФИО родителя:</label>
              <input
                type="text"
                className="form-input"
                placeholder="Мама / Папа"
                value={newChild.parent_name}
                onChange={e => setNewChild({ ...newChild, parent_name: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="text-label-muted">Телефон родителя:</label>
              <input
                type="text"
                className="form-input"
                placeholder="+7 701 000 0000"
                value={newChild.parent_phone}
                onChange={e => setNewChild({ ...newChild, parent_phone: e.target.value })}
                required
              />
            </div>
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label className="text-label-muted">Диагноз / Особенности развития:</label>
            <input
              type="text"
              className="form-input"
              placeholder="РАС / ЗПР / Алалия / СДВГ..."
              value={newChild.diagnosis}
              onChange={e => setNewChild({ ...newChild, diagnosis: e.target.value })}
            />
          </div>

          {/* Medical Checkboxes */}
          <div style={{
            background: 'var(--color-raspberry-light)',
            border: '1px solid var(--color-raspberry)',
            padding: '14px',
            borderRadius: 'var(--radius-sm)',
            marginBottom: '14px'
          }}>
            <span style={{ fontSize: '12px', fontWeight: '800', color: 'var(--color-raspberry-dark)', display: 'block', marginBottom: '8px' }}>
              Критичные медицинские состояния (Обязательно к заполнению):
            </span>
            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginBottom: '10px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '700', color: 'var(--text-dark)' }}>
                <input
                  type="checkbox"
                  checked={!!newChild.has_asthma}
                  onChange={e => setNewChild({ ...newChild, has_asthma: e.target.checked ? 1 : 0 })}
                />
                Астма
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '700', color: 'var(--text-dark)' }}>
                <input
                  type="checkbox"
                  checked={!!newChild.has_epilepsy}
                  onChange={e => setNewChild({ ...newChild, has_epilepsy: e.target.checked ? 1 : 0 })}
                />
                Эпилепсия
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '700', color: 'var(--text-dark)' }}>
                <input
                  type="checkbox"
                  checked={!!newChild.has_allergy}
                  onChange={e => setNewChild({ ...newChild, has_allergy: e.target.checked ? 1 : 0 })}
                />
                Аллергии
              </label>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Детали аллергии (орехи, лактоза)..."
                  value={newChild.allergy_details}
                  onChange={e => setNewChild({ ...newChild, allergy_details: e.target.value })}
                />
              </div>
              <div>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Противопоказания (яркий свет)..."
                  value={newChild.contraindications}
                  onChange={e => setNewChild({ ...newChild, contraindications: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
            <div>
              <label className="text-label-muted">Назначенный специалист:</label>
              <select
                value={newChild.assigned_specialist_id}
                onChange={e => setNewChild({ ...newChild, assigned_specialist_id: e.target.value })}
                className="form-select"
              >
                <option value="">Не назначен</option>
                {specialists.map(sp => (
                  <option key={sp.id} value={sp.id}>{sp.full_name} ({sp.specialty})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-label-muted">Стоимость занятия (₸):</label>
              <input
                type="number"
                className="form-input"
                value={newChild.custom_price}
                onChange={e => setNewChild({ ...newChild, custom_price: Number(e.target.value) })}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button type="button" onClick={() => setIsAddModalOpen(false)} className="btn-secondary">
              Отмена
            </button>
            <button type="submit" className="btn-primary-cta">
              Зарегистрировать ребёнка
            </button>
          </div>
        </form>
      </Modal>

    </div>
  );
};
