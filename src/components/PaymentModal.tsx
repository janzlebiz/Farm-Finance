import React, { useState } from 'react';
import { Sale, PaymentMethod } from '../types';
import { MoneyUtils } from '../utils/money';
import { StorageService } from '../services/storage';
import { X, CheckCircle, AlertTriangle, ShieldCheck } from 'lucide-react';

interface PaymentModalProps {
  sale: Sale;
  remainingBalanceCentavos: number;
  onClose: () => void;
  onSuccess: () => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  sale,
  remainingBalanceCentavos,
  onClose,
  onSuccess
}) => {
  const [amountStr, setAmountStr] = useState<string>('');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [reference, setReference] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Compute centavos for current user input
  const enteredCentavos = MoneyUtils.pesosToCentavos(amountStr);
  const isOverpaying = enteredCentavos > remainingBalanceCentavos;
  const isZeroOrNegative = enteredCentavos <= 0 && amountStr.trim().length > 0;

  const handleQuickAmount = (centavos: number) => {
    const safeAmount = Math.min(centavos, remainingBalanceCentavos);
    setAmountStr((safeAmount / 100).toString());
    setErrorMessage(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const validationErr = MoneyUtils.validatePayment(enteredCentavos, remainingBalanceCentavos);
    if (validationErr) {
      setErrorMessage(validationErr);
      return;
    }

    const result = StorageService.recordPayment({
      saleId: sale.id,
      amountCentavos: enteredCentavos,
      date,
      paymentMethod,
      reference,
      notes
    });

    if (result.error) {
      setErrorMessage(result.error);
    } else {
      setSuccessMessage(`Recorded ${MoneyUtils.formatPesos(enteredCentavos)} payment successfully.`);
      setTimeout(() => {
        onSuccess();
      }, 700);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4">
      <div className="bg-white w-full max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in slide-in-from-bottom duration-200">
        
        {/* Header */}
        <div className="bg-emerald-800 text-white px-5 py-4 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider text-emerald-200 font-semibold">Record Payment</div>
            <h2 className="text-lg font-bold">{sale.crop} Sale Payment</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-emerald-700 text-emerald-100"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sale Summary Card */}
        <div className="bg-emerald-50/80 p-4 border-b border-emerald-100 flex flex-col gap-2">
          <div className="flex justify-between items-center text-sm">
            <span className="text-emerald-900 font-medium">Buyer:</span>
            <span className="font-semibold text-emerald-950">{sale.buyerNameSnapshot}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-emerald-900 font-medium">Gross Amount:</span>
            <span className="font-semibold text-slate-800">{MoneyUtils.formatPesos(sale.grossAmountCentavos)}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-emerald-900 font-medium">Remaining Balance:</span>
            <span className="font-bold text-red-700 text-base">{MoneyUtils.formatPesos(remainingBalanceCentavos)}</span>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4">
          
          {/* Quick Pay Buttons */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
              Quick Options
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleQuickAmount(remainingBalanceCentavos)}
                className="px-3 py-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-900 text-xs font-bold rounded-lg transition"
              >
                Pay Full Balance ({MoneyUtils.formatPesos(remainingBalanceCentavos)})
              </button>
              {remainingBalanceCentavos >= 100000 && (
                <button
                  type="button"
                  onClick={() => handleQuickAmount(100000)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-medium rounded-lg transition"
                >
                  ₱1,000
                </button>
              )}
              {remainingBalanceCentavos >= 1000000 && (
                <button
                  type="button"
                  onClick={() => handleQuickAmount(1000000)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-medium rounded-lg transition"
                >
                  ₱10,000
                </button>
              )}
              {remainingBalanceCentavos >= 2000000 && (
                <button
                  type="button"
                  onClick={() => handleQuickAmount(2000000)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-medium rounded-lg transition"
                >
                  ₱20,000
                </button>
              )}
            </div>
          </div>

          {/* Payment Amount Input */}
          <div>
            <label className="block text-sm font-semibold text-slate-800 mb-1">
              Payment Amount (₱) *
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 font-bold">
                ₱
              </div>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={amountStr}
                onChange={(e) => {
                  setAmountStr(e.target.value);
                  setErrorMessage(null);
                }}
                placeholder="0.00"
                className={`w-full pl-8 pr-4 py-2.5 rounded-xl border text-lg font-bold transition focus:outline-hidden focus:ring-2 ${
                  isOverpaying
                    ? 'border-red-400 bg-red-50 text-red-900 focus:ring-red-400'
                    : 'border-slate-300 bg-white text-slate-900 focus:ring-emerald-600 focus:border-emerald-600'
                }`}
              />
            </div>

            {/* Real-time Overpayment Rejection Notice */}
            {isOverpaying && (
              <div className="mt-2 text-xs text-red-600 font-medium flex items-start gap-1.5 bg-red-50 p-2.5 rounded-lg border border-red-200">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
                <span>
                  <strong>Strict Integrity Rule:</strong> Payment cannot exceed the remaining balance of{' '}
                  {MoneyUtils.formatPesos(remainingBalanceCentavos)}. Overpayments are rejected!
                </span>
              </div>
            )}

            {isZeroOrNegative && (
              <div className="mt-2 text-xs text-red-600 font-medium flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                Zero and negative payments are rejected.
              </div>
            )}
          </div>

          {/* Payment Date & Method */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Date *</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-600"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Method *</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-600 bg-white"
              >
                <option value="CASH">Cash</option>
                <option value="GCASH">GCash</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
                <option value="CHECK">Check</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
          </div>

          {/* Reference & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Reference / OR #</label>
              <input
                type="text"
                placeholder="e.g. OR-10293 or GCash Ref"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-600"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Notes</label>
              <input
                type="text"
                placeholder="e.g. Down payment"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-600"
              />
            </div>
          </div>

          {/* Feedback messages */}
          {errorMessage && (
            <div className="p-3 bg-red-50 text-red-800 text-xs rounded-xl border border-red-200 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
              <div>{errorMessage}</div>
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-emerald-50 text-emerald-800 text-xs rounded-xl border border-emerald-200 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
              <div>{successMessage}</div>
            </div>
          )}

          {/* Submit Buttons */}
          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-600 font-medium text-sm hover:bg-slate-100 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isOverpaying || enteredCentavos <= 0}
              className="px-5 py-2.5 bg-emerald-800 hover:bg-emerald-900 disabled:opacity-50 text-white font-bold text-sm rounded-xl shadow-xs transition flex items-center gap-2"
            >
              <ShieldCheck className="w-4 h-4" />
              Confirm Payment
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
