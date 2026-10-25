import React, { useState } from 'react';
import { Lock, User, ArrowRight, ShieldCheck, AlertCircle } from 'lucide-react';
import { BackgroundCanvas } from '../components/BackgroundCanvas';
import { ThemeToggle } from '../components/ThemeToggle';

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
    <div className="min-h-screen flex items-center justify-center p-4 relative select-none">
      {/* Background with geometry & Nexus monogram */}
      <BackgroundCanvas />

      {/* Top right theme toggle */}
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>

      {/* Login Card */}
      <div className="w-full max-w-sm bg-white dark:bg-[#0c0d13]/85 backdrop-blur-2xl border border-neutral-200/80 dark:border-white/[0.09] rounded-3xl p-7 sm:p-8 shadow-2xl relative z-10 transition-colors">
        {/* Branding */}
        <div className="text-center mb-6">
          <div className="w-10 h-10 rounded-xl bg-neutral-100 dark:bg-zinc-100 text-neutral-900 dark:text-zinc-950 flex items-center justify-center font-bold text-base tracking-tighter mx-auto mb-3 shadow-xs font-sans">
            N
          </div>
          <h2 className="text-base font-bold text-neutral-900 dark:text-zinc-100 tracking-tight">Nexus Server Panel</h2>
          <p className="text-xs text-neutral-500 dark:text-zinc-400 mt-0.5">Enterprise Proxy & Routing Control</p>
        </div>

        {error && (
          <div className="p-3 mb-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 dark:text-rose-300 text-xs font-mono flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 dark:text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-neutral-700 dark:text-zinc-300 mb-1.5" data-no-ui>Username</label>
            <div className="relative">
              <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-zinc-500" />
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                className="w-full pl-9.5 pr-4 py-2 bg-white dark:bg-[#14161f] border border-neutral-200 dark:border-[#292d3e] rounded-xl text-xs text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-zinc-500 focus:outline-none focus:border-neutral-400 dark:focus:border-[#3d445c] transition font-sans shadow-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-700 dark:text-zinc-300 mb-1.5" data-no-ui>Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-zinc-500" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9.5 pr-4 py-2 bg-white dark:bg-[#14161f] border border-neutral-200 dark:border-[#292d3e] rounded-xl text-xs text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-zinc-500 focus:outline-none focus:border-neutral-400 dark:focus:border-[#3d445c] transition font-sans shadow-xs"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 bg-neutral-100 hover:bg-neutral-200 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-neutral-900 dark:text-zinc-950 font-semibold rounded-xl text-xs transition flex items-center justify-center gap-2 mt-4 disabled:opacity-50 cursor-pointer shadow-xs active:scale-[0.99]"
          >
            <span>{isLoading ? 'Signing In...' : 'Sign In'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-neutral-100 dark:border-zinc-800/80 text-center text-[11px] text-neutral-400 dark:text-zinc-500 font-sans flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-neutral-400 dark:text-zinc-500" />
          <span>Protected by Nexus Core Guard</span>
        </div>
      </div>
    </div>
  );
};
