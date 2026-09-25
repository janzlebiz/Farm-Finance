import React, { useState } from 'react';
import { StorageService } from '../services/storage';
import {
  Users,
  Store,
  ArrowRight,
  CheckCircle2,
  Phone,
  MapPin,
  FileText,
  Sparkles,
  Wheat,
  Plus
} from 'lucide-react';

interface OnboardingWizardProps {
  onComplete: (createdName: string, type: 'buyer' | 'supplier') => void;
  onSkip: () => void;
}

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({
  onComplete,
  onSkip
}) => {
  const [partnerType, setPartnerType] = useState<'buyer' | 'supplier'>('buyer');
  const [name, setName] = useState<string>('');
  const [contactNumber, setContactNumber] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [createdCount, setCreatedCount] = useState<number>(0);
  const [lastCreatedName, setLastCreatedName] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent, addAnother = false) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please enter a name or business title to continue.');
      return;
    }

    const trimmedName = name.trim();

    if (partnerType === 'buyer') {
      StorageService.createBuyer({
        name: trimmedName,
        contactNumber: contactNumber.trim(),
        address: address.trim(),
        notes: notes.trim(),
        status: 'ACTIVE'
      });
    } else {
      StorageService.createSupplier({
        name: trimmedName,
        contactNumber: contactNumber.trim(),
        address: address.trim(),
        notes: notes.trim(),
        status: 'ACTIVE'
      });
    }

    setCreatedCount((prev) => prev + 1);
    setLastCreatedName(trimmedName);

    if (addAnother) {
      // Clear fields and switch to the other type to prompt adding both
      setName('');
      setContactNumber('');
      setAddress('');
      setNotes('');
      setError(null);
      setPartnerType(partnerType === 'buyer' ? 'supplier' : 'buyer');
    } else {
      onComplete(trimmedName, partnerType);
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-between bg-slate-50 overflow-y-auto">
      {/* Top Banner with Agrarian Accent */}
      <div className="bg-emerald-950 text-white p-6 pb-8 relative overflow-hidden">
        <div className="absolute -right-6 -bottom-6 opacity-10 pointer-events-none">
          <Wheat className="w-40 h-40 text-emerald-300" />
        </div>

        <div className="relative z-10 max-w-sm mx-auto space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Farm Setup · Step 1 of 1</span>
          </div>

          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
            Welcome to Farm Finance
          </h2>
          <p className="text-xs sm:text-sm text-emerald-200/90 leading-relaxed">
            Every farm transaction connects to a partner. Add your first crop buyer or agricultural supplier to get your farm books started.
          </p>
        </div>
      </div>

      {/* Main Card Content */}
      <div className="flex-1 px-4 -mt-4 pb-6 max-w-md mx-auto w-full space-y-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 space-y-4">
          
          {/* Partner Type Selector */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
              Who would you like to add first?
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setPartnerType('buyer');
                  setError(null);
                }}
                className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                  partnerType === 'buyer'
                    ? 'border-emerald-700 bg-emerald-50/60 ring-2 ring-emerald-700/20'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className={`p-1.5 rounded-lg ${partnerType === 'buyer' ? 'bg-emerald-800 text-white' : 'bg-slate-100 text-slate-600'}`}>
                    <Users className="w-4 h-4" />
                  </div>
                  {partnerType === 'buyer' && (
                    <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                  )}
                </div>
                <div>
                  <div className="font-bold text-xs text-slate-900">Crop Buyer</div>
                  <div className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                    Miller, trader, or local market buying your harvest
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPartnerType('supplier');
                  setError(null);
                }}
                className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                  partnerType === 'supplier'
                    ? 'border-emerald-700 bg-emerald-50/60 ring-2 ring-emerald-700/20'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className={`p-1.5 rounded-lg ${partnerType === 'supplier' ? 'bg-emerald-800 text-white' : 'bg-slate-100 text-slate-600'}`}>
                    <Store className="w-4 h-4" />
                  </div>
                  {partnerType === 'supplier' && (
                    <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                  )}
                </div>
                <div>
                  <div className="font-bold text-xs text-slate-900">Farm Supplier</div>
                  <div className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                    Fertilizer, seed dealer, equipment, or labor payee
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-3 pt-1">
            {error && (
              <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                {error}
              </div>
            )}

            {lastCreatedName && createdCount > 0 && (
              <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Added <strong>{lastCreatedName}</strong>. You can add another or proceed to dashboard.</span>
              </div>
            )}

            {/* Name input */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {partnerType === 'buyer' ? 'Buyer / Company Name' : 'Supplier / Payee Name'}
                <span className="text-emerald-700 ml-0.5">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (error) setError(null);
                }}
                placeholder={
                  partnerType === 'buyer'
                    ? 'e.g., Golden Grain Trading or San Jose Rice Mill'
                    : 'e.g., AgriCorp Supplies or Northern Farm Chemicals'
                }
                autoFocus
                className="w-full text-xs px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-700 focus:border-transparent transition"
              />
            </div>

            {/* Contact number */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <Phone className="w-3 h-3 text-slate-400" />
                <span>Contact Number (Optional)</span>
              </label>
              <input
                type="tel"
                value={contactNumber}
                onChange={(e) => setContactNumber(e.target.value)}
                placeholder="e.g., 0917-123-4567"
                className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-700 focus:border-transparent transition"
              />
            </div>

            {/* Address / Location */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <MapPin className="w-3 h-3 text-slate-400" />
                <span>Trading Location / Municipality (Optional)</span>
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g., Brgy. Poblacion Central, Nueva Ecija"
                className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-700 focus:border-transparent transition"
              />
            </div>

            {/* Notes / Terms */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <FileText className="w-3 h-3 text-slate-400" />
                <span>Notes or Terms (Optional)</span>
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={
                  partnerType === 'buyer'
                    ? 'e.g., Buys palay dry, cash basis'
                    : 'e.g., 30-day payment terms for fertilizer'
                }
                className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-700 focus:border-transparent transition"
              />
            </div>

            {/* Action Buttons */}
            <div className="pt-2 space-y-2">
              <button
                type="submit"
                className="w-full py-3 px-4 bg-emerald-800 hover:bg-emerald-900 active:bg-emerald-950 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-sm transition"
              >
                <span>Save & Enter Farm Finance</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={(e) => handleSubmit(e, true)}
                className="w-full py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 transition"
              >
                <Plus className="w-3.5 h-3.5 text-slate-500" />
                <span>Save & Add Another Partner First</span>
              </button>
            </div>
          </form>
        </div>

        {/* Skip Option */}
        <div className="text-center pt-1">
          <button
            type="button"
            onClick={onSkip}
            className="text-xs text-slate-500 hover:text-slate-800 underline transition underline-offset-2"
          >
            Skip for now, explore empty dashboard
          </button>
        </div>
      </div>
    </div>
  );
};
