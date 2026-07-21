use serde::{Deserialize, Serialize};
use std::path::Path;
use tokio::fs;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportRequest {
    pub file_ids: Vec<String>,
    pub destination_path: String,
    pub source_drive_mount: String,
    /// Optional: maps file_id -> original_path (the $R* data file or carved path).
    /// If provided, each file's bytes are copied from this path.
    pub file_paths: Option<Vec<FilePathEntry>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FilePathEntry {
    pub file_id: String,
    pub original_path: String,
    pub file_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportSummary {
    pub success_count: usize,
    pub failed_count: usize,
    pub total_bytes_restored: u64,
    pub output_directory: String,
}

pub fn check_same_drive_safety(source_drive: &str, destination_path: &str) -> Result<(), String> {
    let dest_clean = destination_path.trim().to_uppercase();
    let src_clean = source_drive.trim().to_uppercase();

    if cfg!(windows) {
        let src_letter = src_clean.chars().next().unwrap_or('C');
        let dest_letter = dest_clean.chars().next().unwrap_or(' ');
        if src_letter == dest_letter && dest_letter != ' ' {
            return Err(format!(
                "SAFETY VIOLATION: Cannot export to the same drive being scanned ({}:). Choose a different drive to avoid overwriting recoverable sectors.",
                src_letter
            ));
        }
    } else if dest_clean.starts_with(&src_clean) {
        return Err("SAFETY VIOLATION: Export destination is on the scanned source partition.".to_string());
    }

    Ok(())
}

pub async fn execute_file_export(req: ExportRequest) -> Result<ExportSummary, String> {
    check_same_drive_safety(&req.source_drive_mount, &req.destination_path)?;

    let target_dir = Path::new(&req.destination_path);
    if !target_dir.exists() {
        fs::create_dir_all(target_dir)
            .await
            .map_err(|e| format!("Cannot create output directory: {}", e))?;
    }

    let mut success_count = 0;
    let mut failed_count = 0;
    let mut total_bytes: u64 = 0;

    // Build a lookup: file_id -> (original_path, file_name)
    let path_map: std::collections::HashMap<String, (String, String)> = req
        .file_paths
        .as_deref()
        .unwrap_or(&[])
        .iter()
        .map(|e| (e.file_id.clone(), (e.original_path.clone(), e.file_name.clone())))
        .collect();

    for file_id in &req.file_ids {
        if let Some((src_path, file_name)) = path_map.get(file_id) {
            let src = Path::new(src_path);

            // The original_path stored in CarvedFile is the $R<rand>.<ext> data file path
            // when available (set by filesystem.rs). Just copy it straight to destination.
            if src.exists() {
                let dest_file = target_dir.join(sanitize_filename(file_name));
                match fs::copy(src, &dest_file).await {
                    Ok(bytes) => {
                        success_count += 1;
                        total_bytes += bytes;
                    }
                    Err(e) => {
                        log::error!("Failed to copy {} → {}: {}", src_path, dest_file.display(), e);
                        failed_count += 1;
                    }
                }
            } else {
                // $R data file no longer exists (overwritten) — nothing to copy
                log::warn!("Data file not found for file_id={}: {}", file_id, src_path);
                failed_count += 1;
            }
        } else {
            // No path info provided for this file_id
            log::warn!("No path information for file_id={}", file_id);
            failed_count += 1;
        }
    }

    Ok(ExportSummary {
        success_count,
        failed_count,
        total_bytes_restored: total_bytes,
        output_directory: req.destination_path,
    })
}

/// Strip characters that are invalid in Windows file names.
fn sanitize_filename(name: &str) -> String {
    name.chars()
        .map(|c| match c {
            '\\' | '/' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '_',
            c => c,
        })
        .collect()
}
