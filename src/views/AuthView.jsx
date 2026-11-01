import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { SvgIcon } from '../components/icons/CustomIcons';
import { startTelegramVerification, verifyTelegramCode } from '../services/telegramVerification';

export const AuthView = () => {
  const { login, register, resetPassword } = useAuth();
  const [activeTab, setActiveTab] = useState('login'); // 'login' | 'register' | 'reset'

  // Login form state
  const [loginInput, setLoginInput] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState(null);
  const [loginLoading, setLoginLoading] = useState(false);
  const [unconfirmedEmail, setUnconfirmedEmail] = useState(null);
  const [resendStatus, setResendStatus] = useState(null);

  // Register form state
  const [regForm, setRegForm] = useState({
    first_name: '',
    last_name: '',
    middle_name: '',
    countryCode: '+7',
    phoneRaw: '',
    email: '',
    role: 'specialist',
    password: '',
    confirm_password: '',
    verification_code: ''
  });
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [smsSent, setSmsSent] = useState(false);
  const [smsCooldown, setSmsCooldown] = useState(0);
  const [codeStatusMsg, setCodeStatusMsg] = useState(null);
  const [regSuccessMsg, setRegSuccessMsg] = useState(null);
  const [regError, setRegError] = useState(null);
  const [regLoading, setRegLoading] = useState(false);

  // Reset form state
  const [resetInput, setResetInput] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetMsg, setResetMsg] = useState(null);
  const [resetError, setResetError] = useState(null);

  // Countdown timer for SMS resend
  useEffect(() => {
    let timer;
    if (smsCooldown > 0) {
      timer = setTimeout(() => setSmsCooldown(smsCooldown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [smsCooldown]);

  const getFullPhone = () => {
    const raw = regForm.phoneRaw.replace(/\D/g, '');
    return `${regForm.countryCode}${raw}`;
  };

  // Handle Login
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoginError(null);
    setUnconfirmedEmail(null);
    setResendStatus(null);
    setLoginLoading(true);
    try {
      await login(loginInput.trim(), loginPassword);
    } catch (err) {
      setLoginError(err.message);
      if (err.message && err.message.toLowerCase().includes('электронная почта не подтверждена')) {
        setUnconfirmedEmail(loginInput.trim().includes('@') ? loginInput.trim() : null);
      }
    } finally {
      setLoginLoading(false);
    }
  };

  // Resend email confirmation
  const handleResendConfirmation = async () => {
    const emailTarget = unconfirmedEmail || loginInput.trim();
    if (!emailTarget || !emailTarget.includes('@')) {
      alert('Укажите ваш email для повторной отправки письма');
      return;
    }
    try {
      const res = await fetch('/api/auth/resend-confirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailTarget })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка отправки');
      setResendStatus(data.message);
    } catch (err) {
      alert(err.message);
    }
  };

  // Send SMS Verification Code
  const handleSendSmsCode = async () => {
    const fullPhone = getFullPhone();
    const rawDigits = regForm.phoneRaw.replace(/\D/g, '');
    if (rawDigits.length < 8) {
      setRegError('Укажите корректный номер телефона для отправки SMS');
      return;
    }

    setRegError(null);
    setCodeStatusMsg(null);
    try {
      const res = await fetch('/api/auth/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: fullPhone, purpose: 'register' })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Не удалось отправить SMS');

      setSmsSent(true);
      setSmsCooldown(60);
      setCodeStatusMsg(data.message);
      if (data.code) {
        // Auto-fill code in dev testing
        setRegForm(prev => ({ ...prev, verification_code: data.code }));
      }
    } catch (err) {
      setRegError(err.message);
    }
  };

  const [tgLink, setTgLink] = useState(null);
  const [tgLoading, setTgLoading] = useState(false);

  const handleStartTelegramAuth = async () => {
    const fullPhone = getFullPhone();
    const rawDigits = regForm.phoneRaw.replace(/\D/g, '');
    if (rawDigits.length < 8) {
      setRegError('Укажите корректный номер телефона');
      return;
    }

    setRegError(null);
    setTgLoading(true);
    try {
      const res = await startTelegramVerification(0, fullPhone);
      setTgLink(res.link);
      setSmsSent(true);
      setSmsCooldown(60);
      setCodeStatusMsg('Бот открыт в Telegram! Нажмите «📱 Поделиться номером» и введите 6-значный код:');
      if (res.link) {
        window.open(res.link, '_blank', 'noopener,noreferrer');
      }
    } catch (err) {
      setRegError(err.message || 'Ошибка запуска Telegram верификации');
    } finally {
      setTgLoading(false);
    }
  };

  // Verify Phone Code
  const handleVerifySmsCode = async () => {
    const fullPhone = getFullPhone();
    if (!regForm.verification_code || regForm.verification_code.trim().length < 4) {
      setRegError('Введите 6-значный код из SMS');
      return;
    }

    setRegError(null);
    try {
      const res = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: fullPhone, code: regForm.verification_code.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Неверный код подтверждения');

      setPhoneVerified(true);
      setCodeStatusMsg('Номер телефона успешно подтверждён!');
    } catch (err) {
      setRegError(err.message);
    }
  };

  // Handle Register
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setRegError(null);

    const fullPhone = getFullPhone();
    const cleanEmail = regForm.email.trim();

    // Email format validation
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(cleanEmail)) {
      setRegError('Укажите корректный существующий адрес электронной почты (например, name@mail.kz)');
      return;
    }

    if (!phoneVerified) {
      setRegError('Пожалуйста, подтвердите ваш номер телефона через SMS-код перед отправкой заявки');
      return;
    }

    if (regForm.password !== regForm.confirm_password) {
      setRegError('Введённые пароли не совпадают');
      return;
    }

    if (regForm.password.length < 6) {
      setRegError('Пароль должен содержать не менее 6 символов');
      return;
    }

    setRegLoading(true);
    try {
      const res = await register({
        first_name: regForm.first_name.trim(),
        last_name: regForm.last_name.trim(),
        middle_name: regForm.middle_name.trim(),
        phone: fullPhone,
        email: cleanEmail,
        role: regForm.role,
        roleRequest: regForm.role,
        password: regForm.password,
        verification_code: regForm.verification_code
      });

      setRegSuccessMsg(res.message);
      setRegForm({
        first_name: '',
        last_name: '',
        middle_name: '',
        countryCode: '+7',
        phoneRaw: '',
        email: '',
        role: 'specialist',
        password: '',
        confirm_password: '',
        verification_code: ''
      });
      setPhoneVerified(false);
      setSmsSent(false);
    } catch (err) {
      setRegError(err.message);
    } finally {
      setRegLoading(false);
    }
  };

  // Handle Reset Password
  const handleResetSubmit = async (e) => {
    e.preventDefault();
    setResetError(null);
    try {
      const res = await resetPassword({
        login: resetInput.trim(),
        code: resetCode.trim(),
        new_password: resetNewPassword
      });
      setResetMsg(res.message);
      setTimeout(() => {
        setActiveTab('login');
        setResetMsg(null);
      }, 2500);
    } catch (err) {
      setResetError(err.message);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '24px 16px',
      background: 'var(--bg-main)',
      fontFamily: 'var(--font-family)'
    }}>
      {/* Brand Header */}
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <div style={{
          width: '84px',
          height: '84px',
          borderRadius: '50%',
          overflow: 'hidden',
          margin: '0 auto 12px auto',
          boxShadow: '0 4px 16px rgba(56, 185, 173, 0.2)',
          border: '2px solid rgba(56, 185, 173, 0.3)',
          background: '#FFFFFF'
        }}>
          <img
            src="/logo.png"
            alt="Asar Qadam"
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        </div>
        <h1 style={{
          fontSize: '28px',
          fontWeight: '900',
          letterSpacing: '-0.02em',
          margin: '0 0 4px 0',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '6px'
        }}>
          <span style={{ color: 'var(--color-teal)' }}>Asar</span>
          <span style={{ color: 'var(--color-raspberry)' }}>Qadam</span>
        </h1>
        <div style={{
          fontSize: '12px',
          fontWeight: '700',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--text-muted)'
        }}>
          Смарт CRM/ERP коррекционного центра
        </div>
      </div>

      {/* Main Auth Card */}
      <div className="auth-card" style={{
        width: '100%',
        maxWidth: '480px',
        background: 'var(--surface-primary)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '16px',
        boxShadow: '0 8px 32px rgba(69, 66, 75, 0.08)',
        padding: '30px 26px',
        position: 'relative'
      }}>
        {/* Top Tab Bar */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid var(--border-subtle)',
          marginBottom: '22px'
        }}>
          <button
            type="button"
            onClick={() => { setActiveTab('login'); setLoginError(null); }}
            style={{
              flex: 1,
              padding: '12px 0',
              textAlign: 'center',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'login' ? '3px solid var(--color-teal)' : '3px solid transparent',
              color: activeTab === 'login' ? 'var(--color-teal)' : 'var(--text-muted)',
              fontSize: '15px',
              fontWeight: activeTab === 'login' ? '800' : '600',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            Вход в систему
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('register'); setRegError(null); setRegSuccessMsg(null); }}
            style={{
              flex: 1,
              padding: '12px 0',
              textAlign: 'center',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'register' ? '3px solid var(--color-raspberry)' : '3px solid transparent',
              color: activeTab === 'register' ? 'var(--color-raspberry)' : 'var(--text-muted)',
              fontSize: '15px',
              fontWeight: activeTab === 'register' ? '800' : '600',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            Регистрация
          </button>
        </div>

        {/* TAB 1: LOGIN */}
        {activeTab === 'login' && (
          <form onSubmit={handleLoginSubmit}>
            <div style={{ marginBottom: '16px' }}>
              <label className="text-label-muted">Номер телефона или Email:</label>
              <input
                type="text"
                className="form-input"
                placeholder="+7 701 ... или example@domain.kz"
                value={loginInput}
                onChange={e => setLoginInput(e.target.value)}
                required
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label className="text-label-muted" style={{ margin: 0 }}>Пароль:</label>
                <button
                  type="button"
                  onClick={() => { setActiveTab('reset'); setResetError(null); }}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '12px',
                    color: 'var(--color-teal)',
                    cursor: 'pointer',
                    fontWeight: '600',
                    padding: 0
                  }}
                >
                  Забыли пароль?
                </button>
              </div>
              <input
                type="password"
                className="form-input"
                placeholder="••••••••"
                value={loginPassword}
                onChange={e => setLoginPassword(e.target.value)}
                required
              />
            </div>

            {loginError && (
              <div style={{
                background: 'var(--color-pink)',
                border: '1px solid rgba(200, 63, 120, 0.4)',
                color: 'var(--color-raspberry)',
                padding: '12px 14px',
                borderRadius: '8px',
                fontSize: '13px',
                lineHeight: 1.5,
                marginBottom: '18px',
                fontWeight: '600'
              }}>
                <div>{loginError}</div>
                {unconfirmedEmail && (
                  <button
                    type="button"
                    onClick={handleResendConfirmation}
                    style={{
                      marginTop: '8px',
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
                    Отправить письмо подтверждения повторно
                  </button>
                )}
                {resendStatus && (
                  <div style={{ marginTop: '6px', color: 'var(--color-green)', fontSize: '12px' }}>
                    {resendStatus}
                  </div>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={loginLoading}
              className="btn-primary-cta"
              style={{
                width: '100%',
                justifyContent: 'center',
                padding: '12px 16px',
                fontSize: '15px'
              }}
            >
              <span>{loginLoading ? 'Авторизация...' : 'Войти в рабочий кабинет'}</span>
            </button>
          </form>
        )}

        {/* TAB 2: REGISTER */}
        {activeTab === 'register' && (
          <div>
            {regSuccessMsg ? (
              <div style={{
                background: 'var(--color-green-light)',
                border: '1px solid rgba(112, 183, 126, 0.4)',
                color: 'var(--color-green)',
                padding: '20px 16px',
                borderRadius: '10px',
                textAlign: 'center',
                lineHeight: 1.6
              }}>
                <div style={{ fontSize: '28px', marginBottom: '6px' }}>✓</div>
                <div style={{ fontSize: '16px', fontWeight: '800', marginBottom: '6px' }}>
                  Заявка сохранена в Supabase!
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-primary)', marginBottom: '14px' }}>
                  {regSuccessMsg}
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('login')}
                  className="btn-secondary"
                  style={{ width: '100%' }}
                >
                  Перейти к форме входа
                </button>
              </div>
            ) : (
              <form onSubmit={handleRegisterSubmit}>
                {/* 1. Full Name */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                  <div>
                    <label className="text-label-muted">Имя *:</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Имя"
                      value={regForm.first_name}
                      onChange={e => setRegForm({ ...regForm, first_name: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-label-muted">Фамилия *:</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Фамилия"
                      value={regForm.last_name}
                      onChange={e => setRegForm({ ...regForm, last_name: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div style={{ marginBottom: '10px' }}>
                  <label className="text-label-muted">Отчество (при наличии):</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Отчество"
                    value={regForm.middle_name}
                    onChange={e => setRegForm({ ...regForm, middle_name: e.target.value })}
                  />
                </div>

                {/* 2. Role Selector (Requirement #5) */}
                <div style={{ marginBottom: '12px' }}>
                  <label className="text-label-muted">Желаемая роль в системе *:</label>
                  <select
                    className="form-select"
                    value={regForm.role}
                    onChange={e => setRegForm({ ...regForm, role: e.target.value })}
                    style={{ background: 'var(--surface-white)' }}
                  >
                    <option value="specialist">Специалист центра (терапевт / педагог)</option>
                    <option value="admin">Администратор филиала</option>
                    <option value="director">Руководитель (Директор)</option>
                    <option value="owner">Владелец центра</option>
                  </select>
                </div>

                {/* 3. Phone with Country Selector & SMS OTP (Requirement #4) */}
                <div style={{
                  padding: '12px',
                  background: 'var(--surface-subtle)',
                  borderRadius: '10px',
                  border: `1px solid ${phoneVerified ? 'rgba(112, 183, 126, 0.6)' : 'var(--border-medium)'}`,
                  marginBottom: '12px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <label className="text-label-muted" style={{ margin: 0 }}>Номер телефона *:</label>
                    {phoneVerified ? (
                      <span style={{ fontSize: '11px', color: 'var(--color-green)', fontWeight: '800' }}>
                        ✓ Номер подтверждён
                      </span>
                    ) : (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={handleStartTelegramAuth}
                          disabled={smsCooldown > 0 || tgLoading}
                          style={{
                            background: '#16161D',
                            border: '1px solid #2D2D38',
                            color: '#F47920',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: '700',
                            cursor: smsCooldown > 0 ? 'default' : 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px'
                          }}
                        >
                          <SvgIcon name="telegram" size={13} color="#F47920" />
                          <span>{smsCooldown > 0 ? `${smsCooldown}с` : 'Telegram-код'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleSendSmsCode}
                          disabled={smsCooldown > 0}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: smsCooldown > 0 ? 'var(--text-muted)' : 'var(--text-secondary)',
                            fontSize: '11px',
                            fontWeight: '700',
                            cursor: smsCooldown > 0 ? 'default' : 'pointer',
                            padding: 0
                          }}
                        >
                          {smsSent ? 'Повтор SMS' : 'SMS'}
                        </button>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: '8px', marginBottom: '8px' }}>
                    <select
                      className="form-select"
                      value={regForm.countryCode}
                      onChange={e => setRegForm({ ...regForm, countryCode: e.target.value })}
                      disabled={phoneVerified}
                    >
                      <option value="+7">KZ/RU (+7)</option>
                      <option value="+998">UZ (+998)</option>
                      <option value="+996">KG (+996)</option>
                      <option value="+">Другая (+)</option>
                    </select>
                    <input
                      type="tel"
                      className="form-input"
                      placeholder="701 123 4567"
                      value={regForm.phoneRaw}
                      onChange={e => setRegForm({ ...regForm, phoneRaw: e.target.value })}
                      disabled={phoneVerified}
                      required
                    />
                  </div>

                  {smsSent && !phoneVerified && (
                    <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                      <input
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={6}
                        className="form-input"
                        placeholder="6-значный код (Telegram/SMS)"
                        value={regForm.verification_code}
                        onChange={e => setRegForm({ ...regForm, verification_code: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                        style={{ flex: 1, letterSpacing: '0.15em', fontWeight: '700' }}
                      />
                      <button
                        type="button"
                        onClick={handleVerifySmsCode}
                        className="btn-primary-cta"
                        style={{ padding: '8px 14px', fontSize: '12px' }}
                      >
                        Подтвердить
                      </button>
                    </div>
                  )}

                  {codeStatusMsg && (
                    <div style={{ fontSize: '11px', color: phoneVerified ? 'var(--color-green)' : 'var(--text-secondary)', marginTop: '4px', fontWeight: '600' }}>
                      {codeStatusMsg}
                    </div>
                  )}
                </div>

                {/* 4. Real Email Input */}
                <div style={{ marginBottom: '12px' }}>
                  <label className="text-label-muted">Реальный Email * (для отправки ссылки подтверждения):</label>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="name@example.kz"
                    value={regForm.email}
                    onChange={e => setRegForm({ ...regForm, email: e.target.value })}
                    required
                  />
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginTop: '3px' }}>
                    На этот ящик через Supabase Auth будет отправлено письмо для подтверждения реального существования.
                  </span>
                </div>

                {/* 5. Password */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
                  <div>
                    <label className="text-label-muted">Пароль *:</label>
                    <input
                      type="password"
                      className="form-input"
                      placeholder="••••••••"
                      value={regForm.password}
                      onChange={e => setRegForm({ ...regForm, password: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-label-muted">Повтор пароля *:</label>
                    <input
                      type="password"
                      className="form-input"
                      placeholder="••••••••"
                      value={regForm.confirm_password}
                      onChange={e => setRegForm({ ...regForm, confirm_password: e.target.value })}
                      required
                    />
                  </div>
                </div>

                {regError && (
                  <div style={{
                    background: 'var(--color-pink)',
                    border: '1px solid rgba(200, 63, 120, 0.4)',
                    color: 'var(--color-raspberry)',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    marginBottom: '14px',
                    fontWeight: '600'
                  }}>
                    {regError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={regLoading}
                  className="btn-primary-cta"
                  style={{
                    width: '100%',
                    justifyContent: 'center',
                    padding: '12px 16px',
                    fontSize: '15px'
                  }}
                >
                  <span>{regLoading ? 'Отправка заявки...' : 'Зарегистрироваться в Asar Qadam'}</span>
                </button>
              </form>
            )}
          </div>
        )}

        {/* TAB 3: RESET PASSWORD */}
        {activeTab === 'reset' && (
          <form onSubmit={handleResetSubmit}>
            <div style={{ marginBottom: '14px' }}>
              <label className="text-label-muted">Телефон или Email аккаунта:</label>
              <input
                type="text"
                className="form-input"
                placeholder="+7 701 ... или example@domain.kz"
                value={resetInput}
                onChange={e => setResetInput(e.target.value)}
                required
              />
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label className="text-label-muted">Код подтверждения (SMS/Email):</label>
              <input
                type="text"
                className="form-input"
                placeholder="6-значный код"
                value={resetCode}
                onChange={e => setResetCode(e.target.value)}
                required
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label className="text-label-muted">Новый пароль:</label>
              <input
                type="password"
                className="form-input"
                placeholder="Минимум 6 символов"
                value={resetNewPassword}
                onChange={e => setResetNewPassword(e.target.value)}
                required
              />
            </div>

            {resetError && (
              <div style={{
                background: 'var(--color-pink)',
                border: '1px solid rgba(200, 63, 120, 0.4)',
                color: 'var(--color-raspberry)',
                padding: '10px 12px',
                borderRadius: '8px',
                fontSize: '12px',
                marginBottom: '14px',
                fontWeight: '600'
              }}>
                {resetError}
              </div>
            )}

            {resetMsg && (
              <div style={{
                background: 'var(--color-green-light)',
                border: '1px solid rgba(112, 183, 126, 0.4)',
                color: 'var(--color-green)',
                padding: '10px 12px',
                borderRadius: '8px',
                fontSize: '12px',
                marginBottom: '14px',
                fontWeight: '600'
              }}>
                {resetMsg}
              </div>
            )}

            <button
              type="submit"
              className="btn-primary-cta"
              style={{
                width: '100%',
                justifyContent: 'center',
                padding: '12px 16px',
                fontSize: '15px'
              }}
            >
              Сохранить новый пароль
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('login')}
              className="btn-secondary"
              style={{ width: '100%', marginTop: '10px', textAlign: 'center' }}
            >
              Отмена
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
