import React from 'react';

interface RadialHealthGaugeProps {
  score: number; // 0 - 100
  title?: string;
}

export const RadialHealthGauge: React.FC<RadialHealthGaugeProps> = ({ score, title = 'calculated health value' }) => {
  const barsCount = 28;
  const activeCount = Math.round((Math.max(0, Math.min(100, score)) / 100) * barsCount);

  return (
    <div className="flex flex-col items-center justify-center relative py-2">
      <div className="relative w-64 h-36 flex items-end justify-center overflow-hidden">
        <svg viewBox="0 0 240 140" className="w-full h-full overflow-visible">
          <defs>
            <linearGradient id="neonGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="60%" stopColor="#34d399" />
              <stop offset="100%" stopColor="#06b6d4" />
            </linearGradient>
            <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {Array.from({ length: barsCount }).map((_, i) => {
            // Arc angle from 180 (left) to 0 (right)
            const angleStep = 180 / (barsCount - 1);
            const angleDeg = 180 - i * angleStep;
            const angleRad = (angleDeg * Math.PI) / 180;

            const cx = 120;
            const cy = 130;
            const rInner = 82;
            const rOuter = 108;

            const x1 = cx + rInner * Math.cos(angleRad);
            const y1 = cy - rInner * Math.sin(angleRad);
            const x2 = cx + rOuter * Math.cos(angleRad);
            const y2 = cy - rOuter * Math.sin(angleRad);

            const isActive = i < activeCount;

            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={isActive ? 'url(#neonGradient)' : '#1f242e'}
                strokeWidth="5"
                strokeLinecap="round"
                filter={isActive ? 'url(#neonGlow)' : undefined}
                className="transition-all duration-500"
              />
            );
          })}
        </svg>

        {/* Center Big Percentage Value */}
        <div className="absolute bottom-1 flex flex-col items-center">
          <span className="text-4xl font-bold tracking-tight text-white font-mono drop-shadow-[0_0_12px_rgba(255,255,255,0.2)]">
            {Math.round(score)}%
          </span>
          <span className="text-[11px] text-zinc-400 font-sans tracking-wide mt-0.5">
            {title}
          </span>
        </div>
      </div>

      {/* Axis markers */}
      <div className="w-60 flex justify-between text-[11px] font-mono text-zinc-500 px-2 mt-1">
        <span>0</span>
        <span>100</span>
      </div>
    </div>
  );
};
