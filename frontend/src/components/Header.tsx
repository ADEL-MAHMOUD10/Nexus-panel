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
    <header className="h-16 border-b border-zinc-800/80 bg-[#0d0e12]/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-20 select-none">
      {/* View Title */}
      <div>
        <h1 className="text-base font-semibold text-zinc-100 tracking-tight flex items-center gap-2">
          {title}
        </h1>
        {subtitle && (
          <p className="text-xs text-zinc-500 font-sans mt-0.5">{subtitle}</p>
        )}
      </div>

      {/* Right Controls: Search + Public IP + Refresh */}
      <div className="flex items-center gap-2.5">
        {/* Search Bar */}
        <div className="relative w-64 hidden sm:block">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search ports, clients, remarks..."
            className="w-full pl-8.5 pr-3 py-1.5 bg-zinc-900/80 border border-zinc-800 rounded-lg text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-700 transition font-sans"
          />
        </div>

        {/* Public IP Badge */}
        {publicIP && (
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-900/80 border border-zinc-800 text-xs font-mono text-zinc-300">
            <Server className="w-3.5 h-3.5 text-zinc-500" />
            <span>{publicIP}</span>
          </div>
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
