import React, { useState, useEffect, useMemo } from 'react';
import { 
  Globe, 
  Eye, 
  EyeOff, 
  ShieldCheck, 
  Radio, 
  Server, 
  Users, 
  MapPin, 
  Sparkles,
  Wifi,
  ExternalLink,
  Lock
} from 'lucide-react';
import { GeoNode, GeoNetworkData } from '../types';
import { WORLD_DOTS } from '../data/worldDots';
import api from '../services/api';

interface GeoConnectionMapProps {
  formatBytes: (bytes: number) => string;
  showPublicIP?: boolean;
}

// Convert Lat/Lon to SVG coordinate on a 960x480 canvas
export function coordsToSvg(lat: number, lon: number, width = 960, height = 480): { x: number; y: number } {
  const clampedLat = Math.max(-56, Math.min(80, lat));
  let normalizedLon = lon;
  while (normalizedLon < -180) normalizedLon += 360;
  while (normalizedLon > 180) normalizedLon -= 360;

  const x = ((normalizedLon + 180) / 360) * width;
  const y = ((80 - clampedLat) / 136) * height;
  return { 
    x: Math.round(x * 10) / 10, 
    y: Math.round(y * 10) / 10 
  };
}

export const GeoConnectionMap: React.FC<GeoConnectionMapProps> = ({ 
  formatBytes,
  showPublicIP = false,
}) => {
  const [data, setData] = useState<GeoNetworkData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [hoveredNode, setHoveredNode] = useState<GeoNode | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'online' | 'server'>('all');

  // Eye blur privacy toggle (persisted in localStorage)
  const [isBlurred, setIsBlurred] = useState<boolean>(() => {
    const saved = localStorage.getItem('nexus_map_blurred');
    return saved !== null ? saved === 'true' : false;
  });

  const toggleBlur = () => {
    setIsBlurred((prev) => {
      const next = !prev;
      localStorage.setItem('nexus_map_blurred', String(next));
      return next;
    });
  };

  // Fetch geospatial nodes from backend
  const fetchGeoData = async () => {
    try {
      const res = await api.get('/api/server/geo');
      if (res.data && res.data.success) {
        setData(res.data);
      }
    } catch {
      // Graceful fallback for offline / dev preview
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchGeoData();
    const interval = setInterval(fetchGeoData, 20000); // 20s telemetry poll
    return () => clearInterval(interval);
  }, []);

  // Default server node if backend data not yet loaded
  const serverNode: GeoNode = useMemo(() => {
    if (data?.server && data.server.lat && data.server.lon) {
      return data.server;
    }
    return {
      id: 0,
      email: 'Nexus Core Host',
      ip: '185.196.220.14',
      country: 'Germany',
      countryCode: 'DE',
      city: 'Frankfurt',
      lat: 50.1109,
      lon: 8.6821,
      isOnline: true,
    };
  }, [data]);

  const clientNodes: GeoNode[] = useMemo(() => {
    if (data?.clients && data.clients.length > 0) {
      return data.clients;
    }
    // Fallback demonstration nodes if no clients exist yet
    return [
      {
        id: 1,
        email: 'user.cairo@nexus.net',
        ip: '156.195.42.12',
        country: 'Egypt',
        countryCode: 'EG',
        city: 'Cairo',
        lat: 30.0444,
        lon: 31.2357,
        isOnline: true,
        up: 45000000,
        down: 620000000,
      },
      {
        id: 2,
        email: 'client.riyadh@nexus.net',
        ip: '178.80.120.55',
        country: 'Saudi Arabia',
        countryCode: 'SA',
        city: 'Riyadh',
        lat: 24.7136,
        lon: 46.6753,
        isOnline: true,
        up: 12000000,
        down: 185000000,
      },
      {
        id: 3,
        email: 'node.dubai@nexus.net',
        ip: '94.200.75.10',
        country: 'United Arab Emirates',
        countryCode: 'AE',
        city: 'Dubai',
        lat: 25.2048,
        lon: 55.2708,
        isOnline: false,
        up: 3000000,
        down: 45000000,
      }
    ];
  }, [data]);

  const serverSvg = useMemo(() => coordsToSvg(serverNode.lat, serverNode.lon), [serverNode]);

  // Filter clients based on user toggle
  const visibleClients = useMemo(() => {
    if (activeFilter === 'server') return [];
    if (activeFilter === 'online') return clientNodes.filter((c) => c.isOnline);
    return clientNodes;
  }, [clientNodes, activeFilter]);

  const onlineClientsCount = useMemo(() => clientNodes.filter((c) => c.isOnline).length, [clientNodes]);
  const totalCountriesCount = useMemo(() => {
    const countries = new Set<string>();
    if (serverNode.countryCode) countries.add(serverNode.countryCode);
    clientNodes.forEach((c) => {
      if (c.countryCode) countries.add(c.countryCode);
    });
    return countries.size;
  }, [serverNode, clientNodes]);

  // Pre-calculate dot illuminations to achieve the exact luminous aesthetics in user's image
  const illuminatedDots = useMemo(() => {
    const activeNodes = [
      { x: serverSvg.x, y: serverSvg.y, type: 'server' },
      ...clientNodes.filter((c) => c.isOnline).map((c) => {
        const pt = coordsToSvg(c.lat, c.lon);
        return { x: pt.x, y: pt.y, type: 'client' };
      })
    ];

    return WORLD_DOTS.map(([x, y]) => {
      // Find distance to closest active node
      let minServerDist = Infinity;
      let minClientDist = Infinity;

      for (const node of activeNodes) {
        const d = Math.hypot(x - node.x, y - node.y);
        if (node.type === 'server') {
          if (d < minServerDist) minServerDist = d;
        } else {
          if (d < minClientDist) minClientDist = d;
        }
      }

      // Proximity glow levels matching reference design
      if (minServerDist < 45) {
        return { x, y, fill: '#e9d5ff', opacity: 0.95, r: 2.2 }; // Core server halo
      }
      if (minServerDist < 85) {
        return { x, y, fill: '#c084fc', opacity: 0.70, r: 2.0 }; // Server regional halo
      }
      if (minClientDist < 35) {
        return { x, y, fill: '#6ee7b7', opacity: 0.95, r: 2.2 }; // Client node halo
      }
      if (minClientDist < 70) {
        return { x, y, fill: '#34d399', opacity: 0.65, r: 2.0 }; // Client regional halo
      }
      if (minServerDist < 140) {
        return { x, y, fill: '#7c3aed', opacity: 0.35, r: 1.8 }; // Faint purple ambient
      }

      // Default continental land dot
      return { x, y, fill: 'currentColor', opacity: 0.22, r: 1.7 };
    });
  }, [serverSvg, clientNodes]);

  return (
    <div className="bg-[#0c0d13]/85 dark:bg-[#0c0d13]/85 bg-white/95 backdrop-blur-xl border border-white/[0.08] dark:border-white/[0.08] border-zinc-200/80 shadow-2xl rounded-2xl p-5 relative overflow-hidden transition-all duration-300">
      {/* Background ambient radial glow */}
      <div 
        className="absolute w-[450px] h-[300px] rounded-full pointer-events-none blur-[90px] opacity-20 -top-20 -left-20 bg-gradient-to-br from-violet-600 via-fuchsia-600 to-cyan-500"
      />

      {/* 1. Header Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-zinc-200 dark:border-white/[0.08] relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-violet-500/10 dark:bg-violet-500/15 border border-violet-500/25 flex items-center justify-center text-violet-600 dark:text-violet-400 shadow-inner">
            <Globe className="w-5 h-5 animate-spin-slow" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">
                Nexus Global Mesh
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Matrix
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
              Geospatial telemetry: Core Host ({serverNode.city || 'Server'}) and active client endpoints
            </p>
          </div>
        </div>

        {/* Action Controls & Filters */}
        <div className="flex items-center gap-2">
          {/* Quick Node View Filters */}
          <div className="hidden sm:flex items-center p-1 rounded-lg bg-zinc-100 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 text-xs font-mono">
            <button
              type="button"
              onClick={() => setActiveFilter('all')}
              className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                activeFilter === 'all'
                  ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm font-medium'
                  : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
              }`}
            >
              All Nodes ({clientNodes.length + 1})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('online')}
              className={`px-2.5 py-1 rounded-md transition cursor-pointer flex items-center gap-1.5 ${
                activeFilter === 'online'
                  ? 'bg-white dark:bg-zinc-800 text-emerald-600 dark:text-emerald-400 shadow-sm font-medium'
                  : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Online ({onlineClientsCount})
            </button>
          </div>

          {/* Eye Privacy Blur Toggle Button */}
          <button
            type="button"
            onClick={toggleBlur}
            className={`px-3 py-1.5 rounded-xl border transition-all duration-200 flex items-center gap-2 cursor-pointer font-sans text-xs ${
              isBlurred
                ? 'bg-amber-500/15 border-amber-500/40 text-amber-600 dark:text-amber-300 shadow-sm hover:bg-amber-500/25'
                : 'bg-zinc-100 dark:bg-white/[0.04] hover:bg-zinc-200 dark:hover:bg-white/[0.08] text-zinc-700 dark:text-zinc-300 border-zinc-300 dark:border-white/[0.08]'
            }`}
            title={isBlurred ? "إظهار الخريطة (Reveal Map)" : "تعتيم الخريطة لحماية الخصوصية (Blur Map for Privacy)"}
          >
            {isBlurred ? (
              <EyeOff className="w-4 h-4 text-amber-500 dark:text-amber-400 animate-pulse" />
            ) : (
              <Eye className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
            )}
            <span className="font-medium text-[11px] sm:text-xs">
              {isBlurred ? "الخريطة معتّمة" : "تعتيم الخريطة"}
            </span>
          </button>
        </div>
      </div>

      {/* 2. Interactive SVG Map Canvas */}
      <div className="relative my-3 w-full aspect-[2/1] rounded-xl overflow-hidden bg-[#07080c] border border-white/[0.05] shadow-inner select-none flex items-center justify-center">
        {/* Subtle Map Grid Overlay */}
        <div 
          className="absolute inset-0 pointer-events-none opacity-[0.03]"
          style={{
            backgroundImage: `radial-gradient(circle, #ffffff 1px, transparent 1px)`,
            backgroundSize: '24px 24px'
          }}
        />

        {/* Primary World Dot Matrix SVG */}
        <svg
          viewBox="0 0 960 480"
          className={`w-full h-full transition-all duration-700 ease-out ${
            isBlurred
              ? 'filter blur-xl scale-[1.03] opacity-30 pointer-events-none'
              : 'filter-none scale-100 opacity-100'
          }`}
        >
          <defs>
            {/* Animated linear gradient for connection arcs */}
            <linearGradient id="arcGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#34d399" stopOpacity="0.8" />
              <stop offset="60%" stopColor="#818cf8" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#c084fc" stopOpacity="1" />
            </linearGradient>

            {/* Radiant core filter */}
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* 1. All Continental Dot Matrix Points */}
          <g className="text-zinc-700 dark:text-[#383354]">
            {illuminatedDots.map((dot, idx) => (
              <circle
                key={`dot-${idx}`}
                cx={dot.x}
                cy={dot.y}
                r={dot.r}
                fill={dot.fill}
                opacity={dot.opacity}
                className="transition-colors duration-300"
              />
            ))}
          </g>

          {/* 2. Connection Arcs between Online Clients and Server */}
          <g className="pointer-events-none">
            {visibleClients
              .filter((c) => c.isOnline)
              .map((client) => {
                const clientSvg = coordsToSvg(client.lat, client.lon);
                // Quadratic bezier arc calculation
                const midX = (clientSvg.x + serverSvg.x) / 2;
                const midY = (clientSvg.y + serverSvg.y) / 2;
                const dist = Math.hypot(clientSvg.x - serverSvg.x, clientSvg.y - serverSvg.y);
                const arcHeight = Math.min(80, Math.max(25, dist * 0.25));
                const controlY = midY - arcHeight;

                const pathData = `M ${clientSvg.x} ${clientSvg.y} Q ${midX} ${controlY} ${serverSvg.x} ${serverSvg.y}`;

                return (
                  <g key={`arc-${client.id}`}>
                    {/* Background faint track */}
                    <path
                      d={pathData}
                      fill="none"
                      stroke="#818cf8"
                      strokeWidth={1}
                      strokeOpacity={0.2}
                    />
                    {/* Animated luminous pulse line */}
                    <path
                      d={pathData}
                      fill="none"
                      stroke="url(#arcGradient)"
                      strokeWidth={1.4}
                      strokeDasharray="6 4"
                      strokeOpacity={0.85}
                      className="animate-pulse"
                    />
                  </g>
                );
              })}
          </g>

          {/* 3. Server Node Marker (Pulsing Radar Beacon) */}
          <g
            className="cursor-pointer"
            onClick={() => setHoveredNode(serverNode)}
            onMouseEnter={() => setHoveredNode(serverNode)}
          >
            {/* Pulsing radar waves */}
            <circle
              cx={serverSvg.x}
              cy={serverSvg.y}
              r={18}
              fill="none"
              stroke="#a855f7"
              strokeWidth={1.5}
              className="animate-ping origin-center opacity-40"
            />
            <circle
              cx={serverSvg.x}
              cy={serverSvg.y}
              r={9}
              fill="#8b5cf6"
              fillOpacity={0.3}
              stroke="#c084fc"
              strokeWidth={1.5}
            />
            <circle
              cx={serverSvg.x}
              cy={serverSvg.y}
              r={4}
              fill="#f5d0fe"
              filter="url(#glow)"
            />
            <circle
              cx={serverSvg.x}
              cy={serverSvg.y}
              r={1.5}
              fill="#ffffff"
            />

            {/* Server Floating Tag */}
            <g transform={`translate(${serverSvg.x}, ${serverSvg.y - 14})`}>
              <rect
                x="-36"
                y="-15"
                width="72"
                height="15"
                rx="4"
                fill="#0f0f18"
                fillOpacity="0.85"
                stroke="#a855f7"
                strokeWidth="0.8"
              />
              <text
                x="0"
                y="-4"
                textAnchor="middle"
                fontSize="8"
                fontFamily="sans-serif"
                fontWeight="bold"
                fill="#e9d5ff"
              >
                HOST • {serverNode.countryCode || 'DE'}
              </text>
            </g>
          </g>

          {/* 4. Client Node Markers */}
          {visibleClients.map((client) => {
            const clientSvg = coordsToSvg(client.lat, client.lon);
            const isOnline = client.isOnline;

            return (
              <g
                key={`client-${client.id}`}
                className="cursor-pointer"
                onClick={() => setHoveredNode(client)}
                onMouseEnter={() => setHoveredNode(client)}
              >
                {isOnline && (
                  <circle
                    cx={clientSvg.x}
                    cy={clientSvg.y}
                    r={12}
                    fill="none"
                    stroke="#10b981"
                    strokeWidth={1.2}
                    className="animate-ping origin-center opacity-30"
                  />
                )}
                <circle
                  cx={clientSvg.x}
                  cy={clientSvg.y}
                  r={isOnline ? 6 : 4}
                  fill={isOnline ? '#059669' : '#475569'}
                  fillOpacity={isOnline ? 0.4 : 0.3}
                  stroke={isOnline ? '#34d399' : '#64748b'}
                  strokeWidth={1.2}
                />
                <circle
                  cx={clientSvg.x}
                  cy={clientSvg.y}
                  r={isOnline ? 2.5 : 2}
                  fill={isOnline ? '#a7f3d0' : '#cbd5e1'}
                />
              </g>
            );
          })}
        </svg>

        {/* 3. Privacy Shield Center Overlay (When Blurred) */}
        {isBlurred && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-20 backdrop-blur-md bg-black/40 transition-all duration-500 animate-in fade-in">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-3 shadow-lg shadow-amber-500/10">
              <ShieldCheck className="w-6 h-6 animate-pulse" />
            </div>
            <h4 className="text-sm font-semibold text-white tracking-tight">
              Geospatial Privacy Shield Active
            </h4>
            <p className="text-xs text-zinc-300 max-w-sm mt-1 mb-4 leading-relaxed font-sans">
              Geographic coordinates, host location, and connected client vectors are obfuscated for privacy and screen security.
            </p>
            <button
              type="button"
              onClick={toggleBlur}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold text-xs transition-transform active:scale-95 shadow-lg shadow-amber-500/20 flex items-center gap-2 cursor-pointer"
            >
              <Eye className="w-4 h-4 text-zinc-950" />
              <span>إلغاء التعتيم وإظهار الخريطة</span>
            </button>
          </div>
        )}

        {/* 4. Floating Node Detail Tooltip Card */}
        {hoveredNode && !isBlurred && (
          <div 
            className="absolute bottom-3 left-3 z-30 bg-[#0f1017]/95 backdrop-blur-xl border border-white/[0.12] shadow-2xl rounded-xl p-3.5 text-xs text-zinc-200 max-w-xs animate-in fade-in slide-in-from-bottom-2 duration-150"
            onMouseLeave={() => setHoveredNode(null)}
          >
            <div className="flex items-center justify-between gap-3 pb-2 border-b border-white/[0.08]">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${hoveredNode.isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-500'}`} />
                <span className="font-semibold text-zinc-100 truncate max-w-[150px]">
                  {hoveredNode.id === 0 ? 'Nexus Core Server' : (hoveredNode.email || 'Client Node')}
                </span>
              </div>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/[0.06] text-zinc-400 border border-white/[0.08]">
                {hoveredNode.countryCode || 'GL'}
              </span>
            </div>

            <div className="space-y-1.5 mt-2 font-mono text-[11px]">
              <div className="flex items-center justify-between text-zinc-400">
                <span>Location:</span>
                <span className="text-zinc-200 font-sans font-medium">
                  {hoveredNode.city}, {hoveredNode.country}
                </span>
              </div>
              <div className="flex items-center justify-between text-zinc-400">
                <span>IP Endpoint:</span>
                <span className="text-zinc-300">
                  {showPublicIP ? (hoveredNode.ip || '127.0.0.1') : '••••••••••••'}
                </span>
              </div>
              {hoveredNode.id !== 0 && (hoveredNode.up !== undefined || hoveredNode.down !== undefined) && (
                <div className="flex items-center justify-between text-zinc-400">
                  <span>Transfer:</span>
                  <span className="text-emerald-400">
                    {formatBytes((hoveredNode.up || 0) + (hoveredNode.down || 0))}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 3. Footer Telemetry Strip */}
      <div className="pt-3 border-t border-zinc-200 dark:border-white/[0.08] grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        {/* Core Host Node */}
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-500">
            <Server className="w-3.5 h-3.5" />
          </div>
          <div>
            <span className="text-[10px] text-zinc-500 dark:text-zinc-400 block font-sans">Core Host Node</span>
            <span className="font-medium text-zinc-800 dark:text-zinc-200 truncate block">
              {serverNode.city}, {serverNode.countryCode || 'DE'}
            </span>
          </div>
        </div>

        {/* Active Connected Clients */}
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
            <Radio className="w-3.5 h-3.5" />
          </div>
          <div>
            <span className="text-[10px] text-zinc-500 dark:text-zinc-400 block font-sans">Connected Clients</span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400 block font-mono">
              {onlineClientsCount} Active Nodes
            </span>
          </div>
        </div>

        {/* Global Regions Count */}
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500">
            <MapPin className="w-3.5 h-3.5" />
          </div>
          <div>
            <span className="text-[10px] text-zinc-500 dark:text-zinc-400 block font-sans">Mesh Coverage</span>
            <span className="font-medium text-zinc-800 dark:text-zinc-200 block">
              {totalCountriesCount} Regions Mapped
            </span>
          </div>
        </div>

        {/* Privacy Guard Indicator */}
        <div className="flex items-center gap-2.5">
          <div className={`w-7 h-7 rounded-lg border flex items-center justify-center ${
            isBlurred 
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-500' 
              : 'bg-zinc-100 dark:bg-white/[0.04] border-zinc-200 dark:border-white/[0.08] text-zinc-400'
          }`}>
            {isBlurred ? <Lock className="w-3.5 h-3.5 text-amber-500" /> : <Eye className="w-3.5 h-3.5" />}
          </div>
          <div>
            <span className="text-[10px] text-zinc-500 dark:text-zinc-400 block font-sans">Privacy Guard</span>
            <span className={`font-medium block ${isBlurred ? 'text-amber-500 font-semibold' : 'text-zinc-600 dark:text-zinc-300'}`}>
              {isBlurred ? 'Obfuscated' : 'Public Display'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
