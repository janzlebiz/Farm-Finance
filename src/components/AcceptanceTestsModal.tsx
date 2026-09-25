import React, { useState } from 'react';
import { runRealWorldAcceptanceTests, TestResultItem } from '../utils/acceptanceTests';
import { X, CheckCircle2, XCircle, ShieldCheck, RefreshCw } from 'lucide-react';

interface AcceptanceTestsModalProps {
  onClose: () => void;
}

export const AcceptanceTestsModal: React.FC<AcceptanceTestsModalProps> = ({ onClose }) => {
  const [suiteResult, setSuiteResult] = useState(runRealWorldAcceptanceTests());

  const handleRerun = () => {
    setSuiteResult(runRealWorldAcceptanceTests());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in duration-150">
        
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-6 h-6 text-emerald-400" />
            <div>
              <h2 className="font-bold text-base">Real-World Acceptance Test Suite</h2>
              <p className="text-xs text-slate-400">Section 25 Automated Integrity & Business Rules</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-full text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Scorecard */}
        <div className={`p-4 border-b flex items-center justify-between ${
          suiteResult.allPassed ? 'bg-emerald-50 border-emerald-100 text-emerald-950' : 'bg-red-50 border-red-100 text-red-950'
        }`}>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider">Suite Status</div>
            <div className="text-xl font-black flex items-center gap-2">
              {suiteResult.allPassed ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  100% PASSED ({suiteResult.passedTests}/{suiteResult.totalTests} Checks)
                </>
              ) : (
                <>
                  <XCircle className="w-5 h-5 text-red-600" />
                  {suiteResult.passedTests}/{suiteResult.totalTests} Passed
                </>
              )}
            </div>
          </div>

          <button
            onClick={handleRerun}
            className="px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 shadow-2xs"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Re-run
          </button>
        </div>

        {/* Tests List */}
        <div className="p-5 overflow-y-auto space-y-3 flex-1 text-xs">
          {suiteResult.results.map((test) => (
            <div
              key={test.id}
              className={`p-3.5 rounded-xl border transition ${
                test.passed
                  ? 'border-emerald-200 bg-emerald-50/40'
                  : 'border-red-200 bg-red-50/50'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  {test.passed ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-600 shrink-0" />
                  )}
                  <span className="font-bold text-slate-900">{test.title}</span>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-600">
                  {test.category}
                </span>
              </div>

              <div className="mt-2 space-y-1 pl-6 text-slate-600">
                <div>
                  <span className="font-semibold text-slate-500">Expected:</span>{' '}
                  <span className="font-mono text-slate-800">{test.expected}</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-500">Actual:</span>{' '}
                  <span className="font-mono font-bold text-slate-900">{test.actual}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
