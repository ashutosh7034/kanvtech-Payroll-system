import React from 'react';
import { ShieldAlert, ArrowLeft, Home } from 'lucide-react';

interface AccessDeniedViewProps {
  moduleName?: string;
  requiredPermission?: string;
  onNavigate?: (page: string) => void;
}

export const AccessDeniedView: React.FC<AccessDeniedViewProps> = ({ moduleName, requiredPermission, onNavigate }) => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '420px',
        padding: '32px 16px',
        textAlign: 'center'
      }}
    >
      <div
        style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          backgroundColor: 'var(--danger-bg, #fef2f2)',
          color: 'var(--danger, #ef4444)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '16px'
        }}
      >
        <ShieldAlert size={32} />
      </div>

      <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 8px', color: 'var(--text-main)' }}>
        Access Restricted
      </h2>

      <p style={{ maxWidth: '440px', color: 'var(--text-muted)', fontSize: '0.875rem', lineHeight: 1.5, margin: '0 0 12px' }}>
        You do not have the required role or permission to access{' '}
        <strong>{moduleName || 'this module'}</strong>. If you require access to this corporate workflow,
        please request an updated role assignment from your Company Administrator.
      </p>

      {requiredPermission && (
        <code style={{ fontSize: '0.75rem', padding: '4px 8px', background: 'var(--bg-subtle, #f3f4f6)', borderRadius: '4px', color: 'var(--text-muted)', marginBottom: '24px' }}>
          Required: {requiredPermission}
        </code>
      )}

      {onNavigate && (
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => onNavigate('dashboard')}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Home size={14} /> Go to Dashboard
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => onNavigate('self')}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <ArrowLeft size={14} /> My Self-Service
          </button>
        </div>
      )}
    </div>
  );
};
