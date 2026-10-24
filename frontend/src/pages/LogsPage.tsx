import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  FileText, 
  RefreshCw, 
  Copy, 
  Check, 
  Download, 
  Search, 
  Pause, 
  Play,
  Terminal,
  Filter
} from 'lucide-react';
import api from '../services/api';
import { useNotification } from '../context/NotificationContext';
import { copyToClipboard } from '../utils/clipboard';

export const LogsPage: React.FC = () => {
  const { notify } = useNotification();
  const [logs, setLogs] = useState<string[]>([]);
  const [count, setCount] = useState<number>(100);
  const [level, setLevel] = useState<string>('all');
  const [search, setSearch] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedLineIdx, setCopiedLineIdx] = useState<number | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const lvlParam = level === 'all' ? '' : `&level=${level}`;
      const res = await api.get(`/api/server/logs?count=${count}${lvlParam}`);
      if (res.data && Array.isArray(res.data.logs)) {
        setLogs(res.data.logs);
      }
    } catch (e) {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, [count, level]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchLogs();
    }, 3000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchLogs]);

  const filteredLogs = logs.filter((line) => {
    if (!search.trim()) return true;
    return line.toLowerCase().includes(search.toLowerCase());
  });

  const handleCopyAll = async () => {
    if (filteredLogs.length === 0) return;
    const text = filteredLogs.join('\n');
    const success = await copyToClipboard(text);
    if (success) {
      setCopiedAll(true);
      notify.success('Copied to Clipboard', `Copied ${filteredLogs.length} log lines successfully.`);
      setTimeout(() => setCopiedAll(false), 2000);
    } else {
      notify.error('Copy Failed', 'Could not copy logs to clipboard.');
    }
  };

  const handleCopyLine = async (line: string, idx: number) => {
    const success = await copyToClipboard(line);
    if (success) {
      setCopiedLineIdx(idx);
      notify.success('Line Copied', 'Selected log line copied.');
      setTimeout(() => setCopiedLineIdx(null), 1500);
    }
  };

  const handleDownloadLogs = () => {
    if (filteredLogs.length === 0) return;
    const text = filteredLogs.join('\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `nexus-system-logs-${Date.now()}.log`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-white tracking-wide">Live System & Kernel Logs</h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              {filteredLogs.length} lines
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-0.5">
            Operational kernel logs, routing traces, and system connection events.
          </p>
        </div>

        {/* Header Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search logs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-white/[0.03] border border-white/[0.08] rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500/40 font-mono w-40 sm:w-48 transition"
            />
          </div>

          {/* Level Filter */}
          <select
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            className="px-2.5 py-1.5 bg-white/[0.03] border border-white/[0.08] rounded-xl text-xs text-zinc-300 font-mono focus:outline-none"
          >
            <option value="all">All Levels</option>
            <option value="error">Errors</option>
            <option value="warning">Warnings</option>
            <option value="info">Info</option>
            <option value="debug">Debug</option>
          </select>

          {/* Lines Count Selector */}
          <select
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className="px-2.5 py-1.5 bg-white/[0.03] border border-white/[0.08] rounded-xl text-xs text-zinc-300 font-mono focus:outline-none"
          >
            <option value={50}>50 lines</option>
            <option value={100}>100 lines</option>
            <option value={200}>200 lines</option>
            <option value={500}>500 lines</option>
            <option value={1000}>1000 lines</option>
          </select>

          {/* Auto Refresh Toggle */}
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            title={autoRefresh ? 'Pause Auto-Refresh' : 'Enable Live Auto-Refresh (3s)'}
            className={`px-3 py-1.5 rounded-xl text-xs font-mono font-medium transition border flex items-center gap-1.5 cursor-pointer ${
              autoRefresh
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                : 'bg-white/[0.03] text-zinc-400 border-white/[0.08] hover:text-white hover:bg-white/[0.06]'
            }`}
          >
            {autoRefresh ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{autoRefresh ? 'Live' : 'Auto'}</span>
          </button>

          {/* Copy All Logs Button */}
          <button
            onClick={handleCopyAll}
            title="Copy all currently displayed logs to clipboard"
            className={`px-3 py-1.5 rounded-xl text-xs font-medium border flex items-center gap-1.5 transition cursor-pointer active:scale-95 ${
              copiedAll
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                : 'bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
            }`}
          >
            {copiedAll ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedAll ? 'Copied' : 'Copy Logs'}</span>
          </button>

          {/* Download Logs Button */}
          <button
            onClick={handleDownloadLogs}
            title="Download log file"
            className="p-2 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.08] text-zinc-300 hover:text-white transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
          </button>

          {/* Refresh Button */}
          <button
            onClick={fetchLogs}
            disabled={isLoading}
            title="Refresh logs now"
            className="p-2 rounded-xl border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.08] text-zinc-300 hover:text-white transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Terminal Display Container */}
      <div className="bg-[#0c0d13]/90 backdrop-blur-xl border border-white/[0.08] shadow-2xl rounded-2xl p-4 relative overflow-hidden">
        {/* Terminal Header Bar */}
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/[0.06] text-xs font-mono text-zinc-500">
          <div className="flex items-center gap-2">
            <Terminal className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-zinc-300 font-semibold">Console Stream</span>
            {search && (
              <span className="text-zinc-400 text-[11px]">
                (filtering for &quot;{search}&quot;)
              </span>
            )}
          </div>
          <div className="text-[11px] text-zinc-500 hidden sm:block">
            Click any line to copy individual row • Select text freely
          </div>
        </div>

        {/* Scrollable Terminal Output */}
        <div className="bg-[#05060a] border border-white/[0.06] rounded-xl p-4 h-[640px] overflow-y-auto font-mono text-[11px] leading-relaxed space-y-1 select-text">
          {filteredLogs.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-zinc-600 space-y-2 py-20 font-sans">
              <Terminal className="w-8 h-8 opacity-40 text-zinc-500" />
              <p className="text-xs">No logs match the current criteria.</p>
              <p className="text-[10px] text-zinc-700">Events appear dynamically as requests are processed.</p>
            </div>
          ) : (
            filteredLogs.map((line, idx) => {
              const lower = line.toLowerCase();
              const isError = lower.includes('[error]') || lower.includes('failed') || lower.includes('rejected') || lower.includes('fatal');
              const isWarning = lower.includes('[warning]') || lower.includes('[warn]');
              const isAccess = lower.includes('accepted') || lower.includes('proxy') || lower.includes('->');
              const isCopied = copiedLineIdx === idx;

              let textColor = 'text-zinc-300';
              let rowBg = 'hover:bg-white/[0.03]';

              if (isError) {
                textColor = 'text-rose-400 font-medium';
                rowBg = 'bg-rose-500/[0.03] hover:bg-rose-500/[0.06]';
              } else if (isWarning) {
                textColor = 'text-amber-400';
                rowBg = 'bg-amber-500/[0.03] hover:bg-amber-500/[0.06]';
              } else if (isAccess) {
                textColor = 'text-emerald-300';
              }

              return (
                <div
                  key={idx}
                  className={`flex items-start gap-2.5 py-0.5 px-2 rounded-lg transition-colors group relative ${rowBg}`}
                >
                  {/* Line Number */}
                  <span className="text-zinc-600 select-none text-[10px] w-8 text-right shrink-0 pt-0.5 font-mono">
                    {idx + 1}
                  </span>

                  {/* Log Content */}
                  <span className={`break-all flex-1 ${textColor}`}>
                    {line}
                  </span>

                  {/* Quick Copy Single Line Button */}
                  <button
                    onClick={() => handleCopyLine(line, idx)}
                    title="Copy this line"
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-white/10 text-zinc-400 hover:text-white transition shrink-0 cursor-pointer select-none"
                  >
                    {isCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              );
            })
          )}
          <div ref={logsEndRef} />
        </div>
      </div>
    </div>
  );
};
