import React from 'react';

export type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'brand';

interface StatusBadgeProps {
  status: string;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  variant,
  size = 'md',
  className = ''
}) => {
  const getAutoVariant = (statusText: string): BadgeVariant => {
    const s = (statusText || '').toUpperCase();
    if (['ACTIVE', 'PAID', 'APPROVED', 'CONFIRMED', 'PRESENT', 'COMPLETED', 'NEW'].includes(s)) {
      return 'success';
    }
    if (['REVIEWED', 'VALIDATED', 'PENDING', 'PROBATION', 'HALF_DAY', 'IN_PROGRESS'].includes(s)) {
      return 'warning';
    }
    if (['REJECTED', 'CANCELLED', 'SUSPENDED', 'EXITED', 'ABSENT', 'OVERDUE', 'DANGER'].includes(s)) {
      return 'danger';
    }
    if (['PAYMENT_READY', 'CALCULATED', 'ON_LEAVE', 'OFFICE', 'REMOTE', 'HYBRID'].includes(s)) {
      return 'info';
    }
    if (['DRAFT', 'CLOSED', 'WEEKLY_OFF', 'HOLIDAY'].includes(s)) {
      return 'neutral';
    }
    return 'neutral';
  };

  const finalVariant = variant || getAutoVariant(status);
  const sizeStyle = size === 'sm' ? { fontSize: '0.6875rem', padding: '2px 6px' } : { fontSize: '0.75rem', padding: '3px 8px' };

  return (
    <span
      className={`badge badge-${finalVariant} ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        fontWeight: 600,
        borderRadius: 'var(--radius-xs)',
        textTransform: 'uppercase',
        letterSpacing: '0.03em',
        ...sizeStyle
      }}
    >
      <span
        style={{
          width: '5px',
          height: '5px',
          borderRadius: '50%',
          backgroundColor: 'currentColor',
          opacity: 0.8
        }}
      />
      {status?.replace(/_/g, ' ')}
    </span>
  );
};
