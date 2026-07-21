import React, { useState } from 'react';
import { FileImage, X, Folder, AlertCircle } from 'lucide-react';

interface DiskImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateImage: (driveId: string, outputPath: string) => Promise<void>;
  driveId: string;
}

export const DiskImageModal: React.FC<DiskImageModalProps> = ({ isOpen, onClose, onCreateImage, driveId }) => {
  const [outputPath, setOutputPath] = useState<string>('D:\\Disk_Clones\\PhysicalDrive0_Backup.img');
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCreate = async () => {
    setIsCreating(true);
    setErrorMsg(null);
    try {
      await onCreateImage(driveId, outputPath);
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.toString() || 'Failed to create RAW disk image');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-6">
      <div className="glass-panel w-full max-w-md bg-slate-900 border-slate-700/80 shadow-2xl overflow-hidden p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileImage className="w-5 h-5 text-cyan-400" />
            <h3 className="font-semibold text-base text-white">Create Byte-for-Byte RAW Image</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">
          Clone the selected physical disk sector-by-sector into an uncompressed <strong className="text-slate-200">.img</strong> file. You can safely perform deep scans on this image file without stressing failing hardware.
        </p>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-300">Destination Image Path</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={outputPath}
              onChange={(e) => setOutputPath(e.target.value)}
              className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
            />
            <button className="glass-button px-3 py-2 text-xs text-slate-300 flex items-center gap-1">
              <Folder className="w-3.5 h-3.5 text-cyan-400" /> Browse
            </button>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" /> {errorMsg}
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-2">
          <button onClick={onClose} className="glass-button px-4 py-2 text-xs text-slate-400">
            Cancel
          </button>
          <button
            disabled={isCreating}
            onClick={handleCreate}
            className="px-5 py-2 rounded-lg text-xs font-semibold bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-lg shadow-cyan-950/50"
          >
            {isCreating ? 'Cloning Sectors...' : 'Start Creating Image'}
          </button>
        </div>
      </div>
    </div>
  );
};
