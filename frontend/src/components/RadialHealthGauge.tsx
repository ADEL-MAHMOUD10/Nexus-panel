import React from 'react';

interface RadialHealthGaugeProps {
  score: number; // 0 - 100
  title?: string;
}

export const RadialHealthGauge: React.FC<RadialHealthGaugeProps> = ({ score, title = 'System Health Index' }) => {
  const barsCount = 32;
  const activeCount = Math.round((Math.max(0, Math.min(100, score)) / 100) * barsCount);

  return (
    <div className="flex flex-col items-center justify-center relative py-2 select-none">
      <div className="relative w-64 h-36 flex items-end justify-center overflow-hidden">
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

      {/* Axis markers */}
      <div className="w-60 flex justify-between text-[10px] font-mono text-zinc-500 px-2 mt-1">
        <span>0%</span>
        <span>100%</span>
      </div>
    </div>
  );
};
