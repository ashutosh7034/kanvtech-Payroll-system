import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export interface FormModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  width?: 'sm' | 'md' | 'lg' | string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  onSubmit?: (e: React.FormEvent) => void;
  submitLabel?: string;
  cancelLabel?: string;
  isSubmitting?: boolean;
  isDestructive?: boolean;
}

export const FormModal: React.FC<FormModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  width = 'md',
  children,
  footer,
  onSubmit,
  submitLabel = 'Save Changes',
  cancelLabel = 'Cancel',
  isSubmitting = false,
  isDestructive = false
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isSubmitting) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose, isSubmitting]);

  if (!isOpen) return null;

  const getWidthStyle = () => {
    if (width === 'sm') return '460px';
    if (width === 'md') return '640px';
    if (width === 'lg') return '780px';
    return width;
  };

  const content = (
    <div
      className="form-modal-container"
      style={{
        width: getWidthStyle(),
        maxWidth: '94vw',
        maxHeight: '90vh',
        backgroundColor: '#ffffff',
        borderRadius: 'var(--radius-lg, 8px)',
        boxShadow: 'var(--shadow-xl, 0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1))',
        border: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        animation: 'fadeIn 0.15s ease-out'
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Modal Header */}
      <div
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#fafbfc'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {icon && (
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: 'var(--radius-md, 6px)',
                backgroundColor: 'rgba(30, 58, 138, 0.08)',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              {icon}
            </div>
          )}
          <div>
            <h3
              style={{
                fontSize: '0.9375rem',
                fontWeight: 700,
                color: 'var(--text-main)',
                margin: 0,
                lineHeight: 1.3
              }}
            >
              {title}
            </h3>
            {subtitle && (
              <p
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)',
                  margin: '2px 0 0 0',
                  lineHeight: 1.3
                }}
              >
                {subtitle}
              </p>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
          aria-label="Close dialog"
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
            padding: '6px',
            borderRadius: 'var(--radius-sm, 4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background-color 0.15s'
          }}
          onMouseEnter={(e) => {
            if (!isSubmitting) e.currentTarget.style.backgroundColor = 'var(--bg-subtle, #f1f5f9)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <X size={18} />
        </button>
      </div>

      {/* Modal Body */}
      <div
        className="form-modal-body"
        style={{
          padding: '20px',
          overflowY: 'auto',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}
      >
        {children}
      </div>

      {/* Modal Footer */}
      <div
        style={{
          padding: '12px 20px',
          borderTop: '1px solid var(--border-color)',
          backgroundColor: '#fafbfc',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: '10px'
        }}
      >
        {footer ? (
          footer
        ) : (
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={isSubmitting}
              style={{ minWidth: '80px' }}
            >
              {cancelLabel}
            </button>
            {onSubmit && (
              <button
                type="button"
                className={`btn ${isDestructive ? 'btn-danger' : 'btn-primary'}`}
                onClick={(e) => onSubmit(e as any)}
                disabled={isSubmitting}
                style={{ minWidth: '100px' }}
              >
                {isSubmitting ? 'Saving...' : submitLabel}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );

  return (
    <div
      className="form-modal-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 120,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(15, 23, 42, 0.5)',
        backdropFilter: 'blur(2px)',
        transition: 'all 0.2s ease-in-out'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
    >
      {onSubmit ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit(e);
          }}
          style={{ margin: 0 }}
        >
          {content}
        </form>
      ) : (
        content
      )}
    </div>
  );
};
