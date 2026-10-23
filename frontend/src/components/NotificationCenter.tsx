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
        return <Info className="w-3.5 h-3.5 text-cyan-400" />;
    }
  };

  return (
    <div className="relative select-none" ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg border border-zinc-800 bg-zinc-900/80 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition"
        title="Notifications"
      >
        <Bell className="w-4 h-4 text-zinc-400" />
        
        {/* Unread Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-blue-600 text-[9px] font-bold text-white font-mono">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-[#121316] border border-zinc-800 rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col">
          {/* Header */}
          <div className="p-3.5 border-b border-zinc-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-zinc-100">Notifications</span>
              {unreadCount > 0 && (
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                  {unreadCount} new
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition"
                  title="Mark all as read"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={clearNotifications}
                  className="p-1 rounded text-zinc-400 hover:text-rose-400 hover:bg-zinc-800 transition"
                  title="Clear all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Filter Pills */}
          <div className="px-3 py-1.5 border-b border-zinc-800 bg-zinc-900/40 flex items-center gap-1 text-[11px] font-medium text-zinc-400">
            {['all', 'system', 'security', 'clients'].map((cat) => (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                className={`px-2 py-0.5 rounded capitalize transition ${
                  filterCategory === cat
                    ? 'bg-zinc-800 text-white font-medium'
                    : 'hover:text-zinc-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Notifications Scroll Area */}
          <div className="max-h-80 overflow-y-auto divide-y divide-zinc-800/60 p-1.5">
            {filteredNotifications.length === 0 ? (
              <div className="py-8 text-center flex flex-col items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-zinc-500 mb-1" />
                <p className="text-xs font-medium text-zinc-400">All systems nominal</p>
                <p className="text-[11px] text-zinc-500">No new alerts</p>
              </div>
            ) : (
              filteredNotifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => markAsRead(notif.id)}
                  className={`p-2.5 rounded-lg transition flex items-start gap-2.5 relative group cursor-pointer ${
                    notif.read ? 'opacity-70 hover:opacity-100 hover:bg-zinc-800/40' : 'bg-zinc-900/60 hover:bg-zinc-800/60'
                  }`}
                >
                  <div className="mt-0.5 p-1 rounded bg-zinc-800/80">
                    {getTypeIcon(notif.type)}
                  </div>

                  <div className="flex-1 min-w-0 pr-3">
                    <div className="flex items-center justify-between gap-2">
                      <h5 className={`text-xs truncate ${notif.read ? 'text-zinc-300' : 'text-white font-medium'}`}>
                        {notif.title}
                      </h5>
                      <span className="text-[10px] font-mono text-zinc-500 shrink-0">
                        {formatRelativeTime(notif.timestamp)}
                      </span>
                    </div>

                    {notif.message && (
                      <p className="text-[11px] text-zinc-400 mt-0.5 leading-snug line-clamp-2 font-sans">
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
                        className="mt-1.5 text-[11px] font-mono font-medium text-blue-400 hover:text-blue-300 flex items-center gap-1 transition"
                      >
                        <span>{notif.action.label}</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {/* Unread indicator */}
                  {!notif.read && (
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 absolute right-2.5 top-3"></span>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="p-2.5 border-t border-white/[0.06] bg-black/20 text-center text-[10px] font-mono text-zinc-500">
              Nexus Activity & Alert Log • Auto-synced
            </div>
          )}
        </div>
      )}
    </div>
  );
};