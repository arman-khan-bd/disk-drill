import React, { useState } from 'react';
import { AlertOctagon, Download, Folder, X, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmExport: (destinationPath: string) => Promise<void>;
}

export const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose, onConfirmExport }) => {
  const { selectedDrive, selectedFileIds } = useAppStore();
  const [destinationPath, setDestinationPath] = useState<string>('D:\\RescuR_Recovered_Files');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);

  if (!isOpen) return null;

  const sourceLetter = selectedDrive?.partitions[0]?.mount_point?.slice(0, 1) || 'C';
  const destLetter = destinationPath.trim().slice(0, 1).toUpperCase();
  const isSameDriveConflict = sourceLetter.toUpperCase() === destLetter;

  const handleExport = async () => {
    if (isSameDriveConflict) {
      setErrorMsg(
        `CRITICAL SAFETY GUARD: Target destination drive (${destLetter}:) matches source drive being scanned (${sourceLetter}:). Writing files onto the same partition will overwrite raw unallocated sectors!`
      );
      return;
    }

    setErrorMsg(null);
    setIsExporting(true);

    try {
      await onConfirmExport(destinationPath);
      setIsSuccess(true);
    } catch (err: any) {
      setErrorMsg(err?.toString() || 'Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-6">
      <div className="glass-panel w-full max-w-lg bg-slate-900 border-slate-700/80 shadow-2xl overflow-hidden p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Download className="w-5 h-5 text-cyan-400" />
            <h3 className="font-semibold text-base text-white">Recover Selected Files ({selectedFileIds.size})</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {isSuccess ? (
          <div className="py-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h4 className="text-lg font-bold text-white">Recovery Completed Successfully!</h4>
            <p className="text-xs text-slate-400">
              All selected files have been safely restored to <span className="font-mono text-cyan-400">{destinationPath}</span>.
            </p>
            <button
              onClick={onClose}
              className="px-6 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white font-semibold text-xs"
            >
              Done
            </button>
          </div>
        ) : (
          <>
            {/* Same Drive Warning Box */}
            {isSameDriveConflict && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-start gap-3">
                <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <strong className="font-bold">Same-Drive Collision Warning:</strong>
                  <p className="mt-0.5 text-rose-300/90 leading-relaxed">
                    Target destination folder is located on drive <strong className="underline">{destLetter}:</strong>, which is the same drive being scanned! Choose a different drive or external USB.
                  </p>
                </div>
              </div>
            )}

            {/* Path Selector */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300">Target Export Folder Path</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={destinationPath}
                  onChange={(e) => {
                    setDestinationPath(e.target.value);
                    setErrorMsg(null);
                  }}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
                />
                <button
                  onClick={() => setDestinationPath('E:\\RescuR_Safe_Recovery')}
                  className="glass-button px-3 py-2 flex items-center gap-1.5 text-xs text-slate-300"
                >
                  <Folder className="w-4 h-4 text-cyan-400" /> Browse
                </button>
              </div>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
                <AlertOctagon className="w-4 h-4 shrink-0" /> {errorMsg}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button onClick={onClose} className="glass-button px-4 py-2 text-xs text-slate-400">
                Cancel
              </button>
              <button
                disabled={isExporting || isSameDriveConflict}
                onClick={handleExport}
                className={`px-5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 ${
                  isSameDriveConflict
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
                    : 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white shadow-lg'
                }`}
              >
                {isExporting ? 'Restoring Sectors...' : 'Start Safe Recovery'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
