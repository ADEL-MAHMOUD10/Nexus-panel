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
    <aside className="w-64 bg-[#07090e]/80 backdrop-blur-2xl border-r border-white/[0.07] flex flex-col justify-between shrink-0 h-screen select-none relative z-30">
      {/* Top Branding Header */}
      <div>
        <div className="h-18 px-5 flex items-center justify-between border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            {/* Holographic Glowing Nexus Emblem */}
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 via-white/[0.05] to-transparent border border-cyan-500/30 flex items-center justify-center shadow-[0_0_20px_rgba(6,182,212,0.25)] relative overflow-hidden group">
              <div className="absolute inset-0 bg-cyan-400/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              {/* Futuristic Angular N Glyph */}
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-cyan-300 drop-shadow-[0_0_8px_#22d3ee]" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 20V4l16 16V4" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-black tracking-[0.22em] text-sm font-mono text-nexus-gradient text-nexus-glow">
                  NEXUS
                </span>
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 font-bold border border-cyan-500/30">
                  CORE
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]"></span>
                <span className="text-[10px] text-zinc-400 font-mono tracking-tight uppercase">Quantum Router</span>
              </div>
            </div>
          </div>

          {/* Core Status indicator */}
          <button
            onClick={onRestartXray}
            disabled={isRestartingXray}
            title={xrayRunning ? 'Core Active (Click to Restart)' : 'Core Inactive (Click to Restart)'}
            className="p-1.5 rounded-lg border border-white/10 hover:border-white/20 bg-white/[0.02] hover:bg-white/[0.05] transition flex items-center gap-1 text-xs"
          >
            <span className={`w-2 h-2 rounded-full ${xrayRunning ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-rose-500 animate-pulse'}`}></span>
            <RefreshCw className={`w-3.5 h-3.5 text-zinc-400 ${isRestartingXray ? 'animate-spin text-emerald-400' : ''}`} />
          </button>
        </div>

        {/* Navigation Menu */}
        <nav className="p-3 space-y-1.5 mt-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all group ${
                  isActive
                    ? 'bg-gradient-to-r from-white/[0.08] to-white/[0.02] text-white border border-white/10 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.03]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-4 h-4 transition-colors ${
                      isActive ? 'text-emerald-400' : 'text-zinc-400 group-hover:text-zinc-200'
                    }`}
                  />
                  <span>{item.label}</span>
                </div>

                {item.badge && (
                  <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    {item.badge}
                  </span>
                )}
                {item.count !== undefined && !item.badge && (
                  <span className="text-[11px] font-mono text-zinc-500 group-hover:text-zinc-400">
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
        <div className="p-3 rounded-xl bg-gradient-to-b from-[#14171e] to-[#0f1116] border border-white/[0.06] flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5">
              <Power className={`w-3.5 h-3.5 ${xrayRunning ? 'text-emerald-400' : 'text-rose-400'}`} />
              <span className="text-xs font-semibold text-zinc-300">Xray-core</span>
            </div>
            <span className="text-[11px] font-mono text-zinc-500">{xrayRunning ? 'Active & Routing' : 'Stopped'}</span>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 text-zinc-400 border border-white/5">
            {panelVersion || 'v1.0.8'}
          </span>
        </div>

        {/* User logout button */}
        <button
          onClick={onLogout}
          className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs text-zinc-400 hover:text-rose-300 hover:bg-rose-500/10 transition border border-transparent hover:border-rose-500/20"
        >
          <div className="flex items-center gap-2">
            <LogOut className="w-4 h-4 text-zinc-500" />
            <span>Sign Out Panel</span>
          </div>
          <span className="text-[10px] font-mono text-zinc-600">Admin</span>
        </button>
      </div>
    </aside>
  );
};
