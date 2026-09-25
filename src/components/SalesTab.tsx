import React, { useState } from 'react';
import { Sale, Payment } from '../types';
import { StorageService } from '../services/storage';
import { MoneyUtils } from '../utils/money';
import { DateUtils } from '../utils/date';
import {
  Search,
  Filter,
  PlusCircle,
  CreditCard,
  History,
  Ban,
  CheckCircle2,
  Clock,
  AlertCircle
} from 'lucide-react';

interface SalesTabProps {
  sales: Sale[];
  payments: Payment[];
  onOpenNewSale: () => void;
  onOpenPayment: (sale: Sale, remainingBalanceCentavos: number) => void;
  onReload: () => void;
}

export const SalesTab: React.FC<SalesTabProps> = ({
  sales,
  payments,
  onOpenNewSale,
  onOpenPayment,
  onReload
}) => {
  const [search, setSearch] = useState<string>('');
  const [cropFilter, setCropFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [selectedSaleForHistory, setSelectedSaleForHistory] = useState<Sale | null>(null);

  // Filter sales
  const filteredSales = sales.filter((sale) => {
    const summary = StorageService.getSalePaymentSummary(sale, payments);
    if (cropFilter !== 'ALL' && sale.crop !== cropFilter) return false;
    if (statusFilter !== 'ALL' && summary.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchBuyer = sale.buyerNameSnapshot.toLowerCase().includes(q);
      const matchCrop = sale.crop.toLowerCase().includes(q);
      const matchNotes = (sale.notes || '').toLowerCase().includes(q);
      if (!matchBuyer && !matchCrop && !matchNotes) return false;
    }
    return true;
  });

  const handleVoidSale = (sale: Sale) => {
    const reason = prompt(`Enter reason for VOIDING this sale of ${MoneyUtils.formatPesos(sale.grossAmountCentavos)}:`);
    if (reason === null) return;
    const res = StorageService.voidSale(sale.id, reason);
    if (res.success) {
      onReload();
    } else {
      alert(res.error || 'Failed to void sale');
    }
  };

  return (
    <div className="space-y-4 pb-16 animate-in fade-in duration-150">
      
      {/* Header & New Sale Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Sales Transactions</h2>
          <p className="text-xs text-slate-500">Record Palay grain & Copra deliveries</p>
        </div>
        <button
          onClick={onOpenNewSale}
          className="px-3.5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition"
        >
          <PlusCircle className="w-4 h-4" />
          New Sale
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search by buyer, crop, or notes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white rounded-xl border border-slate-200 text-xs focus:outline-hidden focus:ring-2 focus:ring-emerald-600"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
          {['ALL', 'Rice', 'Copra'].map((c) => (
            <button
              key={c}
              onClick={() => setCropFilter(c)}
              className={`px-3 py-1 rounded-lg font-semibold transition ${
                cropFilter === c
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {c === 'ALL' ? 'All Crops' : c === 'Rice' ? '🌾 Rice' : '🥥 Copra'}
            </button>
          ))}

          <span className="text-slate-300">|</span>

          {['ALL', 'UNPAID', 'PARTIALLY_PAID', 'PAID'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-2.5 py-1 rounded-lg font-semibold transition whitespace-nowrap ${
                statusFilter === s
                  ? 'bg-emerald-800 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {s === 'ALL' ? 'All Status' : s.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Sales List */}
      {filteredSales.length === 0 ? (
        <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
          <p className="text-sm font-semibold text-slate-600">No sales transactions found</p>
          <p className="text-xs text-slate-400 mt-1">Try adjusting your filters or record a new sale.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredSales.map((sale) => {
            const summary = StorageService.getSalePaymentSummary(sale, payments);
            const isFullyPaid = summary.status === 'PAID';
            const isVoided = sale.isVoided;

            return (
              <div
                key={sale.id}
                className={`bg-white rounded-2xl p-4 border transition shadow-xs ${
                  isVoided
                    ? 'border-slate-200 bg-slate-50/60 opacity-60'
                    : summary.remainingBalanceCentavos > 0
                    ? 'border-amber-200/90'
                    : 'border-emerald-200/80'
                }`}
              >
                {/* Header row */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{sale.crop === 'Rice' ? '🌾' : '🥥'}</span>
                    <div>
                      <div className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                        {sale.crop}
                        <span className="text-xs font-normal text-slate-500">
                          • {DateUtils.formatDisplayDate(sale.date)}
                        </span>
                      </div>
                      <div className="text-xs text-slate-600 font-medium">
                        Buyer: <strong className="text-slate-900">{sale.buyerNameSnapshot}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div>
                    {isVoided ? (
                      <span className="px-2 py-0.5 bg-slate-200 text-slate-600 text-[10px] font-bold rounded-md uppercase">
                        Voided
                      </span>
                    ) : summary.status === 'PAID' ? (
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-md uppercase flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Paid
                      </span>
                    ) : summary.status === 'PARTIALLY_PAID' ? (
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-900 text-[10px] font-bold rounded-md uppercase flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Partially Paid
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-red-100 text-red-800 text-[10px] font-bold rounded-md uppercase flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> Unpaid
                      </span>
                    )}
                  </div>
                </div>

                {/* Quantities & Financials */}
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <div>
                    <span className="text-slate-500 block">Quantity & Price</span>
                    <span className="font-semibold text-slate-800">
                      {sale.quantity.toLocaleString()} {sale.unit} @ {MoneyUtils.formatPesos(sale.unitPriceCentavos)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-500 block">Gross Sale</span>
                    <span className="font-extrabold text-slate-900 text-sm">
                      {MoneyUtils.formatPesos(sale.grossAmountCentavos)}
                    </span>
                  </div>
                </div>

                {/* Balance Progress */}
                {!isVoided && (
                  <div className="mt-2.5 flex items-center justify-between text-xs pt-1">
                    <div className="text-emerald-700 font-medium">
                      Paid: {MoneyUtils.formatPesos(summary.totalPaidCentavos)}
                    </div>
                    {summary.remainingBalanceCentavos > 0 ? (
                      <div className="text-red-700 font-bold">
                        Remaining: {MoneyUtils.formatPesos(summary.remainingBalanceCentavos)}
                      </div>
                    ) : (
                      <div className="text-emerald-800 font-semibold text-[11px]">
                        Fully Settled ✓
                      </div>
                    )}
                  </div>
                )}

                {sale.notes && (
                  <p className="text-[11px] text-slate-500 italic mt-2 border-t pt-1 border-slate-100">
                    "{sale.notes}"
                  </p>
                )}

                {/* Action Buttons */}
                {!isVoided && (
                  <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                    <div className="flex gap-2">
                      <button
                        onClick={() => setSelectedSaleForHistory(sale)}
                        className="px-2.5 py-1 text-slate-600 hover:text-slate-900 text-xs font-semibold rounded-lg hover:bg-slate-100 transition flex items-center gap-1"
                      >
                        <History className="w-3.5 h-3.5" />
                        Payments ({payments.filter((p) => p.saleId === sale.id && !p.isVoided).length})
                      </button>
                      <button
                        onClick={() => handleVoidSale(sale)}
                        className="px-2.5 py-1 text-slate-400 hover:text-red-600 text-xs font-semibold rounded-lg hover:bg-red-50 transition flex items-center gap-1"
                      >
                        <Ban className="w-3.5 h-3.5" />
                        Void
                      </button>
                    </div>

                    {!isFullyPaid && (
                      <button
                        onClick={() => onOpenPayment(sale, summary.remainingBalanceCentavos)}
                        className="px-3 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-bold shadow-2xs flex items-center gap-1.5 transition"
                      >
                        <CreditCard className="w-3.5 h-3.5" />
                        Record Payment
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
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
                  Sale #{selectedSaleForHistory.id.slice(-6)} • {selectedSaleForHistory.buyerNameSnapshot}
                </p>
              </div>
              <button
                onClick={() => setSelectedSaleForHistory(null)}
                className="p-1 rounded-full text-slate-400 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <div className="py-3 overflow-y-auto space-y-2.5 flex-1">
              {payments.filter((p) => p.saleId === selectedSaleForHistory.id).length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-6">No payments recorded yet.</p>
              ) : (
                payments
                  .filter((p) => p.saleId === selectedSaleForHistory.id)
                  .map((p) => (
                    <div
                      key={p.id}
                      className={`p-3 rounded-xl border text-xs ${
                        p.isVoided ? 'bg-slate-50 border-slate-200 opacity-50' : 'bg-emerald-50/50 border-emerald-100'
                      }`}
                    >
                      <div className="flex justify-between items-center font-bold">
                        <span className="text-emerald-900">{MoneyUtils.formatPesos(p.amountCentavos)}</span>
                        <span className="text-[10px] text-slate-500">{DateUtils.formatDisplayDate(p.date)}</span>
                      </div>
                      <div className="text-slate-600 mt-1 flex justify-between">
                        <span>Method: {p.paymentMethod}</span>
                        {p.reference && <span>Ref: {p.reference}</span>}
                      </div>
                      {p.notes && <div className="text-slate-500 italic mt-0.5">"{p.notes}"</div>}
                    </div>
                  ))
              )}
            </div>

            <button
              onClick={() => setSelectedSaleForHistory(null)}
              className="mt-3 w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
            >
              Close
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
