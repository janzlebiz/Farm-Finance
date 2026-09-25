import React, { useState } from 'react';
import { AuditLog } from '../types';
import { DateUtils } from '../utils/date';
import { ShieldCheck, History, Filter, X } from 'lucide-react';

interface AuditModalProps {
  auditLogs: AuditLog[];
  onClose: () => void;
}

export const AuditModal: React.FC<AuditModalProps> = ({ auditLogs, onClose }) => {
  const [filterType, setFilterType] = useState<string>('ALL');

  const filteredLogs = auditLogs.filter((log) => {
    if (filterType !== 'ALL' && log.entityType !== filterType) return false;
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in duration-150">
        
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <History className="w-5 h-5 text-emerald-400" />
            <div>
              <h2 className="font-bold text-base">Append-Only Audit Trail</h2>
              <p className="text-xs text-slate-400">Traceable historical transaction log</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-full text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Chips */}
        <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center gap-1.5 overflow-x-auto text-xs">
          {['ALL', 'SALE', 'PAYMENT', 'EXPENSE', 'BUYER', 'CYCLE', 'HARVEST', 'BACKUP'].map((t) => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                filterType === t ? 'bg-slate-900 text-white' : 'bg-white border text-slate-600'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Audit Log Stream */}
        <div className="p-5 overflow-y-auto space-y-2.5 flex-1 text-xs">
          {filteredLogs.map((log) => (
            <div key={log.id} className="p-3 rounded-xl border border-slate-200 bg-white space-y-1">
              <div className="flex items-center justify-between">
                <span className="px-1.5 py-0.5 rounded bg-slate-100 font-bold text-[10px] text-slate-700">
                  {log.entityType} • {log.eventType}
                </span>
                <span className="text-[10px] text-slate-400">
                  {new Date(log.timestamp).toLocaleString()}
                </span>
              </div>
              <p className="font-medium text-slate-900">{log.summary}</p>
              <div className="text-[10px] text-slate-400 font-mono">
                Entity: {log.entityId} • v{log.appVersion}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
