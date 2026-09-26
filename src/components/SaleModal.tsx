import React, { useState, useEffect } from 'react';
import { Buyer, ProductionCycle } from '../types';
import { MoneyUtils } from '../utils/money';
import { StorageService } from '../services/storage';
import { X, CheckCircle, Plus, AlertCircle } from 'lucide-react';

interface SaleModalProps {
  buyers: Buyer[];
  cycles: ProductionCycle[];
  onClose: () => void;
  onSuccess: () => void;
  onBuyerAdded?: (buyer: Buyer) => void;
}

export const SaleModal: React.FC<SaleModalProps> = ({
  buyers,
  cycles,
  onClose,
  onSuccess,
  onBuyerAdded
}) => {
  const [availableBuyers, setAvailableBuyers] = useState<Buyer[]>(buyers);
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [crop, setCrop] = useState<string>('Rice');
  const [quantityStr, setQuantityStr] = useState<string>('');
  const [unit, setUnit] = useState<string>('kg');
  const [unitPriceStr, setUnitPriceStr] = useState<string>('');
  const [buyerId, setBuyerId] = useState<string>(buyers[0]?.id || '');
  const [cycleId, setCycleId] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAvailableBuyers(buyers);
    if (!buyerId && buyers.length > 0) {
      setBuyerId(buyers[0].id);
    }
  }, [buyers]);

  // New Buyer inline state (auto open if no buyers saved yet)
  const [isAddingBuyer, setIsAddingBuyer] = useState<boolean>(buyers.length === 0);
  const [newBuyerName, setNewBuyerName] = useState<string>('');
  const [newBuyerContact, setNewBuyerContact] = useState<string>('');

  const quantity = parseFloat(quantityStr) || 0;
  const unitPriceCentavos = MoneyUtils.pesosToCentavos(unitPriceStr);
  const grossCentavos = MoneyUtils.calculateGross(quantity, unitPriceCentavos);

  const handleCreateNewBuyer = () => {
    if (!newBuyerName.trim()) return;
    setError(null);
    try {
      const created = StorageService.createBuyer({
        name: newBuyerName.trim(),
        contactNumber: newBuyerContact.trim(),
        address: '',
        notes: '',
        status: 'ACTIVE'
      });
      setAvailableBuyers((prev) => [created, ...prev.filter((b) => b.id !== created.id)]);
      setBuyerId(created.id);
      setIsAddingBuyer(false);
      setNewBuyerName('');
      setNewBuyerContact('');
      if (onBuyerAdded) {
        onBuyerAdded(created);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to create buyer');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (quantity <= 0) {
      setError('Quantity must be greater than zero.');
      return;
    }
    if (unitPriceCentavos <= 0) {
      setError('Unit price must be greater than ₱0.00.');
      return;
    }
    if (!buyerId) {
      setError('Please select or add a buyer.');
      return;
    }

    const res = StorageService.createSale({
      date,
      crop,
      quantity,
      unit,
      unitPriceCentavos,
      buyerId,
      cycleId: cycleId || undefined,
      notes: notes.trim() || undefined
    });

    if (res.error) {
      setError(res.error);
    } else {
      onSuccess();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4">
      <div className="bg-white w-full max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in slide-in-from-bottom duration-200">
        
        {/* Header */}
        <div className="bg-emerald-800 text-white px-5 py-4 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider text-emerald-200 font-semibold">New Transaction</div>
            <h2 className="text-lg font-bold">Record Farm Sale</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-emerald-700 text-emerald-100"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Gross Calculation Banner */}
        <div className="bg-emerald-50 px-5 py-3 border-b border-emerald-100 flex items-center justify-between">
          <span className="text-xs font-semibold text-emerald-900 uppercase">Calculated Gross Sale</span>
          <span className="text-xl font-extrabold text-emerald-900">
            {MoneyUtils.formatPesos(grossCentavos)}
          </span>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4">
          
          {/* Crop Selector Chips */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5">
              Crop / Commodity *
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setCrop('Rice');
                  if (unitPriceStr === '42') setUnitPriceStr('32');
                }}
                className={`py-2.5 px-3 rounded-xl border text-sm font-semibold flex items-center justify-center gap-2 transition ${
                  crop === 'Rice'
                    ? 'border-emerald-700 bg-emerald-100/70 text-emerald-950 ring-2 ring-emerald-600'
                    : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700'
                }`}
              >
                <span>🌾</span> Rice (Palay)
              </button>
              <button
                type="button"
                onClick={() => {
                  setCrop('Copra');
                  if (unitPriceStr === '32') setUnitPriceStr('42');
                }}
                className={`py-2.5 px-3 rounded-xl border text-sm font-semibold flex items-center justify-center gap-2 transition ${
                  crop === 'Copra'
                    ? 'border-amber-800 bg-amber-100/70 text-amber-950 ring-2 ring-amber-700'
                    : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700'
                }`}
              >
                <span>🥥</span> Copra (Dried)
              </button>
            </div>
          </div>

          {/* Quantity & Unit */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Quantity *</label>
              <input
                type="number"
                step="any"
                min="0.01"
                required
                value={quantityStr}
                onChange={(e) => setQuantityStr(e.target.value)}
                placeholder="1000"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-bold focus:outline-hidden focus:ring-2 focus:ring-emerald-600"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Unit *</label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-medium focus:outline-hidden focus:ring-2 focus:ring-emerald-600 bg-white"
              >
                <option value="kg">kg (Kilograms)</option>
                <option value="sacks">sacks (50kg)</option>
                <option value="tons">metric tons</option>
                <option value="pcs">pieces (nuts)</option>
              </select>
            </div>
          </div>

          {/* Unit Price & Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Unit Price (₱/{unit}) *</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 font-bold">
                  ₱
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={unitPriceStr}
                  onChange={(e) => setUnitPriceStr(e.target.value)}
                  placeholder="32.00"
                  className="w-full pl-7 pr-3 py-2 rounded-xl border border-slate-300 text-sm font-bold focus:outline-hidden focus:ring-2 focus:ring-emerald-600"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Sale Date *</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-600"
              />
            </div>
          </div>

          {/* Buyer Selection */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-xs font-semibold text-slate-700">Buyer *</label>
              <button
                type="button"
                onClick={() => setIsAddingBuyer(!isAddingBuyer)}
                className="text-xs text-emerald-800 hover:text-emerald-950 font-semibold flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                {isAddingBuyer ? 'Cancel' : 'New Buyer'}
              </button>
            </div>

            {isAddingBuyer ? (
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 space-y-2">
                <input
                  type="text"
                  placeholder="Buyer Full Name"
                  value={newBuyerName}
                  onChange={(e) => setNewBuyerName(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-emerald-300 text-xs bg-white"
                />
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Contact Number (optional)"
                    value={newBuyerContact}
                    onChange={(e) => setNewBuyerContact(e.target.value)}
                    className="flex-1 px-3 py-1.5 rounded-lg border border-emerald-300 text-xs bg-white"
                  />
                  <button
                    type="button"
                    onClick={handleCreateNewBuyer}
                    disabled={!newBuyerName.trim()}
                    className="px-3 py-1.5 bg-emerald-800 text-white rounded-lg text-xs font-bold disabled:opacity-50"
                  >
                    Save Buyer
                  </button>
                </div>
              </div>
            ) : (
              <select
                required
                value={buyerId}
                onChange={(e) => setBuyerId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-medium focus:outline-hidden focus:ring-2 focus:ring-emerald-600 bg-white"
              >
                <option value="">Select Buyer...</option>
                {availableBuyers.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.address || 'Local'})
                  </option>
                ))}
              </select>
            )}
            <p className="text-[11px] text-slate-500 mt-1">
              Historical snapshot rule: The buyer's name at the time of sale is permanently preserved in this transaction record.
            </p>
          </div>

          {/* Link to Production Cycle (Optional) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Production Cycle (Optional)</label>
            <select
              value={cycleId}
              onChange={(e) => setCycleId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-600 bg-white"
            >
              <option value="">None / General Harvest</option>
              {cycles.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.cycleName} ({c.crop})
                </option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Notes</label>
            <input
              type="text"
              placeholder="e.g. Moisture content 14%, delivered at drying pavement"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 text-red-800 text-xs rounded-xl border border-red-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <div>{error}</div>
            </div>
          )}

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-600 font-medium text-sm hover:bg-slate-100 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={grossCentavos <= 0 || !buyerId}
              className="px-5 py-2.5 bg-emerald-800 hover:bg-emerald-900 disabled:opacity-50 text-white font-bold text-sm rounded-xl shadow-xs transition flex items-center gap-2"
            >
              <CheckCircle className="w-4 h-4" />
              Save Sale ({MoneyUtils.formatPesos(grossCentavos)})
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
