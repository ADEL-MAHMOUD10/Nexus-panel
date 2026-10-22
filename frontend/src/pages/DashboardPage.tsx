import React from 'react';
import { 
  Cpu, 
  Layers, 
  HardDrive, 
  Activity, 
  Radio, 
  ArrowRight, 
  Zap, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Sparkles,
  Server,
  RefreshCw,
  Clock,
  ShieldCheck,
  ShieldAlert,
  ArrowUpCircle
} from 'lucide-react';
import { ServerStatus, Inbound, UpdateInfo } from '../types';
import { RadialHealthGauge } from '../components/RadialHealthGauge';
import { TrafficChart } from '../components/TrafficChart';

interface DashboardPageProps {
  status: ServerStatus;
  inbounds: Inbound[];
  onNavigateTab: (tab: string) => void;
  formatBytes: (bytes: number) => string;
  formatSpeed: (bytesPerSec: number) => string;
  updates?: UpdateInfo;
  onOpenUpdatesModal?: () => void;
  onRestartXray?: () => void;
  isRestartingXray?: boolean;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  status,
  inbounds,
  onNavigateTab,
  formatBytes,
  formatSpeed,
  updates,
  onOpenUpdatesModal,
  onRestartXray,
  isRestartingXray,
}) => {
  let totalClients = 0;
  let onlineClients = 0;
  let totalUpload = 0;
  let totalDownload = 0;

  inbounds.forEach((inb) => {
    totalUpload += inb.up || 0;
    totalDownload += inb.down || 0;
    if (inb.clients) {
      totalClients += inb.clients.length;
      onlineClients += inb.clients.filter((c) => c.isOnline).length;
    }
  });

  const cpuLoad = status.cpu.usedPercent || 0;
  const ramLoad = status.mem.usedPercent || 0;
  const diskLoad = status.disk.usedPercent || 0;
  const healthScore = Math.max(5, Math.min(100, 100 - (cpuLoad * 0.45 + ramLoad * 0.45 + diskLoad * 0.1)));

  // Sparkline SVG generator
  const renderSparkline = (data: number[], color: string, height = 36, max = 100) => {
    if (!data || data.length < 2) return null;
    const width = 220;
    const step = width / (data.length - 1);
    const points = data.map((val, idx) => {
      const x = idx * step;
      const y = height - (Math.min(max, Math.max(0, val)) / max) * height;
      return `${x},${y}`;
    });
    const dLine = `M ${points.join(' L ')}`;
    const dArea = `${dLine} L ${width},${height} L 0,${height} Z`;

    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-9 overflow-visible">
        <defs>
          <linearGradient id={`grad-${color}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0.0} />
          </linearGradient>
        </defs>
        <path d={dArea} fill={`url(#grad-${color})`} />
        <path d={dLine} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  };

  return (
    <div className="space-y-6">
      {/* 1. TOP STATS BAR: 4 Deep Hardware Cards (CPU Model/Freq, RAM Speed/Display, SWAP, Storage) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* CPU Card */}
        <div className="bg-[#0f1117] border border-white/[0.08] rounded-2xl p-4.5 shadow-lg flex flex-col justify-between hover:border-white/20 transition">
          <div>
            <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
              <span className="font-semibold text-white flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee]"></span> CPU
              </span>
              <span className="font-mono text-[11px] text-cyan-300">
                {status.cpu.cores} Cores @ {status.cpu.freqGHz?.toFixed(2) || '2.80'} GHz
              </span>
            </div>
            <div className="flex items-baseline justify-between my-1">
              <span className="text-3xl font-mono font-bold text-white tracking-tight">
                {Math.round(status.cpu.usedPercent)}%
              </span>
              <span className="text-[10px] text-zinc-400 font-sans truncate max-w-[140px]" title={status.cpu.model}>
                {status.cpu.model || 'Standard Processor'}
              </span>
            </div>
          </div>

          <div className="my-2">
            {renderSparkline(status.cpu.history, '#06b6d4')}
          </div>

          <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400 pt-2 border-t border-white/[0.06]">
            <span>AVG: <b className="text-white font-normal">{status.cpu.avg?.toFixed(1) || 0}%</b></span>
            <span>PEAK: <b className="text-white font-normal">{status.cpu.peak?.toFixed(1) || 0}%</b></span>
          </div>
        </div>

        {/* RAM Card */}
        <div className="bg-[#0f1117] border border-white/[0.08] rounded-2xl p-4.5 shadow-lg flex flex-col justify-between hover:border-white/20 transition">
          <div>
            <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-white flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]"></span> RAM
                </span>
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  {status.mem.display || 'DDR4 @ 3200 MHz'}
                </span>
              </div>
              <span className="font-mono text-[11px] text-zinc-300">
                {formatBytes(status.mem.used)} / {formatBytes(status.mem.total)}
              </span>
            </div>
            <div className="flex items-baseline justify-between my-1">
              <span className="text-3xl font-mono font-bold text-white tracking-tight">
                {Math.round(status.mem.usedPercent)}%
              </span>
              <div className="text-right">
                <span className="text-[11px] font-mono text-emerald-400 block font-medium">
                  Avail: {formatBytes(status.mem.available || (status.mem.total - status.mem.used))}
                </span>
                <span className="text-[9px] font-mono text-zinc-500 block">
                  Cache: {formatBytes((status.mem.cached || 0) + (status.mem.buffers || 0))}
                </span>
              </div>
            </div>
          </div>

          <div className="my-2">
            {renderSparkline(status.mem.history, '#10b981')}
          </div>

          <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400 pt-2 border-t border-white/[0.06]">
            <span>FREE: <b className="text-white font-normal">{formatBytes(status.mem.free || 0)}</b></span>
            <span>PEAK: <b className="text-white font-normal">{status.mem.peak?.toFixed(1) || 0}%</b></span>
          </div>
        </div>

        {/* SWAP Card */}
        <div className="bg-[#0f1117] border border-white/[0.08] rounded-2xl p-4.5 shadow-lg flex flex-col justify-between hover:border-white/20 transition">
          <div>
            <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
              <span className="font-semibold text-white flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_8px_#fbbf24]"></span> SWAP
              </span>
              <span className="font-mono text-[11px] text-zinc-300">
                {formatBytes(status.swap.used)} / {formatBytes(status.swap.total)}
              </span>
            </div>
            <div className="flex items-baseline justify-between my-1">
              <span className="text-3xl font-mono font-bold text-white tracking-tight">
                {Math.round(status.swap.usedPercent)}%
              </span>
              <span className="text-[10px] text-zinc-400 font-sans">Virtual Memory</span>
            </div>
          </div>

          <div className="my-2">
            {renderSparkline(status.swap.history || [0, 0, 0], '#fbbf24')}
          </div>

          <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400 pt-2 border-t border-white/[0.06]">
            <span>USED: <b className="text-white font-normal">{formatBytes(status.swap.used)}</b></span>
            <span>TOTAL: <b className="text-white font-normal">{formatBytes(status.swap.total)}</b></span>
          </div>
        </div>

        {/* Storage Card */}
        <div className="bg-[#0f1117] border border-white/[0.08] rounded-2xl p-4.5 shadow-lg flex flex-col justify-between hover:border-white/20 transition">
          <div>
            <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
              <span className="font-semibold text-white flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-purple-400 shadow-[0_0_8px_#c084fc]"></span> Storage
              </span>
              <span className="font-mono text-[11px] text-zinc-300">
                {formatBytes(status.disk.used)} / {formatBytes(status.disk.total)}
              </span>
            </div>
            <div className="flex items-baseline justify-between my-1">
              <span className="text-3xl font-mono font-bold text-white tracking-tight">
                {Math.round(status.disk.usedPercent)}%
              </span>
              <span className="text-[10px] text-zinc-400 font-sans">
                Free: {formatBytes(status.disk.free)}
              </span>
            </div>
          </div>

          <div className="my-4">
            <div className="w-full bg-[#181a22] h-2.5 rounded-full overflow-hidden border border-white/5">
              <div 
                className="bg-gradient-to-r from-purple-500 to-indigo-400 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.round(status.disk.usedPercent))}%` }}
              ></div>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400 pt-2 border-t border-white/[0.06]">
            <span>FREE: <b className="text-white font-normal">{formatBytes(status.disk.free)}</b></span>
            <span>TOTAL: <b className="text-white font-normal">{formatBytes(status.disk.total)}</b></span>
          </div>
        </div>
      </div>

      {/* 2. MAIN SECTION: System Health Radial Arc (Left) + Network Throughput with Speed Gauges (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: System Health Arc & Core Status */}
        <div className="lg:col-span-5 bg-[#0f1117] border border-white/[0.08] rounded-2xl p-5 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
              <span className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-400" />
                System Health & Core
              </span>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {status.xrayRunning ? 'Optimal' : 'Core Inactive'}
                </span>
              </div>
            </div>

            {/* Glowing Radial Health Arc Gauge */}
            <div className="my-4 flex items-center justify-center">
              <RadialHealthGauge score={healthScore} title="calculated server status" />
            </div>
          </div>

          {/* Core Service Tags */}
          <div className="pt-3 border-t border-white/[0.06] grid grid-cols-2 gap-2 text-xs font-mono">
            <div className="p-2 rounded-xl bg-white/[0.02] border border-white/[0.04] flex items-center justify-between">
              <span className="text-zinc-500">Xray Core:</span>
              <span className={status.xrayRunning ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                {status.xrayRunning ? 'Active' : 'Offline'}
              </span>
            </div>
            <div className="p-2 rounded-xl bg-white/[0.02] border border-white/[0.04] flex items-center justify-between">
              <span className="text-zinc-500">Kernel Uptime:</span>
              <span className="text-zinc-200">{status.uptime.os || 'Active'}</span>
            </div>
            <div className="p-2 rounded-xl bg-white/[0.02] border border-white/[0.04] flex items-center justify-between">
              <span className="text-zinc-500">OS Kernel:</span>
              <span className="text-zinc-200 truncate max-w-[110px]" title={status.os}>{status.os}</span>
            </div>
            <div className="p-2 rounded-xl bg-white/[0.02] border border-white/[0.04] flex items-center justify-between">
              <span className="text-zinc-500">Public IP:</span>
              <span className="text-cyan-300 font-bold">{status.publicIP || '127.0.0.1'}</span>
            </div>
          </div>
        </div>

        {/* Right Column: Dual-stream Network Traffic Chart & Live Throughput Area */}
        <div className="lg:col-span-7 bg-[#0f1117] border border-white/[0.08] rounded-2xl p-5 shadow-xl flex flex-col justify-between">
          {/* Card Header */}
          <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
            <span className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
              <Radio className="w-4 h-4 text-cyan-400" />
              Network Traffic & Throughput
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-white/5 text-zinc-400 border border-white/5">
                Peak: {formatSpeed(status.net.peakSpeed || 0)}
              </span>
              {onOpenUpdatesModal && (
                <button
                  onClick={onOpenUpdatesModal}
                  className="text-[11px] font-mono px-2 py-0.5 rounded bg-blue-500/15 text-blue-300 border border-blue-500/30 hover:bg-blue-500/25 transition flex items-center gap-1"
                >
                  <ArrowUpCircle className="w-3 h-3" />
                  <span>Check Updates</span>
                </button>
              )}
            </div>
          </div>

          {/* Quick Accumulator Tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-3.5">
            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
              <span className="text-[10px] text-zinc-500 font-sans block">Total In</span>
              <span className="text-sm font-mono font-bold text-cyan-300 mt-0.5 block">
                {formatBytes(status.net.bytesRecv || totalDownload)}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
              <span className="text-[10px] text-zinc-500 font-sans block">Total Out</span>
              <span className="text-sm font-mono font-bold text-emerald-300 mt-0.5 block">
                {formatBytes(status.net.bytesSent || totalUpload)}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
              <span className="text-[10px] text-zinc-500 font-sans block">Active Listeners</span>
              <span className="text-sm font-mono font-bold text-zinc-200 mt-0.5 block">
                {inbounds.filter((i) => i.enable).length} / {inbounds.length}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
              <span className="text-[10px] text-zinc-500 font-sans block">Online Clients</span>
              <span className="text-sm font-mono font-bold text-emerald-400 mt-0.5 block flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                {onlineClients} / {totalClients}
              </span>
            </div>
          </div>

          {/* Traffic Waveform Chart Container */}
          <div className="flex-1 my-1">
            <TrafficChart
              historyUp={status.net.historyUp || []}
              historyDown={status.net.historyDown || []}
              currentUpSpeed={status.net.speedUp || 0}
              currentDownSpeed={status.net.speedDown || 0}
              formatSpeed={formatSpeed}
            />
          </div>

          {/* Card Footer */}
          <div className="mt-3 pt-3 border-t border-white/[0.06] flex items-center justify-between text-xs text-zinc-400">
            <span>Dynamic gRPC streaming metrics</span>
            <button
              onClick={() => onNavigateTab('inbounds')}
              className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-medium transition"
            >
              <span>Manage Inbounds</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 3. Sockets & Process Stats Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#0f1117] border border-white/[0.08] rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] text-zinc-500 font-sans">Open Socket Handles</span>
            <span className="text-xl font-mono font-bold text-white block mt-0.5">
              {status.sockets.total || (status.sockets.tcp + status.sockets.udp) || 0}
            </span>
          </div>
          <div className="text-right font-mono text-xs">
            <span className="text-cyan-400 block">TCP: {status.sockets.tcp || 0}</span>
            <span className="text-emerald-400 block">UDP: {status.sockets.udp || 0}</span>
          </div>
        </div>

        <div className="bg-[#0f1117] border border-white/[0.08] rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] text-zinc-500 font-sans">Panel Memory Footprint</span>
            <span className="text-xl font-mono font-bold text-zinc-200 block mt-0.5">
              {status.panel.memMB?.toFixed(1) || '15'} MB
            </span>
          </div>
          <span className="text-xs font-mono text-zinc-400">
            {status.panel.threads || 8} Threads
          </span>
        </div>

        <div className="bg-[#0f1117] border border-white/[0.08] rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] text-zinc-500 font-sans">Xray Core Release</span>
            <span className="text-xl font-mono font-bold text-emerald-400 block mt-0.5">
              {status.xrayVersion || 'v26.10.10'}
            </span>
          </div>
          {onRestartXray && (
            <button
              onClick={onRestartXray}
              disabled={isRestartingXray}
              className="px-3 py-1.5 rounded-xl bg-white/[0.03] hover:bg-white/10 text-xs text-zinc-300 hover:text-white border border-white/10 transition flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRestartingXray ? 'animate-spin text-emerald-400' : ''}`} />
              <span>Restart</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
