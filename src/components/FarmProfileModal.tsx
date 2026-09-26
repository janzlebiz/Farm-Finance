import React, { useState } from 'react';
import { FarmProfile } from '../types';
import { StorageService } from '../services/storage';
import { X, Building, User, MapPin, Sprout, CheckCircle2, AlertCircle } from 'lucide-react';

interface FarmProfileModalProps {
  onClose: () => void;
  onSaved: (profile: FarmProfile) => void;
}

export const FarmProfileModal: React.FC<FarmProfileModalProps> = ({ onClose, onSaved }) => {
  const currentProfile = StorageService.getFarmProfile() || {
    ownerName: '',
    farmName: '',
    location: '',
    primaryCrop: 'Rice'
  };

  const [ownerName, setOwnerName] = useState<string>(currentProfile.ownerName || '');
  const [farmName, setFarmName] = useState<string>(currentProfile.farmName || '');
  const [location, setLocation] = useState<string>(currentProfile.location || '');
  const [primaryCrop, setPrimaryCrop] = useState<string>(currentProfile.primaryCrop || 'Rice');
  const [error, setError] = useState<string | null>(null);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

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

    const updated: FarmProfile = {
      ownerName: trimmedOwner,
      farmName: trimmedFarm,
      location: location.trim() || undefined,
      primaryCrop: primaryCrop || undefined,
      completedAt: currentProfile.completedAt || new Date().toISOString()
    };

    StorageService.saveFarmProfile(updated);
    setSavedSuccess(true);
    onSaved(updated);
    setTimeout(() => {
      onClose();
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-emerald-900 text-white p-5 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-base">Farm Profile & Settings</h2>
            <p className="text-xs text-emerald-200">Owner & Farm Identity</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-emerald-200 hover:text-white"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 text-xs sm:text-sm">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {savedSuccess && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Farm profile updated successfully!</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-emerald-700" />
              <span>Owner / Farmer Name *</span>
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
              className="w-full text-xs sm:text-sm px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-700 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
              <Building className="w-3.5 h-3.5 text-emerald-700" />
              <span>Farm Name *</span>
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
              className="w-full text-xs sm:text-sm px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-700 transition"
            />
          </div>

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
              className="w-full text-xs sm:text-sm px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-700 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Sprout className="w-3.5 h-3.5 text-slate-400" />
              <span>Primary Crop Focus</span>
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

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-600 font-medium text-xs hover:bg-slate-100 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs rounded-xl shadow-xs transition"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
