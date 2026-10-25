import React, { useState, useEffect } from 'react';
import { X, Copy, Check, QrCode as QrIcon } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useNotification } from '../context/NotificationContext';
import { copyToClipboard } from '../utils/clipboard';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  link: string;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  title,
  link,
}) => {
  const { notify } = useNotification();
  const [copied, setCopied] = useState(false);

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

  const handleCopy = async () => {
    const success = await copyToClipboard(link);
    if (success) {
      setCopied(true);
      notify.success('Copied to Clipboard', 'Connection link copied successfully.');
      setTimeout(() => setCopied(false), 2000);
    } else {
      notify.error('Copy Failed', 'Could not copy link automatically. Please select and copy manually.');
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
        className="bg-white dark:bg-[#161617] border border-neutral-200/80 dark:border-neutral-800 rounded-2xl w-full max-w-sm shadow-2xl p-6 relative flex flex-col items-center text-center animate-in zoom-in-95 duration-200 cursor-default"
      >
        <button
          type="button"
          onClick={onClose}
          title="Close modal (Esc)"
          className="group/close absolute top-4 right-4 p-2 rounded-xl text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-900/60 dark:hover:bg-neutral-800 border border-neutral-200 dark:border-neutral-800/80 hover:border-neutral-300 dark:hover:border-neutral-700 transition-all duration-200 active:scale-90 flex items-center gap-1 cursor-pointer shadow-xs"
        >
          <span className="text-[10px] font-mono font-semibold text-neutral-500 group-hover/close:text-neutral-700 dark:group-hover/close:text-neutral-300">Esc</span>
          <X className="w-4 h-4 transition-transform duration-200 group-hover/close:rotate-90 group-hover/close:scale-110" />
        </button>

        <h3 className="text-base font-bold text-neutral-900 dark:text-white mt-1">{title}</h3>
        <p className="text-xs text-neutral-500 dark:text-zinc-400 mt-1">Scan QR code in V2rayN, v2rayNG, Streisand or Sing-Box</p>

        {/* QR Code Container */}
        <div className="p-4 bg-white rounded-2xl shadow-xl my-5 border border-neutral-100 dark:border-transparent">
          <QRCodeSVG value={link} size={180} level="M" />
        </div>

        {/* Copy Link Input */}
        <div className="w-full flex items-center gap-2">
          <input
            type="text"
            readOnly
            value={link}
            onClick={(e) => (e.target as HTMLInputElement).select()}
            className="flex-1 px-3 py-2 bg-neutral-50 dark:bg-[#08090d] border border-neutral-200 dark:border-white/[0.08] rounded-xl text-xs text-neutral-800 dark:text-zinc-300 font-mono focus:outline-none cursor-pointer"
          />
          <button
            onClick={handleCopy}
            className={`px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-1.5 transition cursor-pointer shrink-0 ${
              copied
                ? 'bg-emerald-500 text-white'
                : 'bg-neutral-900 hover:bg-neutral-800 dark:bg-white/10 dark:hover:bg-white/15 text-white active:scale-95'
            }`}
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
