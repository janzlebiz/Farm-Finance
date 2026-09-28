/**
 * Phase D — Item 2G — Gate 2: Production Safety & Failure Behavior Test Suite
 */
import { ServerSyncService } from '../src/server/syncService';
import { SyncEngine } from '../src/services/syncEngine';
import { StorageService } from '../src/services/storage';
import { setAdminDbForTesting, setAdminAuthForTesting } from '../src/server/adminFirebase';
import { SyncChangeItem } from '../src/types/sync';

// Local storage mock for Node environment
const mockLocalStorage: Record<string, string> = {};
(global as any).localStorage = {
  getItem: (k: string) => mockLocalStorage[k] || null,
  setItem: (k: string, v: string) => { mockLocalStorage[k] = v; },
  removeItem: (k: string) => { delete mockLocalStorage[k]; },
  clear: () => {
    for (const key of Object.keys(mockLocalStorage)) {
      delete mockLocalStorage[key];
    }
  }
};

/**
 * Transactional Firestore Test Engine
 */
class Gate2FirestoreTestEngine {
  private store = new Map<string, Record<string, any>>();

  doc(docPath: string) {
    const self = this;
    return {
      path: docPath,
      async get() {
        const data = self.store.get(docPath);
        return {
          exists: data !== undefined,
          data: () => (data ? JSON.parse(JSON.stringify(data)) : undefined),
          id: docPath.split('/').pop()
        };
      },
      async set(data: any, options?: { merge?: boolean }) {
        if (options?.merge && self.store.has(docPath)) {
          self.store.set(docPath, { ...self.store.get(docPath), ...data });
        } else {
          self.store.set(docPath, JSON.parse(JSON.stringify(data)));
        }
      }
    };
  }

  collection(colPath: string) {
    const self = this;
    return {
      path: colPath,
      async get() {
        const docs: any[] = [];
        for (const [key, value] of self.store.entries()) {
          const parentPath = key.substring(0, key.lastIndexOf('/'));
          if (parentPath === colPath) {
            docs.push({
              id: key.split('/').pop(),
              exists: true,
              data: () => JSON.parse(JSON.stringify(value))
            });
          }
        }
        return {
          docs,
          forEach(cb: (doc: any) => void) {
            docs.forEach(cb);
          }
        };
      }
    };
  }

  async runTransaction<T>(updateFunction: (transaction: any) => Promise<T>): Promise<T> {
    const self = this;
    const writeBuffer: { path: string; data: any; options?: any }[] = [];
    let hasWritten = false;

    const transaction = {
      async get(docRef: any) {
        if (hasWritten) {
          throw new Error('Firestore transactions require all reads to be executed before any writes');
        }
        return await docRef.get();
      },
      set(docRef: any, data: any, options?: any) {
        hasWritten = true;
        writeBuffer.push({ path: docRef.path, data: JSON.parse(JSON.stringify(data)), options });
      }
    };

    const result = await updateFunction(transaction);

    for (const op of writeBuffer) {
      if (op.options?.merge && self.store.has(op.path)) {
        self.store.set(op.path, { ...self.store.get(op.path), ...op.data });
      } else {
        self.store.set(op.path, op.data);
      }
    }

    return result;
  }

  clear() {
    this.store.clear();
  }

  getData(docPath: string): any {
    return this.store.get(docPath);
  }

  hasPath(docPath: string): boolean {
    return this.store.has(docPath);
  }
}

class Gate2AdminAuthEngine {
  private validTokens = new Map<string, { uid: string; email: string }>();

  registerToken(token: string, user: { uid: string; email: string }) {
    this.validTokens.set(token, user);
  }

  async verifyIdToken(token: string) {
    if (this.validTokens.has(token)) {
      return this.validTokens.get(token)!;
    }
    throw new Error('Firebase ID token is invalid or expired');
  }
}

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`❌ FAIL: ${message}`);
    failed++;
  }
}

async function runGate2Tests() {
  console.log('====================================================');
  console.log('  PHASE D — ITEM 2G GATE 2: PRODUCTION FAILURE SUITE');
  console.log('====================================================');

  const testDb = new Gate2FirestoreTestEngine();
  const testAuth = new Gate2AdminAuthEngine();

  setAdminDbForTesting(testDb);
  setAdminAuthForTesting(testAuth);

  const testUid = `test_gate2_user_${Date.now()}`;

  // 1. RETRY / IDEMPOTENCY & DUPLICATE SUBMISSION TEST
  console.log('\n--- 1. RETRY / IDEMPOTENCY & DUPLICATE SUBMISSION ---');
  const saleItem: SyncChangeItem = {
    entityType: 'sales',
    entityId: `sale_${Date.now()}`,
    operation: 'UPSERT',
    baseVersion: 0,
    payload: {
      crop: 'Rice',
      date: '2026-09-28',
      quantity: 1000,
      unit: 'kg',
      unitPriceCentavos: 3200,
      grossAmountCentavos: 3200000,
      buyerId: 'buyer_default_1',
      buyerNameSnapshot: 'Reliable Buyer Co',
      isVoided: false,
      createdAt: '2026-09-28T08:00:00.000Z',
      updatedAt: '2026-09-28T08:00:00.000Z'
    }
  };

  // Push 1: Initial creation
  const push1 = await ServerSyncService.processPush(testUid, [saleItem]);
  assert(push1.results[0].status === 'APPLIED', 'Push 1: Initial mutation applied');
  assert(push1.results[0].newVersion === 1, 'Push 1: Server assigned record_sync_version = 1');
  assert(push1.currentServerCursor === 1, 'Push 1: Monotonic cursor advanced to 1');

  // Push 2: Duplicate submission (simulated unacknowledged network retry)
  const push2 = await ServerSyncService.processPush(testUid, [saleItem]);
  assert(push2.results[0].status === 'APPLIED', 'Push 2 (Duplicate): Returns APPLIED idempotently');
  assert(push2.results[0].newVersion === 1, 'Push 2: Version remains 1 (no spurious increment)');
  assert(push2.currentServerCursor === 1, 'Push 2: Cursor remains 1 (no duplicate cursor consumed)');

  // Push 3: Third identical retry
  const push3 = await ServerSyncService.processPush(testUid, [saleItem]);
  assert(push3.results[0].status === 'APPLIED', 'Push 3 (3rd Retry): Idempotent ACK confirmed');
  assert(push3.currentServerCursor === 1, 'Push 3: Cursor strictly stays at 1');

  // Verify change logs: only 1 change log doc exists
  const hasLog1 = testDb.hasPath(`users/${testUid}/_sync/change_log_1`);
  const hasLog2 = testDb.hasPath(`users/${testUid}/_sync/change_log_2`);
  assert(hasLog1, 'Change log 1 exists in Firestore');
  assert(!hasLog2, 'Change log 2 does NOT exist (no duplicate change log created)');

  // 2. CURSOR RECOVERY
  console.log('\n--- 2. CURSOR RECOVERY & RESYNCHRONIZATION ---');
  // Client simulates an invalid cursor ahead of server (e.g. cursor=999)
  const pullRecovery = await ServerSyncService.processPull(testUid, 999);
  assert(pullRecovery.isBootstrap === true, 'Corrupted/Ahead cursor triggers full bootstrap fallback');
  assert(pullRecovery.dataset?.sales.length === 1, 'Bootstrap returns existing authoritative dataset');
  assert(pullRecovery.currentServerCursor === 1, 'Bootstrap provides accurate current server cursor');

  // 3. SERVER / NETWORK FAILURES & LOCAL PRESERVATION
  console.log('\n--- 3. NETWORK FAILURES & LOCAL RECOVERY ---');
  // Setup in-memory local DB
  StorageService.resetToCleanState();
  const db = StorageService.loadDatabase();
  const localSaleId = `local_sale_${Date.now()}`;
  db.sales.push({
    id: localSaleId,
    crop: 'Rice',
    date: '2026-09-28',
    quantity: 500,
    unit: 'kg',
    unitPriceCentavos: 3000,
    grossAmountCentavos: 1500000,
    buyerId: 'buyer_cash',
    buyerNameSnapshot: 'Cash Buyer',
    isVoided: false,
    createdAt: '2026-09-28T09:00:00.000Z',
    updatedAt: '2026-09-28T09:00:00.000Z',
    sync_state: 'PENDING_UPLOAD'
  });
  StorageService.saveMemoryDatabase(db);

  // Simulate network failure by setting a failing dispatcher
  SyncEngine.setDispatcher({
    push: async () => { throw new Error('HTTP 503 Service Unavailable / Network dropped'); },
    pull: async () => { throw new Error('HTTP 503 Service Unavailable'); }
  });

  let networkErrorCaught = false;
  try {
    await SyncEngine.pushPendingChanges(testUid);
  } catch (err: any) {
    networkErrorCaught = true;
  }
  assert(networkErrorCaught, 'Network failure properly thrown to caller');

  const dbAfterFailure = StorageService.loadDatabase();
  const pendingSale = dbAfterFailure.sales.find((s) => s.id === localSaleId);
  assert(pendingSale !== undefined, 'Local record preserved intact after network failure');
  assert(pendingSale?.sync_state === 'PENDING_UPLOAD', 'Record remains PENDING_UPLOAD (never marked SYNCED prematurely)');

  // Restore server dispatcher and verify retry succeeds
  SyncEngine.setDispatcher({
    push: (req) => ServerSyncService.processPush(req.userId, req.changes),
    pull: (req) => ServerSyncService.processPull(req.userId, req.sinceCursor)
  });

  const retryPush = await SyncEngine.pushPendingChanges(testUid);
  assert(retryPush.appliedCount >= 1, 'Retry after network recovery successfully applies');
  const dbAfterSuccess = StorageService.loadDatabase();
  const syncedSale = dbAfterSuccess.sales.find((s) => s.id === localSaleId);
  assert(syncedSale?.sync_state === 'SYNCED', 'Record marked SYNCED only after server ACK confirmed');

  // 4. MULTI-DEVICE CONCURRENCY & VOID-WINS
  console.log('\n--- 4. MULTI-DEVICE CONCURRENCY & VOID-WINS ---');
  const sharedRecordId = `shared_buyer_${Date.now()}`;

  // Device A creates record
  const devAPush = await ServerSyncService.processPush(testUid, [{
    entityType: 'buyers',
    entityId: sharedRecordId,
    operation: 'UPSERT',
    baseVersion: 0,
    payload: {
      name: 'Initial Buyer Name',
      contactNumber: '09123456789',
      isActive: true,
      createdDate: '2026-09-28'
    }
  }]);
  assert(devAPush.results[0].status === 'APPLIED', 'Device A: Initial buyer creation applied');

  // Device B pulls and receives record
  const devBPull = await ServerSyncService.processPull(testUid, 0);
  const pulledBuyer = devBPull.dataset?.buyers.find((b) => b.id === sharedRecordId);
  assert(pulledBuyer !== undefined, 'Device B: Successfully pulled shared record');
  assert(pulledBuyer?.record_sync_version === 1, 'Device B: Record version is 1');

  // Device B updates record -> version becomes 2
  const devBPush = await ServerSyncService.processPush(testUid, [{
    entityType: 'buyers',
    entityId: sharedRecordId,
    operation: 'UPSERT',
    baseVersion: 1,
    payload: {
      name: 'Updated by Device B',
      contactNumber: '09999999999',
      isActive: true,
      createdDate: '2026-09-28'
    }
  }]);
  assert(devBPush.results[0].status === 'APPLIED', 'Device B: Update applied to version 2');
  assert(devBPush.results[0].newVersion === 2, 'Device B: Server version incremented to 2');

  // Device A (stale with baseVersion 1) attempts concurrent conflicting edit
  const devAConflictingPush = await ServerSyncService.processPush(testUid, [{
    entityType: 'buyers',
    entityId: sharedRecordId,
    operation: 'UPSERT',
    baseVersion: 1,
    payload: {
      name: 'Conflicting Edit by Device A',
      contactNumber: '09111111111',
      isActive: true,
      createdDate: '2026-09-28'
    }
  }]);
  assert(devAConflictingPush.results[0].status === 'CONFLICT', 'Device A: Stale edit rejected with CONFLICT');
  assert(devAConflictingPush.results[0].serverVersion === 2, 'Device A: Conflict reports current serverVersion=2');

  // Device B voids the record
  const devBVoid = await ServerSyncService.processPush(testUid, [{
    entityType: 'buyers',
    entityId: sharedRecordId,
    operation: 'VOID',
    baseVersion: 2,
    payload: {
      name: 'Updated by Device B',
      isVoided: true,
      isActive: false
    }
  }]);
  assert(devBVoid.results[0].status === 'APPLIED', 'Device B: Void operation committed');

  // Device A attempts to overwrite voided record with active update
  const devAOverwriteVoid = await ServerSyncService.processPush(testUid, [{
    entityType: 'buyers',
    entityId: sharedRecordId,
    operation: 'UPSERT',
    baseVersion: 3,
    payload: {
      name: 'Attempt to resurrect voided buyer',
      isVoided: false,
      isActive: true
    }
  }]);
  assert(devAOverwriteVoid.results[0].status === 'CONFLICT', 'Device A: Resurrection of voided record rejected (Void-Wins)');

  // 5. DATA INTEGRITY & MONOTONIC CURSOR ORDERING
  console.log('\n--- 5. DATA INTEGRITY & MONOTONIC CURSOR ORDERING ---');
  const metaDoc = testDb.getData(`users/${testUid}/_sync/meta`);
  const finalCursor = metaDoc?.current_cursor;
  assert(typeof finalCursor === 'number' && finalCursor >= 4, `Final metadata current_cursor is monotonic (${finalCursor})`);

  // Verify all change logs from 1 to finalCursor exist without gaps
  let allLogsExist = true;
  for (let c = 1; c <= finalCursor; c++) {
    const exists = testDb.hasPath(`users/${testUid}/_sync/change_log_${c}`);
    if (!exists) {
      allLogsExist = false;
      break;
    }
  }
  assert(allLogsExist, `All change logs 1..${finalCursor} exist without any gaps or corruption`);

  console.log('\n----------------------------------------------------');
  console.log(`TOTAL: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('----------------------------------------------------');

  if (failed > 0) {
    process.exit(1);
  }
}

runGate2Tests().catch((err) => {
  console.error('Fatal error in Gate 2 tests:', err);
  process.exit(1);
});
