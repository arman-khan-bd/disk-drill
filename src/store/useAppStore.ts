import { create } from 'zustand';
import { DriveInfo, CarvedFile, ScanProgressEvent } from '../types';

interface AppState {
  drives: DriveInfo[];
  selectedDrive: DriveInfo | null;
  selectedPartition: string | null;
  isScanning: boolean;
  isPaused: boolean;
  scanProgress: ScanProgressEvent | null;
  scannedFiles: CarvedFile[];
  selectedFileIds: Set<string>;
  activeTab: 'drives' | 'scan' | 'files' | 'hex';
  hexPreviewFile: CarvedFile | null;
  hexBytes: number[];
  
  setDrives: (drives: DriveInfo[]) => void;
  setSelectedDrive: (drive: DriveInfo | null) => void;
  setSelectedPartition: (partitionId: string | null) => void;
  setIsScanning: (scanning: boolean) => void;
  setIsPaused: (paused: boolean) => void;
  setScanProgress: (progress: ScanProgressEvent | null) => void;
  setScannedFiles: (files: CarvedFile[]) => void;
  toggleFileSelection: (id: string) => void;
  selectAllFiles: (ids: string[]) => void;
  clearFileSelection: () => void;
  setActiveTab: (tab: 'drives' | 'scan' | 'files' | 'hex') => void;
  setHexPreview: (file: CarvedFile | null, bytes: number[]) => void;
}

export const useAppStore = create<AppState>((set) => ({
  drives: [],
  selectedDrive: null,
  selectedPartition: null,
  isScanning: false,
  isPaused: false,
  scanProgress: null,
  scannedFiles: [],
  selectedFileIds: new Set(),
  activeTab: 'drives',
  hexPreviewFile: null,
  hexBytes: [],

  setDrives: (drives) => set({ drives }),
  setSelectedDrive: (drive) => set({ selectedDrive: drive }),
  setSelectedPartition: (partitionId) => set({ selectedPartition: partitionId }),
  setIsScanning: (isScanning) => set({ isScanning }),
  setIsPaused: (isPaused) => set({ isPaused }),
  setScanProgress: (scanProgress) => set({ scanProgress }),
  setScannedFiles: (scannedFiles) => set({ scannedFiles }),
  toggleFileSelection: (id) =>
    set((state) => {
      const next = new Set(state.selectedFileIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { selectedFileIds: next };
    }),
  selectAllFiles: (ids) => set({ selectedFileIds: new Set(ids) }),
  clearFileSelection: () => set({ selectedFileIds: new Set() }),
  setActiveTab: (activeTab) => set({ activeTab }),
  setHexPreview: (hexPreviewFile, hexBytes) => set({ hexPreviewFile, hexBytes }),
}));
