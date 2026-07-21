use serde::{Deserialize, Serialize};
use md5::{Md5, Digest as Md5Digest};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum FileCategory {
    Images,
    Documents,
    Video,
    Audio,
    Archives,
    Executable,
    Other,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileSignature {
    pub name: &'static str,
    pub extension: &'static str,
    pub category: FileCategory,
    pub header_magic: &'static [u8],
    pub footer_magic: Option<&'static [u8]>,
    pub max_expected_size: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CarvedFile {
    pub id: String,
    pub file_name: String,
    pub extension: String,
    pub category: FileCategory,
    pub start_sector: u64,
    pub offset_bytes: u64,
    pub size_bytes: u64,
    pub recovery_health: String, // "High", "Medium", "Overwritten"
    pub hash_md5: String,
    pub date_modified: String,
    pub is_deleted: bool,
    pub original_path: String,
}

pub struct SignatureCarver {
    signatures: Vec<FileSignature>,
}

impl SignatureCarver {
    pub fn new() -> Self {
        let signatures = vec![
            // Images
            FileSignature { name: "JPEG Image", extension: "jpg", category: FileCategory::Images, header_magic: &[0xFF, 0xD8, 0xFF], footer_magic: Some(&[0xFF, 0xD9]), max_expected_size: 25 * 1024 * 1024 },
            FileSignature { name: "PNG Image", extension: "png", category: FileCategory::Images, header_magic: &[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], footer_magic: Some(&[0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82]), max_expected_size: 30 * 1024 * 1024 },
            FileSignature { name: "GIF Image", extension: "gif", category: FileCategory::Images, header_magic: &[0x47, 0x49, 0x46, 0x38], footer_magic: Some(&[0x00, 0x3B]), max_expected_size: 15 * 1024 * 1024 },
            FileSignature { name: "WEBP Image", extension: "webp", category: FileCategory::Images, header_magic: &[0x52, 0x49, 0x46, 0x46], footer_magic: None, max_expected_size: 20 * 1024 * 1024 },
            
            // Documents
            FileSignature { name: "PDF Document", extension: "pdf", category: FileCategory::Documents, header_magic: &[0x25, 0x50, 0x44, 0x46], footer_magic: Some(&[0x25, 0x25, 0x45, 0x4F, 0x46]), max_expected_size: 100 * 1024 * 1024 },
            FileSignature { name: "ZIP Archive / DOCX", extension: "docx", category: FileCategory::Documents, header_magic: &[0x50, 0x4B, 0x03, 0x04], footer_magic: Some(&[0x50, 0x4B, 0x05, 0x06]), max_expected_size: 500 * 1024 * 1024 },
            FileSignature { name: "Rich Text Format", extension: "rtf", category: FileCategory::Documents, header_magic: &[0x7B, 0x5C, 0x72, 0x74, 0x66], footer_magic: Some(&[0x7D]), max_expected_size: 10 * 1024 * 1024 },
            
            // Videos & Audio
            FileSignature { name: "MP4 Video", extension: "mp4", category: FileCategory::Video, header_magic: &[0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70], footer_magic: None, max_expected_size: 4 * 1024 * 1024 * 1024 },
            FileSignature { name: "MKV Video", extension: "mkv", category: FileCategory::Video, header_magic: &[0x1A, 0x45, 0xDF, 0xA3], footer_magic: None, max_expected_size: 10 * 1024 * 1024 * 1024 },
            FileSignature { name: "MP3 Audio", extension: "mp3", category: FileCategory::Audio, header_magic: &[0x49, 0x44, 0x33], footer_magic: None, max_expected_size: 50 * 1024 * 1024 },
            FileSignature { name: "WAV Audio", extension: "wav", category: FileCategory::Audio, header_magic: &[0x57, 0x41, 0x56, 0x45], footer_magic: None, max_expected_size: 200 * 1024 * 1024 },
            
            // Archives & Executables
            FileSignature { name: "RAR Archive", extension: "rar", category: FileCategory::Archives, header_magic: &[0x52, 0x61, 0x72, 0x21, 0x1A, 0x07], footer_magic: None, max_expected_size: 2 * 1024 * 1024 * 1024 },
            FileSignature { name: "7Z Archive", extension: "7z", category: FileCategory::Archives, header_magic: &[0x37, 0x7A, 0xBC, 0xAF, 0x27, 0x1C], footer_magic: None, max_expected_size: 2 * 1024 * 1024 * 1024 },
            FileSignature { name: "Windows Executable", extension: "exe", category: FileCategory::Executable, header_magic: &[0x4D, 0x5A], footer_magic: None, max_expected_size: 500 * 1024 * 1024 },
        ];
        Self { signatures }
    }

    pub fn scan_buffer(&self, buffer: &[u8], base_offset: u64, sector_size: u64) -> Vec<CarvedFile> {
        let mut results = Vec::new();
        let buf_len = buffer.len();

        if buf_len < 16 {
            return results;
        }

        for i in (0..buf_len.saturating_sub(16)).step_by(512) {
            let chunk = &buffer[i..];

            for sig in &self.signatures {
                if chunk.starts_with(sig.header_magic) {
                    let offset_bytes = base_offset + i as u64;
                    let start_sector = offset_bytes / sector_size;
                    
                    let mut file_size = 64 * 1024; // Default estimated sector length
                    
                    if let Some(footer) = sig.footer_magic {
                        if let Some(pos) = chunk.windows(footer.len()).position(|w| w == footer) {
                            file_size = (pos + footer.len()) as u64;
                        }
                    }

                    // Hash first 1KB for fast deduplication
                    let sample_len = buffer.len().min(i + 1024);
                    let mut hasher = Md5::new();
                    hasher.update(&buffer[i..sample_len]);
                    let hash_md5 = format!("{:x}", hasher.finalize());

                    let file_id = format!("carved_{}_{}", start_sector, sig.extension);
                    let file_name = format!("DeepScan_{}_{}.{}", sig.extension.to_uppercase(), start_sector, sig.extension);
                    let original_path = format!("$/RAW_RECOVERY/{}/{}", sig.category_label(), file_name);

                    results.push(CarvedFile {
                        id: file_id,
                        file_name,
                        extension: sig.extension.to_string(),
                        category: sig.category.clone(),
                        start_sector,
                        offset_bytes,
                        size_bytes: file_size,
                        recovery_health: "High".to_string(),
                        hash_md5,
                        date_modified: chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string(),
                        is_deleted: true,
                        original_path,
                    });
                }
            }
        }

        results
    }
}

impl FileSignature {
    pub fn category_label(&self) -> &'static str {
        match self.category {
            FileCategory::Images => "Pictures",
            FileCategory::Documents => "Documents",
            FileCategory::Video => "Videos",
            FileCategory::Audio => "Audio",
            FileCategory::Archives => "Archives",
            FileCategory::Executable => "Applications",
            FileCategory::Other => "Other Files",
        }
    }
}
