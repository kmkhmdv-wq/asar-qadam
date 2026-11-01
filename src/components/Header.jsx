import React from 'react';
import { useAuth } from '../context/AuthContext';
import { SvgIcon } from './icons/CustomIcons';

export const Header = ({ title, subtitle, onQuickAction, quickActionLabel, onOpenMobileNav, onNavigateToProfile }) => {
  const { user } = useAuth();
  const todayStr = new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Asia/Almaty',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(new Date());

  return (
    <header className="app-main-header" style={{
      padding: '14px 24px',
      borderBottom: '1px solid var(--border-light)',
      background: 'var(--surface-white)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      position: 'sticky',
      top: 0,
      zIndex: 90,
      boxShadow: 'var(--shadow-sm)'
    }}>
      {/* Left Area: Hamburger (Mobile) + Title & Subtitle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
        {/* Mobile Hamburger Button */}
        {onOpenMobileNav && (
          <button
            onClick={onOpenMobileNav}
            className="mobile-only"
            style={{
              background: 'var(--surface-subtle)',
              border: '1px solid var(--border-light)',
              borderRadius: '8px',
              padding: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-dark)',
              flexShrink: 0
            }}
            aria-label="Открыть меню"
          >
            <SvgIcon name="menu" size={20} color="var(--text-dark)" />
          </button>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{
              fontSize: '11px',
              fontWeight: '700',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--color-teal)'
            }}>
              Asar Qadam CRM
            </span>
            <span style={{ color: 'var(--border-medium)' }} className="desktop-only">/</span>
            <span style={{
              fontSize: '11px',
              color: 'var(--color-teal-dark)',
              background: 'var(--color-teal-light)',
              padding: '2px 8px',
              borderRadius: 'var(--radius-full)',
              fontFamily: 'monospace',
              fontWeight: '600'
            }} className="desktop-only">
              Asia/Almaty · {todayStr}
            </span>
          </div>
          <h1 style={{ 
            fontSize: '20px', 
            fontWeight: '800', 
            color: 'var(--text-dark)', 
            letterSpacing: '-0.01em',
            margin: 0,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}>
            {title}
          </h1>
          {subtitle && (
            <p style={{ 
              fontSize: '12px', 
              color: 'var(--text-secondary)',
              margin: 0,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }} className="desktop-only">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {/* Right Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
        {quickActionLabel && onQuickAction && (
          <button 
            onClick={onQuickAction}
            className="btn-raspberry-cta desktop-only"
            style={{ padding: '8px 14px', fontSize: '13px' }}
          >
            <SvgIcon name="calendar" size={15} color="#FFFFFF" />
            <span>{quickActionLabel}</span>
          </button>
        )}

        {/* Profile Avatar Quick Shortcut */}
        {user && onNavigateToProfile && (
          <button
            onClick={onNavigateToProfile}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'var(--surface-subtle)',
              border: '1px solid var(--border-light)',
              borderRadius: 'var(--radius-full)',
              padding: '4px 10px 4px 4px',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            title="Перейти в личный профиль"
          >
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              background: 'var(--color-teal-light)',
              color: 'var(--color-teal-dark)',
              fontWeight: '800',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid var(--color-teal)'
            }}>
              {user.name ? user.name.charAt(0) : 'U'}
            </div>
            <span style={{
              fontSize: '12px',
              fontWeight: '700',
              color: 'var(--text-dark)'
            }} className="desktop-only">
              {user.first_name || user.name.split(' ')[0]}
            </span>
          </button>
        )}
      </div>
    </header>
  );
};
