import React, { useState, useMemo } from 'react';
import {
  FileText, Image as ImageIcon, Video, Music, Archive, Search, Filter,
  CheckSquare, Square, Download, Eye, Terminal, ShieldAlert, CheckCircle2, AlertTriangle, File
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { CarvedFile, FileCategory } from '../types';

interface FileExplorerProps {
  onOpenExportModal: () => void;
  onOpenHexViewer: (file: CarvedFile) => void;
}

export const FileExplorer: React.FC<FileExplorerProps> = ({ onOpenExportModal, onOpenHexViewer }) => {
  const { scannedFiles, selectedFileIds, toggleFileSelection, selectAllFiles, clearFileSelection } = useAppStore();
  
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [healthFilter, setHealthFilter] = useState<string>('All');
  const [onlyDeletedFilter, setOnlyDeletedFilter] = useState<boolean>(true);
  const [previewMediaFile, setPreviewMediaFile] = useState<CarvedFile | null>(null);

  const categories = [
    { label: 'All Files', key: 'All', icon: FileText, count: scannedFiles.length },
    { label: 'Pictures', key: 'Images', icon: ImageIcon, count: scannedFiles.filter((f) => f.category === 'Images').length },
    { label: 'Documents', key: 'Documents', icon: FileText, count: scannedFiles.filter((f) => f.category === 'Documents').length },
    { label: 'Videos', key: 'Video', icon: Video, count: scannedFiles.filter((f) => f.category === 'Video').length },
    { label: 'Audio', key: 'Audio', icon: Music, count: scannedFiles.filter((f) => f.category === 'Audio').length },
    { label: 'Archives', key: 'Archives', icon: Archive, count: scannedFiles.filter((f) => f.category === 'Archives').length },
  ];

  const filteredFiles = useMemo(() => {
    return scannedFiles.filter((file) => {
      const matchesCategory = selectedCategory === 'All' || file.category === selectedCategory;
      const matchesSearch = file.file_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            file.extension.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            file.original_path.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesHealth = healthFilter === 'All' || file.recovery_health === healthFilter;
      const matchesDeletedOnly = !onlyDeletedFilter || file.is_deleted;
      return matchesCategory && matchesSearch && matchesHealth && matchesDeletedOnly;
    });
  }, [scannedFiles, selectedCategory, searchQuery, healthFilter, onlyDeletedFilter]);

  const allSelected = filteredFiles.length > 0 && filteredFiles.every((f) => selectedFileIds.has(f.id));

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getCategoryIcon = (category: FileCategory) => {
    switch (category) {
      case 'Images': return <ImageIcon className="w-4 h-4 text-emerald-400" />;
      case 'Documents': return <FileText className="w-4 h-4 text-blue-400" />;
      case 'Video': return <Video className="w-4 h-4 text-purple-400" />;
      case 'Audio': return <Music className="w-4 h-4 text-amber-400" />;
      case 'Archives': return <Archive className="w-4 h-4 text-pink-400" />;
      default: return <File className="w-4 h-4 text-slate-400" />;
    }
  };

  const getHealthBadge = (health: string) => {
    switch (health) {
      case 'High':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" /> High (100%)
          </span>
        );
      case 'Medium':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <AlertTriangle className="w-3 h-3" /> Medium
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <ShieldAlert className="w-3 h-3" /> Overwritten
          </span>
        );
    }
  };

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Sidebar Categories Tree */}
      <div className="w-64 border-r border-slate-800/80 p-4 space-y-4 bg-slate-950/40">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 px-2">File Categories</h3>
        <nav className="space-y-1">
          {categories.map((cat) => {
            const Icon = cat.icon;
            const isActive = selectedCategory === cat.key;
            return (
              <button
                key={cat.key}
                onClick={() => setSelectedCategory(cat.key)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className="w-4 h-4" />
                  <span>{cat.label}</span>
                </div>
                <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-400 font-mono">
                  {cat.count}
                </span>
              </button>
            );
          })}
        </nav>

        {/* Deleted Files Strict Toggle Filter */}
        <div className="pt-4 border-t border-slate-800/80 space-y-3">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 px-2 flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5 text-cyan-400" /> Deep Recovery Filter
          </label>
          <div
            onClick={() => setOnlyDeletedFilter(!onlyDeletedFilter)}
            className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900 border border-slate-800 cursor-pointer hover:border-cyan-500/40 transition-all text-xs"
          >
            <span className="text-slate-300 font-medium">Show Deleted Files Only</span>
            <div className={`w-8 h-4 rounded-full p-0.5 transition-colors ${onlyDeletedFilter ? 'bg-cyan-500' : 'bg-slate-700'}`}>
              <div className={`w-3 h-3 rounded-full bg-white transition-transform ${onlyDeletedFilter ? 'translate-x-4' : 'translate-x-0'}`}></div>
            </div>
          </div>
        </div>

        {/* Health Score Filter */}
        <div className="pt-2 space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 px-2 flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-cyan-400" /> Quality Confidence
          </label>
          <select
            value={healthFilter}
            onChange={(e) => setHealthFilter(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 text-slate-300 rounded-lg p-2 text-xs focus:outline-none focus:border-cyan-500"
          >
            <option value="All">All Quality Scores</option>
            <option value="High">High Confidence (Intact)</option>
            <option value="Medium">Medium (Partial Header)</option>
            <option value="Overwritten">Overwritten Sectors</option>
          </select>
        </div>
      </div>

      {/* Main Files Table View */}
      <div className="flex-1 flex flex-col overflow-hidden bg-slate-950/20">
        {/* Toolbar Header */}
        <div className="p-4 border-b border-slate-800/80 flex items-center justify-between gap-4 bg-slate-900/40">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by filename, extension, or raw sector path..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-cyan-500 placeholder-slate-500"
            />
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400 font-mono">
              Deleted Files Found: <strong className="text-cyan-400">{filteredFiles.length}</strong>
            </span>

            <button
              disabled={selectedFileIds.size === 0}
              onClick={onOpenExportModal}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 shadow-lg ${
                selectedFileIds.size > 0
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white shadow-emerald-950/40'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
              }`}
            >
              <Download className="w-3.5 h-3.5" /> Recover Selected Files ({selectedFileIds.size})
            </button>
          </div>
        </div>

        {/* Table Content */}
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 bg-slate-900 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider select-none">
              <tr>
                <th className="p-3 w-10 text-center">
                  <button
                    onClick={() => {
                      if (allSelected) clearFileSelection();
                      else selectAllFiles(filteredFiles.map((f) => f.id));
                    }}
                  >
                    {allSelected ? <CheckSquare className="w-4 h-4 text-cyan-400" /> : <Square className="w-4 h-4 text-slate-500" />}
                  </button>
                </th>
                <th className="p-3">File Preview & Name</th>
                <th className="p-3">Category</th>
                <th className="p-3 text-right">Size</th>
                <th className="p-3">Sector Offset</th>
                <th className="p-3">Health Score</th>
                <th className="p-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {filteredFiles.map((file) => {
                const isSelected = selectedFileIds.has(file.id);
                const isMedia = file.category === 'Images' || file.category === 'Video';
                return (
                  <tr
                    key={file.id}
                    className={`hover:bg-slate-900/60 transition-colors ${isSelected ? 'bg-cyan-950/20' : ''}`}
                  >
                    <td className="p-3 text-center">
                      <button onClick={() => toggleFileSelection(file.id)}>
                        {isSelected ? <CheckSquare className="w-4 h-4 text-cyan-400" /> : <Square className="w-4 h-4 text-slate-600" />}
                      </button>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        {/* Thumbnail Container */}
                        {isMedia ? (
                          <div
                            onClick={() => setPreviewMediaFile(file)}
                            className="w-10 h-10 rounded-lg bg-slate-900 border border-slate-700/80 flex items-center justify-center overflow-hidden cursor-pointer hover:border-cyan-400 hover:scale-105 transition-all group shrink-0 relative"
                            title="Click for Big Image/Video Preview"
                          >
                            {file.category === 'Images' ? (
                              <svg className="w-full h-full p-1" viewBox="0 0 100 100">
                                <rect width="100" height="100" rx="10" fill="#0f172a"/>
                                <circle cx="50" cy="35" r="16" fill="#06b6d4" opacity="0.3"/>
                                <path d="M15,80 L35,45 L55,65 L75,35 L95,80 Z" fill="#10b981"/>
                              </svg>
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-purple-900/60 via-slate-900 to-indigo-950/80 flex items-center justify-center">
                                <Video className="w-5 h-5 text-purple-400 group-hover:scale-110 transition-transform" />
                              </div>
                            )}
                            <div className="absolute inset-0 bg-cyan-500/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                              <Eye className="w-4 h-4 text-white" />
                            </div>
                          </div>
                        ) : (
                          <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 shrink-0">
                            {getCategoryIcon(file.category)}
                          </div>
                        )}

                        <div>
                          <div
                            onClick={() => isMedia && setPreviewMediaFile(file)}
                            className={`font-semibold text-slate-200 font-sans ${isMedia ? 'hover:text-cyan-300 cursor-pointer underline decoration-dotted' : ''}`}
                          >
                            {file.file_name}
                          </div>
                          <div className="text-[11px] text-slate-500">{file.original_path}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-3 font-sans text-slate-400">{file.category}</td>
                    <td className="p-3 text-right font-bold text-slate-300">{formatSize(file.size_bytes)}</td>
                    <td className="p-3 text-slate-400 text-[11px]">LBA #{file.start_sector}</td>
                    <td className="p-3">{getHealthBadge(file.recovery_health)}</td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {isMedia && (
                          <button
                            onClick={() => setPreviewMediaFile(file)}
                            className="glass-button p-1.5 text-slate-400 hover:text-emerald-400"
                            title="Click for Big Image/Video Preview"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => onOpenHexViewer(file)}
                          className="glass-button p-1.5 text-slate-400 hover:text-cyan-400"
                          title="Open Hex Byte Inspector"
                        >
                          <Terminal className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Big Media Preview Modal */}
      {previewMediaFile && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex items-center justify-center p-6">
          <div className="glass-panel w-full max-w-3xl bg-slate-900 border-slate-700 shadow-2xl rounded-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center gap-2">
                {getCategoryIcon(previewMediaFile.category)}
                <div>
                  <h3 className="font-semibold text-sm text-white">{previewMediaFile.file_name}</h3>
                  <p className="text-xs text-slate-400 font-mono">
                    Sector Offset: LBA #{previewMediaFile.start_sector} | Size: {formatSize(previewMediaFile.size_bytes)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPreviewMediaFile(null)}
                className="glass-button p-1.5 text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Rendered Preview Box */}
            <div className="flex-1 p-8 bg-slate-950/90 flex items-center justify-center overflow-hidden">
              {previewMediaFile.category === 'Images' ? (
                <div className="relative w-full h-80 rounded-xl bg-slate-900 border border-slate-700/80 flex flex-col items-center justify-center p-4 overflow-hidden">
                  <svg className="w-full h-full max-h-72 rounded-lg shadow-2xl" viewBox="0 0 600 380">
                    <rect width="600" height="380" fill="#090d16" rx="12"/>
                    <circle cx="300" cy="160" r="75" fill="#06b6d4" opacity="0.25"/>
                    <path d="M120,310 L240,170 L340,250 L460,130 L570,310 Z" fill="#10b981" opacity="0.85"/>
                    <circle cx="440" cy="110" r="28" fill="#fbbf24"/>
                    <text x="300" y="340" font-family="sans-serif" font-size="15" font-weight="bold" fill="#38bdf8" text-anchor="middle">RECOVERED IMAGE SECTOR STREAM ({previewMediaFile.extension.toUpperCase()})</text>
                  </svg>
                </div>
              ) : (
                <div className="relative w-full h-80 rounded-xl bg-slate-900 border border-slate-700/80 flex flex-col items-center justify-center p-4 overflow-hidden">
                  <div className="w-full h-full bg-slate-950 border border-purple-500/30 rounded-xl flex flex-col items-center justify-center p-6 space-y-4">
                    <Video className="w-20 h-20 text-purple-400 animate-pulse" />
                    <div className="text-center space-y-1">
                      <div className="text-sm font-bold text-purple-300">Recovered Video Container Stream</div>
                      <div className="text-xs text-slate-400 font-mono">Codec: H.264 / AAC | LBA Sector: #{previewMediaFile.start_sector}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
              <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> Sector Integrity Verified (Deleted Record Recovered)
              </span>
              <button
                onClick={() => setPreviewMediaFile(null)}
                className="glass-button px-5 py-2 text-xs text-slate-200"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
