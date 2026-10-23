import React, { useState } from 'react';
import { 
  Users, 
  Plus, 
  Trash2, 
  Edit, 
  RotateCcw, 
  Share2, 
  QrCode, 
  Power, 
  Search, 
  Clock, 
  ArrowUpRight, 
  ArrowDownLeft,
  CheckSquare,
  Square
} from 'lucide-react';
import { Client, Inbound } from '../types';

interface ClientsPageProps {
  inbounds: Inbound[];
  onOpenAddClient: () => void;
  onOpenEditClient: (client: Client) => void;
  onDeleteClient: (id: number) => void;
  onResetClientTraffic: (id: number) => void;
  onShareClient: (client: Client, inbound: Inbound) => void;
  formatBytes: (bytes: number) => string;
}

export const ClientsPage: React.FC<ClientsPageProps> = ({
  inbounds,
  onOpenAddClient,
  onOpenEditClient,
  onDeleteClient,
  onResetClientTraffic,
  onShareClient,
  formatBytes,
}) => {
  const [search, setSearch] = useState<string>('');
  const [filterInbound, setFilterInbound] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all'); // all, online, active, depleted, expired

  // Flatten all clients with their respective inbounds
  const allClients: { client: Client; inbound: Inbound }[] = [];
  inbounds.forEach((inb) => {
    (inb.clients || []).forEach((c) => {
      allClients.push({ client: c, inbound: inb });
    });
  });

  const now = Math.floor(Date.now() / 1000);

  const filtered = allClients.filter(({ client, inbound }) => {
    if (filterInbound !== 'all' && inbound.id.toString() !== filterInbound) {
      return false;
    }

    const isDepleted = client.total > 0 && (client.up + client.down) >= client.total;
    const isExpired = client.expiryTime > 0 && now > client.expiryTime;

    if (filterStatus === 'online' && !client.isOnline) return false;
    if (filterStatus === 'depleted' && !isDepleted) return false;
    if (filterStatus === 'expired' && !isExpired) return false;
    if (filterStatus === 'active' && (!client.enable || isDepleted || isExpired)) return false;

    if (search.trim()) {
      const q = search.toLowerCase();
      const matchEmail = client.email.toLowerCase().includes(q);
      const matchUUID = client.uuid.toLowerCase().includes(q);
      const matchInb = (inbound.remark || inbound.tag).toLowerCase().includes(q);
      return matchEmail || matchUUID || matchInb;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Search & Actions Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 flex-1 max-w-2xl">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search clients by email, UUID, or tag..."
              className="w-full pl-9.5 pr-4 py-2 bg-[#14171e] border border-white/[0.08] rounded-xl text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-cyan-500/50 transition font-sans"
            />
          </div>

          {/* Inbound Filter */}
          <select
            value={filterInbound}
            onChange={(e) => setFilterInbound(e.target.value)}
            className="px-3 py-2 bg-[#14171e] border border-white/[0.08] rounded-xl text-xs text-zinc-300 focus:outline-none focus:border-cyan-500/50 transition font-sans"
          >
            <option value="all">All Inbounds</option>
            {inbounds.map((i) => (
              <option key={i.id} value={i.id.toString()}>
                {i.remark || i.tag} (:{i.port})
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 bg-[#14171e] border border-white/[0.08] rounded-xl text-xs text-zinc-300 focus:outline-none focus:border-cyan-500/50 transition font-sans"
          >
            <option value="all">All Statuses</option>
            <option value="online">Online Now</option>
            <option value="active">Active</option>
            <option value="depleted">Traffic Depleted</option>
            <option value="expired">Expired</option>
          </select>
        </div>

        {/* Create Client Button */}
        <button
          onClick={onOpenAddClient}
          className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-medium rounded-xl text-xs flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(6,182,212,0.3)] transition transform active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>New Client</span>
        </button>
      </div>

      {/* Clients Table Card */}
      <div className="bg-[#0a0d16]/75 backdrop-blur-xl border border-white/[0.08] rounded-2xl shadow-xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-20 text-center text-zinc-500 text-xs font-sans">
            <Users className="w-10 h-10 text-zinc-600 mx-auto mb-3 opacity-60" />
            <span>No client accounts found matching the criteria.</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/[0.06] text-zinc-500 font-mono uppercase tracking-wider text-[11px] bg-white/[0.01]">
                  <th className="py-3 px-4">Client Email</th>
                  <th className="py-3 px-4">Inbound Route</th>
                  <th className="py-3 px-4">Traffic (Used / Total)</th>
                  <th className="py-3 px-4">Expiry</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03]">
                {filtered.map(({ client, inbound }) => {
                  const used = client.up + client.down;
                  const isDepleted = client.total > 0 && used >= client.total;
                  const isExpired = client.expiryTime > 0 && now > client.expiryTime;

                  let expiryLabel = 'Never';
                  if (client.expiryTime > 0) {
                    const diffDays = Math.ceil((client.expiryTime - now) / 86400);
                    expiryLabel = diffDays > 0 ? `${diffDays} days left` : 'Expired';
                  }

                  return (
                    <tr key={client.id} className="hover:bg-white/[0.02] transition group">
                      {/* Email and Online Indicator */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              client.isOnline
                                ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]'
                                : 'bg-zinc-600'
                            }`}
                            title={client.isOnline ? 'Connected & Online' : 'Offline'}
                          ></span>
                          <div>
                            <span className="font-semibold text-zinc-100 font-sans block">
                              {client.email}
                            </span>
                            <span className="text-[10px] font-mono text-zinc-500 block truncate max-w-[160px]">
                              {client.uuid}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Inbound Tag */}
                      <td className="py-3.5 px-4 font-mono">
                        <div className="flex items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded bg-white/5 text-zinc-300 border border-white/5">
                            {inbound.remark || inbound.tag}
                          </span>
                          <span className="text-[10px] text-zinc-500">:{inbound.port}</span>
                        </div>
                      </td>

                      {/* Traffic Bar */}
                      <td className="py-3.5 px-4 font-mono">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-zinc-300">{formatBytes(used)}</span>
                            <span className="text-zinc-500">
                              {client.total > 0 ? formatBytes(client.total) : 'Unlimited'}
                            </span>
                          </div>
                          {client.total > 0 && (
                            <div className="w-32 h-1 bg-zinc-800 rounded-full overflow-hidden">
                              <div
                                className={`h-full ${
                                  isDepleted ? 'bg-rose-500' : 'bg-gradient-to-r from-cyan-400 to-emerald-400'
                                }`}
                                style={{ width: `${Math.min(100, (used / client.total) * 100)}%` }}
                              ></div>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Expiry */}
                      <td className="py-3.5 px-4 font-mono text-xs">
                        <span className={isExpired ? 'text-rose-400 font-semibold' : 'text-zinc-400'}>
                          {expiryLabel}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold font-mono ${
                            client.isOnline
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : isExpired || isDepleted || !client.enable
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              : 'bg-zinc-800 text-zinc-400 border border-white/5'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              client.isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-500'
                            }`}
                          ></span>
                          <span>
                            {client.isOnline
                              ? 'Online'
                              : isExpired
                              ? 'Expired'
                              : isDepleted
                              ? 'Depleted'
                              : client.enable
                              ? 'Active'
                              : 'Disabled'}
                          </span>
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => onShareClient(client, inbound)}
                            title="Share / QR"
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition"
                          >
                            <QrCode className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onResetClientTraffic(client.id)}
                            title="Reset Traffic"
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-amber-400 hover:bg-amber-500/10 transition"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onOpenEditClient(client)}
                            title="Edit Client"
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-cyan-400 hover:bg-cyan-500/10 transition"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onDeleteClient(client.id)}
                            title="Delete Client"
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
