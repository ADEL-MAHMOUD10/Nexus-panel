import React from 'react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { ArrowUpRight, ArrowDownLeft } from 'lucide-react';

interface TrafficChartProps {
  historyUp: number[];
  historyDown: number[];
  currentUpSpeed: number;
  currentDownSpeed: number;
  formatSpeed: (bytesPerSec: number) => string;
}

export const TrafficChart: React.FC<TrafficChartProps> = ({
  historyUp,
  historyDown,
  currentUpSpeed,
  currentDownSpeed,
  formatSpeed,
}) => {
  // Combine history into recharts array
  const length = Math.max(historyUp.length, historyDown.length, 12);
  const data = Array.from({ length }).map((_, i) => ({
    time: i,
    upload: historyUp[i] || 0,
    download: historyDown[i] || 0,
  }));

  return (
    <div className="w-full flex flex-col h-full justify-between">
      {/* Chart Top Metrics */}
      <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee]"></div>
            <span className="text-xs text-zinc-400">Download</span>
            <span className="text-xs font-mono font-semibold text-cyan-300 flex items-center gap-0.5">
              <ArrowDownLeft className="w-3 h-3 text-cyan-400" />
              {formatSpeed(currentDownSpeed)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]"></div>
            <span className="text-xs text-zinc-400">Upload</span>
            <span className="text-xs font-mono font-semibold text-emerald-300 flex items-center gap-0.5">
              <ArrowUpRight className="w-3 h-3 text-emerald-400" />
              {formatSpeed(currentUpSpeed)}
            </span>
          </div>
        </div>

        <span className="text-[11px] font-mono text-zinc-500 uppercase tracking-wider">Live I/O</span>
      </div>

      {/* Chart Canvas */}
      <div className="h-44 w-full pt-3">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
            <defs>
              <linearGradient id="downGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="upGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
              </linearGradient>
            </defs>

            <XAxis dataKey="time" hide />
            <YAxis hide />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="bg-[#14171d]/90 backdrop-blur-md border border-white/10 rounded-lg p-2.5 shadow-xl text-xs font-mono">
                      <div className="text-cyan-400 flex items-center justify-between gap-4">
                        <span>Down:</span>
                        <span className="font-bold">{Number(payload[0]?.value || 0).toFixed(1)} KB/s</span>
                      </div>
                      <div className="text-emerald-400 flex items-center justify-between gap-4 mt-1">
                        <span>Up:</span>
                        <span className="font-bold">{Number(payload[1]?.value || 0).toFixed(1)} KB/s</span>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Area
              type="monotone"
              dataKey="download"
              stroke="#06b6d4"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#downGrad)"
            />
            <Area
              type="monotone"
              dataKey="upload"
              stroke="#10b981"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#upGrad)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
