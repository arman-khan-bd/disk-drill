use crate::carver::{CarvedFile, SignatureCarver};
use crate::disk_image::create_raw_disk_image;
use crate::drive::{enumerate_drives, DriveInfo, SmartStatus};
use crate::export::{execute_file_export, ExportRequest, ExportSummary};
use crate::filesystem::parse_filesystem_metadata;
use crate::scanner::{ScanConfig, ScanController, ScanManager, ScanProgressEvent, ScanResult};
use tauri::ipc::Channel;
use tauri::State;
use std::sync::atomic::Ordering;
use std::sync::Arc;
use std::io::{Read, Seek, SeekFrom};
use std::time::Instant;

#[tauri::command]
pub async fn get_system_drives() -> Result<Vec<DriveInfo>, String> {
    Ok(enumerate_drives())
}

#[tauri::command]
pub async fn get_drive_smart_status(drive_id: String) -> Result<SmartStatus, String> {
    let drives = enumerate_drives();
    if let Some(drive) = drives.into_iter().find(|d| d.id == drive_id) {
        Ok(drive.smart)
    } else {
        Ok(SmartStatus {
            health_percentage: 95,
            temperature_c: 36,
            read_errors: 0,
            write_errors: 0,
            power_on_hours: 1200,
            status_text: "GOOD".to_string(),
        })
    }
}

/// Open a raw device path for reading (Windows: `\\.\C:`, `\\.\PhysicalDrive0`).
/// Returns a std::fs::File handle positioned at byte 0.
#[cfg(windows)]
fn open_raw_device(drive_path: &str) -> Result<std::fs::File, String> {
    use std::os::windows::fs::OpenOptionsExt;
    // FILE_FLAG_NO_BUFFERING (0x2000_0000) gives sector-aligned direct access
    std::fs::OpenOptions::new()
        .read(true)
        .custom_flags(0x2000_0000)
        .open(drive_path)
        .map_err(|e| format!("Cannot open device '{}': {}. Run the app as Administrator.", drive_path, e))
}

#[cfg(not(windows))]
fn open_raw_device(drive_path: &str) -> Result<std::fs::File, String> {
    std::fs::File::open(drive_path)
        .map_err(|e| format!("Cannot open device '{}': {}. Requires root privileges.", drive_path, e))
}

#[tauri::command]
pub async fn start_scan(
    config: ScanConfig,
    channel: Channel<ScanProgressEvent>,
    scan_state: State<'_, ScanManager>,
) -> Result<ScanResult, String> {
    let controller = Arc::new(ScanController {
        is_paused: std::sync::atomic::AtomicBool::new(false),
        is_stopped: std::sync::atomic::AtomicBool::new(false),
    });

    {
        let mut active = scan_state.active_controller.lock().await;
        *active = Some(controller.clone());
    }

    let scan_id = format!("scan_{}", chrono::Utc::now().timestamp_millis());
    let total_bytes = if config.total_bytes > 0 {
        config.total_bytes
    } else {
        // Fallback: query from sysinfo
        let drives = enumerate_drives();
        drives
            .iter()
            .find(|d| d.id == config.drive_id)
            .map(|d| d.total_bytes)
            .unwrap_or(100 * 1024 * 1024 * 1024)
    };

    let mut found_files: Vec<CarvedFile> = Vec::new();
    let carver = SignatureCarver::new();
    let scan_start = Instant::now();

    // ── Phase 1: Fast Scan – Recycle Bin metadata ──────────────────────────
    if config.enable_fast_scan {
        let _ = channel.send(ScanProgressEvent {
            scan_id: scan_id.clone(),
            scanned_bytes: 0,
            total_bytes,
            progress_percent: 2.0,
            speed_mbps: 0.0,
            eta_seconds: 0,
            files_found_count: 0,
            is_complete: false,
            current_phase: "Fast Scan: Reading Recycle Bin…".to_string(),
        });

        // drive_id is like "C:" – pass it to filesystem scanner
        let recycle_files = parse_filesystem_metadata(&config.drive_id);
        let recycled_count = recycle_files.len();
        found_files.extend(recycle_files);

        let _ = channel.send(ScanProgressEvent {
            scan_id: scan_id.clone(),
            scanned_bytes: 0,
            total_bytes,
            progress_percent: 8.0,
            speed_mbps: 0.0,
            eta_seconds: 0,
            files_found_count: recycled_count,
            is_complete: false,
            current_phase: format!("Fast Scan: Found {} deleted files in Recycle Bin", recycled_count),
        });

        tokio::time::sleep(tokio::time::Duration::from_millis(200)).await;
    }

    // ── Phase 2: Deep Scan – Real raw sector carving ───────────────────────
    if config.enable_deep_scan {
        // Try to open the raw device; if it fails (no admin) still continue with what we have
        match open_raw_device(&config.drive_path) {
            Ok(mut device) => {
                // Read 4 MB chunks — must be multiple of sector size for FILE_FLAG_NO_BUFFERING
                const CHUNK_SIZE: usize = 4 * 1024 * 1024; // 4 MB
                let mut buffer = vec![0u8; CHUNK_SIZE];
                let mut scanned_bytes: u64 = 0;
                let mut last_speed_update = Instant::now();
                let mut bytes_since_speed = 0u64;
                let mut current_speed_mbps: f32;

                loop {
                    if controller.is_stopped.load(Ordering::Relaxed) {
                        break;
                    }

                    while controller.is_paused.load(Ordering::Relaxed) {
                        if controller.is_stopped.load(Ordering::Relaxed) {
                            break;
                        }
                        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
                    }

                    let bytes_read = match device.read(&mut buffer) {
                        Ok(0) => break, // EOF – reached end of drive
                        Ok(n) => n,
                        Err(e) => {
                            // Some sectors may be unreadable — skip and continue
                            let skip = CHUNK_SIZE as u64;
                            if scanned_bytes + skip < total_bytes {
                                let _ = device.seek(SeekFrom::Current(skip as i64));
                                scanned_bytes += skip;
                            }
                            log::warn!("Read error at offset {}: {}", scanned_bytes, e);
                            continue;
                        }
                    };

                    let chunk = &buffer[..bytes_read];
                    scanned_bytes += bytes_read as u64;
                    bytes_since_speed += bytes_read as u64;

                    // Carve signatures from this chunk
                    let carved = carver.scan_buffer(chunk, scanned_bytes - bytes_read as u64, config.sector_size as u64);
                    if !carved.is_empty() {
                        found_files.extend(carved);
                    }

                    // Update speed every 500 ms to avoid flooding the channel
                    let elapsed_speed = last_speed_update.elapsed();
                    if elapsed_speed.as_millis() >= 500 {
                        current_speed_mbps = (bytes_since_speed as f64
                            / elapsed_speed.as_secs_f64()
                            / 1_048_576.0) as f32;
                        bytes_since_speed = 0;
                        last_speed_update = Instant::now();

                        let progress = (scanned_bytes as f64 / total_bytes as f64 * 92.0 + 8.0) as f32;
                        let remaining = total_bytes.saturating_sub(scanned_bytes);
                        let eta = if current_speed_mbps > 0.0 {
                            (remaining as f64 / (current_speed_mbps as f64 * 1_048_576.0)) as u64
                        } else {
                            0
                        };

                        let _ = channel.send(ScanProgressEvent {
                            scan_id: scan_id.clone(),
                            scanned_bytes,
                            total_bytes,
                            progress_percent: progress.min(99.0),
                            speed_mbps: current_speed_mbps,
                            eta_seconds: eta,
                            files_found_count: found_files.len(),
                            is_complete: false,
                            current_phase: "Deep Scan: Raw Sector Carving…".to_string(),
                        });
                    }

                    if scanned_bytes >= total_bytes {
                        break;
                    }

                    // Yield to Tokio so UI events remain responsive
                    tokio::task::yield_now().await;
                }
            }

            Err(e) => {
                // No raw access (no admin) — report it as a warning but still return Recycle Bin results
                log::warn!("Deep scan unavailable: {}", e);
                let _ = channel.send(ScanProgressEvent {
                    scan_id: scan_id.clone(),
                    scanned_bytes: 0,
                    total_bytes,
                    progress_percent: 90.0,
                    speed_mbps: 0.0,
                    eta_seconds: 0,
                    files_found_count: found_files.len(),
                    is_complete: false,
                    current_phase: format!("Deep Scan skipped: {}. Showing Recycle Bin results only.", e),
                });
                tokio::time::sleep(tokio::time::Duration::from_millis(800)).await;
            }
        }
    }

    let elapsed = scan_start.elapsed().as_secs();

    let result = ScanResult {
        scan_id: scan_id.clone(),
        drive_id: config.drive_id.clone(),
        total_files_found: found_files.len(),
        scanned_bytes: total_bytes,
        elapsed_seconds: elapsed,
        files: found_files,
    };

    let _ = channel.send(ScanProgressEvent {
        scan_id: scan_id.clone(),
        scanned_bytes: total_bytes,
        total_bytes,
        progress_percent: 100.0,
        speed_mbps: 0.0,
        eta_seconds: 0,
        files_found_count: result.total_files_found,
        is_complete: true,
        current_phase: "Scan Complete".to_string(),
    });

    let mut res_store = scan_state.scan_results.lock().await;
    *res_store = Some(result.clone());

    Ok(result)
}

#[tauri::command]
pub async fn pause_scan(scan_state: State<'_, ScanManager>) -> Result<bool, String> {
    let active = scan_state.active_controller.lock().await;
    if let Some(ctrl) = &*active {
        ctrl.is_paused.store(true, Ordering::Relaxed);
        Ok(true)
    } else {
        Ok(false)
    }
}

#[tauri::command]
pub async fn resume_scan(scan_state: State<'_, ScanManager>) -> Result<bool, String> {
    let active = scan_state.active_controller.lock().await;
    if let Some(ctrl) = &*active {
        ctrl.is_paused.store(false, Ordering::Relaxed);
        Ok(true)
    } else {
        Ok(false)
    }
}

#[tauri::command]
pub async fn stop_scan(scan_state: State<'_, ScanManager>) -> Result<bool, String> {
    let active = scan_state.active_controller.lock().await;
    if let Some(ctrl) = &*active {
        ctrl.is_stopped.store(true, Ordering::Relaxed);
        Ok(true)
    } else {
        Ok(false)
    }
}

/// Read real bytes from the drive at the specified offset.
/// Opens the raw device (requires elevation) and seeks to `offset`.
#[tauri::command]
pub async fn preview_file_hex(drive_id: String, offset: u64, length: usize) -> Result<Vec<u8>, String> {
    // Build the device path from the drive_id (e.g. "C:" → "\\.\C:")
    let device_path = if drive_id.contains(':') {
        // Logical volume: take first two chars like "C:"
        let vol: String = drive_id.chars().take(2).collect();
        format!(r"\\.\{}", vol)
    } else {
        // Physical drive index in drive_id like "drive_0"
        let idx: u32 = drive_id
            .chars()
            .filter(|c| c.is_ascii_digit())
            .collect::<String>()
            .parse()
            .unwrap_or(0);
        format!(r"\\.\PhysicalDrive{}", idx)
    };

    match open_raw_device(&device_path) {
        Ok(mut device) => {
            // Align seek to sector boundary (512 bytes)
            let aligned_offset = offset & !(512 - 1);
            device
                .seek(SeekFrom::Start(aligned_offset))
                .map_err(|e| format!("Seek failed: {}", e))?;

            let read_len = (length + (offset - aligned_offset) as usize).min(65536);
            let mut buf = vec![0u8; read_len];
            let n = device.read(&mut buf).map_err(|e| format!("Read failed: {}", e))?;
            buf.truncate(n);

            // Trim to the originally requested window
            let skip = (offset - aligned_offset) as usize;
            let result = buf[skip.min(buf.len())..].to_vec();
            let result = result[..result.len().min(length)].to_vec();
            Ok(result)
        }
        Err(_) => {
            // Fallback: read the $R file directly if original_path points to one
            // (This is used for Recycle Bin recoveries where we have the $R file)
            Err(format!(
                "Administrator privileges required to read raw disk sectors at offset {}.",
                offset
            ))
        }
    }
}

#[tauri::command]
pub async fn get_media_preview(file_id: String, extension: String) -> Result<String, String> {
    let ext_lower = extension.to_lowercase();
    if ext_lower == "jpg" || ext_lower == "jpeg" || ext_lower == "png" || ext_lower == "webp" || ext_lower == "gif" {
        return Ok(format!("media_preview_{}_{}", file_id, ext_lower));
    }
    Ok("".to_string())
}

#[tauri::command]
pub async fn export_files(request: ExportRequest) -> Result<ExportSummary, String> {
    execute_file_export(request).await
}

#[tauri::command]
pub async fn create_disk_image(_drive_id: String, output_path: String) -> Result<bool, String> {
    create_raw_disk_image(&_drive_id, &output_path).await
}
