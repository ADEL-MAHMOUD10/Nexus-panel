import React, { useState } from 'react';
import { X, RefreshCw, ArrowUpCircle, CheckCircle, AlertTriangle } from 'lucide-react';
import api from '../services/api';
import { UpdateInfo } from '../types';
import { useNotification } from '../context/NotificationContext';
import { useConfirm } from '../context/ConfirmContext';

interface UpdatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  updates: UpdateInfo;
  onRefresh: () => void;
  isChecking: boolean;
}

export const UpdatesModal: React.FC<UpdatesModalProps> = ({
  isOpen,
  onClose,
  updates,
  onRefresh,
  isChecking,
}) => {
  const { notify } = useNotification();
  const confirm = useConfirm();
  const [isUpdatingPanel, setIsUpdatingPanel] = useState(false);
  const [isUpdatingXray, setIsUpdatingXray] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleUpdatePanel = async () => {
    const ok = await confirm({
      title: 'Upgrade Nexus Panel',
      message: 'Upgrade Nexus Panel now? The service will automatically download the new release binary and restart the service without interrupting active routing.',
      confirmText: 'Upgrade & Restart',
      cancelText: 'Cancel',
      variant: 'primary',
      icon: 'upgrade',
    });
    if (!ok) return;

    setIsUpdatingPanel(true);
    try {
      const res = await api.post('/api/server/update-panel', { version: updates.panel.latestVersion || 'latest' });
      if (res.data && res.data.success) {
        setToastMsg('Panel update launched successfully! Reloading in 3 seconds...');
        notify.success('Panel Updating', 'New binary downloading, service will reload in 3s.');
        setTimeout(() => window.location.reload(), 3000);
      } else {
        const msg = res.data?.message || 'Panel update failed';
        setToastMsg(msg);
        notify.error('Update Failed', msg);
      }
    } catch (e: any) {
      const msg = 'Update error: ' + (e.response?.data?.message || e.message);
      setToastMsg(msg);
      notify.error('Update Error', msg);
    } finally {
      setIsUpdatingPanel(false);
    }
  };

  const handleUpdateXray = async () => {
    const ok = await confirm({
      title: 'Upgrade Xray-Core Kernel',
      message: 'Upgrade Xray-core kernel now? The official release binary will be downloaded and reloaded gracefully.',
      confirmText: 'Upgrade Core',
      cancelText: 'Cancel',
      variant: 'primary',
      icon: 'upgrade',
    });
    if (!ok) return;

    setIsUpdatingXray(true);
    try {
      const res = await api.post('/api/server/update-xray', { version: updates.xray.latestVersion || 'v26.10.10' });
      if (res.data && res.data.success) {
        setToastMsg('Xray-core updated and restarted successfully!');
        notify.success('Xray Updated', 'Kernel replaced and reloaded successfully.');
        onRefresh();
      } else {
        const msg = res.data?.message || 'Xray kernel update failed';
        setToastMsg(msg);
        notify.error('Xray Update Failed', msg);
      }
    } catch (e: any) {
      const msg = 'Update error: ' + (e.response?.data?.message || e.message);
      setToastMsg(msg);
      notify.error('Xray Error', msg);
    } finally {
      setIsUpdatingXray(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#0c0d13]/95 backdrop-blur-2xl border border-white/[0.1] rounded-2xl w-full max-w-xl shadow-2xl p-6 relative">
        <div className="flex items-center justify-between pb-3 border-b border-white/[0.07]">
          <div className="flex items-center gap-2">
            <ArrowUpCircle className="w-5 h-5 text-cyan-400" />
            <h3 className="text-base font-bold text-white">System & Core Updates</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {toastMsg && (
          <div className="my-4 p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs font-mono">
            {toastMsg}
          </div>
        )}

        <div className="space-y-4 my-5">
          {/* Nexus Panel Update Tile */}
          <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.07] flex items-center justify-between">
            <div>
              <span className="text-sm font-bold text-white block">Nexus Panel Daemon</span>
              <div className="text-xs font-mono text-zinc-400 mt-0.5">
                Installed: <span className="text-zinc-200">{updates.panel.currentVersion || 'v1.0.8'}</span> · Latest:{' '}
                <span className="text-emerald-400 font-bold">{updates.panel.latestVersion || updates.panel.currentVersion || 'v1.0.8'}</span>
              </div>
            </div>

            <button
              onClick={handleUpdatePanel}
              disabled={isUpdatingPanel || isChecking}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${
                updates.panel.hasUpdate
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg'
                  : 'bg-white/5 text-zinc-400 hover:text-white border border-white/10'
              }`}
            >
              {isUpdatingPanel ? 'Updating...' : updates.panel.hasUpdate ? 'Upgrade Now' : 'Reinstall / Check'}
            </button>
          </div>

          {/* Xray Core Update Tile */}
          <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.07] flex items-center justify-between">
            <div>
              <span className="text-sm font-bold text-white block">Xray-core Kernel Engine</span>
              <div className="text-xs font-mono text-zinc-400 mt-0.5">
                Installed: <span className="text-zinc-200">{updates.xray.currentVersion || 'v26.10.10'}</span> · Latest:{' '}
                <span className="text-emerald-400 font-bold">{updates.xray.latestVersion || updates.xray.currentVersion || 'v26.10.10'}</span>
              </div>
            </div>

            <button
              onClick={handleUpdateXray}
              disabled={isUpdatingXray || isChecking}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${
                updates.xray.hasUpdate
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg'
                  : 'bg-white/5 text-zinc-400 hover:text-white border border-white/10'
              }`}
            >
              {isUpdatingXray ? 'Updating...' : updates.xray.hasUpdate ? 'Upgrade Kernel' : 'Reinstall / Check'}
            </button>
          </div>
        </div>

        <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between">
          <button
            onClick={onRefresh}
            disabled={isChecking}
            className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1.5 transition font-mono"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
            <span>Check for Releases</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-2 text-xs text-zinc-400 hover:text-white transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
