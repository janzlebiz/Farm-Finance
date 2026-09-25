import React, { useState } from 'react';
import { DateFilterType } from '../types';
import { StorageService } from '../services/storage';
import { MoneyUtils } from '../utils/money';
import {
  TrendingUp,
  DollarSign,
  ArrowDownRight,
  ArrowUpRight,
  Clock,
  Sparkles,
  PlusCircle,
  Receipt,
  Calendar,
  Layers
} from 'lucide-react';

interface DashboardTabProps {
  onOpenNewSale: () => void;
  onOpenNewExpense: () => void;
  onNavigateToTab: (tab: string) => void;
  onOpenInstall?: () => void;
}

export const DashboardTab: React.FC<DashboardTabProps> = ({
  onOpenNewSale,
  onOpenNewExpense,
  onNavigateToTab,
  onOpenInstall
}) => {
  const [dateFilter, setDateFilter] = useState<DateFilterType>('month');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');

  const metrics = StorageService.calculateMetrics(dateFilter, customStart, customEnd);
  const netCashFlowCentavos = metrics.cashReceivedCentavos - metrics.cashPaidCentavos;

  return (
    <div className="space-y-4 pb-12 animate-in fade-in duration-150">
      
      {/* Date Filter Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs font-semibold">
        {(['today', 'week', 'month', 'year', 'all'] as DateFilterType[]).map((f) => (
          <button
            key={f}
            onClick={() => setDateFilter(f)}
            className={`px-3 py-1.5 rounded-full capitalize whitespace-nowrap transition ${
              dateFilter === f
                ? 'bg-emerald-800 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {f === 'week' ? 'This Week' : f === 'month' ? 'This Month' : f === 'year' ? 'This Year' : f}
          </button>
        ))}
        <button
          onClick={() => setDateFilter('custom')}
          className={`px-3 py-1.5 rounded-full capitalize whitespace-nowrap transition flex items-center gap-1 ${
            dateFilter === 'custom'
              ? 'bg-emerald-800 text-white shadow-xs'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" /> Custom
        </button>
      </div>

      {dateFilter === 'custom' && (
        <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200 flex flex-wrap gap-2 text-xs">
          <div className="flex-1 min-w-[120px]">
            <span className="text-slate-600 block mb-0.5">Start Date</span>
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="w-full px-2 py-1 bg-white rounded-lg border text-xs"
            />
          </div>
          <div className="flex-1 min-w-[120px]">
            <span className="text-slate-600 block mb-0.5">End Date</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="w-full px-2 py-1 bg-white rounded-lg border text-xs"
            />
          </div>
        </div>
      )}

      {/* Primary KPI Card: Net Farm Income */}
      <div className="bg-linear-to-br from-emerald-900 via-emerald-800 to-teal-900 text-white p-5 rounded-2xl shadow-md">
        <div className="flex items-center justify-between text-emerald-200 text-xs font-semibold mb-1">
          <span className="uppercase tracking-wider">Accrual Net Income</span>
          <span className="bg-emerald-700/60 text-emerald-100 px-2 py-0.5 rounded-md text-[11px]">
            Revenue - Incurred Costs
          </span>
        </div>

        <div className="text-3xl font-extrabold tracking-tight mt-1">
          {MoneyUtils.formatPesos(metrics.netIncomeCentavos)}
        </div>

        <div className="grid grid-cols-2 gap-3 mt-4 pt-3 border-t border-emerald-700/60 text-xs">
          <div>
            <div className="text-emerald-300">Total Revenue</div>
            <div className="text-base font-bold text-white">
              {MoneyUtils.formatPesos(metrics.totalRevenueCentavos)}
            </div>
            <div className="text-[11px] text-emerald-300/80">{metrics.salesCount} sales recorded</div>
          </div>
          <div>
            <div className="text-emerald-300">Total Expenses Incurred</div>
            <div className="text-base font-bold text-white">
              {MoneyUtils.formatPesos(metrics.totalExpensesCentavos)}
            </div>
            <div className="text-[11px] text-emerald-300/80">{metrics.expensesCount} expenses recorded</div>
          </div>
        </div>
      </div>

      {/* New User Welcome Card (Shown when account has 0 records) */}
      {metrics.salesCount === 0 && metrics.expensesCount === 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">🌱</span>
            <div>
              <h4 className="font-bold text-sm text-emerald-950">Welcome to Farm Finance!</h4>
              <p className="text-xs text-emerald-700">Your account is clean and ready. Tap below to record your first transaction.</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs pt-1">
            <button
              onClick={onOpenNewSale}
              className="py-2.5 px-3 bg-emerald-800 hover:bg-emerald-900 text-white font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-xs transition"
            >
              <PlusCircle className="w-4 h-4" />
              Record First Sale
            </button>
            <button
              onClick={onOpenNewExpense}
              className="py-2.5 px-3 bg-amber-800 hover:bg-amber-900 text-white font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-xs transition"
            >
              <Receipt className="w-4 h-4" />
              Record First Expense
            </button>
          </div>
        </div>
      )}

      {/* Cash Flow vs Receivables Grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Cash Received */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-1">
            <span>Cash Received</span>
            <ArrowDownRight className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-lg font-bold text-emerald-800">
            {MoneyUtils.formatPesos(metrics.cashReceivedCentavos)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Actual cash deposited
          </div>
        </div>

        {/* Cash Paid */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-1">
            <span>Cash Paid</span>
            <ArrowUpRight className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-lg font-bold text-slate-800">
            {MoneyUtils.formatPesos(metrics.cashPaidCentavos)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Disbursed expense cash
          </div>
        </div>
      </div>

      {/* Outstanding Receivables Highlight */}
      <div
        onClick={() => onNavigateToTab('receivables')}
        className="bg-amber-50/90 border border-amber-200/80 p-4 rounded-xl flex items-center justify-between cursor-pointer hover:bg-amber-100/70 transition"
      >
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-200/80 text-amber-900 rounded-xl">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-amber-900 font-medium">Total Uncollected Receivables</div>
            <div className="text-xl font-extrabold text-amber-950">
              {MoneyUtils.formatPesos(metrics.outstandingReceivablesCentavos)}
            </div>
            <div className="text-[11px] text-amber-800">Tap to view aging and buyer balances</div>
          </div>
        </div>
        <span className="text-amber-800 font-bold text-sm">→</span>
      </div>

      {/* Net Cash Flow Banner */}
      <div className="bg-slate-900 text-white p-3.5 rounded-xl flex items-center justify-between text-xs">
        <div>
          <span className="text-slate-400 block">Actual Net Cash Flow (Cash In - Cash Out)</span>
          <span className="text-base font-bold text-emerald-400">
            {MoneyUtils.formatPesos(netCashFlowCentavos)}
          </span>
        </div>
        <div className="text-right text-[11px] text-slate-400">
          <div>Cash Rec: {MoneyUtils.formatPesosCompact(metrics.cashReceivedCentavos)}</div>
          <div>Cash Paid: {MoneyUtils.formatPesosCompact(metrics.cashPaidCentavos)}</div>
        </div>
      </div>

      {/* Crop Profitability Section */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-emerald-700" />
            Crop Profitability
          </h3>
          <button
            onClick={() => onNavigateToTab('reports')}
            className="text-xs text-emerald-800 font-semibold hover:underline"
          >
            Full Analysis
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Rice */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                <span className="text-base">🌾</span> Rice (Palay)
              </span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                {MoneyUtils.formatPesos(metrics.riceProfitabilityCentavos)}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              High-yield wet & dry season crops. Accrual net profit calculated from direct tagged sales and expenses.
            </p>
          </div>

          {/* Copra */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                <span className="text-base">🥥</span> Copra (Dried)
              </span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-900">
                {MoneyUtils.formatPesos(metrics.copraProfitabilityCentavos)}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Coconut copra kiln & sun-dried harvest trading.
            </p>
          </div>
        </div>
      </div>

      {/* Install App on Phone Card */}
      {onOpenInstall && (
        <div
          onClick={onOpenInstall}
          className="bg-emerald-50 border border-emerald-200/90 rounded-xl p-3 flex items-center justify-between cursor-pointer hover:bg-emerald-100/70 transition shadow-xs"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-700 text-white rounded-lg shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                <span>Install Farm Finance on Phone</span>
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-200 text-emerald-900 font-bold uppercase">Offline Ready</span>
              </div>
              <div className="text-[11px] text-emerald-700">
                1-click install for Android & iOS or download native APK
              </div>
            </div>
          </div>
          <span className="text-emerald-800 font-bold text-xs">Install →</span>
        </div>
      )}

      {/* Action Buttons */}
      <div className="pt-2 grid grid-cols-2 gap-3">
        <button
          onClick={onOpenNewSale}
          className="py-3 px-4 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl font-bold text-sm shadow-xs flex items-center justify-center gap-2 transition"
        >
          <PlusCircle className="w-4 h-4" />
          Record Sale
        </button>
        <button
          onClick={onOpenNewExpense}
          className="py-3 px-4 bg-amber-900 hover:bg-amber-950 text-white rounded-xl font-bold text-sm shadow-xs flex items-center justify-center gap-2 transition"
        >
          <Receipt className="w-4 h-4" />
          Record Expense
        </button>
      </div>

    </div>
  );
};
