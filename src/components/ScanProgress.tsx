import React from 'react';
import { Pause, Play, Square, Activity, Clock, ShieldCheck, FileCheck, Layers } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

interface ScanProgressProps {
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onViewResults: () => void;
}

export const ScanProgress: React.FC<ScanProgressProps> = ({ onPause, onResume, onStop, onViewResults }) => {
  const { scanProgress, isPaused, selectedDrive, drives, setSelectedDrive } = useAppStore();

  const progress = scanProgress?.progress_percent || 0;
  const scannedGb = ((scanProgress?.scanned_bytes || 0) / (1024 * 1024 * 1024)).toFixed(2);
  const totalGb = ((scanProgress?.total_bytes || 1) / (1024 * 1024 * 1024)).toFixed(2);

  const formatEta = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  return (
    <div className="flex-1 p-6 flex flex-col items-center justify-center max-w-4xl mx-auto w-full space-y-6">
      {/* Target Drive Selector & Badge */}
      <div className="flex items-center gap-3 px-5 py-2.5 rounded-2xl glass-panel bg-slate-900/90 border-slate-800 text-xs shadow-lg">
        <span className="text-slate-400 font-medium">Scanning Target:</span>
        <select
          value={selectedDrive?.id || ''}
          onChange={(e) => {
            const drive = drives.find((d) => d.id === e.target.value);
            if (drive) setSelectedDrive(drive);
          }}
          className="bg-slate-950 border border-slate-700/70 text-cyan-400 font-semibold rounded-lg px-3 py-1.5 focus:outline-none focus:border-cyan-500 cursor-pointer"
        >
          {drives.map((d) => (
            <option key={d.id} value={d.id} className="bg-slate-900 text-slate-200">
              {d.name} ({d.device_path}) — {(d.total_bytes / (1024 * 1024 * 1024)).toFixed(1)} GB
            </option>
          ))}
        </select>
        <span className="text-slate-600">|</span>
        <span className="text-slate-400 font-mono">{selectedDrive?.partitions[0]?.mount_point || 'C:\\'} ({selectedDrive?.partitions[0]?.file_system || 'NTFS'})</span>
      </div>

      {/* Circular Progress & Radar Ring */}
      <div className="relative flex items-center justify-center p-8">
        <div className="w-64 h-64 rounded-full border-4 border-slate-800 flex items-center justify-center relative shadow-2xl">
          <svg className="w-full h-full transform -rotate-90 absolute top-0 left-0">
            <circle
              cx="128"
              cy="128"
              r="116"
              stroke="currentColor"
              strokeWidth="12"
              className="text-slate-800"
              fill="transparent"
            />
            <circle
              cx="128"
              cy="128"
              r="116"
              stroke="currentColor"
              strokeWidth="12"
              strokeDasharray={2 * Math.PI * 116}
              strokeDashoffset={2 * Math.PI * 116 * (1 - progress / 100)}
              strokeLinecap="round"
              className="text-cyan-500 transition-all duration-300 ease-out"
              fill="transparent"
            />
          </svg>

          <div className="text-center z-10 space-y-1">
            <div className="text-4xl font-extrabold text-white tracking-tight font-mono">
              {progress.toFixed(1)}%
            </div>
            <div className="text-xs font-semibold text-cyan-400 tracking-wider uppercase">
              {scanProgress?.current_phase || 'Scanning Sectors...'}
            </div>
            <div className="text-xs text-slate-400 font-mono mt-1">
              {scannedGb} / {totalGb} GB
            </div>
          </div>
        </div>
      </div>

      {/* Metrics Cards Grid */}
      <div className="grid grid-cols-4 gap-4 w-full">
        <div className="glass-panel p-4 text-center">
          <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400 mb-1">
            <Activity className="w-3.5 h-3.5 text-cyan-400" /> Read Speed
          </div>
          <div className="text-xl font-bold text-white font-mono">
            {scanProgress?.speed_mbps.toFixed(1) || '0.0'} <span className="text-xs font-normal text-slate-400">MB/s</span>
          </div>
        </div>

        <div className="glass-panel p-4 text-center">
          <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400 mb-1">
            <Clock className="w-3.5 h-3.5 text-cyan-400" /> ETA
          </div>
          <div className="text-xl font-bold text-white font-mono">
            {formatEta(scanProgress?.eta_seconds || 0)}
          </div>
        </div>

        <div className="glass-panel p-4 text-center">
          <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400 mb-1">
            <FileCheck className="w-3.5 h-3.5 text-emerald-400" /> Recoverable Files
          </div>
          <div className="text-xl font-bold text-emerald-400 font-mono">
            {scanProgress?.files_found_count || 0}
          </div>
        </div>

        <div className="glass-panel p-4 text-center">
          <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400 mb-1">
            <Layers className="w-3.5 h-3.5 text-cyan-400" /> Engine Status
          </div>
          <div className="text-xs font-semibold text-cyan-400 mt-2">
            {scanProgress?.is_complete ? 'Completed' : isPaused ? 'Paused' : 'Active Carving'}
          </div>
        </div>
      </div>

      {/* Action Controls */}
      <div className="flex items-center gap-4 pt-4">
        {scanProgress?.is_complete ? (
          <button
            onClick={onViewResults}
            className="px-8 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-semibold shadow-lg shadow-emerald-950/50 flex items-center gap-2"
          >
            <ShieldCheck className="w-5 h-5" /> Review Recoverable Files ({scanProgress.files_found_count})
          </button>
        ) : (
          <>
            {isPaused ? (
              <button
                onClick={onResume}
                className="glass-button px-6 py-2.5 flex items-center gap-2 text-cyan-400 border-cyan-500/30"
              >
                <Play className="w-4 h-4" /> Resume Scan
              </button>
            ) : (
              <button
                onClick={onPause}
                className="glass-button px-6 py-2.5 flex items-center gap-2 text-amber-400 border-amber-500/30"
              >
                <Pause className="w-4 h-4" /> Pause Scan
              </button>
            )}

            <button
              onClick={onStop}
              className="glass-button px-6 py-2.5 flex items-center gap-2 text-rose-400 border-rose-500/30 hover:bg-rose-950/30"
            >
              <Square className="w-4 h-4" /> Stop & Save Session
            </button>
          </>
        )}
      </div>
    </div>
  );
};
