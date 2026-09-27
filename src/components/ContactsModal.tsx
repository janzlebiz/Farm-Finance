import React, { useState } from 'react';
import { Buyer, Supplier, Sale, Payment } from '../types';
import { StorageService } from '../services/storage';
import { MoneyUtils } from '../utils/money';
import { Users, Plus, Phone, MapPin, X, Edit2, AlertCircle, ChevronRight, ArrowLeft, FileText, Calendar } from 'lucide-react';

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
  const [editingContact, setEditingContact] = useState<{ id: string; type: 'buyers' | 'suppliers' } | null>(null);
  const [selectedContact, setSelectedContact] = useState<{ item: Buyer | Supplier; type: 'buyers' | 'suppliers' } | null>(null);

  // Form state
  const [name, setName] = useState<string>('');
  const [contact, setContact] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setIsAdding(false);
    setEditingContact(null);
    setName('');
    setContact('');
    setAddress('');
    setNotes('');
    setStatus('ACTIVE');
    setError(null);
  };

  const handleStartAdd = () => {
    setSelectedContact(null);
    resetForm();
    setIsAdding(true);
  };

  const handleStartEdit = (contactItem: Buyer | Supplier, type: 'buyers' | 'suppliers') => {
    setEditingContact({ id: contactItem.id, type });
    setIsAdding(false);
    setName(contactItem.name);
    setContact(contactItem.contactNumber || '');
    setAddress(contactItem.address || '');
    setNotes(contactItem.notes || '');
    setStatus(contactItem.status);
    setError(null);
  };

  const handleSaveContact = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }

    try {
      if (editingContact) {
        if (editingContact.type === 'buyers') {
          const updated = StorageService.updateBuyer(editingContact.id, {
            name: name.trim(),
            contactNumber: contact.trim(),
            address: address.trim(),
            notes: notes.trim(),
            status
          });
          if (selectedContact?.item.id === editingContact.id) {
            setSelectedContact({ item: updated, type: 'buyers' });
          }
        } else {
          const updated = StorageService.updateSupplier(editingContact.id, {
            name: name.trim(),
            contactNumber: contact.trim(),
            address: address.trim(),
            notes: notes.trim(),
            status
          });
          if (selectedContact?.item.id === editingContact.id) {
            setSelectedContact({ item: updated, type: 'suppliers' });
          }
        }
      } else {
        if (activeTab === 'buyers') {
          StorageService.createBuyer({
            name: name.trim(),
            contactNumber: contact.trim(),
            address: address.trim(),
            notes: notes.trim(),
            status
          });
        } else {
          StorageService.createSupplier({
            name: name.trim(),
            contactNumber: contact.trim(),
            address: address.trim(),
            notes: notes.trim(),
            status
          });
        }
      }

      resetForm();
      onReload();
    } catch (err: any) {
      setError(err?.message || 'Failed to save contact.');
    }
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
          <button onClick={onClose} className="p-1 rounded-full text-slate-400 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="p-3 bg-slate-100 flex items-center justify-between border-b">
          <div className="flex bg-slate-200 p-0.5 rounded-lg text-xs font-bold">
            <button
              onClick={() => {
                setActiveTab('buyers');
                setSelectedContact(null);
                resetForm();
              }}
              className={`px-3 py-1.5 rounded-md transition ${
                activeTab === 'buyers' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              Buyers ({buyers.length})
            </button>
            <button
              onClick={() => {
                setActiveTab('suppliers');
                setSelectedContact(null);
                resetForm();
              }}
              className={`px-3 py-1.5 rounded-md transition ${
                activeTab === 'suppliers' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              Suppliers / Payees ({suppliers.length})
            </button>
          </div>

          <button
            onClick={() => {
              if (isAdding || editingContact) {
                resetForm();
              } else {
                handleStartAdd();
              }
            }}
            className="px-3 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-2xs transition"
          >
            <Plus className="w-3.5 h-3.5" />
            {isAdding || editingContact ? 'Cancel' : `Add ${activeTab === 'buyers' ? 'Buyer' : 'Supplier'}`}
          </button>
        </div>

        {/* Add / Edit Form */}
        {(isAdding || editingContact) && (
          <form onSubmit={handleSaveContact} className="p-4 bg-emerald-50/70 border-b border-emerald-100 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <div className="font-bold text-emerald-950">
                {editingContact
                  ? `Edit ${editingContact.type === 'buyers' ? 'Buyer' : 'Supplier'} Details`
                  : `New ${activeTab === 'buyers' ? 'Buyer Profile' : 'Supplier Profile'}`}
              </div>
              {editingContact && (
                <span className="text-[10px] text-slate-500 font-mono">ID: {editingContact.id}</span>
              )}
            </div>

            {error && (
              <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="font-semibold text-slate-700 block mb-0.5">Name / Company *</label>
                <input
                  type="text"
                  required
                  placeholder="Full Name / Company *"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-emerald-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-emerald-700"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-0.5">Contact Number</label>
                <input
                  type="text"
                  placeholder="Phone Number"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-emerald-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-emerald-700"
                />
              </div>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-0.5">Address / Buying Station</label>
              <input
                type="text"
                placeholder="Address / Buying Station"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-emerald-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-emerald-700"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="font-semibold text-slate-700 block mb-0.5">Notes</label>
                <input
                  type="text"
                  placeholder="Notes (optional)"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-emerald-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-emerald-700"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-0.5">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as 'ACTIVE' | 'INACTIVE')}
                  className="w-full px-2.5 py-1.5 bg-white border border-emerald-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-emerald-700"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={resetForm}
                className="px-3 py-1 text-slate-600 font-semibold hover:bg-emerald-100/50 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg font-bold shadow-2xs transition"
              >
                {editingContact ? 'Update Contact' : 'Save'}
              </button>
            </div>
          </form>
        )}

        {/* Contact Details View */}
        {selectedContact && !isAdding && !editingContact && (
          <div className="p-5 overflow-y-auto space-y-4 flex-1 text-xs sm:text-sm animate-in fade-in duration-150">
            <button
              onClick={() => setSelectedContact(null)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition mb-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Directory</span>
            </button>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900">{selectedContact.item.name}</h3>
                  <span className="text-[11px] text-slate-500 capitalize">
                    {selectedContact.type === 'buyers' ? 'Crop Buyer' : 'Farm Supplier / Payee'}
                  </span>
                </div>
                <span
                  className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                    selectedContact.item.status === 'ACTIVE'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {selectedContact.item.status}
                </span>
              </div>

              <div className="space-y-2 pt-1 border-t border-slate-200 text-xs">
                {selectedContact.item.contactNumber && (
                  <div className="flex items-center gap-2 text-slate-700">
                    <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                    <span>{selectedContact.item.contactNumber}</span>
                  </div>
                )}
                {selectedContact.item.address && (
                  <div className="flex items-center gap-2 text-slate-700">
                    <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                    <span>{selectedContact.item.address}</span>
                  </div>
                )}
                {selectedContact.item.createdDate && (
                  <div className="flex items-center gap-2 text-slate-700">
                    <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                    <span>Added: {selectedContact.item.createdDate}</span>
                  </div>
                )}
                {selectedContact.item.notes && (
                  <div className="flex items-start gap-2 text-slate-700 pt-1">
                    <FileText className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                    <span className="italic bg-white p-2 rounded-lg border border-slate-200 flex-1">{selectedContact.item.notes}</span>
                  </div>
                )}
              </div>

              {selectedContact.type === 'buyers' && (
                (() => {
                  const b = selectedContact.item as Buyer;
                  const buyerSales = sales.filter((s) => !s.isVoided && s.buyerId === b.id);
                  const totalGross = buyerSales.reduce((acc, s) => acc + s.grossAmountCentavos, 0);
                  const buyerPayments = payments.filter((p) => !p.isVoided && p.buyerId === b.id);
                  const totalPaid = buyerPayments.reduce((acc, p) => acc + p.amountCentavos, 0);
                  const balance = totalGross - totalPaid;

                  return (
                    <div className="grid grid-cols-3 gap-2 bg-white p-2.5 rounded-lg border border-slate-200 text-center text-xs">
                      <div>
                        <span className="text-slate-500 block text-[10px]">Total Purchases</span>
                        <span className="font-bold text-slate-900">{MoneyUtils.formatPesos(totalGross)}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px]">Total Paid</span>
                        <span className="font-semibold text-emerald-700">{MoneyUtils.formatPesos(totalPaid)}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px]">Balance Due</span>
                        <span className="font-bold text-rose-700">{MoneyUtils.formatPesos(balance)}</span>
                      </div>
                    </div>
                  );
                })()
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => handleStartEdit(selectedContact.item, selectedContact.type)}
                className="flex-1 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition shadow-2xs"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Edit {selectedContact.type === 'buyers' ? 'Buyer' : 'Supplier'} Details</span>
              </button>
              <button
                onClick={() => setSelectedContact(null)}
                className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition"
              >
                Back
              </button>
            </div>
          </div>
        )}

        {/* Directory List */}
        {!selectedContact && (
          <div className="p-5 overflow-y-auto space-y-3 flex-1 text-xs">
            {activeTab === 'buyers' ? (
              buyers.map((b) => {
                const buyerSales = sales.filter((s) => !s.isVoided && s.buyerId === b.id);
                const totalGross = buyerSales.reduce((acc, s) => acc + s.grossAmountCentavos, 0);
                const buyerPayments = payments.filter((p) => !p.isVoided && p.buyerId === b.id);
                const totalPaid = buyerPayments.reduce((acc, p) => acc + p.amountCentavos, 0);
                const balance = totalGross - totalPaid;

                return (
                  <div
                    key={b.id}
                    onClick={() => setSelectedContact({ item: b, type: 'buyers' })}
                    className="p-3.5 bg-white rounded-xl border border-slate-200 hover:border-emerald-400 hover:shadow-xs cursor-pointer transition space-y-2"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-sm text-slate-900">{b.name}</h4>
                        </div>
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
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                            b.status === 'ACTIVE'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {b.status}
                        </span>
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      </div>
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
                <div
                  key={s.id}
                  onClick={() => setSelectedContact({ item: s, type: 'suppliers' })}
                  className="p-3.5 bg-white rounded-xl border border-slate-200 hover:border-emerald-400 hover:shadow-xs cursor-pointer transition space-y-1"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-sm text-slate-900">{s.name}</h4>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                          s.status === 'ACTIVE'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {s.status}
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    </div>
                  </div>
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
        )}

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
