export type CropType = 'Rice' | 'Copra' | string;

export type PaymentStatus = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'VOIDED';

export type PaymentMethod = 'CASH' | 'GCASH' | 'BANK_TRANSFER' | 'CHECK' | 'OTHER';

export type CycleStatus = 'PLANNED' | 'ACTIVE' | 'HARVESTED' | 'COMPLETED' | 'CANCELLED';

export interface Buyer {
  id: string;
  name: string;
  contactNumber: string;
  address: string;
  notes: string;
  createdDate: string; // ISO date YYYY-MM-DD
  status: 'ACTIVE' | 'INACTIVE';
}

export interface Supplier {
  id: string;
  name: string;
  contactNumber: string;
  address: string;
  notes: string;
  createdDate: string;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface Sale {
  id: string;
  date: string; // YYYY-MM-DD
  crop: CropType;
  quantity: number; // e.g., 1000
  unit: string; // kg, sack, etc.
  unitPriceCentavos: number; // integer centavos (₱32.00 = 3200)
  grossAmountCentavos: number; // exact integer centavos (quantity * unitPriceCentavos)
  buyerId: string;
  buyerNameSnapshot: string; // Immutable snapshot of buyer name at time of sale
  notes?: string;
  cycleId?: string; // Optional link to production cycle
  harvestId?: string; // Optional link to harvest
  isVoided: boolean;
  createdAt: string; // ISO timestamp
  updatedAt: string;
}

export interface Payment {
  id: string;
  saleId: string;
  buyerId: string;
  date: string; // YYYY-MM-DD
  amountCentavos: number; // integer centavos
  paymentMethod: PaymentMethod;
  reference?: string;
  notes?: string;
  isVoided: boolean;
  createdAt: string;
}

export interface ExpenseCategory {
  id: string;
  name: string;
  isDefault: boolean;
}

export interface Expense {
  id: string;
  date: string; // YYYY-MM-DD
  category: string;
  amountIncurredCentavos: number; // integer centavos
  amountPaidCentavos: number; // integer centavos (0 <= amountPaid <= amountIncurred)
  description: string;
  crop?: CropType; // Optional crop tagging
  cycleId?: string; // Optional production cycle tagging
  supplierId?: string;
  supplierNameSnapshot?: string;
  paymentMethod?: PaymentMethod;
  reference?: string;
  notes?: string;
  isVoided: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ExpensePayment {
  id: string;
  expenseId: string;
  supplierId?: string;
  date: string; // YYYY-MM-DD
  amountCentavos: number; // integer centavos
  paymentMethod: PaymentMethod;
  reference?: string;
  notes?: string;
  isVoided: boolean;
  createdAt: string;
}

export interface ProductionCycle {
  id: string;
  crop: CropType;
  cycleName: string; // e.g. "Rice — Wet Season 2026"
  startDate: string;
  expectedHarvestDate?: string;
  actualHarvestDate?: string;
  farmField: string;
  area: number;
  areaUnit: string; // hectares, sq m
  status: CycleStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Harvest {
  id: string;
  cycleId: string;
  crop: CropType;
  date: string;
  quantity: number;
  unit: string;
  gradeQuality?: string;
  sellingPriceCentavos?: number; // estimated or actual
  buyerId?: string;
  notes?: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  entityType: 'SALE' | 'PAYMENT' | 'EXPENSE' | 'BUYER' | 'SUPPLIER' | 'CYCLE' | 'HARVEST' | 'BACKUP';
  entityId: string;
  eventType: 'CREATE' | 'UPDATE' | 'VOID' | 'RESTORE' | 'BACKUP_EXPORT';
  summary: string;
  metadata?: Record<string, any>;
  appVersion: string;
}

export interface FarmProfile {
  ownerName: string;
  farmName: string;
  location?: string;
  primaryCrop?: string;
  completedAt?: string;
}

export type DateFilterType = 'today' | 'week' | 'month' | 'year' | 'custom' | 'all';

export interface DateFilterRange {
  type: DateFilterType;
  startDate?: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
}

export interface DashboardMetrics {
  totalRevenueCentavos: number;
  totalExpensesCentavos: number;
  netIncomeCentavos: number;
  cashReceivedCentavos: number;
  cashPaidCentavos: number;
  outstandingReceivablesCentavos: number;
  salesCount: number;
  expensesCount: number;
  riceProfitabilityCentavos: number;
  copraProfitabilityCentavos: number;
}
