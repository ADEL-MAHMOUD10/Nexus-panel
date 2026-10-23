import React, { useState } from 'react';
import { Lock, User, ArrowRight, ShieldCheck, AlertCircle } from 'lucide-react';

interface LoginPageProps {
  onLogin: (token: string) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        localStorage.setItem('nexus_token', data.token);
        onLogin(data.token);
      } else {
        setError(data.message || 'Invalid username or password');
      }
    } catch (err: any) {
      setError('Connection error connecting to Nexus Core Server');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-cyber-canvas flex items-center justify-center p-4 relative overflow-hidden select-none">
      {/* Background glowing orbs */}
      <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/3 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>

      {/* Login Card */}
      <div className="w-full max-w-sm bg-[#0e1118]/90 backdrop-blur-2xl border border-white/[0.1] rounded-3xl p-8 shadow-2xl relative z-10">
        {/* Branding */}
        <div className="text-center mb-7">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500/20 via-white/[0.05] to-transparent border border-cyan-500/40 flex items-center justify-center mx-auto shadow-[0_0_25px_rgba(6,182,212,0.3)] mb-3.5 group">
            <svg viewBox="0 0 24 24" className="w-7 h-7 text-cyan-300 drop-shadow-[0_0_8px_#22d3ee]" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 20V4l16 16V4" />
            </svg>
          </div>
          <h2 className="text-2xl font-black tracking-[0.25em] font-mono text-nexus-gradient text-nexus-glow">
            NEXUS
          </h2>
          <p className="text-xs text-zinc-400 mt-1 font-mono uppercase tracking-wider text-[11px]">
            Quantum Proxy Core
          </p>
        </div>

        {error && (
          <div className="p-3 mb-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-mono flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">Username</label>
            <div className="relative">
              <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                className="w-full pl-9.5 pr-4 py-2.5 bg-[#090a0d] border border-white/[0.08] rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500/50 transition font-sans"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9.5 pr-4 py-2.5 bg-[#090a0d] border border-white/[0.08] rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500/50 transition font-sans"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-medium rounded-xl text-xs shadow-[0_0_20px_rgba(16,185,129,0.3)] transition transform active:scale-95 flex items-center justify-center gap-2 mt-2"
          >
            <span>{isLoading ? 'Authenticating...' : 'Sign In'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-white/[0.06] text-center text-[10px] text-zinc-500 font-mono">
          <span>Protected by Nexus Core Guard & JWT</span>
        </div>
      </div>
    </div>
  );
};
