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
        className="relative p-2 rounded-xl border border-white/[0.08] bg-[#14171e] hover:bg-[#191d26] text-zinc-300 hover:text-white transition shadow-sm group"
        title="Notifications"
      >
        <Bell className="w-4 h-4 text-zinc-300 group-hover:text-cyan-400 transition" />
        
        {/* Unread Animated Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-cyan-500 text-[9px] font-bold text-black font-mono shadow-[0_0_8px_#06b6d4]">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div className="absolute right-0 mt-2.5 w-80 sm:w-96 bg-[#101218]/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="p-4 pb-3 border-b border-white/[0.06] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white tracking-wide">Notifications</span>
              {unreadCount > 0 && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                  {unreadCount} new
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition"
                  title="Mark all as read"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={clearNotifications}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-white/5 transition"
                  title="Clear all notifications"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Filter Pills */}
          <div className="px-4 py-2 border-b border-white/[0.04] bg-white/[0.01] flex items-center gap-1.5 overflow-x-auto text-[11px] font-medium text-zinc-400">
            {['all', 'system', 'security', 'clients'].map((cat) => (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                className={`px-2.5 py-1 rounded-lg capitalize transition ${
                  filterCategory === cat
                    ? 'bg-white/10 text-white font-semibold'
                    : 'hover:text-zinc-200 hover:bg-white/[0.04]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Notifications Scroll Area */}
          <div className="max-h-80 overflow-y-auto divide-y divide-white/[0.04] p-2">
            {filteredNotifications.length === 0 ? (
              <div className="py-10 text-center flex flex-col items-center justify-center">
                <div className="w-10 h-10 rounded-2xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-center text-zinc-500 mb-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                </div>
                <p className="text-xs font-medium text-zinc-300">All systems nominal</p>
                <p className="text-[11px] text-zinc-500 mt-0.5">No notifications in this category</p>
              </div>
            ) : (
              filteredNotifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => markAsRead(notif.id)}
                  className={`p-3 rounded-xl transition flex items-start gap-3 relative group cursor-pointer ${
                    notif.read ? 'hover:bg-white/[0.02] opacity-75' : 'bg-white/[0.02] hover:bg-white/[0.04]'
                  }`}
                >
                  <div className="mt-0.5 p-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                    {getTypeIcon(notif.type)}
                  </div>

                  <div className="flex-1 min-w-0 pr-4">
                    <div className="flex items-center justify-between gap-2">
                      <h5 className={`text-xs tracking-tight truncate ${notif.read ? 'text-zinc-300 font-medium' : 'text-white font-bold'}`}>
                        {notif.title}
                      </h5>
                      <span className="text-[10px] font-mono text-zinc-500 shrink-0">
                        {formatRelativeTime(notif.timestamp)}
                      </span>
                    </div>

                    {notif.message && (
                      <p className="text-[11px] text-zinc-400 mt-1 leading-snug line-clamp-2 font-sans">
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
                        className="mt-2 text-[11px] font-mono font-medium text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition"
                      >
                        <span>{notif.action.label}</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {/* Unread blue dot */}
                  {!notif.read && (
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 absolute right-2.5 top-3.5 shadow-[0_0_6px_#06b6d4]"></span>
                  )}

                  {/* Remove single button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeNotification(notif.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-white/10 text-zinc-500 hover:text-rose-400 absolute right-2 bottom-2 transition"
                    title="Dismiss"
                  >
                    <X className="w-3 h-3" />
                  </button>
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