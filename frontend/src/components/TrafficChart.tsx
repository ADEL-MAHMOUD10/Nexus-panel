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
      <div className="flex items-center justify-between pb-2.5 border-b border-zinc-800 mb-2">
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            <span className="text-xs text-zinc-400">Download</span>
            <span className="text-xs font-mono font-medium text-zinc-200 flex items-center gap-0.5">
              <ArrowDownLeft className="w-3 h-3 text-blue-400" />
              {formatSpeed(currentDownSpeed)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span className="text-xs text-zinc-400">Upload</span>
            <span className="text-xs font-mono font-medium text-zinc-200 flex items-center gap-0.5">
              <ArrowUpRight className="w-3 h-3 text-emerald-400" />
              {formatSpeed(currentUpSpeed)}
            </span>
          </div>
        </div>

        <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">LIVE TELEMETRY</span>
      </div>

      {/* Chart Canvas */}
      <div className="h-44 w-full relative">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 2 }}>
            <defs>
              <linearGradient id="downGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.18} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="upGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.18} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
            <XAxis dataKey="time" hide />
            <YAxis hide domain={[0, 'auto']} />
            <Tooltip
              cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1, strokeDasharray: '3 3' }}
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-2.5 shadow-xl text-xs font-mono select-none pointer-events-none z-40">
                      <div className="text-blue-400 flex items-center justify-between gap-5">
                        <span className="flex items-center gap-1.5 text-zinc-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                          Down:
                        </span>
                        <span className="font-semibold text-zinc-200">{Number(payload[0]?.value || 0).toFixed(1)} KB/s</span>
                      </div>
                      <div className="text-emerald-400 flex items-center justify-between gap-5 mt-1">
                        <span className="flex items-center gap-1.5 text-zinc-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          Up:
                        </span>
                        <span className="font-semibold text-zinc-200">{Number(payload[1]?.value || 0).toFixed(1)} KB/s</span>
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
              stroke="#3b82f6"
              strokeWidth={1.5}
              fillOpacity={1}
              fill="url(#downGrad)"
            />
            <Area
              type="monotone"
              dataKey="upload"
              stroke="#10b981"
              strokeWidth={1.5}
              fillOpacity={1}
              fill="url(#upGrad)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
