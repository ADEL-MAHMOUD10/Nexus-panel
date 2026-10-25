import React, { useState, useRef, useEffect } from 'react';
import { 
  Database, 
  Download, 
  UploadCloud, 
  X, 
  CheckCircle2, 
  AlertTriangle, 
  FileCheck, 
  ShieldCheck,
  RefreshCw,
  HardDrive
} from 'lucide-react';
import api from '../services/api';
import { useNotification } from '../context/NotificationContext';
import { useConfirm } from '../context/ConfirmContext';

interface BackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRestoreSuccess?: () => void;
}

export const BackupModal: React.FC<BackupModalProps> = ({
  isOpen,
  onClose,
  onRestoreSuccess,
}) => {
  const { notify } = useNotification();
  const confirm = useConfirm();
  const [isDownloading, setIsDownloading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Handle One-Click Backup Download
  const handleDownloadBackup = async () => {
    setIsDownloading(true);
    try {
      const res = await api.get('/api/server/backup', { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/x-sqlite3' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
      a.download = `nexus-backup-${timestamp}.db`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      notify.success('Backup Downloaded', 'Full SQLite database snapshot downloaded successfully.');
    } catch (e: any) {
      notify.error('Download Failed', e.response?.data?.message || 'Failed to download database backup snapshot.');
    } finally {
      setIsDownloading(false);
    }
  };

  // Handle Drag & Drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.name.endsWith('.db') || file.name.endsWith('.sqlite')) {
        setSelectedFile(file);
      } else {
        notify.warning('Invalid File Type', 'Please upload a valid .db SQLite database file.');
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  };

  // Handle Restore
  const handleRestore = async () => {
    if (!selectedFile) return;

    const ok = await confirm({
      title: 'Restore Database Snapshot?',
      message: `Restoring "${selectedFile.name}" will overwrite all current inbounds, client accounts, and settings with the uploaded backup. A safety backup (.bak) of your current database will be saved automatically.\n\nDo you want to proceed?`,
      confirmText: 'Yes, Restore Database',
      cancelText: 'Cancel',
      isDanger: true,
    });

    if (!ok) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('db', selectedFile);

    try {
      const res = await api.post('/api/server/restore', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (res.data && res.data.success) {
        notify.success('Database Restored', res.data.message || 'Database restored and synchronized successfully.');
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        if (onRestoreSuccess) {
          onRestoreSuccess();
        }
        onClose();
      } else {
        notify.error('Restore Failed', res.data?.message || 'Failed to restore database.');
      }
    } catch (e: any) {
      notify.error('Restore Failed', e.response?.data?.message || e.message || 'Database validation or restore error.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 cursor-pointer"
    >
      <div 
        className="w-full max-w-2xl bg-white dark:bg-[#161617] border border-neutral-200/80 dark:border-neutral-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden relative animate-in zoom-in-95 duration-200 cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4.5 border-b border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#161617] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 flex items-center justify-center text-neutral-800 dark:text-white">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-neutral-900 dark:text-white tracking-tight">Backup & Disaster Recovery</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700 font-bold">
                  SQLite WAL
                </span>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 font-medium">
                Download a complete database snapshot or restore from a previously exported backup file.
              </p>
            </div>
          </div>

          {/* Tactile Rotating Close Button */}
          <button
            type="button"
            onClick={onClose}
            title="Close modal (Esc)"
            className="group/close p-2 rounded-xl text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-900/60 dark:hover:bg-neutral-800 border border-neutral-200 dark:border-neutral-800/80 hover:border-neutral-300 dark:hover:border-neutral-700 transition-all duration-200 active:scale-90 flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <span className="hidden sm:inline text-[10px] font-mono font-semibold text-neutral-500 group-hover/close:text-neutral-700 dark:group-hover/close:text-neutral-300">Esc</span>
            <X className="w-4 h-4 transition-transform duration-200 group-hover/close:rotate-90 group-hover/close:scale-110" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto bg-neutral-50/50 dark:bg-transparent">
          {/* Section 1: One-Click Export */}
          <div className="p-5 rounded-2xl bg-white dark:bg-neutral-900/40 border border-neutral-200/80 dark:border-neutral-800 space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 flex items-center justify-center text-neutral-800 dark:text-white">
                  <Download className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-neutral-900 dark:text-white uppercase tracking-wider">Export Database Backup</h4>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400">Creates an atomic, consistent SQLite snapshot including all inbounds, accounts, and settings.</p>
                </div>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400 font-mono">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span>Zero-downtime VACUUM snapshot</span>
              </div>

              <button
                type="button"
                onClick={handleDownloadBackup}
                disabled={isDownloading}
                className="px-4 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-200 text-white dark:text-neutral-950 font-semibold text-xs flex items-center gap-2 shadow-sm transition active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {isDownloading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Exporting Snapshot...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Download Backup (.db)</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Section 2: One-Click Restore */}
          <div className="p-5 rounded-2xl bg-white dark:bg-neutral-900/40 border border-neutral-200/80 dark:border-neutral-800 space-y-4 shadow-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 flex items-center justify-center text-neutral-800 dark:text-white">
                <UploadCloud className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-neutral-900 dark:text-white uppercase tracking-wider">Restore Database Snapshot</h4>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400">Upload a valid SQLite backup (.db) to restore your configuration on this server.</p>
              </div>
            </div>

            {/* Drop Zone Area */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-2 ${
                isDragOver 
                  ? 'border-blue-500 bg-blue-500/10' 
                  : selectedFile
                    ? 'border-emerald-500/50 bg-emerald-500/[0.04]'
                    : 'border-neutral-300 hover:border-neutral-400 dark:border-neutral-800 dark:hover:border-neutral-700 bg-neutral-50/80 hover:bg-neutral-100/80 dark:bg-neutral-950/40 dark:hover:bg-neutral-900/40'
              }`}
            >
              <input 
                ref={fileInputRef}
                type="file" 
                accept=".db,.sqlite" 
                onChange={handleFileChange} 
                className="hidden" 
              />

              {selectedFile ? (
                <>
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-500 dark:text-emerald-400">
                    <FileCheck className="w-5 h-5" />
                  </div>
                  <div className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">{selectedFile.name}</div>
                  <div className="text-[11px] font-mono text-neutral-500 dark:text-neutral-400">
                    {(selectedFile.size / 1024).toFixed(1)} KB • Click to change file
                  </div>
                </>
              ) : (
                <>
                  <div className="w-10 h-10 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 flex items-center justify-center text-neutral-500 dark:text-neutral-400">
                    <HardDrive className="w-5 h-5" />
                  </div>
                  <div className="text-xs text-neutral-700 dark:text-neutral-300 font-medium">
                    Drag and drop your <span className="font-mono text-neutral-900 dark:text-white">nexus-backup.db</span> file here, or browse
                  </div>
                  <div className="text-[10px] text-neutral-400 dark:text-neutral-500 font-mono">
                    Supported format: SQLite 3 Database (*.db)
                  </div>
                </>
              )}
            </div>

            {/* Warning Callout */}
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-300/90 font-sans leading-relaxed">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
              <span>
                Restoring will replace the database and re-sync Xray-core listeners. An automatic rollback copy (<span className="font-mono font-semibold">nexus.db.bak</span>) is preserved on the server.
              </span>
            </div>

            {/* Restore Action Button */}
            {selectedFile && (
              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={handleRestore}
                  disabled={isUploading}
                  className="px-5 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-200 text-white dark:text-neutral-950 font-semibold text-xs flex items-center gap-2 shadow-sm transition active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  {isUploading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Validating & Restoring...</span>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-4 h-4" />
                      <span>Apply & Restore Database</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
