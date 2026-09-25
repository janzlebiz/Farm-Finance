import {
  Buyer,
  Supplier,
  Sale,
  Payment,
  Expense,
  ExpenseCategory,
  ProductionCycle,
  Harvest,
  AuditLog,
  CropType,
  PaymentMethod,
  DashboardMetrics,
  DateFilterType
} from '../types';
import { MoneyUtils } from '../utils/money';
import { DateUtils } from '../utils/date';

export const APP_VERSION = '1.0.0';
export const SCHEMA_VERSION = 2; // Versioned schema

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

interface AppDatabase {
  schemaVersion: number;
  buyers: Buyer[];
  suppliers: Supplier[];
  sales: Sale[];
  payments: Payment[];
  expenses: Expense[];
  categories: ExpenseCategory[];
  cycles: ProductionCycle[];
  harvests: Harvest[];
  auditLogs: AuditLog[];
}

const STORAGE_KEY = 'farm_finance_db_v3';

export const StorageService = {
  getInitialData(): AppDatabase {
    const categories: ExpenseCategory[] = DEFAULT_CATEGORIES.map((cat, idx) => ({
      id: `cat-${idx + 1}`,
      name: cat,
      isDefault: true
    }));

    return {
      schemaVersion: SCHEMA_VERSION,
      categories,
      buyers: [],
      suppliers: [],
      cycles: [],
      sales: [],
      payments: [],
      expenses: [],
      harvests: [],
      auditLogs: [
        {
          id: 'audit-init',
          timestamp: new Date().toISOString(),
          entityType: 'BACKUP',
          entityId: 'SYSTEM',
          eventType: 'CREATE',
          summary: 'New farm financial database initialized for user',
          appVersion: APP_VERSION
        }
      ]
    };
  },

  getSampleAcceptanceData(): AppDatabase {
    const today = DateUtils.getTodayString();
    const categories: ExpenseCategory[] = DEFAULT_CATEGORIES.map((cat, idx) => ({
      id: `cat-${idx + 1}`,
      name: cat,
      isDefault: true
    }));

    return {
      schemaVersion: SCHEMA_VERSION,
      categories,
      buyers: [
        {
          id: 'buyer-1',
          name: 'Test Rice Buyer',
          contactNumber: '+63 917 123 4567',
          address: 'Poblacion Market, San Jose',
          notes: 'Regular miller buyer for palay/rice grain',
          createdDate: today,
          status: 'ACTIVE'
        },
        {
          id: 'buyer-2',
          name: 'Test Copra Buyer',
          contactNumber: '+63 928 987 6543',
          address: 'Port Area Oil Mill Depot',
          notes: 'Commercial copra buying station',
          createdDate: today,
          status: 'ACTIVE'
        }
      ],
      suppliers: [
        {
          id: 'supp-1',
          name: 'AgriSupply Central',
          contactNumber: '+63 919 555 1212',
          address: 'Highway Corner, District 2',
          notes: 'Certified rice seed & fertilizer dealer',
          createdDate: today,
          status: 'ACTIVE'
        },
        {
          id: 'supp-2',
          name: 'Barangay Labor Association',
          contactNumber: '+63 920 444 8888',
          address: 'Sitio Riverside',
          notes: 'Farm laborers and harvesters crew',
          createdDate: today,
          status: 'ACTIVE'
        }
      ],
      cycles: [
        {
          id: 'cycle-1',
          crop: 'Rice',
          cycleName: 'Rice — Wet Season 2026',
          startDate: `${today.substring(0, 7)}-01`,
          expectedHarvestDate: `${today.substring(0, 4)}-11-15`,
          farmField: 'North Paddy Parcel A',
          area: 2.5,
          areaUnit: 'hectares',
          status: 'ACTIVE',
          notes: 'Certified RC-222 high yield seed planted',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'cycle-2',
          crop: 'Copra',
          cycleName: 'Copra — Production Cycle 2026',
          startDate: `${today.substring(0, 4)}-01-10`,
          farmField: 'Hillside Coconut Plantation',
          area: 4.0,
          areaUnit: 'hectares',
          status: 'ACTIVE',
          notes: 'Bimonthly nut collection and tapahan drying',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ],
      sales: [
        // Acceptance test requirement 1: Rice 1,000 kg @ ₱32/kg = ₱32,000
        {
          id: 'sale-rice-acceptance',
          date: today,
          crop: 'Rice',
          quantity: 1000,
          unit: 'kg',
          unitPriceCentavos: 3200, // ₱32.00
          grossAmountCentavos: 3200000, // ₱32,000.00
          buyerId: 'buyer-1',
          buyerNameSnapshot: 'Test Rice Buyer',
          notes: 'Wet palay sale after harvest drying',
          cycleId: 'cycle-1',
          isVoided: false,
          createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
          updatedAt: new Date(Date.now() - 3600000 * 5).toISOString()
        },
        // Acceptance test requirement 2: Copra 850 kg @ ₱42/kg = ₱35,700
        {
          id: 'sale-copra-acceptance',
          date: today,
          crop: 'Copra',
          quantity: 850,
          unit: 'kg',
          unitPriceCentavos: 4200, // ₱42.00
          grossAmountCentavos: 3570000, // ₱35,700.00
          buyerId: 'buyer-2',
          buyerNameSnapshot: 'Test Copra Buyer',
          notes: 'Grade A smoked copra delivery',
          cycleId: 'cycle-2',
          isVoided: false,
          createdAt: new Date(Date.now() - 3600000 * 4).toISOString(),
          updatedAt: new Date(Date.now() - 3600000 * 4).toISOString()
        }
      ],
      payments: [
        // Acceptance test requirement 3: Payment 1 = ₱20,000, Payment 2 = ₱10,000 against Rice sale
        {
          id: 'pay-1',
          saleId: 'sale-rice-acceptance',
          buyerId: 'buyer-1',
          date: today,
          amountCentavos: 2000000, // ₱20,000.00
          paymentMethod: 'CASH',
          reference: 'OR-9901',
          notes: 'Down payment upon weighing',
          isVoided: false,
          createdAt: new Date(Date.now() - 3600000 * 3).toISOString()
        },
        {
          id: 'pay-2',
          saleId: 'sale-rice-acceptance',
          buyerId: 'buyer-1',
          date: today,
          amountCentavos: 1000000, // ₱10,000.00
          paymentMethod: 'GCASH',
          reference: 'GC-10293847',
          notes: 'Second installment',
          isVoided: false,
          createdAt: new Date(Date.now() - 3600000 * 2).toISOString()
        }
      ],
      expenses: [
        // Acceptance test requirement 4: Rice expense: Incurred ₱350, Paid ₱100, Unpaid ₱250
        {
          id: 'exp-rice-acceptance',
          date: today,
          category: 'Labor & Harvesting Wages',
          amountIncurredCentavos: 35000, // ₱350.00
          amountPaidCentavos: 10000, // ₱100.00
          description: 'Hauling sacks from paddy to drying pavement',
          crop: 'Rice',
          cycleId: 'cycle-1',
          supplierId: 'supp-2',
          supplierNameSnapshot: 'Barangay Labor Association',
          paymentMethod: 'CASH',
          reference: 'VOUCHER-01',
          notes: 'Partial payment made, balance ₱250 payable next week',
          isVoided: false,
          createdAt: new Date(Date.now() - 3600000 * 1).toISOString(),
          updatedAt: new Date(Date.now() - 3600000 * 1).toISOString()
        }
      ],
      harvests: [
        {
          id: 'harv-1',
          cycleId: 'cycle-1',
          crop: 'Rice',
          date: today,
          quantity: 1200,
          unit: 'kg',
          gradeQuality: 'Standard Palay Grade 1',
          sellingPriceCentavos: 3200,
          buyerId: 'buyer-1',
          notes: 'Total yield from Parcel A',
          createdAt: new Date(Date.now() - 3600000 * 6).toISOString()
        },
        {
          id: 'harv-2',
          cycleId: 'cycle-2',
          crop: 'Copra',
          date: today,
          quantity: 850,
          unit: 'kg',
          gradeQuality: 'Smoked Grade A',
          sellingPriceCentavos: 4200,
          buyerId: 'buyer-2',
          notes: 'Tapahan kiln dried yield',
          createdAt: new Date(Date.now() - 3600000 * 5).toISOString()
        }
      ],
      auditLogs: [
        {
          id: 'audit-init-sample',
          timestamp: new Date().toISOString(),
          entityType: 'BACKUP',
          entityId: 'SYSTEM',
          eventType: 'CREATE',
          summary: 'Database initialized with standard schema and acceptance baseline records',
          appVersion: APP_VERSION
        }
      ]
    };
  },

  loadDatabase(): AppDatabase {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        const initial = this.getInitialData();
        this.saveDatabase(initial);
        return initial;
      }
      const parsed: AppDatabase = JSON.parse(raw);
      // Migration check
      if (!parsed.schemaVersion || parsed.schemaVersion < SCHEMA_VERSION) {
        return this.migrateDatabase(parsed);
      }
      return parsed;
    } catch (e) {
      console.error('Failed to load database, falling back to defaults:', e);
      return this.getInitialData();
    }
  },

  migrateDatabase(oldData: any): AppDatabase {
    console.log(`Migrating database from version ${oldData.schemaVersion || 1} to ${SCHEMA_VERSION}`);
    const updated: AppDatabase = {
      ...this.getInitialData(),
      ...oldData,
      schemaVersion: SCHEMA_VERSION
    };
    // Ensure audit trail exists
    if (!updated.auditLogs) updated.auditLogs = [];
    updated.auditLogs.push({
      id: `audit-mig-${Date.now()}`,
      timestamp: new Date().toISOString(),
      entityType: 'BACKUP',
      entityId: 'SCHEMA',
      eventType: 'UPDATE',
      summary: `Automated migration applied to schema version ${SCHEMA_VERSION}`,
      metadata: { fromVersion: oldData.schemaVersion || 1, toVersion: SCHEMA_VERSION },
      appVersion: APP_VERSION
    });
    this.saveDatabase(updated);
    return updated;
  },

  saveDatabase(db: AppDatabase): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    } catch (e) {
      console.error('Failed to save database to localStorage:', e);
    }
  },

  // Log an append-only audit record
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
    db.auditLogs.unshift(log); // newest first
  },

  // =================== SALES ===================
  getSales(): Sale[] {
    const db = this.loadDatabase();
    return db.sales;
  },

  createSale(
    data: Omit<Sale, 'id' | 'grossAmountCentavos' | 'buyerNameSnapshot' | 'isVoided' | 'createdAt' | 'updatedAt'>
  ): { sale?: Sale; error?: string } {
    if (data.quantity <= 0) return { error: 'Quantity must be greater than zero.' };
    if (data.unitPriceCentavos <= 0) return { error: 'Unit price must be greater than zero.' };

    const db = this.loadDatabase();
    const buyer = db.buyers.find((b) => b.id === data.buyerId);
    if (!buyer) return { error: 'Selected buyer not found.' };

    const gross = MoneyUtils.calculateGross(data.quantity, data.unitPriceCentavos);
    const now = new Date().toISOString();

    const newSale: Sale = {
      ...data,
      id: `sale-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      grossAmountCentavos: gross,
      buyerNameSnapshot: buyer.name, // Snapshot prevents silent alteration
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

    this.saveDatabase(db);
    return { sale: newSale };
  },

  voidSale(saleId: string, reason: string): { success: boolean; error?: string } {
    const db = this.loadDatabase();
    const sale = db.sales.find((s) => s.id === saleId);
    if (!sale) return { success: false, error: 'Sale not found.' };
    if (sale.isVoided) return { success: false, error: 'Sale is already voided.' };

    // Void associated payments
    const associatedPayments = db.payments.filter((p) => p.saleId === saleId && !p.isVoided);
    for (const p of associatedPayments) {
      p.isVoided = true;
    }

    sale.isVoided = true;
    sale.updatedAt = new Date().toISOString();

    this.addAuditLog(
      db,
      'SALE',
      sale.id,
      'VOID',
      `Voided sale ${sale.id} (${MoneyUtils.formatPesos(sale.grossAmountCentavos)}). Reason: ${reason || 'User voided'}. ${associatedPayments.length} associated payments also voided.`
    );

    this.saveDatabase(db);
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
    if (sale.isVoided) {
      return { totalPaidCentavos: 0, remainingBalanceCentavos: 0, status: 'VOIDED' };
    }
    const payments = paymentsList || this.getPaymentsForSale(sale.id);
    const totalPaid = payments
      .filter((p) => !p.isVoided)
      .reduce((sum, p) => sum + p.amountCentavos, 0);

    const remaining = MoneyUtils.calculateOutstanding(sale.grossAmountCentavos, totalPaid);

    let status: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' = 'UNPAID';
    if (totalPaid === 0) {
      status = 'UNPAID';
    } else if (remaining === 0) {
      status = 'PAID';
    } else {
      status = 'PARTIALLY_PAID';
    }

    return {
      totalPaidCentavos: totalPaid,
      remainingBalanceCentavos: remaining,
      status
    };
  },

  recordPayment(params: {
    saleId: string;
    amountCentavos: number;
    date: string;
    paymentMethod: PaymentMethod;
    reference?: string;
    notes?: string;
  }): { payment?: Payment; error?: string } {
    const db = this.loadDatabase();
    const sale = db.sales.find((s) => s.id === params.saleId);
    if (!sale) return { error: 'Sale record not found.' };
    if (sale.isVoided) return { error: 'Cannot record payment on a voided sale.' };

    // Calculate current balance
    const existingPayments = db.payments.filter((p) => p.saleId === params.saleId && !p.isVoided);
    const totalPaid = existingPayments.reduce((acc, p) => acc + p.amountCentavos, 0);
    const remainingBalance = sale.grossAmountCentavos - totalPaid;

    // Reject <= 0 or overpayment
    const validationError = MoneyUtils.validatePayment(params.amountCentavos, remainingBalance);
    if (validationError) {
      return { error: validationError };
    }

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

    this.saveDatabase(db);
    return { payment: newPayment };
  },

  voidPayment(paymentId: string, reason: string): { success: boolean; error?: string } {
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

    this.saveDatabase(db);
    return { success: true };
  },

  // =================== EXPENSES ===================
  getExpenses(): Expense[] {
    const db = this.loadDatabase();
    return db.expenses;
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
    const validationError = MoneyUtils.validateExpense(data.amountIncurredCentavos, data.amountPaidCentavos);
    if (validationError) return { error: validationError };

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
    const unpaid = newExpense.amountIncurredCentavos - newExpense.amountPaidCentavos;
    this.addAuditLog(
      db,
      'EXPENSE',
      newExpense.id,
      'CREATE',
      `Recorded expense (${newExpense.category}): Incurred ${MoneyUtils.formatPesos(newExpense.amountIncurredCentavos)}, Paid ${MoneyUtils.formatPesos(newExpense.amountPaidCentavos)}, Unpaid ${MoneyUtils.formatPesos(unpaid)}`,
      { incurred: newExpense.amountIncurredCentavos, paid: newExpense.amountPaidCentavos }
    );

    this.saveDatabase(db);
    return { expense: newExpense };
  },

  voidExpense(expenseId: string, reason: string): { success: boolean; error?: string } {
    const db = this.loadDatabase();
    const expense = db.expenses.find((e) => e.id === expenseId);
    if (!expense) return { success: false, error: 'Expense not found.' };
    if (expense.isVoided) return { success: false, error: 'Expense already voided.' };

    expense.isVoided = true;
    expense.updatedAt = new Date().toISOString();

    this.addAuditLog(
      db,
      'EXPENSE',
      expense.id,
      'VOID',
      `Voided expense ${expense.id} (${MoneyUtils.formatPesos(expense.amountIncurredCentavos)}). Reason: ${reason || 'User voided'}.`
    );

    this.saveDatabase(db);
    return { success: true };
  },

  // =================== BUYERS & SUPPLIERS ===================
  getBuyers(): Buyer[] {
    return this.loadDatabase().buyers;
  },

  createBuyer(data: Omit<Buyer, 'id' | 'createdDate'>): Buyer {
    const db = this.loadDatabase();
    const newBuyer: Buyer = {
      ...data,
      id: `buyer-${Date.now()}`,
      createdDate: DateUtils.getTodayString()
    };
    db.buyers.unshift(newBuyer);
    this.addAuditLog(db, 'BUYER', newBuyer.id, 'CREATE', `Added buyer ${newBuyer.name}`);
    this.saveDatabase(db);
    return newBuyer;
  },

  getSuppliers(): Supplier[] {
    return this.loadDatabase().suppliers;
  },

  createSupplier(data: Omit<Supplier, 'id' | 'createdDate'>): Supplier {
    const db = this.loadDatabase();
    const newSupplier: Supplier = {
      ...data,
      id: `supp-${Date.now()}`,
      createdDate: DateUtils.getTodayString()
    };
    db.suppliers.unshift(newSupplier);
    this.addAuditLog(db, 'SUPPLIER', newSupplier.id, 'CREATE', `Added supplier/payee ${newSupplier.name}`);
    this.saveDatabase(db);
    return newSupplier;
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
    this.saveDatabase(db);
    return newCat;
  },

  // =================== PRODUCTION CYCLES & HARVESTS ===================
  getCycles(): ProductionCycle[] {
    return this.loadDatabase().cycles;
  },

  createCycle(data: Omit<ProductionCycle, 'id' | 'createdAt' | 'updatedAt'>): ProductionCycle {
    const db = this.loadDatabase();
    const now = new Date().toISOString();
    const newCycle: ProductionCycle = {
      ...data,
      id: `cycle-${Date.now()}`,
      createdAt: now,
      updatedAt: now
    };
    db.cycles.unshift(newCycle);
    this.addAuditLog(db, 'CYCLE', newCycle.id, 'CREATE', `Created production cycle "${newCycle.cycleName}" for ${newCycle.crop}`);
    this.saveDatabase(db);
    return newCycle;
  },

  getHarvests(): Harvest[] {
    return this.loadDatabase().harvests;
  },

  createHarvest(data: Omit<Harvest, 'id' | 'createdAt'>): Harvest {
    const db = this.loadDatabase();
    const newHarvest: Harvest = {
      ...data,
      id: `harv-${Date.now()}`,
      createdAt: new Date().toISOString()
    };
    db.harvests.unshift(newHarvest);
    this.addAuditLog(db, 'HARVEST', newHarvest.id, 'CREATE', `Logged harvest: ${newHarvest.quantity} ${newHarvest.unit} of ${newHarvest.crop}`);
    this.saveDatabase(db);
    return newHarvest;
  },

  // =================== AUDIT LOGS ===================
  getAuditLogs(): AuditLog[] {
    return this.loadDatabase().auditLogs;
  },

  // =================== DASHBOARD & FINANCIAL METRICS ===================
  calculateMetrics(dateFilter: DateFilterType, customStart?: string, customEnd?: string): DashboardMetrics {
    const db = this.loadDatabase();
    const dateRange = DateUtils.getDateRange(dateFilter, customStart, customEnd);

    // 1. Sales within range (valid non-voided)
    const validSales = db.sales.filter(
      (s) => !s.isVoided && DateUtils.isDateInRange(s.date, dateRange)
    );
    const totalRevenueCentavos = validSales.reduce((acc, s) => acc + s.grossAmountCentavos, 0);

    // 2. Expenses within range (valid non-voided)
    const validExpenses = db.expenses.filter(
      (e) => !e.isVoided && DateUtils.isDateInRange(e.date, dateRange)
    );
    const totalExpensesCentavos = validExpenses.reduce((acc, e) => acc + e.amountIncurredCentavos, 0);
    const cashPaidCentavos = validExpenses.reduce((acc, e) => acc + e.amountPaidCentavos, 0);

    // 3. Payments within range (valid non-voided)
    const validPayments = db.payments.filter(
      (p) => !p.isVoided && DateUtils.isDateInRange(p.date, dateRange)
    );
    const cashReceivedCentavos = validPayments.reduce((acc, p) => acc + p.amountCentavos, 0);

    // Net income = Revenue - Expenses
    const netIncomeCentavos = totalRevenueCentavos - totalExpensesCentavos;

    // 4. Receivables across all active valid sales (lifetime outstanding uncollected)
    // Note: Receivables balance is calculated by subtracting all lifetime valid payments for each active sale
    const allValidSales = db.sales.filter((s) => !s.isVoided);
    const allValidPayments = db.payments.filter((p) => !p.isVoided);

    const outstandingReceivablesCentavos = allValidSales.reduce((acc, sale) => {
      const salePaid = allValidPayments
        .filter((p) => p.saleId === sale.id)
        .reduce((sum, p) => sum + p.amountCentavos, 0);
      const balance = MoneyUtils.calculateOutstanding(sale.grossAmountCentavos, salePaid);
      return acc + balance;
    }, 0);

    // Crop Profitability
    const riceSales = validSales.filter((s) => s.crop === 'Rice');
    const riceRev = riceSales.reduce((sum, s) => sum + s.grossAmountCentavos, 0);
    const riceExp = validExpenses
      .filter((e) => e.crop === 'Rice')
      .reduce((sum, e) => sum + e.amountIncurredCentavos, 0);
    const riceProfitabilityCentavos = riceRev - riceExp;

    const copraSales = validSales.filter((s) => s.crop === 'Copra');
    const copraRev = copraSales.reduce((sum, s) => sum + s.grossAmountCentavos, 0);
    const copraExp = validExpenses
      .filter((e) => e.crop === 'Copra')
      .reduce((sum, e) => sum + e.amountIncurredCentavos, 0);
    const copraProfitabilityCentavos = copraRev - copraExp;

    return {
      totalRevenueCentavos,
      totalExpensesCentavos,
      netIncomeCentavos,
      cashReceivedCentavos,
      cashPaidCentavos,
      outstandingReceivablesCentavos,
      salesCount: validSales.length,
      expensesCount: validExpenses.length,
      riceProfitabilityCentavos,
      copraProfitabilityCentavos
    };
  },

  // =================== BACKUP, RESTORE & EXPORT ===================
  exportBackupJson(): string {
    const db = this.loadDatabase();
    const serialized = JSON.stringify(db, null, 2);

    // Record audit event
    this.addAuditLog(db, 'BACKUP', 'EXPORT', 'BACKUP_EXPORT', 'Full database backup JSON created');
    this.saveDatabase(db);

    return JSON.stringify({
      appName: 'Farm Finance',
      appVersion: APP_VERSION,
      schemaVersion: db.schemaVersion,
      exportedAt: new Date().toISOString(),
      checksum: this.calculateSimpleHash(serialized),
      database: db
    }, null, 2);
  },

  validateAndRestoreBackup(jsonString: string): { success: boolean; message: string; preview?: any } {
    try {
      const parsed = JSON.parse(jsonString);
      if (!parsed.database || typeof parsed.database !== 'object') {
        return { success: false, message: 'Invalid backup file: missing database payload.' };
      }
      const db: AppDatabase = parsed.database;
      if (!Array.isArray(db.sales) || !Array.isArray(db.payments) || !Array.isArray(db.expenses)) {
        return { success: false, message: 'Invalid backup structure: sales, payments, or expenses missing.' };
      }

      // Check schema version compatibility
      if (db.schemaVersion > SCHEMA_VERSION) {
        return {
          success: false,
          message: `Backup schema version (${db.schemaVersion}) is newer than this app (${SCHEMA_VERSION}). Please upgrade the app first.`
        };
      }

      // Restore
      db.schemaVersion = SCHEMA_VERSION;
      if (!db.auditLogs) db.auditLogs = [];
      this.addAuditLog(
        db,
        'BACKUP',
        'RESTORE',
        'RESTORE',
        `Database restored from backup dated ${parsed.exportedAt || 'Unknown'}`
      );

      this.saveDatabase(db);
      return {
        success: true,
        message: `Successfully restored ${db.sales.length} sales, ${db.payments.length} payments, and ${db.expenses.length} expenses.`,
        preview: {
          sales: db.sales.length,
          payments: db.payments.length,
          expenses: db.expenses.length,
          buyers: db.buyers.length
        }
      };
    } catch (e: any) {
      return { success: false, message: `Parse error: ${e?.message || 'Invalid JSON file'}` };
    }
  },

  resetToDefaultAcceptanceData(): void {
    const sample = this.getSampleAcceptanceData();
    this.saveDatabase(sample);
  },

  resetToCleanState(): void {
    const clean = this.getInitialData();
    this.saveDatabase(clean);
  },

  calculateSimpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0; // Convert to 32bit integer
    }
    return `chk-${Math.abs(hash).toString(16)}`;
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
