import React, { useState } from 'react';
import { ANDROID_SOURCE_FILES, downloadAndroidProjectZip } from '../services/androidZipExporter';
import { Code, Download, FileCode, Copy, Check, X, Smartphone } from 'lucide-react';

interface AndroidSourceModalProps {
  onClose: () => void;
}

export const AndroidSourceModal: React.FC<AndroidSourceModalProps> = ({ onClose }) => {
  const [selectedFilePath, setSelectedFilePath] = useState<string>(ANDROID_SOURCE_FILES[5].path); // Money.kt
  const [copied, setCopied] = useState<boolean>(false);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);

  const selectedFile = ANDROID_SOURCE_FILES.find((f) => f.path === selectedFilePath) || ANDROID_SOURCE_FILES[0];

  const handleCopy = () => {
    navigator.clipboard.writeText(selectedFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleDownloadZip = async () => {
    setIsDownloading(true);
    try {
      await downloadAndroidProjectZip();
    } catch (e) {
      console.error(e);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4">
      <div className="bg-slate-900 text-slate-100 w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col h-[92vh] overflow-hidden animate-in fade-in duration-150">
        
        {/* Header */}
        <div className="bg-slate-950 p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Smartphone className="w-5 h-5 text-emerald-400" />
            <div>
              <h2 className="font-bold text-sm sm:text-base text-white">Native Android Studio Project Explorer</h2>
              <p className="text-xs text-slate-400">Kotlin • Jetpack Compose Material 3 • Room SQLite v2 • Keystore</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadZip}
              disabled={isDownloading}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              {isDownloading ? 'Packaging Zip...' : 'Download Project Zip'}
            </button>
            <button onClick={onClose} className="p-1 rounded-full text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content area: Sidebar file tree + Code viewer */}
        <div className="flex-1 flex flex-col sm:flex-row overflow-hidden">
          
          {/* File List */}
          <div className="w-full sm:w-72 bg-slate-950/60 border-r border-slate-800 overflow-y-auto p-2 space-y-1 text-xs">
            <div className="px-2 py-1 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              Project Files
            </div>
            {ANDROID_SOURCE_FILES.map((file) => (
              <button
                key={file.path}
                onClick={() => setSelectedFilePath(file.path)}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center gap-2 truncate transition ${
                  selectedFilePath === file.path
                    ? 'bg-emerald-950 text-emerald-300 font-bold border border-emerald-800'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <FileCode className="w-3.5 h-3.5 shrink-0 opacity-70" />
                <span className="truncate">{file.path}</span>
              </button>
            ))}
          </div>

          {/* Code Viewer */}
          <div className="flex-1 flex flex-col bg-slate-900 overflow-hidden">
            
            <div className="p-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between text-xs">
              <span className="font-mono text-emerald-400 font-semibold">{selectedFile.path}</span>
              <button
                onClick={handleCopy}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg flex items-center gap-1 font-medium transition"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>

            <pre className="flex-1 p-4 overflow-auto font-mono text-[11px] leading-relaxed text-slate-200 bg-slate-950/40">
              <code>{selectedFile.content}</code>
            </pre>

          </div>

        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>Gradle 8.7 • Kotlin 2.0.0 • Room 2.6.1 • Compose BOM 2024.06.00</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-bold"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
