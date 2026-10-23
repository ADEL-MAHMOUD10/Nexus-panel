import React, { useState, useEffect } from 'react';
import { Sliders, Save, RefreshCw, FileText } from 'lucide-react';
import api from '../services/api';

export const ConfigPage: React.FC = () => {
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
            className="p-2 rounded-xl border border-white/[0.08] bg-[#14171e] hover:bg-[#191d26] text-zinc-300 transition"
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

      {/* Editor Container */}
      <div className="bg-[#0a0d16]/75 backdrop-blur-xl border border-white/[0.08] rounded-2xl p-4 shadow-xl">
        <textarea
          value={configContent}
          onChange={(e) => setConfigContent(e.target.value)}
          spellCheck={false}
          className="w-full h-[620px] bg-[#090a0d] border border-white/[0.06] rounded-xl p-4 text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-500/50 leading-relaxed resize-none"
        />
      </div>
    </div>
  );
};
