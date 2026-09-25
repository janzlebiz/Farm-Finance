import React, { useState } from 'react';
import { Buyer, Supplier, Sale, Payment } from '../types';
import { StorageService } from '../services/storage';
import { MoneyUtils } from '../utils/money';
import { Users, Plus, Phone, MapPin, X } from 'lucide-react';

interface ContactsModalProps {
  buyers: Buyer[];
  suppliers: Supplier[];
  sales: Sale[];
  payments: Payment[];
  onClose: () => void;
  onReload: () => void;
}

export const ContactsModal: React.FC<ContactsModalProps> = ({
  buyers,
  suppliers,
  sales,
  payments,
  onClose,
  onReload
}) => {
  const [activeTab, setActiveTab] = useState<'buyers' | 'suppliers'>('buyers');
  const [isAdding, setIsAdding] = useState<boolean>(false);
  const [name, setName] = useState<string>('');
  const [contact, setContact] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  const handleSaveContact = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (activeTab === 'buyers') {
      StorageService.createBuyer({
        name: name.trim(),
        contactNumber: contact.trim(),
        address: address.trim(),
        notes: notes.trim(),
        status: 'ACTIVE'
      });
    } else {
      StorageService.createSupplier({
        name: name.trim(),
        contactNumber: contact.trim(),
        address: address.trim(),
        notes: notes.trim(),
        status: 'ACTIVE'
      });
    }

    setIsAdding(false);
    setName('');
    setContact('');
    setAddress('');
    setNotes('');
    onReload();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in duration-150">
        
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Users className="w-5 h-5 text-emerald-400" />
            <div>
              <h2 className="font-bold text-base">Buyers & Payees Directory</h2>
              <p className="text-xs text-slate-400">Master contact books and commercial history</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-full text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="p-3 bg-slate-100 flex items-center justify-between border-b">
          <div className="flex bg-slate-200 p-0.5 rounded-lg text-xs font-bold">
            <button
              onClick={() => setActiveTab('buyers')}
              className={`px-3 py-1.5 rounded-md transition ${
                activeTab === 'buyers' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              Buyers ({buyers.length})
            </button>
            <button
              onClick={() => setActiveTab('suppliers')}
              className={`px-3 py-1.5 rounded-md transition ${
                activeTab === 'suppliers' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              Suppliers / Payees ({suppliers.length})
            </button>
          </div>

          <button
            onClick={() => setIsAdding(!isAdding)}
            className="px-3 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" />
            {isAdding ? 'Cancel' : `Add ${activeTab === 'buyers' ? 'Buyer' : 'Supplier'}`}
          </button>
        </div>

        {/* Add Form */}
        {isAdding && (
          <form onSubmit={handleSaveContact} className="p-4 bg-emerald-50/70 border-b border-emerald-100 space-y-2 text-xs">
            <div className="font-bold text-emerald-950">
              New {activeTab === 'buyers' ? 'Buyer Profile' : 'Supplier Profile'}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                required
                placeholder="Full Name / Company *"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="px-2.5 py-1.5 bg-white border border-emerald-300 rounded-lg"
              />
              <input
                type="text"
                placeholder="Phone Number"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                className="px-2.5 py-1.5 bg-white border border-emerald-300 rounded-lg"
              />
            </div>
            <input
              type="text"
              placeholder="Address / Buying Station"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-white border border-emerald-300 rounded-lg"
            />
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-3 py-1 text-slate-600 font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1 bg-emerald-800 text-white rounded-lg font-bold"
              >
                Save
              </button>
            </div>
          </form>
        )}

        {/* Directory List */}
        <div className="p-5 overflow-y-auto space-y-3 flex-1 text-xs">
          {activeTab === 'buyers' ? (
            buyers.map((b) => {
              const buyerSales = sales.filter((s) => !s.isVoided && s.buyerId === b.id);
              const totalGross = buyerSales.reduce((acc, s) => acc + s.grossAmountCentavos, 0);
              const buyerPayments = payments.filter((p) => !p.isVoided && p.buyerId === b.id);
              const totalPaid = buyerPayments.reduce((acc, p) => acc + p.amountCentavos, 0);
              const balance = totalGross - totalPaid;

              return (
                <div key={b.id} className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-xs space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-sm text-slate-900">{b.name}</h4>
                      {b.contactNumber && (
                        <p className="text-slate-500 flex items-center gap-1 mt-0.5">
                          <Phone className="w-3 h-3" /> {b.contactNumber}
                        </p>
                      )}
                      {b.address && (
                        <p className="text-slate-500 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3" /> {b.address}
                        </p>
                      )}
                    </div>
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded">
                      {b.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2 rounded-lg text-[11px]">
                    <div>
                      <span className="text-slate-500 block text-[10px]">Purchases</span>
                      <span className="font-semibold text-slate-800">{MoneyUtils.formatPesos(totalGross)}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Paid</span>
                      <span className="font-semibold text-emerald-700">{MoneyUtils.formatPesos(totalPaid)}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-slate-500 block text-[10px]">Balance Due</span>
                      <span className="font-bold text-red-700">{MoneyUtils.formatPesos(balance)}</span>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            suppliers.map((s) => (
              <div key={s.id} className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-xs space-y-1">
                <h4 className="font-bold text-sm text-slate-900">{s.name}</h4>
                {s.contactNumber && (
                  <p className="text-slate-500 flex items-center gap-1">
                    <Phone className="w-3 h-3" /> {s.contactNumber}
                  </p>
                )}
                {s.address && (
                  <p className="text-slate-500 flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> {s.address}
                  </p>
                )}
                {s.notes && <p className="text-slate-400 italic text-[11px]">"{s.notes}"</p>}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
