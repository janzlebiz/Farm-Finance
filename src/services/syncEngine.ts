import {
  SyncChangeItem,
  SyncEntityType,
  SyncPushRequest,
  SyncPullRequest,
  SyncPushResponse,
  SyncPullResponse
} from '../types/sync';
import { StorageService } from './storage';
import { SyncClient } from './syncClient';

const SYNC_CURSOR_STORAGE_KEY = 'farm_finance_last_sync_cursor';

export type SyncDispatcher = {
  push: (req: SyncPushRequest) => Promise<SyncPushResponse>;
  pull: (req: SyncPullRequest) => Promise<SyncPullResponse>;
};

export class SyncEngine {
  private static dispatcher: SyncDispatcher = {
    push: (req) => SyncClient.push(req),
    pull: (req) => SyncClient.pull(req)
  };

  /**
   * Sets custom dispatcher (useful in test runners without HTTP socket)
   */
  static setDispatcher(dispatcher: SyncDispatcher): void {
    this.dispatcher = dispatcher;
  }

  /**
   * Resets to default HTTP client dispatcher
   */
  static resetDispatcher(): void {
    this.dispatcher = {
      push: (req) => SyncClient.push(req),
      pull: (req) => SyncClient.pull(req)
    };
  }

  /**
   * Retrieves the locally persisted sync cursor
   */
  static getLastSyncCursor(): number {
    if (typeof localStorage === 'undefined') return 0;
    const val = localStorage.getItem(SYNC_CURSOR_STORAGE_KEY);
    return val ? parseInt(val, 10) || 0 : 0;
  }

  /**
   * Persists the last synchronized cursor locally
   */
  static setLastSyncCursor(cursor: number): void {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(SYNC_CURSOR_STORAGE_KEY, cursor.toString());
  }

  /**
   * Scans local working database for records marked PENDING_UPLOAD
   */
  static detectPendingChanges(): SyncChangeItem[] {
    const db = StorageService.loadDatabase();
    const changes: SyncChangeItem[] = [];

    const checkCollection = (items: any[], entityType: SyncEntityType) => {
      for (const item of items) {
        if (!item.sync_state || item.sync_state === 'PENDING_UPLOAD') {
          changes.push({
            entityType,
            entityId: item.id,
            operation: item.isVoided ? 'VOID' : 'UPSERT',
            baseVersion: item.record_sync_version || 0,
            payload: { ...item }
          });
        }
      }
    };

    checkCollection(db.buyers, 'buyers');
    checkCollection(db.suppliers, 'suppliers');
    checkCollection(db.sales, 'sales');
    checkCollection(db.payments, 'payments');
    checkCollection(db.expenses, 'expenses');
    checkCollection(db.expensePayments, 'expense_payments');
    checkCollection(db.cycles, 'production_cycles');
    checkCollection(db.harvests, 'harvests');
    checkCollection(db.auditLogs, 'audit_logs');

    return changes;
  }

  /**
   * Pushes all pending local changes to the trusted server sync boundary
   */
  static async pushPendingChanges(userId: string): Promise<{
    appliedCount: number;
    conflictCount: number;
    rejectedCount: number;
    response: SyncPushResponse;
  }> {
    const pendingChanges = this.detectPendingChanges();
    if (pendingChanges.length === 0) {
      return {
        appliedCount: 0,
        conflictCount: 0,
        rejectedCount: 0,
        response: { results: [], currentServerCursor: this.getLastSyncCursor() }
      };
    }

    const pushReq: SyncPushRequest = {
      userId,
      changes: pendingChanges
    };

    // Invoke trusted server boundary
    const res = await this.dispatcher.push(pushReq);
    const db = StorageService.loadDatabase();

    let appliedCount = 0;
    let conflictCount = 0;
    let rejectedCount = 0;

    for (const result of res.results) {
      const { entityType, entityId, status, newVersion, lastSyncedAt } = result;

      // Update metadata in local database authority
      const updateLocalRecord = (list: any[]) => {
        const item = list.find((i) => i.id === entityId);
        if (item) {
          if (status === 'APPLIED') {
            item.sync_state = 'SYNCED';
            item.record_sync_version = newVersion;
            item.last_synced_at = lastSyncedAt;
            appliedCount++;
          } else if (status === 'CONFLICT') {
            // Version conflict: mark as CONFLICT, do NOT destructively overwrite local data
            item.sync_state = 'CONFLICT';
            conflictCount++;
          } else {
            rejectedCount++;
          }
        }
      };

      switch (entityType) {
        case 'buyers': updateLocalRecord(db.buyers); break;
        case 'suppliers': updateLocalRecord(db.suppliers); break;
        case 'sales': updateLocalRecord(db.sales); break;
        case 'payments': updateLocalRecord(db.payments); break;
        case 'expenses': updateLocalRecord(db.expenses); break;
        case 'expense_payments': updateLocalRecord(db.expensePayments); break;
        case 'production_cycles': updateLocalRecord(db.cycles); break;
        case 'harvests': updateLocalRecord(db.harvests); break;
        case 'audit_logs': updateLocalRecord(db.auditLogs); break;
      }
    }

    // Save updated metadata back to local database authority
    StorageService.saveMemoryDatabase(db);
    this.setLastSyncCursor(res.currentServerCursor);

    return {
      appliedCount,
      conflictCount,
      rejectedCount,
      response: res
    };
  }

  /**
   * Pulls remote changes from trusted server boundary:
   * - If cursor == 0, executes bootstrap sync merging initial cloud dataset
   * - If cursor > 0, executes incremental sync replaying newer change logs
   */
  static async pullRemoteChanges(userId: string): Promise<{
    pulledChangesCount: number;
    response: SyncPullResponse;
  }> {
    const sinceCursor = this.getLastSyncCursor();
    const pullReq: SyncPullRequest = {
      userId,
      sinceCursor
    };

    const res = await this.dispatcher.pull(pullReq);
    const db = StorageService.loadDatabase();
    let pulledChangesCount = 0;

    if (res.isBootstrap && res.dataset) {
      // 1. Bootstrap: Merge full dataset
      const mergeCollection = (localList: any[], remoteList: any[]) => {
        for (const remote of remoteList) {
          const idx = localList.findIndex((i) => i.id === remote.id);
          if (idx === -1) {
            localList.push({ ...remote, sync_state: 'SYNCED' });
            pulledChangesCount++;
          } else {
            const local = localList[idx];
            // Void-wins takes precedence
            if (remote.isVoided && !local.isVoided) {
              localList[idx] = { ...remote, sync_state: 'SYNCED' };
              pulledChangesCount++;
            } else if (local.sync_state !== 'PENDING_UPLOAD' && (remote.record_sync_version || 0) >= (local.record_sync_version || 0)) {
              localList[idx] = { ...remote, sync_state: 'SYNCED' };
              pulledChangesCount++;
            }
          }
        }
      };

      mergeCollection(db.buyers, res.dataset.buyers);
      mergeCollection(db.suppliers, res.dataset.suppliers);
      mergeCollection(db.sales, res.dataset.sales);
      mergeCollection(db.payments, res.dataset.payments);
      mergeCollection(db.expenses, res.dataset.expenses);
      mergeCollection(db.expensePayments, res.dataset.expense_payments);
      mergeCollection(db.cycles, res.dataset.production_cycles);
      mergeCollection(db.harvests, res.dataset.harvests);
      mergeCollection(db.auditLogs, res.dataset.audit_logs);
    } else if (res.changes && res.changes.length > 0) {
      // 2. Incremental: Replay newer changes
      for (const change of res.changes) {
        const { entityType, record } = change;
        const applyIncremental = (localList: any[]) => {
          const idx = localList.findIndex((i) => i.id === record.id);
          if (idx === -1) {
            localList.push({ ...record, sync_state: 'SYNCED' });
            pulledChangesCount++;
          } else {
            const local = localList[idx];
            // Void-wins or newer version
            if (record.isVoided && !local.isVoided) {
              localList[idx] = { ...record, sync_state: 'SYNCED' };
              pulledChangesCount++;
            } else if (local.sync_state !== 'PENDING_UPLOAD' && (record.record_sync_version || 0) >= (local.record_sync_version || 0)) {
              localList[idx] = { ...record, sync_state: 'SYNCED' };
              pulledChangesCount++;
            }
          }
        };

        switch (entityType) {
          case 'buyers': applyIncremental(db.buyers); break;
          case 'suppliers': applyIncremental(db.suppliers); break;
          case 'sales': applyIncremental(db.sales); break;
          case 'payments': applyIncremental(db.payments); break;
          case 'expenses': applyIncremental(db.expenses); break;
          case 'expense_payments': applyIncremental(db.expensePayments); break;
          case 'production_cycles': applyIncremental(db.cycles); break;
          case 'harvests': applyIncremental(db.harvests); break;
          case 'audit_logs': applyIncremental(db.auditLogs); break;
        }
      }
    }

    StorageService.saveMemoryDatabase(db);
    this.setLastSyncCursor(res.currentServerCursor);

    return {
      pulledChangesCount,
      response: res
    };
  }

  /**
   * Summary of local pending synchronization state
   */
  static getSyncStateSummary() {
    const pending = this.detectPendingChanges();
    const db = StorageService.loadDatabase();

    const countConflicts = (list: any[]) => list.filter((i) => i.sync_state === 'CONFLICT').length;
    const conflictCount =
      countConflicts(db.buyers) +
      countConflicts(db.suppliers) +
      countConflicts(db.sales) +
      countConflicts(db.payments) +
      countConflicts(db.expenses) +
      countConflicts(db.expensePayments) +
      countConflicts(db.cycles) +
      countConflicts(db.harvests) +
      countConflicts(db.auditLogs);

    return {
      pendingUploadCount: pending.length,
      conflictCount,
      lastSyncCursor: this.getLastSyncCursor()
    };
  }
}
