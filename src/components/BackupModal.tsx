import React, { useState } from 'react';
import { StorageService } from '../services/storage';
import {
  Download,
  Upload,
  FileSpreadsheet,
  AlertTriangle,
  RotateCcw,
  CheckCircle,
  X
} from 'lucide-react';

interface BackupModalProps {
  onClose: () => void;
  onReload: () => void;
}

export const BackupModal: React.FC<BackupModalProps> = ({ onClose, onReload }) => {
  const [restoreStatus, setRestoreStatus] = useState<{ success: boolean; message: string } | null>(null);

  const handleDownloadBackup = () => {
    const json = StorageService.exportBackupJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `farm-finance-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadCsv = (dataset: any) => {
    const csv = StorageService.generateCsv(dataset);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `farm-finance-${dataset}-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleFileRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const confirmRestore = window.confirm(
      'Warning: Restoring will overwrite existing local data. Do you wish to continue?'
    );
    if (!confirmRestore) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const res = StorageService.validateAndRestoreBackup(content);
      setRestoreStatus(res);
      if (res.success) {
        onReload();
      }
    };
    reader.readAsText(file);
  };

  const handleResetBaseline = () => {
    const confirmReset = window.confirm(
      'Reset all data back to the Section 25 Acceptance Test Baseline? This resets Rice (1,000kg @ ₱32), Copra (850kg @ ₱42), payments (₱20k + ₱10k), and expense (₱350 incurred, ₱100 paid).'
    );
    if (!confirmReset) return;

    StorageService.resetToDefaultAcceptanceData();
    setRestoreStatus({
      success: true,
      message: 'Database reset to Section 25 Acceptance Baseline successfully.'
    });
    onReload();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in duration-150">
        
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-base">Backup, Restore & Data Portability</h2>
            <p className="text-xs text-slate-400">Offline-first local data management</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-full text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-5 text-xs flex-1">
          
          {/* Status Feedback */}
          {restoreStatus && (
            <div className={`p-3.5 rounded-xl border flex items-start gap-2.5 ${
              restoreStatus.success
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-red-50 border-red-200 text-red-900'
            }`}>
              {restoreStatus.success ? (
                <CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
              )}
              <div>{restoreStatus.message}</div>
            </div>
          )}

          {/* Full JSON Backup */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
            <div>
              <h3 className="font-bold text-sm text-slate-900">Database Snapshot (JSON)</h3>
              <p className="text-slate-500 mt-0.5">
                Export complete database with schema versioning and cryptographic integrity checksum.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleDownloadBackup}
                className="flex-1 py-2 px-3 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl font-bold flex items-center justify-center gap-1.5 transition"
              >
                <Download className="w-4 h-4" />
                Export Backup JSON
              </button>

              <label className="flex-1 py-2 px-3 bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 rounded-xl font-bold flex items-center justify-center gap-1.5 cursor-pointer transition">
                <Upload className="w-4 h-4" />
                Restore Backup
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileRestore}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* CSV Export Table */}
          <div className="space-y-2">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
              <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
              Export Datasets to CSV
            </h3>
            <p className="text-slate-500">
              Generate spreadsheet-ready comma-separated files for farm records.
            </p>

            <div className="grid grid-cols-2 gap-2 pt-1">
              {[
                { label: 'Sales CSV', key: 'sales' },
                { label: 'Payments CSV', key: 'payments' },
                { label: 'Expenses CSV', key: 'expenses' },
                { label: 'Buyers CSV', key: 'buyers' },
                { label: 'Suppliers CSV', key: 'suppliers' },
                { label: 'Harvests CSV', key: 'harvests' },
                { label: 'Production Cycles CSV', key: 'cycles' }
              ].map((item) => (
                <button
                  key={item.key}
                  onClick={() => handleDownloadCsv(item.key)}
                  className="p-2 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl text-left font-medium text-slate-700 flex items-center justify-between"
                >
                  <span>{item.label}</span>
                  <Download className="w-3.5 h-3.5 text-slate-400" />
                </button>
              ))}
            </div>
          </div>

          {/* Reset Baseline */}
          <div className="pt-3 border-t border-slate-200">
            <button
              onClick={handleResetBaseline}
              className="w-full py-2.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl font-bold flex items-center justify-center gap-2 transition"
            >
              <RotateCcw className="w-4 h-4" />
              Reset to Section 25 Acceptance Baseline
            </button>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 text-white rounded-xl font-bold"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
