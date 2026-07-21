import React from 'react';
import { HardDrive, ShieldAlert, ShieldCheck, Activity, Database, Cpu, Disc, FileImage } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { DriveInfo } from '../types';

interface DriveSelectorProps {
  onStartScan: () => void;
  onCreateDiskImage: () => void;
}

export const DriveSelector: React.FC<DriveSelectorProps> = ({ onStartScan, onCreateDiskImage }) => {
  const { drives, selectedDrive, setSelectedDrive, setSelectedPartition } = useAppStore();

  const formatSize = (bytes: number) => {
    const gb = bytes / (1024 * 1024 * 1024);
    return `${gb.toFixed(1)} GB`;
  };

  return (
    <div className="flex-1 p-6 overflow-y-auto space-y-6">
      {/* Header Banner */}
      <div className="glass-panel p-6 bg-gradient-to-r from-slate-900 via-slate-900/90 to-cyan-950/40 border-cyan-500/20 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <HardDrive className="w-64 h-64 text-cyan-400" />
        </div>

        <div className="flex items-center justify-between relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                RescuR Engine v2.4
              </span>
              {selectedDrive?.is_elevated ? (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" /> Administrator Access
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1">
                  <ShieldAlert className="w-3.5 h-3.5" /> User Access (Elevation Recommended)
                </span>
              )}
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Select a Drive or Volume to Scan</h1>
            <p className="text-slate-400 text-sm mt-1 max-w-xl">
              Choose a physical drive, logical partition, or disk image file. Fast Scan metadata parsing and Deep Scan raw signature carving will recover deleted files.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onCreateDiskImage}
              className="glass-button px-4 py-2.5 flex items-center gap-2 text-slate-300 hover:text-white"
            >
              <FileImage className="w-4 h-4 text-cyan-400" />
              Create RAW Image (.img)
            </button>
            <button
              disabled={!selectedDrive}
              onClick={onStartScan}
              className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 shadow-lg ${
                selectedDrive
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white glow-cyan'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
              }`}
            >
              <Activity className="w-4 h-4" />
              Search for Lost Data
            </button>
          </div>
        </div>
      </div>

      {/* Drives Grid */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 px-1 flex items-center gap-2">
          <Database className="w-4 h-4 text-cyan-400" /> Physical Drives & Storage Media
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {drives.map((drive) => {
            const isSelected = selectedDrive?.id === drive.id;
            return (
              <div
                key={drive.id}
                onClick={() => {
                  setSelectedDrive(drive);
                  setSelectedPartition(null);
                }}
                className={`glass-panel p-5 cursor-pointer transition-all border-2 relative overflow-hidden group ${
                  isSelected
                    ? 'border-cyan-500 bg-slate-900/90 shadow-cyan-950/50 shadow-2xl'
                    : 'border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/80'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3.5">
                    <div className={`p-3 rounded-xl ${isSelected ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'bg-slate-800 text-slate-400'}`}>
                      <Disc className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white group-hover:text-cyan-300 transition-colors flex items-center gap-2">
                        {drive.name}
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                        <span>{drive.drive_type}</span>
                        <span>•</span>
                        <span className="font-mono text-slate-500">{drive.device_path}</span>
                        <span>•</span>
                        <span className="text-slate-400 font-semibold">{drive.partition_table}</span>
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-sm font-bold text-white font-mono">{formatSize(drive.total_bytes)}</span>
                  </div>
                </div>

                {/* S.M.A.R.T. Health Metric Badge */}
                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                      <Cpu className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-slate-400">SMART Health:</span>
                      <span className="font-semibold text-emerald-400">{drive.smart.health_percentage}% ({drive.smart.status_text})</span>
                    </div>
                    <div className="text-slate-400">
                      Temp: <span className="text-slate-200 font-mono">{drive.smart.temperature_c}°C</span>
                    </div>
                  </div>
                  <span className="text-slate-500 font-mono text-[11px]">{drive.partitions.length} Volume(s)</span>
                </div>

                {/* Partitions List inside Drive */}
                <div className="mt-3 space-y-2">
                  {drive.partitions.map((part) => {
                    const usedPct = (part.used_bytes / part.total_bytes) * 100;
                    return (
                      <div
                        key={part.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedDrive(drive);
                          setSelectedPartition(part.id);
                        }}
                        className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/60 hover:border-cyan-500/40 transition-all text-xs flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2.5">
                          <HardDrive className="w-4 h-4 text-cyan-400" />
                          <div>
                            <span className="font-medium text-slate-200">{part.volume_name}</span>
                            <span className="text-slate-500 ml-2 font-mono">({part.file_system})</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="w-24 bg-slate-800 h-1.5 rounded-full overflow-hidden">
                            <div className="bg-cyan-500 h-full rounded-full" style={{ width: `${usedPct}%` }}></div>
                          </div>
                          <span className="text-slate-400 font-mono w-16 text-right">
                            {formatSize(part.available_bytes)} free
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
