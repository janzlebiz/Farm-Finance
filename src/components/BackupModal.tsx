import React, { useState, useRef } from 'react';
import { StorageService } from '../services/storage';
import {
  Download,
  Upload,
  FileSpreadsheet,
  AlertTriangle,
  RotateCcw,
  CheckCircle,
  X,
  Loader2
} from 'lucide-react';

interface BackupModalProps {
  onClose: () => void;
  onReload: () => void;
}

export const BackupModal: React.FC<BackupModalProps> = ({ onClose, onReload }) => {
  const [restoreStatus, setRestoreStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  // Restore Confirmation UX States
  const [pendingBackupJson, setPendingBackupJson] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDownloadBackup = async () => {
    if (StorageService.isNativeAndroid()) {
      setIsProcessing(true);
      try {
        const res = await StorageService.exportNativeBackup();
        if (!res.cancelled) {
          setRestoreStatus({
            success: res.success,
            message: res.message
          });
        }
      } catch (err: any) {
        setRestoreStatus({
          success: false,
          message: err.message || 'Export backup failed.'
        });
      } finally {
        setIsProcessing(false);
      }
      return;
    }

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
    setRestoreStatus({
      success: true,
      message: 'Backup JSON downloaded successfully.'
    });
  };

  // Step 1: Open file picker (Native or Web)
  const handleInitiateRestore = async () => {
    setRestoreStatus(null);
    if (StorageService.isNativeAndroid()) {
      setIsProcessing(true);
      try {
        const res = await StorageService.pickNativeBackupFile();
        if (res.cancelled) {
          // User cancelled document picker: do not modify any data
          return;
        }
        if (res.success && res.content) {
          // File selected: DO NOT immediately restore. Stage for confirmation.
          setPendingBackupJson(res.content);
          setShowConfirmDialog(true);
        } else {
          setRestoreStatus({
            success: false,
            message: res.message || 'Could not read selected backup file.'
          });
        }
      } catch (err: any) {
        setRestoreStatus({
          success: false,
          message: err.message || 'Failed to select backup file.'
        });
      } finally {
        setIsProcessing(false);
      }
    } else {
      fileInputRef.current?.click();
    }
  };

  // Web File Picker Change Handler
  const handleWebFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        // Stage for confirmation
        setPendingBackupJson(content);
        setShowConfirmDialog(true);
      }
    };
    reader.readAsText(file);

    // Reset input so re-selecting same file triggers change
    if (e.target) {
      e.target.value = '';
    }
  };

  // Step 2: User Confirms Restore in Dialog
  const handleConfirmRestore = async () => {
    if (!pendingBackupJson) return;

    setShowConfirmDialog(false);
    setIsRestoring(true);
    setRestoreStatus(null);

    // Small yield to allow UI to render processing state
    await new Promise((resolve) => setTimeout(resolve, 80));

    try {
      const res = StorageService.validateAndRestoreBackup(pendingBackupJson);
      setPendingBackupJson(null);
      setIsRestoring(false);

      if (res.success) {
        // Show success confirmation dialog (do not auto-redirect)
        setShowSuccessDialog(true);
      } else {
        // Stay on screen and show error
        setRestoreStatus({
          success: false,
          message: res.message || 'Restore failed: Invalid or corrupt backup.'
        });
      }
    } catch (err: any) {
      setPendingBackupJson(null);
      setIsRestoring(false);
      setRestoreStatus({
        success: false,
        message: err?.message || 'Restore error occurred.'
      });
    }
  };

  const handleCancelConfirmation = () => {
    setShowConfirmDialog(false);
    setPendingBackupJson(null);
  };

  // Step 3: Dismiss Success Dialog & Return to Main Page
  const handleDismissSuccess = () => {
    setShowSuccessDialog(false);
    onReload();
    onClose();
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

  const handleResetClean = () => {
    const confirmReset = window.confirm(
      'Start fresh as a new user? This will remove all transactions, buyers, and expenses so you can use the app with your own real farm records.'
    );
    if (!confirmReset) return;

    setIsProcessing(true);
    try {
      const res = StorageService.resetToCleanState();
      localStorage.removeItem('farm_finance_onboarding_dismissed');
      setRestoreStatus({
        success: res.success,
        message: res.message
      });
      if (res.success) {
        onReload();
      }
    } catch (e: any) {
      setRestoreStatus({
        success: false,
        message: e?.message || 'Failed to clear database.'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
        <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in duration-150">
          
          {/* Header */}
          <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
            <div>
              <h2 className="font-bold text-base">Backup, Restore & Data Portability</h2>
              <p className="text-xs text-slate-400">Offline-first local data management</p>
            </div>
            <button
              onClick={onClose}
              disabled={isProcessing || isRestoring}
              className="p-1 rounded-full text-slate-400 hover:text-white disabled:opacity-50"
            >
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
                <div className="font-medium">{restoreStatus.message}</div>
              </div>
            )}

            {/* Restoring In-Progress State Banner */}
            {isRestoring && (
              <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl flex items-center gap-3 text-emerald-900">
                <Loader2 className="w-5 h-5 text-emerald-700 animate-spin shrink-0" />
                <div>
                  <div className="font-bold text-sm">Processing Restore...</div>
                  <div className="text-xs text-emerald-700">Verifying cryptographic checksum and committing records.</div>
                </div>
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
                  disabled={isProcessing || isRestoring}
                  className="flex-1 py-2 px-3 bg-emerald-800 hover:bg-emerald-900 disabled:opacity-50 text-white rounded-xl font-bold flex items-center justify-center gap-1.5 transition"
                >
                  <Download className="w-4 h-4" />
                  {isProcessing ? 'Processing...' : 'Export Backup JSON'}
                </button>

                <button
                  onClick={handleInitiateRestore}
                  disabled={isProcessing || isRestoring}
                  className="flex-1 py-2 px-3 bg-white border border-slate-300 hover:bg-slate-100 disabled:opacity-50 text-slate-800 rounded-xl font-bold flex items-center justify-center gap-1.5 transition"
                >
                  <Upload className="w-4 h-4" />
                  {isRestoring ? 'Processing...' : 'Restore Backup'}
                </button>

                {/* Hidden File Input for Web */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleWebFileSelect}
                  className="hidden"
                />
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
                    disabled={isProcessing || isRestoring}
                    className="p-2 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50 rounded-xl text-left font-medium text-slate-700 flex items-center justify-between"
                  >
                    <span>{item.label}</span>
                    <Download className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                ))}
              </div>
            </div>

            {/* Database Reset */}
            <div className="pt-3 border-t border-slate-200 space-y-2">
              <button
                onClick={handleResetClean}
                disabled={isProcessing || isRestoring}
                className="w-full py-2.5 bg-rose-50 hover:bg-rose-100 disabled:opacity-50 text-rose-800 border border-rose-300 rounded-xl font-bold flex items-center justify-center gap-2 transition"
              >
                <RotateCcw className="w-4 h-4 text-rose-600" />
                {isProcessing ? 'Clearing Data...' : 'Clear All Data (Start Fresh for New User)'}
              </button>
            </div>

          </div>

          {/* Footer */}
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
            <button
              onClick={onClose}
              disabled={isProcessing || isRestoring}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-xl font-bold"
            >
              Close
            </button>
          </div>

        </div>
      </div>

      {/* Confirmation Dialog: "Restore Backup?" */}
      {showConfirmDialog && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-full bg-amber-100 text-amber-800">
                <AlertTriangle className="w-6 h-6 text-amber-700" />
              </div>
              <h3 className="font-extrabold text-slate-900 text-base">
                Restore Backup?
              </h3>
            </div>

            <p className="text-xs leading-relaxed text-slate-600">
              This will replace the current Farm Finance data with the selected backup. This action cannot be undone.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={handleCancelConfirmation}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRestore}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 transition"
              >
                Restore
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Confirmation Dialog: "Restore Successful" */}
      {showSuccessDialog && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-full bg-emerald-100 text-emerald-800">
                <CheckCircle className="w-6 h-6 text-emerald-700" />
              </div>
              <h3 className="font-extrabold text-slate-900 text-base">
                Restore Successful
              </h3>
            </div>

            <p className="text-xs leading-relaxed text-slate-600">
              Your Farm Finance data has been restored successfully.
            </p>

            <div className="flex items-center justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={handleDismissSuccess}
                className="w-full py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 transition"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
