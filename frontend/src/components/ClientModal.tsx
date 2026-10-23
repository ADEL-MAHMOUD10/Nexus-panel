import React, { useState, useEffect } from 'react';
import { X, RefreshCw, Key } from 'lucide-react';
import api from '../services/api';
import { Client, Inbound } from '../types';
import { useNotification } from '../context/NotificationContext';

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
  const [inboundId, setInboundId] = useState<number>(inbounds[0]?.id || 1);
  const [email, setEmail] = useState('');
  const [uuid, setUuid] = useState('');
  const [flow, setFlow] = useState('xtls-rprx-vision');
  const [quotaGB, setQuotaGB] = useState<number>(0);
  const [expiryDays, setExpiryDays] = useState<number>(0);
  const [enable, setEnable] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateUuid = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  };

  useEffect(() => {
    if (clientToEdit) {
      setInboundId(clientToEdit.inboundId);
      setEmail(clientToEdit.email);
      setUuid(clientToEdit.uuid);
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
      setInboundId(inbounds[0]?.id || 1);
      setEmail('user_' + Math.floor(Math.random() * 9000 + 1000));
      setUuid(generateUuid());
      setFlow('xtls-rprx-vision');
      setQuotaGB(0);
      setExpiryDays(0);
      setEnable(true);
    }
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
      flow,
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
        notify.success('Client Saved', clientToEdit ? `Client ${email} updated successfully.` : `New client ${email} added.`);
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#0c0d13]/95 backdrop-blur-2xl border border-white/[0.1] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
          <h3 className="text-base font-bold text-white">
            {clientToEdit ? 'Edit Client Account' : 'Add New Client'}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-mono">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">Attach to Inbound</label>
            <select
              value={inboundId}
              onChange={(e) => setInboundId(Number(e.target.value))}
              disabled={Boolean(clientToEdit)}
              className="w-full px-3.5 py-2 bg-[#08090d] border border-white/[0.08] rounded-xl text-xs text-white focus:outline-none"
            >
              {inbounds.map((inb) => (
                <option key={inb.id} value={inb.id}>
                  {inb.remark || inb.tag} (Port: {inb.port}, {inb.protocol.toUpperCase()})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">Client Email / Username</label>
            <input
              type="text"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3.5 py-2 bg-[#08090d] border border-white/[0.08] rounded-xl text-xs text-white focus:outline-none font-sans"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-medium text-zinc-300">Client UUID / Password</label>
              <button
                type="button"
                onClick={() => setUuid(generateUuid())}
                className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-mono"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Generate</span>
              </button>
            </div>
            <input
              type="text"
              required
              value={uuid}
              onChange={(e) => setUuid(e.target.value)}
              className="w-full px-3.5 py-2 bg-[#08090d] border border-white/[0.08] rounded-xl text-xs text-white font-mono focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">Traffic Quota (GB)</label>
              <input
                type="number"
                min={0}
                value={quotaGB}
                onChange={(e) => setQuotaGB(Number(e.target.value))}
                placeholder="0 = Unlimited"
                className="w-full px-3.5 py-2 bg-[#08090d] border border-white/[0.08] rounded-xl text-xs text-white font-mono focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">Validity Days</label>
              <input
                type="number"
                min={0}
                value={expiryDays}
                onChange={(e) => setExpiryDays(Number(e.target.value))}
                placeholder="0 = Permanent"
                className="w-full px-3.5 py-2 bg-[#08090d] border border-white/[0.08] rounded-xl text-xs text-white font-mono focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">Flow Transmission</label>
            <select
              value={flow}
              onChange={(e) => setFlow(e.target.value)}
              className="w-full px-3.5 py-2 bg-[#08090d] border border-white/[0.08] rounded-xl text-xs text-white font-mono"
            >
              <option value="xtls-rprx-vision">xtls-rprx-vision (Recommended for REALITY/TLS)</option>
              <option value="none">none (Standard)</option>
            </select>
          </div>

          {/* Submit */}
          <div className="pt-4 border-t border-white/[0.06] flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs text-zinc-400 hover:text-white transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-medium rounded-xl text-xs shadow-lg transition"
            >
              {isSubmitting ? 'Saving...' : clientToEdit ? 'Update Client' : 'Add Client'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
