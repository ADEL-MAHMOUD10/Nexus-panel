import React from 'react';
import { 
  LayoutDashboard, 
  Radio, 
  Users, 
  ShieldCheck, 
  Sliders, 
  FileText, 
  LogOut, 
  RefreshCw,
  Power
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  xrayRunning: boolean;
  onlineCount: number;
  inboundsCount: number;
  panelVersion: string;
  onLogout: () => void;
  onRestartXray: () => void;
  isRestartingXray: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  xrayRunning,
  onlineCount,
  inboundsCount,
  panelVersion,
  onLogout,
  onRestartXray,
  isRestartingXray,
}) => {
  const menuItems = [
    { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'inbounds', label: 'Inbounds', icon: Radio, count: inboundsCount },
    { id: 'clients', label: 'Clients', icon: Users, badge: onlineCount > 0 ? `${onlineCount} Live` : undefined },
    { id: 'certificates', label: 'Certificates', icon: ShieldCheck },
    { id: 'config', label: 'Core Config', icon: Sliders },
    { id: 'logs', label: 'System Logs', icon: FileText },
  ];

  return (
    <aside className="w-64 bg-[#090a0f]/85 backdrop-blur-2xl border-r border-white/[0.07] flex flex-col justify-between shrink-0 h-screen select-none relative z-30">
      {/* Top Branding Header */}
      <div>
        <div className="h-16 px-4 flex items-center justify-between border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            {/* Minimalist Professional Logo Mark */}
            <div className="w-8 h-8 rounded-lg bg-zinc-100 text-zinc-950 flex items-center justify-center font-bold text-sm tracking-tighter shadow-sm font-sans shrink-0">
              N
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-sm text-zinc-100 tracking-tight">Nexus</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/[0.06] text-zinc-300 border border-white/[0.08] font-medium">
                  v1.1
                </span>
              </div>
              <span className="text-[11px] text-zinc-400 font-sans block leading-tight">Proxy Engine</span>
            </div>
          </div>

          {/* Core Status indicator */}
          <button
            onClick={onRestartXray}
            disabled={isRestartingXray}
            title={xrayRunning ? 'Core Active (Click to Restart)' : 'Core Inactive (Click to Restart)'}
            className="p-1.5 rounded-lg border border-white/[0.08] hover:border-white/[0.16] bg-white/[0.03] hover:bg-white/[0.06] text-zinc-400 hover:text-zinc-200 transition flex items-center gap-1.5 text-xs"
          >
            <span className={`w-1.5 h-1.5 rounded-full ${xrayRunning ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
            <RefreshCw className={`w-3 h-3 text-zinc-400 ${isRestartingXray ? 'animate-spin text-emerald-400' : ''}`} />
          </button>
        </div>

        {/* Navigation Menu */}
        <nav className="p-3 space-y-1 mt-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-zinc-800/90 text-white border border-zinc-700/60 shadow-xs'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon
                    className={`w-4 h-4 transition-colors ${
                      isActive ? 'text-zinc-100' : 'text-zinc-400'
                    }`}
                  />
                  <span>{item.label}</span>
                </div>

                {item.badge && (
                  <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    {item.badge}
                  </span>
                )}
                {item.count !== undefined && !item.badge && (
                  <span className="text-[11px] font-mono text-zinc-500">
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Info & User Controls */}
      <div className="p-3 border-t border-white/[0.06] space-y-2">
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
            {panelVersion || 'v1.1.0'}
          </span>
        </div>

        {/* User logout button */}
        <button
          onClick={onLogout}
          className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.05] transition"
        >
          <div className="flex items-center gap-2">
            <LogOut className="w-3.5 h-3.5 text-zinc-400" />
            <span>Sign Out</span>
          </div>
          <span className="text-[10px] font-mono text-zinc-500">Admin</span>
        </button>
      </div>
    </aside>
  );
};
