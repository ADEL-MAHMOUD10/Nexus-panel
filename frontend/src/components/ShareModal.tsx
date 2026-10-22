import React, { useState } from 'react';
import { X, Copy, Check, QrCode as QrIcon } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

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
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#12141a] border border-white/10 rounded-2xl w-full max-w-sm shadow-2xl p-6 relative flex flex-col items-center text-center">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition"
        >
          <X className="w-4 h-4" />
        </button>

        <h3 className="text-base font-bold text-white mt-1">{title}</h3>
        <p className="text-xs text-zinc-400 mt-1">Scan QR code in V2rayN, v2rayNG, Streisand or Sing-Box</p>

        {/* QR Code Container */}
        <div className="p-4 bg-white rounded-2xl shadow-xl my-5">
          <QRCodeSVG value={link} size={180} level="M" />
        </div>

        {/* Copy Link Input */}
        <div className="w-full flex items-center gap-2">
          <input
            type="text"
            readOnly
            value={link}
            className="flex-1 px-3 py-2 bg-[#0c0d12] border border-white/[0.08] rounded-xl text-xs text-zinc-300 font-mono focus:outline-none"
          />
          <button
            onClick={handleCopy}
            className={`px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-1.5 transition ${
              copied
                ? 'bg-emerald-500 text-white'
                : 'bg-white/10 hover:bg-white/15 text-white'
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
