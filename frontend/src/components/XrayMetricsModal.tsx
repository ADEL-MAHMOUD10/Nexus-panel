import React, { useState, useEffect, useCallback } from 'react';
import { 
  Activity, 
  X, 
  RefreshCw, 
  Check,
  Pause,
  Play,
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
import { useNotification } from '../context/NotificationContext';
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
  const { notify } = useNotification();
  const [metrics, setMetrics] = useState<XrayMetricsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [justRefreshed, setJustRefreshed] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchMetrics = useCallback(async (isManual: boolean = false) => {
    try {
      setLoading(true);
      const minDelay = isManual ? new Promise((res) => setTimeout(res, 750)) : Promise.resolve();
      const [res] = await Promise.all([
        api.get('/api/server/xraymetrics'),
        minDelay
      ]);
      if (res.data) {
        setMetrics(res.data);
      }
      if (isManual) {
        setJustRefreshed(true);
        notify.success('Matrix Refreshed', 'Telemetry runtime metrics synchronized.');
        setTimeout(() => setJustRefreshed(false), 1600);
      }
    } catch (e) {
      // ignore transient error
    } finally {
      setLoading(false);
    }
  }, [notify]);

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

  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

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
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 cursor-pointer"
    >
      <div 
        className="w-full max-w-5xl max-h-[90vh] bg-white dark:bg-[#161617] border border-neutral-200/80 dark:border-neutral-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden relative animate-in zoom-in-95 duration-200 cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#161617] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 flex items-center justify-center text-neutral-800 dark:text-white">
              <Activity className="w-4 h-4 text-purple-500 dark:text-purple-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-neutral-900 dark:text-white tracking-tight">Xray Core Telemetry Matrix</h3>
                <span className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-ping" />
                  REAL-TIME STATS
                </span>
              </div>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 font-mono font-medium">
                Runtime memory, active goroutines, and per-listener throughput matrix
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              title={autoRefresh ? 'Pause Live Polling' : 'Resume Live Polling (2.5s)'}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono font-semibold transition-all duration-150 border flex items-center gap-1.5 active:scale-95 cursor-pointer ${
                autoRefresh
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                  : 'bg-neutral-100 hover:bg-neutral-200 dark:bg-zinc-800 text-neutral-600 dark:text-zinc-400 border-neutral-200 dark:border-zinc-700 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              {autoRefresh ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
              <span>{autoRefresh ? 'Live Poll (2.5s)' : 'Paused'}</span>
            </button>

            <button
              type="button"
              onClick={() => fetchMetrics(true)}
              disabled={loading}
              title="Refresh Matrix Now"
              className={`group/refresh p-2 rounded-xl border transition-all duration-200 active:scale-90 cursor-pointer shadow-xs flex items-center justify-center ${
                justRefreshed
                  ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/40 shadow-emerald-500/10'
                  : loading
                  ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700'
                  : 'bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-900/80 dark:hover:bg-neutral-800 text-neutral-700 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700'
              }`}
            >
              {justRefreshed ? (
                <Check className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400 animate-in zoom-in-50 duration-150" />
              ) : (
                <RefreshCw
                  className={`w-3.5 h-3.5 transition-transform duration-300 ${
                    loading ? 'animate-spin text-purple-500 dark:text-purple-400' : 'group-hover/refresh:rotate-90 group-hover/refresh:scale-110'
                  }`}
                />
              )}
            </button>

            {/* Tactile Rotating Close Button */}
            <button
              type="button"
              onClick={onClose}
              title="Close modal (Esc)"
              className="group/close p-1.5 rounded-xl text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-900/60 dark:hover:bg-neutral-800 border border-neutral-200 dark:border-neutral-800/80 hover:border-neutral-300 dark:hover:border-neutral-700 transition-all duration-200 active:scale-90 flex items-center gap-1.5 cursor-pointer ml-1 shadow-xs"
            >
              <span className="hidden sm:inline text-[10px] font-mono font-semibold text-neutral-500 group-hover/close:text-neutral-700 dark:group-hover/close:text-neutral-300">Esc</span>
              <X className="w-4 h-4 transition-transform duration-200 group-hover/close:rotate-90 group-hover/close:scale-110" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Content */}
        <div className="p-5 overflow-y-auto space-y-5 bg-neutral-50/50 dark:bg-transparent">
          {/* Top KPI Cards Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
            {/* Live Upload Speed */}
            <div className="p-4 rounded-xl bg-white dark:bg-neutral-900/50 border border-neutral-200/80 dark:border-neutral-800 space-y-1 shadow-xs">
              <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400 text-xs">
                <span className="flex items-center gap-1.5">
                  <ArrowUpRight className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />
                  <span>Outbound Speed</span>
                </span>
                <span className="text-[10px] font-mono text-blue-600 dark:text-blue-400 font-semibold">Live</span>
              </div>
              <div className="text-lg font-bold font-mono text-neutral-900 dark:text-white tracking-tight">
                {formatSpeed(tp?.totalUpSpeed || 0)}
              </div>
              <div className="text-[10px] text-neutral-400 dark:text-neutral-500 font-mono">Aggregated across all inbounds</div>
            </div>

            {/* Live Download Speed */}
            <div className="p-4 rounded-xl bg-white dark:bg-neutral-900/50 border border-neutral-200/80 dark:border-neutral-800 space-y-1 shadow-xs">
              <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400 text-xs">
                <span className="flex items-center gap-1.5">
                  <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
                  <span>Inbound Speed</span>
                </span>
                <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold">Live</span>
              </div>
              <div className="text-lg font-bold font-mono text-neutral-900 dark:text-white tracking-tight">
                {formatSpeed(tp?.totalDownSpeed || 0)}
              </div>
              <div className="text-[10px] text-neutral-400 dark:text-neutral-500 font-mono">Incoming tunnel stream rate</div>
            </div>

            {/* Active Online Clients */}
            <div className="p-4 rounded-xl bg-white dark:bg-neutral-900/50 border border-neutral-200/80 dark:border-neutral-800 space-y-1 shadow-xs">
              <div className="flex items-center justify-between text-neutral-500 dark:text-zinc-400 text-xs">
                <span className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-purple-500 dark:text-purple-400" />
                  <span>Online Clients</span>
                </span>
                <span className="text-[10px] font-mono text-purple-600 dark:text-purple-400 font-semibold">Sockets</span>
              </div>
              <div className="text-lg font-bold font-mono text-neutral-900 dark:text-white tracking-tight flex items-center gap-2">
                <span>{tp?.totalOnlineClients || 0}</span>
                {(tp?.totalOnlineClients || 0) > 0 && (
                  <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-ping inline-block" />
                )}
              </div>
              <div className="text-[10px] text-neutral-400 dark:text-zinc-500 font-mono">Active within 90s grace period</div>
            </div>

            {/* Core Memory & GC */}
            <div className="p-4 rounded-xl bg-white dark:bg-neutral-900/50 border border-neutral-200/80 dark:border-neutral-800 space-y-1 shadow-xs">
              <div className="flex items-center justify-between text-neutral-500 dark:text-zinc-400 text-xs">
                <span className="flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                  <span>Kernel Memory</span>
                </span>
                <span className="text-[10px] font-mono text-amber-600 dark:text-amber-400 font-semibold">Heap</span>
              </div>
              <div className="text-lg font-bold font-mono text-neutral-900 dark:text-white tracking-tight">
                {formatBytes(mem?.heapAlloc || 0)}
              </div>
              <div className="text-[10px] text-neutral-400 dark:text-zinc-500 font-mono">
                Sys: {formatBytes(mem?.sys || 0)} • GC: {mem?.numGC || 0}
              </div>
            </div>
          </div>

          {/* Core Runtime Details Card */}
          <div className="p-4 rounded-xl bg-white dark:bg-neutral-900/40 border border-neutral-200/80 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-4 text-xs font-mono shadow-xs">
            <div className="flex items-center gap-2 text-neutral-500 dark:text-neutral-400">
              <ShieldCheck className="w-4 h-4 text-blue-500 dark:text-blue-400" />
              <span>Kernel Version:</span>
              <span className="text-neutral-900 dark:text-white font-bold">{kernel?.version || 'Xray-core'}</span>
            </div>
            <div className="flex items-center gap-2 text-neutral-500 dark:text-neutral-400">
              <Clock className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
              <span>Core Uptime:</span>
              <span className="text-neutral-900 dark:text-white font-bold">{formatUptime(kernel?.uptime || 0)}</span>
            </div>
            <div className="flex items-center gap-2 text-neutral-500 dark:text-neutral-400">
              <Cpu className="w-4 h-4 text-purple-500 dark:text-purple-400" />
              <span>Process ID:</span>
              <span className="text-neutral-900 dark:text-white font-bold">{kernel?.pid || 'OS Service'}</span>
            </div>
            <div className="flex items-center gap-2 text-neutral-500 dark:text-neutral-400">
              <Layers className="w-4 h-4 text-amber-500 dark:text-amber-400" />
              <span>Goroutines:</span>
              <span className="text-neutral-900 dark:text-white font-bold">{mem?.goroutines || 0}</span>
            </div>
          </div>

          {/* Inbounds Telemetry Table */}
          <div className="rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#0c0d10] overflow-hidden shadow-xs">
            <div className="px-4 py-3 border-b border-neutral-200/80 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/40 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-neutral-500 dark:text-neutral-400" />
                <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-900 dark:text-white">Inbounds Throughput Matrix</h4>
              </div>
              <span className="text-[11px] font-mono text-neutral-500 dark:text-neutral-500">{inbounds.length} listeners configured</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/80 dark:bg-neutral-900/20 text-neutral-500 dark:text-neutral-400 text-[11px]">
                    <th className="py-2.5 px-4">Port / Tag</th>
                    <th className="py-2.5 px-4">Protocol</th>
                    <th className="py-2.5 px-4">Live Throughput</th>
                    <th className="py-2.5 px-4">Total Accrued</th>
                    <th className="py-2.5 px-4 text-right">Clients (Online)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200/60 dark:divide-neutral-800/60">
                  {inbounds.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-neutral-400 dark:text-neutral-600">
                        No inbounds currently active.
                      </td>
                    </tr>
                  ) : (
                    inbounds.map((inb) => {
                      const hasSpeed = (inb.upSpeed || 0) > 0 || (inb.downSpeed || 0) > 0;
                      return (
                        <tr key={inb.id} className="hover:bg-neutral-50/80 dark:hover:bg-neutral-800/30 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-bold text-neutral-900 dark:text-white flex items-center gap-1.5">
                              <span>:{inb.port}</span>
                              <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-normal">({inb.tag})</span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded text-[10px] uppercase font-semibold bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700">
                              {inb.protocol}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            {hasSpeed ? (
                              <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-ping inline-block" />
                                <span>↑{formatSpeed(inb.upSpeed || 0)}</span>
                                <span>•</span>
                                <span>↓{formatSpeed(inb.downSpeed || 0)}</span>
                              </span>
                            ) : (
                              <span className="text-neutral-400 dark:text-zinc-600">Idle (0 B/s)</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-neutral-700 dark:text-zinc-300">
                            {formatBytes(inb.up || 0)} / {formatBytes(inb.down || 0)}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className="flex items-center justify-end gap-1.5">
                              <span className="text-neutral-900 dark:text-zinc-300 font-semibold">{inb.clients}</span>
                              {inb.online > 0 ? (
                                <span className="text-emerald-600 dark:text-emerald-400 font-semibold text-[11px] bg-emerald-500/15 border border-emerald-500/25 px-1.5 py-0.2 rounded">
                                  {inb.online} live
                                </span>
                              ) : (
                                <span className="text-neutral-400 dark:text-zinc-600 text-[11px]">(0 live)</span>
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
        <div className="px-5 py-3 border-t border-neutral-200/80 dark:border-white/[0.06] bg-white dark:bg-[#0c0d14] flex items-center justify-between text-xs font-mono text-neutral-500 dark:text-zinc-500 shrink-0">
          <div>Telemetry source: Xray Core StatsService gRPC & Go Runtime</div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-white/5 dark:hover:bg-white/10 text-neutral-800 dark:text-white border border-neutral-200 dark:border-white/10 transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
