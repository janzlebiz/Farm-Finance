import React from 'react';
import { Harvest, ProductionCycle } from '../types';
import { DateUtils } from '../utils/date';
import { X, Sprout, Calendar, Scale, Award, FileText, Layers } from 'lucide-react';

interface HarvestDetailsModalProps {
  harvest: Harvest;
  cycle?: ProductionCycle;
  onClose: () => void;
}

export const HarvestDetailsModal: React.FC<HarvestDetailsModalProps> = ({
  harvest,
  cycle,
  onClose
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-amber-900 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">{harvest.crop === 'Rice' ? '🌾' : '🥥'}</span>
            <div>
              <h2 className="font-bold text-base">Harvest Details</h2>
              <p className="text-xs text-amber-200">
                {harvest.crop} · {DateUtils.formatDisplayDate(harvest.date)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-amber-200 hover:text-white transition"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs sm:text-sm">
          {/* Main Yield Card */}
          <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4 text-center">
            <span className="text-xs text-amber-900/80 font-medium block mb-0.5">Quantity Harvested</span>
            <div className="text-2xl font-black text-amber-950">
              {harvest.quantity.toLocaleString()} <span className="text-base font-semibold">{harvest.unit}</span>
            </div>
            {harvest.gradeQuality && (
              <div className="mt-2 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 font-semibold text-xs border border-amber-300">
                <Award className="w-3.5 h-3.5" />
                <span>{harvest.gradeQuality}</span>
              </div>
            )}
          </div>

          {/* Details Grid */}
          <div className="space-y-3">
            <div className="flex items-start justify-between py-2 border-b border-slate-100">
              <div className="flex items-center gap-2 text-slate-600">
                <Sprout className="w-4 h-4 text-emerald-700" />
                <span className="font-medium">Crop Commodity</span>
              </div>
              <span className="font-bold text-slate-900">{harvest.crop}</span>
            </div>

            <div className="flex items-start justify-between py-2 border-b border-slate-100">
              <div className="flex items-center gap-2 text-slate-600">
                <Calendar className="w-4 h-4 text-slate-500" />
                <span className="font-medium">Harvest Date</span>
              </div>
              <div className="text-right">
                <span className="font-bold text-slate-900 block">{DateUtils.formatDisplayDate(harvest.date)}</span>
                <span className="text-[11px] text-slate-400">{harvest.date}</span>
              </div>
            </div>

            <div className="flex items-start justify-between py-2 border-b border-slate-100">
              <div className="flex items-center gap-2 text-slate-600">
                <Scale className="w-4 h-4 text-slate-500" />
                <span className="font-medium">Yield Weight / Volume</span>
              </div>
              <span className="font-bold text-slate-900">
                {harvest.quantity.toLocaleString()} {harvest.unit}
              </span>
            </div>

            <div className="flex items-start justify-between py-2 border-b border-slate-100">
              <div className="flex items-center gap-2 text-slate-600">
                <Award className="w-4 h-4 text-slate-500" />
                <span className="font-medium">Quality / Grade</span>
              </div>
              <span className="font-semibold text-slate-900">
                {harvest.gradeQuality ? harvest.gradeQuality : <span className="text-slate-400 italic">Not specified</span>}
              </span>
            </div>

            <div className="flex items-start justify-between py-2 border-b border-slate-100">
              <div className="flex items-center gap-2 text-slate-600">
                <Layers className="w-4 h-4 text-emerald-700" />
                <span className="font-medium">Production Cycle</span>
              </div>
              <div className="text-right max-w-[200px]">
                <span className="font-bold text-slate-900 block truncate">
                  {cycle ? cycle.cycleName : 'Unlinked Cycle'}
                </span>
                {cycle && (
                  <span className="text-[11px] text-slate-500 block truncate">
                    Field: {cycle.farmField} ({cycle.area} {cycle.areaUnit})
                  </span>
                )}
              </div>
            </div>

            {harvest.notes && (
              <div className="py-2 border-b border-slate-100">
                <div className="flex items-center gap-2 text-slate-600 mb-1">
                  <FileText className="w-4 h-4 text-slate-500" />
                  <span className="font-medium">Notes</span>
                </div>
                <p className="text-xs text-slate-700 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  {harvest.notes}
                </p>
              </div>
            )}
          </div>

          <div className="pt-2">
            <button
              onClick={onClose}
              className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
