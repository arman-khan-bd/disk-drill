import React, { useEffect, useState } from 'react';
import { invoke, Channel } from '@tauri-apps/api/core';
import { HardDrive, Activity, FolderSearch, Terminal, Shield, RefreshCw } from 'lucide-react';
import { useAppStore } from './store/useAppStore';
import { DriveInfo, ScanProgressEvent, ScanResult, CarvedFile } from './types';
import { DriveSelector } from './components/DriveSelector';
import { ScanProgress } from './components/ScanProgress';
import { FileExplorer } from './components/FileExplorer';
import { HexViewer } from './components/HexViewer';
import { ExportModal } from './components/ExportModal';
import { DiskImageModal } from './components/DiskImageModal';

declare global {
  interface Window {
    __TAURI_INTERNALS__?: any;
  }
}

export const App: React.FC = () => {
  const {
    selectedDrive,
    activeTab,
    setActiveTab,
    setDrives,
    isScanning,
    setIsScanning,
    setIsPaused,
    setScanProgress,
    setScannedFiles,
    hexPreviewFile,
    hexBytes,
    setHexPreview,
  } = useAppStore();

  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);


  const fetchDrives = async () => {
    try {
      if (window.__TAURI_INTERNALS__) {
        const res = await invoke<DriveInfo[]>('get_system_drives');
        setDrives(res || []);
      } else {
        const res = await invoke<DriveInfo[]>('get_system_drives');
        setDrives(res || []);
      }
    } catch (err) {
      console.error('Failed to fetch system drives from Rust IPC backend:', err);
    }
  };

  useEffect(() => {
    fetchDrives();
  }, []);

  const handleStartScan = async () => {
    if (!selectedDrive) return;

    setIsScanning(true);
    setIsPaused(false);
    setActiveTab('scan');

    if (!window.__TAURI_INTERNALS__) {
      // This app requires the native Tauri runtime to access real disk hardware.
      setIsScanning(false);
      setScanProgress({
        scan_id: '',
        scanned_bytes: 0,
        total_bytes: 0,
        progress_percent: 0,
        speed_mbps: 0,
        eta_seconds: 0,
        files_found_count: 0,
        is_complete: false,
        current_phase: 'ERROR: Please run the compiled Tauri app (not a browser). Real drive scanning requires native OS access.',
      });
      return;
    }

    // Derive the raw device path from the selected partition
    // e.g. first partition mount_point "C:\" → device "\\.\ C:"
    const firstPartition = selectedDrive.partitions[0];
    const mountPoint = firstPartition?.mount_point ?? '';
    // On Windows a mount point like "C:\" maps to device "\\.\C:"
    const driveLetter = mountPoint.length >= 2 ? mountPoint.substring(0, 2) : '';
    const drivePath = driveLetter ? `\\\\.\\${driveLetter}` : selectedDrive.device_path;

    const onProgress = new Channel<ScanProgressEvent>();
    onProgress.onmessage = (evt) => {
      setScanProgress(evt);
      if (evt.is_complete) {
        setIsScanning(false);
      }
    };

    try {
      const result = await invoke<ScanResult>('start_scan', {
        config: {
          drive_id: firstPartition?.id ?? selectedDrive.id,
          drive_path: drivePath,
          total_bytes: firstPartition?.total_bytes ?? selectedDrive.total_bytes,
          enable_fast_scan: true,
          enable_deep_scan: true,
          sector_size: 512,
        },
        channel: onProgress,
      });

      setScannedFiles(result.files);
    } catch (err) {
      console.error('Scan error:', err);
      setIsScanning(false);
    }
  };

  const handlePauseScan = async () => {
    await invoke('pause_scan');
    setIsPaused(true);
  };

  const handleResumeScan = async () => {
    await invoke('resume_scan');
    setIsPaused(false);
  };

  const handleStopScan = async () => {
    await invoke('stop_scan');
    setIsScanning(false);
  };

  const handleOpenHexViewer = async (file: CarvedFile) => {
    try {
      const bytes = await invoke<number[]>('preview_file_hex', {
        drive_id: selectedDrive?.id || 'drive_0',
        offset: file.offset_bytes,
        length: 256,
      });
      setHexPreview(file, bytes);
    } catch (err) {
      console.error('Failed to load hex bytes:', err);
    }
  };

  const handleConfirmExport = async (destinationPath: string) => {
    const { selectedFileIds, scannedFiles } = useAppStore.getState();
    const ids = Array.from(selectedFileIds);
    // Build file_paths so the backend can copy real bytes
    const filePaths = ids
      .map((id) => scannedFiles.find((f) => f.id === id))
      .filter(Boolean)
      .map((f) => ({
        file_id: f!.id,
        original_path: f!.original_path,
        file_name: f!.file_name,
      }));
    await invoke('export_files', {
      request: {
        file_ids: ids,
        destination_path: destinationPath,
        source_drive_mount: selectedDrive?.partitions[0]?.mount_point || 'C:\\',
        file_paths: filePaths,
      },
    });
  };

  const handleCreateImage = async (driveId: string, outputPath: string) => {
    await invoke('create_disk_image', { drive_id: driveId, output_path: outputPath });
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Top Navbar */}
      <header className="h-14 border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white font-bold shadow-lg shadow-cyan-950/50">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <span className="font-extrabold text-sm tracking-tight bg-gradient-to-r from-white via-slate-200 to-cyan-400 bg-clip-text text-transparent">
              RescuR Data Recovery
            </span>
            <span className="text-[10px] text-slate-500 font-mono ml-2">Tauri v2 + Rust Core</span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800/80 text-xs font-medium">
          <button
            onClick={() => setActiveTab('drives')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-2 transition-all ${
              activeTab === 'drives' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5" /> Drives & Storage
          </button>
          <button
            onClick={() => setActiveTab('scan')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-2 transition-all ${
              activeTab === 'scan' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5" /> Live Scan
          </button>
          <button
            onClick={() => setActiveTab('files')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-2 transition-all ${
              activeTab === 'files' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FolderSearch className="w-3.5 h-3.5" /> File Explorer
          </button>
        </div>

        {/* Refresh Drives */}
        <button
          onClick={fetchDrives}
          className="glass-button p-2 text-slate-400 hover:text-white"
          title="Rescan System Drives"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </header>

      {/* Main View Area */}
      <main className="flex-1 flex overflow-hidden">
        {activeTab === 'drives' && (
          <DriveSelector
            onStartScan={handleStartScan}
            onCreateDiskImage={() => setIsImageModalOpen(true)}
          />
        )}

        {activeTab === 'scan' && (
          <ScanProgress
            onPause={handlePauseScan}
            onResume={handleResumeScan}
            onStop={handleStopScan}
            onViewResults={() => setActiveTab('files')}
          />
        )}

        {activeTab === 'files' && (
          <FileExplorer
            onOpenExportModal={() => setIsExportModalOpen(true)}
            onOpenHexViewer={handleOpenHexViewer}
          />
        )}
      </main>

      {/* Modals */}
      {hexPreviewFile && (
        <HexViewer
          file={hexPreviewFile}
          bytes={hexBytes}
          onClose={() => setHexPreview(null, [])}
        />
      )}

      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        onConfirmExport={handleConfirmExport}
      />

      <DiskImageModal
        isOpen={isImageModalOpen}
        onClose={() => setIsImageModalOpen(false)}
        onCreateImage={handleCreateImage}
        driveId={selectedDrive?.id || 'drive_0'}
      />
    </div>
  );
};
