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
  const [search, setSearch] = useState('');
  const [level, setLevel] = useState<string>('all'); // all, error, warning, info, access
  const [count, setCount] = useState<number>(100);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [copied, setCopied] = useState(false);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get(`/api/server/xraylogs?count=${count}&filter=${encodeURIComponent(search)}&level=${level}`);
      if (res.data && res.data.logs) {
        setLogs(res.data.logs);
      }
    } catch (e: any) {
      // ignore transient polling errors
    } finally {
      setLoading(false);
    }
  }, [count, search, level]);

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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div 
        className="w-full max-w-5xl h-[88vh] bg-[#090a0f] border border-white/[0.12] rounded-2xl shadow-2xl flex flex-col overflow-hidden relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Terminal Header */}
        <div className="px-5 py-4 border-b border-white/[0.08] bg-[#0c0d14] flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Terminal className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white tracking-wide">Xray Core Kernel Logs</h3>
                <span className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  LIVE STREAM
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 font-mono">
                Real-time stdout/stderr event stream and client access records
              </p>
            </div>
          </div>

          {/* Quick Header Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              title={autoRefresh ? 'Pause Auto-Refresh' : 'Resume Auto-Refresh'}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono font-medium transition border flex items-center gap-1.5 ${
                autoRefresh
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                  : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:text-white'
              }`}
            >
              {autoRefresh ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
              <span>{autoRefresh ? 'Streaming' : 'Paused'}</span>
            </button>

            <button
              onClick={fetchLogs}
              title="Refresh Logs Now"
              className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white border border-white/10 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
            </button>

            <button
              onClick={handleCopyLogs}
              title="Copy to Clipboard"
              className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white border border-white/10 transition"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>

            <button
              onClick={handleDownloadLogs}
              title="Download Logs"
              className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white border border-white/10 transition"
            >
              <Download className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={handleClearLogs}
              title="Clear Log View"
              className="p-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/25 transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white border border-white/10 transition ml-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter and Control Bar */}
        <div className="px-5 py-2.5 bg-[#08090e] border-b border-white/[0.06] flex flex-wrap items-center justify-between gap-3 shrink-0 text-xs">
          {/* Level Filter Tabs */}
          <div className="flex items-center gap-1">
            {[
              { id: 'all', label: 'All Events', color: 'zinc' },
              { id: 'error', label: 'Errors', color: 'rose' },
              { id: 'warning', label: 'Warnings', color: 'amber' },
              { id: 'info', label: 'Info', color: 'cyan' },
              { id: 'access', label: 'Connections', color: 'emerald' },
            ].map((lvl) => {
              const active = level === lvl.id;
              return (
                <button
                  key={lvl.id}
                  onClick={() => setLevel(lvl.id)}
                  className={`px-2.5 py-1 rounded-lg font-mono text-[11px] transition border ${
                    active
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 font-semibold'
                      : 'bg-white/[0.02] text-zinc-400 hover:text-zinc-200 border-white/[0.06] hover:bg-white/[0.05]'
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
              <Search className="w-3 h-3 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filter IP, port, email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-7 pr-3 py-1 bg-[#05060a] border border-white/[0.08] focus:border-cyan-500/40 rounded-lg text-[11px] text-white placeholder-zinc-600 focus:outline-none font-mono w-48 transition"
              />
            </div>

            <select
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="px-2 py-1 bg-[#05060a] border border-white/[0.08] rounded-lg text-[11px] text-zinc-300 font-mono focus:outline-none"
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
        <div className="flex-1 overflow-y-auto p-4 font-mono text-[11px] leading-relaxed bg-[#05060a] text-zinc-300 space-y-1 select-text">
          {logs.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-zinc-600 space-y-2">
              <Terminal className="w-8 h-8 opacity-40 text-zinc-500" />
              <p className="text-xs">No Xray log entries match the current filter.</p>
              <p className="text-[10px] text-zinc-700">Events appear dynamically as proxy connections occur.</p>
            </div>
          ) : (
            logs.map((item, idx) => {
              const lvl = (item.level || 'info').toLowerCase();
              let badgeColor = 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20';
              let rowHighlight = '';

              if (lvl === 'error') {
                badgeColor = 'text-rose-400 bg-rose-500/15 border-rose-500/30';
                rowHighlight = 'bg-rose-500/[0.04] text-rose-200';
              } else if (lvl === 'warning' || lvl === 'warn') {
                badgeColor = 'text-amber-400 bg-amber-500/15 border-amber-500/30';
                rowHighlight = 'bg-amber-500/[0.03] text-amber-200';
              } else if (lvl === 'access') {
                badgeColor = 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30';
                rowHighlight = 'bg-emerald-500/[0.02] text-emerald-200';
              } else if (lvl === 'debug') {
                badgeColor = 'text-zinc-400 bg-zinc-800 border-zinc-700';
              }

              return (
                <div
                  key={item.id || idx}
                  className={`flex items-start gap-2.5 py-1 px-2 rounded-lg hover:bg-white/[0.03] transition-colors group ${rowHighlight}`}
                >
                  {/* Line Number */}
                  <span className="text-zinc-600 select-none text-[10px] w-8 text-right shrink-0 pt-0.5">
                    {idx + 1}
                  </span>

                  {/* Timestamp */}
                  <span className="text-zinc-500 shrink-0 select-none text-[10px] pt-0.5">
                    {item.timestamp || '00:00:00'}
                  </span>

                  {/* Level Pill */}
                  <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase shrink-0 border ${badgeColor}`}>
                    {lvl}
                  </span>

                  {/* Log Content */}
                  <span className="break-all flex-1 text-zinc-200">
                    {item.message || item.raw}
                  </span>
                </div>
              );
            })
          )}
          <div ref={terminalEndRef} />
        </div>

        {/* Terminal Footer */}
        <div className="px-5 py-2.5 bg-[#090a10] border-t border-white/[0.06] flex items-center justify-between text-[11px] font-mono text-zinc-500 shrink-0">
          <div className="flex items-center gap-3">
            <span>Buffer: {logs.length} events loaded</span>
            <span>•</span>
            <span className="text-zinc-400">Level: {level.toUpperCase()}</span>
          </div>
          <div className="flex items-center gap-2 text-zinc-400">
            <span>Auto-Refresh:</span>
            <span className={autoRefresh ? 'text-emerald-400 font-semibold' : 'text-zinc-600'}>
              {autoRefresh ? 'Active (2.5s)' : 'Paused'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
