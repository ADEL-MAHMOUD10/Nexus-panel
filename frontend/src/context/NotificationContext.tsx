import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';
export type NotificationCategory = 'system' | 'xray' | 'clients' | 'security';

export interface NotificationAction {
  label: string;
  onClick: () => void;
}

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message?: string;
  timestamp: number;
  read: boolean;
  category?: NotificationCategory;
  action?: NotificationAction;
}

export interface ToastItem extends AppNotification {
  duration?: number;
}

interface NotificationContextType {
  notifications: AppNotification[];
  toasts: ToastItem[];
  unreadCount: number;
  notify: {
    success: (title: string, message?: string, action?: NotificationAction, duration?: number) => string;
    error: (title: string, message?: string, action?: NotificationAction, duration?: number) => string;
    warning: (title: string, message?: string, action?: NotificationAction, duration?: number) => string;
    info: (title: string, message?: string, action?: NotificationAction, duration?: number) => string;
  };
  dismissToast: (id: string) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearNotifications: () => void;
  removeNotification: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

const STORAGE_KEY = 'nexus_notifications_v1';

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {}
    return [
      {
        id: 'init-1',
        type: 'info',
        title: 'Nexus System Engine Online',
        message: 'Real-time telemetry and proxy core monitoring initialized.',
        timestamp: Date.now() - 60000,
        read: false,
        category: 'system',
      },
    ];
  });

  const [toasts, setToasts] = useState<ToastItem[]>([]);

  // Persist notifications
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications.slice(0, 50)));
    } catch (e) {}
  }, [notifications]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addNotification = useCallback(
    (
      type: NotificationType,
      title: string,
      message?: string,
      action?: NotificationAction,
      duration = 4500,
      category: NotificationCategory = 'system'
    ) => {
      const id = 'notif-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);
      const newNotification: AppNotification = {
        id,
        type,
        title,
        message,
        timestamp: Date.now(),
        read: false,
        category,
        action,
      };

      // Add to persistent notification drawer
      setNotifications((prev) => [newNotification, ...prev].slice(0, 50));

      // Add to temporary active toasts
      const toastItem: ToastItem = {
        ...newNotification,
        duration,
      };
      setToasts((prev) => [...prev, toastItem]);

      // Auto dismiss toast
      if (duration > 0) {
        setTimeout(() => {
          dismissToast(id);
        }, duration);
      }

      return id;
    },
    [dismissToast]
  );

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const notify = {
    success: (title: string, message?: string, action?: NotificationAction, duration = 4000) =>
      addNotification('success', title, message, action, duration, 'system'),
    error: (title: string, message?: string, action?: NotificationAction, duration = 5000) =>
      addNotification('error', title, message, action, duration, 'system'),
    warning: (title: string, message?: string, action?: NotificationAction, duration = 4500) =>
      addNotification('warning', title, message, action, duration, 'security'),
    info: (title: string, message?: string, action?: NotificationAction, duration = 4000) =>
      addNotification('info', title, message, action, duration, 'system'),
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        toasts,
        unreadCount,
        notify,
        dismissToast,
        markAsRead,
        markAllAsRead,
        clearNotifications,
        removeNotification,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};