import { Buyer, Supplier, Sale, Payment, Expense, ExpensePayment, ProductionCycle, Harvest, AuditLog } from './index';

export type SyncState = 'SYNCED' | 'PENDING_UPLOAD' | 'CONFLICT';

export interface SyncMetadata {
  sync_state?: SyncState;
  record_sync_version?: number;
  last_synced_at?: number;
}

export type SyncEntityType =
  | 'buyers'
  | 'suppliers'
  | 'sales'
  | 'payments'
  | 'expenses'
  | 'expense_payments'
  | 'production_cycles'
  | 'harvests'
  | 'audit_logs';

export type SyncOperation = 'UPSERT' | 'VOID';

export interface SyncChangeItem {
  entityType: SyncEntityType;
  entityId: string;
  operation: SyncOperation;
  baseVersion: number;
  payload: any;
}

export interface SyncPushRequest {
  userId: string;
  changes: SyncChangeItem[];
}

export interface SyncPushResultItem {
  entityType: SyncEntityType;
  entityId: string;
  status: 'APPLIED' | 'CONFLICT' | 'REJECTED';
  newVersion?: number;
  newCursor?: number;
  lastSyncedAt?: number;
  serverVersion?: number;
  serverRecord?: any;
  reason?: string;
}

export interface SyncPushResponse {
  results: SyncPushResultItem[];
  currentServerCursor: number;
}

export interface SyncPullRequest {
  userId: string;
  sinceCursor: number;
}

export interface SyncChangeLogEntry {
  cursor: number;
  entityType: SyncEntityType;
  entityId: string;
  operation: SyncOperation;
  record: any;
  timestamp: number;
}

export interface FullSyncDataset {
  buyers: (Buyer & SyncMetadata)[];
  suppliers: (Supplier & SyncMetadata)[];
  sales: (Sale & SyncMetadata)[];
  payments: (Payment & SyncMetadata)[];
  expenses: (Expense & SyncMetadata)[];
  expense_payments: (ExpensePayment & SyncMetadata)[];
  production_cycles: (ProductionCycle & SyncMetadata)[];
  harvests: (Harvest & SyncMetadata)[];
  audit_logs: (AuditLog & SyncMetadata)[];
}

export interface SyncPullResponse {
  currentServerCursor: number;
  isBootstrap: boolean;
  dataset?: FullSyncDataset;
  changes?: SyncChangeLogEntry[];
}
