import React, { useState } from 'react';
import { 
  Radio, 
  Plus, 
  Trash2, 
  Edit, 
  Copy, 
  Power, 
  RotateCcw, 
  Share2, 
  Check, 
  QrCode,
  Shield,
  Layers,
  Search,
  Filter
} from 'lucide-react';
import { Inbound } from '../types';

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
}

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
}) => {
  const [filterProtocol, setFilterProtocol] = useState<string>('all');
  const [search, setSearch] = useState<string>('');

  const filteredInbounds = inbounds.filter((inb) => {
    if (filterProtocol !== 'all' && inb.protocol.toLowerCase() !== filterProtocol.toLowerCase()) {
      return false;
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchTag = inb.tag.toLowerCase().includes(q);
      const matchRemark = (inb.remark || '').toLowerCase().includes(q);
      const matchPort = inb.port.toString().includes(q);
      const matchProto = inb.protocol.toLowerCase().includes(q);
      return matchTag || matchRemark || matchPort || matchProto;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Header & Actions Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        {/* Search & Filter pills */}
        <div className="flex items-center gap-3 flex-1 max-w-xl">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search inbounds by port, tag, remark..."
              className="w-full pl-9.5 pr-4 py-2 bg-white/[0.03] border border-white/[0.08] rounded-xl text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-[#3d445c] transition font-sans"
            />
          </div>

          {/* Protocol Dropdown */}
          <select
            value={filterProtocol}
            onChange={(e) => setFilterProtocol(e.target.value)}
            className="px-3 py-2 bg-white/[0.03] border border-white/[0.08] rounded-xl text-xs text-zinc-300 focus:outline-none focus:border-[#3d445c] transition font-mono uppercase"
          >
            <option value="all">All Protocols</option>
            <option value="vless">VLESS</option>
            <option value="trojan">TROJAN</option>
            <option value="vmess">VMESS</option>
            <option value="shadowsocks">SHADOWSOCKS</option>
            <option value="wireguard">WIREGUARD</option>
            <option value="hysteria">HYSTERIA 2</option>
            <option value="dokodemo-door">DOKODEMO</option>
            <option value="socks">SOCKS5</option>
            <option value="http">HTTP</option>
          </select>
        </div>

        {/* Create Inbound Primary Button */}
        <button
          onClick={onOpenAddModal}
          className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-medium rounded-xl text-xs flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.3)] transition transform active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>New Inbound Listener</span>
        </button>
      </div>

      {/* Inbounds Cards Grid */}
      {filteredInbounds.length === 0 ? (
        <div className="py-20 text-center bg-[#0c0d13]/85 backdrop-blur-xl border border-white/[0.08] hover:border-white/[0.16] shadow-xl rounded-2xl p-8">
          <Radio className="w-10 h-10 text-zinc-600 mx-auto mb-3 animate-pulse" />
          <h3 className="text-base font-bold text-zinc-300">No Inbounds Found</h3>
          <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
            {search || filterProtocol !== 'all' 
              ? 'No inbounds matched your current filter criteria.' 
              : 'You have not configured any proxy listener inbounds yet. Click the button above to add one.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredInbounds.map((inb) => {
            let network = 'tcp';
            let security = 'none';
            try {
              const ss = JSON.parse(inb.streamSettings || '{}');
              network = ss.network || 'tcp';
              security = ss.security || 'none';
            } catch (e) {}

            const clientCount = inb.clients ? inb.clients.length : 0;
            const onlineCount = (inb.clients || []).filter((c) => c.isOnline).length;

            return (
              <div
                key={inb.id}
                className="bg-[#0c0d13]/85 backdrop-blur-xl border border-white/[0.08] hover:border-white/[0.16] shadow-xl hover:border-white/[0.16] rounded-2xl p-5 shadow-xl flex flex-col justify-between transition-all group relative overflow-hidden"
              >
                {/* Protocol Accent Color Stripe */}
                <div
                  className={`absolute top-0 left-0 right-0 h-1 ${
                    inb.enable ? 'bg-gradient-to-r from-cyan-500 to-emerald-500' : 'bg-zinc-700'
                  }`}
                ></div>

                {/* Card Header: Remark, Port & Status */}
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-bold text-white tracking-wide truncate max-w-[170px]">
                        {inb.remark || inb.tag}
                      </h3>
                      <span className="text-[11px] font-mono text-zinc-500">{inb.tag}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="font-mono text-base font-bold text-white bg-white/[0.04] px-2.5 py-1 rounded-lg border border-white/[0.06]">
                        :{inb.port}
                      </span>
                    </div>
                  </div>

                  {/* Badges Row: Protocol, Network, Security */}
                  <div className="flex flex-wrap items-center gap-1.5 my-3.5">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                      {inb.protocol}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-white/5 text-zinc-300 border border-white/5">
                      {network}
                    </span>
                    {security !== 'none' && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                        <Shield className="w-2.5 h-2.5" />
                        <span>{security}</span>
                      </span>
                    )}
                    {inb.listen && inb.listen !== '0.0.0.0' && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-zinc-800 text-zinc-400">
                        {inb.listen}
                      </span>
                    )}
                  </div>

                  {/* Traffic Stats Bar */}
                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] space-y-1.5 text-xs font-mono">
                    <div className="flex items-center justify-between text-zinc-400">
                      <span className="text-zinc-500">Up / Down:</span>
                      <span className="text-zinc-200">
                        {formatBytes(inb.up || 0)} / {formatBytes(inb.down || 0)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-zinc-400">
                      <span className="text-zinc-500">Active Clients:</span>
                      <span className="flex items-center gap-1">
                        <span className="text-zinc-300">{clientCount}</span>
                        {onlineCount > 0 && (
                          <span className="text-emerald-400 font-semibold text-[11px]">
                            ({onlineCount} live)
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bottom Actions Row */}
                <div className="pt-4 mt-4 border-t border-white/[0.06] flex items-center justify-between">
                  {/* Enable / Disable Switch */}
                  <button
                    onClick={() => onToggleEnable(inb)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition border ${
                      inb.enable
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                        : 'bg-zinc-800/80 text-zinc-400 border-zinc-700 hover:bg-zinc-800'
                    }`}
                  >
                    <Power className="w-3.5 h-3.5" />
                    <span>{inb.enable ? 'Active' : 'Disabled'}</span>
                  </button>

                  {/* Action Icons */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onShareInbound(inb)}
                      title="Share / QR"
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition"
                    >
                      <QrCode className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onCloneInbound(inb.id)}
                      title="Clone Inbound"
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onResetTraffic(inb.id)}
                      title="Reset Traffic"
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-amber-400 hover:bg-amber-500/10 transition"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onOpenEditModal(inb)}
                      title="Edit Settings"
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-cyan-400 hover:bg-cyan-500/10 transition"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onDeleteInbound(inb.id)}
                      title="Delete"
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
