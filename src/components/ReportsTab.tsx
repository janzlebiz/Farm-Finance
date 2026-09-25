import React, { useState } from 'react';
import { Sale, Expense, Payment, ProductionCycle } from '../types';
import { MoneyUtils } from '../utils/money';
import {
  TrendingUp,
  BarChart3,
  PieChart,
  FileSpreadsheet,
  Layers,
  ArrowDownRight,
  ArrowUpRight,
  ShieldCheck
} from 'lucide-react';

interface ReportsTabProps {
  sales: Sale[];
  expenses: Expense[];
  payments: Payment[];
  cycles: ProductionCycle[];
}

export const ReportsTab: React.FC<ReportsTabProps> = ({
  sales,
  expenses,
  payments,
  cycles
}) => {
  const [selectedCrop, setSelectedCrop] = useState<'Rice' | 'Copra' | 'ALL'>('Rice');

  const validSales = sales.filter((s) => !s.isVoided);
  const validExpenses = expenses.filter((e) => !e.isVoided);
  const validPayments = payments.filter((p) => !p.isVoided);

  // Profitability function for a crop
  const getCropMetrics = (cropName: string, primaryUnit: string = 'kg') => {
    const cropSales = validSales.filter((s) => s.crop === cropName);
    const cropExpenses = validExpenses.filter((e) => e.crop === cropName);

    // Filter sales that use primary unit for fair weighted average
    const primaryUnitSales = cropSales.filter((s) => s.unit.toLowerCase() === primaryUnit.toLowerCase());
    const totalPrimaryQtySold = primaryUnitSales.reduce((acc, s) => acc + s.quantity, 0);
    const totalPrimaryGrossCentavos = primaryUnitSales.reduce((acc, s) => acc + s.grossAmountCentavos, 0);

    const weightedAvgCentavos =
      totalPrimaryQtySold > 0
        ? Math.round(totalPrimaryGrossCentavos / totalPrimaryQtySold)
        : 0;

    const totalRevenueCentavos = cropSales.reduce((acc, s) => acc + s.grossAmountCentavos, 0);
    const totalExpensesCentavos = cropExpenses.reduce((acc, e) => acc + e.amountIncurredCentavos, 0);
    const netProfitCentavos = totalRevenueCentavos - totalExpensesCentavos;

    const costPerUnitCentavos =
      totalPrimaryQtySold > 0
        ? Math.round(totalExpensesCentavos / totalPrimaryQtySold)
        : 0;
    const profitPerUnitCentavos = weightedAvgCentavos - costPerUnitCentavos;

    return {
      cropSales,
      cropExpenses,
      totalPrimaryQtySold,
      primaryUnit,
      weightedAvgCentavos,
      totalRevenueCentavos,
      totalExpensesCentavos,
      netProfitCentavos,
      costPerUnitCentavos,
      profitPerUnitCentavos
    };
  };

  const riceData = getCropMetrics('Rice', 'kg');
  const copraData = getCropMetrics('Copra', 'kg');

  // Overall Financial Statement
  const totalRevenueAll = validSales.reduce((acc, s) => acc + s.grossAmountCentavos, 0);
  const totalExpensesAll = validExpenses.reduce((acc, e) => acc + e.amountIncurredCentavos, 0);
  const netIncomeAll = totalRevenueAll - totalExpensesAll;

  const totalCashIn = validPayments.reduce((acc, p) => acc + p.amountCentavos, 0);
  const totalCashOut = validExpenses.reduce((acc, e) => acc + e.amountPaidCentavos, 0);
  const netCashFlow = totalCashIn - totalCashOut;

  return (
    <div className="space-y-4 pb-16 animate-in fade-in duration-150">
      
      {/* Header */}
      <div>
        <h2 className="text-base font-bold text-slate-900">Crop Profitability & Financial Reports</h2>
        <p className="text-xs text-slate-500">Accrual Profitability, Weighted Averages & Cash Flow</p>
      </div>

      {/* Crop Toggle Tabs */}
      <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-bold">
        <button
          onClick={() => setSelectedCrop('Rice')}
          className={`flex-1 py-2 rounded-lg text-center transition ${
            selectedCrop === 'Rice' ? 'bg-white text-emerald-900 shadow-xs' : 'text-slate-600'
          }`}
        >
          🌾 Rice (Palay) Report
        </button>
        <button
          onClick={() => setSelectedCrop('Copra')}
          className={`flex-1 py-2 rounded-lg text-center transition ${
            selectedCrop === 'Copra' ? 'bg-white text-amber-900 shadow-xs' : 'text-slate-600'
          }`}
        >
          🥥 Copra Report
        </button>
        <button
          onClick={() => setSelectedCrop('ALL')}
          className={`flex-1 py-2 rounded-lg text-center transition ${
            selectedCrop === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
          }`}
        >
          P&L / Cash Flow
        </button>
      </div>

      {/* RICE OR COPRA REPORT */}
      {selectedCrop !== 'ALL' && (
        <div className="space-y-3">
          {(() => {
            const data = selectedCrop === 'Rice' ? riceData : copraData;
            return (
              <>
                {/* Crop KPI Card */}
                <div className={`p-5 rounded-2xl text-white shadow-md ${
                  selectedCrop === 'Rice'
                    ? 'bg-linear-to-br from-emerald-900 via-emerald-800 to-teal-950'
                    : 'bg-linear-to-br from-amber-950 via-amber-900 to-stone-900'
                }`}>
                  <div className="flex justify-between items-center text-xs font-semibold mb-1 opacity-90">
                    <span>{selectedCrop === 'Rice' ? '🌾 Rice Grain Net Profit' : '🥥 Copra Net Profit'}</span>
                    <span className="bg-white/20 px-2 py-0.5 rounded text-[10px]">
                      {data.totalPrimaryQtySold.toLocaleString()} {data.primaryUnit} Sold
                    </span>
                  </div>
                  <div className="text-3xl font-extrabold tracking-tight">
                    {MoneyUtils.formatPesos(data.netProfitCentavos)}
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-4 pt-3 border-t border-white/20 text-xs">
                    <div>
                      <span className="opacity-80 block text-[11px]">Gross Crop Revenue</span>
                      <span className="font-bold text-white text-sm">
                        {MoneyUtils.formatPesos(data.totalRevenueCentavos)}
                      </span>
                    </div>
                    <div>
                      <span className="opacity-80 block text-[11px]">Direct Crop Expenses</span>
                      <span className="font-bold text-white text-sm">
                        {MoneyUtils.formatPesos(data.totalExpensesCentavos)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Per Unit Financials */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                  <h3 className="font-bold text-xs uppercase tracking-wide text-slate-700 flex items-center gap-1.5">
                    <BarChart3 className="w-4 h-4 text-emerald-700" />
                    Unit Economics ({data.primaryUnit})
                  </h3>

                  <div className="grid grid-cols-3 gap-2 text-center text-xs bg-slate-50 p-3 rounded-xl">
                    <div>
                      <span className="text-slate-500 block text-[10px]">Avg Selling Price</span>
                      <span className="font-bold text-slate-900">
                        {MoneyUtils.formatPesos(data.weightedAvgCentavos)}/{data.primaryUnit}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Cost Per Unit</span>
                      <span className="font-bold text-amber-900">
                        {MoneyUtils.formatPesos(data.costPerUnitCentavos)}/{data.primaryUnit}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Net Margin Per Unit</span>
                      <span className="font-bold text-emerald-800">
                        {MoneyUtils.formatPesos(data.profitPerUnitCentavos)}/{data.primaryUnit}
                      </span>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-500 italic">
                    Note: Weighted average selling price calculated strictly on comparable {data.primaryUnit} units without mixing distinct measurements.
                  </p>
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* P&L and Cash Flow Comparison */}
      {selectedCrop === 'ALL' && (
        <div className="space-y-3">
          {/* Profit & Loss Statement */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3 text-xs">
            <h3 className="font-bold text-sm text-slate-900 flex items-center justify-between">
              <span>Profit & Loss Statement (Accrual)</span>
              <span className="text-[10px] text-slate-400 font-normal">All crops</span>
            </h3>

            <div className="space-y-2 pt-1">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-600 font-medium">Rice Grain Sales</span>
                <span className="font-semibold text-slate-900">{MoneyUtils.formatPesos(riceData.totalRevenueCentavos)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-600 font-medium">Copra Dried Sales</span>
                <span className="font-semibold text-slate-900">{MoneyUtils.formatPesos(copraData.totalRevenueCentavos)}</span>
              </div>
              <div className="flex justify-between py-1.5 font-bold text-slate-900 bg-emerald-50 px-2 rounded-lg">
                <span>Total Farm Revenue</span>
                <span className="text-emerald-900">{MoneyUtils.formatPesos(totalRevenueAll)}</span>
              </div>

              <div className="flex justify-between py-1 border-b border-slate-100 pt-2">
                <span className="text-slate-600 font-medium">Rice Production Expenses</span>
                <span className="font-semibold text-amber-900">{MoneyUtils.formatPesos(riceData.totalExpensesCentavos)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-600 font-medium">Copra Production Expenses</span>
                <span className="font-semibold text-amber-900">{MoneyUtils.formatPesos(copraData.totalExpensesCentavos)}</span>
              </div>
              <div className="flex justify-between py-1.5 font-bold text-slate-900 bg-amber-50 px-2 rounded-lg">
                <span>Total Expenses Incurred</span>
                <span className="text-amber-900">{MoneyUtils.formatPesos(totalExpensesAll)}</span>
              </div>

              <div className="flex justify-between py-2.5 font-extrabold text-sm border-t-2 border-slate-900 mt-2">
                <span>Net Farm Income (Accrual)</span>
                <span className="text-emerald-800">{MoneyUtils.formatPesos(netIncomeAll)}</span>
              </div>
            </div>
          </div>

          {/* Cash Flow Statement */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3 text-xs">
            <h3 className="font-bold text-sm text-slate-900 flex items-center justify-between">
              <span>Cash Flow Statement (Cash Basis)</span>
              <span className="text-[10px] text-slate-400 font-normal">Realized cash</span>
            </h3>

            <div className="space-y-2 pt-1">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-600 font-medium">Cash Collected from Sales</span>
                <span className="font-semibold text-emerald-700">{MoneyUtils.formatPesos(totalCashIn)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-600 font-medium">Cash Disbursed for Expenses</span>
                <span className="font-semibold text-amber-800">-{MoneyUtils.formatPesos(totalCashOut)}</span>
              </div>
              <div className="flex justify-between py-2 font-bold text-slate-900 bg-slate-100 px-2 rounded-lg">
                <span>Net Change in Cash</span>
                <span className="text-slate-900">{MoneyUtils.formatPesos(netCashFlow)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
