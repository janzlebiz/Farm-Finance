import React, { useState } from 'react';
import { ProductionCycle, Harvest, Expense, Sale } from '../types';
import { StorageService } from '../services/storage';
import { MoneyUtils } from '../utils/money';
import { DateUtils } from '../utils/date';
import {
  Sprout,
  PlusCircle,
  Calendar,
  Layers,
  CheckCircle,
  Clock,
  ArrowRight,
  TrendingUp,
  X
} from 'lucide-react';

interface ProductionTabProps {
  cycles: ProductionCycle[];
  harvests: Harvest[];
  expenses: Expense[];
  sales: Sale[];
  onReload: () => void;
}

export const ProductionTab: React.FC<ProductionTabProps> = ({
  cycles,
  harvests,
  expenses,
  sales,
  onReload
}) => {
  const [isAddingCycle, setIsAddingCycle] = useState<boolean>(false);
  const [isAddingHarvest, setIsAddingHarvest] = useState<boolean>(false);
  const [selectedCycleId, setSelectedCycleId] = useState<string>('');

  // New Cycle form state
  const [crop, setCrop] = useState<string>('Rice');
  const [cycleName, setCycleName] = useState<string>('');
  const [startDate, setStartDate] = useState<string>(DateUtils.getTodayString());
  const [farmField, setFarmField] = useState<string>('');
  const [area, setArea] = useState<string>('1.0');
  const [areaUnit, setAreaUnit] = useState<string>('hectares');
  const [status, setStatus] = useState<ProductionCycle['status']>('ACTIVE');
  const [notes, setNotes] = useState<string>('');

  // New Harvest form state
  const [harvestCycleId, setHarvestCycleId] = useState<string>(cycles[0]?.id || '');
  const [harvestCrop, setHarvestCrop] = useState<string>('Rice');
  const [harvestQuantity, setHarvestQuantity] = useState<string>('');
  const [harvestUnit, setHarvestUnit] = useState<string>('kg');
  const [harvestGrade, setHarvestGrade] = useState<string>('');
  const [harvestDate, setHarvestDate] = useState<string>(DateUtils.getTodayString());

  const handleCreateCycle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cycleName.trim()) return;

    StorageService.createCycle({
      crop,
      cycleName: cycleName.trim(),
      startDate,
      farmField: farmField.trim() || 'Main Field',
      area: parseFloat(area) || 1.0,
      areaUnit,
      status,
      notes: notes.trim() || undefined
    });

    setIsAddingCycle(false);
    setCycleName('');
    onReload();
  };

  const handleCreateHarvest = (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseFloat(harvestQuantity) || 0;
    if (qty <= 0) return;

    StorageService.createHarvest({
      cycleId: harvestCycleId,
      crop: harvestCrop,
      date: harvestDate,
      quantity: qty,
      unit: harvestUnit,
      gradeQuality: harvestGrade
    });

    setIsAddingHarvest(false);
    onReload();
  };

  return (
    <div className="space-y-4 pb-16 animate-in fade-in duration-150">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-900">Crop Production Cycles</h2>
          <p className="text-xs text-slate-500">Plan seasons, monitor fields & log harvests</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setIsAddingHarvest(true)}
            className="px-3 py-1.5 bg-amber-900 hover:bg-amber-950 text-white rounded-xl text-xs font-bold shadow-2xs flex items-center gap-1"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            Log Harvest
          </button>
          <button
            onClick={() => setIsAddingCycle(true)}
            className="px-3 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-bold shadow-2xs flex items-center gap-1"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            New Cycle
          </button>
        </div>
      </div>

      {/* Production Cycles List */}
      <div className="space-y-3">
        {cycles.map((c) => {
          // Direct expenses for this cycle
          const cycleExpenses = expenses.filter((e) => !e.isVoided && e.cycleId === c.id);
          const totalCycleCostCentavos = cycleExpenses.reduce((acc, e) => acc + e.amountIncurredCentavos, 0);

          // Harvests for this cycle
          const cycleHarvests = harvests.filter((h) => h.cycleId === c.id);
          const totalHarvestQty = cycleHarvests.reduce((acc, h) => acc + h.quantity, 0);

          // Sales linked to this cycle
          const cycleSales = sales.filter((s) => !s.isVoided && s.cycleId === c.id);
          const cycleRevenueCentavos = cycleSales.reduce((acc, s) => acc + s.grossAmountCentavos, 0);
          const cycleProfitCentavos = cycleRevenueCentavos - totalCycleCostCentavos;

          return (
            <div key={c.id} className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-base">{c.crop === 'Rice' ? '🌾' : '🥥'}</span>
                    <h3 className="font-bold text-sm text-slate-900">{c.cycleName}</h3>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Field: <strong>{c.farmField}</strong> • {c.area} {c.areaUnit}
                  </p>
                </div>

                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md text-[10px] font-bold uppercase">
                  {c.status}
                </span>
              </div>

              {/* Cycle Financial & Yield Metrics */}
              <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-xs">
                <div>
                  <span className="text-slate-500 block text-[11px]">Total Harvested</span>
                  <span className="font-bold text-slate-900">
                    {totalHarvestQty > 0 ? `${totalHarvestQty.toLocaleString()} kg` : 'None yet'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Direct Cycle Costs</span>
                  <span className="font-semibold text-amber-900">
                    {MoneyUtils.formatPesos(totalCycleCostCentavos)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-slate-500 block text-[11px]">Cycle Revenue</span>
                  <span className="font-bold text-emerald-800">
                    {MoneyUtils.formatPesos(cycleRevenueCentavos)}
                  </span>
                </div>
              </div>

              {/* Harvest Log summary */}
              {cycleHarvests.length > 0 && (
                <div className="pt-1">
                  <span className="text-[11px] font-semibold text-slate-600 uppercase block mb-1">
                    Recorded Harvest Batches:
                  </span>
                  <div className="space-y-1">
                    {cycleHarvests.map((h) => (
                      <div
                        key={h.id}
                        className="flex items-center justify-between text-xs bg-emerald-50/50 px-2.5 py-1.5 rounded-lg border border-emerald-100"
                      >
                        <span className="font-medium text-emerald-950">
                          {h.quantity.toLocaleString()} {h.unit} • {h.gradeQuality || 'Standard'}
                        </span>
                        <span className="text-[10px] text-slate-500">{DateUtils.formatDisplayDate(h.date)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* New Cycle Modal */}
      {isAddingCycle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-5 max-h-[90vh] overflow-y-auto flex flex-col">
            <div className="flex justify-between items-center pb-3 border-b border-slate-200">
              <h3 className="font-bold text-slate-900 text-base">New Production Cycle</h3>
              <button onClick={() => setIsAddingCycle(false)} className="p-1 text-slate-400">✕</button>
            </div>

            <form onSubmit={handleCreateCycle} className="py-4 space-y-3 text-xs flex-1">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Crop</label>
                <select
                  value={crop}
                  onChange={(e) => setCrop(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl bg-white"
                >
                  <option value="Rice">🌾 Rice (Palay)</option>
                  <option value="Copra">🥥 Copra</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Cycle Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rice — Dry Season 2027"
                  value={cycleName}
                  onChange={(e) => setCycleName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Field / Parcel Name</label>
                  <input
                    type="text"
                    placeholder="e.g. East Paddy"
                    value={farmField}
                    onChange={(e) => setFarmField(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Area (Hectares)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Planting / Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddingCycle(false)}
                  className="px-4 py-2 text-slate-600 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-800 text-white rounded-xl font-bold"
                >
                  Create Cycle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Log Harvest Modal */}
      {isAddingHarvest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-5 max-h-[90vh] overflow-y-auto flex flex-col">
            <div className="flex justify-between items-center pb-3 border-b border-slate-200">
              <h3 className="font-bold text-slate-900 text-base">Record Crop Harvest</h3>
              <button onClick={() => setIsAddingHarvest(false)} className="p-1 text-slate-400">✕</button>
            </div>

            <form onSubmit={handleCreateHarvest} className="py-4 space-y-3 text-xs flex-1">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Production Cycle</label>
                <select
                  value={harvestCycleId}
                  onChange={(e) => {
                    setHarvestCycleId(e.target.value);
                    const selected = cycles.find((c) => c.id === e.target.value);
                    if (selected) setHarvestCrop(selected.crop);
                  }}
                  className="w-full px-3 py-2 border rounded-xl bg-white"
                >
                  {cycles.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.cycleName} ({c.crop})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Quantity Harvested *</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={harvestQuantity}
                    onChange={(e) => setHarvestQuantity(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl font-bold"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Unit</label>
                  <select
                    value={harvestUnit}
                    onChange={(e) => setHarvestUnit(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl bg-white"
                  >
                    <option value="kg">kg</option>
                    <option value="sacks">sacks (50kg)</option>
                    <option value="tons">metric tons</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Grade / Quality</label>
                <input
                  type="text"
                  value={harvestGrade}
                  onChange={(e) => setHarvestGrade(e.target.value)}
                  placeholder="e.g. Standard Palay Grade 1, Tapahan kiln dry"
                  className="w-full px-3 py-2 border rounded-xl"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Harvest Date</label>
                <input
                  type="date"
                  value={harvestDate}
                  onChange={(e) => setHarvestDate(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddingHarvest(false)}
                  className="px-4 py-2 text-slate-600 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-900 text-white rounded-xl font-bold"
                >
                  Save Harvest
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
