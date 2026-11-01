import React, { useEffect } from 'react';
import { SvgIcon } from './icons/CustomIcons';

export const Modal = ({ isOpen, onClose, title, subtitle, children, maxWidth = '640px' }) => {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      className="modal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(42, 39, 47, 0.45)',
        backdropFilter: 'blur(5px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}
      onClick={onClose}
    >
      <div 
        className="modal-card"
        style={{
          background: 'var(--surface-white)',
          border: '1px solid var(--border-light)',
          borderTop: '4px solid var(--color-teal)',
          borderRadius: 'var(--radius-md)',
          width: '100%',
          maxWidth,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--shadow-modal)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--border-light)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--surface-white)'
        }}>
          <div>
            <span className="text-label" style={{ display: 'block', marginBottom: '2px' }}>
              {subtitle || 'ASAR QADAM CRM'}
            </span>
            <h2 style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-dark)' }}>
              {title}
            </h2>
          </div>
          <button 
            onClick={onClose}
            style={{
              background: 'var(--surface-subtle)',
              border: '1px solid var(--border-light)',
              borderRadius: '50%',
              cursor: 'pointer',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease'
            }}
          >
            <SvgIcon name="close" size={16} color="var(--text-secondary)" />
          </button>
        </div>

        {/* Content */}
        <div style={{
          padding: '24px',
          overflowY: 'auto',
          flex: 1,
          background: 'var(--surface-white)'
        }}>
          {children}
        </div>
      </div>
    </div>
  );
};
