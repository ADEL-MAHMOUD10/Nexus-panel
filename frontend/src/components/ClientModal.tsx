import React, { useState, useEffect } from 'react';
import { 
  X, 
  RefreshCw, 
  Key, 
  User, 
  UserPlus, 
  Server, 
  Database, 
  Calendar, 
  Zap, 
  ShieldCheck, 
  Copy, 
  Check, 
  Clock, 
  Activity,
  Layers,
  Lock,
  Radio,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import api from '../services/api';
import { Client, Inbound } from '../types';
import { useNotification } from '../context/NotificationContext';
import { copyToClipboard } from '../utils/clipboard';

interface ClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  inbounds: Inbound[];
  clientToEdit?: Client | null;
}

export const ClientModal: React.FC<ClientModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  inbounds,
  clientToEdit,
}) => {
  const { notify } = useNotification();

  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);
  const [inboundId, setInboundId] = useState<number>(inbounds[0]?.id || 1);
  const [email, setEmail] = useState('');
  const [uuid, setUuid] = useState('');
  const [flow, setFlow] = useState('xtls-rprx-vision');
  const [quotaGB, setQuotaGB] = useState<number>(0);
  const [expiryDays, setExpiryDays] = useState<number>(0);
  const [enable, setEnable] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  // Selected inbound object
  const selectedInbound = inbounds.find((inb) => inb.id === Number(inboundId)) || inbounds[0];
  const protocol = (selectedInbound?.protocol || 'vless').toLowerCase();
  const isVless = protocol === 'vless';
  const isTrojan = protocol === 'trojan';
  const isShadowsocks = protocol === 'shadowsocks';
  const isWireGuard = protocol === 'wireguard';

  const generateUuid = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  };

  const generateAlphanumericPassword = (length = 16) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%';
    let res = '';
    for (let i = 0; i < length; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return res;
  };

  const generateBase64Key = (bytes = 16) => {
    const array = new Uint8Array(bytes);
    window.crypto.getRandomValues(array);
    let binary = '';
    for (let i = 0; i < array.length; i++) {
      binary += String.fromCharCode(array[i]);
    }
    return btoa(binary);
  };

  const handleGenerateWireGuardKeys = async () => {
    try {
      const res = await api.get('/api/crypto/wireguard-keys');
      if (res.data?.success && res.data.publicKey) {
        setUuid(res.data.publicKey);
        notify.success('WireGuard Key Generated', 'Generated valid 32-byte Curve25519 peer key.');
        return;
      }
    } catch (e) {}
    setUuid(generateBase64Key(32));
  };

  const handleCopyKey = async () => {
    if (!uuid) return;
    const success = await copyToClipboard(uuid);
    if (success) {
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  useEffect(() => {
    if (clientToEdit) {
      setInboundId(clientToEdit.inboundId);
      setEmail(clientToEdit.email);
      setUuid(clientToEdit.uuid || clientToEdit.password || '');
      setFlow(clientToEdit.flow || 'xtls-rprx-vision');
      setQuotaGB(clientToEdit.total ? Number((clientToEdit.total / (1024 ** 3)).toFixed(2)) : 0);
      setEnable(clientToEdit.enable);

      if (clientToEdit.expiryTime > 0) {
        const diff = Math.ceil((clientToEdit.expiryTime - Math.floor(Date.now() / 1000)) / 86400);
        setExpiryDays(diff > 0 ? diff : 0);
      } else {
        setExpiryDays(0);
      }
    } else {
      const initialInbound = inbounds[0]?.id || 1;
      setInboundId(initialInbound);
      setEmail('user_' + Math.floor(Math.random() * 9000 + 1000));
      const targetInb = inbounds.find(i => i.id === initialInbound);
      if (targetInb && targetInb.protocol.toLowerCase() === 'wireguard') {
        handleGenerateWireGuardKeys();
      } else {
        setUuid(generateUuid());
      }
      setFlow('xtls-rprx-vision');
      setQuotaGB(0);
      setExpiryDays(0);
      setEnable(true);
    }
    setError(null);
  }, [clientToEdit, isOpen, inbounds]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const totalBytes = quotaGB > 0 ? Math.floor(quotaGB * 1024 ** 3) : 0;
    const expiryTimestamp = expiryDays > 0 ? Math.floor(Date.now() / 1000) + expiryDays * 86400 : 0;

    const payload: any = {
      inboundId: Number(inboundId),
      email: email.trim(),
      uuid: uuid.trim(),
      password: uuid.trim(),
      flow: isVless ? flow : 'none',
      enable,
      total: totalBytes,
      expiryTime: expiryTimestamp,
    };

    try {
      let endpoint = '/api/clients/create';
      if (clientToEdit) {
        payload.id = clientToEdit.id;
        endpoint = `/api/clients/update/${encodeURIComponent(clientToEdit.email)}`;
      }

      const res = await api.post(endpoint, payload);
      if (res.data && res.data.success) {
        notify.success('Client Saved', clientToEdit ? `Client ${email} updated successfully.` : `New client ${email} provisioned.`);
        onSaved();
        onClose();
      } else {
        const msg = res.data?.message || 'Failed to save client';
        setError(msg);
        notify.error('Save Failed', msg);
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Error communicating with server';
      setError(msg);
      notify.error('Save Error', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Quick Presets
  const quotaPresets = [
    { label: 'Unlimited', val: 0 },
    { label: '25 GB', val: 25 },
    { label: '50 GB', val: 50 },
    { label: '100 GB', val: 100 },
    { label: '250 GB', val: 250 },
    { label: '500 GB', val: 500 },
    { label: '1000 GB', val: 1000 },
  ];

  const durationPresets = [
    { label: 'Forever', val: 0 },
    { label: '7 Days', val: 7 },
    { label: '30 Days', val: 30 },
    { label: '90 Days', val: 90 },
    { label: '180 Days', val: 180 },
    { label: '365 Days', val: 365 },
  ];

  const userSuggestions = [
    'user_' + Math.floor(Math.random() * 9000 + 1000),
    'vip_' + Math.floor(Math.random() * 900 + 100),
    'phone_' + Math.floor(Math.random() * 900 + 100),
    'laptop_' + Math.floor(Math.random() * 900 + 100),
  ];

  // Calculated date string
  const calculateExpiryDateStr = () => {
    if (!expiryDays || expiryDays <= 0) return 'Never Expires (Permanent Access)';
    const d = new Date(Date.now() + expiryDays * 86400 * 1000);
    return `Expires on ${d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })} (~${expiryDays} days)`;
  };

  if (!isOpen) return null;

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200 cursor-pointer"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-[#161617] border border-neutral-200/80 dark:border-neutral-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200 cursor-default"
      >
        
        {/* Header Bar */}
        <div className="px-6 py-4.5 border-b border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#161617] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 flex items-center justify-center text-neutral-800 dark:text-neutral-300">
              <UserPlus className="w-4 h-4 text-blue-500 dark:text-blue-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-neutral-900 dark:text-white tracking-tight">
                  {clientToEdit ? 'Edit Client Account' : 'Provision Client Credential'}
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-850 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-750 font-bold uppercase">
                  {clientToEdit ? 'EDIT' : 'NEW'}
                </span>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                {clientToEdit 
                  ? 'Update bandwidth limits, validity lifespan, and credentials.'
                  : 'Deploy client authentication, quota limits, and flow acceleration.'}
              </p>
            </div>
          </div>
          
          {/* Tactile Rotating Close Button */}
          <button
            type="button"
            onClick={onClose}
            title="Close modal (Esc)"
            className="group/close p-2 rounded-xl text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-900/60 dark:hover:bg-neutral-800 border border-neutral-200 dark:border-neutral-800/80 hover:border-neutral-300 dark:hover:border-neutral-700 transition-all duration-200 active:scale-90 flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <span className="hidden sm:inline text-[10px] font-mono font-semibold text-neutral-500 group-hover/close:text-neutral-700 dark:group-hover/close:text-neutral-300">Esc</span>
            <X className="w-4 h-4 transition-transform duration-200 group-hover/close:rotate-90 group-hover/close:scale-110" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 max-h-[82vh] overflow-y-auto custom-scrollbar">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* 1. Inbound Selection */}
          <div className="bg-neutral-950 rounded-xl border border-neutral-850 p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-300">
                  <Server className="w-3 h-3 text-blue-400" />
                </div>
                <span className="text-xs font-semibold text-neutral-200 tracking-wide uppercase">
                  Target Inbound Gateway
                </span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-neutral-900 text-neutral-300 border border-neutral-800 font-medium">
                ROUTED
              </span>
            </div>
            <p className="text-[11px] text-neutral-400 mb-3 font-normal">
              Select which proxy listener will authenticate and route this client traffic.
            </p>

            <select
              value={inboundId}
              onChange={(e) => {
                const newId = Number(e.target.value);
                setInboundId(newId);
                const targetInb = inbounds.find((i) => i.id === newId);
                if (targetInb?.protocol.toLowerCase() === 'wireguard' && (!uuid || uuid.includes('-'))) {
                  handleGenerateWireGuardKeys();
                }
              }}
              disabled={Boolean(clientToEdit)}
              className="w-full px-3.5 py-2.5 bg-[#0e0e12] border border-neutral-800 rounded-xl text-xs text-white focus:outline-none focus:border-neutral-600 disabled:opacity-60 transition font-sans"
            >
              {inbounds.map((inb) => (
                <option key={inb.id} value={inb.id}>
                  {inb.remark || inb.tag} (Port: {inb.port} • Protocol: {inb.protocol.toUpperCase()})
                </option>
              ))}
            </select>

            {/* Selected Inbound Micro-Preview */}
            {selectedInbound && (
              <div className="mt-3 flex flex-wrap items-center gap-2 pt-3 border-t border-neutral-850">
                <div className="px-2.5 py-1 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-300 text-[11px] font-mono font-medium flex items-center gap-1.5">
                  <Radio className="w-3 h-3 text-blue-400" />
                  <span>Port {selectedInbound.port}</span>
                </div>
                <div className="px-2.5 py-1 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-300 text-[11px] font-mono font-medium uppercase">
                  {selectedInbound.protocol}
                </div>
                <div className="px-2.5 py-1 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-300 text-[11px] font-mono font-medium">
                  {selectedInbound.remark || selectedInbound.tag}
                </div>
              </div>
            )}
          </div>

          {/* 2. Client Email / Identifier */}
          <div className="bg-neutral-950 rounded-xl border border-neutral-850 p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-300">
                  <User className="w-3 h-3 text-blue-400" />
                </div>
                <span className="text-xs font-semibold text-neutral-200 tracking-wide uppercase">
                  Client Email / Username
                </span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-neutral-900 text-neutral-300 border border-neutral-800 font-medium">
                IDENTITY
              </span>
            </div>
            <p className="text-[11px] text-neutral-400 mb-3 font-normal">
              Unique username used for client remarks, links, and traffic telemetry accounting.
            </p>

            <div className="relative">
              <input
                type="text"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. user_vip_01"
                className="w-full px-3.5 py-2.5 bg-[#0e0e12] border border-neutral-800 rounded-xl text-xs text-white focus:outline-none focus:border-neutral-600 transition font-sans"
              />
            </div>

            {/* Quick Random Identifiers */}
            {!clientToEdit && (
              <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
                <span className="text-[10px] text-neutral-500 font-mono mr-1">Suggest:</span>
                {userSuggestions.map((sug, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setEmail(sug)}
                    className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-800 hover:border-neutral-700 transition"
                  >
                    {sug}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 3. Credentials (UUID / Password / WireGuard Key) */}
          <div className="bg-neutral-950 rounded-xl border border-neutral-850 p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-300">
                  <Key className="w-3 h-3 text-amber-400" />
                </div>
                <span className="text-xs font-semibold text-neutral-200 tracking-wide uppercase">
                  {isWireGuard ? 'Client WireGuard Public Key (Base64)' : isTrojan || isShadowsocks ? 'Client Password / Shared Key' : 'Client UUID Key'}
                </span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-neutral-900 text-neutral-300 border border-neutral-800 font-medium">
                {isWireGuard ? 'CURVE25519' : isTrojan || isShadowsocks ? 'SECRET' : 'UUIDv4'}
              </span>
            </div>
            <p className="text-[11px] text-neutral-400 mb-3 font-normal">
              {isWireGuard
                ? 'Client 32-byte Base64 Public Key required by WireGuard tunnel for peer verification.'
                : 'Cryptographic authentication credential required by clients to establish connections.'}
            </p>

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  required
                  value={uuid}
                  onChange={(e) => setUuid(e.target.value)}
                  placeholder={isWireGuard ? 'Client 32-byte Base64 Public Key' : isTrojan ? 'Enter password' : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'}
                  className="w-full px-3.5 py-2.5 bg-[#0e0e12] border border-neutral-800 rounded-xl text-xs text-neutral-200 font-mono focus:outline-none focus:border-neutral-600 transition"
                />
              </div>

              {/* Copy Button */}
              <button
                type="button"
                onClick={handleCopyKey}
                className="px-3 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 hover:text-white transition flex items-center gap-1.5 text-xs font-mono"
                title="Copy Key"
              >
                {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">{copiedKey ? 'Copied' : 'Copy'}</span>
              </button>

              {/* Generate Buttons */}
              {!isWireGuard && (
                <button
                  type="button"
                  onClick={() => setUuid(generateUuid())}
                  className="px-3 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-200 transition flex items-center gap-1.5 text-xs font-mono font-medium"
                  title="Generate UUID"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>{isTrojan || isShadowsocks ? 'UUID' : 'Generate'}</span>
                </button>
              )}

              {isWireGuard && (
                <button
                  type="button"
                  onClick={handleGenerateWireGuardKeys}
                  className="px-3 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-200 transition flex items-center gap-1.5 text-xs font-mono font-medium"
                  title="Generate WireGuard Curve25519 Keypair"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                  <span>WG Key</span>
                </button>
              )}

              {isTrojan && (
                <button
                  type="button"
                  onClick={() => setUuid(generateAlphanumericPassword(16))}
                  className="px-3 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-200 transition flex items-center gap-1.5 text-xs font-mono font-medium"
                  title="Generate Password"
                >
                  <Key className="w-3.5 h-3.5 text-amber-400" />
                  <span>Pass</span>
                </button>
              )}

              {isShadowsocks && (
                <button
                  type="button"
                  onClick={() => setUuid(generateBase64Key(16))}
                  className="px-3 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-200 transition flex items-center gap-1.5 text-xs font-mono font-medium"
                  title="Generate SS2022 Base64 Key"
                >
                  <Key className="w-3.5 h-3.5 text-amber-400" />
                  <span>SS2022</span>
                </button>
              )}
            </div>
          </div>

          {/* 4. Quota & Lifespan Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Traffic Quota */}
            <div className="bg-neutral-950 rounded-xl border border-neutral-850 p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-300">
                      <Database className="w-3 h-3 text-emerald-400" />
                    </div>
                    <span className="text-xs font-semibold text-neutral-200 tracking-wide uppercase">
                      Traffic Quota
                    </span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-neutral-900 text-neutral-300 border border-neutral-800 font-medium">
                    BANDWIDTH
                  </span>
                </div>
                <p className="text-[11px] text-neutral-400 mb-3 font-normal">
                  Maximum gigabytes allowed before client is suspended.
                </p>

                <div className="relative mb-3">
                  <input
                    type="number"
                    min={0}
                    value={quotaGB}
                    onChange={(e) => setQuotaGB(Number(e.target.value))}
                    placeholder="0 = Unlimited"
                    className="w-full px-3.5 py-2 bg-[#0e0e12] border border-neutral-800 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-neutral-600 pr-12 transition"
                  />
                  <span className="absolute right-3.5 top-2 text-xs font-mono text-neutral-400">
                    GB
                  </span>
                </div>
              </div>

              {/* Quota Presets */}
              <div className="flex flex-wrap gap-1.5 pt-2 border-t border-neutral-850">
                {quotaPresets.map((qp) => (
                  <button
                    key={qp.val}
                    type="button"
                    onClick={() => setQuotaGB(qp.val)}
                    className={`text-[10px] font-mono px-2 py-0.5 rounded-lg border transition ${
                      quotaGB === qp.val
                        ? 'bg-white text-black font-semibold border-white'
                        : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-700'
                    }`}
                  >
                    {qp.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Validity Days */}
            <div className="bg-neutral-950 rounded-xl border border-neutral-850 p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-300">
                      <Calendar className="w-3 h-3 text-rose-400" />
                    </div>
                    <span className="text-xs font-semibold text-neutral-200 tracking-wide uppercase">
                      Validity Lifespan
                    </span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-neutral-900 text-neutral-300 border border-neutral-800 font-medium">
                    EXPIRY
                  </span>
                </div>
                <p className="text-[11px] text-neutral-400 mb-3 font-normal">
                  Active access duration in days before token expiration.
                </p>

                <div className="relative mb-3">
                  <input
                    type="number"
                    min={0}
                    value={expiryDays}
                    onChange={(e) => setExpiryDays(Number(e.target.value))}
                    placeholder="0 = Permanent"
                    className="w-full px-3.5 py-2 bg-[#0e0e12] border border-neutral-800 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-neutral-600 pr-14 transition"
                  />
                  <span className="absolute right-3.5 top-2 text-xs font-mono text-neutral-400">
                    Days
                  </span>
                </div>
              </div>

              {/* Duration Presets */}
              <div className="flex flex-wrap gap-1.5 pt-2 border-t border-neutral-850">
                {durationPresets.map((dp) => (
                  <button
                    key={dp.val}
                    type="button"
                    onClick={() => setExpiryDays(dp.val)}
                    className={`text-[10px] font-mono px-2 py-0.5 rounded-lg border transition ${
                      expiryDays === dp.val
                        ? 'bg-white text-black font-semibold border-white'
                        : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-700'
                    }`}
                  >
                    {dp.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Expiry Date Live Indicator Banner */}
          <div className="px-3.5 py-2 rounded-xl bg-neutral-950 border border-neutral-850 flex items-center justify-between text-[11px] font-mono">
            <div className="flex items-center gap-2 text-neutral-400">
              <Clock className="w-3.5 h-3.5 text-blue-400" />
              <span>Calculated Expiration:</span>
            </div>
            <span className={expiryDays > 0 ? 'text-amber-400 font-medium' : 'text-emerald-400 font-medium'}>
              {calculateExpiryDateStr()}
            </span>
          </div>

          {/* 5. Flow Transmission (For VLESS) */}
          {isVless && (
            <div className="bg-neutral-950 rounded-xl border border-neutral-850 p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-300">
                    <Zap className="w-3 h-3 text-blue-400" />
                  </div>
                  <span className="text-xs font-semibold text-neutral-200 tracking-wide uppercase">
                    Flow Transmission Steering
                  </span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-neutral-900 text-neutral-300 border border-neutral-800 font-medium">
                  XTLS VISION
                </span>
              </div>
              <p className="text-[11px] text-neutral-400 mb-3 font-normal">
                Packet steering mechanism for direct TLS 1.3 splice and anti-DPI firewall evasion.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div
                  onClick={() => setFlow('xtls-rprx-vision')}
                  className={`p-3.5 rounded-xl border cursor-pointer transition flex flex-col justify-between ${
                    flow === 'xtls-rprx-vision'
                      ? 'bg-neutral-850 border-neutral-600 ring-1 ring-white/10'
                      : 'bg-[#0c0d10] border-neutral-800/80 hover:border-neutral-700 hover:bg-neutral-900'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-mono font-bold text-white">xtls-rprx-vision</span>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                      RECOMMENDED
                    </span>
                  </div>
                  <p className="text-[10px] text-neutral-400 leading-relaxed mt-1">
                    Zero-overhead direct TCP splice for REALITY & TLS. Optimal performance and stealth.
                  </p>
                </div>

                <div
                  onClick={() => setFlow('none')}
                  className={`p-3.5 rounded-xl border cursor-pointer transition flex flex-col justify-between ${
                    flow === 'none'
                      ? 'bg-neutral-850 border-neutral-600 ring-1 ring-white/10'
                      : 'bg-[#0c0d10] border-neutral-800/80 hover:border-neutral-700 hover:bg-neutral-900'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-mono font-bold text-white">none</span>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-neutral-900 text-neutral-400 border border-neutral-800 font-medium">
                      STANDARD
                    </span>
                  </div>
                  <p className="text-[10px] text-neutral-400 leading-relaxed mt-1">
                    Standard raw proxy forwarding without XTLS flow injection (useful for non-TLS transports).
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 6. Account Status Toggle */}
          <div className="bg-neutral-950 rounded-xl border border-neutral-850 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center border transition ${
                enable 
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                  : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
              }`}>
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-white">Account Provisioning State</span>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded-md font-semibold border ${
                    enable 
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                      : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                  }`}>
                    {enable ? 'ACTIVE' : 'SUSPENDED'}
                  </span>
                </div>
                <p className="text-[11px] text-neutral-400 mt-0.5">
                  {enable 
                    ? 'Client credentials are fully active and permitted to establish connections.' 
                    : 'Client credentials will be rejected by the server firewall.'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setEnable(!enable)}
              className={`w-11 h-6 rounded-full transition-colors relative focus:outline-none p-0.5 ${
                enable ? 'bg-emerald-500' : 'bg-neutral-700'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow-md transition-transform ${
                  enable ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Action Footer */}
          <div className="pt-3 border-t border-neutral-800 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-neutral-800 hover:bg-neutral-800 text-xs text-neutral-400 hover:text-white transition-all duration-150 active:scale-95 cursor-pointer font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-white hover:bg-neutral-200 text-neutral-950 font-semibold rounded-xl text-xs shadow-sm transition flex items-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Provisioning...</span>
                </>
              ) : clientToEdit ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Update Client</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Add Client</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
