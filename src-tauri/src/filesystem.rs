use crate::carver::{CarvedFile, FileCategory};
use md5::Digest;
use std::fs;
use std::path::Path;
use std::io::Read;

/// Parse $Recycle.Bin entries for a given drive letter.
/// Windows stores each deleted file as a pair:
///   $I<rand>.<ext>  — metadata (original path, size, deletion time)
///   $R<rand>.<ext>  — actual file data
/// We parse all $I files and return CarvedFile entries with is_deleted = true.
pub fn parse_filesystem_metadata(partition_id: &str) -> Vec<CarvedFile> {
    let mut files = Vec::new();

    // Determine drive letter from partition_id (e.g. "C:" or "C:\")
    let drive_letter = if partition_id.len() >= 1 {
        partition_id.chars().next().unwrap_or('C').to_uppercase().next().unwrap_or('C')
    } else {
        'C'
    };

    // Scan $Recycle.Bin on the target drive
    let recycle_root = format!("{}:\\$Recycle.Bin", drive_letter);
    scan_recycle_bin(Path::new(&recycle_root), &mut files, drive_letter);

    // Also check current user's own SID subfolder via env
    let user_profile = std::env::var("USERPROFILE").unwrap_or_default();
    if !user_profile.is_empty() {
        // Fallback: try to parse common known recycle locations for the user
        let user_recycle = format!("{}:\\$Recycle.Bin", drive_letter);
        if files.is_empty() {
            scan_recycle_bin(Path::new(&user_recycle), &mut files, drive_letter);
        }
    }

    files
}

/// Walk the $Recycle.Bin directory tree and collect deleted file metadata.
fn scan_recycle_bin(recycle_root: &Path, files: &mut Vec<CarvedFile>, _drive_letter: char) {
    if !recycle_root.exists() {
        return;
    }

    // $Recycle.Bin\<SID>\ folders for each user
    let sid_dirs = match fs::read_dir(recycle_root) {
        Ok(d) => d,
        Err(_) => return,
    };

    for sid_entry in sid_dirs.flatten() {
        let sid_path = sid_entry.path();
        if !sid_path.is_dir() {
            continue;
        }

        let bin_entries = match fs::read_dir(&sid_path) {
            Ok(d) => d,
            Err(_) => continue,
        };

        for entry in bin_entries.flatten() {
            let path = entry.path();
            let name = path.file_name().unwrap_or_default().to_string_lossy().to_string();

            // We only parse $I (index/metadata) files
            if !name.starts_with("$I") {
                continue;
            }

            // Corresponding $R data file has the same suffix
            let suffix = &name[2..]; // everything after "$I"
            let r_name = format!("$R{}", suffix);
            let r_path = sid_path.join(&r_name);

            // Parse the $I metadata file
            if let Some(meta) = parse_recycle_index_file(&path) {
                let extension = Path::new(&meta.original_path)
                    .extension()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .to_lowercase();

                let category = classify_extension(&extension);

                let file_name = Path::new(&meta.original_path)
                    .file_name()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .to_string();

                // MD5 hash of the original path (unique enough as identifier)
                let mut hasher = md5::Md5::new();
                hasher.update(meta.original_path.as_bytes());
                let hash_md5 = format!("{:x}", hasher.finalize());

                let file_id = format!("recycle_{}", hash_md5);

                // The actual data lives at r_path (may not exist if already purged)
                let data_path = if r_path.exists() {
                    r_path.to_string_lossy().to_string()
                } else {
                    "".to_string()
                };

                let recovery_health = if !data_path.is_empty() {
                    "High".to_string()
                } else {
                    "Overwritten".to_string()
                };

                // Sector offset: use inode-like placeholder from file index
                let sector = files.len() as u64 * 8 + 2048;

                files.push(CarvedFile {
                    id: file_id,
                    file_name,
                    extension,
                    category,
                    start_sector: sector,
                    offset_bytes: sector * 512,
                    size_bytes: meta.file_size,
                    recovery_health,
                    hash_md5,
                    date_modified: meta.deletion_time,
                    is_deleted: true,
                    // Store data_path in original_path so export can find it
                    original_path: if !data_path.is_empty() {
                        data_path
                    } else {
                        meta.original_path
                    },
                });
            }
        }
    }
}

/// Metadata parsed from a Windows $I recycle index file.
struct RecycleIndexMeta {
    pub file_size: u64,
    pub deletion_time: String,
    pub original_path: String,
}

/// Parse the binary $I metadata file format used by Windows Vista+ $Recycle.Bin.
///
/// $I file layout (little-endian):
///   Bytes 0–7:   Version (u64) — should be 1 or 2
///   Bytes 8–15:  File size (u64)
///   Bytes 16–23: Deletion time as FILETIME (u64, 100-nanosecond intervals since 1601-01-01)
///   Bytes 24+:   Original file path (UTF-16LE, null-terminated; for version 2, preceded by 4-byte char count)
fn parse_recycle_index_file(path: &Path) -> Option<RecycleIndexMeta> {
    let mut buf = Vec::new();
    fs::File::open(path).ok()?.read_to_end(&mut buf).ok()?;

    if buf.len() < 24 {
        return None;
    }

    let version = u64::from_le_bytes(buf[0..8].try_into().ok()?);
    let file_size = u64::from_le_bytes(buf[8..16].try_into().ok()?);
    let filetime = u64::from_le_bytes(buf[16..24].try_into().ok()?);

    // Convert FILETIME to human-readable UTC string
    // FILETIME epoch: January 1, 1601; Unix epoch: January 1, 1970
    // Difference: 116444736000000000 hundred-nanosecond intervals
    let deletion_time = if filetime > 116_444_736_000_000_000 {
        let unix_secs = (filetime - 116_444_736_000_000_000) / 10_000_000;
        let dt = chrono::DateTime::<chrono::Utc>::from_timestamp(unix_secs as i64, 0)
            .unwrap_or_else(chrono::Utc::now);
        dt.format("%Y-%m-%d %H:%M:%S").to_string()
    } else {
        chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string()
    };

    // Path starts at byte 24 for version 1, or at byte 28 for version 2 (4-byte length prefix)
    let path_start = if version >= 2 { 28 } else { 24 };
    if buf.len() <= path_start {
        return None;
    }

    // Decode UTF-16LE path
    let path_bytes = &buf[path_start..];
    let utf16_units: Vec<u16> = path_bytes
        .chunks_exact(2)
        .map(|b| u16::from_le_bytes([b[0], b[1]]))
        .take_while(|&c| c != 0)
        .collect();

    let original_path = String::from_utf16_lossy(&utf16_units).to_string();
    if original_path.is_empty() {
        return None;
    }

    Some(RecycleIndexMeta {
        file_size,
        deletion_time,
        original_path,
    })
}

fn classify_extension(ext: &str) -> FileCategory {
    match ext {
        "jpg" | "jpeg" | "png" | "webp" | "gif" | "bmp" | "tiff" | "heic" => FileCategory::Images,
        "pdf" | "docx" | "doc" | "txt" | "xlsx" | "xls" | "pptx" | "ppt" | "odt" | "rtf" => FileCategory::Documents,
        "mp4" | "mkv" | "avi" | "mov" | "wmv" | "flv" | "webm" => FileCategory::Video,
        "mp3" | "wav" | "flac" | "aac" | "ogg" | "m4a" => FileCategory::Audio,
        "zip" | "rar" | "7z" | "tar" | "gz" | "bz2" => FileCategory::Archives,
        "exe" | "msi" | "dll" | "bat" | "cmd" => FileCategory::Executable,
        _ => FileCategory::Other,
    }
}
