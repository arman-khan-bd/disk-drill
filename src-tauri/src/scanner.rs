use crate::carver::CarvedFile;
use serde::{Deserialize, Serialize};
use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use tokio::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanConfig {
    /// Logical partition id, e.g. "C:" or "drive_0"
    pub drive_id: String,
    /// Raw device path to open for sector reads, e.g. r"\\.\C:" or r"\\.\PhysicalDrive0"
    pub drive_path: String,
    /// Total bytes on the volume (from DriveInfo.total_bytes) so the loop knows when to stop
    pub total_bytes: u64,
    pub enable_fast_scan: bool,
    pub enable_deep_scan: bool,
    pub sector_size: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanProgressEvent {
    pub scan_id: String,
    pub scanned_bytes: u64,
    pub total_bytes: u64,
    pub progress_percent: f32,
    pub speed_mbps: f32,
    pub eta_seconds: u64,
    pub files_found_count: usize,
    pub is_complete: bool,
    pub current_phase: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanResult {
    pub scan_id: String,
    pub drive_id: String,
    pub total_files_found: usize,
    pub scanned_bytes: u64,
    pub elapsed_seconds: u64,
    pub files: Vec<CarvedFile>,
}

pub struct ScanController {
    pub is_paused: AtomicBool,
    pub is_stopped: AtomicBool,
}

pub struct ScanManager {
    pub active_controller: Arc<Mutex<Option<Arc<ScanController>>>>,
    pub scan_results: Arc<Mutex<Option<ScanResult>>>,
}

impl ScanManager {
    pub fn new() -> Self {
        Self {
            active_controller: Arc::new(Mutex::new(None)),
            scan_results: Arc::new(Mutex::new(None)),
        }
    }
}
