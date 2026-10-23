import React, { useState, useEffect } from 'react';
import { X, AlertCircle, Key, RefreshCw, Shield, Sparkles } from 'lucide-react';
import api from '../services/api';
import { Inbound } from '../types';
import { useNotification } from '../context/NotificationContext';

interface InboundModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  inboundToEdit?: Inbound | null;
}

export const InboundModal: React.FC<InboundModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  inboundToEdit,
}) => {
  const { notify } = useNotification();
  const [activeTab, setActiveTab] = useState<'basics' | 'transport' | 'security'>('basics');
  
  // Basics Form
  const [remark, setRemark] = useState('');
  const [port, setPort] = useState<number>(443);
  const [listen, setListen] = useState('0.0.0.0');
  const [protocol, setProtocol] = useState('vless');
  const [totalGB, setTotalGB] = useState<number>(0);
  const [expiryDays, setExpiryDays] = useState<number>(0);

  // Transport
  const [network, setNetwork] = useState('tcp');
  const [wsPath, setWsPath] = useState('/vless-ws');
  const [wsHost, setWsHost] = useState('');
  const [grpcServiceName, setGrpcServiceName] = useState('vless-grpc');

  // Security
  const [security, setSecurity] = useState('tls'); // none, tls, reality
  const [tlsSNI, setTlsSNI] = useState('');
  const [tlsALPN, setTlsALPN] = useState('h2,http/1.1');

  // REALITY
  const [realityDest, setRealityDest] = useState('www.google.com:443');
  const [realityServerNames, setRealityServerNames] = useState('www.google.com');
  const [realityPrivKey, setRealityPrivKey] = useState('');
  const [realityPubKey, setRealityPubKey] = useState('');
  const [realityShortId, setRealityShortId] = useState('');

  // Real-time Port Collision Detection state
  const [portConflict, setPortConflict] = useState<string | null>(null);
  const [isCheckingPort, setIsCheckingPort] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Populate data when editing
  useEffect(() => {
    if (inboundToEdit) {
      setRemark(inboundToEdit.remark || inboundToEdit.tag || '');
      setPort(inboundToEdit.port);
      setListen(inboundToEdit.listen || '0.0.0.0');
      setProtocol(inboundToEdit.protocol || 'vless');
      setTotalGB(inboundToEdit.total ? Number((inboundToEdit.total / (1024 ** 3)).toFixed(2)) : 0);
      
      try {
        const ss = JSON.parse(inboundToEdit.streamSettings || '{}');
        setNetwork(ss.network || 'tcp');
        setSecurity(ss.security || 'none');
        if (ss.wsSettings) {
          setWsPath(ss.wsSettings.path || '/vless-ws');
          setWsHost(ss.wsSettings.headers?.Host || ss.wsSettings.host || '');
        }
        if (ss.grpcSettings) {
          setGrpcServiceName(ss.grpcSettings.serviceName || 'vless-grpc');
        }
        if (ss.tlsSettings) {
          setTlsSNI(ss.tlsSettings.serverName || '');
          setTlsALPN(Array.isArray(ss.tlsSettings.alpn) ? ss.tlsSettings.alpn.join(',') : 'h2,http/1.1');
        }
        if (ss.realitySettings) {
          setRealityDest(ss.realitySettings.dest || 'www.google.com:443');
          setRealityServerNames(ss.realitySettings.serverNames?.join(',') || 'www.google.com');
          setRealityPrivKey(ss.realitySettings.privateKey || '');
          setRealityPubKey(ss.realitySettings.settings?.publicKey || '');
          setRealityShortId(ss.realitySettings.shortIds?.[0] || '');
        }
      } catch (e) {}
    } else {
      // New Inbound default
      setRemark('VLESS-TLS-' + Math.floor(Math.random() * 900 + 100));
      setPort(2053);
      setListen('0.0.0.0');
      setProtocol('vless');
      setNetwork('tcp');
      setSecurity('tls');
      handleGenerateRealityKeys();
    }
  }, [inboundToEdit, isOpen]);

  // Debounced Live Port Check against Server
  useEffect(() => {
    if (!port || port <= 0 || port > 65535) {
      setPortConflict('Invalid port number');
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsCheckingPort(true);
        const query = new URLSearchParams({
          port: port.toString(),
          protocol: protocol,
          streamSettings: JSON.stringify({ network }),
          listen,
          ignoreId: inboundToEdit ? inboundToEdit.id.toString() : '0',
        });
        const res = await api.get(`/api/inbounds/check-port?${query.toString()}`);
        if (res.data && !res.data.available) {
          setPortConflict(res.data.message || `Port ${port} is not available.`);
        } else {
          setPortConflict(null);
        }
      } catch (e) {
        // ignore
      } finally {
        setIsCheckingPort(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [port, protocol, network, listen, inboundToEdit]);

  const handleGenerateRealityKeys = async () => {
    try {
      const res = await api.get('/api/crypto/reality-keys');
      if (res.data) {
        setRealityPrivKey(res.data.privateKey || '');
        setRealityPubKey(res.data.publicKey || '');
        setRealityShortId(res.data.shortId || '');
      }
    } catch (e) {}
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (portConflict) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    const streamSettingsObj: any = {
      network,
      security,
    };

    if (network === 'ws') {
      streamSettingsObj.wsSettings = {
        path: wsPath,
        headers: { Host: wsHost },
      };
    } else if (network === 'grpc') {
      streamSettingsObj.grpcSettings = {
        serviceName: grpcServiceName,
      };
    }

    if (security === 'tls') {
      streamSettingsObj.tlsSettings = {
        serverName: tlsSNI,
        alpn: tlsALPN.split(',').map((s) => s.trim()).filter(Boolean),
        minVersion: '1.2',
        maxVersion: '1.3',
      };
    } else if (security === 'reality') {
      streamSettingsObj.realitySettings = {
        show: false,
        xver: 0,
        dest: realityDest,
        serverNames: realityServerNames.split(',').map((s) => s.trim()).filter(Boolean),
        privateKey: realityPrivKey,
        shortIds: [realityShortId],
        settings: {
          publicKey: realityPubKey,
          fingerprint: 'chrome',
          spiderX: '/',
        },
      };
    }

    const payload: any = {
      port: Number(port),
      protocol,
      remark,
      tag: `in-${port}`,
      listen,
      total: totalGB > 0 ? Math.floor(totalGB * 1024 ** 3) : 0,
      expiryTime: expiryDays > 0 ? Math.floor(Date.now() / 1000) + expiryDays * 86400 : 0,
      settings: JSON.stringify({ clients: [], decryption: 'none', fallbacks: [] }),
      streamSettings: JSON.stringify(streamSettingsObj),
      sniffing: JSON.stringify({ enabled: true, destOverride: ['http', 'tls', 'quic', 'fakedns'] }),
    };

    try {
      let endpoint = '/api/inbounds/create';
      if (inboundToEdit) {
        payload.id = inboundToEdit.id;
        endpoint = `/api/inbounds/update/${inboundToEdit.id}`;
      }

      const res = await api.post(endpoint, payload);
      if (res.data && res.data.success) {
        notify.success('Inbound Saved', inboundToEdit ? 'Inbound listener updated successfully.' : 'New inbound listener created successfully.');
        onSaved();
        onClose();
      } else {
        const msg = res.data?.message || 'Failed to save inbound listener';
        setErrorMessage(msg);
        notify.error('Save Failed', msg);
      }
    } catch (e: any) {
      const msg = e.response?.data?.message || 'Error communicating with server';
      setErrorMessage(msg);
      notify.error('Save Error', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#0c0d13]/95 backdrop-blur-2xl border border-white/[0.1] rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white">
              {inboundToEdit ? 'Edit Inbound Listener' : 'Create New Inbound Listener'}
            </h3>
            <span className="text-xs text-zinc-400">Configure proxy port, transport, and encryption</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-white/[0.06] px-6 bg-[#08090d]">
          <button
            type="button"
            onClick={() => setActiveTab('basics')}
            className={`py-3 px-4 text-xs font-medium border-b-2 transition ${
              activeTab === 'basics'
                ? 'border-cyan-400 text-white'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            1. Basics & Port
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('transport')}
            className={`py-3 px-4 text-xs font-medium border-b-2 transition ${
              activeTab === 'transport'
                ? 'border-cyan-400 text-white'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            2. Transport Network
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('security')}
            className={`py-3 px-4 text-xs font-medium border-b-2 transition ${
              activeTab === 'security'
                ? 'border-cyan-400 text-white'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            3. Security (TLS / REALITY)
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 flex-1">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-mono flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {activeTab === 'basics' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">Inbound Remark</label>
                <input
                  type="text"
                  required
                  value={remark}
                  onChange={(e) => setRemark(e.target.value)}
                  placeholder="e.g. VLESS-TLS-CDN"
                  className="w-full px-3.5 py-2 bg-[#08090d] border border-white/[0.08] rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500/50"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Port with Live Collision Feedback */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-medium text-zinc-300">Listening Port</label>
                    {isCheckingPort && (
                      <span className="text-[10px] text-zinc-500 font-mono animate-pulse">Checking...</span>
                    )}
                  </div>
                  <input
                    type="number"
                    required
                    min={1}
                    max={65535}
                    value={port}
                    onChange={(e) => setPort(Number(e.target.value))}
                    className={`w-full px-3.5 py-2 bg-[#08090d] border rounded-xl text-xs font-mono text-white focus:outline-none transition ${
                      portConflict 
                        ? 'border-rose-500/80 bg-rose-500/10 text-rose-200' 
                        : 'border-white/[0.08] focus:border-cyan-500/50'
                    }`}
                  />
                  {portConflict && (
                    <div className="mt-1.5 p-2 rounded-lg bg-rose-500/15 border border-rose-500/30 text-[11px] text-rose-300 flex items-start gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                      <span>{portConflict}</span>
                    </div>
                  )}
                </div>

                {/* Protocol */}
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">Protocol</label>
                  <select
                    value={protocol}
                    onChange={(e) => setProtocol(e.target.value)}
                    className="w-full px-3.5 py-2 bg-[#08090d] border border-white/[0.08] rounded-xl text-xs text-white focus:outline-none font-mono uppercase"
                  >
                    <option value="vless">VLESS</option>
                    <option value="trojan">TROJAN</option>
                    <option value="vmess">VMESS</option>
                    <option value="shadowsocks">SHADOWSOCKS</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">Listen IP</label>
                  <input
                    type="text"
                    value={listen}
                    onChange={(e) => setListen(e.target.value)}
                    placeholder="0.0.0.0"
                    className="w-full px-3.5 py-2 bg-[#08090d] border border-white/[0.08] rounded-xl text-xs text-white font-mono focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">Traffic Quota (GB)</label>
                  <input
                    type="number"
                    min={0}
                    value={totalGB}
                    onChange={(e) => setTotalGB(Number(e.target.value))}
                    placeholder="0 = Unlimited"
                    className="w-full px-3.5 py-2 bg-[#08090d] border border-white/[0.08] rounded-xl text-xs text-white font-mono focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'transport' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">Network Layer</label>
                <select
                  value={network}
                  onChange={(e) => setNetwork(e.target.value)}
                  className="w-full px-3.5 py-2 bg-[#08090d] border border-white/[0.08] rounded-xl text-xs text-white font-mono uppercase"
                >
                  <option value="tcp">TCP (Standard)</option>
                  <option value="ws">WebSocket (WS)</option>
                  <option value="grpc">gRPC</option>
                </select>
              </div>

              {network === 'ws' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1.5">WS Path</label>
                    <input
                      type="text"
                      value={wsPath}
                      onChange={(e) => setWsPath(e.target.value)}
                      placeholder="/vless-ws"
                      className="w-full px-3.5 py-2 bg-[#08090d] border border-white/[0.08] rounded-xl text-xs text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1.5">WS Host Header</label>
                    <input
                      type="text"
                      value={wsHost}
                      onChange={(e) => setWsHost(e.target.value)}
                      placeholder="e.g. cdn.domain.com"
                      className="w-full px-3.5 py-2 bg-[#08090d] border border-white/[0.08] rounded-xl text-xs text-white font-mono"
                    />
                  </div>
                </div>
              )}

              {network === 'grpc' && (
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">gRPC Service Name</label>
                  <input
                    type="text"
                    value={grpcServiceName}
                    onChange={(e) => setGrpcServiceName(e.target.value)}
                    placeholder="vless-grpc"
                    className="w-full px-3.5 py-2 bg-[#08090d] border border-white/[0.08] rounded-xl text-xs text-white font-mono"
                  />
                </div>
              )}
            </div>
          )}

          {activeTab === 'security' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">Security Protocol</label>
                <select
                  value={security}
                  onChange={(e) => setSecurity(e.target.value)}
                  className="w-full px-3.5 py-2 bg-[#08090d] border border-white/[0.08] rounded-xl text-xs text-white font-mono uppercase"
                >
                  <option value="none">None (Plaintext)</option>
                  <option value="tls">TLS (Let's Encrypt / Custom SSL)</option>
                  <option value="reality">REALITY (VLESS Vision Masking)</option>
                </select>
              </div>

              {security === 'tls' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1.5">SNI Domain</label>
                    <input
                      type="text"
                      value={tlsSNI}
                      onChange={(e) => setTlsSNI(e.target.value)}
                      placeholder="e.g. sub.domain.com"
                      className="w-full px-3.5 py-2 bg-[#08090d] border border-white/[0.08] rounded-xl text-xs text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1.5">ALPN</label>
                    <input
                      type="text"
                      value={tlsALPN}
                      onChange={(e) => setTlsALPN(e.target.value)}
                      placeholder="h2,http/1.1"
                      className="w-full px-3.5 py-2 bg-[#08090d] border border-white/[0.08] rounded-xl text-xs text-white font-mono"
                    />
                  </div>
                </div>
              )}

              {security === 'reality' && (
                <div className="space-y-3 p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                  <div className="flex items-center justify-between pb-2 border-b border-white/[0.04]">
                    <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      REALITY Handshake Settings
                    </span>
                    <button
                      type="button"
                      onClick={handleGenerateRealityKeys}
                      className="text-[11px] text-cyan-400 hover:text-cyan-300 font-mono flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Regenerate Keys</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-zinc-400 mb-1">Dest Server</label>
                      <input
                        type="text"
                        value={realityDest}
                        onChange={(e) => setRealityDest(e.target.value)}
                        placeholder="www.google.com:443"
                        className="w-full px-3 py-1.5 bg-[#08090d] border border-white/[0.08] rounded-lg text-xs text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-zinc-400 mb-1">Server Names (SNI)</label>
                      <input
                        type="text"
                        value={realityServerNames}
                        onChange={(e) => setRealityServerNames(e.target.value)}
                        placeholder="www.google.com"
                        className="w-full px-3 py-1.5 bg-[#08090d] border border-white/[0.08] rounded-lg text-xs text-white font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-zinc-400 mb-1">Public Key</label>
                      <input
                        type="text"
                        value={realityPubKey}
                        readOnly
                        className="w-full px-3 py-1.5 bg-black/40 border border-white/[0.06] rounded-lg text-xs text-zinc-400 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-zinc-400 mb-1">Short ID</label>
                      <input
                        type="text"
                        value={realityShortId}
                        onChange={(e) => setRealityShortId(e.target.value)}
                        className="w-full px-3 py-1.5 bg-[#08090d] border border-white/[0.08] rounded-lg text-xs text-white font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Footer Submit Button */}
          <div className="pt-4 border-t border-white/[0.06] flex items-center justify-between">
            <span className="text-xs text-zinc-500 font-mono">Port Guard: Active</span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs text-zinc-400 hover:text-white transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={Boolean(portConflict) || isSubmitting}
                className={`px-5 py-2 rounded-xl text-xs font-semibold shadow-lg transition ${
                  portConflict
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 cursor-not-allowed'
                    : 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-[0_0_20px_rgba(16,185,129,0.3)]'
                }`}
              >
                {isSubmitting ? 'Saving...' : inboundToEdit ? 'Update Inbound' : 'Save Inbound'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
