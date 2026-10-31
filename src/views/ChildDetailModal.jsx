import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Modal } from '../components/Modal';
import { MedicalAlertBadge } from '../components/MedicalAlertBadge';
import { SvgIcon } from '../components/icons/CustomIcons';

export const ChildDetailModal = ({ childId, isOpen, onClose, onRefresh }) => {
  const { user, canEditChildren, canAccessAccounting } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState({});

  useEffect(() => {
    if (childId && isOpen) {
      fetchChildDetail();
    }
  }, [childId, isOpen]);

  const fetchChildDetail = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/children/${childId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('asar_token')}` }
      });
      const json = await res.json();
      setData(json);
      setEditFormData(json.child || {});
    } catch (err) {
      console.error('Error fetching child details:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/children/${childId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('asar_token')}`
        },
        body: JSON.stringify(editFormData)
      });
      if (!res.ok) throw new Error('Ошибка сохранения');
      setIsEditing(false);
      fetchChildDetail();
      if (onRefresh) onRefresh();
    } catch (err) {
      alert(err.message);
    }
  };

  if (!isOpen) return null;

  const child = data?.child;
  const attendanceHistory = data?.attendanceHistory || [];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={child ? child.full_name : 'Карточка ребёнка'}
      subtitle={child ? `Возраст: ${child.ageLabel} · Поступил: ${child.admission_date}` : 'Загрузка...'}
      maxWidth="780px"
    >
      {loading || !child ? (
        <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          Загрузка карточки ребёнка...
        </div>
      ) : isEditing ? (
        <form onSubmit={handleSaveEdit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
            <div>
              <label className="text-label-muted">ФИО ребёнка:</label>
              <input
                type="text"
                className="form-input"
                value={editFormData.full_name || ''}
                onChange={e => setEditFormData({ ...editFormData, full_name: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="text-label-muted">Дата рождения:</label>
              <input
                type="date"
                className="form-input"
                value={editFormData.birth_date || ''}
                onChange={e => setEditFormData({ ...editFormData, birth_date: e.target.value })}
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
            <div>
              <label className="text-label-muted">Родитель / Представитель:</label>
              <input
                type="text"
                className="form-input"
                value={editFormData.parent_name || ''}
                onChange={e => setEditFormData({ ...editFormData, parent_name: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="text-label-muted">Телефон родителя:</label>
              <input
                type="text"
                className="form-input"
                value={editFormData.parent_phone || ''}
                onChange={e => setEditFormData({ ...editFormData, parent_phone: e.target.value })}
                required
              />
            </div>
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label className="text-label-muted">Диагноз / Заключение ПМПК:</label>
            <input
              type="text"
              className="form-input"
              value={editFormData.diagnosis || ''}
              onChange={e => setEditFormData({ ...editFormData, diagnosis: e.target.value })}
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
              Медицинские индикаторы риска:
            </span>
            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginBottom: '10px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '700', color: 'var(--text-dark)' }}>
                <input
                  type="checkbox"
                  checked={!!editFormData.has_asthma}
                  onChange={e => setEditFormData({ ...editFormData, has_asthma: e.target.checked ? 1 : 0 })}
                />
                Астма (Бронхиальная)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '700', color: 'var(--text-dark)' }}>
                <input
                  type="checkbox"
                  checked={!!editFormData.has_epilepsy}
                  onChange={e => setEditFormData({ ...editFormData, has_epilepsy: e.target.checked ? 1 : 0 })}
                />
                Эпилепсия / Судорожный синдром
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '700', color: 'var(--text-dark)' }}>
                <input
                  type="checkbox"
                  checked={!!editFormData.has_allergy}
                  onChange={e => setEditFormData({ ...editFormData, has_allergy: e.target.checked ? 1 : 0 })}
                />
                Аллергии
              </label>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label className="text-label-muted">Детали аллергии:</label>
                <input
                  type="text"
                  className="form-input"
                  value={editFormData.allergy_details || ''}
                  onChange={e => setEditFormData({ ...editFormData, allergy_details: e.target.value })}
                  placeholder="Орехи, лактоза, цитрусовые..."
                />
              </div>
              <div>
                <label className="text-label-muted">Противопоказания:</label>
                <input
                  type="text"
                  className="form-input"
                  value={editFormData.contraindications || ''}
                  onChange={e => setEditFormData({ ...editFormData, contraindications: e.target.value })}
                  placeholder="Мерцающий свет, нагрузки..."
                />
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '20px' }}>
            <div>
              <label className="text-label-muted">Индивидуальная цена (₸):</label>
              <input
                type="number"
                className="form-input"
                value={editFormData.custom_price || 8000}
                onChange={e => setEditFormData({ ...editFormData, custom_price: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="text-label-muted">Текущий баланс (₸):</label>
              <input
                type="number"
                className="form-input"
                value={editFormData.balance || 0}
                onChange={e => setEditFormData({ ...editFormData, balance: Number(e.target.value) })}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button type="button" onClick={() => setIsEditing(false)} className="btn-secondary">
              Отмена
            </button>
            <button type="submit" className="btn-primary-cta">
              Сохранить изменения
            </button>
          </div>
        </form>
      ) : (
        <div>
          {/* Prominent Medical Alerts Warning Block */}
          {child.hasMedicalAlert && (
            <div style={{ marginBottom: '16px' }}>
              <MedicalAlertBadge child={child} />
            </div>
          )}

          {/* Child Profile Cards Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '16px',
            marginBottom: '20px'
          }}>
            {/* General Info */}
            <div style={{
              background: 'var(--surface-subtle)',
              border: '1px solid var(--border-light)',
              padding: '16px',
              borderRadius: 'var(--radius-sm)'
            }}>
              <span className="text-label" style={{ display: 'block', marginBottom: '10px' }}>
                Общая информация
              </span>
              <div style={{ fontSize: '14px', marginBottom: '6px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>ФИО:</span>{' '}
                <strong style={{ color: 'var(--text-dark)' }}>{child.full_name}</strong>
              </div>
              <div style={{ fontSize: '14px', marginBottom: '6px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Возраст:</span>{' '}
                <strong style={{ color: 'var(--text-dark)' }}>{child.ageLabel}</strong>
              </div>
              <div style={{ fontSize: '14px', marginBottom: '6px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Родитель:</span>{' '}
                <strong style={{ color: 'var(--text-dark)' }}>{child.parent_name}</strong>
              </div>
              <div style={{ fontSize: '14px', marginBottom: '6px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Телефон:</span>{' '}
                <strong style={{ color: 'var(--color-teal-dark)' }}>{child.parent_phone}</strong>
              </div>
              {child.parent_phone_extra && (
                <div style={{ fontSize: '14px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Доп. контакт:</span>{' '}
                  <span style={{ color: 'var(--text-dark)' }}>{child.parent_phone_extra}</span>
                </div>
              )}
            </div>

            {/* Development & Therapy Settings */}
            <div style={{
              background: 'var(--surface-subtle)',
              border: '1px solid var(--border-light)',
              padding: '16px',
              borderRadius: 'var(--radius-sm)'
            }}>
              <span className="text-label" style={{ color: 'var(--color-gold-dark)', display: 'block', marginBottom: '10px' }}>
                Коррекционная программа
              </span>
              <div style={{ fontSize: '14px', marginBottom: '6px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Диагноз:</span>{' '}
                <strong style={{ color: 'var(--text-dark)' }}>{child.diagnosis || 'Не указан'}</strong>
              </div>
              <div style={{ fontSize: '14px', marginBottom: '6px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Специалист:</span>{' '}
                <strong style={{ color: 'var(--text-dark)' }}>{child.specialist_name || 'Не назначен'}</strong>
              </div>
              <div style={{ fontSize: '14px', marginBottom: '6px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Направление:</span>{' '}
                <strong style={{ color: 'var(--text-dark)' }}>{child.direction || '—'}</strong>
              </div>
              {canAccessAccounting && (
                <div style={{ fontSize: '14px', marginBottom: '6px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Тариф занятия:</span>{' '}
                  <strong style={{ color: 'var(--color-teal-dark)' }}>{(child.custom_price || 8000).toLocaleString('ru-RU')} ₸</strong>
                </div>
              )}
              {canAccessAccounting && (
                <div style={{ fontSize: '14px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Баланс депозита:</span>{' '}
                  <strong style={{ color: (child.balance || 0) < 0 ? 'var(--color-raspberry)' : 'var(--color-green-dark)' }}>
                    {(child.balance || 0).toLocaleString('ru-RU')} ₸
                  </strong>
                </div>
              )}
            </div>
          </div>

          {/* Development notes */}
          {child.development_notes && (
            <div style={{
              background: 'var(--surface-subtle)',
              border: '1px solid var(--border-light)',
              padding: '14px',
              borderRadius: 'var(--radius-sm)',
              marginBottom: '20px'
            }}>
              <span className="text-label-muted" style={{ display: 'block', marginBottom: '6px' }}>
                Особенности развития и заметки специалиста:
              </span>
              <div style={{ fontSize: '14px', color: 'var(--text-main)' }}>
                {child.development_notes}
              </div>
            </div>
          )}

          {/* Attendance History */}
          <div style={{ marginBottom: '24px' }}>
            <span className="text-label" style={{ display: 'block', marginBottom: '8px' }}>
              История посещаемости ({attendanceHistory.length})
            </span>
            {attendanceHistory.length === 0 ? (
              <div style={{ padding: '16px', background: 'var(--surface-subtle)', textAlign: 'center', fontSize: '13px', color: 'var(--text-secondary)', borderRadius: 'var(--radius-sm)' }}>
                Записей о посещениях пока нет
              </div>
            ) : (
              <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>ДАТА</th>
                      <th>СПЕЦИАЛИСТ</th>
                      <th>СТАТУС</th>
                      <th>ПРИМЕЧАНИЕ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendanceHistory.map(a => (
                      <tr key={a.id}>
                        <td style={{ fontFamily: 'monospace', fontWeight: '700' }}>{a.date}</td>
                        <td>{a.specialist_name}</td>
                        <td>
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: 'var(--radius-xs)',
                            fontSize: '11px',
                            fontWeight: '700',
                            background: a.status === 'present' ? 'var(--color-green-light)' : 'var(--surface-subtle)',
                            color: a.status === 'present' ? 'var(--color-green-dark)' : 'var(--text-secondary)'
                          }}>
                            {a.status === 'present' ? 'Пришёл' : a.status === 'absent' ? 'Не пришёл' : a.status}
                          </span>
                        </td>
                        <td style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{a.notes || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Footer Controls */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {canEditChildren && (
                <button onClick={() => setIsEditing(true)} className="btn-secondary">
                  Редактировать карточку
                </button>
              )}
              {canEditChildren && (
                <button
                  type="button"
                  onClick={async () => {
                    const reason = prompt('Укажите причину перевода ребёнка в архив (например: завершение курса, переезд, временный перерыв):', 'Завершение курса реабилитации');
                    if (reason === null) return;
                    try {
                      const res = await fetch(`/api/children/${childId}/archive`, {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          Authorization: `Bearer ${localStorage.getItem('asar_token')}`
                        },
                        body: JSON.stringify({ reason })
                      });
                      const json = await res.json();
                      if (!res.ok) throw new Error(json.error || 'Ошибка');
                      alert(json.message);
                      onClose();
                      if (onRefresh) onRefresh();
                    } catch (err) {
                      alert(err.message);
                    }
                  }}
                  className="btn-secondary"
                  style={{ borderColor: 'rgba(200, 63, 120, 0.4)', color: 'var(--color-raspberry)' }}
                >
                  Архивировать карточку
                </button>
              )}
              {['owner', 'director'].includes(user?.role) && (
                <button
                  type="button"
                  onClick={async () => {
                    if (!confirm(`Вы действительно хотите НАВСЕГДА удалить карточку ребёнка «${child.full_name}»? Это действие необратимо.`)) return;
                    try {
                      const res = await fetch(`/api/children/${childId}/hard-delete`, {
                        method: 'DELETE',
                        headers: { Authorization: `Bearer ${localStorage.getItem('asar_token')}` }
                      });
                      const json = await res.json();
                      if (!res.ok) throw new Error(json.error || 'Ошибка');
                      alert(json.message);
                      onClose();
                      if (onRefresh) onRefresh();
                    } catch (err) {
                      alert(err.message);
                    }
                  }}
                  className="btn-secondary"
                  style={{ color: '#CC0000', borderColor: 'rgba(204, 0, 0, 0.4)' }}
                >
                  Удалить навсегда
                </button>
              )}
            </div>
            <button onClick={onClose} className="btn-primary-cta" style={{ marginLeft: 'auto' }}>
              Закрыть
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
};
