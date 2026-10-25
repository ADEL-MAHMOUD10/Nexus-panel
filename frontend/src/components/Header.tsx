import React, { useState } from 'react';
import { 
  Search, 
  RefreshCw, 
  ExternalLink,
  ShieldAlert,
  Server,
  Eye,
  EyeOff,
  Menu,
  X,
  Terminal,
  Activity,
  Database,
  Check,
  ArrowUpCircle
} from 'lucide-react';
import { NotificationCenter } from './NotificationCenter';
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

interface HeaderProps {
  title: string;
  subtitle?: string;
  onRefresh: () => void;
  isRefreshing: boolean;
  justRefreshed?: boolean;
  publicIP: string;
  showPublicIP?: boolean;
  onToggleShowPublicIP?: () => void;
  onToggleMobileSidebar?: () => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  onOpenUpdates?: () => void;
  hasUpdates?: boolean;
  onOpenXrayLogs?: () => void;
  onOpenXrayMetrics?: () => void;
  onOpenBackup?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  onRefresh,
  isRefreshing,
  justRefreshed = false,
  publicIP,
  showPublicIP = false,
  onToggleShowPublicIP,
  onToggleMobileSidebar,
  searchQuery,
  setSearchQuery,
  onOpenUpdates,
  hasUpdates,
  onOpenXrayLogs,
  onOpenXrayMetrics,
  onOpenBackup,
}) => {
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);

  return (
    <header className="h-16 border-b border-white/[0.07] bg-[#090a0f]/85 backdrop-blur-xl px-3 sm:px-6 flex items-center justify-between sticky top-0 z-20 select-none">
      {/* Mobile Search Overlay Mode */}
      {isMobileSearchOpen ? (
        <div className="w-full flex items-center gap-2 animate-in fade-in duration-150">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search ports, clients, remarks..."
              className="w-full pl-8.5 pr-8 py-1.5 bg-white/[0.06] border border-white/[0.15] rounded-lg text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-white/[0.3] transition font-sans"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-zinc-200"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => setIsMobileSearchOpen(false)}
            className="px-2.5 py-1.5 text-xs font-medium text-zinc-300 hover:text-white rounded-lg bg-white/[0.05] border border-white/[0.08] transition shrink-0"
          >
            Cancel
          </button>
        </div>
      ) : (
        <>
          {/* View Title & Mobile Hamburger */}
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            {onToggleMobileSidebar && (
              <button
                type="button"
                onClick={onToggleMobileSidebar}
                className="md:hidden p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-zinc-300 hover:text-white transition active:scale-95 shrink-0"
                title="Open Navigation Menu"
              >
                <Menu className="w-4 h-4" />
              </button>
            )}

            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-semibold text-zinc-100 tracking-tight flex items-center gap-2 truncate max-w-[130px] xs:max-w-[200px] sm:max-w-none">
                {title}
              </h1>
              {subtitle && (
                <p className="text-[11px] sm:text-xs text-zinc-400 font-sans mt-0.5 hidden md:block truncate">{subtitle}</p>
              )}
            </div>
          </div>

          {/* Right Controls: Search + Public IP + Updates + Refresh + Notifications */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {/* Desktop Search Bar */}
            <div className="relative w-48 lg:w-64 hidden sm:block">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search ports, clients, remarks..."
                className="w-full pl-8.5 pr-3 py-1.5 bg-white/[0.03] border border-white/[0.08] rounded-lg text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-white/[0.18] transition font-sans"
              />
            </div>

            {/* Mobile Search Icon Trigger */}
            <button
              type="button"
              onClick={() => setIsMobileSearchOpen(true)}
              className="sm:hidden p-2 rounded-lg border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] text-zinc-400 hover:text-zinc-200 transition"
              title="Search"
            >
              <Search className="w-3.5 h-3.5" />
            </button>

            {/* Public IP Badge (Masked by default) */}
            {publicIP && (
              <button
                type="button"
                onClick={onToggleShowPublicIP}
                title={showPublicIP ? "Click to mask IP" : "Click to reveal IP"}
                className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.08] text-xs font-mono text-zinc-300 hover:border-white/[0.18] hover:bg-white/[0.06] transition cursor-pointer select-none"
              >
                <Server className="w-3.5 h-3.5 text-zinc-400" />
                <span className="tracking-wider">
                  {showPublicIP ? publicIP : '••••••••••••'}
                </span>
                {showPublicIP ? (
                  <EyeOff className="w-3.5 h-3.5 text-zinc-400 hover:text-zinc-200 ml-0.5" />
                ) : (
                  <Eye className="w-3.5 h-3.5 text-zinc-500 hover:text-zinc-300 ml-0.5" />
                )}
              </button>
            )}

            {/* Xray Live Kernel Logs */}
            {onOpenXrayLogs && (
              <button
                type="button"
                onClick={onOpenXrayLogs}
                className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-xs font-mono text-neutral-300 hover:text-white transition cursor-pointer"
                title="Xray Core Live Kernel Logs"
              >
                <Terminal className="w-3.5 h-3.5 text-neutral-400" />
                <span className="hidden md:inline">Logs</span>
              </button>
            )}

            {/* Xray Telemetry Matrix */}
            {onOpenXrayMetrics && (
              <button
                type="button"
                onClick={onOpenXrayMetrics}
                className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-xs font-mono text-neutral-300 hover:text-white transition cursor-pointer"
                title="Xray Real-Time Telemetry Matrix"
              >
                <Activity className="w-3.5 h-3.5 text-neutral-400" />
                <span className="hidden md:inline">Matrix</span>
              </button>
            )}

            {/* Database Backup & Disaster Recovery */}
            {onOpenBackup && (
              <button
                type="button"
                onClick={onOpenBackup}
                className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-xs font-mono text-neutral-300 hover:text-white transition cursor-pointer"
                title="Database Backup & Disaster Recovery"
              >
                <Database className="w-3.5 h-3.5 text-neutral-400" />
                <span className="hidden md:inline">Backup</span>
              </button>
            )}

            {/* Updates indicator if available */}
            {onOpenUpdates && (
              <button
                type="button"
                onClick={onOpenUpdates}
                className={`p-2 sm:px-2.5 sm:py-1.5 rounded-xl text-xs font-medium border transition-all flex items-center gap-1.5 cursor-pointer select-none active:scale-95 ${
                  hasUpdates 
                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-600 dark:text-amber-300 hover:bg-amber-500/25 shadow-xs' 
                    : 'bg-white/80 dark:bg-zinc-900/80 border-neutral-200/90 dark:border-zinc-800 text-neutral-700 dark:text-zinc-300 hover:text-neutral-900 dark:hover:text-zinc-100 hover:bg-neutral-100 dark:hover:bg-zinc-800'
                }`}
                title={hasUpdates ? "System Update Available" : "System Updates"}
                aria-label="System Updates"
              >
                <ArrowUpCircle className={`w-3.5 h-3.5 ${hasUpdates ? 'text-amber-500 dark:text-amber-400 animate-pulse' : 'text-neutral-500 dark:text-zinc-400'}`} />
                <span className="hidden sm:inline">Updates</span>
                {hasUpdates && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping"></span>}
              </button>
            )}

            {/* GitHub Repository Link */}
            <a
              href="https://github.com/ADEL-MAHMOUD10/Nexus-panel"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-xl border border-neutral-200/90 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 hover:bg-neutral-100 dark:hover:bg-zinc-800 text-neutral-700 dark:text-zinc-400 hover:text-black dark:hover:text-white transition-all cursor-pointer select-none active:scale-95 shadow-xs flex items-center justify-center shrink-0"
              title="Nexus Panel on GitHub"
              aria-label="GitHub Repository"
            >
              <GithubIcon className="w-3.5 h-3.5" />
            </a>

            {/* Professional Light / Dark Mode Toggle */}
            <ThemeToggle />

            {/* Quick Refresh Button with Tactile Micro-interaction */}
            <button
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing}
              className={`group/refresh p-2 rounded-xl border transition-all duration-200 cursor-pointer active:scale-90 flex items-center justify-center relative shadow-xs ${
                justRefreshed
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-emerald-500/10'
                  : isRefreshing
                  ? 'bg-neutral-800 text-neutral-200 border-neutral-700'
                  : 'bg-neutral-900/80 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-100 border-neutral-800 hover:border-neutral-700'
              }`}
              title="Refresh Telemetry & Data (R)"
            >
              {justRefreshed ? (
                <Check className="w-3.5 h-3.5 text-emerald-400 animate-in zoom-in-75 duration-200 stroke-[2.5]" />
              ) : (
                <RefreshCw
                  className={`w-3.5 h-3.5 transition-transform duration-300 ${
                    isRefreshing ? 'animate-spin text-neutral-100' : 'group-hover/refresh:rotate-90 group-hover/refresh:scale-110'
                  }`}
                />
              )}
            </button>

            {/* Next-gen Notification Center */}
            <NotificationCenter />
          </div>
        </>
      )}
    </header>
  );
};
