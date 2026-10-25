import React, { useState, useEffect } from 'react';
import { Sliders, Save, RefreshCw, Check, FileText, Database, Download, UploadCloud, ShieldCheck } from 'lucide-react';
import api from '../services/api';

interface ConfigPageProps {
  onOpenBackup?: () => void;
}

export const ConfigPage: React.FC<ConfigPageProps> = ({ onOpenBackup }) => {
  const [configContent, setConfigContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [justRefreshed, setJustRefreshed] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);

  const fetchConfig = async (isManual: boolean = false) => {
    setIsLoading(true);
    const minDelay = isManual ? new Promise((res) => setTimeout(res, 750)) : Promise.resolve();
    try {
      const [res] = await Promise.all([
        api.get('/api/server/config'),
        minDelay
      ]);
      if (res.data && res.data.config) {
        setConfigContent(res.data.config);
      }
      if (isManual) {
        setJustRefreshed(true);
        setTimeout(() => setJustRefreshed(false), 1600);
      }
    } catch (e: any) {
      setMessage({ text: 'Failed to load xray configuration', isError: true });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);
    try {
      const res = await api.post('/api/server/config', { config: configContent });
      if (res.data && res.data.success) {
        setMessage({ text: 'Configuration saved and applied to Xray-core successfully!', isError: false });
      } else {
        setMessage({ text: res.data?.message || 'Failed to apply configuration', isError: true });
      }
    } catch (e: any) {
      setMessage({ text: 'Error saving config: ' + (e.response?.data?.message || e.message), isError: true });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-white tracking-wide">Xray Core Configuration</h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Directly view and edit the active generated Xray JSON configuration.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => fetchConfig(true)}
            disabled={isLoading}
            className={`group/refresh p-2 rounded-xl border transition-all duration-200 active:scale-90 cursor-pointer shadow-xs flex items-center justify-center ${
              justRefreshed
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-emerald-500/10'
                : isLoading
                ? 'bg-neutral-800 text-neutral-300 border-neutral-700'
                : 'bg-neutral-900/80 hover:bg-neutral-800 text-neutral-300 hover:text-white border-neutral-800 hover:border-neutral-700'
            }`}
            title="Reload Config"
          >
            {justRefreshed ? (
              <Check className="w-4 h-4 text-emerald-400 animate-in zoom-in-50 duration-150" />
            ) : (
              <RefreshCw
                className={`w-4 h-4 transition-transform duration-300 ${
                  isLoading ? 'animate-spin text-white' : 'group-hover/refresh:rotate-90 group-hover/refresh:scale-110'
                }`}
              />
            )}
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 bg-white hover:bg-neutral-200 text-neutral-950 font-semibold rounded-xl text-xs flex items-center gap-2 shadow-sm transition active:scale-95 cursor-pointer disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Applying...' : 'Save & Restart Core'}</span>
          </button>
        </div>
      </div>

      {message && (
        <div
          className={`p-3 rounded-xl border text-xs font-mono flex items-center gap-2 ${
            message.isError
              ? 'bg-rose-500/10 border-rose-500/20 text-rose-300'
              : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
          }`}
        >
          <span>{message.text}</span>
        </div>
      )}

      {/* Database Backup & Disaster Recovery Banner */}
      {onOpenBackup && (
        <div className="p-4 rounded-2xl bg-[#0c0d10] border border-neutral-800 flex flex-wrap items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-white shrink-0">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-semibold text-white uppercase tracking-wider">Database Backup & Disaster Recovery</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-neutral-800 text-neutral-300 border border-neutral-700 font-semibold">
                  1-CLICK
                </span>
              </div>
              <p className="text-[11px] text-neutral-400 mt-0.5">
                Download a complete, atomic snapshot of your SQLite database (.db) or restore a previous backup to clone or recover this server.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenBackup}
            className="px-4 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-xs font-semibold text-neutral-200 hover:text-white transition flex items-center gap-2 shadow-sm cursor-pointer shrink-0 active:scale-95"
          >
            <Download className="w-3.5 h-3.5 text-neutral-400" />
            <span>Open Backup & Restore</span>
          </button>
        </div>
      )}

      {/* Editor Container */}
      <div className="bg-[#0c0d10] border border-neutral-800 rounded-2xl p-4 shadow-sm">
        <textarea
          value={configContent}
          onChange={(e) => setConfigContent(e.target.value)}
          spellCheck={false}
          className="w-full h-[620px] bg-neutral-950 border border-neutral-800 rounded-xl p-4 text-xs font-mono text-neutral-200 focus:outline-none focus:border-neutral-700 leading-relaxed resize-none"
        />
      </div>
    </div>
  );
};
