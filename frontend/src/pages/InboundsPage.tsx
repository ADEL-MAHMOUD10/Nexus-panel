import React, { useState, useMemo } from 'react';
import { 
  Radio, Plus, Trash2, Edit, Copy, Power, RotateCcw, Share2, Check, QrCode,
  Shield, Layers, Search, Filter, Activity, ArrowUpRight, ArrowDownRight,
  ExternalLink, Lock, Globe, Wifi, Zap, Sliders, ChevronDown, ChevronUp,
  CheckSquare, Square, LayoutGrid, List, Sparkles, Clock, Database,
  AlertTriangle, Server, Tag, Info, ArrowDownUp
} from 'lucide-react';
import { Inbound } from '../types';
import { useNotification } from '../context/NotificationContext';
import { useConfirm } from '../context/ConfirmContext';
import { copyToClipboard } from '../utils/clipboard';

interface InboundsPageProps {
  inbounds: Inbound[];
  onOpenAddModal: () => void;
  onOpenEditModal: (inbound: Inbound) => void;
  onToggleEnable: (inbound: Inbound) => void;
  onResetTraffic: (id: number) => void;
  onCloneInbound: (id: number) => void;
  onDeleteInbound: (id: number) => void;
  onShareInbound: (inbound: Inbound) => void;
  formatBytes: (bytes: number) => string;
  formatSpeed?: (bytesPerSec: number) => string;
}

// Apple / Vercel Restrained Palette: Clean, purposeful, zero neon noise
const getProtocolBadge = (proto: string) => {
  switch ((proto || '').toLowerCase()) {
    case 'vless':
      return {
        badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
        dot: 'bg-blue-500',
      };
    case 'trojan':
      return {
        badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
        dot: 'bg-amber-500',
      };
    case 'shadowsocks':
      return {
        badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
        dot: 'bg-emerald-500',
      };
    case 'wireguard':
      return {
        badge: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
        dot: 'bg-indigo-500',
      };
    case 'hysteria':
    case 'hysteria2':
      return {
        badge: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
        dot: 'bg-rose-500',
      };
    case 'vmess':
      return {
        badge: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
        dot: 'bg-purple-500',
      };
    case 'dokodemo-door':
      return {
        badge: 'bg-zinc-800 text-zinc-300 border-zinc-700/60',
        dot: 'bg-zinc-400',
      };
    case 'socks':
    case 'http':
    default:
      return {
        badge: 'bg-zinc-800 text-zinc-300 border-zinc-700/60',
        dot: 'bg-zinc-400',
      };
  }
};

const parseStreamMeta = (inb: Inbound) => {
  let network = 'tcp';
  let security = 'none';
  let extraDetail = '';
  let parsedRaw: any = {};
  try {
    const ss = JSON.parse(inb.streamSettings || '{}');
    parsedRaw = ss;
    network = ss.network || 'tcp';
    security = ss.security || 'none';
    if (network === 'ws' && ss.wsSettings?.path) {
      extraDetail = `path: ${ss.wsSettings.path}`;
    } else if (network === 'grpc' && ss.grpcSettings?.serviceName) {
      extraDetail = `service: ${ss.grpcSettings.serviceName}`;
    } else if (network === 'httpupgrade' && ss.httpupgradeSettings?.path) {
      extraDetail = `upgrade: ${ss.httpupgradeSettings.path}`;
    } else if ((network === 'xhttp' || network === 'splithttp') && (ss.xhttpSettings?.path || ss.splithttpSettings?.path)) {
      extraDetail = `xhttp: ${ss.xhttpSettings?.path || ss.splithttpSettings?.path}`;
    } else if (security === 'reality' && ss.realitySettings?.dest) {
      extraDetail = `dest: ${ss.realitySettings.dest}`;
    } else if (security === 'tls' && ss.tlsSettings?.serverName) {
      extraDetail = `sni: ${ss.tlsSettings.serverName}`;
    }
  } catch (e) {}

  return { network, security, extraDetail, parsedRaw };
};

export const InboundsPage: React.FC<InboundsPageProps> = ({
  inbounds,
  onOpenAddModal,
  onOpenEditModal,
  onToggleEnable,
  onResetTraffic,
  onCloneInbound,
  onDeleteInbound,
  onShareInbound,
  formatBytes,
  formatSpeed = (b) => `${Math.round(b)} B/s`,
}) => {
  const { notify } = useNotification();
  const confirm = useConfirm();

  // View state
  const [viewMode, setViewMode] = useState<'grid' | 'table'>(() => {
    return (localStorage.getItem('nexus_inbounds_view_mode') as 'grid' | 'table') || 'grid';
  });
  const [filterProtocol, setFilterProtocol] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'disabled'>('all');
  const [sortBy, setSortBy] = useState<'port_asc' | 'port_desc' | 'traffic' | 'speed' | 'clients' | 'remark'>('port_asc');
  const [search, setSearch] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [expandedIds, setExpandedIds] = useState<number[]>([]);

  // Toggle View Mode with persistence
  const handleToggleViewMode = (mode: 'grid' | 'table') => {
    setViewMode(mode);
    localStorage.setItem('nexus_inbounds_view_mode', mode);
  };

  // Toggle Accordion Details for an Inbound Card
  const handleToggleExpand = (id: number) => {
    setExpandedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Global Telemetry Aggregation
  const telemetry = useMemo(() => {
    let totalUp = 0;
    let totalDown = 0;
    let totalUpSpeed = 0;
    let totalDownSpeed = 0;
    let activeCount = 0;
    let disabledCount = 0;
    let totalClients = 0;
    let liveOnlineClients = 0;

    const protocolCounts: Record<string, number> = {};

    inbounds.forEach((inb) => {
      totalUp += inb.up || 0;
      totalDown += inb.down || 0;
      totalUpSpeed += inb.upSpeed || 0;
      totalDownSpeed += inb.downSpeed || 0;
      if (inb.enable) activeCount++;
      else disabledCount++;

      const pKey = (inb.protocol || 'vless').toLowerCase();
      protocolCounts[pKey] = (protocolCounts[pKey] || 0) + 1;

      const clients = inb.clients || [];
      totalClients += clients.length;
      liveOnlineClients += clients.filter((c) => c.isOnline).length;
    });

    return {
      totalUp,
      totalDown,
      totalTraffic: totalUp + totalDown,
      totalUpSpeed,
      totalDownSpeed,
      totalThroughput: totalUpSpeed + totalDownSpeed,
      activeCount,
      disabledCount,
      totalClients,
      liveOnlineClients,
      protocolCounts,
    };
  }, [inbounds]);

  // Filtering & Sorting Pipeline
  const filteredInbounds = useMemo(() => {
    let result = inbounds.filter((inb) => {
      if (filterProtocol !== 'all' && inb.protocol.toLowerCase() !== filterProtocol.toLowerCase()) {
        return false;
      }
      if (filterStatus === 'active' && !inb.enable) return false;
      if (filterStatus === 'disabled' && inb.enable) return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        const matchTag = inb.tag.toLowerCase().includes(q);
        const matchRemark = (inb.remark || '').toLowerCase().includes(q);
        const matchPort = inb.port.toString().includes(q);
        const matchProto = inb.protocol.toLowerCase().includes(q);
        const matchListen = (inb.listen || '').toLowerCase().includes(q);
        const { network, security } = parseStreamMeta(inb);
        const matchNet = network.toLowerCase().includes(q);
        const matchSec = security.toLowerCase().includes(q);
        return matchTag || matchRemark || matchPort || matchProto || matchListen || matchNet || matchSec;
      }
      return true;
    });

    // Sorting
    result.sort((a, b) => {
      if (sortBy === 'port_asc') return a.port - b.port;
      if (sortBy === 'port_desc') return b.port - a.port;
      if (sortBy === 'traffic') return ((b.up || 0) + (b.down || 0)) - ((a.up || 0) + (a.down || 0));
      if (sortBy === 'speed') return ((b.upSpeed || 0) + (b.downSpeed || 0)) - ((a.upSpeed || 0) + (a.downSpeed || 0));
      if (sortBy === 'clients') return ((b.clients || []).length) - ((a.clients || []).length);
      if (sortBy === 'remark') return (a.remark || a.tag).localeCompare(b.remark || b.tag);
      return 0;
    });

    return result;
  }, [inbounds, filterProtocol, filterStatus, sortBy, search]);

  // Bulk Selection Helpers
  const isAllSelected = filteredInbounds.length > 0 && selectedIds.length === filteredInbounds.length;
  const isPartiallySelected = selectedIds.length > 0 && selectedIds.length < filteredInbounds.length;

  const handleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredInbounds.map((inb) => inb.id));
    }
  };

  const handleToggleSelect = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Bulk Actions
  const handleBulkToggle = async (enable: boolean) => {
    const targets = inbounds.filter((i) => selectedIds.includes(i.id) && i.enable !== enable);
    if (targets.length === 0) return;
    for (const inb of targets) {
      onToggleEnable(inb);
    }
    notify.success('Batch State Updated', `${enable ? 'Enabled' : 'Disabled'} ${targets.length} inbound listeners.`);
    setSelectedIds([]);
  };

  const handleBulkResetTraffic = async () => {
    if (selectedIds.length === 0) return;
    const confirmed = await confirm({
      title: 'Reset Traffic for Selected Inbounds',
      message: `Are you sure you want to reset accumulated traffic counters for ${selectedIds.length} inbounds? This action cannot be undone.`,
      confirmText: 'Reset Selected',
      confirmVariant: 'danger',
    });
    if (!confirmed) return;
    for (const id of selectedIds) {
      onResetTraffic(id);
    }
    notify.success('Traffic Counters Reset', `Reset traffic for ${selectedIds.length} inbounds.`);
    setSelectedIds([]);
  };

  // Single Action Confirmations
  const handleConfirmReset = async (inb: Inbound) => {
    const confirmed = await confirm({
      title: 'Reset Inbound Traffic',
      message: `Reset traffic counters for "${inb.remark || inb.tag}" on Port ${inb.port}? Accumulated statistics will return to 0 B.`,
      confirmText: 'Reset Traffic',
      confirmVariant: 'danger',
    });
    if (confirmed) {
      onResetTraffic(inb.id);
      notify.success('Traffic Reset', `Traffic counters reset for port ${inb.port}`);
    }
  };

  const handleConfirmDelete = async (inb: Inbound) => {
    const confirmed = await confirm({
      title: 'Delete Inbound Listener',
      message: `Are you sure you want to permanently delete "${inb.remark || inb.tag}" on Port ${inb.port}? All proxy endpoints on this port will cease functioning immediately.`,
      confirmText: 'Delete Inbound',
      confirmVariant: 'danger',
    });
    if (confirmed) {
      onDeleteInbound(inb.id);
      notify.success('Inbound Removed', `Inbound on port ${inb.port} deleted.`);
    }
  };

  const [copiedPortId, setCopiedPortId] = useState<string | number | null>(null);

  const handleQuickCopyPort = async (inboundId: string | number, port: number) => {
    const success = await copyToClipboard(port.toString());
    if (success) {
      setCopiedPortId(inboundId);
      notify.success('Port Copied', `Port ${port} copied to clipboard.`);
      setTimeout(() => {
        setCopiedPortId((current) => (current === inboundId ? null : current));
      }, 1800);
    } else {
      notify.error('Copy Failed', `Could not copy port ${port}`);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* 1. Global Telemetry Metric Strip (Apple Pro Cards - Borderless) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Inbounds */}
        <div className="p-4 rounded-2xl bg-[#0a0a0c] shadow-xs transition-shadow hover:shadow-md">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Total Inbounds</span>
            <div className="w-7 h-7 rounded-lg bg-neutral-900 text-neutral-400 flex items-center justify-center">
              <Server className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold font-mono text-neutral-100 tracking-tight">{inbounds.length}</span>
            <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded font-bold">
              {telemetry.activeCount} active
            </span>
            {telemetry.disabledCount > 0 && (
              <span className="text-[11px] font-mono text-neutral-500 font-medium">
                {telemetry.disabledCount} off
              </span>
            )}
          </div>
          <div className="mt-2 text-[10px] text-neutral-500 font-mono flex items-center gap-1.5 font-medium">
            <span>Ports 1-65535</span>
            <span>•</span>
            <span>{Object.keys(telemetry.protocolCounts).length} protocols</span>
          </div>
        </div>

        {/* Live Active Online Clients */}
        <div className="p-4 rounded-2xl bg-[#0a0a0c] shadow-xs transition-shadow hover:shadow-md">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Active Online Users</span>
            <div className="w-7 h-7 rounded-lg bg-neutral-900 text-neutral-400 flex items-center justify-center">
              <Activity className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold font-mono text-neutral-100 tracking-tight">{telemetry.liveOnlineClients}</span>
            <span className="text-[11px] font-mono text-neutral-400 font-bold">
              of {telemetry.totalClients} users
            </span>
          </div>
          <div className="mt-2 text-[10px] text-neutral-500 font-mono flex items-center gap-1.5 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
            <span className="text-neutral-400 font-bold">90s real-time sliding sync</span>
          </div>
        </div>

        {/* Real-Time Speed */}
        <div className="p-4 rounded-2xl bg-[#0a0a0c] shadow-xs transition-shadow hover:shadow-md">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Live Ingress Throughput</span>
            <div className="w-7 h-7 rounded-lg bg-neutral-900 text-neutral-400 flex items-center justify-center">
              <Zap className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold font-mono text-neutral-100 tracking-tight">
              {formatSpeed(telemetry.totalThroughput)}
            </span>
          </div>
          <div className="mt-2 text-[10px] text-neutral-400 font-mono flex items-center gap-2 font-bold">
            <span className="text-emerald-400">↑ {formatSpeed(telemetry.totalUpSpeed)}</span>
            <span>•</span>
            <span className="text-neutral-300">↓ {formatSpeed(telemetry.totalDownSpeed)}</span>
          </div>
        </div>

        {/* Cumulative Traffic */}
        <div className="p-4 rounded-2xl bg-[#0a0a0c] shadow-xs transition-shadow hover:shadow-md">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Cumulative Traffic</span>
            <div className="w-7 h-7 rounded-lg bg-neutral-900 text-neutral-400 flex items-center justify-center">
              <Database className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold font-mono text-neutral-100 tracking-tight">
              {formatBytes(telemetry.totalTraffic)}
            </span>
          </div>
          <div className="mt-2 text-[10px] text-neutral-400 font-mono flex items-center gap-2 font-bold">
            <span>↑ {formatBytes(telemetry.totalUp)}</span>
            <span>•</span>
            <span>↓ {formatBytes(telemetry.totalDown)}</span>
          </div>
        </div>
      </div>

      {/* 2. Top Header & Control Toolbar (Borderless) */}
      <div className="p-3.5 rounded-2xl bg-[#0a0a0c] space-y-3 shadow-xs">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by remark, port, protocol, tag, transport, or listen IP..."
              className="w-full pl-9 pr-4 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-neutral-600 focus:ring-1 focus:ring-neutral-600 transition font-sans"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-neutral-400 hover:text-white bg-neutral-800 px-1.5 py-0.5 rounded font-mono"
              >
                Clear
              </button>
            )}
          </div>

          {/* Right Controls: Status Filter, Sorting, View Toggle, Create Button */}
          <div className="flex flex-wrap items-center gap-2">
            
            {/* Status Selector */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-xs text-neutral-300 focus:outline-none focus:border-neutral-600 transition font-mono"
            >
              <option value="all">All States ({inbounds.length})</option>
              <option value="active">Active ({telemetry.activeCount})</option>
              <option value="disabled">Disabled ({telemetry.disabledCount})</option>
            </select>

            {/* Sorting Dropdown */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-xs text-neutral-300 focus:outline-none focus:border-neutral-600 transition font-mono"
            >
              <option value="port_asc">Port (Low → High)</option>
              <option value="port_desc">Port (High → Low)</option>
              <option value="traffic">Highest Traffic</option>
              <option value="speed">Highest Speed</option>
              <option value="clients">Most Clients</option>
              <option value="remark">Name (A-Z)</option>
            </select>

            {/* Grid vs Table View Mode Switcher */}
            <div className="flex items-center p-1 bg-neutral-950 border border-neutral-800 rounded-lg">
              <button
                type="button"
                onClick={() => handleToggleViewMode('grid')}
                title="Grid Cards View"
                className={`p-1.5 rounded-md text-xs transition flex items-center gap-1.5 ${
                  viewMode === 'grid'
                    ? 'bg-neutral-800 text-white shadow-sm'
                    : 'text-neutral-500 hover:text-neutral-300'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span className="hidden sm:inline text-[11px] font-mono">Cards</span>
              </button>
              <button
                type="button"
                onClick={() => handleToggleViewMode('table')}
                title="Dense Table View"
                className={`p-1.5 rounded-md text-xs transition flex items-center gap-1.5 ${
                  viewMode === 'table'
                    ? 'bg-neutral-800 text-white shadow-sm'
                    : 'text-neutral-500 hover:text-neutral-300'
                }`}
              >
                <List className="w-3.5 h-3.5" />
                <span className="hidden sm:inline text-[11px] font-mono">Table</span>
              </button>
            </div>

            {/* Create Inbound Primary Button (Next.js / Vercel Crisp White Button) */}
            <button
              onClick={onOpenAddModal}
              className="px-3.5 py-2 bg-white hover:bg-neutral-200 text-neutral-950 font-medium rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-sm transition active:scale-95"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>New Inbound</span>
            </button>
          </div>
        </div>

        {/* Horizontal Protocol Segmented Filter Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 no-scrollbar">
          {[
            { id: 'all', label: 'All Protocols', count: inbounds.length },
            { id: 'vless', label: 'VLESS', count: telemetry.protocolCounts['vless'] || 0 },
            { id: 'trojan', label: 'Trojan', count: telemetry.protocolCounts['trojan'] || 0 },
            { id: 'shadowsocks', label: 'Shadowsocks', count: telemetry.protocolCounts['shadowsocks'] || 0 },
            { id: 'wireguard', label: 'WireGuard', count: telemetry.protocolCounts['wireguard'] || 0 },
            { id: 'hysteria', label: 'Hysteria 2', count: (telemetry.protocolCounts['hysteria'] || 0) + (telemetry.protocolCounts['hysteria2'] || 0) },
            { id: 'vmess', label: 'VMess', count: telemetry.protocolCounts['vmess'] || 0 },
            { id: 'dokodemo-door', label: 'Dokodemo', count: telemetry.protocolCounts['dokodemo-door'] || 0 },
            { id: 'socks', label: 'SOCKS5', count: telemetry.protocolCounts['socks'] || 0 },
            { id: 'http', label: 'HTTP', count: telemetry.protocolCounts['http'] || 0 },
          ].map((item) => {
            const isSelected = filterProtocol === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setFilterProtocol(item.id)}
                className={`protocol-chip px-2.5 py-1 rounded-lg text-[11px] font-mono whitespace-nowrap transition flex items-center gap-1.5 cursor-pointer ${
                  isSelected
                    ? 'protocol-chip-selected bg-neutral-800 text-white font-semibold shadow-xs'
                    : 'protocol-chip-unselected bg-neutral-900/60 text-neutral-400 hover:text-white hover:bg-neutral-800'
                }`}
              >
                <span>{item.label}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-medium ${
                  isSelected ? 'protocol-count-selected bg-neutral-700 text-white' : 'protocol-count-unselected bg-neutral-950 text-neutral-500'
                }`}>
                  {item.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Bulk Operations Floating Action Banner (When Selected) */}
      {selectedIds.length > 0 && (
        <div className="p-3 rounded-xl bg-neutral-900 border border-neutral-700/80 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-3 animate-in fade-in duration-150">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-md bg-neutral-800 text-white flex items-center justify-center font-mono font-bold text-xs border border-neutral-700">
              {selectedIds.length}
            </div>
            <div>
              <span className="text-xs font-semibold text-neutral-100 tracking-wide">
                {selectedIds.length} {selectedIds.length === 1 ? 'Inbound Selected' : 'Inbounds Selected'}
              </span>
              <p className="text-[10px] text-neutral-400">Execute synchronous batch commands across selected listeners</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleBulkToggle(true)}
              className="px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-mono font-medium flex items-center gap-1.5 transition"
            >
              <Power className="w-3.5 h-3.5" />
              <span>Enable All</span>
            </button>
            <button
              onClick={() => handleBulkToggle(false)}
              className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-300 text-xs font-mono font-medium flex items-center gap-1.5 transition"
            >
              <Power className="w-3.5 h-3.5" />
              <span>Disable All</span>
            </button>
            <button
              onClick={handleBulkResetTraffic}
              className="px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-mono font-medium flex items-center gap-1.5 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Traffic</span>
            </button>
            <button
              onClick={() => setSelectedIds([])}
              className="px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white text-xs font-mono transition"
            >
              Deselect
            </button>
          </div>
        </div>
      )}

      {/* 4. Inbounds Content: Grid Cards OR Dense Table */}
      {filteredInbounds.length === 0 ? (
        <div className="py-20 text-center bg-[#0a0a0c] border border-neutral-800/80 rounded-xl p-8 space-y-3">
          <div className="w-10 h-10 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-500 flex items-center justify-center mx-auto">
            <Radio className="w-5 h-5 text-neutral-600" />
          </div>
          <h3 className="text-sm font-semibold text-neutral-200">No Matching Inbounds Found</h3>
          <p className="text-xs text-neutral-500 max-w-sm mx-auto leading-relaxed">
            {search || filterProtocol !== 'all' || filterStatus !== 'all'
              ? 'No inbound listeners matched your active filter or search queries. Try clearing the search or filters.'
              : 'You have not deployed any proxy inbounds yet. Click "New Inbound" to get started.'}
          </p>
          {(search || filterProtocol !== 'all' || filterStatus !== 'all') && (
            <button
              onClick={() => {
                setSearch('');
                setFilterProtocol('all');
                setFilterStatus('all');
              }}
              className="px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-xs text-neutral-300 font-mono transition border border-neutral-800"
            >
              Reset All Filters
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        
        /* ======================== GRID CARDS VIEW (Apple / Next.js Clean Cards) ======================== */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredInbounds.map((inb) => {
            const { network, security, extraDetail, parsedRaw } = parseStreamMeta(inb);
            const pBadge = getProtocolBadge(inb.protocol);
            const isSelected = selectedIds.includes(inb.id);
            const isExpanded = expandedIds.includes(inb.id);

            const clientCount = inb.clients ? inb.clients.length : 0;
            const onlineCount = (inb.clients || []).filter((c) => c.isOnline).length;
            const totalBytesUsed = (inb.up || 0) + (inb.down || 0);
            const hasQuota = inb.total > 0;
            const quotaPercent = hasQuota ? Math.min(100, Math.round((totalBytesUsed / inb.total) * 100)) : 0;
            const isSpeeding = (inb.upSpeed || 0) > 0 || (inb.downSpeed || 0) > 0;

            return (
              <div
                key={inb.id}
                className={`bg-[#0a0a0c] rounded-2xl flex flex-col justify-between transition-all group relative overflow-hidden shadow-xs hover:shadow-md ${
                  isSelected
                    ? 'ring-2 ring-blue-500 bg-[#0f0f12]'
                    : inb.enable
                    ? 'hover:bg-[#0d0d10]'
                    : 'bg-[#08080a] opacity-75'
                }`}
              >
                <div className="p-4 space-y-3.5">
                  {/* Top Bar: Multi-select Checkbox + Remark + Port Pill */}
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-start gap-2.5 flex-1 min-w-0">
                      <button
                        type="button"
                        onClick={() => handleToggleSelect(inb.id)}
                        className="mt-0.5 text-neutral-500 hover:text-white transition shrink-0"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-white" />
                        ) : (
                          <Square className="w-4 h-4 text-neutral-600" />
                        )}
                      </button>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${inb.enable ? pBadge.dot : 'bg-neutral-600'}`} />
                          <h3 className="text-[15px] font-bold text-neutral-100 tracking-tight truncate font-sans">
                            {inb.remark || inb.tag}
                          </h3>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] font-mono text-neutral-500 mt-0.5 font-medium">
                          <span className="truncate">{inb.tag}</span>
                          {inb.listen && inb.listen !== '0.0.0.0' && (
                            <>
                              <span>•</span>
                              <span className="text-neutral-400 font-semibold">{inb.listen}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Port Pill with Quick Copy & Tactile Micro-interaction */}
                    <button
                      type="button"
                      onClick={() => handleQuickCopyPort(inb.id, inb.port)}
                      title="Click to copy port number"
                      className={`font-mono text-xs font-bold px-2.5 py-1 rounded-lg border transition-all duration-200 flex items-center gap-1.5 shrink-0 active:scale-90 cursor-pointer shadow-xs ${
                        copiedPortId === inb.id
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-emerald-500/10'
                          : 'text-neutral-100 bg-neutral-900 hover:bg-neutral-800 hover:text-white border-neutral-800 hover:border-neutral-700'
                      }`}
                    >
                      {copiedPortId === inb.id ? (
                        <>
                          <span className="text-emerald-400 font-bold animate-in fade-in duration-150">Copied!</span>
                          <Check className="w-3.5 h-3.5 text-emerald-400 animate-in zoom-in-75 duration-200 stroke-[2.5]" />
                        </>
                      ) : (
                        <>
                          <span className="font-bold">:{inb.port}</span>
                          <Copy className="w-3 h-3 text-neutral-400 group-hover/port:text-neutral-200 transition-transform duration-150 group-hover/port:scale-110" />
                        </>
                      )}
                    </button>
                  </div>

                  {/* Badges Row: Protocol, Transport Network, Security */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {/* Protocol */}
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono uppercase font-bold border ${pBadge.badge}`}>
                      {inb.protocol}
                    </span>

                    {/* Transport Network */}
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-mono uppercase font-bold bg-neutral-900 text-neutral-200 border border-neutral-800 flex items-center gap-1">
                      <Radio className="w-2.5 h-2.5 text-neutral-400" />
                      <span>{network}</span>
                    </span>

                    {/* Security Layer */}
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono uppercase font-bold border flex items-center gap-1 ${
                      security === 'reality'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : security === 'tls'
                        ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                        : 'bg-neutral-900 text-neutral-300 border-neutral-800'
                    }`}>
                      <Lock className="w-2.5 h-2.5" />
                      <span>{security}</span>
                    </span>

                    {/* Extra detail if present (e.g. WS path, SNI, Dest) */}
                    {extraDetail && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-medium text-neutral-400 bg-neutral-950 border border-neutral-800 truncate max-w-[150px]">
                        {extraDetail}
                      </span>
                    )}
                  </div>

                  {/* Live Activity & Speed Indicator (If Active) */}
                  {isSpeeding && (
                    <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between font-mono text-xs">
                      <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-[11px]">
                        <Activity className="w-3 h-3 animate-pulse" />
                        <span>Live Bandwidth</span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px]">
                        <span className="text-emerald-400 font-bold">↑ {formatSpeed(inb.upSpeed || 0)}</span>
                        <span className="text-neutral-600">•</span>
                        <span className="text-neutral-100 font-bold">↓ {formatSpeed(inb.downSpeed || 0)}</span>
                      </div>
                    </div>
                  )}

                  {/* Traffic & Active Clients Telemetry Box */}
                  <div className="p-3 rounded-lg bg-neutral-950 border border-neutral-800/80 space-y-2 text-xs font-mono">
                    <div className="flex items-center justify-between text-neutral-400">
                      <span className="text-neutral-400 font-semibold flex items-center gap-1">
                        <Database className="w-3 h-3 text-neutral-500" />
                        <span>Traffic In/Out:</span>
                      </span>
                      <span className="text-neutral-100 font-bold">
                        ↑ {formatBytes(inb.up || 0)} / ↓ {formatBytes(inb.down || 0)}
                      </span>
                    </div>

                    {/* Quota Progress Bar if Inbound Total Limit Set */}
                    {hasQuota && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px] text-neutral-400">
                          <span className="text-neutral-400 font-semibold">Quota Limit:</span>
                          <span className={quotaPercent >= 90 ? 'text-red-400 font-bold' : quotaPercent >= 75 ? 'text-amber-400 font-bold' : 'text-neutral-100 font-bold'}>
                            {formatBytes(totalBytesUsed)} / {formatBytes(inb.total)} ({quotaPercent}%)
                          </span>
                        </div>
                        <div className="w-full h-1 bg-neutral-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ${
                              quotaPercent >= 90 ? 'bg-red-400' : quotaPercent >= 75 ? 'bg-amber-400' : 'bg-neutral-300'
                            }`}
                            style={{ width: `${quotaPercent}%` }}
                          />
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-neutral-400">
                      <span className="text-neutral-400 font-semibold flex items-center gap-1">
                        <Activity className="w-3 h-3 text-neutral-500" />
                        <span>Connected Clients:</span>
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-neutral-100 font-bold">{clientCount} users</span>
                        {onlineCount > 0 ? (
                          <span className="text-emerald-400 font-bold text-[10px] bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.2 rounded flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                            {onlineCount} online
                          </span>
                        ) : (
                          <span className="text-neutral-500 text-[10px] font-medium">(0 online)</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expandable Stream Architecture Drawer */}
                  {isExpanded && (
                    <div className="p-3 rounded-lg bg-neutral-950 border border-neutral-800 space-y-2 text-[11px] font-mono animate-in fade-in duration-150">
                      <div className="flex items-center justify-between pb-1.5 border-b border-neutral-800">
                        <span className="text-xs font-medium text-neutral-300">Detailed Stream Parameters</span>
                        <span className="text-[10px] text-neutral-400">Tag: {inb.tag}</span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-neutral-400">
                        <div>
                          <span className="text-neutral-500 block">Listen Interface:</span>
                          <span className="text-neutral-200">{inb.listen || '0.0.0.0 (All IP)'}</span>
                        </div>
                        <div>
                          <span className="text-neutral-500 block">Port Number:</span>
                          <span className="text-neutral-200">{inb.port}</span>
                        </div>
                        <div>
                          <span className="text-neutral-500 block">Transport Network:</span>
                          <span className="text-neutral-200 uppercase">{network}</span>
                        </div>
                        <div>
                          <span className="text-neutral-500 block">Security Layer:</span>
                          <span className="text-neutral-200 uppercase">{security}</span>
                        </div>
                      </div>

                      {parsedRaw.wsSettings?.path && (
                        <div className="pt-1 border-t border-neutral-800">
                          <span className="text-neutral-500">WS Path: </span>
                          <span className="text-neutral-200">{parsedRaw.wsSettings.path}</span>
                        </div>
                      )}
                      {parsedRaw.grpcSettings?.serviceName && (
                        <div className="pt-1 border-t border-neutral-800">
                          <span className="text-neutral-500">gRPC Service: </span>
                          <span className="text-neutral-200">{parsedRaw.grpcSettings.serviceName}</span>
                        </div>
                      )}
                      {parsedRaw.realitySettings?.dest && (
                        <div className="pt-1 border-t border-neutral-800">
                          <span className="text-neutral-500">REALITY Dest: </span>
                          <span className="text-neutral-200">{parsedRaw.realitySettings.dest}</span>
                        </div>
                      )}
                      {parsedRaw.realitySettings?.serverNames && (
                        <div className="pt-1 border-t border-neutral-800">
                          <span className="text-neutral-500">REALITY SNI: </span>
                          <span className="text-neutral-200">{parsedRaw.realitySettings.serverNames.join(', ')}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Toggle Expand / Collapse Button */}
                  <button
                    type="button"
                    onClick={() => handleToggleExpand(inb.id)}
                    className="w-full py-1 text-[10px] font-mono text-neutral-500 hover:text-neutral-300 flex items-center justify-center gap-1 transition"
                  >
                    <span>{isExpanded ? 'Hide Stream Parameters' : 'Inspect Stream Parameters'}</span>
                    {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                </div>

                {/* Card Bottom Footer: State Switch & Actions Toolbar */}
                <div className="inbound-card-footer px-4 py-2.5 bg-neutral-950/40 border-t border-neutral-800/40 flex items-center justify-between">
                  {/* Enable / Disable State Button */}
                  <button
                    type="button"
                    onClick={() => onToggleEnable(inb)}
                    className={`inbound-power-btn flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-medium transition border ${
                      inb.enable
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                        : 'bg-neutral-900 text-neutral-500 border-neutral-800 hover:bg-neutral-800 hover:text-neutral-300'
                    }`}
                  >
                    <Power className={`w-3.5 h-3.5 ${inb.enable ? 'text-emerald-400' : 'text-neutral-500'}`} />
                    <span>{inb.enable ? 'Listening' : 'Stopped'}</span>
                  </button>

                  {/* Actions Row */}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onShareInbound(inb)}
                      title="Share Inbound / QR"
                      className="inbound-action-btn p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-all duration-150 active:scale-90"
                    >
                      <QrCode className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onCloneInbound(inb.id)}
                      title="Clone Inbound"
                      className="inbound-action-btn p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-all duration-150 active:scale-90"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleConfirmReset(inb)}
                      title="Reset Traffic"
                      className="inbound-action-btn p-1.5 rounded-lg text-neutral-400 hover:text-amber-400 hover:bg-amber-500/10 transition-all duration-150 active:scale-90"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenEditModal(inb)}
                      title="Edit Settings"
                      className="inbound-action-btn p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-all duration-150 active:scale-90"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleConfirmDelete(inb)}
                      title="Delete Inbound"
                      className="inbound-action-btn p-1.5 rounded-lg text-neutral-400 hover:text-red-400 hover:bg-red-500/10 transition-all duration-150 active:scale-90"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (

        /* ======================== DENSE TABLE VIEW (Next.js Data Table - Borderless) ======================== */
        <div className="bg-[#0a0a0c] rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-neutral-950 border-b border-neutral-800 text-[11px] text-neutral-400 uppercase tracking-wider">
                <tr>
                  <th className="p-3.5 w-10 text-center">
                    <button
                      type="button"
                      onClick={handleSelectAll}
                      className="text-neutral-500 hover:text-white transition"
                    >
                      {isAllSelected ? (
                        <CheckSquare className="w-4 h-4 text-white" />
                      ) : isPartiallySelected ? (
                        <CheckSquare className="w-4 h-4 text-neutral-400" />
                      ) : (
                        <Square className="w-4 h-4 text-neutral-600" />
                      )}
                    </button>
                  </th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Port / Tag</th>
                  <th className="p-3.5">Remark & Protocol</th>
                  <th className="p-3.5">Transport & Security</th>
                  <th className="p-3.5">Clients (Live)</th>
                  <th className="p-3.5">Traffic (Up / Down)</th>
                  <th className="p-3.5">Live Speed</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-850">
                {filteredInbounds.map((inb) => {
                  const { network, security, extraDetail } = parseStreamMeta(inb);
                  const pBadge = getProtocolBadge(inb.protocol);
                  const isSelected = selectedIds.includes(inb.id);
                  const clientCount = inb.clients ? inb.clients.length : 0;
                  const onlineCount = (inb.clients || []).filter((c) => c.isOnline).length;
                  const isSpeeding = (inb.upSpeed || 0) > 0 || (inb.downSpeed || 0) > 0;

                  return (
                    <tr
                      key={inb.id}
                      className={`hover:bg-neutral-900/40 transition ${
                        isSelected ? 'bg-neutral-900/60' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="p-3.5 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleSelect(inb.id)}
                          className="text-neutral-500 hover:text-white transition"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-white" />
                          ) : (
                            <Square className="w-4 h-4 text-neutral-600" />
                          )}
                        </button>
                      </td>

                      {/* Power Status */}
                      <td className="p-3.5">
                        <button
                          type="button"
                          onClick={() => onToggleEnable(inb)}
                          className={`p-1.5 rounded-lg border transition ${
                            inb.enable
                              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20'
                              : 'bg-neutral-900 border-neutral-800 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-300'
                          }`}
                          title={inb.enable ? 'Listening - Click to disable' : 'Stopped - Click to enable'}
                        >
                          <Power className="w-3.5 h-3.5" />
                        </button>
                      </td>

                      {/* Port & Tag */}
                      <td className="p-3.5">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleQuickCopyPort(inb.id, inb.port)}
                            title="Click to copy port"
                            className={`font-mono text-xs font-bold px-2 py-0.5 rounded-lg border transition-all duration-200 flex items-center gap-1.5 active:scale-90 cursor-pointer ${
                              copiedPortId === inb.id
                                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                                : 'font-bold text-neutral-100 hover:text-white bg-neutral-900 hover:bg-neutral-800 border-neutral-800'
                            }`}
                          >
                            {copiedPortId === inb.id ? (
                              <>
                                <span className="text-emerald-400 font-bold animate-in fade-in duration-150">Copied!</span>
                                <Check className="w-3 h-3 text-emerald-400 animate-in zoom-in-75 duration-150" />
                              </>
                            ) : (
                              <>
                                <span>:{inb.port}</span>
                                <Copy className="w-2.5 h-2.5 text-neutral-400" />
                              </>
                            )}
                          </button>
                        </div>
                        <span className="text-[10px] text-neutral-500">{inb.tag}</span>
                      </td>

                      {/* Remark & Protocol */}
                      <td className="p-3.5">
                        <div className="font-semibold text-neutral-100 tracking-tight truncate max-w-[180px]">
                          {inb.remark || inb.tag}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold uppercase border ${pBadge.badge}`}>
                            {inb.protocol}
                          </span>
                          {inb.listen && inb.listen !== '0.0.0.0' && (
                            <span className="text-[10px] text-neutral-500">{inb.listen}</span>
                          )}
                        </div>
                      </td>

                      {/* Transport & Security */}
                      <td className="p-3.5">
                        <div className="flex flex-wrap items-center gap-1">
                          <span className="px-1.5 py-0.5 rounded text-[10px] uppercase font-medium bg-neutral-900 text-neutral-300 border border-neutral-800">
                            {network}
                          </span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-medium border ${
                            security === 'reality'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : security === 'tls'
                              ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                              : 'bg-neutral-900 text-neutral-400 border-neutral-800'
                          }`}>
                            {security}
                          </span>
                        </div>
                        {extraDetail && (
                          <span className="text-[9px] text-neutral-500 block truncate max-w-[140px] mt-0.5">
                            {extraDetail}
                          </span>
                        )}
                      </td>

                      {/* Clients (Live Online) */}
                      <td className="p-3.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-neutral-200 font-medium">{clientCount}</span>
                          {onlineCount > 0 ? (
                            <span className="text-emerald-400 font-medium text-[10px] bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.2 rounded flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                              {onlineCount} live
                            </span>
                          ) : (
                            <span className="text-neutral-500 text-[10px]">(0 live)</span>
                          )}
                        </div>
                      </td>

                      {/* Traffic */}
                      <td className="p-3.5 text-neutral-300">
                        <div>↑ {formatBytes(inb.up || 0)}</div>
                        <div className="text-neutral-500">↓ {formatBytes(inb.down || 0)}</div>
                      </td>

                      {/* Live Speed */}
                      <td className="p-3.5">
                        {isSpeeding ? (
                          <div className="text-emerald-400 font-medium flex flex-col">
                            <span>↑ {formatSpeed(inb.upSpeed || 0)}</span>
                            <span className="text-neutral-200">↓ {formatSpeed(inb.downSpeed || 0)}</span>
                          </div>
                        ) : (
                          <span className="text-neutral-600">Idle (0 B/s)</span>
                        )}
                      </td>

                      {/* Actions Toolbar */}
                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => onShareInbound(inb)}
                            title="Share Inbound"
                            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
                          >
                            <QrCode className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onCloneInbound(inb.id)}
                            title="Clone"
                            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleConfirmReset(inb)}
                            title="Reset Traffic"
                            className="p-1.5 rounded-lg text-neutral-400 hover:text-amber-400 hover:bg-amber-500/10 transition"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onOpenEditModal(inb)}
                            title="Edit"
                            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleConfirmDelete(inb)}
                            title="Delete"
                            className="p-1.5 rounded-lg text-neutral-400 hover:text-red-400 hover:bg-red-500/10 transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};