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
  const [justRefreshed, setJustRefreshed] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedLineIdx, setCopiedLineIdx] = useState<number | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const fetchLogs = useCallback(async (isManual: boolean = false) => {
    setIsLoading(true);
    const minDelay = isManual ? new Promise((res) => setTimeout(res, 750)) : Promise.resolve();
    try {
      const lvlParam = level === 'all' ? '' : `&level=${level}`;
      const [res] = await Promise.all([
        api.get(`/api/server/logs?count=${count}${lvlParam}`),
        minDelay
      ]);
      if (res.data && Array.isArray(res.data.logs)) {
        setLogs(res.data.logs);
      }
      if (isManual) {
        setJustRefreshed(true);
        notify.success('Logs Refreshed', `Fetched latest ${count} log entries.`);
        setTimeout(() => setJustRefreshed(false), 1600);
      }
    } catch (e) {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, [count, level, notify]);

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
            <h2 className="text-base font-semibold text-white tracking-tight">Live System & Kernel Logs</h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-neutral-800 text-neutral-300 border border-neutral-700">
              {filteredLogs.length} lines
            </span>
          </div>
          <p className="text-xs text-neutral-400 mt-0.5">
            Operational kernel logs, routing traces, and system connection events.
          </p>
        </div>

        {/* Header Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search logs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-neutral-900 border border-neutral-800 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-600 font-mono w-40 sm:w-48 transition"
            />
          </div>

          {/* Level Filter */}
          <select
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            className="px-2.5 py-1.5 bg-neutral-900 border border-neutral-800 rounded-xl text-xs text-neutral-300 font-mono focus:outline-none cursor-pointer"
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
            className="px-2.5 py-1.5 bg-neutral-900 border border-neutral-800 rounded-xl text-xs text-neutral-300 font-mono focus:outline-none cursor-pointer"
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
                : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-white hover:bg-neutral-800'
            }`}
          >
            {autoRefresh ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{autoRefresh ? 'Live' : 'Auto'}</span>
          </button>

          {/* Copy All Logs Button */}
          <button
            onClick={handleCopyAll}
            title="Copy all currently displayed logs to clipboard"
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition cursor-pointer active:scale-95 ${
              copiedAll
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-200 hover:text-white border-neutral-800'
            }`}
          >
            {copiedAll ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedAll ? 'Copied' : 'Copy Logs'}</span>
          </button>

          {/* Download Logs Button */}
          <button
            onClick={handleDownloadLogs}
            title="Download log file"
            className="p-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 hover:text-white transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
          </button>

          {/* Refresh Button with Tactile Micro-interaction */}
          <button
            type="button"
            onClick={() => fetchLogs(true)}
            disabled={isLoading}
            title="Refresh logs now"
            className={`group/refresh p-2 rounded-xl border transition-all duration-200 active:scale-90 cursor-pointer shadow-xs flex items-center justify-center ${
              justRefreshed
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-emerald-500/10'
                : isLoading
                ? 'bg-neutral-800 text-neutral-300 border-neutral-700'
                : 'bg-neutral-900/80 hover:bg-neutral-800 text-neutral-300 hover:text-white border-neutral-800 hover:border-neutral-700'
            }`}
          >
            {justRefreshed ? (
              <Check className="w-3.5 h-3.5 text-emerald-400 animate-in zoom-in-50 duration-150" />
            ) : (
              <RefreshCw
                className={`w-3.5 h-3.5 transition-transform duration-300 ${
                  isLoading ? 'animate-spin text-white' : 'group-hover/refresh:rotate-90 group-hover/refresh:scale-110'
                }`}
              />
            )}
          </button>
        </div>
      </div>

      {/* Terminal Display Container */}
      <div className="bg-[#0c0d10] border border-neutral-800 shadow-sm rounded-2xl p-4 relative overflow-hidden">
        {/* Terminal Header Bar */}
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-neutral-800 text-xs font-mono text-neutral-500">
          <div className="flex items-center gap-2">
            <Terminal className="w-3.5 h-3.5 text-neutral-400" />
            <span className="text-neutral-200 font-semibold">Console Stream</span>
            {search && (
              <span className="text-neutral-400 text-[11px]">
                (filtering for &quot;{search}&quot;)
              </span>
            )}
          </div>
          <div className="text-[11px] text-neutral-500 hidden sm:block">
            Click any line to copy individual row • Select text freely
          </div>
        </div>

        {/* Scrollable Terminal Output */}
        <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4 h-[640px] overflow-y-auto font-mono text-[11px] leading-relaxed space-y-1 select-text">
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
