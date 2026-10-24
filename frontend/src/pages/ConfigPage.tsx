import React, { useState, useEffect } from 'react';
import { Sliders, Save, RefreshCw, FileText, Database, Download, UploadCloud, ShieldCheck } from 'lucide-react';
import api from '../services/api';

interface ConfigPageProps {
  onOpenBackup?: () => void;
}

export const ConfigPage: React.FC<ConfigPageProps> = ({ onOpenBackup }) => {
  const [configContent, setConfigContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);

  const fetchConfig = async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/api/server/config');
      if (res.data && res.data.config) {
        setConfigContent(res.data.config);
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
            onClick={fetchConfig}
            disabled={isLoading}
            className="p-2 rounded-xl border border-[#292d3e] bg-[#14161f] hover:bg-[#202432] text-zinc-300 transition"
            title="Reload Config"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 text-white font-medium rounded-xl text-xs flex items-center gap-2 shadow-lg transition"
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
        <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/20 via-teal-950/20 to-blue-950/20 border border-emerald-500/20 flex flex-wrap items-center justify-between gap-4 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">Database Backup & Disaster Recovery</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold">
                  1-CLICK
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                Download a complete, atomic snapshot of your SQLite database (.db) or restore a previous backup to clone or recover this server.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenBackup}
            className="px-4 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] text-xs font-medium text-white transition flex items-center gap-2 shadow-sm cursor-pointer shrink-0"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>Open Backup & Restore</span>
          </button>
        </div>
      )}

      {/* Editor Container */}
      <div className="bg-[#0c0d13]/85 backdrop-blur-xl border border-white/[0.08] shadow-xl rounded-2xl p-4 shadow-xl">
        <textarea
          value={configContent}
          onChange={(e) => setConfigContent(e.target.value)}
          spellCheck={false}
          className="w-full h-[620px] bg-white/[0.03] border border-white/[0.08] rounded-xl p-4 text-xs font-mono text-cyan-300 focus:outline-none focus:border-[#3d445c] leading-relaxed resize-none"
        />
      </div>
    </div>
  );
};
