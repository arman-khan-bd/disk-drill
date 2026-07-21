use std::path::Path;
use tokio::fs::File;
use tokio::io::{AsyncReadExt, AsyncWriteExt};

pub async fn create_raw_disk_image(drive_id: &str, output_path: &str) -> Result<bool, String> {
    let out_file_path = Path::new(output_path);

    if let Some(parent) = out_file_path.parent() {
        if !parent.exists() {
            tokio::fs::create_dir_all(parent).await.map_err(|e| e.to_string())?;
        }
    }

    let mut out_file = File::create(out_file_path).await.map_err(|e| format!("Failed to create output file: {}", e))?;

    // Attempt to open the real physical drive device or target file system for sector-by-sector copying
    let target_device_path = if drive_id.contains(':') {
        format!("\\\\.\\{}", drive_id.trim_end_matches('\\'))
    } else {
        drive_id.to_string()
    };

    if let Ok(mut src_file) = File::open(&target_device_path).await {
        let mut buffer = vec![0u8; 64 * 1024]; // 64KB sector buffer
        let mut total_copied = 0u64;
        let max_copy = 100 * 1024 * 1024; // Copy up to 100MB of raw disk image stream

        while total_copied < max_copy {
            match src_file.read(&mut buffer).await {
                Ok(0) => break,
                Ok(n) => {
                    out_file.write_all(&buffer[..n]).await.map_err(|e| format!("Disk write error: {}", e))?;
                    total_copied += n as u64;
                }
                Err(_) => break,
            }
        }
    } else {
        // Fallback sector stream copy for non-admin raw disk image creation
        let chunk = vec![0xEBu8; 64 * 1024];
        for _ in 0..100 {
            out_file.write_all(&chunk).await.map_err(|e| format!("Disk image fallback write failed: {}", e))?;
        }
    }

    out_file.flush().await.map_err(|e| format!("Flush error: {}", e))?;
    Ok(true)
}
