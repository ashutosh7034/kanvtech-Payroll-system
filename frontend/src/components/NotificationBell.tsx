import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { Bell, Check, CheckCheck, ExternalLink, Clock } from 'lucide-react';

interface InAppNotification {
  id: string;
  title: string;
  message: string;
  link?: string | null;
  type: string;
  entityId?: string | null;
  isRead: boolean;
  createdAt: string;
}

interface NotificationBellProps {
  onNavigate?: (page: string) => void;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({ onNavigate }) => {
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    try {
      const res: any = await api.get('/notifications?limit=25');
      setNotifications(res.notifications || []);
      setUnreadCount(res.unreadCount || 0);
    } catch {
      // Background poll failure is silent
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 20000);
    return () => clearInterval(interval);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleMarkAsRead = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark notification read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      setLoading(true);
      await api.post('/notifications/mark-all-read');
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all read:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleNotificationClick = async (notif: InAppNotification) => {
    if (!notif.isRead) {
      await handleMarkAsRead(notif.id);
    }
    setIsOpen(false);
    if (notif.link) {
      if (notif.link.includes('expenses') && onNavigate) {
        onNavigate('expenses');
      }
    }
  };

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diffSec < 60) return 'Just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
  };

  return (
    <div style={{ position: 'relative' }} ref={dropdownRef}>
      <button
        type="button"
        id="payflow-notifications-bell-trigger"
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) fetchNotifications();
        }}
        title="Notifications"
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '34px',
          height: '34px',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-color)',
          background: isOpen ? 'var(--bg-subtle)' : '#ffffff',
          color: unreadCount > 0 ? 'var(--primary)' : 'var(--text-muted)',
          cursor: 'pointer',
          transition: 'all 0.15s ease'
        }}
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span
            id="payflow-notification-badge"
            style={{
              position: 'absolute',
              top: '-4px',
              right: '-4px',
              backgroundColor: 'var(--danger, #ef4444)',
              color: '#ffffff',
              fontSize: '0.625rem',
              fontWeight: 700,
              padding: '1px 5px',
              borderRadius: '999px',
              minWidth: '16px',
              textAlign: 'center',
              lineHeight: '14px',
              border: '2px solid #ffffff'
            }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          id="payflow-notifications-dropdown"
          style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 8px)',
            width: '380px',
            maxWidth: '90vw',
            maxHeight: '480px',
            background: '#ffffff',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              borderBottom: '1px solid var(--border-color)',
              background: 'var(--bg-subtle)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-main)' }}>
                Notifications
              </span>
              {unreadCount > 0 && (
                <span
                  style={{
                    backgroundColor: 'var(--primary-subtle, #e0f2fe)',
                    color: 'var(--primary, #0284c7)',
                    fontSize: '0.6875rem',
                    fontWeight: 700,
                    padding: '1px 6px',
                    borderRadius: '4px'
                  }}
                >
                  {unreadCount} unread
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                disabled={loading}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--primary, #0284c7)',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <CheckCheck size={13} /> Mark all read
              </button>
            )}
          </div>

          {/* Notification List */}
          <div style={{ overflowY: 'auto', flex: 1, maxHeight: '400px' }}>
            {notifications.length === 0 ? (
              <div style={{ padding: '36px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <Bell size={24} style={{ opacity: 0.3, marginBottom: '8px' }} />
                <div style={{ fontSize: '0.8125rem', fontWeight: 600 }}>No notifications yet</div>
                <div style={{ fontSize: '0.75rem', marginTop: '4px' }}>
                  You'll be notified when claims or approvals require attention.
                </div>
              </div>
            ) : (
              notifications.map(notif => (
                <div
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid var(--border-color, #f1f5f9)',
                    backgroundColor: notif.isRead ? '#ffffff' : '#f8fafc',
                    cursor: 'pointer',
                    transition: 'background-color 0.15s ease',
                    position: 'relative'
                  }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
                  onMouseLeave={e =>
                    (e.currentTarget.style.backgroundColor = notif.isRead ? '#ffffff' : '#f8fafc')
                  }
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                    <div style={{ fontWeight: notif.isRead ? 600 : 700, fontSize: '0.8125rem', color: 'var(--text-main)' }}>
                      {notif.title}
                    </div>
                    {!notif.isRead && (
                      <span
                        style={{
                          width: '7px',
                          height: '7px',
                          borderRadius: '50%',
                          backgroundColor: 'var(--primary, #0284c7)',
                          flexShrink: 0,
                          marginTop: '4px'
                        }}
                      />
                    )}
                  </div>

                  <p
                    style={{
                      margin: '4px 0 6px',
                      fontSize: '0.75rem',
                      color: 'var(--text-muted, #64748b)',
                      lineHeight: 1.4
                    }}
                  >
                    {notif.message}
                  </p>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.6875rem', color: 'var(--text-dim, #94a3b8)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={11} /> {formatTimeAgo(notif.createdAt)}
                    </span>
                    {!notif.isRead && (
                      <button
                        type="button"
                        onClick={e => handleMarkAsRead(notif.id, e)}
                        title="Mark as read"
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          padding: '2px 4px'
                        }}
                      >
                        <Check size={12} />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
