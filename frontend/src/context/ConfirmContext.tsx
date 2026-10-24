import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { 
  AlertTriangle, 
  Trash2, 
  RefreshCw, 
  ArrowUpCircle, 
  HelpCircle, 
  X, 
  RotateCcw,
  ShieldAlert,
  Info
} from 'lucide-react';

export type ConfirmVariant = 'danger' | 'warning' | 'primary' | 'info';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmVariant;
  icon?: 'trash' | 'warning' | 'upgrade' | 'reset' | 'info';
}

interface ConfirmContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined);

export const useConfirm = () => {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmProvider');
  }
  return context.confirm;
};

interface DialogState {
  isOpen: boolean;
  options: ConfirmOptions;
  resolve: (val: boolean) => void;
}

export const ConfirmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [dialogState, setDialogState] = useState<DialogState | null>(null);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      setDialogState({
        isOpen: true,
        options,
        resolve,
      });
    });
  }, []);

  const handleConfirm = () => {
    if (dialogState) {
      dialogState.resolve(true);
      setDialogState(null);
    }
  };

  const handleCancel = () => {
    if (dialogState) {
      dialogState.resolve(false);
      setDialogState(null);
    }
  };

  // Keyboard navigation: Escape cancels, Enter confirms
  useEffect(() => {
    if (!dialogState) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleCancel();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleConfirm();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dialogState]);

  // Auto-focus confirm button on open
  useEffect(() => {
    if (dialogState && confirmBtnRef.current) {
      setTimeout(() => confirmBtnRef.current?.focus(), 50);
    }
  }, [dialogState]);

  const renderIcon = (options: ConfirmOptions) => {
    const variant = options.variant || 'warning';
    const iconType = options.icon || (variant === 'danger' ? 'trash' : variant === 'primary' ? 'upgrade' : 'warning');

    switch (iconType) {
      case 'trash':
        return <Trash2 className="w-5 h-5 text-rose-400" />;
      case 'upgrade':
        return <ArrowUpCircle className="w-5 h-5 text-cyan-400" />;
      case 'reset':
        return <RotateCcw className="w-5 h-5 text-amber-400" />;
      case 'info':
        return <Info className="w-5 h-5 text-blue-400" />;
      default:
        return variant === 'danger' ? (
          <AlertTriangle className="w-5 h-5 text-rose-400" />
        ) : (
          <ShieldAlert className="w-5 h-5 text-amber-400" />
        );
    }
  };

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}

      {/* Confirmation Modal Overlay */}
      {dialogState && (
        <div 
          className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 select-none animate-in fade-in duration-150"
          onClick={handleCancel}
        >
          <div 
            className="relative w-full max-w-md bg-[#0c0d14]/95 backdrop-blur-2xl border border-white/[0.12] rounded-2xl p-5 sm:p-6 shadow-[0_25px_60px_rgba(0,0,0,0.9)] overflow-hidden animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Glowing Decorative Stripe */}
            <div 
              className={`absolute top-0 left-0 right-0 h-1 ${
                dialogState.options.variant === 'danger'
                  ? 'bg-gradient-to-r from-rose-500 via-rose-600 to-amber-500'
                  : dialogState.options.variant === 'primary'
                  ? 'bg-gradient-to-r from-cyan-500 via-blue-500 to-emerald-500'
                  : 'bg-gradient-to-r from-amber-500 to-orange-500'
              }`}
            />

            {/* Header: Icon & Close button */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div 
                  className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border ${
                    dialogState.options.variant === 'danger'
                      ? 'bg-rose-500/15 border-rose-500/30 shadow-lg shadow-rose-950/40'
                      : dialogState.options.variant === 'primary'
                      ? 'bg-cyan-500/15 border-cyan-500/30 shadow-lg shadow-cyan-950/40'
                      : 'bg-amber-500/15 border-amber-500/30 shadow-lg shadow-amber-950/40'
                  }`}
                >
                  {renderIcon(dialogState.options)}
                </div>

                <div>
                  <h3 className="text-base sm:text-lg font-bold text-white tracking-tight font-sans">
                    {dialogState.options.title}
                  </h3>
                  <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 font-semibold">
                    {dialogState.options.variant === 'danger' 
                      ? 'Critical Action' 
                      : dialogState.options.variant === 'primary' 
                      ? 'System Action' 
                      : 'Confirmation Required'}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCancel}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.08] transition"
                title="Cancel (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Message Body */}
            <div className="my-4">
              <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed font-sans">
                {dialogState.options.message}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-white/[0.06]">
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.1] text-zinc-300 hover:text-white text-xs font-semibold transition active:scale-95 cursor-pointer"
              >
                {dialogState.options.cancelText || 'Cancel'}
              </button>

              <button
                ref={confirmBtnRef}
                type="button"
                onClick={handleConfirm}
                className={`px-5 py-2.5 rounded-xl text-xs font-semibold transition transform active:scale-95 cursor-pointer flex items-center justify-center gap-2 ${
                  dialogState.options.variant === 'danger'
                    ? 'bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white shadow-[0_0_20px_rgba(244,63,94,0.35)]'
                    : dialogState.options.variant === 'primary'
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-[0_0_20px_rgba(6,182,212,0.35)]'
                    : 'bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white shadow-[0_0_20px_rgba(245,158,11,0.35)]'
                }`}
              >
                <span>{dialogState.options.confirmText || 'Confirm'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
};
