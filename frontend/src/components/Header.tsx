import React from 'react';
import { 
  Search, 
  RefreshCw, 
  ExternalLink,
  ShieldAlert,
  Server
} from 'lucide-react';
import { NotificationCenter } from './NotificationCenter';

interface HeaderProps {
  title: string;
  subtitle?: string;
  onRefresh: () => void;
  isRefreshing: boolean;
  publicIP: string;
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
  searchQuery,
  setSearchQuery,
  onOpenUpdates,
  hasUpdates,
}) => {
  return (
    <header className="h-18 border-b border-white/[0.06] bg-[#0c0d12]/60 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-20 select-none">
      {/* View Title */}
      <div>
        <h1 className="text-lg font-bold text-white tracking-wide flex items-center gap-2">
          {title}
        </h1>
        {subtitle && (
          <p className="text-xs text-zinc-400 font-sans">{subtitle}</p>
        )}
      </div>

      {/* Right Controls: Search + Public IP + Refresh */}
      <div className="flex items-center gap-3">
        {/* Search Bar */}
        <div className="relative w-64 hidden sm:block">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search ports, clients, remarks..."
            className="w-full pl-8.5 pr-3 py-1.5 bg-[#14171e] border border-white/[0.08] rounded-xl text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-cyan-500/50 transition font-sans"
          />
        </div>

        {/* Public IP Badge */}
        {publicIP && (
          <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#14171e] border border-white/[0.06] text-xs font-mono text-zinc-300">
            <Server className="w-3.5 h-3.5 text-zinc-500" />
            <span>{publicIP}</span>
          </div>
        )}

        {/* Updates indicator if available */}
        {onOpenUpdates && (
          <button
            onClick={onOpenUpdates}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition flex items-center gap-1.5 ${
              hasUpdates 
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20' 
                : 'bg-white/[0.02] border-white/[0.06] text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.05]'
            }`}
          >
            <ShieldAlert className={`w-3.5 h-3.5 ${hasUpdates ? 'text-amber-400 animate-pulse' : 'text-zinc-500'}`} />
            <span>Updates</span>
            {hasUpdates && <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>}
          </button>
        )}

        {/* Refresh Button */}
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="p-2 rounded-xl border border-white/[0.08] bg-[#14171e] hover:bg-[#191d26] text-zinc-300 hover:text-white transition shadow-sm"
          title="Refresh Data"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-cyan-400' : ''}`} />
        </button>

        {/* Next-gen Notification Center */}
        <NotificationCenter />
      </div>
    </header>
  );
};
