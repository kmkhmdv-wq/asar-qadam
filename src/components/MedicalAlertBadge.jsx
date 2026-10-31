import React from 'react';
import { SvgIcon } from './icons/CustomIcons';

export const MedicalAlertBadge = ({ child, compact = false }) => {
  if (!child) return null;

  const alerts = [];
  if (child.has_asthma) alerts.push({ type: 'asthma', label: 'АСТМА' });
  if (child.has_epilepsy) alerts.push({ type: 'epilepsy', label: 'ЭПИЛЕПСИЯ' });
  if (child.has_allergy) alerts.push({ type: 'allergy', label: 'АЛЛЕРГИЯ' });
  if (child.chronic_diseases) alerts.push({ type: 'chronic', label: 'ХРОН. ЗАБОЛЕВАНИЕ' });

  if (alerts.length === 0) return null;

  if (compact) {
    return (
      <span 
        className="medical-alert-badge" 
        title={alerts.map(a => a.label).join(', ') + (child.contraindications ? ` | ${child.contraindications}` : '')}
      >
        <SvgIcon name="alert" size={12} color="var(--color-raspberry)" />
        <span>МЕД. ВНИМАНИЕ ({alerts.length})</span>
      </span>
    );
  }

  return (
    <div style={{
      background: 'var(--color-raspberry-light)',
      border: '1px solid var(--color-raspberry)',
      padding: '12px 16px',
      margin: '10px 0',
      borderRadius: 'var(--radius-sm)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <SvgIcon name="alert" size={17} color="var(--color-raspberry)" />
        <span style={{ fontSize: '12px', fontWeight: '800', letterSpacing: '0.06em', color: 'var(--color-raspberry-dark)', textTransform: 'uppercase' }}>
          Особый медицинский протокол ребёнка:
        </span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
        {alerts.map((a, i) => (
          <span key={i} style={{
            background: 'var(--color-raspberry)',
            color: '#FFFFFF',
            fontSize: '11px',
            fontWeight: '800',
            padding: '3px 8px',
            borderRadius: 'var(--radius-xs)',
            letterSpacing: '0.04em'
          }}>
            {a.label}
          </span>
        ))}
      </div>
      {child.allergy_details && (
        <div style={{ fontSize: '13px', color: 'var(--text-dark)', marginTop: '4px' }}>
          <strong>Аллергены:</strong> {child.allergy_details}
        </div>
      )}
      {child.contraindications && (
        <div style={{ fontSize: '13px', color: 'var(--text-dark)', marginTop: '2px' }}>
          <strong>Противопоказания:</strong> {child.contraindications}
        </div>
      )}
    </div>
  );
};
