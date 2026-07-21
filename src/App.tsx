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

  const MOCK_DRIVES: DriveInfo[] = [
    {
      id: 'drive_0',
      name: 'Physical Drive 0 (NVMe SSD)',
      device_path: '\\\\.\\PhysicalDrive0',
      drive_type: 'NVMe SSD',
      total_bytes: 512000000000,
      partition_table: 'GPT',
      is_elevated: true,
      smart: {
        health_percentage: 98,
        temperature_c: 38,
        read_errors: 0,
        write_errors: 0,
        power_on_hours: 1420,
        status_text: 'GOOD',
      },
      partitions: [
        {
          id: 'C:',
          mount_point: 'C:\\',
          volume_name: 'Windows (C:)',
          file_system: 'NTFS',
          total_bytes: 450000000000,
          available_bytes: 120000000000,
          used_bytes: 330000000000,
          is_removable: false,
        },
        {
          id: 'D:',
          mount_point: 'D:\\',
          volume_name: 'Data Volume (D:)',
          file_system: 'exFAT',
          total_bytes: 620000000000,
          available_bytes: 250000000000,
          used_bytes: 370000000000,
          is_removable: false,
        },
      ],
    },
    {
      id: 'drive_1',
      name: 'Physical Drive 1 (SanDisk Ultra USB)',
      device_path: '\\\\.\\PhysicalDrive1',
      drive_type: 'USB Flash Drive',
      total_bytes: 64000000000,
      partition_table: 'MBR',
      is_elevated: true,
      smart: {
        health_percentage: 100,
        temperature_c: 31,
        read_errors: 0,
        write_errors: 0,
        power_on_hours: 120,
        status_text: 'HEALTHY',
      },
      partitions: [
        {
          id: 'E:',
          mount_point: 'E:\\',
          volume_name: 'RECOVERY_USB (E:)',
          file_system: 'FAT32',
          total_bytes: 64000000000,
          available_bytes: 48000000000,
          used_bytes: 16000000000,
          is_removable: true,
        },
      ],
    },
  ];

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
      // Browser simulation mode
      let progress = 0;
      const interval = setInterval(() => {
        progress += 10;
        setScanProgress({
          scan_id: 'scan_preview_101',
          scanned_bytes: (progress / 100) * selectedDrive.total_bytes,
          total_bytes: selectedDrive.total_bytes,
          progress_percent: progress,
          speed_mbps: 420.5,
          eta_seconds: Math.max(0, Math.floor((100 - progress) / 10)),
          files_found_count: Math.floor(progress * 1.4),
          is_complete: progress >= 100,
          current_phase: progress < 20 ? 'Fast Scan (File System Parsing)' : 'Deep Scan (Sector Carving)',
        });

        if (progress >= 100) {
          clearInterval(interval);
          setIsScanning(false);
          setScannedFiles([
            {
              id: 'file_1',
              file_name: 'Financial_Report_2025.docx',
              extension: 'docx',
              category: 'Documents',
              start_sector: 2048,
              offset_bytes: 1048576,
              size_bytes: 4194304,
              recovery_health: 'High',
              hash_md5: 'e10adc3949ba59abbe56e057f20f883e',
              date_modified: '2026-07-21 09:30:00',
              is_deleted: true,
              original_path: '/Documents/Work/Financial_Report_2025.docx',
            },
            {
              id: 'file_2',
              file_name: 'Vacation_Photo_001.jpg',
              extension: 'jpg',
              category: 'Images',
              start_sector: 4096,
              offset_bytes: 2097152,
              size_bytes: 6291456,
              recovery_health: 'High',
              hash_md5: 'c3335a3d07d4e4acab845f9a65f8f41e',
              date_modified: '2026-07-21 08:15:20',
              is_deleted: true,
              original_path: '/Photos/Vacation_Photo_001.jpg',
            },
            {
              id: 'file_3',
              file_name: 'Promo_Video.mp4',
              extension: 'mp4',
              category: 'Video',
              start_sector: 16384,
              offset_bytes: 8388608,
              size_bytes: 356515840,
              recovery_health: 'High',
              hash_md5: '7d793037a0760186574b0282f2f435e7',
              date_modified: '2026-07-20 14:22:10',
              is_deleted: true,
              original_path: '/Videos/Marketing/Promo_Video.mp4',
            },
          ]);
        }
      }, 500);
      return;
    }

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
          drive_id: selectedDrive.id,
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
    const { selectedFileIds } = useAppStore.getState();
    await invoke('export_files', {
      request: {
        file_ids: Array.from(selectedFileIds),
        destination_path: destinationPath,
        source_drive_mount: selectedDrive?.partitions[0]?.mount_point || 'C:\\',
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
