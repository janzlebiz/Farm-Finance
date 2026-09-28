import {
  SyncPushResponse,
  SyncPullResponse,
  SyncPushResultItem,
  SyncChangeLogEntry,
  FullSyncDataset,
  SyncEntityType,
  SyncChangeItem
} from '../types/sync';
import { adminDb } from './adminFirebase';

export class ServerSyncService {
  /**
   * Process client push request with authoritative server validation,
   * optimistic concurrency control, void-wins semantics, version assignment,
   * and atomic changelog recording in a single Firestore transaction.
   *
   * The userId parameter is the verified, authenticated user identity.
   */
  static async processPush(userId: string, changes: SyncChangeItem[]): Promise<SyncPushResponse> {
    if (!userId || typeof userId !== 'string') {
      throw new Error('Invalid or missing authenticated userId');
    }

    if (!changes || changes.length === 0) {
      const metaRef = adminDb.doc(`users/${userId}/_sync/meta`);
      const metaDoc = await metaRef.get();
      const currentCursor = metaDoc.exists ? (metaDoc.data()?.current_cursor || 0) : 0;
      return {
        results: [],
        currentServerCursor: currentCursor
      };
    }

    // Execute atomic Firestore transaction for the entire push batch
    return await adminDb.runTransaction(async (transaction) => {
      // 1. Read the user's sync metadata
      const metaRef = adminDb.doc(`users/${userId}/_sync/meta`);
      const metaDoc = await transaction.get(metaRef);
      let currentCursor = metaDoc.exists ? (metaDoc.data()?.current_cursor || 0) : 0;

      // 2. Read all existing target documents in the transaction first
      const docReadMap = new Map<string, FirebaseFirestore.DocumentSnapshot>();
      for (const item of changes) {
        const docKey = `${item.entityType}_${item.entityId}`;
        const recordRef = adminDb.doc(`users/${userId}/business_data/${docKey}`);
        const snap = await transaction.get(recordRef);
        docReadMap.set(docKey, snap);
      }

      const results: SyncPushResultItem[] = [];
      let cursorAdvanced = false;

      // 3. Process each change item transactionally
      for (const item of changes) {
        const docKey = `${item.entityType}_${item.entityId}`;
        const recordRef = adminDb.doc(`users/${userId}/business_data/${docKey}`);
        const existingSnap = docReadMap.get(docKey);
        const existingRecord = existingSnap && existingSnap.exists ? existingSnap.data() : null;

        const serverVersion = existingRecord ? (existingRecord.record_sync_version || 1) : 0;

        // VOID-WINS SEMANTICS:
        // If server record is already VOID, active update mutations are rejected permanently
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

        // OPTIMISTIC CONCURRENCY:
        // Reject update if client baseVersion is behind the server version
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

        // Valid mutation: Increment cursor and version atomically
        currentCursor += 1;
        cursorAdvanced = true;
        const newVersion = serverVersion + 1;
        const lastSyncedAt = Date.now();

        const serverAssignedRecord = {
          ...item.payload,
          id: item.entityId,
          sync_state: 'SYNCED',
          record_sync_version: newVersion,
          last_synced_at: lastSyncedAt
        };

        // Write business record
        transaction.set(recordRef, serverAssignedRecord);

        // Write immutable change log entry to _sync subcollection
        const changeLogRef = adminDb.doc(`users/${userId}/_sync/change_log_${currentCursor}`);
        const logEntry: SyncChangeLogEntry = {
          cursor: currentCursor,
          entityType: item.entityType,
          entityId: item.entityId,
          operation: item.operation,
          record: serverAssignedRecord,
          timestamp: lastSyncedAt
        };
        transaction.set(changeLogRef, logEntry);

        results.push({
          entityType: item.entityType,
          entityId: item.entityId,
          status: 'APPLIED',
          newVersion,
          newCursor: currentCursor,
          lastSyncedAt
        });
      }

      // Update sync metadata with the latest allocated cursor
      if (cursorAdvanced || !metaDoc.exists) {
        transaction.set(metaRef, {
          current_cursor: currentCursor,
          updatedAt: Date.now()
        }, { merge: true });
      }

      return {
        results,
        currentServerCursor: currentCursor
      };
    });
  }

  /**
   * Process client pull request:
   * - sinceCursor === 0: Full dataset bootstrap directly from authoritative Firestore business_data
   * - sinceCursor > 0: Incremental change log replay from Firestore _sync/change_log_*
   *
   * The userId parameter is the verified, authenticated user identity.
   */
  static async processPull(userId: string, sinceCursor: number): Promise<SyncPullResponse> {
    if (!userId || typeof userId !== 'string') {
      throw new Error('Invalid or missing authenticated userId');
    }

    const metaRef = adminDb.doc(`users/${userId}/_sync/meta`);
    const metaDoc = await metaRef.get();
    const currentServerCursor = metaDoc.exists ? (metaDoc.data()?.current_cursor || 0) : 0;

    // 1. Bootstrap: Fetch entire user dataset
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

      const dataCol = adminDb.collection(`users/${userId}/business_data`);
      const snapshot = await dataCol.get();

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const docId = docSnap.id;
        const entityType = docId.split('_')[0] as SyncEntityType;
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

    // 2. Incremental: Fetch change logs newer than sinceCursor
    const changes: SyncChangeLogEntry[] = [];
    if (currentServerCursor > sinceCursor) {
      const promises: Promise<FirebaseFirestore.DocumentSnapshot>[] = [];
      for (let c = sinceCursor + 1; c <= currentServerCursor; c++) {
        promises.push(adminDb.doc(`users/${userId}/_sync/change_log_${c}`).get());
      }
      const snaps = await Promise.all(promises);
      for (const snap of snaps) {
        if (snap.exists) {
          changes.push(snap.data() as SyncChangeLogEntry);
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
