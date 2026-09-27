import React from 'react';
import { ProductionCycle, Harvest, Expense, Sale } from '../types';
import { DateUtils } from '../utils/date';
import { MoneyUtils } from '../utils/money';
import { X, Sprout, Calendar, MapPin, Maximize2, Layers, Award, Edit2, TrendingUp, Receipt, ChevronRight } from 'lucide-react';

interface CycleDetailsModalProps {
  cycle: ProductionCycle;
  harvests: Harvest[];
  expenses: Expense[];
  sales: Sale[];
  onClose: () => void;
  onEdit: () => void;
  onSelectHarvest?: (harvest: Harvest) => void;
}

export const CycleDetailsModal: React.FC<CycleDetailsModalProps> = ({
  cycle,
  harvests,
  expenses,
  sales,
  onClose,
  onEdit,
  onSelectHarvest
}) => {
  const cycleHarvests = harvests.filter((h) => h.cycleId === cycle.id);
  const totalHarvestQty = cycleHarvests.reduce((acc, h) => acc + h.quantity, 0);

  const cycleExpenses = expenses.filter((e) => !e.isVoided && e.cycleId === cycle.id);
  const totalCycleCostCentavos = cycleExpenses.reduce((acc, e) => acc + e.amountIncurredCentavos, 0);

  const cycleSales = sales.filter((s) => !s.isVoided && s.cycleId === cycle.id);
  const cycleRevenueCentavos = cycleSales.reduce((acc, s) => acc + s.grossAmountCentavos, 0);
  const netIncomeCentavos = cycleRevenueCentavos - totalCycleCostCentavos;

  const isClosed = ['COMPLETED', 'CANCELLED', 'ARCHIVED'].includes(cycle.status);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        
        {/* Header */}
        <div className="bg-emerald-900 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">{cycle.crop === 'Rice' ? '🌾' : '🥥'}</span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-base">{cycle.cycleName}</h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-800 text-emerald-100 border border-emerald-700">
                  {cycle.status}
                </span>
              </div>
              <p className="text-xs text-emerald-200">
                {cycle.crop} · {cycle.farmField}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {!isClosed && (
              <button
                onClick={onEdit}
                className="px-2.5 py-1 rounded-lg bg-emerald-800 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1 transition shadow-xs"
                title="Edit cycle"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Edit</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1 rounded-full text-emerald-200 hover:text-white transition"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs sm:text-sm flex-1">
          {/* Key Figures Grid */}
          <div className="grid grid-cols-3 gap-2 bg-emerald-50/60 p-3 rounded-xl border border-emerald-100 text-center">
            <div>
              <span className="text-slate-500 block text-[11px]">Total Yield</span>
              <span className="font-extrabold text-sm text-slate-900">
                {totalHarvestQty > 0 ? `${totalHarvestQty.toLocaleString()} kg` : '0 kg'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">Cycle Costs</span>
              <span className="font-semibold text-amber-900 text-xs sm:text-sm">
                {MoneyUtils.formatPesos(totalCycleCostCentavos)}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">Cycle Revenue</span>
              <span className="font-bold text-emerald-900 text-xs sm:text-sm">
                {MoneyUtils.formatPesos(cycleRevenueCentavos)}
              </span>
            </div>
          </div>

          {/* Details Table */}
          <div className="space-y-2.5">
            <div className="flex items-start justify-between py-1.5 border-b border-slate-100">
              <div className="flex items-center gap-2 text-slate-600">
                <Sprout className="w-4 h-4 text-emerald-700" />
                <span className="font-medium">Crop Commodity</span>
              </div>
              <span className="font-bold text-slate-900">{cycle.crop}</span>
            </div>

            <div className="flex items-start justify-between py-1.5 border-b border-slate-100">
              <div className="flex items-center gap-2 text-slate-600">
                <MapPin className="w-4 h-4 text-slate-500" />
                <span className="font-medium">Field / Parcel</span>
              </div>
              <span className="font-bold text-slate-900">{cycle.farmField}</span>
            </div>

            <div className="flex items-start justify-between py-1.5 border-b border-slate-100">
              <div className="flex items-center gap-2 text-slate-600">
                <Maximize2 className="w-4 h-4 text-slate-500" />
                <span className="font-medium">Planted Area</span>
              </div>
              <span className="font-bold text-slate-900">{cycle.area} {cycle.areaUnit}</span>
            </div>

            <div className="flex items-start justify-between py-1.5 border-b border-slate-100">
              <div className="flex items-center gap-2 text-slate-600">
                <Calendar className="w-4 h-4 text-slate-500" />
                <span className="font-medium">Planting / Start Date</span>
              </div>
              <div className="text-right">
                <span className="font-bold text-slate-900 block">{DateUtils.formatDisplayDate(cycle.startDate)}</span>
                <span className="text-[11px] text-slate-400">{cycle.startDate}</span>
              </div>
            </div>

            {cycle.completionDate && (
              <div className="flex items-start justify-between py-1.5 border-b border-slate-100 bg-amber-50/50 px-2 rounded-lg">
                <div className="flex items-center gap-2 text-amber-900">
                  <Calendar className="w-4 h-4 text-amber-700" />
                  <span className="font-medium">Completion Date</span>
                </div>
                <div className="text-right">
                  <span className="font-bold text-amber-950 block">{DateUtils.formatDisplayDate(cycle.completionDate)}</span>
                  <span className="text-[11px] text-amber-700/80">{cycle.completionDate}</span>
                </div>
              </div>
            )}

            {cycle.notes && (
              <div className="py-2 border-b border-slate-100">
                <span className="text-slate-500 font-medium block mb-1">Notes:</span>
                <p className="text-xs text-slate-700 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  {cycle.notes}
                </p>
              </div>
            )}
          </div>

          {/* Harvest Batches in this Cycle */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Harvest Batches ({cycleHarvests.length})
              </span>
            </div>
            {cycleHarvests.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-2">No harvest batches recorded for this cycle yet.</p>
            ) : (
              <div className="space-y-1.5">
                {cycleHarvests.map((h) => (
                  <div
                    key={h.id}
                    onClick={() => onSelectHarvest?.(h)}
                    className="flex items-center justify-between text-xs bg-slate-50 hover:bg-emerald-50 cursor-pointer p-2.5 rounded-xl border border-slate-200 hover:border-emerald-300 transition"
                  >
                    <div>
                      <span className="font-bold text-slate-900">
                        {h.quantity.toLocaleString()} {h.unit}
                      </span>
                      {h.gradeQuality && (
                        <span className="text-slate-500 ml-1.5">· {h.gradeQuality}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-slate-500">{DateUtils.formatDisplayDate(h.date)}</span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center gap-2">
            {!isClosed ? (
              <button
                onClick={onEdit}
                className="flex-1 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 font-bold text-xs rounded-xl border border-emerald-200 flex items-center justify-center gap-1.5 transition"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Edit Cycle Details</span>
              </button>
            ) : (
              <div className="flex-1 py-2.5 bg-slate-50 text-slate-500 font-semibold text-xs rounded-xl border border-slate-200 flex items-center justify-center gap-1.5">
                <span>Closed Record (Read-Only)</span>
              </div>
            )}
            <button
              onClick={onClose}
              className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition"
            >
              Close
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
