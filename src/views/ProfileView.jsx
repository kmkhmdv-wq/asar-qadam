import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { SvgIcon } from '../components/icons/CustomIcons';

export const ProfileView = () => {
  const { user, updateProfile, sendVerificationCode } = useAuth();

  const [formData, setFormData] = useState({
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    middle_name: user?.middle_name || '',
    phone: user?.phone || '',
    email: user?.email || '',
    avatar_url: user?.avatar_url || '',
    bio: user?.bio || '',
    current_password: '',
    new_password: '',
    confirm_new_password: '',
    verification_code: ''
  });

  const [specialistInfo, setSpecialistInfo] = useState(null);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [codeSent, setCodeSent] = useState(false);
  const [codeMsg, setCodeMsg] = useState(null);

  useEffect(() => {
    fetchProfileDetails();
  }, [user]);

  const fetchProfileDetails = async () => {
    try {
      const res = await fetch('/api/auth/profile', {
        headers: { Authorization: `Bearer ${localStorage.getItem('asar_token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          setFormData(prev => ({
            ...prev,
            first_name: data.user.first_name || '',
            last_name: data.user.last_name || '',
            middle_name: data.user.middle_name || '',
            phone: data.user.phone || '',
            email: data.user.email || '',
            avatar_url: data.user.avatar_url || '',
            bio: data.user.bio || ''
          }));
        }
        if (data.specialist) {
          setSpecialistInfo(data.specialist);
        }
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
    }
  };

  const handleSendCode = async () => {
    const target = formData.phone || formData.email;
    if (!target) {
      setErrorMsg('Укажите номер телефона или email для подтверждения');
      return;
    }
    setErrorMsg(null);
    try {
      const res = await sendVerificationCode(target, 'change_contact');
      setCodeSent(true);
      setCodeMsg(res.message);
      setFormData(prev => ({ ...prev, verification_code: '1234' }));
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (formData.new_password) {
      if (!formData.current_password) {
        setErrorMsg('Для изменения пароля введите ваш текущий пароль');
        return;
      }
      if (formData.new_password !== formData.confirm_new_password) {
        setErrorMsg('Новый пароль и подтверждение не совпадают');
        return;
      }
      if (formData.new_password.length < 6) {
        setErrorMsg('Пароль должен содержать минимум 6 символов');
        return;
      }
    }

    setSaving(true);
    try {
      const res = await updateProfile(formData);
      setSuccessMsg(res.message || 'Изменения успешно сохранены');
      setFormData(prev => ({
        ...prev,
        current_password: '',
        new_password: '',
        confirm_new_password: '',
        verification_code: ''
      }));
      setCodeSent(false);
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setSaving(false);
    }
  };

  const roleRussianLabels = {
    owner: 'Владелец центра',
    director: 'Руководитель филиала',
    admin: 'Администратор',
    specialist: 'Практикующий специалист'
  };

  const roleBadgeColors = {
    owner: { bg: 'var(--color-gold-light)', color: 'var(--color-gold)', border: 'rgba(232, 188, 85, 0.4)' },
    director: { bg: 'var(--color-pink)', color: 'var(--color-raspberry)', border: 'rgba(200, 63, 120, 0.4)' },
    admin: { bg: 'var(--color-blue-light)', color: 'var(--color-blue)', border: 'rgba(104, 184, 229, 0.4)' },
    specialist: { bg: 'var(--color-teal-light)', color: 'var(--color-teal)', border: 'rgba(56, 185, 173, 0.4)' }
  }[user?.role] || { bg: 'var(--surface-secondary)', color: 'var(--text-primary)', border: 'var(--border-subtle)' };

  // Sample avatar presets
  const avatarPresets = [
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80'
  ];

  return (
    <div style={{ padding: '24px 32px', maxWidth: '1200px', margin: '0 auto' }}>
      
      {/* SECTION 1: HEADER & PROFILE SUMMARY */}
      <div className="asym-section">
        {/* Dominant Element (3fr) */}
        <div className="asym-dominant-card" style={{ borderLeft: '4px solid var(--color-teal)' }}>
          <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative' }}>
              <div style={{
                width: '92px',
                height: '92px',
                borderRadius: '50%',
                overflow: 'hidden',
                background: 'var(--color-teal-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '32px',
                fontWeight: '900',
                color: 'var(--color-teal)',
                border: '3px solid var(--surface-primary)',
                boxShadow: 'var(--shadow-subtle)'
              }}>
                {formData.avatar_url ? (
                  <img src={formData.avatar_url} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span>{(formData.first_name?.[0] || user?.name?.[0] || 'U').toUpperCase()}</span>
                )}
              </div>
            </div>

            <div style={{ flex: 1, minWidth: '240px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                <span style={{
                  padding: '3px 10px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: '800',
                  textTransform: 'uppercase',
                  background: roleBadgeColors.bg,
                  color: roleBadgeColors.color,
                  border: `1px solid ${roleBadgeColors.border}`
                }}>
                  {roleRussianLabels[user?.role] || user?.role}
                </span>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  ID #{user?.id} · {user?.branch || 'Астана — Центр'}
                </span>
              </div>

              <h2 style={{ fontSize: '28px', fontWeight: '900', color: 'var(--text-bright)', margin: '0 0 6px 0' }}>
                {formData.first_name} {formData.last_name} {formData.middle_name}
              </h2>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: 0 }}>
                {user?.email || 'Email не указан'} · {user?.phone || 'Телефон не указан'}
              </p>
            </div>
          </div>

          <div style={{
            display: 'flex',
            gap: '20px',
            padding: '12px 18px',
            background: 'var(--surface-secondary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '8px',
            marginTop: '20px'
          }}>
            <div>
              <span className="text-label-muted" style={{ fontSize: '10px' }}>Статус учётной записи:</span>
              <div style={{ fontSize: '15px', fontWeight: '800', color: 'var(--color-green)' }}>
                ● Активен (подтверждён)
              </div>
            </div>
            <div style={{ borderLeft: '1px solid var(--border-subtle)', paddingLeft: '20px' }}>
              <span className="text-label-muted" style={{ fontSize: '10px' }}>Филиал привязки:</span>
              <div style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-bright)' }}>
                {user?.branch || 'Астана — Центр'}
              </div>
            </div>
          </div>
        </div>

        {/* Secondary Info Card (2fr) */}
        <div className="asym-secondary-card" style={{ borderTop: '3px solid var(--color-gold)' }}>
          <span className="text-label-muted" style={{ marginBottom: '12px' }}>Безопасность и правила профиля</span>
          <div style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.6 }}>
            <p>• Каждый сотрудник может изменять личные данные (ФИО, фото, контакты, пароль).</p>
            <p style={{ marginTop: '6px' }}>• Изменение профиля <strong>не меняет</strong> вашу системную роль или права доступа.</p>
            <p style={{ marginTop: '6px' }}>• При смене номера телефона или email требуется код подтверждения.</p>
          </div>
        </div>
      </div>

      {/* FEEDBACK ALERTS */}
      {successMsg && (
        <div style={{
          background: 'var(--color-green-light)',
          border: '1px solid var(--color-green)',
          color: 'var(--color-green)',
          padding: '14px 18px',
          borderRadius: '8px',
          marginBottom: '20px',
          fontWeight: '700',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <span>✓</span>
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div style={{
          background: 'var(--color-pink)',
          border: '1px solid rgba(200, 63, 120, 0.4)',
          color: 'var(--color-raspberry)',
          padding: '14px 18px',
          borderRadius: '8px',
          marginBottom: '20px',
          fontWeight: '700'
        }}>
          {errorMsg}
        </div>
      )}

      {/* SECTION 2: EDIT FORM */}
      <form onSubmit={handleSubmit} style={{
        background: 'var(--surface-primary)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '12px',
        padding: '28px',
        boxShadow: 'var(--shadow-subtle)'
      }}>
        
        {/* BLOCK 1: PERSONAL INFO */}
        <div style={{ marginBottom: '28px' }}>
          <span className="text-label" style={{ color: 'var(--color-teal)', marginBottom: '14px', display: 'block' }}>
            1. Основные личные сведения
          </span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
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

          {/* Photo / Avatar Selection */}
          <div style={{ marginTop: '16px' }}>
            <label className="text-label-muted">URL фотографии профиля:</label>
            <input
              type="text"
              className="form-input"
              placeholder="https://..."
              value={formData.avatar_url}
              onChange={e => setFormData({ ...formData, avatar_url: e.target.value })}
              style={{ marginBottom: '8px' }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Или выберите готовую:</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                {avatarPresets.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setFormData({ ...formData, avatar_url: preset })}
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      overflow: 'hidden',
                      border: formData.avatar_url === preset ? '2px solid var(--color-teal)' : '1px solid var(--border-subtle)',
                      padding: 0,
                      cursor: 'pointer'
                    }}
                  >
                    <img src={preset} alt="preset" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </button>
                ))}
                {formData.avatar_url && (
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, avatar_url: '' })}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--color-raspberry)',
                      fontSize: '11px',
                      cursor: 'pointer'
                    }}
                  >
                    Сбросить
                  </button>
                )}
              </div>
            </div>
          </div>

          <div style={{ marginTop: '16px' }}>
            <label className="text-label-muted">О себе / Дополнительная контактная информация:</label>
            <textarea
              className="form-input"
              rows={3}
              placeholder="Квалификация, сертификаты, примечания..."
              value={formData.bio}
              onChange={e => setFormData({ ...formData, bio: e.target.value })}
            />
          </div>
        </div>

        {/* BLOCK 2: CONTACTS & CONFIRMATION */}
        <div style={{ marginBottom: '28px', borderTop: '1px solid var(--border-subtle)', paddingTop: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <span className="text-label" style={{ color: 'var(--color-raspberry)', margin: 0 }}>
              2. Контактные данные и подтверждение
            </span>
            <button
              type="button"
              onClick={handleSendCode}
              style={{
                background: 'var(--color-teal-light)',
                border: '1px solid rgba(56, 185, 173, 0.4)',
                color: 'var(--color-teal)',
                fontSize: '12px',
                fontWeight: '700',
                padding: '4px 12px',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              {codeSent ? 'Отправить код повторно' : 'Запросить SMS / Email код'}
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
            <div>
              <label className="text-label-muted">Номер телефона:</label>
              <input
                type="text"
                className="form-input"
                value={formData.phone}
                onChange={e => setFormData({ ...formData, phone: e.target.value })}
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
            <div>
              <label className="text-label-muted">Код подтверждения смены контактов:</label>
              <input
                type="text"
                className="form-input"
                placeholder="Код: 1234"
                value={formData.verification_code}
                onChange={e => setFormData({ ...formData, verification_code: e.target.value })}
              />
            </div>
          </div>

          {codeMsg && (
            <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--color-green)', fontWeight: '600' }}>
              ✓ {codeMsg}
            </div>
          )}
        </div>

        {/* BLOCK 3: CHANGE PASSWORD */}
        <div style={{ marginBottom: '28px', borderTop: '1px solid var(--border-subtle)', paddingTop: '20px' }}>
          <span className="text-label" style={{ color: 'var(--color-gold)', marginBottom: '14px', display: 'block' }}>
            3. Безопасность и смена пароля (заполняйте только при смене)
          </span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
            <div>
              <label className="text-label-muted">Текущий пароль:</label>
              <input
                type="password"
                className="form-input"
                placeholder="••••••••"
                value={formData.current_password}
                onChange={e => setFormData({ ...formData, current_password: e.target.value })}
              />
            </div>
            <div>
              <label className="text-label-muted">Новый пароль:</label>
              <input
                type="password"
                className="form-input"
                placeholder="••••••••"
                value={formData.new_password}
                onChange={e => setFormData({ ...formData, new_password: e.target.value })}
              />
            </div>
            <div>
              <label className="text-label-muted">Повтор нового пароля:</label>
              <input
                type="password"
                className="form-input"
                placeholder="••••••••"
                value={formData.confirm_new_password}
                onChange={e => setFormData({ ...formData, confirm_new_password: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* BLOCK 4: SPECIALIST ATTACHED WORK INFO (READ-ONLY) */}
        {specialistInfo && (
          <div style={{
            marginBottom: '28px',
            borderTop: '1px solid var(--border-subtle)',
            paddingTop: '20px',
            background: 'var(--surface-secondary)',
            padding: '16px',
            borderRadius: '8px'
          }}>
            <span className="text-label" style={{ color: 'var(--color-teal)', marginBottom: '10px', display: 'block' }}>
              Рабочие параметры практики (управляются руководством)
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', fontSize: '13px' }}>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Специализация:</span>
                <div><strong style={{ color: 'var(--text-bright)' }}>{specialistInfo.specialty}</strong></div>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Базовая ставка:</span>
                <div><strong style={{ color: 'var(--color-green)' }}>{specialistInfo.base_rate?.toLocaleString('ru-RU')} ₸</strong></div>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Процент распределения:</span>
                <div><strong style={{ color: 'var(--color-teal)' }}>{specialistInfo.default_percentage}%</strong></div>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>График:</span>
                <div><strong style={{ color: 'var(--text-bright)' }}>{specialistInfo.work_hours_start} — {specialistInfo.work_hours_end}</strong></div>
              </div>
            </div>
          </div>
        )}

        {/* SUBMIT BUTTON */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid var(--border-subtle)', paddingTop: '20px' }}>
          <button
            type="submit"
            disabled={saving}
            className="btn-primary-cta"
            style={{ padding: '12px 28px', fontSize: '14px' }}
          >
            <SvgIcon name="check" size={16} color="#FFFFFF" />
            <span>{saving ? 'Сохранение данных...' : 'Сохранить изменения'}</span>
          </button>
        </div>
      </form>

    </div>
  );
};
