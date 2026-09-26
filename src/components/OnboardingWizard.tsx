import React, { useState } from 'react';
import { FarmProfile } from '../types';
import { Wheat, CheckCircle2, ArrowRight, MapPin, User, Building, Sprout, AlertCircle } from 'lucide-react';

interface OnboardingWizardProps {
  onComplete: (profile: FarmProfile) => void;
}

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ onComplete }) => {
  const [ownerName, setOwnerName] = useState<string>('');
  const [farmName, setFarmName] = useState<string>('');
  const [location, setLocation] = useState<string>('');
  const [primaryCrop, setPrimaryCrop] = useState<string>('Rice');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedOwner = ownerName.trim();
    const trimmedFarm = farmName.trim();

    if (!trimmedOwner && !trimmedFarm) {
      setError('Please enter your name and farm name.');
      return;
    }
    if (!trimmedOwner) {
      setError('Please enter your name.');
      return;
    }
    if (!trimmedFarm) {
      setError('Please enter your farm name.');
      return;
    }

    setError(null);
    onComplete({
      ownerName: trimmedOwner,
      farmName: trimmedFarm,
      location: location.trim() || undefined,
      primaryCrop: primaryCrop || undefined
    });
  };

  return (
    <div className="h-full w-full flex flex-col justify-between bg-slate-50 overflow-y-auto select-none">
      {/* Top Banner with Agrarian Accent */}
      <div className="bg-emerald-950 text-white p-6 pt-[max(1.5rem,env(safe-area-inset-top,0px))] pb-8 relative overflow-hidden shrink-0">
        <div className="absolute -right-6 -bottom-6 opacity-10 pointer-events-none">
          <Wheat className="w-48 h-48 text-emerald-300" />
        </div>

        <div className="relative z-10 max-w-md mx-auto space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Farm Setup · First-Run Onboarding</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            Welcome to Farm Finance
          </h1>
          <p className="text-xs sm:text-sm text-emerald-200/90 leading-relaxed">
            Let's set up your farm profile to begin tracking harvests, grain sales, production cycles, and operating expenses.
          </p>
        </div>
      </div>

      {/* Main Card Content */}
      <div className="flex-1 px-4 -mt-4 pb-8 max-w-md mx-auto w-full space-y-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-5">
          <div>
            <h2 className="text-base font-bold text-slate-900">Let's set up your farm</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Enter your basic farm information to personalize your books.
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Owner Name Input */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-emerald-700" />
                <span>Your Name</span>
                <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                required
                value={ownerName}
                onChange={(e) => {
                  setOwnerName(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="e.g. Juan dela Cruz"
                autoFocus
                className="w-full text-xs sm:text-sm px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-700 focus:border-transparent transition"
              />
            </div>

            {/* Farm Name Input */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <Building className="w-3.5 h-3.5 text-emerald-700" />
                <span>Farm Name</span>
                <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                required
                value={farmName}
                onChange={(e) => {
                  setFarmName(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="e.g. Green Valley Farm"
                className="w-full text-xs sm:text-sm px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-700 focus:border-transparent transition"
              />
            </div>

            {/* Farm Location (Optional) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                <span>Farm Location (Optional)</span>
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Brgy. San Jose, Nueva Ecija"
                className="w-full text-xs sm:text-sm px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-700 focus:border-transparent transition"
              />
            </div>

            {/* Primary Commodity / Crop Focus */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Sprout className="w-3.5 h-3.5 text-slate-400" />
                <span>Primary Crop Focus (Optional)</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'Rice', label: '🌾 Rice' },
                  { id: 'Copra', label: '🥥 Copra' },
                  { id: 'Both', label: '🌾🥥 Both' }
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setPrimaryCrop(item.id)}
                    className={`py-2 px-2 text-xs font-bold rounded-xl border text-center transition ${
                      primaryCrop === item.id
                        ? 'bg-emerald-50 border-emerald-700 text-emerald-900 ring-1 ring-emerald-700'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Action Button */}
            <div className="pt-3">
              <button
                type="submit"
                className="w-full py-3 px-4 bg-emerald-800 hover:bg-emerald-900 active:bg-emerald-950 text-white font-bold text-xs sm:text-sm rounded-xl flex items-center justify-center gap-2 shadow-sm transition"
              >
                <span>Continue / Complete Setup</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>

        <div className="text-center text-[11px] text-slate-400 pb-4">
          All data is stored securely offline on your device.
        </div>
      </div>
    </div>
  );
};
