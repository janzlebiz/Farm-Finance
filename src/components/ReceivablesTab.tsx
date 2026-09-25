import React, { useState } from 'react';
import { Sale, Payment, Buyer } from '../types';
import { StorageService } from '../services/storage';
import { MoneyUtils } from '../utils/money';
import { DateUtils } from '../utils/date';
import {
  Clock,
  AlertTriangle,
  CreditCard,
  History,
  Calendar,
  Filter,
  CheckCircle
} from 'lucide-react';

interface ReceivablesTabProps {
  sales: Sale[];
  payments: Payment[];
  buyers: Buyer[];
  onOpenPayment: (sale: Sale, remainingBalanceCentavos: number) => void;
}

export const ReceivablesTab: React.FC<ReceivablesTabProps> = ({
  sales,
  payments,
  buyers,
  onOpenPayment
}) => {
  const [buyerFilter, setBuyerFilter] = useState<string>('ALL');
  const [cropFilter, setCropFilter] = useState<string>('ALL');
  const [agingFilter, setAgingFilter] = useState<string>('ALL');
  const [selectedSaleForHistory, setSelectedSaleForHistory] = useState<Sale | null>(null);

  // Compute receivables across all active valid sales
  const receivables = sales
    .filter((s) => !s.isVoided)
    .map((sale) => {
      const summary = StorageService.getSalePaymentSummary(sale, payments);
      const ageInDays = DateUtils.getAgeInDays(sale.date);
      const agingBucket = DateUtils.getAgingBucket(ageInDays);
      return {
        sale,
        ...summary,
        ageInDays,
        agingBucket
      };
    })
    .filter((item) => item.remainingBalanceCentavos > 0);

  // Total Outstanding across all
  const totalOutstandingCentavos = receivables.reduce(
    (sum, r) => sum + r.remainingBalanceCentavos,
    0
  );

  // Aging Bucket Totals
  const currentTotal = receivables
    .filter((r) => r.agingBucket === 'Current')
    .reduce((sum, r) => sum + r.remainingBalanceCentavos, 0);
  const days30Total = receivables
    .filter((r) => r.agingBucket === '1-30 days')
    .reduce((sum, r) => sum + r.remainingBalanceCentavos, 0);
  const days60Total = receivables
    .filter((r) => r.agingBucket === '31-60 days')
    .reduce((sum, r) => sum + r.remainingBalanceCentavos, 0);
  const over60Total = receivables
    .filter((r) => r.agingBucket === '60+ days')
    .reduce((sum, r) => sum + r.remainingBalanceCentavos, 0);

  // Filtered list
  const filteredReceivables = receivables.filter((r) => {
    if (buyerFilter !== 'ALL' && r.sale.buyerId !== buyerFilter) return false;
    if (cropFilter !== 'ALL' && r.sale.crop !== cropFilter) return false;
    if (agingFilter !== 'ALL' && r.agingBucket !== agingFilter) return false;
    return true;
  });

  return (
    <div className="space-y-4 pb-16 animate-in fade-in duration-150">
      
      {/* Top Banner: Total Outstanding */}
      <div className="bg-linear-to-r from-amber-900 to-amber-800 text-white p-5 rounded-2xl shadow-md">
        <div className="text-xs uppercase tracking-wider text-amber-200 font-semibold flex items-center justify-between">
          <span>Outstanding Receivables</span>
          <span className="bg-amber-700/80 px-2 py-0.5 rounded text-[11px]">
            {receivables.length} Uncollected Sales
          </span>
        </div>
        <div className="text-3xl font-black mt-1">
          {MoneyUtils.formatPesos(totalOutstandingCentavos)}
        </div>
        <p className="text-xs text-amber-200/90 mt-1">
          Total unpaid sales balances owed by agricultural buyers.
        </p>
      </div>

      {/* Aging Analysis Cards */}
      <div>
        <div className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-slate-500" />
          Aging Breakdown
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <div
            onClick={() => setAgingFilter(agingFilter === 'Current' ? 'ALL' : 'Current')}
            className={`p-2.5 rounded-xl border cursor-pointer transition ${
              agingFilter === 'Current' ? 'border-emerald-600 bg-emerald-50' : 'border-slate-200 bg-white'
            }`}
          >
            <span className="text-slate-500 block text-[11px]">Current (Today)</span>
            <span className="font-bold text-slate-900">{MoneyUtils.formatPesos(currentTotal)}</span>
          </div>

          <div
            onClick={() => setAgingFilter(agingFilter === '1-30 days' ? 'ALL' : '1-30 days')}
            className={`p-2.5 rounded-xl border cursor-pointer transition ${
              agingFilter === '1-30 days' ? 'border-amber-600 bg-amber-50' : 'border-slate-200 bg-white'
            }`}
          >
            <span className="text-slate-500 block text-[11px]">1 - 30 Days</span>
            <span className="font-bold text-amber-900">{MoneyUtils.formatPesos(days30Total)}</span>
          </div>

          <div
            onClick={() => setAgingFilter(agingFilter === '31-60 days' ? 'ALL' : '31-60 days')}
            className={`p-2.5 rounded-xl border cursor-pointer transition ${
              agingFilter === '31-60 days' ? 'border-orange-600 bg-orange-50' : 'border-slate-200 bg-white'
            }`}
          >
            <span className="text-slate-500 block text-[11px]">31 - 60 Days</span>
            <span className="font-bold text-orange-900">{MoneyUtils.formatPesos(days60Total)}</span>
          </div>

          <div
            onClick={() => setAgingFilter(agingFilter === '60+ days' ? 'ALL' : '60+ days')}
            className={`p-2.5 rounded-xl border cursor-pointer transition ${
              agingFilter === '60+ days' ? 'border-red-600 bg-red-50' : 'border-slate-200 bg-white'
            }`}
          >
            <span className="text-slate-500 block text-[11px]">60+ Days</span>
            <span className="font-bold text-red-900">{MoneyUtils.formatPesos(over60Total)}</span>
          </div>
        </div>
      </div>

      {/* Filter Bars */}
      <div className="flex flex-wrap gap-2 text-xs">
        <select
          value={buyerFilter}
          onChange={(e) => setBuyerFilter(e.target.value)}
          className="px-2.5 py-1.5 rounded-xl border border-slate-300 bg-white text-xs font-medium focus:ring-2 focus:ring-emerald-600"
        >
          <option value="ALL">All Buyers ({buyers.length})</option>
          {buyers.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>

        <select
          value={cropFilter}
          onChange={(e) => setCropFilter(e.target.value)}
          className="px-2.5 py-1.5 rounded-xl border border-slate-300 bg-white text-xs font-medium focus:ring-2 focus:ring-emerald-600"
        >
          <option value="ALL">All Crops</option>
          <option value="Rice">🌾 Rice</option>
          <option value="Copra">🥥 Copra</option>
        </select>

        {agingFilter !== 'ALL' && (
          <button
            onClick={() => setAgingFilter('ALL')}
            className="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 rounded-xl text-slate-700 text-xs font-semibold"
          >
            Clear Aging Filter ✕
          </button>
        )}
      </div>

      {/* Receivables List */}
      {filteredReceivables.length === 0 ? (
        <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
          <CheckCircle className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-700">No outstanding receivables matching criteria</p>
          <p className="text-xs text-slate-400 mt-1">All sales in this selection are fully paid.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredReceivables.map(({ sale, remainingBalanceCentavos, totalPaidCentavos, ageInDays, agingBucket }) => (
            <div
              key={sale.id}
              className="bg-white rounded-2xl p-4 border border-amber-200 shadow-xs space-y-3"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                    <span>{sale.crop === 'Rice' ? '🌾' : '🥥'}</span>
                    {sale.buyerNameSnapshot}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Sale Date: {DateUtils.formatDisplayDate(sale.date)} • {sale.crop} ({sale.quantity} {sale.unit})
                  </div>
                </div>

                <div className="text-right">
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                    agingBucket === '60+ days'
                      ? 'bg-red-100 text-red-800'
                      : agingBucket === '31-60 days'
                      ? 'bg-orange-100 text-orange-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    {ageInDays === 0 ? 'Today' : `${ageInDays} days old`}
                  </span>
                </div>
              </div>

              {/* Amount Breakdown */}
              <div className="grid grid-cols-3 gap-2 bg-amber-50/50 p-2.5 rounded-xl border border-amber-100 text-xs">
                <div>
                  <span className="text-slate-500 block text-[11px]">Total Sale</span>
                  <span className="font-semibold text-slate-800">{MoneyUtils.formatPesos(sale.grossAmountCentavos)}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Paid to Date</span>
                  <span className="font-semibold text-emerald-700">{MoneyUtils.formatPesos(totalPaidCentavos)}</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-500 block text-[11px]">Remaining Due</span>
                  <span className="font-bold text-red-700">{MoneyUtils.formatPesos(remainingBalanceCentavos)}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-1">
                <button
                  onClick={() => setSelectedSaleForHistory(sale)}
                  className="text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1"
                >
                  <History className="w-3.5 h-3.5" />
                  View Payment Log
                </button>

                <button
                  onClick={() => onOpenPayment(sale, remainingBalanceCentavos)}
                  className="px-3.5 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-bold shadow-2xs flex items-center gap-1.5 transition"
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  Record Payment
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Payment History Modal */}
      {selectedSaleForHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-5 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Payment History</h3>
                <p className="text-xs text-slate-500">
                  {selectedSaleForHistory.crop} Sale to {selectedSaleForHistory.buyerNameSnapshot}
                </p>
              </div>
              <button
                onClick={() => setSelectedSaleForHistory(null)}
                className="p-1 rounded-full text-slate-400 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <div className="py-3 overflow-y-auto space-y-2 flex-1">
              {payments.filter((p) => p.saleId === selectedSaleForHistory.id && !p.isVoided).length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-6">No payments recorded yet.</p>
              ) : (
                payments
                  .filter((p) => p.saleId === selectedSaleForHistory.id && !p.isVoided)
                  .map((p) => (
                    <div key={p.id} className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-100 text-xs">
                      <div className="flex justify-between font-bold text-emerald-900">
                        <span>{MoneyUtils.formatPesos(p.amountCentavos)}</span>
                        <span className="text-[10px] text-slate-500 font-normal">{DateUtils.formatDisplayDate(p.date)}</span>
                      </div>
                      <div className="text-slate-600 mt-1 flex justify-between">
                        <span>{p.paymentMethod}</span>
                        {p.reference && <span>Ref: {p.reference}</span>}
                      </div>
                    </div>
                  ))
              )}
            </div>

            <button
              onClick={() => setSelectedSaleForHistory(null)}
              className="mt-3 w-full py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl"
            >
              Close
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
