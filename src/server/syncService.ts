import {
  SyncPushRequest,
  SyncPushResponse,
  SyncPullRequest,
  SyncPullResponse,
  SyncPushResultItem,
  SyncChangeLogEntry,
  FullSyncDataset,
  SyncEntityType
} from '../types/sync';
import { db } from '../services/firebase';
import {
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs
} from 'firebase/firestore';

// In-Memory Authoritative Server Store
const serverMetaStore = new Map<string, { current_cursor: number; updatedAt: number }>();
const serverDataStore = new Map<string, Map<string, any>>();
const serverChangeLogStore = new Map<string, Map<number, SyncChangeLogEntry>>();

export class ServerSyncService {
  /**
   * Resets in-memory server state (for test isolation)
   */
  static resetServerStore(): void {
    serverMetaStore.clear();
    serverDataStore.clear();
    serverChangeLogStore.clear();
  }

  private static getUserDataMap(userId: string): Map<string, any> {
    if (!serverDataStore.has(userId)) {
      serverDataStore.set(userId, new Map<string, any>());
    }
    return serverDataStore.get(userId)!;
  }

  private static getUserChangeLogMap(userId: string): Map<number, SyncChangeLogEntry> {
    if (!serverChangeLogStore.has(userId)) {
      serverChangeLogStore.set(userId, new Map<number, SyncChangeLogEntry>());
    }
    return serverChangeLogStore.get(userId)!;
  }

  /**
   * Process client push request with authoritative server validation,
   * optimistic concurrency control, void-wins semantics, version assignment,
   * and atomic changelog recording.
   */
  static async processPush(request: SyncPushRequest): Promise<SyncPushResponse> {
    const { userId, changes } = request;
    if (!userId || typeof userId !== 'string') {
      throw new Error('Invalid or missing userId in sync request');
    }

    const dataMap = this.getUserDataMap(userId);
    const changeLogMap = this.getUserChangeLogMap(userId);

    // 1. Fetch current server cursor for user
    const currentMeta = serverMetaStore.get(userId);
    let currentCursor = currentMeta?.current_cursor || 0;

    const results: SyncPushResultItem[] = [];

    // 2. Process each change item
    for (const item of changes) {
      try {
        const docKey = `${item.entityType}_${item.entityId}`;
        const existingRecord = dataMap.get(docKey) || null;

        // Base version check / Optimistic Concurrency
        const serverVersion = existingRecord ? (existingRecord.record_sync_version || 1) : 0;

        // VOID-WINS SEMANTICS:
        // If server record is already VOID, active update mutations are rejected
        if (existingRecord && existingRecord.isVoided && item.operation !== 'VOID' && !item.payload?.isVoided) {
          results.push({
            entityType: item.entityType,
            entityId: item.entityId,
            status: 'CONFLICT',
            serverVersion,
            serverRecord: existingRecord,
            reason: 'Record is voided on server; void is permanent and takes precedence.'
          });
          continue;
        }

        // Check for stale base version
        if (existingRecord && item.baseVersion < serverVersion) {
          results.push({
            entityType: item.entityType,
            entityId: item.entityId,
            status: 'CONFLICT',
            serverVersion,
            serverRecord: existingRecord,
            reason: `Stale base version ${item.baseVersion}. Current server version is ${serverVersion}.`
          });
          continue;
        }

        // Apply mutation with server authority
        currentCursor += 1;
        const newVersion = serverVersion + 1;
        const lastSyncedAt = Date.now();

        const serverAssignedRecord = {
          ...item.payload,
          id: item.entityId,
          sync_state: 'SYNCED',
          record_sync_version: newVersion,
          last_synced_at: lastSyncedAt
        };

        // Write business record to authoritative server store
        dataMap.set(docKey, serverAssignedRecord);

        // Write atomic change log entry
        const logEntry: SyncChangeLogEntry = {
          cursor: currentCursor,
          entityType: item.entityType,
          entityId: item.entityId,
          operation: item.operation,
          record: serverAssignedRecord,
          timestamp: lastSyncedAt
        };
        changeLogMap.set(currentCursor, logEntry);

        // Attempt Firestore persistence if live environment is available
        try {
          const recordRef = doc(db, 'users', userId, 'data_store', docKey);
          setDoc(recordRef, serverAssignedRecord).catch(() => {});
        } catch (_) {}

        results.push({
          entityType: item.entityType,
          entityId: item.entityId,
          status: 'APPLIED',
          newVersion,
          newCursor: currentCursor,
          lastSyncedAt
        });
      } catch (err: any) {
        results.push({
          entityType: item.entityType,
          entityId: item.entityId,
          status: 'REJECTED',
          reason: err.message || 'Server error applying change'
        });
      }
    }

    // 3. Persist new cursor in server metadata
    serverMetaStore.set(userId, {
      current_cursor: currentCursor,
      updatedAt: Date.now()
    });

    return {
      results,
      currentServerCursor: currentCursor
    };
  }

  /**
   * Process client pull request:
   * - sinceCursor == 0: Bootstrap full dataset
   * - sinceCursor > 0: Incremental changes since cursor
   */
  static async processPull(request: SyncPullRequest): Promise<SyncPullResponse> {
    const { userId, sinceCursor } = request;
    if (!userId || typeof userId !== 'string') {
      throw new Error('Invalid or missing userId in pull request');
    }

    const currentMeta = serverMetaStore.get(userId);
    const currentServerCursor = currentMeta?.current_cursor || 0;

    // Bootstrap Sync: full active dataset
    if (sinceCursor === 0) {
      const dataset: FullSyncDataset = {
        buyers: [],
        suppliers: [],
        sales: [],
        payments: [],
        expenses: [],
        expense_payments: [],
        production_cycles: [],
        harvests: [],
        audit_logs: []
      };

      const dataMap = this.getUserDataMap(userId);
      dataMap.forEach((data, docKey) => {
        const entityType = docKey.split('_')[0] as SyncEntityType;
        if (dataset[entityType]) {
          (dataset[entityType] as any[]).push(data);
        }
      });

      return {
        currentServerCursor,
        isBootstrap: true,
        dataset
      };
    }

    // Incremental Sync: replay change logs newer than sinceCursor
    const changes: SyncChangeLogEntry[] = [];
    const changeLogMap = this.getUserChangeLogMap(userId);

    if (currentServerCursor > sinceCursor) {
      for (let c = sinceCursor + 1; c <= currentServerCursor; c++) {
        const entry = changeLogMap.get(c);
        if (entry) {
          changes.push(entry);
        }
      }
    }

    return {
      currentServerCursor,
      isBootstrap: false,
      changes
    };
  }
}
