import React, { useState } from 'react';
import { ProductionCycle, Harvest, Expense, Sale } from '../types';
import { StorageService } from '../services/storage';
import { MoneyUtils } from '../utils/money';
import { DateUtils } from '../utils/date';
import { HarvestDetailsModal } from './HarvestDetailsModal';
import { CycleDetailsModal } from './CycleDetailsModal';
import {
  Sprout,
  PlusCircle,
  Calendar,
  Layers,
  History,
  AlertCircle,
  ChevronRight,
  Award
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
  // Sub-section toggle: 'cycles' vs 'harvests'
  const [activeSection, setActiveSection] = useState<'cycles' | 'harvests'>('cycles');

  // Modal view states
  const [isAddingCycle, setIsAddingCycle] = useState<boolean>(false);
  const [editingCycle, setEditingCycle] = useState<ProductionCycle | null>(null);
  const [selectedCycleForDetails, setSelectedCycleForDetails] = useState<ProductionCycle | null>(null);

  const [isAddingHarvest, setIsAddingHarvest] = useState<boolean>(false);
  const [selectedHarvestForDetails, setSelectedHarvestForDetails] = useState<Harvest | null>(null);

  // Archive Confirmation state
  const [cycleToArchive, setCycleToArchive] = useState<ProductionCycle | null>(null);

  // Form submission lock (prevents duplicate submission)
  const [isSubmittingCycle, setIsSubmittingCycle] = useState<boolean>(false);
  const [isSubmittingHarvest, setIsSubmittingHarvest] = useState<boolean>(false);

  // Cycle form state (reused for Create and Edit)
  const [crop, setCrop] = useState<string>('Rice');
  const [cycleName, setCycleName] = useState<string>('');
  const [startDate, setStartDate] = useState<string>(DateUtils.getTodayString());
  const [completionDate, setCompletionDate] = useState<string>('');
  const [farmField, setFarmField] = useState<string>('');
  const [area, setArea] = useState<string>('1.0');
  const [areaUnit, setAreaUnit] = useState<string>('hectares');
  const [status, setStatus] = useState<ProductionCycle['status']>('ACTIVE');
  const [notes, setNotes] = useState<string>('');
  const [cycleError, setCycleError] = useState<string | null>(null);

  // New Harvest form state
  const [harvestCycleId, setHarvestCycleId] = useState<string>(cycles[0]?.id || '');
  const [harvestCrop, setHarvestCrop] = useState<string>(cycles[0]?.crop || 'Rice');
  const [harvestQuantity, setHarvestQuantity] = useState<string>('');
  const [harvestUnit, setHarvestUnit] = useState<string>('kg');
  const [harvestGrade, setHarvestGrade] = useState<string>('');
  const [harvestDate, setHarvestDate] = useState<string>(DateUtils.getTodayString());
  const [harvestError, setHarvestError] = useState<string | null>(null);

  const eligibleCycles = cycles.filter((c) => !['COMPLETED', 'CANCELLED', 'ARCHIVED'].includes(c.status));

  const resetCycleForm = () => {
    setIsAddingCycle(false);
    setEditingCycle(null);
    setCrop('Rice');
    setCycleName('');
    setStartDate(DateUtils.getTodayString());
    setCompletionDate('');
    setFarmField('');
    setArea('1.0');
    setAreaUnit('hectares');
    setStatus('ACTIVE');
    setNotes('');
    setCycleError(null);
    setIsSubmittingCycle(false);
  };

  const handleStartAddCycle = () => {
    resetCycleForm();
    setIsAddingCycle(true);
  };

  const handleStartEditCycle = (c: ProductionCycle) => {
    if (['COMPLETED', 'CANCELLED', 'ARCHIVED'].includes(c.status)) {
      setCycleError(`Cannot edit production cycle "${c.cycleName}" because it is ${c.status}. Closed records are read-only.`);
      return;
    }
    setEditingCycle(c);
    setCrop(c.crop);
    setCycleName(c.cycleName);
    setStartDate(c.startDate);
    setCompletionDate(c.completionDate || '');
    setFarmField(c.farmField);
    setArea(String(c.area));
    setAreaUnit(c.areaUnit);
    setStatus(c.status);
    setNotes(c.notes || '');
    setCycleError(null);
    setIsSubmittingCycle(false);
    setIsAddingCycle(true);
  };

  const handleOpenAddHarvest = () => {
    // If eligible cycles exist, select first eligible cycle
    const eligible = cycles.filter((c) => !['COMPLETED', 'CANCELLED', 'ARCHIVED'].includes(c.status));
    if (eligible.length > 0) {
      const defaultCycle = eligible.find((c) => c.id === harvestCycleId) || eligible[0];
      setHarvestCycleId(defaultCycle.id);
      setHarvestCrop(defaultCycle.crop);
    } else {
      setHarvestCycleId('');
    }
    setHarvestError(null);
    setIsSubmittingHarvest(false);
    setIsAddingHarvest(true);
  };

  const handleSaveCycle = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingCycle) return;

    if (!cycleName.trim()) {
      setCycleError('Cycle Name is required.');
      return;
    }

    const parsedArea = parseFloat(area);
    if (isNaN(parsedArea) || parsedArea <= 0) {
      setCycleError('Area must be greater than zero.');
      return;
    }

    if (status === 'COMPLETED') {
      if (!completionDate.trim()) {
        setCycleError('Completion Date is required when status is COMPLETED.');
        return;
      }
      if (completionDate.trim() < startDate.trim()) {
        setCycleError(`Completion Date (${completionDate}) must not be earlier than Start Date (${startDate}).`);
        return;
      }
    }

    setIsSubmittingCycle(true);
    try {
      if (editingCycle) {
        const updated = StorageService.updateCycle(editingCycle.id, {
          crop: crop as any,
          cycleName: cycleName.trim(),
          startDate,
          completionDate: status === 'COMPLETED' ? completionDate.trim() : undefined,
          farmField: farmField.trim() || 'Main Field',
          area: parsedArea,
          areaUnit,
          status,
          notes: notes.trim() || undefined
        });

        // Update selected cycle if detail modal is open
        if (selectedCycleForDetails?.id === editingCycle.id) {
          setSelectedCycleForDetails(updated);
        }
      } else {
        StorageService.createCycle({
          crop: crop as any,
          cycleName: cycleName.trim(),
          startDate,
          completionDate: status === 'COMPLETED' ? completionDate.trim() : undefined,
          farmField: farmField.trim() || 'Main Field',
          area: parsedArea,
          areaUnit,
          status,
          notes: notes.trim() || undefined
        });
      }

      resetCycleForm();
      onReload();
    } catch (err: any) {
      setCycleError(err?.message || 'Failed to save production cycle.');
    } finally {
      setIsSubmittingCycle(false);
    }
  };

  const handleCreateHarvest = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingHarvest) return;
    if (eligibleCycles.length === 0 || !harvestCycleId) return;

    const qty = parseFloat(harvestQuantity) || 0;
    if (qty <= 0) {
      setHarvestError('Quantity must be greater than zero.');
      return;
    }

    const targetCycle = cycles.find((c) => c.id === harvestCycleId);
    if (!targetCycle) {
      setHarvestError('Selected production cycle not found.');
      return;
    }

    if (['COMPLETED', 'CANCELLED', 'ARCHIVED'].includes(targetCycle.status)) {
      setHarvestError(`Cannot log harvest for cycle "${targetCycle.cycleName}" because its status is ${targetCycle.status}.`);
      return;
    }

    if (harvestDate < targetCycle.startDate) {
      setHarvestError(`Harvest date (${harvestDate}) cannot be earlier than cycle start date (${targetCycle.startDate}).`);
      return;
    }

    setIsSubmittingHarvest(true);
    try {
      StorageService.createHarvest({
        cycleId: harvestCycleId,
        crop: targetCycle.crop, // Authoritatively locked to cycle crop
        date: harvestDate,
        quantity: qty,
        unit: harvestUnit,
        gradeQuality: harvestGrade.trim() || undefined
      });

      setIsAddingHarvest(false);
      setHarvestQuantity('');
      setHarvestGrade('');
      setHarvestError(null);
      onReload();
    } catch (err: any) {
      setHarvestError(err?.message || 'Failed to record crop harvest.');
    } finally {
      setIsSubmittingHarvest(false);
    }
  };

  // Helper mapping cycle ID to ProductionCycle object
  const cycleMap = new Map<string, ProductionCycle>();
  cycles.forEach((c) => cycleMap.set(c.id, c));

  const liveCycles = cycles.filter((c) => !['COMPLETED', 'CANCELLED', 'ARCHIVED'].includes(c.status));
  const closedCycles = cycles.filter((c) => ['COMPLETED', 'CANCELLED', 'ARCHIVED'].includes(c.status));

  const liveHarvests = harvests.filter((h) => {
    const cycle = cycleMap.get(h.cycleId);
    return !cycle || !['COMPLETED', 'CANCELLED', 'ARCHIVED'].includes(cycle.status);
  });
  const closedHarvests = harvests.filter((h) => {
    const cycle = cycleMap.get(h.cycleId);
    return cycle && ['COMPLETED', 'CANCELLED', 'ARCHIVED'].includes(cycle.status);
  });

  const renderCycleCard = (c: ProductionCycle) => {
    const cycleExpenses = expenses.filter((e) => !e.isVoided && e.cycleId === c.id);
    const totalCycleCostCentavos = cycleExpenses.reduce((acc, e) => acc + e.amountIncurredCentavos, 0);

    const cycleHarvests = harvests.filter((h) => h.cycleId === c.id);
    const totalHarvestQty = cycleHarvests.reduce((acc, h) => acc + h.quantity, 0);

    const cycleSales = sales.filter((s) => !s.isVoided && s.cycleId === c.id);
    const cycleRevenueCentavos = cycleSales.reduce((acc, s) => acc + s.grossAmountCentavos, 0);

    const isClosed = ['COMPLETED', 'CANCELLED', 'ARCHIVED'].includes(c.status);

    return (
      <div
        key={c.id}
        onClick={() => setSelectedCycleForDetails(c)}
        className={`bg-white rounded-2xl p-4 border transition space-y-3 cursor-pointer ${
          c.status === 'ARCHIVED'
            ? 'border-slate-200 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-300'
            : isClosed
            ? 'border-slate-200 hover:border-slate-300'
            : 'border-slate-200 hover:border-emerald-400 hover:shadow-xs'
        }`}
      >
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base">{c.crop === 'Rice' ? '🌾' : '🥥'}</span>
              <h3 className="font-bold text-sm text-slate-900">{c.cycleName}</h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Field: <strong>{c.farmField}</strong> • {c.area} {c.areaUnit}
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
              c.status === 'ARCHIVED'
                ? 'bg-slate-200 text-slate-700'
                : isClosed
                ? 'bg-slate-100 text-slate-600'
                : 'bg-emerald-100 text-emerald-800'
            }`}>
              {c.status}
            </span>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </div>
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
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedHarvestForDetails(h);
                  }}
                  className={`flex items-center justify-between text-xs cursor-pointer px-2.5 py-1.5 rounded-lg border transition ${
                    isClosed
                      ? 'bg-slate-100/70 hover:bg-slate-100 border-slate-200 text-slate-800'
                      : 'bg-emerald-50/50 hover:bg-emerald-100/60 border-emerald-100'
                  }`}
                >
                  <span className={`font-medium ${isClosed ? 'text-slate-800' : 'text-emerald-950'}`}>
                    {h.quantity.toLocaleString()} {h.unit} • {h.gradeQuality || 'Standard'}
                  </span>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-slate-500">{DateUtils.formatDisplayDate(h.date)}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderHarvestCard = (h: Harvest) => {
    const cycle = cycleMap.get(h.cycleId);
    const isClosed = cycle && ['COMPLETED', 'CANCELLED', 'ARCHIVED'].includes(cycle.status);
    return (
      <div
        key={h.id}
        onClick={() => setSelectedHarvestForDetails(h)}
        className={`rounded-2xl p-4 border cursor-pointer transition space-y-2 ${
          isClosed
            ? 'bg-slate-50/50 border-slate-200 hover:border-slate-300'
            : 'bg-white border-slate-200 hover:border-amber-400 hover:shadow-xs'
        }`}
      >
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base">{h.crop === 'Rice' ? '🌾' : '🥥'}</span>
              <h3 className="font-bold text-sm text-slate-900">{h.crop} Harvest</h3>
              {h.gradeQuality && (
                <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-900 border border-amber-200 text-[10px] font-semibold flex items-center gap-1">
                  <Award className="w-3 h-3 text-amber-700" />
                  {h.gradeQuality}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Cycle: <strong className="text-slate-700">{cycle ? cycle.cycleName : 'Unlinked Cycle'}</strong>
              {cycle && ` (${cycle.farmField})`}
            </p>
          </div>

          <div className="text-right flex items-center gap-1.5">
            <div>
              <span className="font-extrabold text-sm text-amber-950 block">
                {h.quantity.toLocaleString()} {h.unit}
              </span>
              <span className="text-[11px] text-slate-400 block">
                {DateUtils.formatDisplayDate(h.date)}
              </span>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden space-y-4 animate-in fade-in duration-150">
      
      {/* Top Banner: Production KPIs */}
      <div className="bg-linear-to-r from-stone-900 to-emerald-950 text-white p-5 rounded-2xl shadow-md shrink-0">
        <div className="flex items-center justify-between mb-1">
          <div className="text-xs uppercase tracking-wider text-emerald-200 font-semibold">
            Farm Production Overview
          </div>
          <div className="text-xs bg-emerald-900/80 text-emerald-100 px-2 py-0.5 rounded-md font-semibold">
            {liveCycles.length} Active Cycles
          </div>
        </div>
        <div className="text-3xl font-extrabold tracking-tight">
          {harvests.reduce((acc, h) => acc + h.quantity, 0).toLocaleString()} kg <span className="text-sm font-normal text-emerald-200">Total Harvested</span>
        </div>
        <div className="grid grid-cols-3 gap-3 mt-4 pt-3 border-t border-emerald-800/60 text-xs">
          <div>
            <span className="text-emerald-200 block text-[11px]">Total Cycles</span>
            <span className="text-base font-bold text-white">
              {cycles.length}
            </span>
          </div>
          <div>
            <span className="text-emerald-200 block text-[11px]">Active</span>
            <span className="text-base font-bold text-emerald-400">
              {liveCycles.length}
            </span>
          </div>
          <div>
            <span className="text-emerald-200 block text-[11px]">Completed / Closed</span>
            <span className="text-base font-bold text-amber-300">
              {closedCycles.length}
            </span>
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-base font-bold text-slate-900">Crop Production & Harvests</h2>
          <p className="text-xs text-slate-500">Plan seasons, monitor fields & track recorded yields</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleOpenAddHarvest}
            className="px-3 py-1.5 bg-amber-900 hover:bg-amber-950 text-white rounded-xl text-xs font-bold shadow-2xs flex items-center gap-1 transition"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            Log Harvest
          </button>
          <button
            onClick={handleStartAddCycle}
            className="px-3 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-bold shadow-2xs flex items-center gap-1 transition"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            New Cycle
          </button>
        </div>
      </div>

      {/* Sub-section Navigation Tabs */}
      <div className="flex border-b border-slate-200 shrink-0">
        <button
          onClick={() => setActiveSection('cycles')}
          className={`py-2 px-3 text-xs font-bold flex items-center gap-1.5 border-b-2 transition ${
            activeSection === 'cycles'
              ? 'border-emerald-800 text-emerald-900'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Production Cycles ({cycles.length})</span>
        </button>
        <button
          onClick={() => setActiveSection('harvests')}
          className={`py-2 px-3 text-xs font-bold flex items-center gap-1.5 border-b-2 transition ${
            activeSection === 'harvests'
              ? 'border-amber-800 text-amber-950'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>Harvest History ({harvests.length})</span>
        </button>
      </div>

      {/* SECTION 1: PRODUCTION CYCLES */}
      {activeSection === 'cycles' && (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {cycles.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 border border-slate-200 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-700 mx-auto flex items-center justify-center">
                <Sprout className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">No Production Cycles Yet</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                  Create a production cycle to organize your planting seasons, track field costs, and link harvest batches.
                </p>
              </div>
              <button
                onClick={handleStartAddCycle}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-800 text-white rounded-xl text-xs font-bold hover:bg-emerald-900 shadow-2xs transition"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                Create First Cycle
              </button>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto min-h-0 space-y-4 pr-1 pb-16">
              {/* Active / Live section */}
              {liveCycles.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Active & Operational Seasons</h4>
                  <div className="space-y-3">
                    {liveCycles.map(renderCycleCard)}
                  </div>
                </div>
              )}

              {/* Closed / Archived section */}
              {closedCycles.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Closed & Archived Records</h4>
                  <div className="space-y-3">
                    {closedCycles.map(renderCycleCard)}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* SECTION 2: HARVEST HISTORY (INDEPENDENT LIST) */}
      {activeSection === 'harvests' && (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {harvests.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 border border-slate-200 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-800 mx-auto flex items-center justify-center">
                <History className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">No Harvest Records Found</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                  No crop harvests have been logged yet. Use the Log Harvest button to record harvested batches.
                </p>
              </div>
              <button
                onClick={handleOpenAddHarvest}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-900 text-white rounded-xl text-xs font-bold hover:bg-amber-950 shadow-2xs transition"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                Log First Harvest
              </button>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto min-h-0 space-y-4 pr-1 pb-16">
              {/* Live/editable harvests */}
              {liveHarvests.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider">Active Yield Batches</h4>
                  <div className="space-y-3">
                    {liveHarvests.map(renderHarvestCard)}
                  </div>
                </div>
              )}

              {/* Closed/read-only harvests */}
              {closedHarvests.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Historical / Closed Yields</h4>
                  <div className="space-y-3">
                    {closedHarvests.map(renderHarvestCard)}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Cycle Details Modal (View screen with Edit action inside) */}
      {selectedCycleForDetails && (
        <CycleDetailsModal
          cycle={selectedCycleForDetails}
          harvests={harvests}
          expenses={expenses}
          sales={sales}
          onClose={() => setSelectedCycleForDetails(null)}
          onEdit={() => {
            const c = selectedCycleForDetails;
            handleStartEditCycle(c);
          }}
          onSelectHarvest={(h) => {
            setSelectedHarvestForDetails(h);
          }}
          onArchive={() => {
            setCycleToArchive(selectedCycleForDetails);
          }}
        />
      )}

      {/* Confirmation Dialog: "Archive this production cycle?" */}
      {cycleToArchive && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-full bg-amber-100 text-amber-800 shrink-0">
                <AlertCircle className="w-6 h-6 text-amber-700" />
              </div>
              <h3 className="font-extrabold text-slate-900 text-base">
                Archive this production cycle?
              </h3>
            </div>

            <p className="text-xs leading-relaxed text-slate-600">
              Archived cycles are read-only and will be moved to Closed & Archived Records.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setCycleToArchive(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  try {
                    StorageService.archiveCycle(cycleToArchive.id);
                    setCycleToArchive(null);
                    setSelectedCycleForDetails(null);
                    onReload();
                  } catch (err: any) {
                    alert(err?.message || 'Failed to archive cycle.');
                  }
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-amber-700 hover:bg-amber-800 transition"
              >
                Archive Cycle
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Harvest Details Modal with Edit Support */}
      {selectedHarvestForDetails && (
        <HarvestDetailsModal
          harvest={selectedHarvestForDetails}
          cycle={cycleMap.get(selectedHarvestForDetails.cycleId)}
          cycles={cycles}
          onClose={() => setSelectedHarvestForDetails(null)}
          onUpdated={(updated) => {
            setSelectedHarvestForDetails(updated);
            onReload();
          }}
        />
      )}

      {/* Create / Edit Cycle Modal */}
      {isAddingCycle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-5 max-h-[90vh] overflow-y-auto flex flex-col">
            <div className="flex justify-between items-center pb-3 border-b border-slate-200">
              <h3 className="font-bold text-slate-900 text-base">
                {editingCycle ? 'Edit Production Cycle' : 'New Production Cycle'}
              </h3>
              <button onClick={resetCycleForm} className="p-1 text-slate-400 hover:text-slate-600 transition">✕</button>
            </div>

            {cycleError && (
              <div className="mt-3 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{cycleError}</span>
              </div>
            )}

            <form onSubmit={handleSaveCycle} className="py-4 space-y-3 text-xs flex-1">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Crop</label>
                <select
                  value={crop}
                  onChange={(e) => setCrop(e.target.value)}
                  disabled={editingCycle ? harvests.some((h) => h.cycleId === editingCycle.id) : false}
                  className={`w-full px-3 py-2 border rounded-xl bg-white ${
                    editingCycle && harvests.some((h) => h.cycleId === editingCycle.id)
                      ? 'bg-slate-100 text-slate-500 cursor-not-allowed'
                      : ''
                  }`}
                >
                  <option value="Rice">🌾 Rice (Palay)</option>
                  <option value="Copra">🥥 Copra</option>
                </select>
                {editingCycle && harvests.some((h) => h.cycleId === editingCycle.id) && (
                  <p className="text-[11px] text-amber-700 mt-1">
                    Crop cannot be modified because harvest batches are already recorded for this cycle.
                  </p>
                )}
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
                  <label className="font-semibold text-slate-700 block mb-1">Field / Parcel Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. East Paddy"
                    value={farmField}
                    onChange={(e) => setFarmField(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Area (Hectares) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Planting / Start Date *</label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full px-3 py-2 border rounded-xl bg-white"
                  >
                    <option value="PLANNED">PLANNED</option>
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="HARVESTED">HARVESTED</option>
                    <option value="COMPLETED">COMPLETED</option>
                    <option value="CANCELLED">CANCELLED</option>
                    <option value="ARCHIVED">ARCHIVED</option>
                  </select>
                </div>
              </div>

              {/* Completion Date (Required when status is COMPLETED) */}
              {status === 'COMPLETED' && (
                <div className="bg-amber-50/60 p-3 rounded-xl border border-amber-200">
                  <label className="font-semibold text-amber-950 block mb-1">
                    Completion Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={completionDate}
                    onChange={(e) => setCompletionDate(e.target.value)}
                    className="w-full px-3 py-2 border border-amber-300 rounded-xl bg-white"
                  />
                  <p className="text-[11px] text-amber-800 mt-1">
                    Required when cycle status is COMPLETED. Must not be earlier than Start Date ({startDate}).
                  </p>
                </div>
              )}

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Notes</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Cycle plans or observations"
                  className="w-full px-3 py-2 border rounded-xl"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={resetCycleForm}
                  className="px-4 py-2 text-slate-600 rounded-xl hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCycle}
                  className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl font-bold transition shadow-2xs"
                >
                  {isSubmittingCycle ? 'Saving...' : editingCycle ? 'Update Cycle' : 'Create Cycle'}
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

            {harvestError && (
              <div className="mt-3 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{harvestError}</span>
              </div>
            )}

            {eligibleCycles.length === 0 ? (
              <div className="py-6 text-center space-y-4 text-xs">
                <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-800 mx-auto flex items-center justify-center">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-slate-900">No Eligible Production Cycles Found</h4>
                  <p className="text-slate-500 mt-1 max-w-xs mx-auto">
                    {cycles.length === 0
                      ? 'You must create a production cycle first before logging a harvest.'
                      : 'All existing production cycles are completed, cancelled, or archived. Create a new active cycle to log new harvests.'}
                  </p>
                </div>
                <div className="pt-2 flex justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddingHarvest(false)}
                    className="px-4 py-2 text-slate-600 rounded-xl hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingHarvest(false);
                      handleStartAddCycle();
                    }}
                    className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl font-bold shadow-2xs"
                  >
                    Create Production Cycle First
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreateHarvest} className="py-4 space-y-3 text-xs flex-1">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Production Cycle *</label>
                  <select
                    value={harvestCycleId}
                    onChange={(e) => {
                      setHarvestCycleId(e.target.value);
                      const selected = cycles.find((c) => c.id === e.target.value);
                      if (selected) setHarvestCrop(selected.crop);
                    }}
                    required
                    className="w-full px-3 py-2 border rounded-xl bg-white"
                  >
                    {eligibleCycles.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.cycleName} ({c.crop} • {c.farmField})
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
                      min="0.01"
                      required
                      placeholder="e.g. 1500"
                      value={harvestQuantity}
                      onChange={(e) => setHarvestQuantity(e.target.value)}
                      className="w-full px-3 py-2 border rounded-xl font-bold"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Unit *</label>
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
                  <label className="font-semibold text-slate-700 block mb-1">Grade / Quality (Optional)</label>
                  <input
                    type="text"
                    value={harvestGrade}
                    onChange={(e) => setHarvestGrade(e.target.value)}
                    placeholder="e.g. Standard Palay Grade 1, Tapahan kiln dry"
                    className="w-full px-3 py-2 border rounded-xl"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Harvest Date *</label>
                  <input
                    type="date"
                    required
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
                    disabled={isSubmittingHarvest}
                    className="px-4 py-2 bg-amber-900 hover:bg-amber-950 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl font-bold shadow-2xs transition"
                  >
                    {isSubmittingHarvest ? 'Saving...' : 'Save Harvest'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

    </div>
  );
};
