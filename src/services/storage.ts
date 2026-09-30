import {
  Buyer,
  Supplier,
  Sale,
  Payment,
  Expense,
  ExpensePayment,
  ExpenseCategory,
  ProductionCycle,
  Harvest,
  AuditLog,
  CropType,
  PaymentMethod,
  DashboardMetrics,
  DateFilterType,
  FarmProfile
} from '../types';
import { MoneyUtils } from '../utils/money';
import { DateUtils } from '../utils/date';
import { FinancialCalculator } from '../utils/financialCalculator';
import { computeSha256Sync, canonicalJsonStringify } from '../utils/crypto';

export const APP_VERSION = '1.0.0';
export const DATABASE_SCHEMA_VERSION = 3;
export const BACKUP_SCHEMA_VERSION = 1;

const DEFAULT_CATEGORIES: string[] = [
  'Seeds & Seedlings',
  'Fertilizer',
  'Pesticides & Herbicides',
  'Labor & Harvesting Wages',
  'Fuel & Oil',
  'Transportation & Hauling',
  'Machinery & Thresher Rental',
  'Equipment & Tools',
  'Repairs & Maintenance',
  'Utilities (Water / Electric)',
  'Land Rent & Lease',
  'Supplies & Sacks',
  'Livestock & Animal Feeds',
  'Other Farm Expenses'
];

export interface AppDatabase {
  schemaVersion: number;
  buyers: Buyer[];
  suppliers: Supplier[];
  sales: Sale[];
  payments: Payment[];
  expenses: Expense[];
  expensePayments?: ExpensePayment[];
  categories: ExpenseCategory[];
  cycles: ProductionCycle[];
  harvests: Harvest[];
  auditLogs: AuditLog[];
}

export interface BackupPayload {
  appName: string;
  appVersion: string;
  backupSchemaVersion: number;
  exportedAt: string;
  integrity: {
    algorithm: 'SHA-256';
    checksum: string;
  };
  database: AppDatabase;
}

// In-Memory Database store (used in standalone web preview, identical Room SQLite schema)
let memoryDb: AppDatabase | null = null;
const memoryStorage = new Map<string, string>();

function getStorageItem(key: string): string | null {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(key);
    }
  } catch (_: any) {}
  return memoryStorage.get(key) || null;
}

function setStorageItem(key: string, value: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
    }
  } catch (_: any) {}
  memoryStorage.set(key, value);
}

function removeStorageItem(key: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(key);
    }
  } catch (_: any) {}
  memoryStorage.delete(key);
}

function getNativeBridge(): any {
  if (typeof window !== 'undefined' && (window as any).FarmFinanceNative?.isAvailable?.()) {
    return (window as any).FarmFinanceNative;
  }
  return null;
}

export const StorageService = {
  isNativeAndroid(): boolean {
    return getNativeBridge() !== null;
  },

  getInitialData(): AppDatabase {
    const categories: ExpenseCategory[] = DEFAULT_CATEGORIES.map((cat, idx) => ({
      id: `cat-${idx + 1}`,
      name: cat,
      isDefault: true
    }));

    return {
      schemaVersion: DATABASE_SCHEMA_VERSION,
      categories,
      buyers: [],
      suppliers: [],
      cycles: [],
      sales: [],
      payments: [],
      expenses: [],
      expensePayments: [],
      harvests: [],
      auditLogs: [
        {
          id: `audit-init-${Date.now()}`,
          timestamp: new Date().toISOString(),
          entityType: 'BACKUP',
          entityId: 'SYSTEM',
          eventType: 'CREATE',
          summary: 'Farm financial database initialized',
          appVersion: APP_VERSION,
          sync_state: 'SYNCED'
        }
      ]
    };
  },

  // Authoritative load of full database
  loadDatabase(): AppDatabase {
    const bridge = getNativeBridge();
    if (bridge) {
      try {
        // One-time migration check from v1.0 localStorage
        this.checkAndMigrateLegacyLocalStorage(bridge);

        const rawState = bridge.getDatabaseState();
        const parsed = JSON.parse(rawState);
        const categories: ExpenseCategory[] = DEFAULT_CATEGORIES.map((cat, idx) => ({
          id: `cat-${idx + 1}`,
          name: cat,
          isDefault: true
        }));
        return {
          schemaVersion: parsed.schemaVersion || DATABASE_SCHEMA_VERSION,
          categories,
          buyers: parsed.buyers || [],
          suppliers: parsed.suppliers || [],
          cycles: parsed.cycles || [],
          sales: parsed.sales || [],
          payments: parsed.payments || [],
          expenses: parsed.expenses || [],
          expensePayments: parsed.expensePayments || [],
          harvests: parsed.harvests || [],
          auditLogs: parsed.auditLogs || []
        };
      } catch (err) {
        console.error('[FarmFinance] Native bridge read failure, using fallback:', err);
      }
    }

    if (!memoryDb) {
      // Check if session has stored data
      try {
        const raw = sessionStorage.getItem('farm_finance_preview_db');
        if (raw) {
          memoryDb = JSON.parse(raw);
        }
      } catch (_: any) {}

      if (!memoryDb) {
        memoryDb = this.getInitialData();
      }
    }
    return memoryDb;
  },

  saveMemoryDatabase(db: AppDatabase): void {
    memoryDb = db;
    try {
      sessionStorage.setItem('farm_finance_preview_db', JSON.stringify(db));
    } catch (_: any) {}
    if (typeof window !== 'undefined') {
      try {
        window.dispatchEvent(new CustomEvent('farm_finance_db_updated'));
      } catch (_: any) {}
    }
  },

  // One-time automatic migration of v1.0 localStorage data into native Room
  checkAndMigrateLegacyLocalStorage(bridge: any): void {
    try {
      if (typeof localStorage === 'undefined') return;
      const migrationFlag = localStorage.getItem('farm_finance_native_migrated');
      if (migrationFlag === 'true') return;

      const legacyDataRaw = localStorage.getItem('farm_finance_db_v2') || localStorage.getItem('farm_finance_db_v3');
      if (!legacyDataRaw) {
        localStorage.setItem('farm_finance_native_migrated', 'true');
        return;
      }

      console.log('[FarmFinance] Migrating legacy localStorage data to Room SQLite...');
      const resultJson = bridge.migrateFromLocalStorage(legacyDataRaw);
      const res = JSON.parse(resultJson);

      if (res.success) {
        console.log('[FarmFinance] Migration to native Room SUCCESS:', res.summary || res.message);
        // Safely archive and mark migrated; do not use localStorage as ledger anymore
        localStorage.setItem('farm_finance_native_migrated', 'true');
        localStorage.removeItem('farm_finance_db_v2');
        localStorage.removeItem('farm_finance_db_v3');
      } else {
        console.warn('[FarmFinance] Migration notice:', res.error);
      }
    } catch (e) {
      console.error('[FarmFinance] Migration error:', e);
    }
  },

  addAuditLog(
    db: AppDatabase,
    entityType: AuditLog['entityType'],
    entityId: string,
    eventType: AuditLog['eventType'],
    summary: string,
    metadata?: Record<string, any>
  ): void {
    const log: AuditLog = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      entityType,
      entityId,
      eventType,
      summary,
      metadata,
      appVersion: APP_VERSION
    };
    db.auditLogs.unshift(log);
  },

  // =================== FARM PROFILE & ONBOARDING ===================
  getFarmProfile(): FarmProfile | null {
    try {
      const raw = getStorageItem('farm_finance_profile');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.farmName === 'string') {
          return parsed;
        }
      }
    } catch (_: any) {}
    return null;
  },

  saveFarmProfile(profile: FarmProfile): void {
    try {
      setStorageItem('farm_finance_profile', JSON.stringify(profile));
    } catch (_: any) {}
  },

  hasCompletedOnboarding(): boolean {
    // 1. Check authoritative farm profile
    const profile = this.getFarmProfile();
    if (profile && profile.ownerName?.trim() && profile.farmName?.trim()) {
      return true;
    }

    // 2. Check legacy dismissal flag if previously set
    const dismissed = getStorageItem('farm_finance_onboarding_dismissed');
    if (dismissed === 'true') {
      return true;
    }

    // 3. Existing users check: If database already has existing transactions or records,
    // do not show onboarding to users who already have existing Farm Finance data.
    const db = this.loadDatabase();
    if (
      db.sales.length > 0 ||
      db.expenses.length > 0 ||
      db.buyers.length > 0 ||
      db.suppliers.length > 0 ||
      db.cycles.length > 0
    ) {
      return true;
    }

    return false;
  },

  completeOnboarding(profile: FarmProfile): { success: boolean; error?: string } {
    if (!profile.ownerName?.trim()) {
      return { success: false, error: 'Your name is required.' };
    }
    if (!profile.farmName?.trim()) {
      return { success: false, error: 'Farm name is required.' };
    }

    const cleanProfile: FarmProfile = {
      ownerName: profile.ownerName.trim(),
      farmName: profile.farmName.trim(),
      location: profile.location?.trim() || undefined,
      primaryCrop: profile.primaryCrop?.trim() || undefined,
      completedAt: new Date().toISOString()
    };

    this.saveFarmProfile(cleanProfile);
    setStorageItem('farm_finance_onboarding_dismissed', 'true');

    // Record audit log for setup
    const db = this.loadDatabase();
    this.addAuditLog(
      db,
      'BACKUP',
      'FARM_PROFILE',
      'CREATE',
      `Completed initial farm setup for "${cleanProfile.farmName}" (Owner: ${cleanProfile.ownerName})`
    );
    this.saveMemoryDatabase(db);

    return { success: true };
  },

  // =================== SALES ===================
  getSales(): Sale[] {
    return this.loadDatabase().sales;
  },

  createSale(data: {
    date: string;
    crop: CropType;
    quantity: number;
    unit: string;
    unitPriceCentavos: number;
    buyerId: string;
    notes?: string;
    cycleId?: string;
  }): { sale?: Sale; error?: string } {
    if (data.quantity <= 0) return { error: 'Quantity must be greater than zero.' };
    if (data.unitPriceCentavos <= 0) return { error: 'Unit price must be greater than zero.' };

    const bridge = getNativeBridge();
    if (bridge) {
      try {
        const resStr = bridge.recordSale(JSON.stringify(data));
        const res = JSON.parse(resStr);
        if (!res.success) return { error: res.error || 'Failed to record sale' };
        const db = this.loadDatabase();
        const created = db.sales.find((s) => s.id === res.saleId);
        return { sale: created };
      } catch (e: any) {
        return { error: e?.message || 'Native sale recording error' };
      }
    }

    // In-memory Room fallback
    const db = this.loadDatabase();
    const buyer = db.buyers.find((b) => b.id === data.buyerId);
    if (!buyer) return { error: 'Selected buyer not found.' };

    const gross = FinancialCalculator.calculateGross(data.quantity, data.unitPriceCentavos);
    const now = new Date().toISOString();

    const newSale: Sale = {
      id: `sale-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      date: data.date,
      crop: data.crop,
      quantity: data.quantity,
      unit: data.unit,
      unitPriceCentavos: data.unitPriceCentavos,
      grossAmountCentavos: gross,
      buyerId: data.buyerId,
      buyerNameSnapshot: buyer.name,
      notes: data.notes?.trim(),
      cycleId: data.cycleId,
      isVoided: false,
      createdAt: now,
      updatedAt: now
    };

    db.sales.unshift(newSale);
    this.addAuditLog(
      db,
      'SALE',
      newSale.id,
      'CREATE',
      `Recorded ${newSale.crop} sale: ${newSale.quantity} ${newSale.unit} @ ${MoneyUtils.formatPesos(newSale.unitPriceCentavos)} to ${newSale.buyerNameSnapshot} = ${MoneyUtils.formatPesos(gross)}`,
      { grossCentavos: gross, buyerId: buyer.id }
    );

    this.saveMemoryDatabase(db);
    return { sale: newSale };
  },

  voidSale(saleId: string, reason: string): { success: boolean; error?: string } {
    const bridge = getNativeBridge();
    if (bridge) {
      try {
        const resStr = bridge.voidSale(saleId, reason);
        const res = JSON.parse(resStr);
        return res.success ? { success: true } : { success: false, error: res.error };
      } catch (e: any) {
        return { success: false, error: e?.message };
      }
    }

    const db = this.loadDatabase();
    const sale = db.sales.find((s) => s.id === saleId);
    if (!sale) return { success: false, error: 'Sale not found.' };
    if (sale.isVoided) return { success: false, error: 'Sale is already voided.' };

    // Cascade voiding to associated payments
    const associatedPayments = db.payments.filter((p) => p.saleId === saleId && !p.isVoided);
    for (const p of associatedPayments) {
      p.isVoided = true;
      p.sync_state = 'PENDING_UPLOAD';
    }

    sale.isVoided = true;
    sale.sync_state = 'PENDING_UPLOAD';
    sale.updatedAt = new Date().toISOString();

    this.addAuditLog(
      db,
      'SALE',
      sale.id,
      'VOID',
      `Voided sale ${sale.id} (${MoneyUtils.formatPesos(sale.grossAmountCentavos)}). Reason: ${reason || 'User voided'}. ${associatedPayments.length} associated payments also voided.`
    );

    this.saveMemoryDatabase(db);
    return { success: true };
  },

  // =================== PAYMENTS ===================
  getPaymentsForSale(saleId: string): Payment[] {
    const db = this.loadDatabase();
    return db.payments.filter((p) => p.saleId === saleId && !p.isVoided);
  },

  getSalePaymentSummary(sale: Sale, paymentsList?: Payment[]): {
    totalPaidCentavos: number;
    remainingBalanceCentavos: number;
    status: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'VOIDED';
  } {
    const db = this.loadDatabase();
    const payments = paymentsList || db.payments;
    return FinancialCalculator.computeSaleStatus(sale, payments);
  },

  recordPayment(params: {
    saleId: string;
    amountCentavos: number;
    date: string;
    paymentMethod: PaymentMethod;
    reference?: string;
    notes?: string;
  }): { payment?: Payment; error?: string } {
    const bridge = getNativeBridge();
    if (bridge) {
      try {
        const resStr = bridge.recordPayment(JSON.stringify(params));
        const res = JSON.parse(resStr);
        if (!res.success) return { error: res.error || 'Failed to record payment' };
        const db = this.loadDatabase();
        const created = db.payments.find((p) => p.id === res.paymentId);
        return { payment: created };
      } catch (e: any) {
        return { error: e?.message || 'Native payment recording error' };
      }
    }

    const db = this.loadDatabase();
    const sale = db.sales.find((s) => s.id === params.saleId);
    if (!sale) return { error: 'Sale record not found.' };
    if (sale.isVoided) return { error: 'Cannot record payment on a voided sale.' };

    const existingPayments = db.payments.filter((p) => p.saleId === params.saleId && !p.isVoided);
    const totalPaid = existingPayments.reduce((acc, p) => acc + p.amountCentavos, 0);
    const remainingBalance = Math.max(0, sale.grossAmountCentavos - totalPaid);

    const validationError = FinancialCalculator.validatePayment(params.amountCentavos, remainingBalance);
    if (validationError) return { error: validationError };

    const newPayment: Payment = {
      id: `pay-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      saleId: sale.id,
      buyerId: sale.buyerId,
      date: params.date,
      amountCentavos: params.amountCentavos,
      paymentMethod: params.paymentMethod,
      reference: params.reference?.trim() || undefined,
      notes: params.notes?.trim() || undefined,
      isVoided: false,
      createdAt: new Date().toISOString()
    };

    db.payments.unshift(newPayment);
    const newRemaining = remainingBalance - params.amountCentavos;

    this.addAuditLog(
      db,
      'PAYMENT',
      newPayment.id,
      'CREATE',
      `Recorded payment of ${MoneyUtils.formatPesos(params.amountCentavos)} (${params.paymentMethod}) for sale ${sale.id}. Remaining balance is ${MoneyUtils.formatPesos(newRemaining)}.`,
      { saleId: sale.id, remainingBalanceCentavos: newRemaining }
    );

    this.saveMemoryDatabase(db);
    return { payment: newPayment };
  },

  voidPayment(paymentId: string, reason: string): { success: boolean; error?: string } {
    const bridge = getNativeBridge();
    if (bridge) {
      try {
        const resStr = bridge.voidPayment(paymentId, reason);
        const res = JSON.parse(resStr);
        return res.success ? { success: true } : { success: false, error: res.error };
      } catch (e: any) {
        return { success: false, error: e?.message };
      }
    }

    const db = this.loadDatabase();
    const payment = db.payments.find((p) => p.id === paymentId);
    if (!payment) return { success: false, error: 'Payment not found.' };
    if (payment.isVoided) return { success: false, error: 'Payment is already voided.' };

    payment.isVoided = true;
    this.addAuditLog(
      db,
      'PAYMENT',
      payment.id,
      'VOID',
      `Voided payment ${payment.id} of ${MoneyUtils.formatPesos(payment.amountCentavos)}. Reason: ${reason || 'User voided'}.`
    );

    this.saveMemoryDatabase(db);
    return { success: true };
  },

  // =================== EXPENSES ===================
  getExpenses(): Expense[] {
    return this.loadDatabase().expenses;
  },

  createExpense(data: {
    date: string;
    category: string;
    amountIncurredCentavos: number;
    amountPaidCentavos: number;
    description: string;
    crop?: CropType;
    cycleId?: string;
    supplierId?: string;
    paymentMethod?: PaymentMethod;
    reference?: string;
    notes?: string;
  }): { expense?: Expense; error?: string } {
    const validationError = FinancialCalculator.validateExpense(data.amountIncurredCentavos, data.amountPaidCentavos);
    if (validationError) return { error: validationError };

    const bridge = getNativeBridge();
    if (bridge) {
      try {
        const resStr = bridge.recordExpense(JSON.stringify(data));
        const res = JSON.parse(resStr);
        if (!res.success) return { error: res.error || 'Failed to record expense' };
        const db = this.loadDatabase();
        const created = db.expenses.find((e) => e.id === res.expenseId);
        return { expense: created };
      } catch (e: any) {
        return { error: e?.message || 'Native expense recording error' };
      }
    }

    const db = this.loadDatabase();
    let supplierName: string | undefined;
    if (data.supplierId) {
      const s = db.suppliers.find((sup) => sup.id === data.supplierId);
      if (s) supplierName = s.name;
    }

    const now = new Date().toISOString();
    const newExpense: Expense = {
      ...data,
      id: `exp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      supplierNameSnapshot: supplierName,
      isVoided: false,
      createdAt: now,
      updatedAt: now
    };

    db.expenses.unshift(newExpense);

    // Initial expense payment tracking
    if (data.amountPaidCentavos > 0) {
      if (!db.expensePayments) db.expensePayments = [];
      const initPayment: ExpensePayment = {
        id: `exp-pay-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        expenseId: newExpense.id,
        supplierId: data.supplierId,
        date: data.date,
        amountCentavos: data.amountPaidCentavos,
        paymentMethod: data.paymentMethod || 'CASH',
        reference: data.reference,
        notes: data.notes,
        isVoided: false,
        createdAt: now
      };
      db.expensePayments.unshift(initPayment);
    }

    const unpaid = newExpense.amountIncurredCentavos - newExpense.amountPaidCentavos;
    this.addAuditLog(
      db,
      'EXPENSE',
      newExpense.id,
      'CREATE',
      `Recorded expense (${newExpense.category}): Incurred ${MoneyUtils.formatPesos(newExpense.amountIncurredCentavos)}, Paid ${MoneyUtils.formatPesos(newExpense.amountPaidCentavos)}, Unpaid ${MoneyUtils.formatPesos(unpaid)}`,
      { incurred: newExpense.amountIncurredCentavos, paid: newExpense.amountPaidCentavos }
    );

    this.saveMemoryDatabase(db);
    return { expense: newExpense };
  },

  recordExpensePayment(params: {
    expenseId: string;
    amountCentavos: number;
    date: string;
    paymentMethod: PaymentMethod;
    reference?: string;
    notes?: string;
  }): { payment?: ExpensePayment; error?: string } {
    const bridge = getNativeBridge();
    if (bridge) {
      try {
        const resStr = bridge.recordExpensePayment(JSON.stringify(params));
        const res = JSON.parse(resStr);
        if (!res.success) return { error: res.error || 'Failed to record expense payment' };
        const db = this.loadDatabase();
        const created = (db.expensePayments || []).find((p) => p.id === res.paymentId);
        return { payment: created };
      } catch (e: any) {
        return { error: e?.message || 'Native expense payment recording error' };
      }
    }

    const db = this.loadDatabase();
    const expense = db.expenses.find((e) => e.id === params.expenseId);
    if (!expense) return { error: 'Expense record not found.' };
    if (expense.isVoided) return { error: 'Cannot record payment on a voided expense.' };
    if (params.amountCentavos <= 0) return { error: 'Payment amount must be greater than ₱0.00.' };

    if (!db.expensePayments) db.expensePayments = [];
    const validPayments = db.expensePayments.filter((p) => p.expenseId === params.expenseId && !p.isVoided);
    const currentPaid = validPayments.reduce((acc, p) => acc + p.amountCentavos, 0);
    const remaining = expense.amountIncurredCentavos - currentPaid;

    if (params.amountCentavos > remaining) {
      return {
        error: `Payment of ${MoneyUtils.formatPesos(params.amountCentavos)} exceeds remaining expense balance of ${MoneyUtils.formatPesos(remaining)}.`
      };
    }

    const now = new Date().toISOString();
    const newPayment: ExpensePayment = {
      id: `exp-pay-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      expenseId: params.expenseId,
      supplierId: expense.supplierId,
      date: params.date,
      amountCentavos: params.amountCentavos,
      paymentMethod: params.paymentMethod,
      reference: params.reference?.trim() || undefined,
      notes: params.notes?.trim() || undefined,
      isVoided: false,
      createdAt: now
    };

    db.expensePayments.unshift(newPayment);
    // Invariant: amountPaidCentavos == SUM(valid expense payments)
    expense.amountPaidCentavos = currentPaid + params.amountCentavos;
    expense.updatedAt = now;

    this.addAuditLog(
      db,
      'EXPENSE',
      newPayment.id,
      'CREATE',
      `Recorded expense payment of ${MoneyUtils.formatPesos(params.amountCentavos)} for expense ${expense.id}`,
      { expenseId: expense.id, amount: params.amountCentavos }
    );

    this.saveMemoryDatabase(db);
    return { payment: newPayment };
  },

  voidExpensePayment(paymentId: string, reason: string): { success: boolean; error?: string } {
    const bridge = getNativeBridge();
    if (bridge) {
      try {
        const resStr = bridge.voidExpensePayment(paymentId, reason);
        const res = JSON.parse(resStr);
        return res.success ? { success: true } : { success: false, error: res.error };
      } catch (e: any) {
        return { success: false, error: e?.message };
      }
    }

    const db = this.loadDatabase();
    if (!db.expensePayments) db.expensePayments = [];
    const payment = db.expensePayments.find((p) => p.id === paymentId);
    if (!payment) return { success: false, error: 'Expense payment not found.' };
    if (payment.isVoided) return { success: false, error: 'Expense payment is already voided.' };

    const expense = db.expenses.find((e) => e.id === payment.expenseId);
    payment.isVoided = true;

    if (expense) {
      const validPayments = db.expensePayments.filter((p) => p.expenseId === expense.id && !p.isVoided);
      expense.amountPaidCentavos = validPayments.reduce((acc, p) => acc + p.amountCentavos, 0);
      expense.updatedAt = new Date().toISOString();
    }

    this.addAuditLog(
      db,
      'EXPENSE',
      payment.id,
      'VOID',
      `Voided expense payment ${payment.id} of ${MoneyUtils.formatPesos(payment.amountCentavos)}. Reason: ${reason || 'User voided'}.`
    );

    this.saveMemoryDatabase(db);
    return { success: true };
  },

  voidExpense(expenseId: string, reason: string): { success: boolean; error?: string } {
    const bridge = getNativeBridge();
    if (bridge) {
      try {
        const resStr = bridge.voidExpense(expenseId, reason);
        const res = JSON.parse(resStr);
        return res.success ? { success: true } : { success: false, error: res.error };
      } catch (e: any) {
        return { success: false, error: e?.message };
      }
    }

    const db = this.loadDatabase();
    const expense = db.expenses.find((e) => e.id === expenseId);
    if (!expense) return { success: false, error: 'Expense not found.' };
    if (expense.isVoided) return { success: false, error: 'Expense already voided.' };

    expense.isVoided = true;
    expense.updatedAt = new Date().toISOString();

    // Cascaded voiding of all associated expense payments
    if (db.expensePayments) {
      const childPayments = db.expensePayments.filter((p) => p.expenseId === expenseId && !p.isVoided);
      for (const p of childPayments) {
        p.isVoided = true;
      }
    }

    this.addAuditLog(
      db,
      'EXPENSE',
      expense.id,
      'VOID',
      `Voided expense ${expense.id} (${MoneyUtils.formatPesos(expense.amountIncurredCentavos)}). Reason: ${reason || 'User voided'}.`
    );

    this.saveMemoryDatabase(db);
    return { success: true };
  },

  // =================== BUYERS & SUPPLIERS ===================
  getBuyers(): Buyer[] {
    return this.loadDatabase().buyers;
  },

  createBuyer(data: Partial<Buyer> & { name: string }): Buyer {
    const bridge = getNativeBridge();
    if (bridge) {
      const payload = { ...data, status: 'ACTIVE' };
      const resStr = bridge.createBuyer(JSON.stringify(payload));
      const res = JSON.parse(resStr);
      if (res.success) {
        const db = this.loadDatabase();
        const created = db.buyers.find((b) => b.id === res.buyerId);
        if (created) return created;
      }
      throw new Error(res.error || 'Failed to create buyer on native database');
    }

    const db = this.loadDatabase();
    const newBuyer: Buyer = {
      ...data,
      status: 'ACTIVE',
      id: `buyer-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      createdDate: DateUtils.getTodayString()
    } as Buyer;
    db.buyers.unshift(newBuyer);
    this.addAuditLog(db, 'BUYER', newBuyer.id, 'CREATE', `Added buyer ${newBuyer.name}`);
    this.saveMemoryDatabase(db);
    return newBuyer;
  },

  updateBuyer(id: string, data: Partial<Omit<Buyer, 'id' | 'createdDate'>>): Buyer {
    const bridge = getNativeBridge();
    if (bridge) {
      const payload = { id, ...data };
      const resStr = bridge.updateBuyer(JSON.stringify(payload));
      const res = JSON.parse(resStr);
      if (res.success) {
        const db = this.loadDatabase();
        const updated = db.buyers.find((b) => b.id === id);
        if (updated) return updated;
      }
      throw new Error(res.error || 'Failed to update buyer on native database');
    }

    const db = this.loadDatabase();
    const existingIndex = db.buyers.findIndex((b) => b.id === id);
    if (existingIndex === -1) throw new Error('Buyer not found');

    const current = db.buyers[existingIndex];
    const updated: Buyer = {
      ...current,
      ...data,
      id: current.id, // Preserved
      createdDate: current.createdDate // Preserved
    };
    db.buyers[existingIndex] = updated;

    this.addAuditLog(
      db,
      'BUYER',
      id,
      'UPDATE',
      `Updated buyer details for "${updated.name}"`
    );
    this.saveMemoryDatabase(db);
    return updated;
  },

  getSuppliers(): Supplier[] {
    return this.loadDatabase().suppliers;
  },

  createSupplier(data: Partial<Supplier> & { name: string }): Supplier {
    const bridge = getNativeBridge();
    if (bridge) {
      const payload = { ...data, status: 'ACTIVE' };
      const resStr = bridge.createSupplier(JSON.stringify(payload));
      const res = JSON.parse(resStr);
      if (res.success) {
        const db = this.loadDatabase();
        const created = db.suppliers.find((s) => s.id === res.supplierId);
        if (created) return created;
      }
      throw new Error(res.error || 'Failed to create supplier on native database');
    }

    const db = this.loadDatabase();
    const newSupplier: Supplier = {
      ...data,
      status: 'ACTIVE',
      id: `supp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      createdDate: DateUtils.getTodayString()
    } as Supplier;
    db.suppliers.unshift(newSupplier);
    this.addAuditLog(db, 'SUPPLIER', newSupplier.id, 'CREATE', `Added supplier/payee ${newSupplier.name}`);
    this.saveMemoryDatabase(db);
    return newSupplier;
  },

  updateSupplier(id: string, data: Partial<Omit<Supplier, 'id' | 'createdDate'>>): Supplier {
    const bridge = getNativeBridge();
    if (bridge) {
      const payload = { id, ...data };
      const resStr = bridge.updateSupplier(JSON.stringify(payload));
      const res = JSON.parse(resStr);
      if (res.success) {
        const db = this.loadDatabase();
        const updated = db.suppliers.find((s) => s.id === id);
        if (updated) return updated;
      }
      throw new Error(res.error || 'Failed to update supplier on native database');
    }

    const db = this.loadDatabase();
    const existingIndex = db.suppliers.findIndex((s) => s.id === id);
    if (existingIndex === -1) throw new Error('Supplier not found');

    const current = db.suppliers[existingIndex];
    const updated: Supplier = {
      ...current,
      ...data,
      id: current.id, // Preserved
      createdDate: current.createdDate // Preserved
    };
    db.suppliers[existingIndex] = updated;

    this.addAuditLog(
      db,
      'SUPPLIER',
      id,
      'UPDATE',
      `Updated supplier details for "${updated.name}"`
    );
    this.saveMemoryDatabase(db);
    return updated;
  },

  getCategories(): ExpenseCategory[] {
    return this.loadDatabase().categories;
  },

  addCategory(name: string): ExpenseCategory {
    const db = this.loadDatabase();
    const newCat: ExpenseCategory = {
      id: `cat-${Date.now()}`,
      name: name.trim(),
      isDefault: false
    };
    db.categories.push(newCat);
    this.saveMemoryDatabase(db);
    return newCat;
  },

  // =================== CYCLES & HARVESTS ===================
  getCycles(): ProductionCycle[] {
    return this.loadDatabase().cycles;
  },

  createCycle(data: Partial<ProductionCycle> & { crop: any; cycleName: string; startDate: string; farmField: string; area: number; areaUnit: string }): ProductionCycle {
    const VALID_STATUSES = ['PLANNED', 'ACTIVE', 'HARVESTED', 'COMPLETED', 'CANCELLED', 'ARCHIVED'];

    const cleanCrop = data.crop?.trim();
    if (!cleanCrop) throw new Error('Crop cannot be empty');

    const cleanCycleName = data.cycleName?.trim();
    if (!cleanCycleName) throw new Error('Cycle name cannot be empty');

    const cleanStartDate = data.startDate?.trim();
    if (!cleanStartDate) throw new Error('Start date cannot be empty');

    const cleanFarmField = data.farmField?.trim();
    if (!cleanFarmField) throw new Error('Farm field cannot be empty');

    if (typeof data.area !== 'number' || isNaN(data.area) || data.area <= 0) {
      throw new Error('Area must be greater than zero');
    }

    const cleanAreaUnit = data.areaUnit?.trim();
    if (!cleanAreaUnit) throw new Error('Area unit cannot be empty');

    const cleanStatus: any = 'ACTIVE';
    if (!VALID_STATUSES.includes(cleanStatus)) {
      throw new Error(`Invalid cycle status: ${data.status}. Must be one of: ${VALID_STATUSES.join(', ')}`);
    }

    let cleanCompletionDate: string | undefined = undefined;
    if (cleanStatus === 'COMPLETED') {
      const comp = data.completionDate?.trim();
      if (!comp) {
        throw new Error('Completion date is required when cycle status is COMPLETED');
      }
      if (comp < cleanStartDate) {
        throw new Error(`Completion date (${comp}) must not be earlier than start date (${cleanStartDate})`);
      }
      cleanCompletionDate = comp;
    } else {
      // If status is not COMPLETED, completionDate is cleared/null
      cleanCompletionDate = undefined;
    }

    const db = this.loadDatabase();

    // Reject exact duplicate production cycle: crop + cycleName + farmField + area + startDate + status
    const isDuplicate = db.cycles.some((c) => {
      return (
        c.crop.trim().toLowerCase() === cleanCrop.toLowerCase() &&
        c.cycleName.trim().toLowerCase() === cleanCycleName.toLowerCase() &&
        c.farmField.trim().toLowerCase() === cleanFarmField.toLowerCase() &&
        Math.abs(c.area - data.area) < 0.0001 &&
        c.startDate.trim() === cleanStartDate &&
        c.status.trim().toUpperCase() === cleanStatus
      );
    });
    if (isDuplicate) {
      throw new Error(
        `A production cycle with identical details already exists ("${cleanCycleName}" — ${cleanCrop}, ${cleanFarmField}, ${data.area} ${cleanAreaUnit}, ${cleanStartDate}, ${cleanStatus})`
      );
    }

    const bridge = getNativeBridge();
    if (bridge) {
      const resStr = bridge.createCycle(JSON.stringify({ ...data, status: cleanStatus, completionDate: cleanCompletionDate }));
      const res = JSON.parse(resStr);
      if (res.success) {
        const reloadedDb = this.loadDatabase();
        const created = reloadedDb.cycles.find((c) => c.id === res.cycleId);
        if (created) return created;
      }
      throw new Error(res.error || 'Failed to create cycle on native database');
    }

    const now = new Date().toISOString();
    const newCycle: ProductionCycle = {
      ...data,
      crop: cleanCrop as any,
      cycleName: cleanCycleName,
      startDate: cleanStartDate,
      completionDate: cleanCompletionDate,
      farmField: cleanFarmField,
      status: cleanStatus,
      id: `cycle-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      createdAt: now,
      updatedAt: now
    };
    db.cycles.unshift(newCycle);
    this.addAuditLog(db, 'CYCLE', newCycle.id, 'CREATE', `Created production cycle "${newCycle.cycleName}" for ${newCycle.crop}`);
    this.saveMemoryDatabase(db);
    return newCycle;
  },

  updateCycle(id: string, data: Partial<Omit<ProductionCycle, 'id' | 'createdAt' | 'updatedAt'>>): ProductionCycle {
    // Authoritative validation
    const VALID_STATUSES = ['PLANNED', 'ACTIVE', 'HARVESTED', 'COMPLETED', 'CANCELLED', 'ARCHIVED'];
    const CLOSED_STATUSES = ['COMPLETED', 'CANCELLED', 'ARCHIVED'];

    const db = this.loadDatabase();
    const existingIndex = db.cycles.findIndex((c) => c.id === id);
    if (existingIndex === -1) throw new Error('Production cycle not found');

    const current = db.cycles[existingIndex];

    // Closed records are read-only: COMPLETED, CANCELLED, and ARCHIVED production cycles cannot be edited
    if (CLOSED_STATUSES.includes(current.status)) {
      throw new Error(`Cannot edit production cycle "${current.cycleName}" because it is ${current.status}. Closed cycles are read-only.`);
    }

    const crop = (data.crop !== undefined ? data.crop : current.crop)?.trim();
    if (!crop) throw new Error('Crop cannot be empty');

    const cycleName = (data.cycleName !== undefined ? data.cycleName : current.cycleName)?.trim();
    if (!cycleName) throw new Error('Cycle name cannot be empty');

    const startDate = (data.startDate !== undefined ? data.startDate : current.startDate)?.trim();
    if (!startDate) throw new Error('Start date cannot be empty');

    const farmField = (data.farmField !== undefined ? data.farmField : current.farmField)?.trim();
    if (!farmField) throw new Error('Farm field cannot be empty');

    const area = data.area !== undefined ? data.area : current.area;
    if (typeof area !== 'number' || isNaN(area) || area <= 0) {
      throw new Error('Area must be greater than zero');
    }

    const areaUnit = (data.areaUnit !== undefined ? data.areaUnit : current.areaUnit)?.trim();
    if (!areaUnit) throw new Error('Area unit cannot be empty');

    const status = (data.status !== undefined ? data.status : current.status)?.trim().toUpperCase() as any;
    if (!status || !VALID_STATUSES.includes(status)) {
      throw new Error(`Invalid cycle status: ${data.status}. Must be one of: ${VALID_STATUSES.join(', ')}`);
    }

    // Completion date handling:
    // If status is COMPLETED, require completionDate and completionDate >= startDate
    // If status changes from COMPLETED to ACTIVE, PLANNED, HARVESTED, CANCELLED, or ARCHIVED, completionDate must be cleared/null
    let cleanCompletionDate: string | undefined = undefined;
    if (status === 'COMPLETED') {
      const comp = data.completionDate !== undefined ? data.completionDate?.trim() : current.completionDate;
      if (!comp) {
        throw new Error('Completion date is required when cycle status is COMPLETED');
      }
      if (comp < startDate) {
        throw new Error(`Completion date (${comp}) must not be earlier than start date (${startDate})`);
      }
      cleanCompletionDate = comp;
    } else {
      cleanCompletionDate = undefined;
    }

    // Cycle Crop Change Protection: If cycle has harvests, crop cannot be changed
    const cycleHarvests = db.harvests.filter((h) => h.cycleId === id);
    if (cycleHarvests.length > 0 && crop.toLowerCase() !== current.crop.toLowerCase()) {
      throw new Error(`Cannot change crop from ${current.crop} to ${crop} because this cycle already has ${cycleHarvests.length} recorded harvest batch(es).`);
    }

    // Check if existing harvests conflict with new completion date
    if (status === 'COMPLETED' && cleanCompletionDate) {
      const conflictingHarvest = cycleHarvests.find((h) => h.date > cleanCompletionDate!);
      if (conflictingHarvest) {
        throw new Error(`Cannot set completion date to ${cleanCompletionDate}: harvest on ${conflictingHarvest.date} occurred after this completion date.`);
      }
    }

    const bridge = getNativeBridge();
    if (bridge) {
      const payload = { id, ...data, crop, cycleName, startDate, farmField, area, areaUnit, status, completionDate: cleanCompletionDate };
      const resStr = bridge.updateCycle(JSON.stringify(payload));
      const res = JSON.parse(resStr);
      if (res.success) {
        const reloadedDb = this.loadDatabase();
        const updated = reloadedDb.cycles.find((c) => c.id === id);
        if (updated) return updated;
      }
      throw new Error(res.error || 'Failed to update cycle on native database');
    }

    const now = new Date().toISOString();
    const updated: ProductionCycle = {
      ...current,
      ...data,
      crop: crop as any,
      cycleName,
      startDate,
      completionDate: cleanCompletionDate,
      farmField,
      area,
      areaUnit,
      status,
      id: current.id, // Preserved
      createdAt: current.createdAt, // Preserved
      updatedAt: now
    };
    db.cycles[existingIndex] = updated;

    this.addAuditLog(
      db,
      'CYCLE',
      id,
      'UPDATE',
      `Updated production cycle "${updated.cycleName}" (${updated.crop})`
    );
    this.saveMemoryDatabase(db);
    return updated;
  },

  archiveCycle(id: string): ProductionCycle {
    const db = this.loadDatabase();
    const existingIndex = db.cycles.findIndex((c) => c.id === id);
    if (existingIndex === -1) throw new Error('Production cycle not found');

    const current = db.cycles[existingIndex];
    if (current.status === 'ARCHIVED') {
      return current;
    }
    if (current.status !== 'COMPLETED' && current.status !== 'CANCELLED') {
      throw new Error(`Only COMPLETED or CANCELLED cycles can be archived. Current status is ${current.status}.`);
    }

    const now = new Date().toISOString();
    const updated: ProductionCycle = {
      ...current,
      status: 'ARCHIVED',
      updatedAt: now
    };

    const bridge = getNativeBridge();
    if (bridge) {
      const resStr = bridge.archiveCycle(id);
      const res = JSON.parse(resStr);
      if (res.success) {
        const reloadedDb = this.loadDatabase();
        const updatedFromDb = reloadedDb.cycles.find((c) => c.id === id);
        if (updatedFromDb) return updatedFromDb;
      }
      throw new Error(res.error || 'Failed to archive cycle on native database');
    }

    db.cycles[existingIndex] = updated;

    this.addAuditLog(
      db,
      'CYCLE',
      id,
      'UPDATE',
      `Archived production cycle "${updated.cycleName}"`
    );
    this.saveMemoryDatabase(db);
    return updated;
  },

  getHarvests(): Harvest[] {
    return this.loadDatabase().harvests;
  },

  createHarvest(data: Omit<Harvest, 'id' | 'createdAt'>): Harvest {
    const db = this.loadDatabase();

    const quantity = data.quantity;
    if (typeof quantity !== 'number' || isNaN(quantity) || quantity <= 0) {
      throw new Error('Harvest quantity must be greater than zero');
    }

    const cleanDate = data.date?.trim();
    if (!cleanDate) throw new Error('Harvest date cannot be empty');

    const cleanUnit = data.unit?.trim();
    if (!cleanUnit) throw new Error('Harvest unit cannot be empty');

    const referencedCycle = db.cycles.find((c) => c.id === data.cycleId);
    if (!referencedCycle) {
      throw new Error(`Referenced production cycle ${data.cycleId} does not exist`);
    }

    // Harvest Eligibility: COMPLETED, CANCELLED, and ARCHIVED cycles must not receive new harvests
    const INELIGIBLE_STATUSES = ['COMPLETED', 'CANCELLED', 'ARCHIVED'];
    if (INELIGIBLE_STATUSES.includes(referencedCycle.status)) {
      throw new Error(`Cannot log harvest for cycle "${referencedCycle.cycleName}" because its status is ${referencedCycle.status}. Only active or in-progress cycles can receive new harvests.`);
    }

    const requestedCrop = (data.crop || referencedCycle.crop)?.trim();
    if (requestedCrop.toLowerCase() !== referencedCycle.crop.toLowerCase()) {
      throw new Error(`Harvest crop (${requestedCrop}) does not match the referenced production cycle crop (${referencedCycle.crop})`);
    }

    // Harvest date must not be earlier than cycle start date
    if (cleanDate < referencedCycle.startDate) {
      throw new Error(`Harvest date (${cleanDate}) cannot be earlier than cycle start date (${referencedCycle.startDate})`);
    }

    // Duplicate Harvest check: cycleId + quantity + unit + harvestDate + gradeQuality
    const cleanGrade = (data.gradeQuality || '').trim().toLowerCase();
    const isDuplicate = db.harvests.some((h) => {
      return (
        h.cycleId === data.cycleId &&
        Math.abs(h.quantity - quantity) < 0.0001 &&
        h.unit.trim().toLowerCase() === cleanUnit.toLowerCase() &&
        h.date.trim() === cleanDate &&
        (h.gradeQuality || '').trim().toLowerCase() === cleanGrade
      );
    });
    if (isDuplicate) {
      throw new Error(
        `A duplicate harvest record already exists for this cycle (${quantity} ${cleanUnit} on ${cleanDate}${data.gradeQuality ? ` — ${data.gradeQuality}` : ''}).`
      );
    }

    const bridge = getNativeBridge();
    if (bridge) {
      const resStr = bridge.createHarvest(JSON.stringify({ ...data, crop: referencedCycle.crop, date: cleanDate, unit: cleanUnit }));
      const res = JSON.parse(resStr);
      if (res.success) {
        const reloadedDb = this.loadDatabase();
        const created = reloadedDb.harvests.find((h) => h.id === res.harvestId);
        if (created) return created;
      }
      throw new Error(res.error || 'Failed to create harvest on native database');
    }

    const newHarvest: Harvest = {
      ...data,
      crop: referencedCycle.crop,
      date: cleanDate,
      unit: cleanUnit,
      id: `harv-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date().toISOString()
    };
    db.harvests.unshift(newHarvest);
    this.addAuditLog(db, 'HARVEST', newHarvest.id, 'CREATE', `Logged harvest: ${newHarvest.quantity} ${newHarvest.unit} of ${newHarvest.crop}`);
    this.saveMemoryDatabase(db);
    return newHarvest;
  },

  updateHarvest(id: string, data: Partial<Omit<Harvest, 'id' | 'createdAt'>>): Harvest {
    const CLOSED_STATUSES = ['COMPLETED', 'CANCELLED', 'ARCHIVED'];
    const db = this.loadDatabase();
    const existingIndex = db.harvests.findIndex((h) => h.id === id);
    if (existingIndex === -1) throw new Error('Harvest not found');

    const current = db.harvests[existingIndex];

    // Closed records are read-only: Harvests belonging to closed cycles cannot be edited
    const currentCycle = db.cycles.find((c) => c.id === current.cycleId);
    if (currentCycle && CLOSED_STATUSES.includes(currentCycle.status)) {
      throw new Error(`Cannot edit harvest because its associated production cycle "${currentCycle.cycleName}" is ${currentCycle.status}. Closed cycles and their harvests are read-only.`);
    }

    const quantity = data.quantity !== undefined ? data.quantity : current.quantity;
    if (typeof quantity !== 'number' || isNaN(quantity) || quantity <= 0) {
      throw new Error('Harvest quantity must be greater than zero');
    }

    const date = (data.date !== undefined ? data.date : current.date)?.trim();
    if (!date) throw new Error('Harvest date cannot be empty');

    const unit = (data.unit !== undefined ? data.unit : current.unit)?.trim();
    if (!unit) throw new Error('Harvest unit cannot be empty');

    const targetCycleId = data.cycleId || current.cycleId;
    const referencedCycle = db.cycles.find((c) => c.id === targetCycleId);
    if (!referencedCycle) {
      throw new Error(`Referenced production cycle ${targetCycleId} does not exist`);
    }

    if (targetCycleId !== current.cycleId && CLOSED_STATUSES.includes(referencedCycle.status)) {
      throw new Error(`Cannot move harvest to cycle "${referencedCycle.cycleName}" because it is ${referencedCycle.status}.`);
    }

    const requestedCrop = (data.crop || referencedCycle.crop)?.trim();
    if (requestedCrop.toLowerCase() !== referencedCycle.crop.toLowerCase()) {
      throw new Error(`Harvest crop (${requestedCrop}) does not match the referenced production cycle crop (${referencedCycle.crop})`);
    }

    // Harvest date must not be earlier than cycle start date
    if (date < referencedCycle.startDate) {
      throw new Error(`Harvest date (${date}) cannot be earlier than cycle start date (${referencedCycle.startDate})`);
    }

    // If cycle is COMPLETED, harvest date must not be after completion date
    if (referencedCycle.status === 'COMPLETED' && referencedCycle.completionDate) {
      if (date > referencedCycle.completionDate) {
        throw new Error(`Harvest date (${date}) cannot be after cycle completion date (${referencedCycle.completionDate})`);
      }
    }

    const bridge = getNativeBridge();
    if (bridge) {
      const payload = { id, ...data, crop: referencedCycle.crop, date, quantity, unit, cycleId: targetCycleId };
      const resStr = bridge.updateHarvest(JSON.stringify(payload));
      const res = JSON.parse(resStr);
      if (res.success) {
        const reloadedDb = this.loadDatabase();
        const updated = reloadedDb.harvests.find((h) => h.id === id);
        if (updated) return updated;
      }
      throw new Error(res.error || 'Failed to update harvest on native database');
    }

    const updated: Harvest = {
      ...current,
      ...data,
      cycleId: targetCycleId,
      crop: referencedCycle.crop, // ensure exact canonical crop from referenced cycle
      date,
      quantity,
      unit,
      id: current.id, // Preserved
      createdAt: current.createdAt // Preserved
    };
    db.harvests[existingIndex] = updated;

    this.addAuditLog(
      db,
      'HARVEST',
      id,
      'UPDATE',
      `Updated harvest details: ${updated.quantity} ${updated.unit} of ${updated.crop}`
    );
    this.saveMemoryDatabase(db);
    return updated;
  },

  // =================== AUDIT LOGS ===================
  getAuditLogs(): AuditLog[] {
    return this.loadDatabase().auditLogs;
  },

  // =================== METRICS ===================
  calculateMetricsFromData(
    sales: Sale[],
    payments: Payment[],
    expenses: Expense[],
    dateFilter: DateFilterType,
    customStart?: string,
    customEnd?: string
  ): DashboardMetrics {
    const dateRange = DateUtils.getDateRange(dateFilter, customStart, customEnd);

    // Filter sales and expenses by date range
    const validSales = sales.filter(
      (s) => !s.isVoided && DateUtils.isDateInRange(s.date, dateRange)
    );
    const validExpenses = expenses.filter(
      (e) => !e.isVoided && DateUtils.isDateInRange(e.date, dateRange)
    );
    const validPayments = payments.filter(
      (p) => !p.isVoided && DateUtils.isDateInRange(p.date, dateRange)
    );

    return FinancialCalculator.calculateDashboard(validSales, validPayments, validExpenses);
  },

  calculateMetrics(dateFilter: DateFilterType, customStart?: string, customEnd?: string): DashboardMetrics {
    const db = this.loadDatabase();
    return this.calculateMetricsFromData(
      db.sales,
      db.payments,
      db.expenses,
      dateFilter,
      customStart,
      customEnd
    );
  },

  // =================== CRYPTOGRAPHIC BACKUP & RESTORE ===================
  exportNativeBackup(): Promise<{ success: boolean; message: string; cancelled?: boolean }> {
    return new Promise((resolve) => {
      const bridge = getNativeBridge();
      if (!bridge || typeof bridge.requestExportBackup !== 'function') {
        resolve({ success: false, message: 'Native backup service is not available.' });
        return;
      }

      const handler = (event: any) => {
        window.removeEventListener('farm-finance-backup-result', handler);
        resolve(event.detail || { success: false, message: 'No response received from backup service.' });
      };

      window.addEventListener('farm-finance-backup-result', handler);
      try {
        const launched = bridge.requestExportBackup();
        if (!launched) {
          window.removeEventListener('farm-finance-backup-result', handler);
          resolve({ success: false, message: 'Could not launch native document creator.' });
        }
      } catch (e: any) {
        window.removeEventListener('farm-finance-backup-result', handler);
        resolve({ success: false, message: e.message || 'Export request failed.' });
      }
    });
  },

  exportNativeCsv(dataset: string, csvContent: string): Promise<{ success: boolean; message: string; cancelled?: boolean }> {
    return new Promise((resolve) => {
      const bridge = getNativeBridge();
      if (!bridge || typeof bridge.requestExportCsv !== 'function') {
        resolve({ success: false, message: 'Native CSV export service is not available.' });
        return;
      }

      const handler = (event: any) => {
        window.removeEventListener('farm-finance-csv-result', handler);
        resolve(event.detail || { success: false, message: 'No response received from CSV export service.' });
      };

      window.addEventListener('farm-finance-csv-result', handler);
      try {
        const launched = bridge.requestExportCsv(dataset, csvContent);
        if (!launched) {
          window.removeEventListener('farm-finance-csv-result', handler);
          resolve({ success: false, message: 'Could not launch native CSV exporter.' });
        }
      } catch (e: any) {
        window.removeEventListener('farm-finance-csv-result', handler);
        resolve({ success: false, message: e.message || 'CSV export request failed.' });
      }
    });
  },

  pickNativeBackupFile(): Promise<{ success: boolean; content?: string; cancelled?: boolean; message?: string }> {
    return new Promise((resolve) => {
      const bridge = getNativeBridge();
      if (!bridge || typeof bridge.requestRestoreBackup !== 'function') {
        resolve({ success: false, message: 'Native restore service is not available.' });
        return;
      }

      const handler = (event: any) => {
        window.removeEventListener('farm-finance-restore-file-selected', handler);
        window.removeEventListener('farm-finance-restore-result', handler);
        const detail = event.detail;
        if (detail?.cancelled) {
          resolve({ success: false, cancelled: true, message: 'Restore was cancelled.' });
        } else if (detail?.success && detail?.content) {
          resolve({ success: true, content: detail.content, message: 'File selected successfully.' });
        } else {
          resolve({ success: false, message: detail?.message || 'Failed to select backup file.' });
        }
      };

      window.addEventListener('farm-finance-restore-file-selected', handler);
      window.addEventListener('farm-finance-restore-result', handler);
      try {
        const launched = bridge.requestRestoreBackup();
        if (!launched) {
          window.removeEventListener('farm-finance-restore-file-selected', handler);
          window.removeEventListener('farm-finance-restore-result', handler);
          resolve({ success: false, message: 'Could not launch native document picker.' });
        }
      } catch (e: any) {
        window.removeEventListener('farm-finance-restore-file-selected', handler);
        window.removeEventListener('farm-finance-restore-result', handler);
        resolve({ success: false, message: e.message || 'Restore request failed.' });
      }
    });
  },

  restoreNativeBackup(): Promise<{ success: boolean; message: string; cancelled?: boolean }> {
    return new Promise((resolve) => {
      const bridge = getNativeBridge();
      if (!bridge || typeof bridge.requestRestoreBackup !== 'function') {
        resolve({ success: false, message: 'Native restore service is not available.' });
        return;
      }

      const handler = (event: any) => {
        window.removeEventListener('farm-finance-restore-result', handler);
        resolve(event.detail || { success: false, message: 'No response received from restore service.' });
      };

      window.addEventListener('farm-finance-restore-result', handler);
      try {
        const launched = bridge.requestRestoreBackup();
        if (!launched) {
          window.removeEventListener('farm-finance-restore-result', handler);
          resolve({ success: false, message: 'Could not launch native document picker.' });
        }
      } catch (e: any) {
        window.removeEventListener('farm-finance-restore-result', handler);
        resolve({ success: false, message: e.message || 'Restore request failed.' });
      }
    });
  },

  exportBackupJson(): string {
    const bridge = getNativeBridge();
    if (bridge) {
      try {
        return bridge.exportBackup();
      } catch (e) {
        console.error('Bridge exportBackup error:', e);
      }
    }

    const db = this.loadDatabase();
    this.addAuditLog(db, 'BACKUP', 'EXPORT', 'BACKUP_EXPORT', 'Cryptographic SHA-256 backup exported');
    this.saveMemoryDatabase(db);

    const serializedDb = canonicalJsonStringify(db);
    const sha256Hex = computeSha256Sync(serializedDb);
    const nowIso = new Date().toISOString();

    const backupPayload: BackupPayload = {
      appName: 'Farm Finance',
      appVersion: APP_VERSION,
      backupSchemaVersion: BACKUP_SCHEMA_VERSION,
      exportedAt: nowIso,
      integrity: {
        algorithm: 'SHA-256',
        checksum: sha256Hex
      },
      database: db
    };

    return JSON.stringify(backupPayload, null, 2);
  },

  /**
   * Transactional Restore with 15-step Validation:
   * NEVER alters the active database if any validation fails.
   */
  validateAndRestoreBackup(jsonString: string): { success: boolean; message: string; preview?: any } {
    const bridge = getNativeBridge();
    if (bridge) {
      try {
        const resStr = bridge.restoreBackup(jsonString);
        const res = JSON.parse(resStr);
        if (res.success) {
          return { success: true, message: res.message, preview: res.preview };
        } else {
          return { success: false, message: res.error || 'Restore validation failed' };
        }
      } catch (e: any) {
        return { success: false, message: `Native restore error: ${e?.message}` };
      }
    }

    try {
      // 1. Read & parse JSON
      const parsed = JSON.parse(jsonString);

      // 2. Validate backup schema version
      if (parsed.backupSchemaVersion !== BACKUP_SCHEMA_VERSION) {
        return {
          success: false,
          message: `Unsupported backup schema version: ${parsed.backupSchemaVersion}. Expected: ${BACKUP_SCHEMA_VERSION}`
        };
      }

      // 3. Validate integrity checksum
      if (!parsed.integrity || parsed.integrity.algorithm !== 'SHA-256' || !parsed.integrity.checksum) {
        return { success: false, message: 'Backup file missing cryptographic SHA-256 integrity block.' };
      }

      if (!parsed.database || typeof parsed.database !== 'object') {
        return { success: false, message: 'Backup file missing database payload.' };
      }

      const dbPayload: AppDatabase = parsed.database;
      const computedHash = computeSha256Sync(canonicalJsonStringify(dbPayload));

      if (computedHash.toLowerCase() !== parsed.integrity.checksum.toLowerCase()) {
        return {
          success: false,
          message: 'Cryptographic integrity failure: SHA-256 checksum mismatch. Backup file is corrupted or modified.'
        };
      }

      // 4. Validate array structures
      if (!Array.isArray(dbPayload.buyers) || !Array.isArray(dbPayload.sales) || !Array.isArray(dbPayload.payments) || !Array.isArray(dbPayload.expenses)) {
        return { success: false, message: 'Malformed backup: buyers, sales, payments, or expenses array missing.' };
      }

      // 5. Strict ID and Foreign-Key Validation in memory
      const buyerIds = new Set<string>();
      for (const b of dbPayload.buyers) {
        if (!b.id || typeof b.id !== 'string') return { success: false, message: 'Found buyer with invalid or missing ID.' };
        if (buyerIds.has(b.id)) return { success: false, message: `Duplicate buyer ID detected: ${b.id}` };
        buyerIds.add(b.id);
      }

      const supplierIds = new Set<string>();
      if (Array.isArray(dbPayload.suppliers)) {
        for (const s of dbPayload.suppliers) {
          if (!s.id || typeof s.id !== 'string') return { success: false, message: 'Found supplier with invalid or missing ID.' };
          if (supplierIds.has(s.id)) return { success: false, message: `Duplicate supplier ID detected: ${s.id}` };
          supplierIds.add(s.id);
        }
      }

      const cycleIds = new Set<string>();
      if (Array.isArray(dbPayload.cycles)) {
        for (const c of dbPayload.cycles) {
          if (!c.id || typeof c.id !== 'string') return { success: false, message: 'Found cycle with invalid or missing ID.' };
          if (cycleIds.has(c.id)) return { success: false, message: `Duplicate cycle ID detected: ${c.id}` };
          cycleIds.add(c.id);
        }
      }

      const saleIds = new Set<string>();
      const saleGrossMap = new Map<string, number>();
      for (const s of dbPayload.sales) {
        if (!s.id || typeof s.id !== 'string') return { success: false, message: 'Found sale with invalid or missing ID.' };
        if (saleIds.has(s.id)) return { success: false, message: `Duplicate sale ID detected: ${s.id}` };
        saleIds.add(s.id);

        if (!buyerIds.has(s.buyerId)) {
          return { success: false, message: `Dangling buyer reference: sale ${s.id} references non-existent buyer ${s.buyerId}.` };
        }
        if (s.cycleId && !cycleIds.has(s.cycleId)) {
          return { success: false, message: `Dangling cycle reference: sale ${s.id} references non-existent cycle ${s.cycleId}.` };
        }
        if (s.quantity <= 0 || s.unitPriceCentavos <= 0) {
          return { success: false, message: `Invalid non-positive quantity or price in sale ${s.id}.` };
        }
        const expectedGross = FinancialCalculator.calculateGross(s.quantity, s.unitPriceCentavos);
        if (Math.abs(s.grossAmountCentavos - expectedGross) > 1) {
          return { success: false, message: `Gross amount invariant violated in sale ${s.id}: recorded ${s.grossAmountCentavos} vs calculated ${expectedGross}.` };
        }
        saleGrossMap.set(s.id, s.grossAmountCentavos);
      }

      const paymentIds = new Set<string>();
      const salePaidMap = new Map<string, number>();
      for (const p of dbPayload.payments) {
        if (!p.id || typeof p.id !== 'string') return { success: false, message: 'Found payment with invalid or missing ID.' };
        if (paymentIds.has(p.id)) return { success: false, message: `Duplicate payment ID detected: ${p.id}` };
        paymentIds.add(p.id);

        if (!saleIds.has(p.saleId)) {
          return { success: false, message: `Dangling sale reference: payment ${p.id} references non-existent sale ${p.saleId}.` };
        }
        if (p.amountCentavos <= 0) {
          return { success: false, message: `Invalid non-positive payment amount in payment ${p.id}.` };
        }
        if (!p.isVoided) {
          const currentTotal = (salePaidMap.get(p.saleId) || 0) + p.amountCentavos;
          const gross = saleGrossMap.get(p.saleId) || 0;
          if (currentTotal > gross) {
            return {
              success: false,
              message: `Overpayment detected on sale ${p.saleId}: cumulative payments (${MoneyUtils.formatPesos(currentTotal)}) exceed sale gross (${MoneyUtils.formatPesos(gross)}).`
            };
          }
          salePaidMap.set(p.saleId, currentTotal);
        }
      }

      for (const e of dbPayload.expenses) {
        if (!e.id || typeof e.id !== 'string') return { success: false, message: 'Found expense with invalid ID.' };
        if (e.amountIncurredCentavos <= 0) return { success: false, message: `Expense ${e.id} incurred amount must be > 0.` };
        if (e.amountPaidCentavos < 0 || e.amountPaidCentavos > e.amountIncurredCentavos) {
          return { success: false, message: `Expense ${e.id} amount paid must be between 0 and incurred.` };
        }
        if (e.supplierId && !supplierIds.has(e.supplierId)) {
          return { success: false, message: `Dangling supplier reference in expense ${e.id}: ${e.supplierId}.` };
        }
      }

      // 6. All 15 validations passed! Atomically commit to store
      const stagingDb: AppDatabase = {
        schemaVersion: DATABASE_SCHEMA_VERSION,
        categories: dbPayload.categories || DEFAULT_CATEGORIES.map((c, i) => ({ id: `cat-${i + 1}`, name: c, isDefault: true })),
        buyers: dbPayload.buyers,
        suppliers: dbPayload.suppliers || [],
        cycles: dbPayload.cycles || [],
        sales: dbPayload.sales,
        payments: dbPayload.payments,
        expenses: dbPayload.expenses,
        expensePayments: dbPayload.expensePayments || [],
        harvests: dbPayload.harvests || [],
        auditLogs: dbPayload.auditLogs || []
      };

      this.addAuditLog(
        stagingDb,
        'BACKUP',
        'RESTORE',
        'RESTORE',
        `Database restored from verified SHA-256 backup (${stagingDb.sales.length} sales, ${stagingDb.payments.length} payments, ${stagingDb.expenses.length} expenses)`
      );

      this.saveMemoryDatabase(stagingDb);

      return {
        success: true,
        message: `Successfully verified and restored ${stagingDb.sales.length} sales, ${stagingDb.payments.length} payments, and ${stagingDb.expenses.length} expenses.`,
        preview: {
          buyers: stagingDb.buyers.length,
          sales: stagingDb.sales.length,
          payments: stagingDb.payments.length,
          expenses: stagingDb.expenses.length
        }
      };
    } catch (e: any) {
      return { success: false, message: `Backup parse error: ${e?.message || 'Invalid JSON format'}` };
    }
  },

  // Reset to clean production state (empty database, no demo records)
  resetToCleanState(): { success: boolean; message: string } {
    removeStorageItem('farm_finance_profile');
    removeStorageItem('farm_finance_onboarding_dismissed');

    const bridge = getNativeBridge();
    if (bridge && typeof bridge.clearAllData === 'function') {
      try {
        const resStr = bridge.clearAllData();
        const resObj = JSON.parse(resStr);
        if (resObj.success) {
          const clean = this.getInitialData();
          this.saveMemoryDatabase(clean);
          return { success: true, message: resObj.message || 'All records cleared.' };
        } else {
          return { success: false, message: resObj.error || 'Failed to clear native database.' };
        }
      } catch (e: any) {
        console.error('Failed to clear native database:', e);
        return { success: false, message: e.message || 'Failed to clear native database.' };
      }
    }

    const clean = this.getInitialData();
    this.saveMemoryDatabase(clean);
    return { success: true, message: 'All records cleared. Database is now ready for a clean new user!' };
  },

  clearLocalUserData(): void {
    this.resetToCleanState();
    removeStorageItem('farm_finance_last_sync_cursor');
    if (typeof window !== 'undefined' && (window as any).FarmFinanceNative?.setSyncCursor) {
      try {
        (window as any).FarmFinanceNative.setSyncCursor(0);
      } catch (_: any) {}
    }
    try {
      if (typeof localStorage !== 'undefined') {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.startsWith('farm_finance_') || key.includes('sync'))) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach((k) => removeStorageItem(k));
      }
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem('farm_finance_preview_db');
      }
    } catch (_: any) {}
  },

  // CSV Generation for all major datasets
  generateCsv(dataset: 'sales' | 'payments' | 'expenses' | 'buyers' | 'suppliers' | 'harvests' | 'cycles'): string {
    const db = this.loadDatabase();
    let headers: string[] = [];
    let rows: string[][] = [];

    switch (dataset) {
      case 'sales':
        headers = ['ID', 'Date', 'Crop', 'Quantity', 'Unit', 'Unit Price (₱)', 'Gross Sale (₱)', 'Buyer', 'Status', 'Notes'];
        rows = db.sales.map((s) => [
          s.id,
          s.date,
          s.crop,
          s.quantity.toString(),
          s.unit,
          (s.unitPriceCentavos / 100).toFixed(2),
          (s.grossAmountCentavos / 100).toFixed(2),
          `"${s.buyerNameSnapshot.replace(/"/g, '""')}"`,
          s.isVoided ? 'VOIDED' : 'VALID',
          `"${(s.notes || '').replace(/"/g, '""')}"`
        ]);
        break;

      case 'payments':
        headers = ['ID', 'Sale ID', 'Date', 'Amount (₱)', 'Payment Method', 'Reference', 'Status', 'Notes'];
        rows = db.payments.map((p) => [
          p.id,
          p.saleId,
          p.date,
          (p.amountCentavos / 100).toFixed(2),
          p.paymentMethod,
          `"${(p.reference || '').replace(/"/g, '""')}"`,
          p.isVoided ? 'VOIDED' : 'VALID',
          `"${(p.notes || '').replace(/"/g, '""')}"`
        ]);
        break;

      case 'expenses':
        headers = ['ID', 'Date', 'Category', 'Incurred (₱)', 'Paid (₱)', 'Unpaid (₱)', 'Description', 'Crop', 'Supplier', 'Status'];
        rows = db.expenses.map((e) => [
          e.id,
          e.date,
          e.category,
          (e.amountIncurredCentavos / 100).toFixed(2),
          (e.amountPaidCentavos / 100).toFixed(2),
          ((e.amountIncurredCentavos - e.amountPaidCentavos) / 100).toFixed(2),
          `"${e.description.replace(/"/g, '""')}"`,
          e.crop || 'General',
          `"${(e.supplierNameSnapshot || '').replace(/"/g, '""')}"`,
          e.isVoided ? 'VOIDED' : 'VALID'
        ]);
        break;

      case 'buyers':
        headers = ['ID', 'Name', 'Contact', 'Address', 'Status', 'Notes'];
        rows = db.buyers.map((b) => [
          b.id,
          `"${b.name.replace(/"/g, '""')}"`,
          b.contactNumber,
          `"${b.address.replace(/"/g, '""')}"`,
          b.status,
          `"${(b.notes || '').replace(/"/g, '""')}"`
        ]);
        break;

      case 'suppliers':
        headers = ['ID', 'Name', 'Contact', 'Address', 'Status', 'Notes'];
        rows = db.suppliers.map((s) => [
          s.id,
          `"${s.name.replace(/"/g, '""')}"`,
          s.contactNumber,
          `"${s.address.replace(/"/g, '""')}"`,
          s.status,
          `"${(s.notes || '').replace(/"/g, '""')}"`
        ]);
        break;

      case 'harvests':
        headers = ['ID', 'Date', 'Crop', 'Quantity', 'Unit', 'Quality Grade', 'Cycle ID', 'Notes'];
        rows = db.harvests.map((h) => [
          h.id,
          h.date,
          h.crop,
          h.quantity.toString(),
          h.unit,
          h.gradeQuality || 'N/A',
          h.cycleId,
          `"${(h.notes || '').replace(/"/g, '""')}"`
        ]);
        break;

      case 'cycles':
        headers = ['ID', 'Cycle Name', 'Crop', 'Start Date', 'Farm/Field', 'Area', 'Status', 'Notes'];
        rows = db.cycles.map((c) => [
          c.id,
          `"${c.cycleName.replace(/"/g, '""')}"`,
          c.crop,
          c.startDate,
          c.farmField,
          `${c.area} ${c.areaUnit}`,
          c.status,
          `"${(c.notes || '').replace(/"/g, '""')}"`
        ]);
        break;
    }

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }
};
