import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[PayFlow ErrorBoundary] Unhandled component exception:', error, errorInfo);
  }

  public handleReload = () => {
    if (this.props.onReset) {
      this.props.onReset();
    }
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public handleGoHome = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '360px',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '32px 20px',
            background: 'var(--bg-app, #f8fafc)'
          }}
        >
          <div
            style={{
              maxWidth: '520px',
              width: '100%',
              background: '#ffffff',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04)',
              padding: '32px 28px',
              textAlign: 'center'
            }}
          >
            <div
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '50%',
                background: '#fef2f2',
                color: '#dc2626',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px'
              }}
            >
              <AlertTriangle size={26} />
            </div>

            <h2
              style={{
                fontSize: '1.2rem',
                fontWeight: 700,
                color: '#0f172a',
                marginBottom: '8px'
              }}
            >
              {this.props.fallbackTitle || 'Component Rendering Recovered'}
            </h2>

            <p
              style={{
                fontSize: '0.8125rem',
                color: '#64748b',
                lineHeight: 1.5,
                marginBottom: '18px'
              }}
            >
              An unexpected render issue was safely intercepted. Your active session and institutional payroll records remain intact.
            </p>

            {this.state.error && (
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  padding: '10px 14px',
                  fontSize: '0.75rem',
                  fontFamily: 'monospace',
                  color: '#b91c1c',
                  textAlign: 'left',
                  maxHeight: '100px',
                  overflowY: 'auto',
                  marginBottom: '20px'
                }}
              >
                {this.state.error.message || String(this.state.error)}
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                className="btn btn-primary"
                onClick={this.handleReload}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', fontSize: '0.8125rem' }}
              >
                <RefreshCw size={14} /> Reload Page
              </button>
              <button
                className="btn btn-outline"
                onClick={this.handleGoHome}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', fontSize: '0.8125rem' }}
              >
                <Home size={14} /> Return to Dashboard
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
