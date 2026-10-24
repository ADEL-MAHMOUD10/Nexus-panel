import React, { useState, useEffect, useCallback } from 'react';
import { 
  Activity, 
  X, 
  RefreshCw, 
  Cpu, 
  Database, 
  Layers, 
  Radio, 
  Wifi, 
  Zap, 
  ShieldCheck, 
  ArrowUpRight, 
  ArrowDownLeft,
  Users,
  Clock,
  HardDrive,
  BarChart3
} from 'lucide-react';
import api from '../services/api';
import { XrayMetricsData } from '../types';

interface XrayMetricsModalProps {
  isOpen: boolean;
  onClose: () => void;
  formatBytes: (bytes: number) => string;
  formatSpeed?: (bytesPerSec: number) => string;
}

export const XrayMetricsModal: React.FC<XrayMetricsModalProps> = ({
  isOpen,
  onClose,
  formatBytes,
  formatSpeed = (b) => `${Math.round(b)} B/s`,
}) => {
  const [metrics, setMetrics] = useState<XrayMetricsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchMetrics = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/server/xraymetrics');
      if (res.data) {
        setMetrics(res.data);
      }
    } catch (e) {
      // ignore transient error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchMetrics();
    }
  }, [isOpen, fetchMetrics]);

  useEffect(() => {
    if (!isOpen || !autoRefresh) return;
    const interval = setInterval(() => {
      fetchMetrics();
    }, 2500);
    return () => clearInterval(interval);
  }, [isOpen, autoRefresh, fetchMetrics]);

  if (!isOpen) return null;

  const formatUptime = (seconds: number) => {
    if (!seconds || seconds <= 0) return '0s';
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m ${s}s`;
  };

  const mem = metrics?.memory;
  const kernel = metrics?.kernel;
  const tp = metrics?.throughput;
  const inbounds = metrics?.inbounds || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div 
        className="w-full max-w-5xl max-h-[90vh] bg-[#090a0f] border border-white/[0.12] rounded-2xl shadow-2xl flex flex-col overflow-hidden relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/[0.08] bg-[#0c0d14] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white tracking-wide">Xray Core Telemetry Matrix</h3>
                <span className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  REAL-TIME STATS
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 font-mono">
                Runtime memory, active goroutines, and per-listener throughput matrix
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono font-medium transition border flex items-center gap-1.5 ${
                autoRefresh
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-zinc-800 text-zinc-400 border-zinc-700'
              }`}
            >
              <span>{autoRefresh ? 'Live Poll (2.5s)' : 'Paused'}</span>
            </button>

            <button
              onClick={fetchMetrics}
              title="Refresh Matrix"
              className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white border border-white/10 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-purple-400' : ''}`} />
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white border border-white/10 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Content */}
        <div className="p-5 overflow-y-auto space-y-5">
          {/* Top KPI Cards Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
            {/* Live Upload Speed */}
            <div className="p-4 rounded-xl bg-[#0c0d14] border border-white/[0.06] space-y-1">
              <div className="flex items-center justify-between text-zinc-400 text-xs">
                <span className="flex items-center gap-1.5">
                  <ArrowUpRight className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Outbound Speed</span>
                </span>
                <span className="text-[10px] font-mono text-cyan-400">Live</span>
              </div>
              <div className="text-lg font-bold font-mono text-white tracking-tight">
                {formatSpeed(tp?.totalUpSpeed || 0)}
              </div>
              <div className="text-[10px] text-zinc-500 font-mono">Aggregated across all inbounds</div>
            </div>

            {/* Live Download Speed */}
            <div className="p-4 rounded-xl bg-[#0c0d14] border border-white/[0.06] space-y-1">
              <div className="flex items-center justify-between text-zinc-400 text-xs">
                <span className="flex items-center gap-1.5">
                  <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Inbound Speed</span>
                </span>
                <span className="text-[10px] font-mono text-emerald-400">Live</span>
              </div>
              <div className="text-lg font-bold font-mono text-white tracking-tight">
                {formatSpeed(tp?.totalDownSpeed || 0)}
              </div>
              <div className="text-[10px] text-zinc-500 font-mono">Incoming tunnel stream rate</div>
            </div>

            {/* Active Online Clients */}
            <div className="p-4 rounded-xl bg-[#0c0d14] border border-white/[0.06] space-y-1">
              <div className="flex items-center justify-between text-zinc-400 text-xs">
                <span className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-purple-400" />
                  <span>Online Clients</span>
                </span>
                <span className="text-[10px] font-mono text-purple-400">Sockets</span>
              </div>
              <div className="text-lg font-bold font-mono text-white tracking-tight flex items-center gap-2">
                <span>{tp?.totalOnlineClients || 0}</span>
                {(tp?.totalOnlineClients || 0) > 0 && (
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
                )}
              </div>
              <div className="text-[10px] text-zinc-500 font-mono">Active within 90s grace period</div>
            </div>

            {/* Core Memory & GC */}
            <div className="p-4 rounded-xl bg-[#0c0d14] border border-white/[0.06] space-y-1">
              <div className="flex items-center justify-between text-zinc-400 text-xs">
                <span className="flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-amber-400" />
                  <span>Kernel Memory</span>
                </span>
                <span className="text-[10px] font-mono text-amber-400">Heap</span>
              </div>
              <div className="text-lg font-bold font-mono text-white tracking-tight">
                {formatBytes(mem?.heapAlloc || 0)}
              </div>
              <div className="text-[10px] text-zinc-500 font-mono">
                Sys: {formatBytes(mem?.sys || 0)} • GC: {mem?.numGC || 0}
              </div>
            </div>
          </div>

          {/* Core Runtime Details Card */}
          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
            <div className="flex items-center gap-2 text-zinc-400">
              <ShieldCheck className="w-4 h-4 text-cyan-400" />
              <span>Kernel Version:</span>
              <span className="text-white font-bold">{kernel?.version || 'Xray-core'}</span>
            </div>
            <div className="flex items-center gap-2 text-zinc-400">
              <Clock className="w-4 h-4 text-emerald-400" />
              <span>Core Uptime:</span>
              <span className="text-white font-bold">{formatUptime(kernel?.uptime || 0)}</span>
            </div>
            <div className="flex items-center gap-2 text-zinc-400">
              <Cpu className="w-4 h-4 text-purple-400" />
              <span>Process ID:</span>
              <span className="text-white font-bold">{kernel?.pid || 'OS Service'}</span>
            </div>
            <div className="flex items-center gap-2 text-zinc-400">
              <Layers className="w-4 h-4 text-amber-400" />
              <span>Goroutines:</span>
              <span className="text-white font-bold">{mem?.goroutines || 0}</span>
            </div>
          </div>

          {/* Inbounds Telemetry Table */}
          <div className="rounded-xl border border-white/[0.08] bg-[#0c0d14] overflow-hidden">
            <div className="px-4 py-3 border-b border-white/[0.06] bg-white/[0.02] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-cyan-400" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-white">Inbounds Throughput Matrix</h4>
              </div>
              <span className="text-[11px] font-mono text-zinc-500">{inbounds.length} listeners configured</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-white/[0.06] bg-white/[0.01] text-zinc-400 text-[11px]">
                    <th className="py-2.5 px-4">Port / Tag</th>
                    <th className="py-2.5 px-4">Protocol</th>
                    <th className="py-2.5 px-4">Live Throughput</th>
                    <th className="py-2.5 px-4">Total Accrued</th>
                    <th className="py-2.5 px-4 text-right">Clients (Online)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {inbounds.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-zinc-600">
                        No inbounds currently active.
                      </td>
                    </tr>
                  ) : (
                    inbounds.map((inb) => {
                      const hasSpeed = (inb.upSpeed || 0) > 0 || (inb.downSpeed || 0) > 0;
                      return (
                        <tr key={inb.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-bold text-white flex items-center gap-1.5">
                              <span>:{inb.port}</span>
                              <span className="text-[10px] text-zinc-500 font-normal">({inb.tag})</span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded text-[10px] uppercase font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                              {inb.protocol}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            {hasSpeed ? (
                              <span className="text-emerald-400 font-semibold flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping inline-block" />
                                <span>↑{formatSpeed(inb.upSpeed || 0)}</span>
                                <span>•</span>
                                <span>↓{formatSpeed(inb.downSpeed || 0)}</span>
                              </span>
                            ) : (
                              <span className="text-zinc-600">Idle (0 B/s)</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-zinc-300">
                            {formatBytes(inb.up || 0)} / {formatBytes(inb.down || 0)}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className="flex items-center justify-end gap-1.5">
                              <span className="text-zinc-300 font-semibold">{inb.clients}</span>
                              {inb.online > 0 ? (
                                <span className="text-emerald-400 font-semibold text-[11px] bg-emerald-500/15 border border-emerald-500/25 px-1.5 py-0.2 rounded">
                                  {inb.online} live
                                </span>
                              ) : (
                                <span className="text-zinc-600 text-[11px]">(0 live)</span>
                              )}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-white/[0.06] bg-[#0c0d14] flex items-center justify-between text-xs font-mono text-zinc-500 shrink-0">
          <div>Telemetry source: Xray Core StatsService gRPC & Go Runtime</div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white border border-white/10 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
