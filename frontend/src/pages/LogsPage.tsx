import React, { useState, useEffect } from 'react';
import { FileText, RefreshCw, Trash2, Download } from 'lucide-react';
import api from '../services/api';

export const LogsPage: React.FC = () => {
  const [logs, setLogs] = useState<string[]>([]);
  const [count, setCount] = useState<number>(100);
  const [isLoading, setIsLoading] = useState(false);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const res = await api.get(`/api/server/logs?count=${count}`);
      if (res.data && Array.isArray(res.data.logs)) {
        setLogs(res.data.logs);
      }
    } catch (e) {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [count]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-white tracking-wide">Live Xray Core & Access Logs</h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Real-time proxy routing and operational connection output.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className="px-3 py-1.5 bg-[#14171e] border border-white/[0.08] rounded-xl text-xs text-zinc-300 font-mono"
          >
            <option value={50}>Last 50 lines</option>
            <option value={100}>Last 100 lines</option>
            <option value={200}>Last 200 lines</option>
            <option value={500}>Last 500 lines</option>
          </select>

          <button
            onClick={fetchLogs}
            disabled={isLoading}
            className="p-2 rounded-xl border border-white/[0.08] bg-[#14171e] hover:bg-[#191d26] text-zinc-300 transition"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        </div>
      </div>

      <div className="bg-[#0a0d16]/75 backdrop-blur-xl border border-white/[0.08] rounded-2xl p-4 shadow-xl">
        <div className="bg-[#090a0d] border border-white/[0.06] rounded-xl p-4 h-[620px] overflow-y-auto font-mono text-[11px] leading-relaxed space-y-1">
          {logs.length === 0 ? (
            <div className="text-zinc-600 text-center py-20 font-sans">
              No recent logs recorded.
            </div>
          ) : (
            logs.map((line, idx) => {
              const isWarning = line.includes('[Warning]');
              const isError = line.includes('[Error]') || line.includes('rejected');
              return (
                <div
                  key={idx}
                  className={`break-all ${
                    isError
                      ? 'text-rose-400 font-semibold'
                      : isWarning
                      ? 'text-amber-400'
                      : 'text-zinc-400'
                  }`}
                >
                  {line}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
