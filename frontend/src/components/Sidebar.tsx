import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Radio, 
  Users, 
  ShieldCheck, 
  Sliders, 
  FileText, 
  LogOut, 
  RefreshCw, 
  Power, 
  Server,
  X,
  Pin,
  PinOff
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  xrayRunning: boolean;
  onlineCount: number;
  inboundsCount: number;
  panelVersion: string;
  publicIP?: string;
  onLogout: () => void;
  onRestartXray: () => void;
  isRestartingXray: boolean;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
  isPinned?: boolean;
  onTogglePin?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  xrayRunning,
  onlineCount,
  inboundsCount,
  panelVersion,
  publicIP,
  onLogout,
  onRestartXray,
  isRestartingXray,
  isOpenMobile = false,
  onCloseMobile,
  isPinned = false,
  onTogglePin,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  // Prevent background scrolling when mobile sidebar is open
  useEffect(() => {
    if (isOpenMobile) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpenMobile]);

  // On desktop: expanded if pinned OR hovered. On mobile: follows isOpenMobile.
  const isExpanded = isOpenMobile || isPinned || isHovered;

  const menuItems = [
    { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'inbounds', label: 'Inbounds', icon: Radio, count: inboundsCount },
    { id: 'clients', label: 'Clients', icon: Users, badge: onlineCount > 0 ? `${onlineCount} Live` : undefined },
    { id: 'certificates', label: 'Certificates', icon: ShieldCheck },
    { id: 'config', label: 'Core Config', icon: Sliders },
    { id: 'logs', label: 'System Logs', icon: FileText },
  ];

  return (
    <aside
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`
        fixed inset-y-0 left-0 z-50 bg-[#090a0f]/95 backdrop-blur-2xl border-r border-white/[0.08] 
        flex flex-col justify-between shrink-0 h-[100dvh] select-none transition-all duration-300 ease-in-out
        ${isOpenMobile ? 'translate-x-0 shadow-2xl w-72' : '-translate-x-full md:translate-x-0'}
        ${isExpanded ? 'md:w-64 md:shadow-2xl' : 'md:w-[68px]'}
      `}
    >
      {/* Top Branding Header */}
      <div className="shrink-0">
        {isExpanded ? (
          <div className="h-16 px-4 flex items-center justify-between border-b border-white/[0.06]">
            <div className="flex items-center gap-2.5 overflow-hidden">
              {/* Minimalist Professional Logo Mark */}
              <div className="w-8 h-8 rounded-lg bg-zinc-100 text-zinc-950 flex items-center justify-center font-bold text-sm tracking-tighter shadow-sm font-sans shrink-0">
                N
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-sm text-zinc-100 tracking-tight">Nexus</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/[0.06] text-zinc-300 border border-white/[0.08] font-medium">
                    v1.1
                  </span>
                </div>
                <span className="text-[11px] text-zinc-400 font-sans block leading-tight truncate">Proxy Engine</span>
              </div>
            </div>

            {/* Actions: Pin on desktop + Restart Xray + Mobile Close */}
            <div className="flex items-center gap-1.5 shrink-0">
              {onTogglePin && (
                <button
                  type="button"
                  onClick={onTogglePin}
                  className={`hidden md:flex p-1.5 rounded-lg border transition ${
                    isPinned 
                      ? 'border-blue-500/40 bg-blue-500/15 text-blue-400 hover:bg-blue-500/25' 
                      : 'border-white/[0.08] bg-white/[0.03] text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06]'
                  }`}
                  title={isPinned ? 'Sidebar Pinned (Click to auto-collapse on hover)' : 'Pin Sidebar Open'}
                >
                  {isPinned ? <Pin className="w-3 h-3 text-blue-400" /> : <PinOff className="w-3 h-3 text-zinc-500" />}
                </button>
              )}

              <button
                onClick={onRestartXray}
                disabled={isRestartingXray}
                title={xrayRunning ? 'Core Active (Click to Restart)' : 'Core Inactive (Click to Restart)'}
                className="p-1.5 rounded-lg border border-white/[0.08] hover:border-white/[0.16] bg-white/[0.03] hover:bg-white/[0.06] text-zinc-400 hover:text-zinc-200 transition flex items-center gap-1.5 text-xs"
              >
                <span className={`w-1.5 h-1.5 rounded-full ${xrayRunning ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                <RefreshCw className={`w-3 h-3 text-zinc-400 ${isRestartingXray ? 'animate-spin text-emerald-400' : ''}`} />
              </button>

              {onCloseMobile && (
                <button
                  onClick={onCloseMobile}
                  className="md:hidden p-2 rounded-xl border border-white/[0.08] bg-white/[0.04] text-zinc-400 hover:text-zinc-100 transition"
                  title="Close Navigation"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="h-16 flex items-center justify-center border-b border-white/[0.06] relative">
            <div className="w-8 h-8 rounded-lg bg-zinc-100 text-zinc-950 flex items-center justify-center font-bold text-sm tracking-tighter shadow-sm font-sans shrink-0">
              N
            </div>
            <span className={`absolute bottom-3 right-4.5 w-2 h-2 rounded-full border-2 border-[#090a0f] ${xrayRunning ? 'bg-emerald-500' : 'bg-rose-500'}`} />
          </div>
        )}
      </div>

      {/* Navigation Menu (Scrollable on small heights) */}
      <div className="flex-1 overflow-y-auto overscroll-contain p-2.5 space-y-1">
        <nav className="space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            if (!isExpanded) {
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center justify-center py-2.5 rounded-xl text-xs font-medium transition-colors relative ${
                    isActive
                      ? 'bg-zinc-800/90 text-white border border-zinc-700/60 shadow-xs'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40 border border-transparent'
                  }`}
                  title={item.label}
                >
                  <Icon className={`w-4 h-4 transition-colors ${isActive ? 'text-zinc-100' : 'text-zinc-400'}`} />
                  {item.badge && (
                    <span className="absolute top-1.5 right-2 w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)]" />
                  )}
                </button>
              );
            }

            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  if (onCloseMobile) onCloseMobile();
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-zinc-800/90 text-white border border-zinc-700/60 shadow-xs'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40 border border-transparent'
                }`}
                title={item.label}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Icon
                    className={`w-4 h-4 transition-colors shrink-0 ${
                      isActive ? 'text-zinc-100' : 'text-zinc-400'
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </div>

                {item.badge && (
                  <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                    {item.badge}
                  </span>
                )}
                {item.count !== undefined && !item.badge && (
                  <span className="text-[11px] font-mono text-zinc-500 shrink-0">
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Info & User Controls */}
      <div className="p-2.5 border-t border-white/[0.06] space-y-2 shrink-0">
        {isExpanded ? (
          <>
            {/* Public IP Badge */}
            {publicIP && (
              <div className="p-2 rounded-lg bg-white/[0.02] border border-white/[0.06] flex items-center justify-between text-xs font-mono text-zinc-400">
                <div className="flex items-center gap-1.5">
                  <Server className="w-3 h-3 text-zinc-500 shrink-0" />
                  <span className="text-[11px]">Server IP</span>
                </div>
                <span className="text-[11px] text-zinc-300 font-medium truncate ml-1">{publicIP}</span>
              </div>
            )}

            {/* Core Quick Summary Pill */}
            <div className="p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.07] flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1.5">
                  <Power className={`w-3 h-3 ${xrayRunning ? 'text-emerald-500' : 'text-rose-500'}`} />
                  <span className="text-xs font-medium text-zinc-300">Xray Core</span>
                </div>
                <span className="text-[11px] font-mono text-zinc-400">{xrayRunning ? 'Active & Routing' : 'Stopped'}</span>
              </div>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/[0.06] text-zinc-300 border border-white/[0.08]">
                {panelVersion || 'v1.1.7'}
              </span>
            </div>

            {/* User logout button */}
            <button
              onClick={() => {
                if (onCloseMobile) onCloseMobile();
                onLogout();
              }}
              className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.05] transition"
            >
              <div className="flex items-center gap-2">
                <LogOut className="w-3.5 h-3.5 text-zinc-400" />
                <span>Sign Out</span>
              </div>
              <span className="text-[10px] font-mono text-zinc-500">Admin</span>
            </button>
          </>
        ) : (
          <button
            onClick={() => {
              if (onCloseMobile) onCloseMobile();
              onLogout();
            }}
            className="w-full flex items-center justify-center p-2 rounded-xl text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.05] transition"
            title="Sign Out (Admin)"
          >
            <LogOut className="w-4 h-4 text-zinc-400" />
          </button>
        )}
      </div>
    </aside>
  );
};
