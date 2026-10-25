import React from 'react';
import { useTheme } from '../context/ThemeContext';

export const BackgroundCanvas: React.FC = () => {
  const { isDark } = useTheme();

  return (
    <div 
      className={`fixed inset-0 pointer-events-none z-0 overflow-hidden select-none transition-colors duration-300 ${
        isDark ? 'bg-[#000000]' : 'bg-[#f2eeeb]'
      }`}
    >
      {/* 1. Subtle Ambient Top/Bottom Luxury Specular Lighting */}
      <div 
        className="absolute -top-[20%] -right-[10%] w-[900px] h-[900px] rounded-full transition-opacity duration-300"
        style={{
          background: isDark
            ? 'radial-gradient(circle, rgba(255, 255, 255, 0.038) 0%, rgba(255, 255, 255, 0) 70%)'
            : 'radial-gradient(circle, rgba(255, 255, 255, 0.8) 0%, rgba(242, 238, 235, 0) 70%)',
        }}
      />
      <div 
        className="absolute -bottom-[20%] -left-[10%] w-[800px] h-[800px] rounded-full transition-opacity duration-300"
        style={{
          background: isDark
            ? 'radial-gradient(circle, rgba(255, 255, 255, 0.022) 0%, rgba(255, 255, 255, 0) 70%)'
            : 'radial-gradient(circle, rgba(230, 222, 215, 0.5) 0%, rgba(242, 238, 235, 0) 70%)',
        }}
      />

      {/* 2. Geometric Architectural Vector Shapes & Nexus 'N' Insignia */}
      <svg 
        className="absolute inset-0 w-full h-full" 
        viewBox="0 0 1600 1000"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Subtle 40px Dot/Line Pattern */}
          <pattern id="nexus-grid-pattern" width="40" height="40" patternUnits="userSpaceOnUse">
            <line 
              x1="0" y1="40" x2="40" y2="40" 
              stroke={isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.025)'} 
              strokeWidth="1" 
            />
            <line 
              x1="40" y1="0" x2="40" y2="40" 
              stroke={isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.025)'} 
              strokeWidth="1" 
            />
            <circle 
              cx="40" cy="40" r="1" 
              fill={isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)'} 
            />
          </pattern>

          {/* Nexus Letter Gradient */}
          <linearGradient id="nexusLetterGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={isDark ? '#ffffff' : '#000000'} stopOpacity={isDark ? '0.07' : '0.04'} />
            <stop offset="45%" stopColor={isDark ? '#ffffff' : '#000000'} stopOpacity={isDark ? '0.025' : '0.02'} />
            <stop offset="100%" stopColor={isDark ? '#ffffff' : '#000000'} stopOpacity="0.005" />
          </linearGradient>

          <linearGradient id="strokeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={isDark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(0, 0, 0, 0.08)'} />
            <stop offset="50%" stopColor={isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)'} />
            <stop offset="100%" stopColor={isDark ? 'rgba(255, 255, 255, 0.01)' : 'rgba(0, 0, 0, 0.01)'} />
          </linearGradient>
        </defs>

        {/* Base Grid Layer */}
        <rect width="100%" height="100%" fill="url(#nexus-grid-pattern)" />

        {/* Subtle Diagonal Architectural Beams / Rays */}
        <g stroke={isDark ? 'rgba(255, 255, 255, 0.025)' : 'rgba(0, 0, 0, 0.03)'} strokeWidth="1">
          <line x1="-10%" y1="25%" x2="110%" y2="65%" strokeDasharray="6 6" />
          <line x1="-10%" y1="45%" x2="110%" y2="85%" strokeDasharray="4 8" />
          <line x1="25%" y1="-10%" x2="85%" y2="110%" strokeDasharray="10 10" />
        </g>

        {/* Geometric Polygonal Facets in Background (Top Right) */}
        <g opacity={isDark ? 0.45 : 0.35}>
          <polygon
            points="880,30 1250,70 1200,360 810,270"
            fill="none"
            stroke="url(#strokeGrad)"
            strokeWidth="1.2"
          />
          <polygon
            points="880,30 810,270 710,190"
            fill="none"
            stroke={isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.025)'}
            strokeWidth="1"
          />
          <circle cx="1080" cy="190" r="150" fill="none" stroke={isDark ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.02)'} strokeDasharray="4 8" />
          <circle cx="1080" cy="190" r="240" fill="none" stroke={isDark ? 'rgba(255,255,255,0.015)' : 'rgba(0,0,0,0.01)'} />
        </g>

        {/* Large Signature Nexus "N" Monogram Watermark */}
        <g transform="translate(640, 100)" opacity={isDark ? 0.9 : 0.65}>
          {/* Outer Monogram Shroud Outline */}
          <polygon
            points="90,10 390,10 440,510 40,510"
            fill="none"
            stroke={isDark ? 'rgba(255, 255, 255, 0.015)' : 'rgba(0, 0, 0, 0.02)'}
            strokeWidth="1"
            strokeDasharray="8 8"
          />

          {/* Left Vertical Pillar */}
          <path
            d="M 110 30 L 180 30 L 180 490 L 110 490 Z"
            fill="url(#nexusLetterGrad)"
            stroke="url(#strokeGrad)"
            strokeWidth="1.4"
          />
          {/* Diagonal Bridge */}
          <path
            d="M 180 50 L 370 430 L 370 490 L 300 490 L 110 110 L 110 50 Z"
            fill="url(#nexusLetterGrad)"
            stroke="url(#strokeGrad)"
            strokeWidth="1.4"
          />
          {/* Right Vertical Pillar */}
          <path
            d="M 300 30 L 370 30 L 370 490 L 300 490 Z"
            fill="url(#nexusLetterGrad)"
            stroke="url(#strokeGrad)"
            strokeWidth="1.4"
          />

          {/* Architectural Cut-lines and Coordinates */}
          <line x1="70" y1="260" x2="410" y2="260" stroke={isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'} strokeDasharray="4 4" />
          <line x1="110" y1="30" x2="370" y2="490" stroke={isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'} strokeWidth="1" />

          {/* Micro Typography Specs */}
          <text x="390" y="70" fill={isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.14)'} fontSize="11" fontFamily="monospace" letterSpacing="0.25em">
            NEXUS // SYS
          </text>
          <text x="390" y="88" fill={isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.09)'} fontSize="9" fontFamily="monospace">
            VER: 1.1.0-ENTERPRISE
          </text>
          <text x="390" y="104" fill={isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.07)'} fontSize="8" fontFamily="monospace">
            GEO: 35.6895°N 139.6917°E
          </text>
        </g>

        {/* Floating Geometric Wireframe Diamond / Facet (Bottom Left) */}
        <g transform="translate(140, 540)" opacity={isDark ? 0.6 : 0.4}>
          <polygon
            points="70,0 140,60 70,120 0,60"
            fill="none"
            stroke="url(#strokeGrad)"
            strokeWidth="1.2"
          />
          <polygon
            points="70,0 70,120"
            stroke={isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'}
            strokeWidth="1"
          />
          <polygon
            points="0,60 140,60"
            stroke={isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'}
            strokeWidth="1"
          />
        </g>
      </svg>
    </div>
  );
};
