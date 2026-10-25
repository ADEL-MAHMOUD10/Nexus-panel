import React, { useState } from 'react';
import { ShieldCheck, Plus, Check, Clock, Globe, RefreshCw, AlertCircle } from 'lucide-react';
import { SSLCertificate } from '../types';

interface CertificatesPageProps {
  certificates: SSLCertificate[];
  onIssueCertificate: (domain: string) => Promise<boolean>;
  onRefresh: () => void;
  isIssuing: boolean;
}

export const CertificatesPage: React.FC<CertificatesPageProps> = ({
  certificates,
  onIssueCertificate,
  onRefresh,
  isIssuing,
}) => {
  const [domainInput, setDomainInput] = useState('');
  const [showModal, setShowModal] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!domainInput.trim()) return;
    const ok = await onIssueCertificate(domainInput.trim());
    if (ok) {
      setDomainInput('');
      setShowModal(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Issue Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-white tracking-tight">SSL Certificates & Let's Encrypt ACME</h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Auto-detected host certificates & automated ACME HTTP-01 SSL certificate management.
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-white hover:bg-neutral-200 text-neutral-950 font-semibold rounded-xl text-xs flex items-center gap-2 shadow-sm transition active:scale-95 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Issue New Certificate</span>
        </button>
      </div>

      {/* Certificates Cards Grid */}
      {certificates.length === 0 ? (
        <div className="py-20 text-center bg-[#0c0d10] border border-neutral-800 rounded-2xl p-8">
          <ShieldCheck className="w-10 h-10 text-neutral-600 mx-auto mb-3 opacity-60" />
          <h3 className="text-base font-semibold text-neutral-300">No SSL Certificates Found</h3>
          <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">
            Click "Issue New Certificate" above to issue a free Let's Encrypt SSL certificate for your domain.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {certificates.map((cert, index) => (
            <div
              key={index}
              className="bg-[#0c0d10] rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-white">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-white font-mono">{cert.domain}</h4>
                      <span className="text-[11px] text-neutral-400">{cert.issuer || "Let's Encrypt"}</span>
                    </div>
                  </div>

                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold ${
                      cert.isExpired
                        ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    }`}
                  >
                    {cert.isExpired ? 'Expired' : `${cert.expiresInDays} days left`}
                  </span>
                </div>

                {/* File Paths */}
                <div className="mt-4 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] space-y-2 text-xs font-mono">
                  <div>
                    <span className="text-zinc-500 block text-[10px] uppercase">Certificate File</span>
                    <span className="text-zinc-300 break-all">{cert.certPath}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block text-[10px] uppercase">Private Key File</span>
                    <span className="text-zinc-300 break-all">{cert.keyPath}</span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between text-[11px] text-zinc-500 font-mono">
                <span>Valid: {cert.validFrom}</span>
                <span>To: {cert.validTo}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Issue Certificate Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0c0d10] border border-neutral-800 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <h3 className="text-base font-semibold text-white tracking-tight">Issue Free Let's Encrypt SSL</h3>
            <p className="text-xs text-neutral-400 mt-1">
              Ensure your domain's DNS A-record points to this server IP and port 80 is not blocked.
            </p>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                  Domain Name
                </label>
                <input
                  type="text"
                  required
                  value={domainInput}
                  onChange={(e) => setDomainInput(e.target.value)}
                  placeholder="e.g. sub.yourdomain.com"
                  className="w-full px-3.5 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-xs text-white font-mono placeholder-neutral-500 focus:outline-none focus:border-neutral-600"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl text-xs text-neutral-400 hover:text-white transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isIssuing}
                  className="px-4 py-2 bg-white hover:bg-neutral-200 text-neutral-950 font-semibold rounded-xl text-xs transition active:scale-95 shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isIssuing ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Issuing...</span>
                    </>
                  ) : (
                    <span>Issue Certificate</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
