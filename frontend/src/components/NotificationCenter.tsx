import React, { useState, useRef, useEffect } from 'react';
import { 
  Bell, 
  CheckCheck, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle, 
  Info, 
  X,
  ExternalLink,
  ShieldCheck
} from 'lucide-react';
import { useNotification, AppNotification, NotificationCategory } from '../context/NotificationContext';

export const NotificationCenter: React.FC = () => {
  const { 
    notifications, 
    unreadCount, 
    markAsRead, 
    markAllAsRead, 
    clearNotifications, 
    removeNotification 
  } = useNotification();

  const [isOpen, setIsOpen] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click
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

  const filteredNotifications = notifications.filter((n) => {
    if (filterCategory === 'all') return true;
    return n.category === filterCategory;
  });

  const formatRelativeTime = (timestamp: number) => {
    const diff = Math.floor((Date.now() - timestamp) / 1000);
    if (diff < 30) return 'Just now';
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
      case 'error':
        return <AlertCircle className="w-3.5 h-3.5 text-rose-400" />;
      case 'warning':
        return <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />;
      case 'info':
      default:
        return <Info className="w-3.5 h-3.5 text-blue-400" />;
    }
  };

  return (
    <div className="relative select-none" ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl border border-neutral-200/90 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 hover:bg-neutral-100 dark:hover:bg-zinc-800 text-neutral-700 dark:text-zinc-400 hover:text-neutral-900 dark:hover:text-zinc-200 transition cursor-pointer select-none active:scale-95"
        title="Notifications"
        aria-label="Notifications"
      >
        <Bell className="w-4 h-4 text-neutral-600 dark:text-zinc-400" />
        
        {/* Unread Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-blue-600 text-[9px] font-bold text-white font-mono shadow-xs">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div className="fixed sm:absolute right-3 sm:right-0 top-14 sm:top-auto sm:mt-2 w-[calc(100vw-28px)] max-w-[325px] sm:w-96 bg-white/95 dark:bg-[#161617]/95 backdrop-blur-2xl border border-neutral-200/90 dark:border-white/[0.1] rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-[75vh] sm:max-h-[32rem]">
          {/* Header */}
          <div className="p-3 sm:p-3.5 border-b border-neutral-200 dark:border-white/[0.07] flex items-center justify-between bg-neutral-50/60 dark:bg-transparent">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-neutral-900 dark:text-zinc-100">Notifications</span>
              {unreadCount > 0 && (
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 font-bold">
                  {unreadCount} new
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="p-1 rounded-lg text-neutral-500 dark:text-zinc-400 hover:text-neutral-900 dark:hover:text-zinc-200 hover:bg-neutral-200/60 dark:hover:bg-white/[0.06] transition cursor-pointer"
                  title="Mark all as read"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={clearNotifications}
                  className="p-1 rounded-lg text-neutral-500 dark:text-zinc-400 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-neutral-200/60 dark:hover:bg-zinc-800 transition cursor-pointer"
                  title="Clear all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Filter Pills */}
          <div className="px-3 py-1.5 border-b border-neutral-200 dark:border-zinc-800 bg-neutral-100/50 dark:bg-zinc-900/40 flex items-center gap-1 text-[11px] font-medium text-neutral-600 dark:text-zinc-400">
            {['all', 'system', 'security', 'clients'].map((cat) => (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                className={`px-2 py-0.5 rounded-lg capitalize transition cursor-pointer ${
                  filterCategory === cat
                    ? 'bg-neutral-900 dark:bg-zinc-800 text-white font-medium shadow-xs'
                    : 'hover:text-neutral-900 dark:hover:text-zinc-200 hover:bg-neutral-200/50 dark:hover:bg-transparent'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Notifications Scroll Area */}
          <div className="max-h-72 sm:max-h-80 overflow-y-auto p-2 sm:p-2.5 space-y-2">
            {filteredNotifications.length === 0 ? (
              <div className="py-8 text-center flex flex-col items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-neutral-400 dark:text-zinc-500 mb-1" />
                <p className="text-xs font-medium text-neutral-600 dark:text-zinc-400">All systems nominal</p>
                <p className="text-[11px] text-neutral-400 dark:text-zinc-500">No new alerts</p>
              </div>
            ) : (
              filteredNotifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => markAsRead(notif.id)}
                  className={`p-2.5 rounded-xl transition-all flex items-start gap-2.5 relative group cursor-pointer border ${
                    notif.read 
                      ? 'bg-neutral-50/70 hover:bg-neutral-100/80 border-neutral-200/70 opacity-75 hover:opacity-100 dark:bg-white/[0.02] dark:hover:bg-zinc-800/40 dark:border-white/[0.04]' 
                      : 'bg-white hover:bg-neutral-50 border-neutral-200 dark:bg-zinc-900/70 dark:hover:bg-zinc-800/70 dark:border-zinc-800 shadow-xs'
                  }`}
                >
                  <div className="mt-0.5 p-1 rounded-lg bg-neutral-100 dark:bg-zinc-800/80 shrink-0 border border-neutral-200/60 dark:border-transparent">
                    {getTypeIcon(notif.type)}
                  </div>

                  <div className="flex-1 min-w-0 pr-3">
                    <div className="flex items-center justify-between gap-2">
                      <h5 className={`text-xs truncate ${notif.read ? 'text-neutral-700 dark:text-zinc-300 font-medium' : 'text-neutral-950 dark:text-white font-bold'}`}>
                        {notif.title}
                      </h5>
                      <span className="text-[10px] font-mono text-neutral-400 dark:text-zinc-500 shrink-0">
                        {formatRelativeTime(notif.timestamp)}
                      </span>
                    </div>

                    {notif.message && (
                      <p className="text-[11px] text-neutral-600 dark:text-zinc-400 mt-0.5 leading-snug line-clamp-2 font-sans">
                        {notif.message}
                      </p>
                    )}

                    {notif.action && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          notif.action?.onClick();
                          setIsOpen(false);
                        }}
                        className="mt-1.5 text-[11px] font-mono font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 transition cursor-pointer"
                      >
                        <span>{notif.action.label}</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {/* Unread indicator */}
                  {!notif.read && (
                    <span className="w-2 h-2 rounded-full bg-blue-600 absolute right-2.5 top-3 shadow-xs"></span>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="p-2 border-t border-neutral-200 dark:border-white/[0.06] bg-neutral-50/60 dark:bg-black/20 text-center text-[10px] font-mono text-neutral-500 dark:text-zinc-500">
              Nexus Activity & Alert Log • Auto-synced
            </div>
          )}
        </div>
      )}
    </div>
  );
};