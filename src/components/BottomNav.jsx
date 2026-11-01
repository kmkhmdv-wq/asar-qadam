import React from 'react';
import { SvgIcon } from './icons/CustomIcons';
import { useAuth } from '../context/AuthContext';

export const BottomNav = ({ currentView, onViewChange, onOpenMenu }) => {
  const { user } = useAuth();

  const items = [
    { id: 'dashboard', label: 'Главная', icon: 'dashboard' },
    { id: 'schedule', label: 'Расписание', icon: 'calendar' },
    { id: 'children', label: 'Дети', icon: 'child' },
    { id: 'attendance', label: 'Табель', icon: 'check' }
  ];

  return (
    <nav 
      className="mobile-bottom-nav" 
      aria-label="Мобильная навигация"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: '62px',
        background: 'var(--surface-white)',
        borderTop: '1px solid var(--border-light)',
        display: 'none', // Shown on mobile via CSS
        alignItems: 'center',
        justifyContent: 'space-around',
        zIndex: 990,
        boxShadow: '0 -2px 12px rgba(69, 66, 75, 0.08)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)'
      }}
    >
      {items.map(item => {
        const isActive = currentView === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onViewChange(item.id)}
            style={{
              background: 'transparent',
              border: 'none',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '3px',
              flex: 1,
              height: '100%',
              cursor: 'pointer',
              color: isActive ? '#F47920' : 'var(--text-secondary)',
              transition: 'all 0.15s ease',
              padding: '6px 0'
            }}
          >
            <div style={{
              width: '28px',
              height: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative'
            }}>
              <SvgIcon 
                name={item.icon} 
                size={18} 
                color={isActive ? '#F47920' : 'var(--text-secondary)'} 
              />
              {isActive && (
                <span style={{
                  position: 'absolute',
                  top: '-2px',
                  width: '4px',
                  height: '4px',
                  borderRadius: '50%',
                  background: '#F47920'
                }} />
              )}
            </div>
            <span style={{
              fontSize: '10.5px',
              fontWeight: isActive ? '800' : '600',
              letterSpacing: '-0.01em'
            }}>
              {item.label}
            </span>
          </button>
        );
      })}

      {/* Menu / All Sections Button */}
      <button
        type="button"
        onClick={onOpenMenu}
        style={{
          background: 'transparent',
          border: 'none',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '3px',
          flex: 1,
          height: '100%',
          cursor: 'pointer',
          color: 'var(--text-secondary)',
          transition: 'all 0.15s ease',
          padding: '6px 0'
        }}
      >
        <div style={{
          width: '28px',
          height: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <SvgIcon name="menu" size={18} color="var(--text-secondary)" />
        </div>
        <span style={{
          fontSize: '10.5px',
          fontWeight: '600',
          letterSpacing: '-0.01em'
        }}>
          Меню
        </span>
      </button>
    </nav>
  );
};
