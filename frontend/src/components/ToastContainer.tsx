import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle, 
  Info, 
  X 
} from 'lucide-react';
import { useNotification, ToastItem } from '../context/NotificationContext';

export const ToastContainer: React.FC = () => {
  const { toasts, dismissToast } = useNotification();

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none select-none">
      <AnimatePresence>
        {toasts.map((toast) => (
          <ToastCard key={toast.id} toast={toast} onDismiss={() => dismissToast(toast.id)} />
        ))}
      </AnimatePresence>
    </div>
  );
};

const ToastCard: React.FC<{ toast: ToastItem; onDismiss: () => void }> = ({ toast, onDismiss }) => {
  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />;
      case 'info':
      default:
        return <Info className="w-4 h-4 text-cyan-400 shrink-0" />;
    }
  };

  const getBorderAndGlow = () => {
    switch (toast.type) {
      case 'success':
        return 'border-emerald-500/25 shadow-[0_8px_25px_-5px_rgba(16,185,129,0.15)]';
      case 'error':
        return 'border-rose-500/25 shadow-[0_8px_25px_-5px_rgba(244,63,94,0.15)]';
      case 'warning':
        return 'border-amber-500/25 shadow-[0_8px_25px_-5px_rgba(245,158,11,0.15)]';
      case 'info':
      default:
        return 'border-cyan-500/25 shadow-[0_8px_25px_-5px_rgba(6,182,212,0.15)]';
    }
  };

  const getProgressColor = () => {
    switch (toast.type) {
      case 'success':
        return 'bg-emerald-400';
      case 'error':
        return 'bg-rose-400';
      case 'warning':
        return 'bg-amber-400';
      case 'info':
      default:
        return 'bg-cyan-400';
    }
  };

  const duration = toast.duration || 4500;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 24, scale: 0.94 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      className={`pointer-events-auto bg-[#101218]/95 backdrop-blur-xl border ${getBorderAndGlow()} rounded-2xl p-3.5 shadow-2xl relative overflow-hidden flex flex-col justify-between`}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 p-1 rounded-lg bg-white/[0.04] border border-white/[0.06]">
          {getIcon()}
        </div>

        <div className="flex-1 min-w-0 pr-2">
          <h4 className="text-xs font-bold text-white tracking-wide truncate">
            {toast.title}
          </h4>
          {toast.message && (
            <p className="text-[11px] text-zinc-400 font-sans mt-0.5 leading-relaxed break-words">
              {toast.message}
            </p>
          )}

          {toast.action && (
            <button
              onClick={() => {
                toast.action?.onClick();
                onDismiss();
              }}
              className="mt-2 text-[11px] font-mono font-medium text-cyan-400 hover:text-cyan-300 underline underline-offset-2 flex items-center gap-1 transition"
            >
              {toast.action.label}
            </button>
          )}
        </div>

        <button
          onClick={onDismiss}
          className="text-zinc-500 hover:text-zinc-300 p-1 rounded-lg hover:bg-white/[0.05] transition shrink-0"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Auto-dismiss animated bottom progress bar */}
      {duration > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/[0.04] overflow-hidden">
          <motion.div
            initial={{ width: '100%' }}
            animate={{ width: '0%' }}
            transition={{ duration: duration / 1000, ease: 'linear' }}
            className={`h-full ${getProgressColor()}`}
          />
        </div>
      )}
    </motion.div>
  );
};