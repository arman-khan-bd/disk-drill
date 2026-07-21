export type FileCategory = 'Images' | 'Documents' | 'Video' | 'Audio' | 'Archives' | 'Executable' | 'Other';

export interface PartitionInfo {
  id: string;
  mount_point: string;
  volume_name: string;
  file_system: string;
  total_bytes: number;
  available_bytes: number;
  used_bytes: number;
  is_removable: boolean;
}

export interface SmartStatus {
  health_percentage: number;
  temperature_c: number;
  read_errors: number;
  write_errors: number;
  power_on_hours: number;
  status_text: string;
}

export interface DriveInfo {
  id: string;
  name: string;
  device_path: string;
  drive_type: string;
  total_bytes: number;
  partitions: PartitionInfo[];
  partition_table: string;
  smart: SmartStatus;
  is_elevated: boolean;
}

export interface CarvedFile {
  id: string;
  file_name: string;
  extension: string;
  category: FileCategory;
  start_sector: number;
  offset_bytes: number;
  size_bytes: number;
  recovery_health: 'High' | 'Medium' | 'Overwritten';
  hash_md5: string;
  date_modified: string;
  is_deleted: boolean;
  original_path: string;
}

export interface ScanProgressEvent {
  scan_id: string;
  scanned_bytes: number;
  total_bytes: number;
  progress_percent: number;
  speed_mbps: number;
  eta_seconds: number;
  files_found_count: number;
  is_complete: boolean;
  current_phase: string;
}

export interface ScanResult {
  scan_id: string;
  drive_id: string;
  total_files_found: number;
  scanned_bytes: number;
  elapsed_seconds: number;
  files: CarvedFile[];
}

export interface ExportSummary {
  success_count: number;
  failed_count: number;
  total_bytes_restored: number;
  output_directory: string;
}
