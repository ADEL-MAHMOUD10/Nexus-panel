import React from 'react';
import { Sparkles } from 'lucide-react';

interface RadialHealthGaugeProps {
  score: number; // 0 - 100
  title?: string;
}

export const RadialHealthGauge: React.FC<RadialHealthGaugeProps> = ({ score, title = 'System Health Index' }) => {
  const barsCount = 32;
  const activeCount = Math.round((Math.max(0, Math.min(100, score)) / 100) * barsCount);

  return (
    <div className="flex flex-col items-center justify-center relative py-2 select-none w-full">
      <div className="relative w-56 sm:w-64 h-32 sm:h-36 flex items-end justify-center overflow-hidden">
        <svg viewBox="0 0 240 140" className="w-full h-full overflow-visible">
          {Array.from({ length: barsCount }).map((_, i) => {
            const angleStep = 180 / (barsCount - 1);
            const angleDeg = 180 - i * angleStep;
            const angleRad = (angleDeg * Math.PI) / 180;

            const cx = 120;
            const cy = 130;
            const rInner = 86;
            const rOuter = 106;

            const x1 = cx + rInner * Math.cos(angleRad);
            const y1 = cy - rInner * Math.sin(angleRad);
            const x2 = cx + rOuter * Math.cos(angleRad);
            const y2 = cy - rOuter * Math.sin(angleRad);

            const isActive = i < activeCount;
            const strokeColor = !isActive
              ? '#27272a'
              : score > 70
              ? '#10b981'
              : score > 40
              ? '#f59e0b'
              : '#ef4444';

            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={strokeColor}
                strokeWidth="4"
                strokeLinecap="round"
                className="transition-colors duration-300"
              />
            );
          })}
        </svg>

        {/* Center Percentage Value */}
        <div className="absolute bottom-1 flex flex-col items-center">
          <span className="text-3xl font-bold tracking-tight text-white font-mono">
            {Math.round(score)}%
          </span>
          <span className="text-[11px] text-zinc-400 font-sans tracking-tight mt-0.5">
            {title}
          </span>
        </div>
      </div>

      {/* Axis markers with explicit semantic labels */}
      <div className="w-full max-w-[240px] flex justify-between text-[10px] font-mono text-zinc-400 px-1 mt-1.5">
        <span className="flex items-center gap-1 text-zinc-500">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500/80"></span>
          0% (Degraded)
        </span>
        <span className="flex items-center gap-1 text-emerald-400 font-medium">
          100% (Optimal)
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
        </span>
      </div>

      {/* Explicit User Clarification Badge: Higher is Better */}
      <div className="mt-2.5 flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] sm:text-[11px] font-sans text-emerald-300 shadow-sm text-center">
        <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        <span className="font-medium">Higher is better · 100% is Optimal Health</span>
      </div>
    </div>
  );
};
