import React from 'react';
import { useTheme } from '../context/ThemeContext';
import { Leaf } from 'lucide-react';

interface RadialHealthGaugeProps {
  score: number; // 0 - 100
  title?: string;
}

export const RadialHealthGauge: React.FC<RadialHealthGaugeProps> = ({ score, title = 'Overall Index' }) => {
  const { isDark } = useTheme();
  const barsCount = 28;
  const clampedScore = Math.max(0, Math.min(100, score));
  const activeCount = Math.round((clampedScore / 100) * barsCount);

  const getHealthStatus = (s: number) => {
    const rounded = Math.round(Math.max(0, Math.min(100, s)));
    if (rounded > 70) {
      return {
        text: `Optimal Condition · ${rounded}% (Higher is better)`,
        badgeClasses: isDark
          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
          : 'bg-emerald-500/10 text-[#047857] border-emerald-500/20 font-bold',
        leafGradId: 'leafOptimal',
        glowColor: '#10b981',
        veinColor: isDark ? '#064e3b' : '#047857',
        stemColor: isDark ? '#059669' : '#047857',
      };
    }
    if (rounded > 40) {
      return {
        text: `Moderate Load · ${rounded}% (Higher is better)`,
        badgeClasses: isDark
          ? 'bg-amber-500/10 text-amber-400 border-amber-500/25'
          : 'bg-amber-500/10 text-[#b45309] border-amber-500/20 font-bold',
        leafGradId: 'leafModerate',
        glowColor: '#f59e0b',
        veinColor: isDark ? '#78350f' : '#92400e',
        stemColor: isDark ? '#b45309' : '#b45309',
      };
    }
    return {
      text: `Degraded Health · ${rounded}% (Higher is better)`,
      badgeClasses: isDark
        ? 'bg-rose-500/10 text-rose-400 border-rose-500/25'
        : 'bg-rose-500/10 text-[#be123c] border-rose-500/20 font-bold',
      leafGradId: 'leafDegraded',
      glowColor: '#f43f5e',
      veinColor: isDark ? '#881337' : '#9f1239',
      stemColor: isDark ? '#be123c' : '#be123c',
    };
  };

  const status = getHealthStatus(score);

  // SVG Geometry constants
  const cx = 120;
  const cy = 132;
  const rBranch = 78;
  const rInner = 83;
  const rOuter = 115;
  const leafHalfWidth = 4.3;

  return (
    <div className="flex flex-col items-center justify-center relative py-2 select-none w-full">
      <div className="relative w-56 sm:w-64 h-32 sm:h-36 flex items-end justify-center overflow-visible">
        <svg viewBox="0 0 240 145" className="w-full h-full overflow-visible">
          <defs>
            {/* 1. Optimal Foliage Gradient (Emerald / Spring Sprout Leaf) */}
            <linearGradient id="leafOptimal" x1="0%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="#047857" />
              <stop offset="55%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#4ade80" />
            </linearGradient>

            {/* 2. Moderate Foliage Gradient (Warm Autumn Golden Leaf) */}
            <linearGradient id="leafModerate" x1="0%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="#b45309" />
              <stop offset="55%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#fde047" />
            </linearGradient>

            {/* 3. Degraded Foliage Gradient (Maple Crimson Leaf) */}
            <linearGradient id="leafDegraded" x1="0%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="#9f1239" />
              <stop offset="55%" stopColor="#f43f5e" />
              <stop offset="100%" stopColor="#fda4af" />
            </linearGradient>

            {/* 4. Inactive Leaf Silhouette (Dark Mode) */}
            <linearGradient id="leafInactiveDark" x1="0%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="#18181b" />
              <stop offset="100%" stopColor="#27272a" />
            </linearGradient>

            {/* 5. Inactive Leaf Silhouette (Light Mode) */}
            <linearGradient id="leafInactiveLight" x1="0%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="#e4ded7" />
              <stop offset="100%" stopColor="#d5cec5" />
            </linearGradient>

            {/* Subtle Organic Foliage Glow for Active Leaves */}
            <filter id="foliageGlow" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="0" stdDeviation="1.5" floodColor={status.glowColor} floodOpacity="0.4" />
            </filter>
          </defs>

          {/* Botanical Connecting Branch Vine Arc (connecting bases of leaves) */}
          <path
            d={`M ${cx - rBranch},${cy} A ${rBranch} ${rBranch} 0 0 1 ${cx + rBranch},${cy}`}
            fill="none"
            stroke={isDark ? '#27272a' : '#dcd5cc'}
            strokeWidth="1.8"
            strokeLinecap="round"
          />

          {/* Active Highlighted Portion of the Branch Vine */}
          {activeCount > 0 && (
            <path
              d={`M ${cx - rBranch},${cy} A ${rBranch} ${rBranch} 0 0 1 ${
                cx + rBranch * Math.cos(Math.PI - ((activeCount - 1) * (180 / (barsCount - 1)) * Math.PI) / 180)
              },${
                cy - rBranch * Math.sin(Math.PI - ((activeCount - 1) * (180 / (barsCount - 1)) * Math.PI) / 180)
              }`}
              fill="none"
              stroke={status.stemColor}
              strokeWidth="2.2"
              strokeLinecap="round"
              className="transition-all duration-300"
            />
          )}

          {/* Array of Individual Botanical Leaves (curved leaves with organic veins) */}
          {Array.from({ length: barsCount }).map((_, i) => {
            const angleStep = 180 / (barsCount - 1);
            const rotDeg = i * angleStep - 90;
            const isActive = i < activeCount;

            const leafFill = isActive
              ? `url(#${status.leafGradId})`
              : isDark
              ? 'url(#leafInactiveDark)'
              : 'url(#leafInactiveLight)';

            const leafVein = isActive
              ? status.veinColor
              : isDark
              ? '#1c1c1f'
              : '#c9c2b8';

            const leafStem = isActive
              ? status.stemColor
              : isDark
              ? '#27272a'
              : '#d5cec5';

            return (
              <g
                key={i}
                transform={`translate(${cx}, ${cy}) rotate(${rotDeg.toFixed(2)})`}
                filter={isActive ? 'url(#foliageGlow)' : undefined}
                className="transition-all duration-300 cursor-default group/leaf"
              >
                {/* 1. Leaf Petiole / Stem */}
                <line
                  x1="0"
                  y1={-rBranch}
                  x2="0"
                  y2={-rInner}
                  stroke={leafStem}
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />

                {/* 2. Organic Leaf Blade */}
                <path
                  d={`M 0,${-rInner} C ${-leafHalfWidth},${-rInner - 8.5} ${-leafHalfWidth * 0.8},${-rOuter + 6} 0,${-rOuter} C ${leafHalfWidth * 0.8},${-rOuter + 6} ${leafHalfWidth},${-rInner - 8.5} 0,${-rInner} Z`}
                  fill={leafFill}
                  className="transition-all duration-300 group-hover/leaf:brightness-110"
                />

                {/* 3. Central Midrib Vein */}
                <line
                  x1="0"
                  y1={-rInner - 1}
                  x2="0"
                  y2={-rOuter + 3}
                  stroke={leafVein}
                  strokeWidth="0.8"
                  opacity={isActive ? 0.8 : 0.45}
                  strokeLinecap="round"
                />

                {/* 4. Fine Lateral Secondary Veins */}
                <line
                  x1="0"
                  y1={-rInner - 8}
                  x2={-leafHalfWidth * 0.55}
                  y2={-rInner - 11}
                  stroke={leafVein}
                  strokeWidth="0.6"
                  opacity={isActive ? 0.65 : 0.35}
                  strokeLinecap="round"
                />
                <line
                  x1="0"
                  y1={-rInner - 8}
                  x2={leafHalfWidth * 0.55}
                  y2={-rInner - 11}
                  stroke={leafVein}
                  strokeWidth="0.6"
                  opacity={isActive ? 0.65 : 0.35}
                  strokeLinecap="round"
                />
                <line
                  x1="0"
                  y1={-rInner - 16}
                  x2={-leafHalfWidth * 0.5}
                  y2={-rInner - 19}
                  stroke={leafVein}
                  strokeWidth="0.6"
                  opacity={isActive ? 0.65 : 0.35}
                  strokeLinecap="round"
                />
                <line
                  x1="0"
                  y1={-rInner - 16}
                  x2={leafHalfWidth * 0.5}
                  y2={-rInner - 19}
                  stroke={leafVein}
                  strokeWidth="0.6"
                  opacity={isActive ? 0.65 : 0.35}
                  strokeLinecap="round"
                />
              </g>
            );
          })}
        </svg>

        {/* Center Percentage Value & Title */}
        <div className="absolute bottom-1 flex flex-col items-center">
          <div className="flex items-center gap-1.5">
            <span className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white dark:text-white font-mono drop-shadow-xs">
              {Math.round(clampedScore)}%
            </span>
          </div>
          <span className="text-xs font-bold tracking-tight text-zinc-400 dark:text-zinc-400 font-sans mt-0.5 flex items-center gap-1">
            <Leaf className="w-3 h-3 text-emerald-400 inline-block opacity-80" />
            {title}
          </span>
        </div>
      </div>

      {/* Axis markers with explicit semantic labels */}
      <div className="w-full max-w-[240px] flex justify-between text-[10px] font-mono font-bold text-zinc-400 px-1 mt-2">
        <span className="flex items-center gap-1 text-rose-400">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
          0% (Degraded)
        </span>
        <span className="flex items-center gap-1 text-emerald-400">
          100% (Optimal)
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
        </span>
      </div>

      {/* Dynamic Health State Badge: Higher is Better */}
      <div className={`mt-2.5 px-3 py-1 rounded-full border text-[11px] font-sans font-bold text-center transition-all duration-300 shadow-xs ${status.badgeClasses}`}>
        {status.text}
      </div>
    </div>
  );
};
