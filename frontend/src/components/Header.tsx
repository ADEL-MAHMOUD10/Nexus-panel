import React from 'react';
import { 
  Search, 
  RefreshCw, 
  ExternalLink,
  ShieldAlert,
  Server,
  Eye,
  EyeOff
} from 'lucide-react';
import { NotificationCenter } from './NotificationCenter';

interface HeaderProps {
  title: string;
  subtitle?: string;
  onRefresh: () => void;
  isRefreshing: boolean;
  publicIP: string;
  showPublicIP?: boolean;
  onToggleShowPublicIP?: () => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  onOpenUpdates?: () => void;
  hasUpdates?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  onRefresh,
  isRefreshing,
  publicIP,
  showPublicIP = false,
  onToggleShowPublicIP,
  searchQuery,
  setSearchQuery,
  onOpenUpdates,
  hasUpdates,
}) => {
  return (
    <header className="h-16 border-b border-white/[0.07] bg-[#090a0f]/80 backdrop-blur-xl px-6 flex items-center justify-between sticky top-0 z-20 select-none">
      {/* View Title */}
      <div>
        <h1 className="text-base font-semibold text-zinc-100 tracking-tight flex items-center gap-2">
          {title}
        </h1>
        {subtitle && (
          <p className="text-xs text-zinc-400 font-sans mt-0.5">{subtitle}</p>
        )}
      </div>

      {/* Right Controls: Search + Public IP + Refresh */}
      <div className="flex items-center gap-2.5">
        {/* Search Bar */}
        <div className="relative w-64 hidden sm:block">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search ports, clients, remarks..."
            className="w-full pl-8.5 pr-3 py-1.5 bg-white/[0.03] border border-white/[0.08] rounded-lg text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-white/[0.18] transition font-sans"
          />
        </div>

        {/* Public IP Badge (Masked by default) */}
        {publicIP && (
          <button
            type="button"
            onClick={onToggleShowPublicIP}
            title={showPublicIP ? "Click to mask IP" : "Click to reveal IP"}
            className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.08] text-xs font-mono text-zinc-300 hover:border-white/[0.18] hover:bg-white/[0.06] transition cursor-pointer select-none"
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

        {/* Updates indicator if available */}
        {onOpenUpdates && (
          <button
            onClick={onOpenUpdates}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition flex items-center gap-1.5 ${
              hasUpdates 
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20' 
                : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5 text-zinc-400" />
            <span>Updates</span>
            {hasUpdates && <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>}
          </button>
        )}

        {/* Refresh Button */}
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="p-2 rounded-lg border border-zinc-800 bg-zinc-900/80 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition"
          title="Refresh Data"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-zinc-200' : ''}`} />
        </button>

        {/* Next-gen Notification Center */}
        <NotificationCenter />
      </div>
    </header>
  );
};
