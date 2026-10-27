import React, { useState, useEffect, useRef, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './GeoConnectionMap.css';
import { 
  Globe, 
  Eye, 
  EyeOff, 
  ShieldCheck, 
  Radio, 
  Server, 
  Users, 
  MapPin, 
  Plus, 
  Minus, 
  Maximize2, 
  Compass, 
  Navigation, 
  Layers, 
  Lock,
  ExternalLink,
  Zap,
  Activity
} from 'lucide-react';
import { GeoNode, GeoNetworkData } from '../types';
import api from '../services/api';

interface GeoConnectionMapProps {
  formatBytes: (bytes: number) => string;
  showPublicIP?: boolean;
}

type MapTheme = 'satellite' | 'dark' | 'streets';

// Tile providers
const TILE_SERVERS: Record<MapTheme, { url: string; maxZoom: number; subdomains?: string[] }> = {
  satellite: {
    // Esri World Imagery (Satellite Earth photography)
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    maxZoom: 18,
  },
  dark: {
    // CartoDB Dark Matter (Cyber obsidian aesthetic matching Nexus dark mode)
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    subdomains: ['a', 'b', 'c', 'd'],
    maxZoom: 19,
  },
  streets: {
    // OpenStreetMap standard street map
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    subdomains: ['a', 'b', 'c'],
    maxZoom: 19,
  },
};

// Generates smooth curved quadratic bezier points between two coordinates
function getCurvedArcPoints(from: [number, number], to: [number, number], curvature = 0.22): [number, number][] {
  const points: [number, number][] = [];
  const midLat = (from[0] + to[0]) / 2 + Math.abs(to[1] - from[1]) * curvature * 0.15;
  const midLon = (from[1] + to[1]) / 2;

  for (let t = 0; t <= 1; t += 0.04) {
    const lat = (1 - t) * (1 - t) * from[0] + 2 * (1 - t) * t * midLat + t * t * to[0];
    const lon = (1 - t) * (1 - t) * from[1] + 2 * (1 - t) * t * midLon + t * t * to[1];
    points.push([lat, lon]);
  }
  return points;
}

export const GeoConnectionMap: React.FC<GeoConnectionMapProps> = ({ 
  formatBytes,
  showPublicIP = false,
}) => {
  const [data, setData] = useState<GeoNetworkData | null>(null);
  const [selectedTheme, setSelectedTheme] = useState<MapTheme>('satellite');
  const [activeFilter, setActiveFilter] = useState<'all' | 'online' | 'server'>('all');
  const [focusedNodeId, setFocusedNodeId] = useState<number | 'server' | null>(null);

  // Eye blur privacy toggle (persisted in localStorage)
  const [isBlurred, setIsBlurred] = useState<boolean>(() => {
    const saved = localStorage.getItem('nexus_map_blurred');
    return saved !== null ? saved === 'true' : false;
  });

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const linesLayerRef = useRef<L.LayerGroup | null>(null);

  const toggleBlur = () => {
    setIsBlurred((prev) => {
      const next = !prev;
      localStorage.setItem('nexus_map_blurred', String(next));
      return next;
    });
  };

  // Fetch geospatial node data from backend
  const fetchGeoData = async () => {
    try {
      const res = await api.get('/api/server/geo');
      if (res.data && res.data.success) {
        setData(res.data);
      }
    } catch {
      // Fallback
    }
  };

  useEffect(() => {
    fetchGeoData();
    const interval = setInterval(fetchGeoData, 20000);
    return () => clearInterval(interval);
  }, []);

  // Server node (with fallback defaults)
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

  // Client nodes (with fallback defaults for preview)
  const clientNodes: GeoNode[] = useMemo(() => {
    if (data?.clients && data.clients.length > 0) {
      return data.clients;
    }
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

  const visibleClients = useMemo(() => {
    if (activeFilter === 'server') return [];
    if (activeFilter === 'online') return clientNodes.filter((c) => c.isOnline);
    return clientNodes;
  }, [clientNodes, activeFilter]);

  const onlineCount = useMemo(() => clientNodes.filter((c) => c.isOnline).length, [clientNodes]);

  // 1. Initialize Leaflet Map and keep TileLayer in sync
  useEffect(() => {
    if (!mapContainerRef.current) return;

    let map = mapInstanceRef.current;
    if (!map) {
      map = L.map(mapContainerRef.current, {
        center: [30, 20], // Global centered Earth view
        zoom: 3,
        minZoom: 2,
        maxZoom: 18,
        zoomControl: false,
        attributionControl: false,
        worldCopyJump: true,
      });

      const linesGroup = L.layerGroup().addTo(map);
      const markersGroup = L.layerGroup().addTo(map);

      linesLayerRef.current = linesGroup;
      markersLayerRef.current = markersGroup;
      mapInstanceRef.current = map;
    }

    // Manage Tile Layer switching (Satellite Earth vs Dark Matter vs Streets)
    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    const conf = TILE_SERVERS[selectedTheme];
    const newLayer = L.tileLayer(conf.url, {
      maxZoom: conf.maxZoom,
      subdomains: conf.subdomains || [],
    });

    newLayer.addTo(map);
    tileLayerRef.current = newLayer;

    // Ensure Leaflet calculates viewport properly
    map.invalidateSize();
    const initTimer = setTimeout(() => {
      map?.invalidateSize();
    }, 100);

    // ResizeObserver ensures Leaflet never stays black when container dimensions change
    const resizeObserver = new ResizeObserver(() => {
      map?.invalidateSize();
    });
    resizeObserver.observe(mapContainerRef.current);

    return () => {
      clearTimeout(initTimer);
      resizeObserver.disconnect();
    };
  }, [selectedTheme]);

  // Clean unmount on page exit
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        tileLayerRef.current = null;
        markersLayerRef.current = null;
        linesLayerRef.current = null;
      }
    };
  }, []);

  // 2. Keep Leaflet viewport synchronized when toggling privacy blur on/off
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    map.invalidateSize();
    const timers = [
      setTimeout(() => map.invalidateSize(), 50),
      setTimeout(() => map.invalidateSize(), 150),
      setTimeout(() => map.invalidateSize(), 350),
      setTimeout(() => map.invalidateSize(), 500),
    ];

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [isBlurred]);

  // 3. Render Markers & Connection Arcs
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersGroup = markersLayerRef.current;
    const linesGroup = linesLayerRef.current;
    if (!map || !markersGroup || !linesGroup) return;

    markersGroup.clearLayers();
    linesGroup.clearLayers();

    // Fly to actual location helper
    const flyToLocation = (lat: number, lon: number, zoom = 14) => {
      map.flyTo([lat, lon], zoom, {
        duration: 1.8,
        easeLinearity: 0.25,
      });
    };

    // A. Draw Server Beacon Marker (With Real Server SVG Icon)
    const serverHtml = `
      <div class="relative flex items-center justify-center w-10 h-10 cursor-pointer group">
        <span class="absolute w-12 h-12 rounded-full bg-violet-500/40 animate-ping pointer-events-none"></span>
        <div class="relative w-10 h-10 rounded-full bg-[#0c0d13] border-2 border-violet-400 shadow-[0_0_16px_rgba(168,85,247,0.85)] flex items-center justify-center transition-transform duration-200 group-hover:scale-110">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#c084fc" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <rect width="20" height="8" x="2" y="2" rx="2" ry="2"/>
            <rect width="20" height="8" x="2" y="14" rx="2" ry="2"/>
            <line x1="6" x2="6.01" y1="6" y2="6"/>
            <line x1="6" x2="6.01" y1="18" y2="18"/>
          </svg>
        </div>
        <div class="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap px-2 py-0.5 rounded-full bg-[#0c0d13]/95 text-[10px] font-mono font-bold text-violet-200 border border-violet-500/40 shadow-lg pointer-events-none flex items-center gap-1">
          <span class="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse"></span>
          <span>HOST • ${serverNode.countryCode || 'DE'}</span>
        </div>
      </div>
    `;

    const serverIcon = L.divIcon({
      html: serverHtml,
      className: 'nexus-server-marker',
      iconSize: [40, 40],
      iconAnchor: [20, 20],
      popupAnchor: [0, -22],
    });

    const serverMarker = L.marker([serverNode.lat, serverNode.lon], { icon: serverIcon });
    
    // Server Popup Content
    const serverPopupContent = document.createElement('div');
    serverPopupContent.className = 'p-3.5 text-xs text-zinc-100 font-sans';
    serverPopupContent.innerHTML = `
      <div class="flex items-center justify-between gap-3 pb-2.5 border-b border-white/[0.1]">
        <div class="flex items-center gap-2">
          <span class="w-2.5 h-2.5 rounded-full bg-violet-400 animate-pulse"></span>
          <span class="font-semibold text-white tracking-tight">Nexus Core Host</span>
        </div>
        <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-violet-500/20 text-violet-300 border border-violet-500/30">
          ${serverNode.countryCode || 'DE'}
        </span>
      </div>
      <div class="space-y-1.5 my-2.5 font-mono text-[11px]">
        <div class="flex justify-between text-zinc-400">
          <span>Location:</span>
          <span class="text-zinc-200 font-sans font-medium">${serverNode.city}, ${serverNode.country}</span>
        </div>
        <div class="flex justify-between text-zinc-400">
          <span>IP Endpoint:</span>
          <span class="text-zinc-300">${showPublicIP ? (serverNode.ip || '127.0.0.1') : '••••••••••••'}</span>
        </div>
        <div class="flex justify-between text-zinc-400">
          <span>Status:</span>
          <span class="text-emerald-400 font-semibold">Active Listening</span>
        </div>
      </div>
      <button id="btn-fly-server" class="w-full mt-1 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-medium text-xs transition flex items-center justify-center gap-1.5 shadow-md shadow-violet-500/25 cursor-pointer">
        <span>🚀 تكبير إلى الموقع الفعلي (Zoom In)</span>
      </button>
    `;

    serverMarker.bindPopup(serverPopupContent, {
      className: 'nexus-map-popup',
      maxWidth: 280,
    });

    serverMarker.on('popupopen', () => {
      const btn = document.getElementById('btn-fly-server');
      if (btn) {
        btn.onclick = () => flyToLocation(serverNode.lat, serverNode.lon, 14);
      }
    });

    serverMarker.addTo(markersGroup);

    // B. Draw Client Markers (With Real User SVG Icon) and Connection Arcs
    visibleClients.forEach((client) => {
      const isOnline = client.isOnline;

      const clientHtml = `
        <div class="relative flex items-center justify-center w-9 h-9 cursor-pointer group">
          ${isOnline ? '<span class="absolute w-10 h-10 rounded-full bg-emerald-500/35 animate-ping pointer-events-none"></span>' : ''}
          <div class="relative w-9 h-9 rounded-full ${isOnline ? 'bg-[#0c0d13] border-2 border-emerald-400 shadow-[0_0_14px_rgba(16,185,129,0.85)]' : 'bg-[#0c0d13]/90 border border-zinc-600'} flex items-center justify-center transition-transform duration-200 group-hover:scale-110">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${isOnline ? '#34d399' : '#a1a1aa'}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
          </div>
          <div class="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap px-1.5 py-0.5 rounded-full bg-[#0c0d13]/90 text-[9px] font-mono font-medium ${isOnline ? 'text-emerald-300 border border-emerald-500/40' : 'text-zinc-400 border border-zinc-700'} shadow pointer-events-none">
            ${client.city || client.countryCode || 'Client'}
          </div>
        </div>
      `;

      const clientIcon = L.divIcon({
        html: clientHtml,
        className: 'nexus-client-marker',
        iconSize: [36, 36],
        iconAnchor: [18, 18],
        popupAnchor: [0, -20],
      });

      const clientMarker = L.marker([client.lat, client.lon], { icon: clientIcon });

      const clientPopupContent = document.createElement('div');
      clientPopupContent.className = 'p-3.5 text-xs text-zinc-100 font-sans';
      clientPopupContent.innerHTML = `
        <div class="flex items-center justify-between gap-3 pb-2 border-b border-white/[0.1]">
          <div class="flex items-center gap-2">
            <span class="w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-500'}"></span>
            <span class="font-semibold text-white truncate max-w-[150px]">${client.email || 'Client Node'}</span>
          </div>
          <span class="text-[10px] font-mono px-2 py-0.5 rounded ${isOnline ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-zinc-800 text-zinc-400'}">
            ${client.countryCode || 'GL'}
          </span>
        </div>
        <div class="space-y-1.5 my-2.5 font-mono text-[11px]">
          <div class="flex justify-between text-zinc-400">
            <span>Location:</span>
            <span class="text-zinc-200 font-sans font-medium">${client.city}, ${client.country}</span>
          </div>
          <div class="flex justify-between text-zinc-400">
            <span>IP:</span>
            <span class="text-zinc-300">${showPublicIP ? (client.ip || '127.0.0.1') : '••••••••••••'}</span>
          </div>
          ${(client.up !== undefined || client.down !== undefined) ? `
            <div class="flex justify-between text-zinc-400">
              <span>Traffic:</span>
              <span class="text-emerald-400">${formatBytes((client.up || 0) + (client.down || 0))}</span>
            </div>
          ` : ''}
          <div class="flex justify-between text-zinc-400">
            <span>Status:</span>
            <span class="${isOnline ? 'text-emerald-400 font-semibold' : 'text-zinc-500'}">
              ${isOnline ? 'Connected' : 'Offline'}
            </span>
          </div>
        </div>
        <button id="btn-fly-client-${client.id}" class="w-full mt-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs transition flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/20 cursor-pointer">
          <span>📍 الذهاب للموقع الفعلي (Zoom In)</span>
        </button>
      `;

      clientMarker.bindPopup(clientPopupContent, {
        className: 'nexus-map-popup',
        maxWidth: 280,
      });

      clientMarker.on('popupopen', () => {
        const btn = document.getElementById(`btn-fly-client-${client.id}`);
        if (btn) {
          btn.onclick = () => flyToLocation(client.lat, client.lon, 14);
        }
      });

      clientMarker.addTo(markersGroup);

      // C. Draw Curved Connection Arc for Online Clients
      if (isOnline) {
        const arcCoords = getCurvedArcPoints(
          [client.lat, client.lon],
          [serverNode.lat, serverNode.lon]
        );

        // Background luminous line
        L.polyline(arcCoords, {
          color: '#818cf8',
          weight: 1.5,
          opacity: 0.35,
        }).addTo(linesGroup);

        // Animated dashed streaming line
        L.polyline(arcCoords, {
          color: '#34d399',
          weight: 2,
          opacity: 0.85,
          dashArray: '8, 8',
          className: 'nexus-animated-arc',
        }).addTo(linesGroup);
      }
    });
  }, [serverNode, visibleClients, showPublicIP, formatBytes]);

  // Handler to smoothly fly to specific node coordinates
  const handleFlyTo = (node: GeoNode, zoom = 13) => {
    if (!mapInstanceRef.current) return;
    setFocusedNodeId(node.id === 0 ? 'server' : node.id);
    mapInstanceRef.current.flyTo([node.lat, node.lon], zoom, {
      duration: 1.8,
      easeLinearity: 0.25,
    });
  };

  // Handler to reset map to whole-planet Earth view
  const handleResetWorldView = () => {
    if (!mapInstanceRef.current) return;
    setFocusedNodeId(null);
    mapInstanceRef.current.flyTo([25, 20], 3, {
      duration: 1.5,
    });
  };

  return (
    <div className="bg-[#0c0d13]/85 dark:bg-[#0c0d13]/85 bg-white/95 backdrop-blur-xl border border-white/[0.08] dark:border-white/[0.08] border-zinc-200/80 shadow-2xl rounded-2xl p-5 relative overflow-hidden transition-all duration-300">
      {/* Background ambient lighting */}
      <div 
        className="absolute w-[500px] h-[300px] rounded-full pointer-events-none blur-[100px] opacity-15 -top-24 -left-20 bg-gradient-to-r from-violet-600 via-emerald-600 to-cyan-500"
      />

      {/* 1. Header Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-zinc-200 dark:border-white/[0.08] relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-500/10 dark:bg-violet-500/15 border border-violet-500/25 flex items-center justify-center text-violet-500 dark:text-violet-400 shadow-inner">
            <Globe className="w-5 h-5 animate-spin-slow" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">
                Nexus Global Mesh • Earth Telemetry
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Satellite Orbit
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
              Interactive high-resolution Earth map: Server ({serverNode.city}) and live active clients with instant zoom
            </p>
          </div>
        </div>

        {/* Toolbar Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Map Layer Switcher (Satellite Earth vs Obsidian Dark vs Streets) */}
          <div className="flex items-center p-1 rounded-xl bg-zinc-100 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 text-xs font-mono">
            <button
              type="button"
              onClick={() => setSelectedTheme('satellite')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                selectedTheme === 'satellite'
                  ? 'bg-violet-600 text-white font-medium shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
              title="Real Earth Satellite Photography"
            >
              <span>🌍 Earth</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedTheme('dark')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                selectedTheme === 'dark'
                  ? 'bg-violet-600 text-white font-medium shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
              title="Nexus Cyber Obsidian Dark Matter"
            >
              <span>🌌 Obsidian</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedTheme('streets')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                selectedTheme === 'streets'
                  ? 'bg-violet-600 text-white font-medium shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
              title="OpenStreetMap Streets"
            >
              <span>🗺️ Streets</span>
            </button>
          </div>

          {/* Quick Node View Filter */}
          <div className="hidden md:flex items-center p-1 rounded-xl bg-zinc-100 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 text-xs font-mono">
            <button
              type="button"
              onClick={() => setActiveFilter('all')}
              className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                activeFilter === 'all'
                  ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm font-medium'
                  : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
              }`}
            >
              All ({clientNodes.length + 1})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('online')}
              className={`px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                activeFilter === 'online'
                  ? 'bg-white dark:bg-zinc-800 text-emerald-600 dark:text-emerald-400 shadow-sm font-medium'
                  : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Online ({onlineCount})
            </button>
          </div>

          {/* Eye Privacy Blur Toggle */}
          <button
            type="button"
            onClick={toggleBlur}
            className={`px-3 py-1.5 rounded-xl border transition-all duration-200 flex items-center gap-2 cursor-pointer font-sans text-xs ${
              isBlurred
                ? 'bg-amber-500/15 border-amber-500/40 text-amber-600 dark:text-amber-300 shadow-sm hover:bg-amber-500/25'
                : 'bg-zinc-100 dark:bg-white/[0.04] hover:bg-zinc-200 dark:hover:bg-white/[0.08] text-zinc-700 dark:text-zinc-300 border-zinc-300 dark:border-white/[0.08]'
            }`}
            title={isBlurred ? "إظهار الخريطة (Reveal Map)" : "تعتيم الخريطة للخصوصية (Blur Map for Privacy)"}
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

      {/* 2. Quick Location Jump Bar (Click to fly/zoom to actual location) */}
      <div className="flex items-center gap-2 py-2.5 overflow-x-auto no-scrollbar text-xs font-mono border-b border-zinc-200 dark:border-white/[0.06]">
        <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-sans flex items-center gap-1 shrink-0">
          <Navigation className="w-3.5 h-3.5 text-violet-400" />
          <span>Zoom to Actual:</span>
        </span>

        {/* Server Quick Jump Pill */}
        <button
          type="button"
          onClick={() => handleFlyTo(serverNode, 13)}
          className={`px-2.5 py-1 rounded-lg border transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
            focusedNodeId === 'server'
              ? 'bg-violet-600 text-white border-violet-500 font-medium shadow-md shadow-violet-500/30'
              : 'bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border-zinc-200 dark:border-zinc-800'
          }`}
          title="Zoom directly to Core Server actual location"
        >
          <Server className="w-3 h-3 text-violet-400" />
          <span>Server: {serverNode.city} ({serverNode.countryCode || 'DE'})</span>
        </button>

        {/* Clients Quick Jump Pills */}
        {clientNodes.map((c) => (
          <button
            key={`jump-${c.id}`}
            type="button"
            onClick={() => handleFlyTo(c, 13)}
            className={`px-2.5 py-1 rounded-lg border transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
              focusedNodeId === c.id
                ? 'bg-emerald-600 text-white border-emerald-500 font-medium shadow-md shadow-emerald-500/30'
                : 'bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border-zinc-200 dark:border-zinc-800'
            }`}
            title={`Zoom directly to ${c.email} actual location in ${c.city}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${c.isOnline ? 'bg-emerald-400' : 'bg-zinc-500'}`} />
            <span className="truncate max-w-[120px]">{c.city}</span>
            <span className="text-[10px] text-zinc-400">({c.countryCode})</span>
          </button>
        ))}

        {/* Reset World View Button */}
        <button
          type="button"
          onClick={handleResetWorldView}
          className="px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800 shrink-0 ml-auto transition flex items-center gap-1 cursor-pointer"
          title="Reset to whole Earth overview"
        >
          <Compass className="w-3 h-3" />
          <span>Reset World</span>
        </button>
      </div>

      {/* 3. Interactive Leaflet Map Container */}
      <div className="relative my-3 w-full h-[450px] rounded-xl overflow-hidden bg-[#07080c] border border-white/[0.08] shadow-inner select-none nexus-map-container">
        {/* Map Canvas with smooth filter blur transition without transform matrix collision */}
        <div 
          ref={mapContainerRef} 
          className={`w-full h-full transition-[filter,opacity] duration-300 ease-out ${
            isBlurred 
              ? 'filter blur-xl opacity-35 pointer-events-none' 
              : 'filter-none opacity-100'
          }`}
        />

        {/* On-Map Floating Glassmorphism Zoom & Control Overlay */}
        {!isBlurred && (
          <div className="absolute top-4 right-4 z-[400] flex flex-col gap-1.5">
            <button
              type="button"
              onClick={() => mapInstanceRef.current?.zoomIn()}
              className="w-8 h-8 rounded-lg bg-[#0c0d13]/80 hover:bg-[#0c0d13] backdrop-blur-md border border-white/[0.12] text-zinc-200 hover:text-white flex items-center justify-center transition shadow-lg cursor-pointer"
              title="Zoom In (+)"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => mapInstanceRef.current?.zoomOut()}
              className="w-8 h-8 rounded-lg bg-[#0c0d13]/80 hover:bg-[#0c0d13] backdrop-blur-md border border-white/[0.12] text-zinc-200 hover:text-white flex items-center justify-center transition shadow-lg cursor-pointer"
              title="Zoom Out (-)"
            >
              <Minus className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleResetWorldView}
              className="w-8 h-8 rounded-lg bg-[#0c0d13]/80 hover:bg-[#0c0d13] backdrop-blur-md border border-white/[0.12] text-violet-400 hover:text-violet-300 flex items-center justify-center transition shadow-lg cursor-pointer"
              title="Whole Planet Earth View"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Privacy Shield Overlay (When Blurred) */}
        {isBlurred && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-[500] backdrop-blur-md bg-black/45 transition-all duration-500 animate-in fade-in">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-3 shadow-lg shadow-amber-500/10">
              <ShieldCheck className="w-6 h-6 animate-pulse" />
            </div>
            <h4 className="text-sm font-semibold text-white tracking-tight">
              Geospatial Privacy Shield Active
            </h4>
            <p className="text-xs text-zinc-300 max-w-sm mt-1 mb-4 leading-relaxed font-sans">
              Geographic coordinates, server host location, and connected client pins are obfuscated for privacy and screen protection.
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
      </div>

      {/* 4. Bottom Telemetry Summary Strip */}
      <div className="pt-3 border-t border-zinc-200 dark:border-white/[0.08] grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        {/* Core Host Node */}
        <div 
          onClick={() => handleFlyTo(serverNode, 13)}
          className="flex items-center gap-2.5 cursor-pointer group p-1.5 -m-1.5 rounded-lg hover:bg-white/[0.04] transition"
        >
          <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-500 group-hover:scale-105 transition">
            <Server className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] text-zinc-500 dark:text-zinc-400 block font-sans">Core Host Node</span>
            <span className="font-semibold text-zinc-900 dark:text-zinc-200 truncate block">
              {serverNode.city}, {serverNode.countryCode || 'DE'}
            </span>
          </div>
        </div>

        {/* Connected Clients */}
        <div className="flex items-center gap-2.5 p-1.5 -m-1.5 rounded-lg">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
            <Radio className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] text-zinc-500 dark:text-zinc-400 block font-sans">Active Clients</span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400 block font-mono">
              {onlineCount} Connected Nodes
            </span>
          </div>
        </div>

        {/* Zoom Resolution / Mode */}
        <div className="flex items-center gap-2.5 p-1.5 -m-1.5 rounded-lg">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] text-zinc-500 dark:text-zinc-400 block font-sans">Visual Matrix</span>
            <span className="font-semibold text-zinc-900 dark:text-zinc-200 capitalize block">
              {selectedTheme} Imagery
            </span>
          </div>
        </div>

        {/* Privacy Guard Indicator */}
        <div 
          onClick={toggleBlur}
          className="flex items-center gap-2.5 cursor-pointer p-1.5 -m-1.5 rounded-lg hover:bg-white/[0.04] transition"
        >
          <div className={`w-8 h-8 rounded-lg border flex items-center justify-center ${
            isBlurred 
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-500' 
              : 'bg-zinc-100 dark:bg-white/[0.04] border-zinc-200 dark:border-white/[0.08] text-zinc-400'
          }`}>
            {isBlurred ? <Lock className="w-4 h-4 text-amber-500" /> : <Eye className="w-4 h-4" />}
          </div>
          <div>
            <span className="text-[10px] text-zinc-500 dark:text-zinc-400 block font-sans">Privacy Guard</span>
            <span className={`font-semibold block ${isBlurred ? 'text-amber-500' : 'text-zinc-700 dark:text-zinc-300'}`}>
              {isBlurred ? 'Obfuscated' : 'Clear View'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
