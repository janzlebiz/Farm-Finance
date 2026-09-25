import React, { useState } from 'react';
import { Expense, ExpenseCategory, Supplier } from '../types';
import { StorageService } from '../services/storage';
import { MoneyUtils } from '../utils/money';
import { DateUtils } from '../utils/date';
import {
  Receipt,
  PlusCircle,
  Search,
  Filter,
  Ban,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

interface ExpensesTabProps {
  expenses: Expense[];
  categories: ExpenseCategory[];
  suppliers: Supplier[];
  onOpenNewExpense: () => void;
  onReload: () => void;
}

export const ExpensesTab: React.FC<ExpensesTabProps> = ({
  expenses,
  categories,
  suppliers,
  onOpenNewExpense,
  onReload
}) => {
  const [search, setSearch] = useState<string>('');
  const [cropFilter, setCropFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');

  // Compute summary totals for valid expenses
  const validExpenses = expenses.filter((e) => !e.isVoided);
  const totalIncurredCentavos = validExpenses.reduce((acc, e) => acc + e.amountIncurredCentavos, 0);
  const totalCashPaidCentavos = validExpenses.reduce((acc, e) => acc + e.amountPaidCentavos, 0);
  const totalUnpaidCentavos = totalIncurredCentavos - totalCashPaidCentavos;

  // Filtered list
  const filteredExpenses = expenses.filter((e) => {
    if (cropFilter !== 'ALL') {
      if (cropFilter === 'General' && e.crop) return false;
      if (cropFilter !== 'General' && e.crop !== cropFilter) return false;
    }
    if (categoryFilter !== 'ALL' && e.category !== categoryFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchDesc = e.description.toLowerCase().includes(q);
      const matchCat = e.category.toLowerCase().includes(q);
      const matchSup = (e.supplierNameSnapshot || '').toLowerCase().includes(q);
      if (!matchDesc && !matchCat && !matchSup) return false;
    }
    return true;
  });

  const handleVoidExpense = (expense: Expense) => {
    const reason = prompt(`Enter reason for VOIDING this expense of ${MoneyUtils.formatPesos(expense.amountIncurredCentavos)}:`);
    if (reason === null) return;
    const res = StorageService.voidExpense(expense.id, reason);
    if (res.success) {
      onReload();
    } else {
      alert(res.error || 'Failed to void expense');
    }
  };

  return (
    <div className="space-y-4 pb-16 animate-in fade-in duration-150">
      
      {/* Top Banner: Incurred vs Cash Paid vs Unpaid */}
      <div className="bg-linear-to-r from-stone-900 to-amber-950 text-white p-5 rounded-2xl shadow-md">
        <div className="text-xs uppercase tracking-wider text-amber-200 font-semibold mb-1">
          Total Farm Expenditures
        </div>
        <div className="text-3xl font-extrabold tracking-tight">
          {MoneyUtils.formatPesos(totalIncurredCentavos)}
        </div>
        <div className="grid grid-cols-2 gap-3 mt-4 pt-3 border-t border-amber-800/60 text-xs">
          <div>
            <span className="text-amber-200 block text-[11px]">Cash Paid Out</span>
            <span className="text-base font-bold text-emerald-400">
              {MoneyUtils.formatPesos(totalCashPaidCentavos)}
            </span>
          </div>
          <div>
            <span className="text-amber-200 block text-[11px]">Unpaid Liabilities</span>
            <span className="text-base font-bold text-amber-400">
              {MoneyUtils.formatPesos(totalUnpaidCentavos)}
            </span>
          </div>
        </div>
      </div>

      {/* Header & Add Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-900">Recorded Expenses</h2>
          <p className="text-xs text-slate-500">Inputs, wages, fuels, supplies & machinery</p>
        </div>
        <button
          onClick={onOpenNewExpense}
          className="px-3.5 py-2 bg-amber-900 hover:bg-amber-950 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition"
        >
          <PlusCircle className="w-4 h-4" />
          New Expense
        </button>
      </div>

      {/* Search & Filters */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search description, supplier, category..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white rounded-xl border border-slate-200 text-xs focus:outline-hidden focus:ring-2 focus:ring-amber-700"
          />
        </div>

        <div className="flex items-center gap-2 text-xs">
          <select
            value={cropFilter}
            onChange={(e) => setCropFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl border border-slate-300 bg-white font-medium text-xs"
          >
            <option value="ALL">All Commodities</option>
            <option value="Rice">🌾 Rice Tagged</option>
            <option value="Copra">🥥 Copra Tagged</option>
            <option value="General">General Farm</option>
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl border border-slate-300 bg-white font-medium text-xs flex-1 truncate"
          >
            <option value="ALL">All Categories ({categories.length})</option>
            {categories.map((c) => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Expense List */}
      {filteredExpenses.length === 0 ? (
        <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
          <p className="text-sm font-semibold text-slate-600">No expenses found</p>
          <p className="text-xs text-slate-400 mt-1">Record a new farm expense to begin tracking.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredExpenses.map((expense) => {
            const unpaid = expense.amountIncurredCentavos - expense.amountPaidCentavos;
            const isVoided = expense.isVoided;

            return (
              <div
                key={expense.id}
                className={`bg-white rounded-2xl p-4 border transition shadow-xs ${
                  isVoided ? 'border-slate-200 bg-slate-50/60 opacity-60' : 'border-slate-200'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-sm text-slate-900">{expense.category}</span>
                      {expense.crop && (
                        <span className="px-1.5 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-semibold rounded">
                          {expense.crop === 'Rice' ? '🌾 Rice' : '🥥 Copra'}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-700 mt-0.5 font-medium">{expense.description}</p>
                    {expense.supplierNameSnapshot && (
                      <p className="text-[11px] text-slate-500">Payee: {expense.supplierNameSnapshot}</p>
                    )}
                  </div>

                  <div className="text-right">
                    <span className="font-extrabold text-sm text-slate-900 block">
                      {MoneyUtils.formatPesos(expense.amountIncurredCentavos)}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {DateUtils.formatDisplayDate(expense.date)}
                    </span>
                  </div>
                </div>

                {/* Paid vs Unpaid status */}
                <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <span className="text-emerald-700 font-semibold">
                      Paid: {MoneyUtils.formatPesos(expense.amountPaidCentavos)}
                    </span>
                    {unpaid > 0 && (
                      <span className="text-amber-800 font-bold">
                        Unpaid: {MoneyUtils.formatPesos(unpaid)}
                      </span>
                    )}
                  </div>

                  {!isVoided && (
                    <button
                      onClick={() => handleVoidExpense(expense)}
                      className="text-[11px] text-slate-400 hover:text-red-600 flex items-center gap-1 transition"
                    >
                      <Ban className="w-3 h-3" /> Void
                    </button>
                  )}
                  {isVoided && (
                    <span className="text-[10px] uppercase font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded">
                      Voided
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};
