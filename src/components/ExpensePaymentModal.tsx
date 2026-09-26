import React, { useState } from 'react';
import { Expense, PaymentMethod } from '../types';
import { MoneyUtils } from '../utils/money';
import { StorageService } from '../services/storage';
import { X, CheckCircle, AlertTriangle } from 'lucide-react';

interface ExpensePaymentModalProps {
  expense: Expense;
  remainingBalanceCentavos: number;
  onClose: () => void;
  onSuccess: () => void;
}

export const ExpensePaymentModal: React.FC<ExpensePaymentModalProps> = ({
  expense,
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

  const enteredCentavos = MoneyUtils.pesosToCentavos(amountStr);
  const isOverpaying = enteredCentavos > remainingBalanceCentavos;

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

    const result = StorageService.recordExpensePayment({
      expenseId: expense.id,
      amountCentavos: enteredCentavos,
      date,
      paymentMethod,
      reference: reference.trim() || undefined,
      notes: notes.trim() || undefined
    });

    if (result.error) {
      setErrorMessage(result.error);
    } else {
      setSuccessMessage(`Recorded ${MoneyUtils.formatPesos(enteredCentavos)} expense payment successfully.`);
      setTimeout(() => {
        onSuccess();
      }, 500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4">
      <div className="bg-white w-full max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in slide-in-from-bottom duration-200">
        
        {/* Header */}
        <div className="bg-amber-900 text-white px-5 py-4 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider text-amber-200 font-semibold">Expense Settlement</div>
            <h2 className="text-lg font-bold">Record Expense Payment</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-amber-800 text-amber-100"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Expense Summary Card */}
        <div className="bg-amber-50/80 p-4 border-b border-amber-100 flex flex-col gap-2 text-xs sm:text-sm">
          <div className="flex justify-between items-center">
            <span className="text-amber-950 font-medium">Category:</span>
            <span className="font-bold text-slate-800">{expense.category}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-amber-950 font-medium">Description:</span>
            <span className="font-semibold text-slate-700 truncate max-w-[200px]">{expense.description}</span>
          </div>
          {expense.supplierNameSnapshot && (
            <div className="flex justify-between items-center">
              <span className="text-amber-950 font-medium">Payee / Supplier:</span>
              <span className="font-semibold text-slate-800">{expense.supplierNameSnapshot}</span>
            </div>
          )}
          <div className="pt-2 border-t border-amber-200/60 grid grid-cols-3 gap-2 text-center">
            <div>
              <span className="text-[11px] text-slate-500 block">Total Incurred</span>
              <span className="font-bold text-slate-800">{MoneyUtils.formatPesos(expense.amountIncurredCentavos)}</span>
            </div>
            <div>
              <span className="text-[11px] text-slate-500 block">Amount Paid</span>
              <span className="font-bold text-emerald-700">{MoneyUtils.formatPesos(expense.amountPaidCentavos)}</span>
            </div>
            <div>
              <span className="text-[11px] text-slate-500 block">Remaining</span>
              <span className="font-bold text-red-700">{MoneyUtils.formatPesos(remainingBalanceCentavos)}</span>
            </div>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 text-xs sm:text-sm">
          
          {/* Quick Pay Options */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
              Quick Options
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleQuickAmount(remainingBalanceCentavos)}
                className="px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-950 text-xs font-bold rounded-lg transition"
              >
                Pay Full Balance ({MoneyUtils.formatPesos(remainingBalanceCentavos)})
              </button>
              {remainingBalanceCentavos >= 50000 && (
                <button
                  type="button"
                  onClick={() => handleQuickAmount(50000)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-medium rounded-lg transition"
                >
                  ₱500
                </button>
              )}
              {remainingBalanceCentavos >= 100000 && (
                <button
                  type="button"
                  onClick={() => handleQuickAmount(100000)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-medium rounded-lg transition"
                >
                  ₱1,000
                </button>
              )}
              {remainingBalanceCentavos >= 500000 && (
                <button
                  type="button"
                  onClick={() => handleQuickAmount(500000)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-medium rounded-lg transition"
                >
                  ₱5,000
                </button>
              )}
            </div>
          </div>

          {/* Payment Amount Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-800 mb-1">
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
                max={remainingBalanceCentavos / 100}
                required
                value={amountStr}
                onChange={(e) => {
                  setAmountStr(e.target.value);
                  setErrorMessage(null);
                }}
                placeholder="50.00"
                className={`w-full pl-8 pr-4 py-2.5 rounded-xl border text-sm font-bold focus:outline-hidden focus:ring-2 ${
                  isOverpaying
                    ? 'border-red-400 bg-red-50 text-red-900 focus:ring-red-500'
                    : 'border-slate-300 focus:ring-amber-700'
                }`}
              />
            </div>
            {isOverpaying && (
              <p className="text-xs text-red-600 font-medium mt-1">
                Payment cannot exceed remaining balance of {MoneyUtils.formatPesos(remainingBalanceCentavos)}.
              </p>
            )}
          </div>

          {/* Payment Date & Method */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Payment Date *
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-amber-700"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Payment Method *
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-amber-700 bg-white"
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Receipt / Voucher #
              </label>
              <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="e.g. VOUCHER-02"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-hidden focus:ring-2 focus:ring-amber-700"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Notes
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. 2nd partial payment"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-hidden focus:ring-2 focus:ring-amber-700"
              />
            </div>
          </div>

          {errorMessage && (
            <div className="p-3 bg-red-50 text-red-800 text-xs rounded-xl border border-red-200 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
              <div>{errorMessage}</div>
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-emerald-50 text-emerald-800 text-xs rounded-xl border border-emerald-200 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
              <div>{successMessage}</div>
            </div>
          )}

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-600 font-medium text-xs hover:bg-slate-100 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isOverpaying || enteredCentavos <= 0}
              className="px-5 py-2.5 bg-amber-900 hover:bg-amber-950 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-2"
            >
              <CheckCircle className="w-4 h-4" />
              Record Payment ({MoneyUtils.formatPesos(enteredCentavos)})
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
