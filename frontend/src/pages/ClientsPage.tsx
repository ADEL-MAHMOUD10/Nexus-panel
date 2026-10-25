import React, { useState, useMemo } from 'react';
import { 
  Users, 
  Plus, 
  Trash2, 
  Edit, 
  RotateCcw, 
  QrCode, 
  Info,
  Power, 
  PowerOff,
  Search, 
  ArrowUpRight, 
  ArrowDownLeft,
  CheckSquare,
  Square,
  Copy,
  Check,
  X,
  ShieldCheck,
  Zap,
  Activity,
  Infinity as InfinityIcon,
  Filter,
  ArrowUpDown
} from 'lucide-react';
import { Client, Inbound } from '../types';
import api from '../services/api';
import { useNotification } from '../context/NotificationContext';
import { useConfirm } from '../context/ConfirmContext';
import { copyToClipboard } from '../utils/clipboard';

interface ClientsPageProps {
  inbounds: Inbound[];
  onOpenAddClient: () => void;
  onOpenEditClient: (client: Client) => void;
  onDeleteClient: (id: number) => void;
  onResetClientTraffic: (id: number) => void;
  onShareClient: (client: Client, inbound: Inbound) => void;
  formatBytes: (bytes: number) => string;
  formatSpeed?: (bytesPerSec: number) => string;
  onRefreshInbounds?: () => void;
}

export const ClientsPage: React.FC<ClientsPageProps> = ({
  inbounds,
  onOpenAddClient,
  onOpenEditClient,
  onDeleteClient,
  onResetClientTraffic,
  onShareClient,
  formatBytes,
  formatSpeed = (b) => `${Math.round(b)} B/s`,
  onRefreshInbounds,
}) => {
  const { notify } = useNotification();
  const confirm = useConfirm();
  const [search, setSearch] = useState<string>('');
  const [filterInbound, setFilterInbound] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all'); // all, online, active, depleted, expired
  const [sortBy, setSortBy] = useState<string>('oldest'); // oldest, newest, traffic, speed, expiry, email
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [inspectClient, setInspectClient] = useState<{ client: Client; inbound: Inbound } | null>(null);
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [togglingClientId, setTogglingClientId] = useState<number | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Flatten all clients with their respective inbounds
  const allClients: { client: Client; inbound: Inbound }[] = useMemo(() => {
    const list: { client: Client; inbound: Inbound }[] = [];
    inbounds.forEach((inb) => {
      (inb.clients || []).forEach((c) => {
        list.push({ client: c, inbound: inb });
      });
    });
    return list;
  }, [inbounds]);

  const now = Math.floor(Date.now() / 1000);

  // Filter clients
  const filtered = useMemo(() => {
    let result = allClients.filter(({ client, inbound }) => {
      if (filterInbound !== 'all' && inbound.id.toString() !== filterInbound) {
        return false;
      }

      const used = (client.up || 0) + (client.down || 0);
      const isDepleted = client.total > 0 && used >= client.total;
      const isExpired = client.expiryTime > 0 && now > client.expiryTime;

      if (filterStatus === 'online' && !client.isOnline) return false;
      if (filterStatus === 'depleted' && !isDepleted) return false;
      if (filterStatus === 'expired' && !isExpired) return false;
      if (filterStatus === 'active' && (!client.enable || isDepleted || isExpired)) return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        const matchEmail = (client.email || '').toLowerCase().includes(q);
        const matchUUID = (client.uuid || '').toLowerCase().includes(q);
        const matchSubID = (client.subId || '').toLowerCase().includes(q);
        const matchInb = (inbound.remark || inbound.tag || '').toLowerCase().includes(q);
        const matchPort = inbound.port.toString().includes(q);
        return matchEmail || matchUUID || matchSubID || matchInb || matchPort;
      }
      return true;
    });

    // Sorting
    result.sort((a, b) => {
      if (sortBy === 'newest') return b.client.id - a.client.id;
      if (sortBy === 'oldest') return a.client.id - b.client.id;
      if (sortBy === 'traffic') {
        const usedA = (a.client.up || 0) + (a.client.down || 0);
        const usedB = (b.client.up || 0) + (b.client.down || 0);
        return usedB - usedA;
      }
      if (sortBy === 'speed') {
        const speedA = (a.client.upSpeed || 0) + (a.client.downSpeed || 0);
        const speedB = (b.client.upSpeed || 0) + (b.client.downSpeed || 0);
        return speedB - speedA;
      }
      if (sortBy === 'expiry') {
        if (a.client.expiryTime === 0) return 1;
        if (b.client.expiryTime === 0) return -1;
        return a.client.expiryTime - b.client.expiryTime;
      }
      if (sortBy === 'email') return a.client.email.localeCompare(b.client.email);
      return 0;
    });

    return result;
  }, [allClients, filterInbound, filterStatus, search, sortBy, now]);

  // Aggregate Metrics
  const onlineCount = useMemo(() => allClients.filter((i) => i.client.isOnline).length, [allClients]);
  const totalTrafficTransferred = useMemo(() => {
    return allClients.reduce((acc, curr) => acc + (curr.client.up || 0) + (curr.client.down || 0), 0);
  }, [allClients]);

  // Copy helper
  const handleCopy = async (text: string, key: string) => {
    const success = await copyToClipboard(text);
    if (success) {
      setCopiedKey(key);
      notify.success('Copied', 'Text copied to clipboard.');
      setTimeout(() => setCopiedKey(null), 1800);
    }
  };

  // Toggle client active status
  const handleToggleEnable = async (client: Client) => {
    setTogglingClientId(client.id);
    try {
      const res = await api.post(`/api/clients/toggle/${client.id}`);
      if (res.data && res.data.success) {
        notify.success(
          res.data.enable ? 'Client Enabled' : 'Client Disabled',
          `Client ${client.email} status updated.`
        );
        if (onRefreshInbounds) onRefreshInbounds();
      } else {
        notify.error('Action Failed', res.data?.message || 'Could not update client status');
      }
    } catch (e: any) {
      notify.error('Toggle Error', e.response?.data?.message || 'Failed to toggle client');
    } finally {
      setTogglingClientId(null);
    }
  };

  // Select all or deselect all
  const handleSelectAll = () => {
    if (selectedIds.length === filtered.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filtered.map((item) => item.client.id));
    }
  };

  const handleToggleSelect = (id: number) => {
    setSelectedIds((prev) => 
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // Batch actions
  const handleBatchAction = async (action: 'enable' | 'disable' | 'reset-traffic' | 'delete') => {
    if (selectedIds.length === 0) return;

    if (action === 'delete') {
      const ok = await confirm({
        title: `Delete ${selectedIds.length} Selected Clients`,
        message: `Are you sure you want to permanently delete ${selectedIds.length} selected clients? Their routing credentials will be immediately revoked from the Xray kernel. This action cannot be undone.`,
        confirmText: `Delete ${selectedIds.length} Clients`,
        cancelText: 'Cancel',
        variant: 'danger',
        icon: 'trash',
      });
      if (!ok) return;
    }

    if (action === 'reset-traffic') {
      const ok = await confirm({
        title: `Reset Traffic for ${selectedIds.length} Clients`,
        message: `Reset upload and download traffic statistics to zero for ${selectedIds.length} selected clients?`,
        confirmText: 'Reset Traffic',
        cancelText: 'Cancel',
        variant: 'warning',
        icon: 'reset',
      });
      if (!ok) return;
    }

    setIsBatchProcessing(true);
    try {
      const res = await api.post('/api/clients/bulk', {
        action,
        ids: selectedIds,
      });

      if (res.data && res.data.success) {
        notify.success('Bulk Action Complete', `${res.data.affected} clients successfully processed (${action}).`);
        setSelectedIds([]);
        if (onRefreshInbounds) onRefreshInbounds();
      } else {
        notify.error('Bulk Action Failed', res.data?.message || 'Could not execute batch action');
      }
    } catch (e: any) {
      notify.error('Batch Error', e.response?.data?.message || 'Failed to execute batch command');
    } finally {
      setIsBatchProcessing(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* 1. Header Toolbar with Stats & Controls (Borderless) */}
      <div className="bg-[#0c0d13]/85 backdrop-blur-xl rounded-2xl p-4 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Quick Metrics */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="px-3 py-1.5 rounded-xl bg-neutral-950 border border-neutral-850 hover:border-neutral-750 hover:bg-neutral-900/60 transition-all flex items-center gap-2 cursor-default group">
              <Users className="w-3.5 h-3.5 text-neutral-400 group-hover:text-neutral-200 transition-colors" />
              <span className="text-xs text-neutral-400">Total Clients:</span>
              <span className="text-xs font-mono font-semibold text-white">{allClients.length}</span>
            </div>

            <div className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 hover:border-emerald-500/40 hover:bg-emerald-500/15 transition-all flex items-center gap-2 cursor-default">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-xs text-emerald-400 font-medium">Online Live:</span>
              <span className="text-xs font-mono font-semibold text-emerald-400">{onlineCount}</span>
            </div>

            <div className="px-3 py-1.5 rounded-xl bg-neutral-950 border border-neutral-850 hover:border-neutral-750 hover:bg-neutral-900/60 transition-all flex items-center gap-2 cursor-default group">
              <Zap className="w-3.5 h-3.5 text-blue-400 group-hover:scale-110 transition-transform" />
              <span className="text-xs text-neutral-400">Total Transferred:</span>
              <span className="text-xs font-mono font-semibold text-neutral-200">{formatBytes(totalTrafficTransferred)}</span>
            </div>
          </div>

          {/* New Client Button */}
          <button
            onClick={onOpenAddClient}
            className="px-4 py-2 bg-white hover:bg-neutral-200 text-neutral-950 font-semibold rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95 cursor-pointer hover:shadow-md shrink-0"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>New Client</span>
          </button>
        </div>

        {/* Filter Inputs Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5 pt-3 border-t border-neutral-850">
          {/* Search Box */}
          <div className="sm:col-span-2 lg:col-span-5 relative">
            <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Email, comment, Sub ID, UUID, port..."
              className="w-full pl-9 pr-8 py-2 bg-[#0c0d10] border border-neutral-800 rounded-xl text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-neutral-600 transition font-sans"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Inbound Filter */}
          <div className="lg:col-span-3">
            <select
              value={filterInbound}
              onChange={(e) => setFilterInbound(e.target.value)}
              className="w-full px-3 py-2 bg-[#0c0d10] border border-neutral-800 rounded-xl text-xs text-neutral-300 focus:outline-none focus:border-neutral-600 transition font-sans"
            >
              <option value="all">All Inbounds</option>
              {inbounds.map((i) => (
                <option key={i.id} value={i.id.toString()}>
                  {i.remark || i.tag} (:{i.port})
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="lg:col-span-2">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-3 py-2 bg-[#0c0d10] border border-neutral-800 rounded-xl text-xs text-neutral-300 focus:outline-none focus:border-neutral-600 transition font-sans"
            >
              <option value="all">All Statuses</option>
              <option value="online">Online Live</option>
              <option value="active">Active Accounts</option>
              <option value="depleted">Quota Depleted</option>
              <option value="expired">Expired</option>
            </select>
          </div>

          {/* Sort By */}
          <div className="lg:col-span-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full px-3 py-2 bg-[#0c0d10] border border-neutral-800 rounded-xl text-xs text-neutral-300 focus:outline-none focus:border-neutral-600 transition font-sans"
            >
              <option value="oldest">Oldest First</option>
              <option value="newest">Newest First</option>
              <option value="traffic">Highest Traffic</option>
              <option value="speed">Highest Speed</option>
              <option value="expiry">Expiry Date</option>
              <option value="email">Client Name</option>
            </select>
          </div>
        </div>
      </div>

      {/* 2. Floating Batch Action Toolbar (When rows are checked) */}
      {selectedIds.length > 0 && (
        <div className="sticky top-20 z-30 bg-[#0c0d10] border border-neutral-800 rounded-xl p-3 shadow-2xl flex flex-wrap items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            <span className="text-xs font-semibold text-white">
              {selectedIds.length} {selectedIds.length === 1 ? 'Client' : 'Clients'} Selected
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleBatchAction('enable')}
              disabled={isBatchProcessing}
              className="px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
            >
              <Power className="w-3.5 h-3.5" />
              <span>Enable</span>
            </button>

            <button
              onClick={() => handleBatchAction('disable')}
              disabled={isBatchProcessing}
              className="px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
            >
              <PowerOff className="w-3.5 h-3.5 text-neutral-400" />
              <span>Disable</span>
            </button>

            <button
              onClick={() => handleBatchAction('reset-traffic')}
              disabled={isBatchProcessing}
              className="px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-300 text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Traffic</span>
            </button>

            <button
              onClick={() => handleBatchAction('delete')}
              disabled={isBatchProcessing}
              className="px-3 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </button>

            <button
              onClick={() => setSelectedIds([])}
              className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/[0.08] rounded-lg transition-all cursor-pointer active:scale-90 ml-2"
              title="Clear selection"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* 3. Real-Time Clients Data Table & Cards */}
      {filtered.length === 0 ? (
        <div className="bg-[#0c0d10] rounded-2xl shadow-sm p-16 text-center text-neutral-500 text-xs font-sans border border-neutral-850/60">
          <Users className="w-10 h-10 text-neutral-600 mx-auto mb-3 opacity-60" />
          <span>No client accounts found matching the criteria.</span>
        </div>
      ) : (
        <>
          {/* Desktop Table View (>= md screens) */}
          <div className="hidden md:block bg-[#0c0d10] rounded-2xl shadow-sm overflow-hidden border border-neutral-850/60">
            <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead>
                <tr className="border-b border-neutral-800/80 text-neutral-400 font-mono text-[11px] bg-neutral-950/60">
                  {/* Select All Checkbox */}
                  <th className="py-3 px-3.5 w-10 text-center">
                    <button
                      onClick={handleSelectAll}
                      className="p-1 text-neutral-500 hover:text-neutral-200 transition"
                      title={selectedIds.length === filtered.length ? 'Deselect All' : 'Select All'}
                    >
                      {selectedIds.length > 0 && selectedIds.length === filtered.length ? (
                        <CheckSquare className="w-4 h-4 text-blue-500" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>

                  {/* Actions */}
                  <th className="py-3 px-3 font-semibold text-neutral-300">Actions</th>

                  {/* Enabled */}
                  <th className="py-3 px-3 font-semibold text-neutral-300 text-center">Enabled</th>

                  {/* Online */}
                  <th className="py-3 px-3 font-semibold text-neutral-300">Online</th>

                  {/* Client */}
                  <th className="py-3 px-4 font-semibold text-neutral-300">Client</th>

                  {/* Attached Inbounds */}
                  <th className="py-3 px-4 font-semibold text-neutral-300">Attached inbounds</th>

                  {/* Traffic */}
                  <th className="py-3 px-4 font-semibold text-neutral-300 min-w-[200px]">Traffic</th>

                  {/* Speed */}
                  <th className="py-3 px-4 font-semibold text-neutral-300 min-w-[170px]">Speed</th>

                  {/* Remaining */}
                  <th className="py-3 px-4 font-semibold text-neutral-300 text-center">Remaining</th>

                  {/* Duration */}
                  <th className="py-3 px-4 font-semibold text-neutral-300 text-center">Duration</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-neutral-850/60">
                {filtered.map(({ client, inbound }) => {
                  const used = (client.up || 0) + (client.down || 0);
                  const isDepleted = client.total > 0 && used >= client.total;
                  const isExpired = client.expiryTime > 0 && now > client.expiryTime;
                  const isSelected = selectedIds.includes(client.id);

                  // Remaining traffic calculation
                  const remainingBytes = client.total > 0 ? Math.max(0, client.total - used) : 0;

                  // Expiry Duration calculation
                  let durationLabel = '∞';
                  let durationSubtitle = 'Never expires';
                  if (client.expiryTime > 0) {
                    const diffSec = client.expiryTime - now;
                    if (diffSec <= 0) {
                      durationLabel = 'Expired';
                      durationSubtitle = new Date(client.expiryTime * 1000).toLocaleDateString();
                    } else {
                      const diffDays = Math.floor(diffSec / 86400);
                      const diffHours = Math.floor((diffSec % 86400) / 3600);
                      durationLabel = diffDays > 0 ? `${diffDays}d left` : `${diffHours}h left`;
                      durationSubtitle = new Date(client.expiryTime * 1000).toLocaleDateString();
                    }
                  }

                  // Percent of traffic
                  const percent = client.total > 0 ? Math.min(100, Math.round((used / client.total) * 100)) : 0;

                  // Real-time Speeds
                  const upSpeed = client.upSpeed || 0;
                  const downSpeed = client.downSpeed || 0;
                  const hasSpeed = upSpeed > 0 || downSpeed > 0;

                  return (
                    <tr 
                      key={client.id} 
                      className={`hover:bg-neutral-900/40 transition group ${isSelected ? 'bg-neutral-850/60' : ''}`}
                    >
                      {/* Checkbox */}
                      <td className="py-3.5 px-3.5 text-center">
                        <button
                          onClick={() => handleToggleSelect(client.id)}
                          className="p-1 text-neutral-500 hover:text-neutral-200 transition"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-blue-500" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>

                      {/* Actions: QR, Info, Reset, Edit, Delete */}
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-1">
                          {/* QR Code / Share */}
                          <button
                            onClick={() => onShareClient(client, inbound)}
                            title="QR Code & Subscription Link"
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-all cursor-pointer active:scale-90 hover:scale-110"
                          >
                            <QrCode className="w-3.5 h-3.5" />
                          </button>

                          {/* Info Inspector */}
                          <button
                            onClick={() => setInspectClient({ client, inbound })}
                            title="Inspect Client Details"
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-blue-400 hover:bg-blue-500/10 transition-all cursor-pointer active:scale-90 hover:scale-110"
                          >
                            <Info className="w-3.5 h-3.5" />
                          </button>

                          {/* Reset Traffic */}
                          <button
                            onClick={() => onResetClientTraffic(client.id)}
                            title="Reset Traffic Counters"
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-amber-400 hover:bg-amber-500/10 transition-all cursor-pointer active:scale-90 hover:scale-110"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>

                          {/* Edit */}
                          <button
                            onClick={() => onOpenEditClient(client)}
                            title="Edit Client"
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-blue-400 hover:bg-blue-500/10 transition-all cursor-pointer active:scale-90 hover:scale-110"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => onDeleteClient(client.id)}
                            title="Delete Client"
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all cursor-pointer active:scale-90 hover:scale-110"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>

                      {/* Enabled Toggle Switch */}
                      <td className="py-3.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleEnable(client)}
                          disabled={togglingClientId === client.id}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            client.enable ? 'bg-blue-600' : 'bg-zinc-800'
                          }`}
                          title={client.enable ? 'Click to Disable' : 'Click to Enable'}
                        >
                          <span
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                              client.enable ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </td>

                      {/* Online Status Badge */}
                      <td className="py-3.5 px-3">
                        {client.isOnline ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            Online
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono text-neutral-500 bg-neutral-900 border border-neutral-800">
                            Offline
                          </span>
                        )}
                      </td>

                      {/* Client Email & UUID / SubID */}
                      <td className="py-3.5 px-4 font-sans">
                        <div className="flex flex-col">
                          <span className="font-semibold text-neutral-100 text-xs">
                            {client.email}
                          </span>
                          <div className="flex items-center gap-1.5 text-[10px] font-mono text-neutral-500 mt-0.5">
                            <span className="truncate max-w-[150px]" title={client.uuid || client.subId}>
                              {client.subId || client.uuid}
                            </span>
                            <button
                              onClick={() => handleCopy(client.uuid || client.subId, `id-${client.id}`)}
                              className="text-neutral-500 hover:text-neutral-300 transition"
                              title="Copy identifier"
                            >
                              {copiedKey === `id-${client.id}` ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        </div>
                      </td>

                      {/* Attached Inbounds */}
                      <td className="py-3.5 px-4 font-mono text-xs">
                        <span className="px-2.5 py-1 rounded-lg bg-neutral-900 text-neutral-300 border border-neutral-800 font-medium">
                          {inbound.remark || inbound.tag || `in-${inbound.port}`}
                        </span>
                      </td>

                      {/* Traffic: Bar & Tooltip with Breakdown */}
                      <td className="py-3.5 px-4 font-mono text-xs relative group/traffic">
                        <div className="space-y-1.5 min-w-[180px]">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-neutral-200 font-semibold">{formatBytes(used)}</span>
                            <span className="text-neutral-500 font-mono">
                              {client.total > 0 ? formatBytes(client.total) : '∞'}
                            </span>
                          </div>

                          {/* Progress bar */}
                          <div className="w-full h-1.5 bg-neutral-800/80 rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all duration-300 ${
                                isDepleted 
                                  ? 'bg-rose-500' 
                                  : 'bg-blue-500'
                              }`}
                              style={{ width: `${client.total > 0 ? percent : Math.min(100, (used / (100 * 1024 * 1024 * 1024)) * 100)}%` }}
                            />
                          </div>

                          {/* Subtle Breakdown underneath */}
                          <div className="flex items-center justify-between text-[10px] text-neutral-500 font-mono">
                            <span className="flex items-center gap-0.5 text-neutral-400">
                              <ArrowUpRight className="w-2.5 h-2.5 text-emerald-400" /> {formatBytes(client.up || 0)}
                            </span>
                            <span className="flex items-center gap-0.5 text-neutral-400">
                              <ArrowDownLeft className="w-2.5 h-2.5 text-blue-400" /> {formatBytes(client.down || 0)}
                            </span>
                          </div>
                        </div>

                        {/* Hover Breakdown Tooltip Pill */}
                        <div className="absolute -top-7 left-4 hidden group-hover/traffic:flex items-center gap-3 px-3 py-1 rounded-lg bg-[#0e1017] border border-neutral-800 shadow-2xl text-[11px] font-mono text-neutral-200 pointer-events-none z-30 whitespace-nowrap animate-in fade-in duration-100">
                          <span className="flex items-center gap-1 text-emerald-400">
                            <ArrowUpRight className="w-3 h-3" /> {formatBytes(client.up || 0)}
                          </span>
                          <span className="flex items-center gap-1 text-blue-400">
                            <ArrowDownLeft className="w-3 h-3" /> {formatBytes(client.down || 0)}
                          </span>
                        </div>
                      </td>

                      {/* Speed (Real-time Live Speeds) */}
                      <td className="py-3.5 px-4 font-mono text-xs">
                        {client.isOnline ? (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-900 border border-neutral-800 text-[11px]">
                            <span className="text-emerald-400 flex items-center gap-0.5">
                              <ArrowUpRight className="w-3 h-3" />
                              {formatSpeed(upSpeed)}
                            </span>
                            <span className="text-neutral-600">/</span>
                            <span className="text-blue-400 flex items-center gap-0.5">
                              <ArrowDownLeft className="w-3 h-3" />
                              {formatSpeed(downSpeed)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-neutral-600 pl-4 font-sans">—</span>
                        )}
                      </td>

                      {/* Remaining Traffic */}
                      <td className="py-3.5 px-4 font-mono text-xs text-center">
                        {client.total <= 0 ? (
                          <span className="inline-flex items-center justify-center text-neutral-400 hover:text-neutral-200 font-bold text-sm" title="Unlimited Traffic">
                            ∞
                          </span>
                        ) : isDepleted ? (
                          <span className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[10px] font-semibold">
                            0 B (Depleted)
                          </span>
                        ) : (
                          <span className="text-neutral-300 font-medium">
                            {formatBytes(remainingBytes)}
                          </span>
                        )}
                      </td>

                      {/* Duration / Expiry */}
                      <td className="py-3.5 px-4 font-mono text-xs text-center">
                        {client.expiryTime <= 0 ? (
                          <span className="inline-flex items-center justify-center text-neutral-400 hover:text-neutral-200 font-bold text-sm" title="Never Expires">
                            ∞
                          </span>
                        ) : (
                          <div className="flex flex-col items-center">
                            <span className={`font-semibold ${isExpired ? 'text-rose-400' : 'text-neutral-200'}`}>
                              {durationLabel}
                            </span>
                            <span className="text-[10px] text-neutral-500">{durationSubtitle}</span>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile Card List View (< md screens) */}
        <div className="block md:hidden space-y-3.5">
          {/* Mobile Select All Bar */}
          <div className="p-3 bg-[#0c0d10] border border-neutral-800/80 rounded-2xl flex items-center justify-between text-xs shadow-xs">
            <button
              onClick={handleSelectAll}
              className="flex items-center gap-2 text-neutral-300 hover:text-white font-mono text-xs cursor-pointer select-none transition-colors"
            >
              {selectedIds.length > 0 && selectedIds.length === filtered.length ? (
                <CheckSquare className="w-4 h-4 text-blue-500" />
              ) : (
                <Square className="w-4 h-4 text-neutral-500 hover:text-neutral-400" />
              )}
              <span>Select All ({filtered.length})</span>
            </button>
            {selectedIds.length > 0 && (
              <span className="text-[11px] font-mono text-blue-400 font-medium px-2 py-0.5 rounded-lg bg-blue-500/10 border border-blue-500/20">
                {selectedIds.length} selected
              </span>
            )}
          </div>

          {filtered.map(({ client, inbound }) => {
            const used = (client.up || 0) + (client.down || 0);
            const isDepleted = client.total > 0 && used >= client.total;
            const isExpired = client.expiryTime > 0 && now > client.expiryTime;
            const isSelected = selectedIds.includes(client.id);
            const remainingBytes = client.total > 0 ? Math.max(0, client.total - used) : 0;

            let durationLabel = '∞';
            if (client.expiryTime > 0) {
              const diffSec = client.expiryTime - now;
              if (diffSec <= 0) {
                durationLabel = 'Expired';
              } else {
                const diffDays = Math.floor(diffSec / 86400);
                const diffHours = Math.floor((diffSec % 86400) / 3600);
                durationLabel = diffDays > 0 ? `${diffDays}d left` : `${diffHours}h left`;
              }
            }

            const percent = client.total > 0 ? Math.min(100, Math.round((used / client.total) * 100)) : 0;
            const upSpeed = client.upSpeed || 0;
            const downSpeed = client.downSpeed || 0;

            return (
              <div
                key={`mobile-${client.id}`}
                className={`p-4 rounded-2xl border transition-all duration-200 space-y-3.5 shadow-xs ${
                  isSelected
                    ? 'bg-[#0f141f] border-blue-500/50 ring-1 ring-blue-500/20 shadow-md shadow-blue-500/5'
                    : 'bg-[#0c0d10] border-neutral-800/80 hover:border-neutral-700 hover:bg-[#0e0f14] hover:shadow-lg hover:shadow-black/25'
                }`}
              >
                {/* Top Row: Checkbox, Name, Online Badge, Switch */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <button
                      onClick={() => handleToggleSelect(client.id)}
                      className="p-1 -ml-1 text-neutral-500 hover:text-white hover:bg-neutral-800/60 rounded-lg transition-all duration-150 cursor-pointer active:scale-90 mt-0.5"
                      title={isSelected ? 'Deselect client' : 'Select client'}
                    >
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-blue-500" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <div
                          onClick={() => handleCopy(client.email, `email-${client.id}`)}
                          className="group/name cursor-pointer inline-flex items-center gap-1.5 select-none"
                          title="Click to copy username"
                        >
                          <span className="font-semibold text-white text-sm tracking-tight group-hover/name:text-blue-400 transition-colors">
                            {client.email}
                          </span>
                          {copiedKey === `email-${client.id}` ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400 animate-in zoom-in-50 duration-150" />
                          ) : (
                            <Copy className="w-3.5 h-3.5 text-neutral-600 opacity-0 group-hover/name:opacity-100 group-hover/name:text-neutral-300 transition-all duration-150" />
                          )}
                        </div>
                        {client.isOnline ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 hover:border-emerald-500/40 hover:scale-105 transition-all select-none cursor-default">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            Online
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono text-neutral-500 bg-neutral-900 border border-neutral-800 hover:border-neutral-700 hover:text-neutral-400 transition-all select-none cursor-default">
                            <span className="w-1.5 h-1.5 rounded-full bg-neutral-600"></span>
                            Offline
                          </span>
                        )}
                      </div>
                      {/* Attached Inbound Pill */}
                      <div className="flex items-center gap-1.5 text-[11px] font-mono text-neutral-400 mt-1.5 flex-wrap">
                        <button
                          onClick={() => handleCopy(String(inbound.port), `port-${client.id}`)}
                          className="px-2 py-0.5 rounded bg-neutral-900 hover:bg-neutral-800 text-neutral-200 hover:text-blue-400 border border-neutral-800 hover:border-neutral-750 font-bold active:scale-95 transition-all cursor-pointer"
                          title="Click to copy port"
                        >
                          :{inbound.port}
                        </button>
                        <span
                          className="truncate max-w-[140px] text-neutral-400 hover:text-neutral-200 cursor-default transition-colors"
                          title={inbound.remark || inbound.tag}
                        >
                          {inbound.remark || inbound.tag}
                        </span>
                        <span className="uppercase text-[9px] px-1.5 py-0.5 rounded bg-neutral-900 text-neutral-300 border border-neutral-800 hover:border-neutral-700 hover:text-white transition-colors cursor-default select-none font-medium">
                          {inbound.protocol}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Enabled Switch */}
                  <button
                    type="button"
                    onClick={() => handleToggleEnable(client)}
                    disabled={togglingClientId === client.id}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-all duration-200 ease-in-out focus:outline-none hover:ring-2 hover:ring-blue-500/40 hover:scale-105 active:scale-95 ${
                      client.enable ? 'bg-blue-600' : 'bg-neutral-800 hover:bg-neutral-750'
                    } ${togglingClientId === client.id ? 'opacity-50' : ''}`}
                    title={client.enable ? 'Click to disable client' : 'Click to enable client'}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                        client.enable ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Speed Row (when online) */}
                {client.isOnline && (
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-neutral-950/80 border border-neutral-850 hover:border-neutral-750 hover:bg-neutral-900/50 transition-all text-xs font-mono cursor-default">
                    <span className="text-neutral-400 flex items-center gap-1.5 text-[11px]">
                      <Activity className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                      Live Speed:
                    </span>
                    <div className="flex items-center gap-2 text-[11px]">
                      <span className="text-emerald-400 hover:brightness-125 transition-all flex items-center gap-0.5">
                        <ArrowUpRight className="w-3 h-3" />
                        {formatSpeed ? formatSpeed(upSpeed) : formatBytes(upSpeed) + '/s'}
                      </span>
                      <span className="text-neutral-600">/</span>
                      <span className="text-blue-400 hover:brightness-125 transition-all flex items-center gap-0.5">
                        <ArrowDownLeft className="w-3 h-3" />
                        {formatSpeed ? formatSpeed(downSpeed) : formatBytes(downSpeed) + '/s'}
                      </span>
                    </div>
                  </div>
                )}

                {/* Traffic Bar */}
                <div className="p-2.5 rounded-xl bg-neutral-950/50 border border-neutral-850/60 hover:border-neutral-750 hover:bg-neutral-950/80 transition-all duration-150 space-y-2 cursor-default group/traffic">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-neutral-400 group-hover/traffic:text-neutral-300 transition-colors">Traffic:</span>
                    <span className="text-neutral-200 group-hover/traffic:text-white transition-colors font-medium">
                      {formatBytes(used)} / {client.total > 0 ? formatBytes(client.total) : '∞'}
                      {client.total > 0 && <span className="text-neutral-500 text-[10px] ml-1">({percent}%)</span>}
                    </span>
                  </div>
                  <div className="w-full bg-neutral-800/80 h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        isDepleted
                          ? 'bg-rose-500'
                          : percent > 85
                          ? 'bg-amber-400'
                          : 'bg-blue-500'
                      }`}
                      style={{ width: `${client.total > 0 ? percent : Math.min(100, (used / (100 * 1024 * 1024 * 1024)) * 100)}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] font-mono text-neutral-500">
                    <span className="flex items-center gap-1 hover:text-emerald-400 transition-colors">
                      <ArrowUpRight className="w-2.5 h-2.5 text-emerald-400" /> {formatBytes(client.up || 0)}
                    </span>
                    <span className="flex items-center gap-1 hover:text-blue-400 transition-colors">
                      <ArrowDownLeft className="w-2.5 h-2.5 text-blue-400" /> {formatBytes(client.down || 0)}
                    </span>
                  </div>
                </div>

                {/* Remaining & Duration Chips */}
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="p-2.5 rounded-xl bg-neutral-950/70 border border-neutral-850/80 hover:border-neutral-700 hover:bg-neutral-900/70 hover:shadow-xs transition-all duration-150 cursor-default group/quota">
                    <span className="text-[10px] text-neutral-500 group-hover/quota:text-neutral-400 transition-colors block">Remaining Quota</span>
                    <span className={`font-medium transition-colors ${isDepleted ? 'text-rose-400' : 'text-neutral-200 group-hover/quota:text-white'}`}>
                      {client.total > 0 ? formatBytes(remainingBytes) : '∞ Unlimited'}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-neutral-950/70 border border-neutral-850/80 hover:border-neutral-700 hover:bg-neutral-900/70 hover:shadow-xs transition-all duration-150 cursor-default group/dur">
                    <span className="text-[10px] text-neutral-500 group-hover/dur:text-neutral-400 transition-colors block">Duration / Expiry</span>
                    <span className={`font-medium transition-colors ${isExpired ? 'text-rose-400' : 'text-neutral-200 group-hover/dur:text-white'}`}>
                      {durationLabel}
                    </span>
                  </div>
                </div>

                {/* Mobile Action Buttons */}
                <div className="flex items-center justify-between pt-2.5 border-t border-neutral-850/80">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onShareClient(client, inbound)}
                      className="px-3 py-1.5 rounded-xl bg-neutral-900/90 hover:bg-neutral-800 text-neutral-200 hover:text-white text-xs font-medium flex items-center gap-1.5 border border-neutral-800 hover:border-neutral-700 transition-all duration-150 cursor-pointer active:scale-95 hover:shadow-sm group/btn"
                    >
                      <QrCode className="w-3.5 h-3.5 text-neutral-400 group-hover/btn:text-white group-hover/btn:scale-110 transition-all" />
                      <span>QR & Link</span>
                    </button>

                    <button
                      onClick={() => setInspectClient({ client, inbound })}
                      className="px-3 py-1.5 rounded-xl bg-neutral-900/90 hover:bg-neutral-800 text-neutral-200 hover:text-blue-400 text-xs font-medium flex items-center gap-1.5 border border-neutral-800 hover:border-neutral-700 transition-all duration-150 cursor-pointer active:scale-95 hover:shadow-sm group/btn"
                    >
                      <Info className="w-3.5 h-3.5 text-blue-400 group-hover/btn:scale-110 transition-transform" />
                      <span>Details</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onResetClientTraffic(client.id)}
                      title="Reset Traffic Counters"
                      className="p-2 rounded-xl text-neutral-400 hover:text-amber-400 hover:bg-amber-500/10 hover:border-amber-500/20 border border-transparent transition-all duration-150 cursor-pointer active:scale-90 hover:scale-110"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => onOpenEditClient(client)}
                      title="Edit Client"
                      className="p-2 rounded-xl text-neutral-400 hover:text-blue-400 hover:bg-blue-500/10 hover:border-blue-500/20 border border-transparent transition-all duration-150 cursor-pointer active:scale-90 hover:scale-110"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => onDeleteClient(client.id)}
                      title="Delete Client"
                      className="p-2 rounded-xl text-neutral-400 hover:text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/20 border border-transparent transition-all duration-150 cursor-pointer active:scale-90 hover:scale-110"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </>
    )}

      {/* 4. Client Details Inspection Modal */}
      {inspectClient && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0c0d10] border border-neutral-800 rounded-2xl w-full max-w-xl shadow-2xl p-6 relative flex flex-col max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-300">
                  <Info className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    {inspectClient.client.email}
                    {inspectClient.client.isOnline ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        Online Now
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-neutral-900 text-neutral-500 border border-neutral-800">
                        Offline
                      </span>
                    )}
                  </h3>
                  <span className="text-xs text-neutral-500 font-sans">Client Telemetry & Credentials</span>
                </div>
              </div>

              <button
                onClick={() => setInspectClient(null)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-900 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content Details Grid */}
            <div className="space-y-3.5 my-5 text-xs font-mono">
              {/* Account Credentials */}
              <div className="p-3.5 rounded-xl bg-neutral-950 border border-neutral-850 space-y-2">
                <span className="text-[11px] font-sans font-semibold text-neutral-400 block uppercase tracking-wider">
                  Authentication Keys
                </span>
                <div className="flex items-center justify-between py-1 border-b border-neutral-850">
                  <span className="text-neutral-500">UUID / Pass:</span>
                  <div className="flex items-center gap-2 text-neutral-200">
                    <span className="break-all">{inspectClient.client.uuid || inspectClient.client.password || '—'}</span>
                    <button
                      onClick={() => handleCopy(inspectClient.client.uuid || inspectClient.client.password || '', 'modal-uuid')}
                      className="text-neutral-500 hover:text-neutral-200"
                    >
                      {copiedKey === 'modal-uuid' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {inspectClient.client.subId && (
                  <div className="flex items-center justify-between py-1 border-b border-neutral-850">
                    <span className="text-neutral-500">Sub ID:</span>
                    <span className="text-neutral-200">{inspectClient.client.subId}</span>
                  </div>
                )}

                {inspectClient.client.flow && (
                  <div className="flex items-center justify-between py-1">
                    <span className="text-neutral-500">Flow:</span>
                    <span className="text-blue-400">{inspectClient.client.flow}</span>
                  </div>
                )}
              </div>

              {/* Inbound Route Details */}
              <div className="p-3.5 rounded-xl bg-neutral-950 border border-neutral-850 space-y-2">
                <span className="text-[11px] font-sans font-semibold text-neutral-400 block uppercase tracking-wider">
                  Inbound Binding
                </span>
                <div className="flex items-center justify-between py-1 border-b border-neutral-850">
                  <span className="text-neutral-500">Inbound Tag:</span>
                  <span className="text-neutral-200">{inspectClient.inbound.remark || inspectClient.inbound.tag}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-neutral-850">
                  <span className="text-neutral-500">Port & Protocol:</span>
                  <span className="text-blue-400">
                    :{inspectClient.inbound.port} ({inspectClient.inbound.protocol.toUpperCase()})
                  </span>
                </div>
              </div>

              {/* Bandwidth Breakdown */}
              <div className="p-3.5 rounded-xl bg-neutral-950 border border-neutral-850 space-y-2">
                <span className="text-[11px] font-sans font-semibold text-neutral-400 block uppercase tracking-wider">
                  Traffic & Quotas
                </span>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="p-2.5 rounded-lg bg-neutral-900 border border-neutral-800">
                    <span className="text-[10px] text-neutral-500 block">Uploaded</span>
                    <span className="text-sm font-semibold text-emerald-400">{formatBytes(inspectClient.client.up || 0)}</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-neutral-900 border border-neutral-800">
                    <span className="text-[10px] text-neutral-500 block">Downloaded</span>
                    <span className="text-sm font-semibold text-blue-400">{formatBytes(inspectClient.client.down || 0)}</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-neutral-900 border border-neutral-800">
                    <span className="text-[10px] text-neutral-500 block">Total Quota</span>
                    <span className="text-sm font-semibold text-neutral-200">
                      {inspectClient.client.total > 0 ? formatBytes(inspectClient.client.total) : 'Unlimited'}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-neutral-900 border border-neutral-800">
                    <span className="text-[10px] text-neutral-500 block">Remaining</span>
                    <span className="text-sm font-semibold text-neutral-200">
                      {inspectClient.client.total > 0 ? formatBytes(Math.max(0, inspectClient.client.total - ((inspectClient.client.up || 0) + (inspectClient.client.down || 0)))) : '∞'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Live Rate */}
              {inspectClient.client.isOnline && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
                  <span className="text-emerald-300">Live Active Speed:</span>
                  <div className="flex items-center gap-3 font-semibold text-white">
                    <span className="text-emerald-400 flex items-center gap-1">
                      <ArrowUpRight className="w-3.5 h-3.5" />
                      {formatSpeed(inspectClient.client.upSpeed || 0)}
                    </span>
                    <span className="text-blue-400 flex items-center gap-1">
                      <ArrowDownLeft className="w-3.5 h-3.5" />
                      {formatSpeed(inspectClient.client.downSpeed || 0)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer Controls */}
            <div className="pt-3 border-t border-neutral-800 flex items-center justify-end gap-2.5">
              <button
                onClick={() => {
                  onShareClient(inspectClient.client, inspectClient.inbound);
                  setInspectClient(null);
                }}
                className="px-4 py-2 rounded-xl bg-white hover:bg-neutral-200 text-neutral-950 font-semibold text-xs flex items-center gap-1.5 transition shadow-sm"
              >
                <QrCode className="w-4 h-4" />
                <span>Show QR Code</span>
              </button>
              <button
                onClick={() => setInspectClient(null)}
                className="px-4 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 font-medium text-xs transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
