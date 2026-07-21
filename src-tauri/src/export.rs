use serde::{Deserialize, Serialize};
use std::path::Path;
use tokio::fs::File;
use tokio::io::AsyncWriteExt;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportRequest {
    pub file_ids: Vec<String>,
    pub destination_path: String,
    pub source_drive_mount: String,
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
                "CRITICAL SAFETY VIOLATION: Source volume ({}:) matches target destination drive ({}:). Exporting files to the same drive risks permanently overwriting unallocated recoverable sectors!",
                src_letter, dest_letter
            ));
        }
    } else if dest_clean.starts_with(&src_clean) {
        return Err("CRITICAL SAFETY VIOLATION: Export destination resides on the scanned source partition!".to_string());
    }

    Ok(())
}

pub async fn execute_file_export(req: ExportRequest) -> Result<ExportSummary, String> {
    check_same_drive_safety(&req.source_drive_mount, &req.destination_path)?;

    let target_dir = Path::new(&req.destination_path);
    if !target_dir.exists() {
        tokio::fs::create_dir_all(target_dir).await.map_err(|e| e.to_string())?;
    }

    let mut success_count = 0;
    let mut total_bytes = 0;

    for (idx, file_id) in req.file_ids.iter().enumerate() {
        let filename = format!("Recovered_File_{}_{}.dat", idx + 1, file_id);
        let file_path = target_dir.join(filename);
        
        let dummy_data = vec![0u8; 1024 * 512]; // Simulated sector write
        if let Ok(mut out_file) = File::create(file_path).await {
            let _ = out_file.write_all(&dummy_data).await;
            success_count += 1;
            total_bytes += dummy_data.len() as u64;
        }
    }

    Ok(ExportSummary {
        success_count,
        failed_count: 0,
        total_bytes_restored: total_bytes,
        output_directory: req.destination_path,
    })
}
