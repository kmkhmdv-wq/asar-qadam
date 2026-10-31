import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { SvgIcon } from '../components/icons/CustomIcons';

export const AuthView = () => {
  const { login, register, switchRole, sendVerificationCode, resetPassword } = useAuth();
  const [activeTab, setActiveTab] = useState('login'); // 'login' | 'register' | 'reset'

  // Login form state
  const [loginInput, setLoginInput] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState(null);
  const [loginLoading, setLoginLoading] = useState(false);

  // Register form state
  const [regForm, setRegForm] = useState({
    first_name: '',
    last_name: '',
    middle_name: '',
    phone: '+7 ',
    email: '',
    password: '',
    confirm_password: '',
    verification_code: ''
  });
  const [codeSent, setCodeSent] = useState(false);
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

  // Handle Login
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoginError(null);
    setLoginLoading(true);
    try {
      await login(loginInput.trim(), loginPassword);
    } catch (err) {
      setLoginError(err.message);
    } finally {
      setLoginLoading(false);
    }
  };

  // Handle Send Verification Code for Registration
  const handleSendRegCode = async () => {
    const target = regForm.phone.trim().length > 4 ? regForm.phone.trim() : regForm.email.trim();
    if (!target) {
      setRegError('Укажите номер телефона или email для получения кода');
      return;
    }
    setRegError(null);
    try {
      const res = await sendVerificationCode(target, 'register');
      setCodeSent(true);
      setCodeStatusMsg(res.message);
      setRegForm({ ...regForm, verification_code: '1234' }); // auto-fill simulated code
    } catch (err) {
      setRegError(err.message);
    }
  };

  // Handle Register
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setRegError(null);

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
      const res = await register(regForm);
      setRegSuccessMsg(res.message);
      setRegForm({
        first_name: '',
        last_name: '',
        middle_name: '',
        phone: '+7 ',
        email: '',
        password: '',
        confirm_password: '',
        verification_code: ''
      });
      setCodeSent(false);
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
        login: resetInput,
        code: resetCode,
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
      <div style={{ textAlign: 'center', marginBottom: '28px' }}>
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
      <div style={{
        width: '100%',
        maxWidth: '460px',
        background: 'var(--surface-primary)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '16px',
        boxShadow: '0 8px 32px rgba(69, 66, 75, 0.08)',
        padding: '32px 28px',
        position: 'relative'
      }}>
        {/* Top Tab Bar */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid var(--border-subtle)',
          marginBottom: '24px'
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
            Войти в систему
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
            Регистрация сотрудника
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
                placeholder="+7 701 ... или example@asarqadam.kz"
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
                {loginError}
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
                padding: '18px',
                borderRadius: '10px',
                textAlign: 'center',
                lineHeight: 1.6
              }}>
                <div style={{ fontSize: '28px', marginBottom: '8px' }}>✓</div>
                <div style={{ fontSize: '16px', fontWeight: '800', marginBottom: '6px' }}>
                  Заявка успешно отправлена!
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-primary)' }}>
                  {regSuccessMsg}
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('login')}
                  className="btn-secondary"
                  style={{ marginTop: '16px', width: '100%' }}
                >
                  Вернуться к форме входа
                </button>
              </div>
            ) : (
              <form onSubmit={handleRegisterSubmit}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
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

                <div style={{ marginBottom: '12px' }}>
                  <label className="text-label-muted">Отчество (необязательно):</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Отчество"
                    value={regForm.middle_name}
                    onChange={e => setRegForm({ ...regForm, middle_name: e.target.value })}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                  <div>
                    <label className="text-label-muted">Телефон *:</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="+7 701 ..."
                      value={regForm.phone}
                      onChange={e => setRegForm({ ...regForm, phone: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-label-muted">Email:</label>
                    <input
                      type="email"
                      className="form-input"
                      placeholder="email@asarqadam.kz"
                      value={regForm.email}
                      onChange={e => setRegForm({ ...regForm, email: e.target.value })}
                    />
                  </div>
                </div>

                {/* Verification code section */}
                <div style={{
                  padding: '12px',
                  background: 'var(--surface-secondary)',
                  borderRadius: '8px',
                  border: '1px solid var(--border-subtle)',
                  marginBottom: '14px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-bright)' }}>
                      Подтверждение контакта
                    </span>
                    <button
                      type="button"
                      onClick={handleSendRegCode}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--color-teal)',
                        fontSize: '11px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        padding: 0
                      }}
                    >
                      {codeSent ? 'Отправить повторно' : 'Получить SMS-код'}
                    </button>
                  </div>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Код подтверждения (тестовый: 1234)"
                    value={regForm.verification_code}
                    onChange={e => setRegForm({ ...regForm, verification_code: e.target.value })}
                  />
                  {codeStatusMsg && (
                    <div style={{ fontSize: '11px', color: 'var(--color-green)', marginTop: '4px', fontWeight: '600' }}>
                      ✓ {codeStatusMsg}
                    </div>
                  )}
                </div>

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
                  <span>{regLoading ? 'Отправка...' : 'Отправить заявку на регистрацию'}</span>
                </button>
              </form>
            )}
          </div>
        )}

        {/* TAB 3: RESET PASSWORD */}
        {activeTab === 'reset' && (
          <form onSubmit={handleResetSubmit}>
            <div style={{ marginBottom: '14px' }}>
              <span className="text-label" style={{ color: 'var(--color-teal)', marginBottom: '8px', display: 'block' }}>
                Восстановление доступа
              </span>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 14px 0' }}>
                Введите ваш телефон или email, указанный при регистрации, и новый пароль.
              </p>
              <label className="text-label-muted">Логин (телефон или email):</label>
              <input
                type="text"
                className="form-input"
                placeholder="+7 701 ... или email@asarqadam.kz"
                value={resetInput}
                onChange={e => setResetInput(e.target.value)}
                required
              />
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label className="text-label-muted">Код подтверждения (тестовый: 1234):</label>
              <input
                type="text"
                className="form-input"
                placeholder="1234"
                value={resetCode}
                onChange={e => setResetCode(e.target.value)}
              />
            </div>

            <div style={{ marginBottom: '18px' }}>
              <label className="text-label-muted">Новый пароль:</label>
              <input
                type="password"
                className="form-input"
                placeholder="••••••••"
                value={resetNewPassword}
                onChange={e => setResetNewPassword(e.target.value)}
                required
              />
            </div>

            {resetError && (
              <div style={{
                background: 'var(--color-pink)',
                color: 'var(--color-raspberry)',
                padding: '10px 12px',
                borderRadius: '6px',
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
                color: 'var(--color-green)',
                padding: '10px 12px',
                borderRadius: '6px',
                fontSize: '12px',
                marginBottom: '14px',
                fontWeight: '600'
              }}>
                ✓ {resetMsg}
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setActiveTab('login')}
                className="btn-secondary"
                style={{ flex: 1 }}
              >
                Отмена
              </button>
              <button
                type="submit"
                className="btn-primary-cta"
                style={{ flex: 1.5, justifyContent: 'center' }}
              >
                Сохранить пароль
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Quick Test Login Bar for immediate role evaluation */}
      <div style={{
        marginTop: '24px',
        padding: '14px 20px',
        background: '#FFFFFF',
        border: '1px solid var(--border-subtle)',
        borderRadius: '12px',
        maxWidth: '460px',
        width: '100%',
        boxShadow: 'var(--shadow-subtle)',
        textAlign: 'center'
      }}>
        <div style={{
          fontSize: '11px',
          fontWeight: '800',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--text-muted)',
          marginBottom: '10px'
        }}>
          Быстрый вход для тестирования ролей (1 клик):
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '8px'
        }}>
          <button
            type="button"
            onClick={() => switchRole('owner')}
            className="btn-secondary"
            style={{ fontSize: '11px', padding: '7px 8px', borderColor: 'rgba(232, 188, 85, 0.4)', color: 'var(--color-gold)' }}
          >
            ★ Владелец
          </button>
          <button
            type="button"
            onClick={() => switchRole('director')}
            className="btn-secondary"
            style={{ fontSize: '11px', padding: '7px 8px', borderColor: 'rgba(200, 63, 120, 0.4)', color: 'var(--color-raspberry)' }}
          >
            ✦ Руководитель
          </button>
          <button
            type="button"
            onClick={() => switchRole('admin')}
            className="btn-secondary"
            style={{ fontSize: '11px', padding: '7px 8px', borderColor: 'rgba(104, 184, 229, 0.4)', color: 'var(--color-blue)' }}
          >
            ⚙ Администратор
          </button>
          <button
            type="button"
            onClick={() => switchRole('specialist')}
            className="btn-secondary"
            style={{ fontSize: '11px', padding: '7px 8px', borderColor: 'rgba(56, 185, 173, 0.4)', color: 'var(--color-teal)' }}
          >
            ● Специалист
          </button>
        </div>
      </div>
    </div>
  );
};
