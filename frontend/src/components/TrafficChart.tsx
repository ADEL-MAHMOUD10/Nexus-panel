import React from 'react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer,
  CartesianGrid 
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
  // Guarantee at least 15 points for a smooth wave
  const minPoints = 16;
  const count = Math.max(historyUp.length, historyDown.length, minPoints);
  
  // Pad arrays with leading zeros if fewer than minPoints
  const paddedUp = historyUp.length < minPoints 
    ? [...Array(minPoints - historyUp.length).fill(0), ...historyUp] 
    : historyUp;
  const paddedDown = historyDown.length < minPoints 
    ? [...Array(minPoints - historyDown.length).fill(0), ...historyDown] 
    : historyDown;

  const data = Array.from({ length: count }).map((_, i) => ({
    time: i,
    upload: Math.round((paddedUp[i] || 0) * 10) / 10,
    download: Math.round((paddedDown[i] || 0) * 10) / 10,
  }));

  return (
    <div className="w-full flex flex-col justify-between flex-1">
      {/* Chart Top Metrics */}
      <div className="flex items-center justify-between pb-2.5 border-b border-white/[0.06] mb-2">
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
      <div className="h-44 w-full relative">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 2 }}>
            <defs>
              <linearGradient id="downGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="upGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
            <XAxis dataKey="time" hide />
            <YAxis hide domain={[0, 'auto']} />
            <Tooltip
              cursor={{ stroke: 'rgba(255,255,255,0.15)', strokeWidth: 1, strokeDasharray: '3 3' }}
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="bg-[#14171d]/95 backdrop-blur-md border border-white/10 rounded-xl p-3 shadow-2xl text-xs font-mono select-none pointer-events-none z-40">
                      <div className="text-cyan-400 flex items-center justify-between gap-5">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                          Down:
                        </span>
                        <span className="font-bold">{Number(payload[0]?.value || 0).toFixed(1)} KB/s</span>
                      </div>
                      <div className="text-emerald-400 flex items-center justify-between gap-5 mt-1.5">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                          Up:
                        </span>
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
