import React, { useState } from 'react';
import { Supplier, ExpenseCategory, PaymentMethod, ProductionCycle } from '../types';
import { MoneyUtils } from '../utils/money';
import { StorageService } from '../services/storage';
import { X, CheckCircle, AlertTriangle, Plus } from 'lucide-react';

interface ExpenseModalProps {
  categories: ExpenseCategory[];
  suppliers: Supplier[];
  cycles: ProductionCycle[];
  onClose: () => void;
  onSuccess: () => void;
}

export const ExpenseModal: React.FC<ExpenseModalProps> = ({
  categories,
  suppliers,
  cycles,
  onClose,
  onSuccess
}) => {
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [category, setCategory] = useState<string>(categories[0]?.name || 'Labor & Harvesting Wages');
  const [incurredStr, setIncurredStr] = useState<string>('');
  const [paidStr, setPaidStr] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [crop, setCrop] = useState<string>('General');
  const [cycleId, setCycleId] = useState<string>('');
  const [supplierId, setSupplierId] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [reference, setReference] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const isOtherCategory = category === 'Other Farm Expenses';

  const incurredCentavos = MoneyUtils.pesosToCentavos(incurredStr);
  const paidCentavos = MoneyUtils.pesosToCentavos(paidStr);
  const unpaidCentavos = Math.max(0, incurredCentavos - paidCentavos);
  const isPaidOverIncurred = paidCentavos > incurredCentavos;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const valErr = MoneyUtils.validateExpense(incurredCentavos, paidCentavos);
    if (valErr) {
      setError(valErr);
      return;
    }
    if (!description.trim()) {
      setError(
        isOtherCategory
          ? 'Please specify the expense details for Other Farm Expenses.'
          : 'Description is required.'
      );
      return;
    }

    const res = StorageService.createExpense({
      date,
      category,
      amountIncurredCentavos: incurredCentavos,
      amountPaidCentavos: paidCentavos,
      description: description.trim(),
      crop: crop === 'General' ? undefined : crop,
      cycleId: cycleId || undefined,
      supplierId: supplierId || undefined,
      paymentMethod,
      reference: reference.trim() || undefined,
      notes: notes.trim() || undefined
    });

    if (res.error) {
      setError(res.error);
    } else {
      onSuccess();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4">
      <div className="bg-white w-full max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in slide-in-from-bottom duration-200">
        
        {/* Header */}
        <div className="bg-amber-900 text-white px-5 py-4 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider text-amber-200 font-semibold">Farm Expenditure</div>
            <h2 className="text-lg font-bold">Record Farm Expense</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-amber-800 text-amber-100"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Incurred vs Cash Paid Banner */}
        <div className="bg-amber-50 px-5 py-3 border-b border-amber-100 flex items-center justify-between text-xs sm:text-sm">
          <div>
            <span className="text-slate-600 block">Amount Incurred</span>
            <span className="font-bold text-amber-950 text-base">{MoneyUtils.formatPesos(incurredCentavos)}</span>
          </div>
          <div className="text-center">
            <span className="text-slate-600 block">Cash Paid</span>
            <span className="font-bold text-emerald-800 text-base">{MoneyUtils.formatPesos(paidCentavos)}</span>
          </div>
          <div className="text-right">
            <span className="text-slate-600 block">Unpaid Amount</span>
            <span className="font-bold text-red-700 text-base">{MoneyUtils.formatPesos(unpaidCentavos)}</span>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4">
          
          {/* Amounts: Incurred & Paid */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Amount Incurred (₱) *
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 font-bold">₱</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={incurredStr}
                  onChange={(e) => setIncurredStr(e.target.value)}
                  placeholder="350.00"
                  className="w-full pl-7 pr-3 py-2 rounded-xl border border-slate-300 text-sm font-bold focus:outline-hidden focus:ring-2 focus:ring-amber-700"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Cash Paid Now (₱) *
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 font-bold">₱</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.00"
                  required
                  value={paidStr}
                  onChange={(e) => setPaidStr(e.target.value)}
                  placeholder="100.00"
                  className={`w-full pl-7 pr-3 py-2 rounded-xl border text-sm font-bold focus:outline-hidden focus:ring-2 ${
                    isPaidOverIncurred
                      ? 'border-red-400 bg-red-50 text-red-900 focus:ring-red-500'
                      : 'border-slate-300 focus:ring-amber-700'
                  }`}
                />
              </div>
            </div>
          </div>

          {/* Quick Pay Buttons */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPaidStr(incurredStr)}
              className="text-[11px] font-semibold text-amber-900 bg-amber-100 hover:bg-amber-200 px-2.5 py-1 rounded-md"
            >
              Paid in Full ({MoneyUtils.formatPesos(incurredCentavos)})
            </button>
            <button
              type="button"
              onClick={() => setPaidStr('0')}
              className="text-[11px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-md"
            >
              Unpaid (₱0.00 Paid)
            </button>
          </div>

          {isPaidOverIncurred && (
            <div className="p-2.5 bg-red-50 text-red-700 text-xs rounded-lg border border-red-200 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
              Cash paid cannot exceed the total expense amount incurred!
            </div>
          )}

          {/* Category Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Category *</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-medium focus:outline-hidden focus:ring-2 focus:ring-amber-700 bg-white"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Description / Specify Other Expense */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {isOtherCategory ? 'Specify Other Expense *' : 'Description *'}
            </label>
            <input
              type="text"
              required
              placeholder={
                isOtherCategory
                  ? 'e.g. transportation, repairs, miscellaneous...'
                  : 'e.g. Hauling sacks from paddy to drying pavement'
              }
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-amber-700"
            />
            {isOtherCategory && (
              <p className="text-[11px] text-amber-800 mt-1">
                Please provide details describing this specific other farm expense.
              </p>
            )}
          </div>

          {/* Crop Tagging & Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Tag Crop</label>
              <select
                value={crop}
                onChange={(e) => setCrop(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-amber-700 bg-white"
              >
                <option value="Rice">🌾 Rice</option>
                <option value="Copra">🥥 Copra</option>
                <option value="General">General Farm (Untagged)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Date *</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-amber-700"
              />
            </div>
          </div>

          {/* Supplier / Payee */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Payee / Supplier</label>
            <select
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-amber-700 bg-white"
            >
              <option value="">None / Direct Worker</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.contactNumber || 'Contact'})
                </option>
              ))}
            </select>
          </div>

          {/* Payment Method & Reference */}
          {paidCentavos > 0 && (
            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs bg-white"
                >
                  <option value="CASH">Cash</option>
                  <option value="GCASH">GCash</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                  <option value="CHECK">Check</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Receipt / Voucher #</label>
                <input
                  type="text"
                  placeholder="e.g. VOUCHER-01"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs"
                />
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 text-red-800 text-xs rounded-xl border border-red-200 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
              <div>{error}</div>
            </div>
          )}

          {/* Actions */}
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
              disabled={isPaidOverIncurred || incurredCentavos <= 0}
              className="px-5 py-2.5 bg-amber-900 hover:bg-amber-950 disabled:opacity-50 text-white font-bold text-sm rounded-xl shadow-xs transition flex items-center gap-2"
            >
              <CheckCircle className="w-4 h-4" />
              Record Expense
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
