pub mod carver;
pub mod commands;
pub mod disk_image;
pub mod drive;
pub mod export;
pub mod filesystem;
pub mod scanner;

use commands::*;
use scanner::ScanManager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_process::init())
        .manage(ScanManager::new())
        .invoke_handler(tauri::generate_handler![
            get_system_drives,
            get_drive_smart_status,
            start_scan,
            pause_scan,
            resume_scan,
            stop_scan,
            preview_file_hex,
            get_media_preview,
            export_files,
            create_disk_image
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
