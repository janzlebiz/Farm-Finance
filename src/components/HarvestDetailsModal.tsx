import React, { useState } from 'react';
import { Harvest, ProductionCycle } from '../types';
import { StorageService } from '../services/storage';
import { DateUtils } from '../utils/date';
import { X, Sprout, Calendar, Scale, Award, FileText, Layers, Edit2, AlertCircle } from 'lucide-react';

interface HarvestDetailsModalProps {
  harvest: Harvest;
  cycle?: ProductionCycle;
  cycles: ProductionCycle[];
  onClose: () => void;
  onUpdated: (updatedHarvest: Harvest) => void;
}

export const HarvestDetailsModal: React.FC<HarvestDetailsModalProps> = ({
  harvest,
  cycle,
  cycles,
  onClose,
  onUpdated
}) => {
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [currentHarvest, setCurrentHarvest] = useState<Harvest>(harvest);

  // Edit form state
  const [editCycleId, setEditCycleId] = useState<string>(harvest.cycleId);
  const [editCrop, setEditCrop] = useState<string>(harvest.crop);
  const [editQuantity, setEditQuantity] = useState<string>(String(harvest.quantity));
  const [editUnit, setEditUnit] = useState<string>(harvest.unit);
  const [editGrade, setEditGrade] = useState<string>(harvest.gradeQuality || '');
  const [editDate, setEditDate] = useState<string>(harvest.date);
  const [editNotes, setEditNotes] = useState<string>(harvest.notes || '');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const activeCycle = cycles.find((c) => c.id === currentHarvest.cycleId) || cycle;
  const isClosed = activeCycle ? ['COMPLETED', 'CANCELLED', 'ARCHIVED'].includes(activeCycle.status) : false;

  const handleStartEdit = () => {
    if (isClosed) {
      setError('Cannot edit harvest belonging to a closed production cycle.');
      return;
    }
    setEditCycleId(currentHarvest.cycleId);
    setEditCrop(currentHarvest.crop);
    setEditQuantity(String(currentHarvest.quantity));
    setEditUnit(currentHarvest.unit);
    setEditGrade(currentHarvest.gradeQuality || '');
    setEditDate(currentHarvest.date);
    setEditNotes(currentHarvest.notes || '');
    setError(null);
    setIsSubmitting(false);
    setIsEditing(true);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const qty = parseFloat(editQuantity);
    if (isNaN(qty) || qty <= 0) {
      setError('Please enter a valid positive quantity.');
      return;
    }
    if (!editDate) {
      setError('Harvest date is required.');
      return;
    }
    if (!editCycleId) {
      setError('Production cycle is required.');
      return;
    }

    const targetCycle = cycles.find((c) => c.id === editCycleId);
    if (targetCycle) {
      if (editDate < targetCycle.startDate) {
        setError(`Harvest date (${editDate}) cannot be earlier than cycle start date (${targetCycle.startDate}).`);
        return;
      }
      if (targetCycle.status === 'COMPLETED' && targetCycle.completionDate) {
        if (editDate > targetCycle.completionDate) {
          setError(`Harvest date (${editDate}) cannot be after cycle completion date (${targetCycle.completionDate}).`);
          return;
        }
      }
    }

    setIsSubmitting(true);
    try {
      const updated = StorageService.updateHarvest(currentHarvest.id, {
        cycleId: editCycleId,
        crop: (targetCycle ? targetCycle.crop : editCrop) as any,
        date: editDate,
        quantity: qty,
        unit: editUnit,
        gradeQuality: editGrade.trim() || undefined,
        notes: editNotes.trim() || undefined
      });

      setCurrentHarvest(updated);
      setIsEditing(false);
      setError(null);
      onUpdated(updated);
    } catch (err: any) {
      setError(err?.message || 'Failed to update harvest.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className={`${isClosed ? 'bg-slate-800' : 'bg-amber-900'} text-white p-5 flex items-center justify-between`}>
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">{currentHarvest.crop === 'Rice' ? '🌾' : '🥥'}</span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-base">
                  {isEditing ? 'Edit Harvest Record' : 'Harvest Details'}
                </h2>
                {isClosed && activeCycle && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-700 text-slate-200 border border-slate-600">
                    {activeCycle.status}
                  </span>
                )}
              </div>
              <p className={`text-xs ${isClosed ? 'text-slate-300' : 'text-amber-200'}`}>
                {currentHarvest.crop} · {DateUtils.formatDisplayDate(currentHarvest.date)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {!isEditing && !isClosed && (
              <button
                onClick={handleStartEdit}
                className="px-2.5 py-1 rounded-lg bg-amber-800 hover:bg-amber-700 text-white text-xs font-semibold flex items-center gap-1 transition"
                title="Edit harvest"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Edit</span>
              </button>
            )}
            <button
              onClick={onClose}
              className={`p-1 rounded-full ${isClosed ? 'text-slate-300' : 'text-amber-200'} hover:text-white transition`}
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        {isEditing ? (
          <form onSubmit={handleSaveEdit} className="p-5 overflow-y-auto space-y-3.5 text-xs sm:text-sm flex-1">
            {error && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Production Cycle *</label>
              <select
                value={editCycleId}
                onChange={(e) => {
                  setEditCycleId(e.target.value);
                  const sel = cycles.find((c) => c.id === e.target.value);
                  if (sel) setEditCrop(sel.crop);
                }}
                required
                className="w-full px-3 py-2 border rounded-xl bg-white text-xs"
              >
                {cycles
                  .filter((c) => c.crop.toLowerCase() === harvest.crop.toLowerCase() && !['COMPLETED', 'CANCELLED', 'ARCHIVED'].includes(c.status))
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.cycleName} ({c.crop} • {c.farmField})
                    </option>
                  ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Quantity *</label>
                <input
                  type="number"
                  step="any"
                  min="0.01"
                  required
                  value={editQuantity}
                  onChange={(e) => setEditQuantity(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl font-bold text-xs"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Unit *</label>
                <select
                  value={editUnit}
                  onChange={(e) => setEditUnit(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl bg-white text-xs"
                >
                  <option value="kg">kg</option>
                  <option value="sacks">sacks (50kg)</option>
                  <option value="tons">metric tons</option>
                </select>
              </div>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Harvest Date *</label>
              <input
                type="date"
                required
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                className="w-full px-3 py-2 border rounded-xl text-xs"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Grade / Quality</label>
              <input
                type="text"
                value={editGrade}
                onChange={(e) => setEditGrade(e.target.value)}
                placeholder="e.g. Standard Palay Grade 1"
                className="w-full px-3 py-2 border rounded-xl text-xs"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Notes</label>
              <textarea
                rows={2}
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Field notes or harvest conditions"
                className="w-full px-3 py-2 border rounded-xl text-xs"
              />
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 text-slate-600 rounded-xl hover:bg-slate-100 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 bg-amber-900 hover:bg-amber-950 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl font-bold text-xs shadow-2xs transition"
              >
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        ) : (
          <div className="p-5 overflow-y-auto space-y-4 text-xs sm:text-sm">
            {/* Main Yield Card */}
            <div className={`${isClosed ? 'bg-slate-50 border-slate-200' : 'bg-amber-50/70 border-amber-200'} border rounded-xl p-4 text-center`}>
              <span className={`text-xs ${isClosed ? 'text-slate-500' : 'text-amber-900/80'} font-medium block mb-0.5`}>Quantity Harvested</span>
              <div className={`text-2xl font-black ${isClosed ? 'text-slate-900' : 'text-amber-950'}`}>
                {currentHarvest.quantity.toLocaleString()} <span className="text-base font-semibold">{currentHarvest.unit}</span>
              </div>
              {currentHarvest.gradeQuality && (
                <div className={`mt-2 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full ${
                  isClosed
                    ? 'bg-slate-100 text-slate-700 border-slate-300'
                    : 'bg-amber-100 text-amber-900 border-amber-300'
                } font-semibold text-xs border`}>
                  <Award className={`w-3.5 h-3.5 ${isClosed ? 'text-slate-600' : 'text-amber-700'}`} />
                  <span>{currentHarvest.gradeQuality}</span>
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
                <span className="font-bold text-slate-900">{currentHarvest.crop}</span>
              </div>

              <div className="flex items-start justify-between py-2 border-b border-slate-100">
                <div className="flex items-center gap-2 text-slate-600">
                  <Calendar className="w-4 h-4 text-slate-500" />
                  <span className="font-medium">Harvest Date</span>
                </div>
                <div className="text-right">
                  <span className="font-bold text-slate-900 block">{DateUtils.formatDisplayDate(currentHarvest.date)}</span>
                  <span className="text-[11px] text-slate-400">{currentHarvest.date}</span>
                </div>
              </div>

              <div className="flex items-start justify-between py-2 border-b border-slate-100">
                <div className="flex items-center gap-2 text-slate-600">
                  <Scale className="w-4 h-4 text-slate-500" />
                  <span className="font-medium">Yield Weight / Volume</span>
                </div>
                <span className="font-bold text-slate-900">
                  {currentHarvest.quantity.toLocaleString()} {currentHarvest.unit}
                </span>
              </div>

              <div className="flex items-start justify-between py-2 border-b border-slate-100">
                <div className="flex items-center gap-2 text-slate-600">
                  <Award className="w-4 h-4 text-slate-500" />
                  <span className="font-medium">Quality / Grade</span>
                </div>
                <span className="font-semibold text-slate-900">
                  {currentHarvest.gradeQuality ? currentHarvest.gradeQuality : <span className="text-slate-400 italic">Not specified</span>}
                </span>
              </div>

              <div className="flex items-start justify-between py-2 border-b border-slate-100">
                <div className="flex items-center gap-2 text-slate-600">
                  <Layers className="w-4 h-4 text-emerald-700" />
                  <span className="font-medium">Production Cycle</span>
                </div>
                <div className="text-right max-w-[200px]">
                  <span className="font-bold text-slate-900 block truncate">
                    {activeCycle ? activeCycle.cycleName : 'Unlinked Cycle'}
                  </span>
                  {activeCycle && (
                    <span className="text-[11px] text-slate-500 block truncate">
                      Field: {activeCycle.farmField} ({activeCycle.area} {activeCycle.areaUnit})
                    </span>
                  )}
                </div>
              </div>

              {currentHarvest.notes && (
                <div className="py-2 border-b border-slate-100">
                  <div className="flex items-center gap-2 text-slate-600 mb-1">
                    <FileText className="w-4 h-4 text-slate-500" />
                    <span className="font-medium">Notes</span>
                  </div>
                  <p className="text-xs text-slate-700 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                    {currentHarvest.notes}
                  </p>
                </div>
              )}
            </div>

            <div className="pt-2 flex items-center gap-2">
              {!isClosed ? (
                <button
                  onClick={handleStartEdit}
                  className="flex-1 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-950 font-bold text-xs rounded-xl border border-amber-200 flex items-center justify-center gap-1.5 transition"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Edit Harvest</span>
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
        )}
      </div>
    </div>
  );
};
