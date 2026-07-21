import React from 'react';
import { Terminal, X, Copy, Binary } from 'lucide-react';
import { CarvedFile } from '../types';

interface HexViewerProps {
  file: CarvedFile | null;
  bytes: number[];
  onClose: () => void;
}

export const HexViewer: React.FC<HexViewerProps> = ({ file, bytes, onClose }) => {
  if (!file) return null;

  const formatHex = (byte: number) => byte.toString(16).padStart(2, '0').toUpperCase();
  const formatAscii = (byte: number) => (byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : '.');

  const rows = [];
  for (let i = 0; i < bytes.length; i += 16) {
    rows.push(bytes.slice(i, i + 16));
  }

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-6">
      <div className="glass-panel w-full max-w-4xl max-h-[85vh] flex flex-col bg-slate-900 border-slate-700/80 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2">
            <Terminal className="w-5 h-5 text-cyan-400" />
            <div>
              <h3 className="font-semibold text-sm text-white flex items-center gap-2">
                Byte Hex Inspector — {file.file_name}
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                Sector Offset: 0x{file.offset_bytes.toString(16).toUpperCase()} | Size: {file.size_bytes} Bytes
              </p>
            </div>
          </div>

          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Hex Inspector Content */}
        <div className="flex-1 p-4 overflow-y-auto font-mono text-xs space-y-1 bg-slate-950/90 selection:bg-cyan-500/30">
          <div className="grid grid-cols-12 text-slate-500 pb-2 border-b border-slate-800 font-bold">
            <div className="col-span-2">OFFSET</div>
            <div className="col-span-7">HEXADECIMAL BYTES (16 BYTES/ROW)</div>
            <div className="col-span-3 text-right">ASCII DECODE</div>
          </div>

          {rows.map((row, rowIndex) => {
            const offsetHex = (file.offset_bytes + rowIndex * 16).toString(16).padStart(8, '0').toUpperCase();
            return (
              <div key={rowIndex} className="grid grid-cols-12 hover:bg-slate-900/80 py-0.5 px-1 rounded">
                <div className="col-span-2 text-cyan-400 font-semibold">{offsetHex}</div>
                <div className="col-span-7 flex gap-2 font-mono text-slate-300">
                  <span className="space-x-1.5">
                    {row.slice(0, 8).map((b, bi) => (
                      <span key={bi} className={b === 0 ? 'text-slate-600' : 'text-slate-200'}>
                        {formatHex(b)}
                      </span>
                    ))}
                  </span>
                  <span className="text-slate-600">|</span>
                  <span className="space-x-1.5">
                    {row.slice(8, 16).map((b, bi) => (
                      <span key={bi} className={b === 0 ? 'text-slate-600' : 'text-slate-200'}>
                        {formatHex(b)}
                      </span>
                    ))}
                  </span>
                </div>
                <div className="col-span-3 text-right text-emerald-400/90 font-mono tracking-widest">
                  {row.map((b) => formatAscii(b)).join('')}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <Binary className="w-4 h-4 text-cyan-400" /> Direct Raw Disk Byte Stream
          </span>
          <button onClick={onClose} className="glass-button px-4 py-1.5 text-slate-200">
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
};
