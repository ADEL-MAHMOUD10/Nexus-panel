import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Terminal, 
  X, 
  RefreshCw, 
  Copy, 
  Trash2, 
  Download, 
  Search, 
  Play, 
  Pause,
  Filter,
  Check,
  AlertTriangle,
  AlertCircle,
  Info,
  Activity
} from 'lucide-react';
import api from '../services/api';
import { useNotification } from '../context/NotificationContext';
import { XrayLogEntry } from '../types';
import { copyToClipboard } from '../utils/clipboard';

interface XrayLogModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const XrayLogModal: React.FC<XrayLogModalProps> = ({ isOpen, onClose }) => {
  const { notify } = useNotification();
  const [logs, setLogs] = useState<XrayLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [justRefreshed, setJustRefreshed] = useState(false);
  const [search, setSearch] = useState('');
  const [level, setLevel] = useState<string>('all'); // all, error, warning, info, access
  const [count, setCount] = useState<number>(100);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [copied, setCopied] = useState(false);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  const fetchLogs = useCallback(async (isManual: boolean = false) => {
    try {
      setLoading(true);
      const minDelay = isManual ? new Promise((res) => setTimeout(res, 750)) : Promise.resolve();
      const [res] = await Promise.all([
        api.get(`/api/server/xraylogs?count=${count}&filter=${encodeURIComponent(search)}&level=${level}`),
        minDelay
      ]);
      if (res.data && res.data.logs) {
        setLogs(res.data.logs);
      }
      if (isManual) {
        setJustRefreshed(true);
        notify.success('Kernel Logs Synced', `Fetched latest ${count} kernel log entries.`);
        setTimeout(() => setJustRefreshed(false), 1600);
      }
    } catch (e: any) {
      // ignore transient polling errors
    } finally {
      setLoading(false);
    }
  }, [count, search, level, notify]);

  // Initial and reactive fetch
  useEffect(() => {
    if (isOpen) {
      fetchLogs();
    }
  }, [isOpen, fetchLogs]);

  // Auto-refresh interval
  useEffect(() => {
    if (!isOpen || !autoRefresh) return;
    const interval = setInterval(() => {
      fetchLogs();
    }, 2500);
    return () => clearInterval(interval);
  }, [isOpen, autoRefresh, fetchLogs]);

  // Auto-scroll when logs change
  useEffect(() => {
    if (autoRefresh && terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoRefresh]);

  const handleClearLogs = async () => {
    try {
      await api.post('/api/server/clear-xraylogs');
      setLogs([]);
      notify.info('Logs Cleared', 'Xray kernel log buffer was reset.');
    } catch (e) {
      notify.error('Action Failed', 'Could not clear kernel logs.');
    }
  };

  const handleCopyLogs = async () => {
    const text = logs.map((l) => l.raw || `[${l.timestamp}] [${l.level.toUpperCase()}] ${l.message}`).join('\n');
    const success = await copyToClipboard(text);
    if (success) {
      setCopied(true);
      notify.success('Copied', 'All filtered logs copied to clipboard.');
      setTimeout(() => setCopied(false), 2000);
    } else {
      notify.error('Copy Failed', 'Could not copy logs to clipboard.');
    }
  };

  const handleDownloadLogs = () => {
    const text = logs.map((l) => l.raw || `[${l.timestamp}] [${l.level.toUpperCase()}] ${l.message}`).join('\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `xray-kernel-logs-${Date.now()}.log`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

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
        className="w-full max-w-5xl h-[88vh] bg-white dark:bg-[#161617] border border-neutral-200/80 dark:border-neutral-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden relative animate-in zoom-in-95 duration-200 cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Terminal Header */}
        <div className="px-5 py-4 border-b border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#161617] flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 flex items-center justify-center text-neutral-800 dark:text-white">
              <Terminal className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-neutral-900 dark:text-white tracking-tight">Xray Core Kernel Logs</h3>
                <span className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-ping" />
                  LIVE STREAM
                </span>
              </div>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 font-mono font-medium">
                Real-time stdout/stderr event stream and client access records
              </p>
            </div>
          </div>

          {/* Quick Header Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              title={autoRefresh ? 'Pause Auto-Refresh' : 'Resume Auto-Refresh'}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono font-semibold transition-all duration-150 border flex items-center gap-1.5 active:scale-95 cursor-pointer ${
                autoRefresh
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                  : 'bg-neutral-100 hover:bg-neutral-200 dark:bg-zinc-800 text-neutral-600 dark:text-zinc-400 border-neutral-200 dark:border-zinc-700 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              {autoRefresh ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
              <span>{autoRefresh ? 'Streaming' : 'Paused'}</span>
            </button>

            <button
              type="button"
              onClick={() => fetchLogs(true)}
              disabled={loading}
              title="Refresh logs now"
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
                    loading ? 'animate-spin text-neutral-800 dark:text-white' : 'group-hover/refresh:rotate-90 group-hover/refresh:scale-110'
                  }`}
                />
              )}
            </button>

            <button
              onClick={handleCopyLogs}
              title="Copy to Clipboard"
              className="p-1.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-900 dark:hover:bg-neutral-800 text-neutral-700 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white border border-neutral-200 dark:border-neutral-800 transition-all duration-150 active:scale-90 cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>

            <button
              onClick={handleDownloadLogs}
              title="Download Logs"
              className="p-1.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-900 dark:hover:bg-neutral-800 text-neutral-700 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white border border-neutral-200 dark:border-neutral-800 transition-all duration-150 active:scale-90 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={handleClearLogs}
              title="Clear Log View"
              className="p-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/25 transition-all duration-150 active:scale-90 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
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

        {/* Filter and Control Bar */}
        <div className="px-5 py-2.5 bg-neutral-50 dark:bg-[#0a0b0e] border-b border-neutral-200/80 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-3 shrink-0 text-xs">
          {/* Level Filter Tabs */}
          <div className="flex items-center gap-1">
            {[
              { id: 'all', label: 'All Events' },
              { id: 'error', label: 'Errors' },
              { id: 'warning', label: 'Warnings' },
              { id: 'info', label: 'Info' },
              { id: 'access', label: 'Connections' },
            ].map((lvl) => {
              const active = level === lvl.id;
              return (
                <button
                  key={lvl.id}
                  onClick={() => setLevel(lvl.id)}
                  className={`px-2.5 py-1 rounded-lg font-mono text-[11px] transition border cursor-pointer ${
                    active
                      ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-950 border-neutral-900 dark:border-white font-semibold shadow-xs'
                      : 'bg-white dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                  }`}
                >
                  {lvl.label}
                </button>
              );
            })}
          </div>

          {/* Search & Row Count */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3 h-3 text-neutral-400 dark:text-neutral-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filter IP, port, email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-7 pr-3 py-1 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 focus:border-neutral-400 dark:focus:border-neutral-600 rounded-lg text-[11px] text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-600 focus:outline-none font-mono w-48 transition"
              />
            </div>

            <select
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="px-2 py-1 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg text-[11px] text-neutral-700 dark:text-neutral-300 font-mono focus:outline-none cursor-pointer"
            >
              <option value={50}>50 lines</option>
              <option value={100}>100 lines</option>
              <option value={200}>200 lines</option>
              <option value={500}>500 lines</option>
              <option value={1000}>1000 lines</option>
            </select>
          </div>
        </div>

        {/* Terminal Body */}
        <div className="flex-1 overflow-y-auto p-4 font-mono text-[11px] leading-relaxed bg-neutral-50/50 dark:bg-[#05060a] text-neutral-800 dark:text-zinc-300 space-y-1 select-text">
          {logs.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-neutral-400 dark:text-zinc-600 space-y-2">
              <Terminal className="w-8 h-8 opacity-40 text-neutral-400 dark:text-zinc-500" />
              <p className="text-xs">No Xray log entries match the current filter.</p>
              <p className="text-[10px] text-neutral-400 dark:text-zinc-700">Events appear dynamically as proxy connections occur.</p>
            </div>
          ) : (
            logs.map((item, idx) => {
              const lvl = (item.level || 'info').toLowerCase();
              let badgeColor = 'text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/20';
              let rowHighlight = '';

              if (lvl === 'error') {
                badgeColor = 'text-rose-600 dark:text-rose-400 bg-rose-500/15 border-rose-500/30';
                rowHighlight = 'bg-rose-500/[0.04] text-rose-700 dark:text-rose-200';
              } else if (lvl === 'warning' || lvl === 'warn') {
                badgeColor = 'text-amber-600 dark:text-amber-400 bg-amber-500/15 border-amber-500/30';
                rowHighlight = 'bg-amber-500/[0.03] text-amber-700 dark:text-amber-200';
              } else if (lvl === 'access') {
                badgeColor = 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/15 border-emerald-500/30';
                rowHighlight = 'bg-emerald-500/[0.02] text-emerald-700 dark:text-emerald-200';
              } else if (lvl === 'debug') {
                badgeColor = 'text-neutral-600 dark:text-zinc-400 bg-neutral-200 dark:bg-zinc-800 border-neutral-300 dark:border-zinc-700';
              }

              return (
                <div
                  key={item.id || idx}
                  className={`flex items-start gap-2.5 py-1 px-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-white/[0.03] transition-colors group ${rowHighlight}`}
                >
                  {/* Line Number */}
                  <span className="text-neutral-400 dark:text-zinc-600 select-none text-[10px] w-8 text-right shrink-0 pt-0.5">
                    {idx + 1}
                  </span>

                  {/* Timestamp */}
                  <span className="text-neutral-500 dark:text-zinc-500 shrink-0 select-none text-[10px] pt-0.5">
                    {item.timestamp || '00:00:00'}
                  </span>

                  {/* Level Pill */}
                  <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase shrink-0 border ${badgeColor}`}>
                    {lvl}
                  </span>

                  {/* Log Content */}
                  <span className="break-all flex-1 text-neutral-800 dark:text-zinc-200 font-medium">
                    {item.message || item.raw}
                  </span>
                </div>
              );
            })
          )}
          <div ref={terminalEndRef} />
        </div>

        {/* Terminal Footer */}
        <div className="px-5 py-2.5 bg-neutral-100/80 dark:bg-[#090a10] border-t border-neutral-200/80 dark:border-white/[0.06] flex items-center justify-between text-[11px] font-mono text-neutral-600 dark:text-zinc-500 shrink-0">
          <div className="flex items-center gap-3">
            <span>Buffer: {logs.length} events loaded</span>
            <span>•</span>
            <span className="text-neutral-700 dark:text-zinc-400">Level: {level.toUpperCase()}</span>
          </div>
          <div className="flex items-center gap-2 text-neutral-600 dark:text-zinc-400">
            <span>Auto-Refresh:</span>
            <span className={autoRefresh ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-neutral-400 dark:text-zinc-600'}>
              {autoRefresh ? 'Active (2.5s)' : 'Paused'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
