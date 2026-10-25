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
  PinOff,
  ArrowUpCircle,
  Check,
  ExternalLink
} from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';

const GithubIcon: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg 
    viewBox="0 0 24 24" 
    fill="currentColor" 
    className={className} 
    aria-hidden="true"
  >
    <path 
      fillRule="evenodd" 
      clipRule="evenodd" 
      d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" 
    />
  </svg>
);

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  xrayRunning: boolean;
  onlineCount: number;
  inboundsCount: number;
  panelVersion: string;
  xrayVersion?: string;
  publicIP?: string;
  onLogout: () => void;
  onRestartXray: () => void;
  isRestartingXray: boolean;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
  isPinned?: boolean;
  onTogglePin?: () => void;
  onOpenUpdates?: () => void;
  hasUpdates?: boolean;
}

const formatShortVersion = (ver?: string) => {
  if (!ver) return 'v1.3';
  const hasV = ver.toLowerCase().startsWith('v');
  const clean = ver.replace(/^[vV]/, '');
  const parts = clean.split('.');
  if (parts.length >= 2) {
    return `${hasV ? 'v' : ''}${parts[0]}.${parts[1]}`;
  }
  return ver;
};

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  xrayRunning,
  onlineCount,
  inboundsCount,
  panelVersion,
  xrayVersion,
  publicIP,
  onLogout,
  onRestartXray,
  isRestartingXray,
  isOpenMobile = false,
  onCloseMobile,
  isPinned = false,
  onTogglePin,
  onOpenUpdates,
  hasUpdates = false,
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
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/[0.06] text-zinc-300 border border-white/[0.08] font-bold">
                    {formatShortVersion(panelVersion)}
                  </span>
                  <a
                    href="https://github.com/ADEL-MAHMOUD10/Nexus-panel"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1 rounded-md text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-colors"
                    title="Nexus Panel on GitHub"
                    aria-label="GitHub Repository"
                  >
                    <GithubIcon className="w-3.5 h-3.5" />
                  </a>
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
                    <span className="absolute top-1.5 right-2 w-2 h-2 rounded-full bg-emerald-500" />
                  )}
                </button>
              );
            }

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveTab(item.id);
                  if (onCloseMobile) onCloseMobile();
                }}
                className={`sidebar-nav-item w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all duration-150 cursor-pointer select-none active:scale-[0.98] group ${
                  isActive
                    ? 'active font-bold shadow-xs'
                    : 'hover:translate-x-1'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Icon
                    className={`w-4 h-4 shrink-0 transition-transform duration-150 group-hover:scale-110 ${
                      isActive ? 'scale-105' : ''
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </div>

                {item.badge && (
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 shrink-0">
                    {item.badge}
                  </span>
                )}
                {item.count !== undefined && !item.badge && (
                  <span className="text-[11px] font-mono text-neutral-500 dark:text-zinc-500 shrink-0 font-medium">
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
            {/* System Updates Action */}
            {onOpenUpdates && (
              <button
                type="button"
                onClick={() => {
                  if (onCloseMobile) onCloseMobile();
                  onOpenUpdates();
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition cursor-pointer select-none ${
                  hasUpdates 
                    ? 'bg-amber-500/15 border border-amber-500/40 text-amber-600 dark:text-amber-300 shadow-xs' 
                    : 'bg-neutral-100/80 dark:bg-white/[0.03] border border-neutral-200 dark:border-white/[0.07] text-neutral-800 dark:text-zinc-300 hover:text-black dark:hover:text-white hover:bg-neutral-200/80 dark:hover:bg-white/[0.06]'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <ArrowUpCircle className={`w-4 h-4 shrink-0 ${hasUpdates ? 'text-amber-500 animate-pulse' : 'text-neutral-500 dark:text-zinc-400'}`} />
                  <span className="font-semibold truncate">System Updates</span>
                </div>
                {hasUpdates ? (
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-500 text-white dark:text-neutral-950 shrink-0">
                    Update Ready
                  </span>
                ) : (
                  <span className="text-[10px] font-mono text-neutral-500 dark:text-zinc-400 shrink-0">
                    Check
                  </span>
                )}
              </button>
            )}

            {/* Core Quick Summary Pill - Interactive Click to Restart Core */}
            <button
              type="button"
              onClick={onRestartXray}
              disabled={isRestartingXray}
              className="w-full p-2.5 rounded-xl border border-neutral-200/80 dark:border-white/[0.07] bg-neutral-100/70 dark:bg-white/[0.03] hover:border-emerald-500/40 hover:bg-emerald-500/5 dark:hover:bg-white/[0.07] flex items-center justify-between transition-all cursor-pointer active:scale-[0.98] group select-none shadow-xs"
              title="Click to restart Xray Core Engine"
            >
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-lg transition-colors ${
                  xrayRunning 
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-500/25' 
                    : 'bg-rose-500/15 text-rose-500'
                }`}>
                  <Power className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                </div>
                <div className="text-left">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-neutral-900 dark:text-zinc-200">Xray Core</span>
                    <span className={`w-1.5 h-1.5 rounded-full ${xrayRunning ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                  </div>
                  <span className="text-[10px] font-mono text-neutral-500 dark:text-zinc-400 block leading-tight">
                    {xrayRunning ? 'Active & Routing' : 'Stopped'}
                  </span>
                </div>
              </div>
              <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-md bg-neutral-200/80 dark:bg-white/[0.06] text-neutral-800 dark:text-zinc-300 border border-neutral-300/60 dark:border-white/[0.08]">
                {xrayVersion || 'v26.10.x'}
              </span>
            </button>

            {/* Theme Toggle Button */}
            <div className="pt-1">
              <ThemeToggle className="w-full justify-between" showLabel={true} />
            </div>

            {/* GitHub Repository Link */}
            <a
              href="https://github.com/ADEL-MAHMOUD10/Nexus-panel"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-neutral-600 dark:text-zinc-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-white/[0.05] border border-transparent hover:border-neutral-200/80 dark:hover:border-white/[0.08] transition-all cursor-pointer active:scale-[0.98] select-none group"
              title="View Nexus Panel on GitHub"
            >
              <div className="flex items-center gap-2">
                <GithubIcon className="w-3.5 h-3.5 text-neutral-500 dark:text-zinc-400 group-hover:scale-110 transition-transform" />
                <span>GitHub Repository</span>
              </div>
              <ExternalLink className="w-3 h-3 text-neutral-400 dark:text-zinc-500 group-hover:text-neutral-700 dark:group-hover:text-zinc-300" />
            </a>

            {/* User logout button */}
            <button
              type="button"
              onClick={() => {
                if (onCloseMobile) onCloseMobile();
                onLogout();
              }}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-neutral-600 dark:text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all cursor-pointer active:scale-[0.98] select-none group"
            >
              <div className="flex items-center gap-2">
                <LogOut className="w-3.5 h-3.5 group-hover:scale-110 group-hover:-translate-x-0.5 transition-transform" />
                <span>Sign Out</span>
              </div>
              <span className="text-[10px] font-mono text-neutral-400 dark:text-zinc-500">Admin</span>
            </button>
          </>
        ) : (
          <div className="space-y-1.5 flex flex-col items-center">
            {onOpenUpdates && (
              <button
                type="button"
                onClick={onOpenUpdates}
                className={`w-full flex items-center justify-center p-2 rounded-xl transition ${
                  hasUpdates 
                    ? 'bg-amber-500/20 text-amber-500' 
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.05]'
                }`}
                title={hasUpdates ? "System Update Available" : "Check for Updates"}
              >
                <ArrowUpCircle className="w-4 h-4" />
              </button>
            )}
            <ThemeToggle className="w-10 h-10 p-0 justify-center" showLabel={false} />
            <a
              href="https://github.com/ADEL-MAHMOUD10/Nexus-panel"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center p-2 rounded-xl text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.05] transition"
              title="Nexus Panel on GitHub"
              aria-label="GitHub Repository"
            >
              <GithubIcon className="w-4 h-4" />
            </a>
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
          </div>
        )}
      </div>
    </aside>
  );
};
