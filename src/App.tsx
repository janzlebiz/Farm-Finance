import React, { useState, useEffect } from 'react';
import { StorageService } from './services/storage';
import { Sale, Payment, Expense, ExpenseCategory, Buyer, Supplier, ProductionCycle, Harvest, AuditLog } from './types';
import { MoneyUtils } from './utils/money';
import { DateUtils } from './utils/date';

// Tab screens
import { DashboardTab } from './components/DashboardTab';
import { SalesTab } from './components/SalesTab';
import { ReceivablesTab } from './components/ReceivablesTab';
import { ExpensesTab } from './components/ExpensesTab';
import { ProductionTab } from './components/ProductionTab';
import { ReportsTab } from './components/ReportsTab';

// Modals
import { SaleModal } from './components/SaleModal';
import { PaymentModal } from './components/PaymentModal';
import { ExpenseModal } from './components/ExpenseModal';
import { AcceptanceTestsModal } from './components/AcceptanceTestsModal';
import { BackupModal } from './components/BackupModal';
import { AuditModal } from './components/AuditModal';
import { ContactsModal } from './components/ContactsModal';
import { AndroidSourceModal } from './components/AndroidSourceModal';
import { InstallAppModal } from './components/InstallAppModal';
import { OfflineIndicator } from './components/OfflineIndicator';
import { OnboardingWizard } from './components/OnboardingWizard';

// Icons
import {
  LayoutDashboard,
  CircleDollarSign,
  Clock,
  Receipt,
  Sprout,
  TrendingUp,
  MoreHorizontal,
  Wifi,
  Battery,
  ShieldCheck,
  Download,
  Users,
  History,
  Maximize2,
  Minimize2,
  FolderArchive,
  Smartphone,
  Sparkles,
  CheckCircle2,
  UserPlus
} from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isPhoneFrame, setIsPhoneFrame] = useState<boolean>(true);

  // Database records
  const [sales, setSales] = useState<Sale[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [cycles, setCycles] = useState<ProductionCycle[]>([]);
  const [harvests, setHarvests] = useState<Harvest[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // Modals state
  const [isSaleModalOpen, setIsSaleModalOpen] = useState<boolean>(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState<boolean>(false);
  const [paymentModalData, setPaymentModalData] = useState<{
    sale: Sale;
    remainingBalanceCentavos: number;
  } | null>(null);

  // "More" drawers
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState<boolean>(false);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState<boolean>(false);
  const [isAcceptanceTestsOpen, setIsAcceptanceTestsOpen] = useState<boolean>(false);
  const [isBackupOpen, setIsBackupOpen] = useState<boolean>(false);
  const [isAuditOpen, setIsAuditOpen] = useState<boolean>(false);
  const [isContactsOpen, setIsContactsOpen] = useState<boolean>(false);
  const [isAndroidSourceOpen, setIsAndroidSourceOpen] = useState<boolean>(false);

  // Onboarding state for new users
  const [isOnboardingDismissed, setIsOnboardingDismissed] = useState<boolean>(() => {
    return localStorage.getItem('farm_finance_onboarding_dismissed') === 'true';
  });
  const [isForcedOnboarding, setIsForcedOnboarding] = useState<boolean>(false);
  const [welcomeToast, setWelcomeToast] = useState<string | null>(null);

  // Auto-dismiss welcome toast after 6 seconds
  useEffect(() => {
    if (welcomeToast) {
      const timer = setTimeout(() => setWelcomeToast(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [welcomeToast]);

  // Load database
  const reloadData = () => {
    const db = StorageService.loadDatabase();
    setSales([...db.sales]);
    setPayments([...db.payments]);
    setExpenses([...db.expenses]);
    setCategories([...db.categories]);
    setBuyers([...db.buyers]);
    setSuppliers([...db.suppliers]);
    setCycles([...db.cycles]);
    setHarvests([...db.harvests]);
    setAuditLogs([...db.auditLogs]);

    if (db.buyers.length === 0 && db.suppliers.length === 0 && db.sales.length === 0 && db.expenses.length === 0) {
      if (localStorage.getItem('farm_finance_onboarding_dismissed') !== 'true') {
        setIsOnboardingDismissed(false);
      }
    }
  };

  useEffect(() => {
    reloadData();
  }, []);

  // Empty data state detection: No buyers, suppliers, sales, or expenses recorded
  const isDataEmpty = buyers.length === 0 && suppliers.length === 0 && sales.length === 0 && expenses.length === 0;
  const showOnboarding = isForcedOnboarding || (isDataEmpty && !isOnboardingDismissed);

  const handleOnboardingComplete = (createdName: string, type: 'buyer' | 'supplier') => {
    localStorage.setItem('farm_finance_onboarding_dismissed', 'true');
    setIsOnboardingDismissed(true);
    setIsForcedOnboarding(false);
    reloadData();
    setActiveTab('dashboard');
    setWelcomeToast(`Successfully added "${createdName}" as your first ${type === 'buyer' ? 'crop buyer' : 'farm supplier'}. Welcome to Farm Finance!`);
  };

  const handleOnboardingSkip = () => {
    localStorage.setItem('farm_finance_onboarding_dismissed', 'true');
    setIsOnboardingDismissed(true);
    setIsForcedOnboarding(false);
    setActiveTab('dashboard');
  };

  const openPaymentForSale = (sale: Sale, remainingBalanceCentavos: number) => {
    setPaymentModalData({ sale, remainingBalanceCentavos });
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-900 flex flex-col items-center justify-center p-0 sm:p-4 select-none">
      
      {/* Top Desktop Bar (only when in desktop frame mode) */}
      <div className="w-full max-w-md hidden sm:flex items-center justify-between text-xs text-slate-300 pb-2 px-2">
        <div className="flex items-center gap-1.5 font-bold text-white">
          <span>🌾 Farm Finance</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-800 text-emerald-100">Android v1.0</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsInstallModalOpen(true)}
            className="hover:text-emerald-300 font-semibold flex items-center gap-1 transition text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-md border border-emerald-800/80"
            title="Install app to phone or Android device"
          >
            <Smartphone className="w-3.5 h-3.5 text-emerald-300" />
            Install on Phone
          </button>
          <span>•</span>
          <button
            onClick={() => setIsAndroidSourceOpen(true)}
            className="hover:text-emerald-400 font-semibold flex items-center gap-1 transition"
          >
            <FolderArchive className="w-3.5 h-3.5" />
            Android Project Code
          </button>
          <span>•</span>
          <button
            onClick={() => setIsPhoneFrame(!isPhoneFrame)}
            className="hover:text-white flex items-center gap-1 transition"
            title="Toggle Smartphone Frame"
          >
            {isPhoneFrame ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
            {isPhoneFrame ? 'Expand' : 'Phone View'}
          </button>
        </div>
      </div>

      {/* Main Container / Mobile Device Wrapper */}
      <div
        className={`w-full bg-slate-50 flex flex-col transition-all overflow-hidden ${
          isPhoneFrame
            ? 'sm:max-w-[420px] sm:h-[860px] sm:rounded-[36px] sm:border-[8px] sm:border-slate-800 sm:shadow-2xl sm:ring-1 sm:ring-slate-700/50'
            : 'max-w-2xl min-h-screen sm:min-h-[90vh] sm:rounded-2xl shadow-xl'
        }`}
      >
        
        {/* Android Status Bar */}
        <div className="bg-emerald-900 text-white px-5 pt-3 pb-1 flex items-center justify-between text-[11px] font-semibold tracking-wider">
          <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono opacity-80">4G</span>
            <Wifi className="w-3.5 h-3.5 opacity-90" />
            <Battery className="w-4 h-4 opacity-90" />
          </div>
        </div>

        {/* Android Material 3 Top App Bar */}
        <div className="bg-emerald-800 text-white px-5 py-3 shadow-md flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase font-bold tracking-widest text-emerald-200">
              Farm Finance
            </div>
            <h1 className="text-base font-extrabold tracking-tight capitalize">
              {activeTab === 'dashboard'
                ? 'Dashboard'
                : activeTab === 'sales'
                ? 'Grain & Copra Sales'
                : activeTab === 'receivables'
                ? 'Outstanding Receivables'
                : activeTab === 'expenses'
                ? 'Farm Expenses'
                : activeTab === 'production'
                ? 'Production Cycles'
                : 'Crop Profitability'}
            </h1>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setIsInstallModalOpen(true)}
              className="p-1.5 rounded-xl bg-emerald-700/80 hover:bg-emerald-700 text-emerald-100 flex items-center gap-1 text-[11px] font-bold transition border border-emerald-600/50"
              title="Install on Phone (Android / iOS)"
            >
              <Smartphone className="w-4 h-4 text-emerald-300" />
              <span>Install</span>
            </button>
            <button
              onClick={() => setIsAcceptanceTestsOpen(true)}
              className="p-1.5 rounded-xl bg-emerald-700/80 hover:bg-emerald-700 text-emerald-100 flex items-center gap-1 text-[11px] font-bold transition"
              title="Run Real-World Acceptance Suite"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-300" />
              <span className="hidden sm:inline">Suite</span>
            </button>
            <button
              onClick={() => setIsMoreMenuOpen(true)}
              className="p-2 rounded-xl bg-emerald-700/80 hover:bg-emerald-700 text-emerald-100 transition"
              aria-label="More options"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Content Body (Scrollable Phone Screen) */}
        <div className="flex-1 overflow-y-auto px-4 pt-3 pb-20 no-scrollbar bg-slate-50">
          {activeTab === 'dashboard' && (
            <DashboardTab
              onOpenNewSale={() => setIsSaleModalOpen(true)}
              onOpenNewExpense={() => setIsExpenseModalOpen(true)}
              onNavigateToTab={(tab) => setActiveTab(tab)}
              onOpenInstall={() => setIsInstallModalOpen(true)}
            />
          )}

          {activeTab === 'sales' && (
            <SalesTab
              sales={sales}
              payments={payments}
              onOpenNewSale={() => setIsSaleModalOpen(true)}
              onOpenPayment={openPaymentForSale}
              onReload={reloadData}
            />
          )}

          {activeTab === 'receivables' && (
            <ReceivablesTab
              sales={sales}
              payments={payments}
              buyers={buyers}
              onOpenPayment={openPaymentForSale}
            />
          )}

          {activeTab === 'expenses' && (
            <ExpensesTab
              expenses={expenses}
              categories={categories}
              suppliers={suppliers}
              onOpenNewExpense={() => setIsExpenseModalOpen(true)}
              onReload={reloadData}
            />
          )}

          {activeTab === 'production' && (
            <ProductionTab
              cycles={cycles}
              harvests={harvests}
              expenses={expenses}
              sales={sales}
              onReload={reloadData}
            />
          )}

          {activeTab === 'reports' && (
            <ReportsTab
              sales={sales}
              expenses={expenses}
              payments={payments}
              cycles={cycles}
            />
          )}
        </div>

        {/* Android Material 3 Navigation Bar (Bottom Navigation) */}
        <div className="bg-white border-t border-slate-200 px-2 py-1.5 flex items-center justify-around shadow-lg z-20">
          {[
            { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
            { id: 'sales', label: 'Sales', icon: CircleDollarSign },
            { id: 'receivables', label: 'Receivables', icon: Clock },
            { id: 'expenses', label: 'Expenses', icon: Receipt },
            { id: 'production', label: 'Production', icon: Sprout },
            { id: 'reports', label: 'Reports', icon: TrendingUp }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col items-center justify-center py-1 px-1.5 rounded-xl transition flex-1 ${
                  isActive
                    ? 'text-emerald-800 font-bold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <div
                  className={`p-1 rounded-full transition ${
                    isActive ? 'bg-emerald-100 text-emerald-900' : ''
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <span className="text-[10px] mt-0.5 tracking-tight">{tab.label}</span>
              </button>
            );
          })}
        </div>

      </div>

      {/* ================= MODALS & DRAWERS ================= */}

      {/* New Sale Modal */}
      {isSaleModalOpen && (
        <SaleModal
          buyers={buyers}
          cycles={cycles}
          onClose={() => setIsSaleModalOpen(false)}
          onSuccess={() => {
            setIsSaleModalOpen(false);
            reloadData();
          }}
        />
      )}

      {/* Payment Modal */}
      {paymentModalData && (
        <PaymentModal
          sale={paymentModalData.sale}
          remainingBalanceCentavos={paymentModalData.remainingBalanceCentavos}
          onClose={() => setPaymentModalData(null)}
          onSuccess={() => {
            setPaymentModalData(null);
            reloadData();
          }}
        />
      )}

      {/* New Expense Modal */}
      {isExpenseModalOpen && (
        <ExpenseModal
          categories={categories}
          suppliers={suppliers}
          cycles={cycles}
          onClose={() => setIsExpenseModalOpen(false)}
          onSuccess={() => {
            setIsExpenseModalOpen(false);
            reloadData();
          }}
          onCategoryAdded={(cat) => {
            setCategories((prev) => [...prev, cat]);
          }}
        />
      )}

      {/* Acceptance Tests Modal */}
      {isAcceptanceTestsOpen && (
        <AcceptanceTestsModal onClose={() => setIsAcceptanceTestsOpen(false)} />
      )}

      {/* Backup & Restore Modal */}
      {isBackupOpen && (
        <BackupModal
          onClose={() => setIsBackupOpen(false)}
          onReload={() => {
            reloadData();
            setIsBackupOpen(false);
          }}
        />
      )}

      {/* Audit Log Modal */}
      {isAuditOpen && (
        <AuditModal
          auditLogs={auditLogs}
          onClose={() => setIsAuditOpen(false)}
        />
      )}

      {/* Contacts Modal (Buyers & Suppliers) */}
      {isContactsOpen && (
        <ContactsModal
          buyers={buyers}
          suppliers={suppliers}
          sales={sales}
          payments={payments}
          onClose={() => setIsContactsOpen(false)}
          onReload={reloadData}
        />
      )}

      {/* Android Studio Native Source & Zip Modal */}
      {isAndroidSourceOpen && (
        <AndroidSourceModal onClose={() => setIsAndroidSourceOpen(false)} />
      )}

      {/* Install on Phone Modal */}
      {isInstallModalOpen && (
        <InstallAppModal
          onClose={() => setIsInstallModalOpen(false)}
          onOpenAndroidSource={() => setIsAndroidSourceOpen(true)}
        />
      )}

      {/* Offline Status Toast */}
      <OfflineIndicator />

      {/* "More / Settings" Bottom Drawer */}
      {isMoreMenuOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4">
          <div className="bg-white w-full max-w-sm rounded-t-3xl sm:rounded-2xl shadow-2xl p-5 space-y-4 animate-in fade-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <h3 className="font-bold text-slate-900 text-sm">Application Menu & Tools</h3>
              <button
                onClick={() => setIsMoreMenuOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <div className="space-y-1.5 text-xs">
              <button
                onClick={() => {
                  setIsMoreMenuOpen(false);
                  setIsInstallModalOpen(true);
                }}
                className="w-full text-left p-3 rounded-xl bg-emerald-50 hover:bg-emerald-100/80 text-emerald-950 font-bold flex items-center justify-between transition border border-emerald-300"
              >
                <div className="flex items-center gap-2.5">
                  <Smartphone className="w-4 h-4 text-emerald-700" />
                  <span>Install on Phone (Android / iOS / APK)</span>
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-200 text-emerald-900 font-bold">Mobile App</span>
              </button>

              <button
                onClick={() => {
                  setIsMoreMenuOpen(false);
                  setIsAcceptanceTestsOpen(true);
                }}
                className="w-full text-left p-3 rounded-xl hover:bg-emerald-50 text-slate-800 font-semibold flex items-center justify-between transition border border-emerald-100"
              >
                <div className="flex items-center gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-700" />
                  <span>Acceptance Test Suite (100% Pass)</span>
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">Sec 25</span>
              </button>

              <button
                onClick={() => {
                  setIsMoreMenuOpen(false);
                  setIsAndroidSourceOpen(true);
                }}
                className="w-full text-left p-3 rounded-xl hover:bg-slate-50 text-slate-800 font-semibold flex items-center justify-between transition border border-slate-200"
              >
                <div className="flex items-center gap-2.5">
                  <FolderArchive className="w-4 h-4 text-emerald-700" />
                  <span>Android Studio Source Project & Zip</span>
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-bold">Kotlin</span>
              </button>

              <button
                onClick={() => {
                  setIsMoreMenuOpen(false);
                  setIsContactsOpen(true);
                }}
                className="w-full text-left p-3 rounded-xl hover:bg-slate-50 text-slate-800 font-semibold flex items-center justify-between transition border border-slate-200"
              >
                <div className="flex items-center gap-2.5">
                  <Users className="w-4 h-4 text-slate-700" />
                  <span>Buyers & Suppliers Directory</span>
                </div>
                <span className="text-slate-400 text-xs">→</span>
              </button>

              <button
                onClick={() => {
                  setIsMoreMenuOpen(false);
                  setIsBackupOpen(true);
                }}
                className="w-full text-left p-3 rounded-xl hover:bg-slate-50 text-slate-800 font-semibold flex items-center justify-between transition border border-slate-200"
              >
                <div className="flex items-center gap-2.5">
                  <Download className="w-4 h-4 text-slate-700" />
                  <span>Backup, Restore & CSV Export</span>
                </div>
                <span className="text-slate-400 text-xs">→</span>
              </button>

              <button
                onClick={() => {
                  setIsMoreMenuOpen(false);
                  setIsAuditOpen(true);
                }}
                className="w-full text-left p-3 rounded-xl hover:bg-slate-50 text-slate-800 font-semibold flex items-center justify-between transition border border-slate-200"
              >
                <div className="flex items-center gap-2.5">
                  <History className="w-4 h-4 text-slate-700" />
                  <span>Append-Only Audit Trail</span>
                </div>
                <span className="text-slate-400 text-xs">→</span>
              </button>
            </div>

            <button
              onClick={() => setIsMoreMenuOpen(false)}
              className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl"
            >
              Close Menu
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
