import React from 'react';
import { useAuth } from '../context/AuthContext';
import { SvgIcon } from './icons/CustomIcons';

export const Navigation = ({ currentView, onViewChange, isOpen, onClose }) => {
  const { user, logout, canAccessAccounting, canManageUsers, canManagePayroll, canUseAi } = useAuth();

  const roleLabels = {
    owner: 'Владелец',
    director: 'Руководитель',
    admin: 'Администратор',
    specialist: 'Специалист'
  };

  const navItems = [
    { id: 'dashboard', label: 'Главная панель', icon: 'dashboard', color: 'var(--color-teal)', bg: 'var(--color-teal-light)', allowed: true },
    { id: 'schedule', label: 'Умное расписание', icon: 'calendar', color: 'var(--color-teal)', bg: 'var(--color-teal-light)', allowed: true },
    { id: 'children', label: 'Карточки детей', icon: 'child', color: 'var(--color-gold-dark)', bg: 'var(--color-gold-light)', allowed: true },
    { id: 'specialists', label: 'Специалисты', icon: 'users', color: 'var(--color-green-dark)', bg: 'var(--color-green-light)', allowed: true },
    { id: 'attendance', label: 'Посещаемость', icon: 'check', color: 'var(--color-green-dark)', bg: 'var(--color-green-light)', allowed: true },
    { id: 'accounting', label: 'Бухгалтерия', icon: 'finance', color: 'var(--color-teal-dark)', bg: 'var(--color-teal-light)', allowed: canAccessAccounting },
    { id: 'payroll', label: 'Заработная плата', icon: 'payroll', color: 'var(--color-gold-dark)', bg: 'var(--color-gold-light)', allowed: canManagePayroll },
    { id: 'ai', label: 'AI-Бухгалтер', icon: 'ai', color: 'var(--color-blue-dark)', bg: 'var(--color-blue-light)', allowed: canUseAi },
    { id: 'users', label: 'Заявки и доступ', icon: 'users', color: 'var(--color-raspberry)', bg: 'var(--color-raspberry-light)', allowed: canManageUsers },
    { id: 'audit', label: 'Журнал аудита', icon: 'audit', color: 'var(--text-main)', bg: 'var(--surface-subtle)', allowed: canManageUsers },
    { id: 'profile', label: 'Мой профиль', icon: 'user', color: 'var(--color-teal-dark)', bg: 'var(--color-teal-light)', allowed: true }
  ];

  const handleSelectView = (viewId) => {
    onViewChange(viewId);
    if (onClose) onClose();
  };

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      {isOpen && (
        <div 
          className="mobile-nav-backdrop" 
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside className={`sidebar-nav ${isOpen ? 'mobile-nav-open' : ''}`} style={{
        width: '270px',
        minWidth: '270px',
        height: '100vh',
        position: 'sticky',
        top: 0,
        background: 'var(--surface-white)',
        borderRight: '1px solid var(--border-light)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        boxShadow: 'var(--shadow-sm)',
        zIndex: 1000
      }}>
        {/* Brand Header with Authentic Emblem & Mobile Close */}
        <div>
          <div style={{
            padding: '18px 18px',
            borderBottom: '1px solid var(--border-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--surface-white)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {/* Circular Center Emblem Image */}
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                overflow: 'hidden',
                boxShadow: '0 2px 8px rgba(56, 185, 173, 0.15)',
                border: '2px solid var(--border-light)',
                flexShrink: 0,
                background: '#FFFFFF'
              }}>
                <img 
                  src="/logo.png" 
                  alt="Asar Qadam Emblem" 
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                />
              </div>

              <div>
                <div style={{
                  fontSize: '17px',
                  fontWeight: '900',
                  letterSpacing: '-0.01em',
                  lineHeight: 1.15
                }}>
                  <span style={{ color: 'var(--color-teal)' }}>Asar </span>
                  <span style={{ color: 'var(--color-raspberry)' }}>Qadam</span>
                </div>
                <div style={{
                  fontSize: '10px',
                  color: 'var(--text-secondary)',
                  fontWeight: '700',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  marginTop: '2px'
                }}>
                  Коррекционный центр
                </div>
              </div>
            </div>

            {/* Close button visible on mobile */}
            {isOpen && (
              <button
                onClick={onClose}
                className="mobile-only"
                style={{
                  background: 'var(--surface-subtle)',
                  border: '1px solid var(--border-light)',
                  borderRadius: '6px',
                  padding: '6px',
                  cursor: 'pointer',
                  color: 'var(--text-secondary)'
                }}
                aria-label="Закрыть меню"
              >
                <SvgIcon name="close" size={16} />
              </button>
            )}
          </div>

          {/* Navigation Links */}
          <nav style={{ padding: '12px 10px', maxHeight: 'calc(100vh - 270px)', overflowY: 'auto' }}>
            {navItems.filter(item => item.allowed).map((item) => {
              const isActive = currentView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleSelectView(item.id)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '8px 12px',
                    marginBottom: '2px',
                    borderRadius: 'var(--radius-sm)',
                    border: isActive ? `1px solid ${item.color}` : '1px solid transparent',
                    background: isActive ? item.bg : 'transparent',
                    color: isActive ? item.color : 'var(--text-main)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontSize: '13.5px',
                    fontWeight: isActive ? '700' : '500',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: isActive ? '#FFFFFF' : 'transparent',
                    color: isActive ? item.color : 'var(--text-secondary)',
                    flexShrink: 0
                  }}>
                    <SvgIcon 
                      name={item.icon} 
                      size={16} 
                      color={isActive ? item.color : 'var(--text-secondary)'} 
                    />
                  </div>
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* User Status & Fast Role Switcher & Profile link */}
        <div style={{
          padding: '14px',
          borderTop: '1px solid var(--border-light)',
          background: 'var(--surface-subtle)'
        }}>
          {/* User Profile Quick Card - Clickable to Profile */}
          <div 
            onClick={() => handleSelectView('profile')}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              padding: '6px 8px',
              borderRadius: 'var(--radius-sm)',
              background: currentView === 'profile' ? 'var(--color-teal-light)' : '#FFFFFF',
              border: `1px solid ${currentView === 'profile' ? 'var(--color-teal)' : 'var(--border-light)'}`,
              cursor: 'pointer',
              marginBottom: '10px',
              transition: 'all 0.15s ease'
            }}
            title="Перейти в Мой профиль"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: 'var(--color-teal-light)',
                color: 'var(--color-teal-dark)',
                fontWeight: '800',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                border: '1px solid var(--color-teal)'
              }}>
                {user?.name ? user.name.charAt(0) : 'A'}
              </div>
              <div style={{ overflow: 'hidden' }}>
                <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-dark)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                  {user ? user.name : 'Пользователь'}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>
                  {user?.branch || 'Центр Asar Qadam'}
                </div>
              </div>
            </div>

            {/* Logout Icon Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (window.confirm('Вы действительно хотите выйти из системы Asar Qadam?')) {
                  logout();
                }
              }}
              style={{
                background: 'transparent',
                border: 'none',
                padding: '4px',
                cursor: 'pointer',
                color: 'var(--text-muted)',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              title="Выйти из системы"
            >
              <SvgIcon name="logout" size={16} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
