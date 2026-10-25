import React, { useState, useEffect } from 'react';
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
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200 cursor-pointer"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-[#161617] border border-neutral-200/80 dark:border-neutral-800 rounded-2xl w-full max-w-xl shadow-2xl p-6 relative animate-in zoom-in-95 duration-200 cursor-default"
      >
        <div className="flex items-center justify-between pb-3 border-b border-neutral-200/80 dark:border-neutral-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 flex items-center justify-center text-neutral-800 dark:text-white">
              <ArrowUpCircle className="w-4 h-4 text-blue-500 dark:text-blue-400" />
            </div>
            <h3 className="text-base font-bold text-neutral-900 dark:text-white tracking-tight">System & Core Updates</h3>
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

        {toastMsg && (
          <div className="my-4 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-300 text-xs font-mono">
            {toastMsg}
          </div>
        )}

        <div className="space-y-4 my-5">
          {/* Nexus Panel Update Tile */}
          <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200/80 dark:border-neutral-800 flex items-center justify-between">
            <div>
              <span className="text-sm font-semibold text-neutral-900 dark:text-white block">Nexus Panel Daemon</span>
              <div className="text-xs font-mono text-neutral-500 dark:text-neutral-400 mt-0.5">
                Installed: <span className="text-neutral-800 dark:text-neutral-200 font-semibold">{updates.panel.currentVersion || 'v1.0.8'}</span> · Latest:{' '}
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{updates.panel.latestVersion || updates.panel.currentVersion || 'v1.0.8'}</span>
              </div>
            </div>

            <button
              onClick={handleUpdatePanel}
              disabled={isUpdatingPanel || isChecking}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition active:scale-95 cursor-pointer ${
                updates.panel.hasUpdate
                  ? 'bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-200 text-white dark:text-neutral-950 shadow-sm'
                  : 'bg-neutral-100 dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white border border-neutral-200 dark:border-neutral-800'
              }`}
            >
              {isUpdatingPanel ? 'Updating...' : updates.panel.hasUpdate ? 'Upgrade Now' : 'Reinstall / Check'}
            </button>
          </div>

          {/* Xray Core Update Tile */}
          <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200/80 dark:border-neutral-800 flex items-center justify-between">
            <div>
              <span className="text-sm font-semibold text-neutral-900 dark:text-white block">Xray-core Kernel Engine</span>
              <div className="text-xs font-mono text-neutral-500 dark:text-neutral-400 mt-0.5">
                Installed: <span className="text-neutral-800 dark:text-neutral-200 font-semibold">{updates.xray.currentVersion || 'v26.10.10'}</span> · Latest:{' '}
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{updates.xray.latestVersion || updates.xray.currentVersion || 'v26.10.10'}</span>
              </div>
            </div>

            <button
              onClick={handleUpdateXray}
              disabled={isUpdatingXray || isChecking}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition active:scale-95 cursor-pointer ${
                updates.xray.hasUpdate
                  ? 'bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-200 text-white dark:text-neutral-950 shadow-sm'
                  : 'bg-neutral-100 dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white border border-neutral-200 dark:border-neutral-800'
              }`}
            >
              {isUpdatingXray ? 'Updating...' : updates.xray.hasUpdate ? 'Upgrade Kernel' : 'Reinstall / Check'}
            </button>
          </div>
        </div>

        <div className="pt-3 border-t border-neutral-200/80 dark:border-neutral-800 flex items-center justify-between">
          <button
            onClick={onRefresh}
            disabled={isChecking}
            className="text-xs text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white flex items-center gap-1.5 transition font-mono cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
            <span>Check for Releases</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-2 text-xs text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
