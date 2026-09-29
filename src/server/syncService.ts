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

/**
 * Checks if two entity payloads are semantically identical (ignoring sync metadata fields)
 */
function arePayloadsIdentical(incomingPayload: any, existingServerRecord: any, entityId?: string): boolean {
  if (!incomingPayload || !existingServerRecord) return false;
  const metadataKeys = new Set(['sync_state', 'record_sync_version', 'last_synced_at', '_sync_version']);

  const normA: Record<string, any> = { ...incomingPayload };
  if (entityId && !normA.id) normA.id = entityId;

  const normB: Record<string, any> = { ...existingServerRecord };

  for (const k of metadataKeys) {
    delete normA[k];
    delete normB[k];
  }

  // Every key present in the incoming payload must match the existing server document
  for (const key of Object.keys(normA)) {
    if (metadataKeys.has(key)) continue;
    const valA = normA[key];
    const valB = normB[key];

    if (valA === valB) continue;
    if ((valA === null || valA === undefined) && (valB === null || valB === undefined)) continue;

    if (typeof valA === 'object' && typeof valB === 'object' && valA !== null && valB !== null) {
      if (JSON.stringify(valA) !== JSON.stringify(valB)) return false;
    } else if (valA !== valB) {
      return false;
    }
  }

  // Void state must also match
  const incomingIsVoid = normA.isVoided === true || normA.status === 'VOID';
  const serverIsVoid = normB.isVoided === true || normB.status === 'VOID';
  if (incomingIsVoid !== serverIsVoid) return false;

  return true;
}

function cleanUndefined(obj: any): any {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(cleanUndefined);
  const cleaned: Record<string, any> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val !== undefined) {
      cleaned[key] = cleanUndefined(val);
    }
  }
  return cleaned;
}

export class ServerSyncService {
  /**
   * Process client push request with authoritative server validation,
   * optimistic concurrency control, void-wins semantics, version assignment,
   * duplicate retry idempotency, and atomic changelog recording in a single Firestore transaction.
   *
   * The userId parameter is the verified, authenticated user identity.
   */
  static async processPush(userId: string, changes: SyncChangeItem[]): Promise<SyncPushResponse> {
    if (!userId || typeof userId !== 'string') {
      throw new Error('Invalid or missing authenticated userId for sync operation');
    }

    if (!Array.isArray(changes) || changes.length === 0) {
      const metaDoc = await adminDb.doc(`users/${userId}/_sync/meta`).get();
      const currentCursor = metaDoc.exists ? (metaDoc.data()?.current_cursor || 0) : 0;
      return {
        results: [],
        currentServerCursor: currentCursor
      };
    }

    return await adminDb.runTransaction(async (transaction) => {
      // 1. Read authoritative sync metadata
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

        // IDEMPOTENCY CHECK:
        // If the server record already contains this exact payload and void state,
        // this is a safe duplicate/retry submission (e.g. unacknowledged network retry).
        // Acknowledge as APPLIED without incrementing version or creating duplicate change-logs.
        if (existingRecord && arePayloadsIdentical(item.payload, existingRecord, item.entityId)) {
          results.push({
            entityType: item.entityType,
            entityId: item.entityId,
            status: 'APPLIED',
            newVersion: existingRecord.record_sync_version,
            newCursor: currentCursor,
            lastSyncedAt: existingRecord.last_synced_at || Date.now()
          });
          continue;
        }

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
            reason: `Optimistic concurrency conflict: client baseVersion (${item.baseVersion}) is behind server version (${serverVersion})`
          });
          continue;
        }

        // Valid mutation: Increment cursor and version atomically
        currentCursor += 1;
        cursorAdvanced = true;
        const newVersion = serverVersion + 1;
        const lastSyncedAt = Date.now();

        const isVoid = item.operation === 'VOID' || item.payload?.isVoided === true || item.payload?.status === 'VOID';
        const serverAssignedRecord = cleanUndefined({
          ...item.payload,
          id: item.entityId,
          isVoided: isVoid,
          status: isVoid ? 'VOID' : (item.payload?.status || 'ACTIVE'),
          sync_state: 'SYNCED',
          record_sync_version: newVersion,
          last_synced_at: lastSyncedAt
        });

        // Write business record
        transaction.set(recordRef, serverAssignedRecord);

        // Write immutable change log entry to _sync subcollection
        const changeLogRef = adminDb.doc(`users/${userId}/_sync/change_log_${currentCursor}`);
        const logEntry: SyncChangeLogEntry = cleanUndefined({
          cursor: currentCursor,
          entityType: item.entityType,
          entityId: item.entityId,
          operation: item.operation,
          record: serverAssignedRecord,
          timestamp: lastSyncedAt
        });
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

      // Update sync metadata with new monotonic cursor if any mutations applied
      if (cursorAdvanced) {
        transaction.set(
          metaRef,
          {
            current_cursor: currentCursor,
            updated_at: Date.now()
          },
          { merge: true }
        );
      }

      return {
        results,
        currentServerCursor: currentCursor
      };
    });
  }

  /**
   * Process client pull request.
   * If sinceCursor is 0 or negative/ahead, returns full dataset (bootstrap).
   * If sinceCursor > 0, returns incremental change-log entries.
   */
  static async processPull(userId: string, sinceCursor: number): Promise<SyncPullResponse> {
    if (!userId || typeof userId !== 'string') {
      throw new Error('Invalid or missing authenticated userId for sync operation');
    }

    const metaDoc = await adminDb.doc(`users/${userId}/_sync/meta`).get();
    const currentServerCursor = metaDoc.exists ? (metaDoc.data()?.current_cursor || 0) : 0;

    // Bootstrap Sync (sinceCursor <= 0 or client cursor is corrupted/ahead of server)
    if (sinceCursor <= 0 || sinceCursor > currentServerCursor) {
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

      const businessDataSnap = await adminDb.collection(`users/${userId}/business_data`).get();
      businessDataSnap.forEach((doc) => {
        const data = doc.data();
        const docId = doc.id;
        const firstUnderscore = docId.indexOf('_');
        const entityType = firstUnderscore > 0 ? (docId.substring(0, firstUnderscore) as SyncEntityType) : null;

        if (entityType && entityType in dataset) {
          (dataset[entityType] as any[]).push(data);
        }
      });

      return {
        currentServerCursor,
        isBootstrap: true,
        dataset
      };
    }

    // Incremental Sync (sinceCursor > 0)
    const changes: SyncChangeLogEntry[] = [];
    for (let c = sinceCursor + 1; c <= currentServerCursor; c++) {
      const changeDoc = await adminDb.doc(`users/${userId}/_sync/change_log_${c}`).get();
      if (changeDoc.exists) {
        changes.push(changeDoc.data() as SyncChangeLogEntry);
      }
    }

    return {
      currentServerCursor,
      isBootstrap: false,
      changes
    };
  }

  /**
   * Completely purges all user-owned Firestore data under /users/{userId},
   * including business_data, _sync, and the user root document.
   */
  static async purgeUserData(userId: string): Promise<void> {
    if (!userId || typeof userId !== 'string') {
      throw new Error('Invalid userId for data purge');
    }

    const userRootRef = adminDb.doc(`users/${userId}`);

    const deleteCollection = async (collectionRef: FirebaseFirestore.CollectionReference) => {
      const query = collectionRef.limit(100);
      return new Promise<void>((resolve, reject) => {
        const deleteQueryBatch = (dbQuery: FirebaseFirestore.Query, resResolve: () => void, resReject: (err: any) => void) => {
          dbQuery.get().then((snapshot) => {
            if (snapshot.size === 0) {
              return resResolve();
            }
            const batch = adminDb.batch();
            snapshot.docs.forEach((doc) => {
              batch.delete(doc.ref);
            });
            batch.commit().then(() => {
              process.nextTick(() => {
                deleteQueryBatch(dbQuery, resResolve, resReject);
              });
            }).catch(resReject);
          }).catch(resReject);
        };
        deleteQueryBatch(query, resolve, reject);
      });
    };

    const businessDataRef = adminDb.collection(`users/${userId}/business_data`);
    const syncRef = adminDb.collection(`users/${userId}/_sync`);

    await deleteCollection(businessDataRef);
    await deleteCollection(syncRef);
    await userRootRef.delete();
  }
}
