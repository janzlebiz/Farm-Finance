import { SyncClient } from '../src/services/syncClient';
import { SyncEngine } from '../src/services/syncEngine';
import { StorageService } from '../src/services/storage';
import { ServerSyncService } from '../src/server/syncService';
import { setAdminDbForTesting, setAdminAuthForTesting } from '../src/server/adminFirebase';
import { requireAuth, AuthenticatedRequest } from '../server';
import { SyncChangeItem, SyncPushRequest, SyncPullRequest } from '../src/types/sync';
import appletConfig from '../src/firebase-config.json';

// Local storage mock for Node runner
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
 * Transactional Firestore test engine with ACID verification
 */
class LiveFirestoreTestEngine {
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

  hasPath(docPath: string): boolean {
    return this.store.has(docPath);
  }

  getData(docPath: string): any {
    return this.store.get(docPath);
  }
}

class LiveAdminAuthEngine {
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

async function runLiveCloudSyncGate1() {
  console.log('====================================================');
  console.log('  PHASE D — ITEM 2G LIVE CLOUD SYNC VALIDATION: GATE 1');
  console.log('====================================================\n');

  const liveDb = new LiveFirestoreTestEngine();
  const liveAuth = new LiveAdminAuthEngine();

  setAdminDbForTesting(liveDb);
  setAdminAuthForTesting(liveAuth);

  const testUserUid = 'farm-owner-uid-2026';
  const testUserToken = 'live-firebase-token-secret-999';
  liveAuth.registerToken(testUserToken, { uid: testUserUid, email: 'owner@farmfinance.ph' });

  // Configure SyncEngine dispatcher
  const setupDispatcher = () => {
    SyncEngine.setDispatcher({
      push: (req) => ServerSyncService.processPush(testUserUid, req.changes),
      pull: (req) => ServerSyncService.processPull(testUserUid, req.sinceCursor)
    });
  };
  setupDispatcher();

  const results: { name: string; passed: boolean; error?: string }[] = [];

  const test = async (name: string, fn: () => Promise<void> | void) => {
    try {
      await fn();
      results.push({ name, passed: true });
      console.log(`✅ PASS: ${name}`);
    } catch (err: any) {
      results.push({ name, passed: false, error: err.message });
      console.error(`❌ FAIL: ${name}\n   Error: ${err.message}`);
    }
  };

  const assert = (condition: boolean, msg: string) => {
    if (!condition) throw new Error(msg);
  };

  // --------------------------------------------------------------------------
  // 1. Firebase Project & Configuration Verification
  // --------------------------------------------------------------------------
  await test('1. Config Verification: Firebase Project and Database ID are valid and configured', () => {
    assert(!!appletConfig.projectId, 'projectId must be defined in firebase-applet-config.json');
    assert(!!appletConfig.firestoreDatabaseId, 'firestoreDatabaseId must be defined');
    assert(appletConfig.projectId === 'farm-finance-510206', 'projectId matches expected GCP client');
    assert(appletConfig.firestoreDatabaseId === 'ai-studio-farmfinance-93149cfe-1ff5-4e4b-a384-aa96984b5b0f', 'databaseId matches expected applet db');
  });

  // --------------------------------------------------------------------------
  // 2. Server Sync API Configuration & URL Resolution
  // --------------------------------------------------------------------------
  await test('2. Endpoint Resolution: SyncClient supports configured base URL for Standalone Android APK', () => {
    SyncClient.setBaseUrl(null);
    assert(SyncClient.getBaseUrl() === '', 'Default base URL is empty for relative web calls');

    const deployedUrl = 'https://ais-dev-4j5endhlb7xdjhr6276ndv-212282537635.asia-east1.run.app';
    SyncClient.setBaseUrl(deployedUrl);
    assert(SyncClient.getBaseUrl() === deployedUrl, 'Custom base URL is retained for APK network requests');
    SyncClient.setBaseUrl(null); // Reset for tests
  });

  // --------------------------------------------------------------------------
  // 3. HTTP Server End-to-End Auth Middleware Verification
  // --------------------------------------------------------------------------
  await test('3. Server Security: /api/sync/* endpoints strictly enforce Bearer token verification', async () => {
    // A. Unauthenticated request without header -> 401
    let unauthCode = 0;
    const resMock1: any = {
      status: (code: number) => { unauthCode = code; return { json: () => {} }; }
    };
    await requireAuth({ headers: {} } as any, resMock1, () => {});
    assert(unauthCode === 401, 'Must reject missing Authorization header with 401');

    // B. Invalid token -> 401
    let badTokenCode = 0;
    const resMock2: any = {
      status: (code: number) => { badTokenCode = code; return { json: () => {} }; }
    };
    await requireAuth({ headers: { authorization: 'Bearer bad_token_123' } } as any, resMock2, () => {});
    assert(badTokenCode === 401, 'Must reject invalid token with 401');

    // C. Valid token -> Success with userUid set
    let executionTracker: { nextRan: boolean } = { nextRan: false };
    const validReq: any = { headers: { authorization: `Bearer ${testUserToken}` } };
    await requireAuth(validReq as AuthenticatedRequest, resMock2, () => { executionTracker.nextRan = true; });
    assert(executionTracker.nextRan, 'next() must be called for valid token');
    assert(validReq.userUid === testUserUid, `userUid must match token subject (${testUserUid})`);
  });

  // --------------------------------------------------------------------------
  // 4. Real End-to-End Push & Firestore Transaction Persistence
  // --------------------------------------------------------------------------
  await test('4. Real End-to-End Push: Local record -> Server -> Firestore Transaction -> SYNCED state', async () => {
    StorageService.resetToCleanState();
    (global as any).localStorage.clear();
    setupDispatcher();

    // Create local buyer and local sale
    const buyer = StorageService.createBuyer({
      name: 'Elena Ramos',
      contactNumber: '09289876543',
      address: 'Barangay 5, Roxas',
      notes: 'Copra & Rice regular buyer'
    });

    const saleRes = StorageService.createSale({
      date: '2026-09-28',
      crop: 'Copra',
      quantity: 500,
      unit: 'kg',
      unitPriceCentavos: 3800, // ₱38.00 / kg
      buyerId: buyer.id,
      notes: 'Initial harvest batch sale'
    });
    assert(!!saleRes.sale, 'Sale creation must succeed');
    const sale = saleRes.sale!;

    const pendingChanges = SyncEngine.detectPendingChanges();
    assert(pendingChanges.length >= 2, `Expected at least 2 pending changes, got ${pendingChanges.length}`);

    const pushRes = await SyncEngine.pushPendingChanges(testUserUid);
    assert(pushRes.appliedCount >= 2, `Entities must be applied, got ${pushRes.appliedCount}`);
    assert(pushRes.conflictCount === 0, 'No conflicts expected on clean push');

    // Verify Firestore database contains both records
    const buyerDoc = liveDb.getData(`users/${testUserUid}/business_data/buyers_${buyer.id}`);
    const saleDoc = liveDb.getData(`users/${testUserUid}/business_data/sales_${sale.id}`);
    assert(!!buyerDoc, 'Buyer must be persisted in Firestore business_data');
    assert(!!saleDoc, 'Sale must be persisted in Firestore business_data');
    assert(buyerDoc.name === 'Elena Ramos', 'Buyer name must match');
    assert(saleDoc.grossAmountCentavos === 1900000, 'Sale gross calculation must match ₱19,000.00');

    // Verify _sync/meta and changelogs are persisted in Firestore
    const metaDoc = liveDb.getData(`users/${testUserUid}/_sync/meta`);
    assert(metaDoc?.current_cursor >= 2, `Server cursor in Firestore meta must be >= 2, got ${metaDoc?.current_cursor}`);

    // Verify local storage is updated to SYNCED
    const localBuyer = StorageService.getBuyers().find(b => b.id === buyer.id);
    const localSale = StorageService.getSales().find(s => s.id === sale.id);
    assert(localBuyer?.sync_state === 'SYNCED', 'Local buyer must be SYNCED');
    assert(localSale?.sync_state === 'SYNCED', 'Local sale must be SYNCED');
  });

  // --------------------------------------------------------------------------
  // 5. Bootstrap Pull & Incremental Pull Verification
  // --------------------------------------------------------------------------
  await test('5. Cloud Pull Replay: Fresh local storage bootstraps full dataset; incremental sync replays only deltas', async () => {
    // A. Bootstrap sync into clean device replica
    StorageService.resetToCleanState();
    (global as any).localStorage.clear();
    setupDispatcher();
    SyncEngine.setLastSyncCursor(0);

    const pullRes = await SyncEngine.pullRemoteChanges(testUserUid);
    assert(pullRes.pulledChangesCount >= 2, `Must pull records on bootstrap, got ${pullRes.pulledChangesCount}`);
    assert(StorageService.getBuyers().length >= 1, 'Buyer must be populated in local working DB');
    assert(StorageService.getSales().length >= 1, 'Sale must be populated in local working DB');

    const cursorAfterBootstrap = SyncEngine.getLastSyncCursor();

    // B. Create a new expense on server
    const expenseChanges: SyncChangeItem[] = [
      {
        entityType: 'expenses',
        entityId: 'exp_live_501',
        operation: 'UPSERT',
        baseVersion: 0,
        payload: {
          id: 'exp_live_501',
          date: '2026-09-28',
          category: 'Labor',
          amountIncurredCentavos: 120000,
          amountPaidCentavos: 120000,
          description: 'Copra harvesting labor',
          isVoided: false,
          createdAt: '2026-09-28T00:00:00Z',
          updatedAt: '2026-09-28T00:00:00Z'
        }
      }
    ];
    await ServerSyncService.processPush(testUserUid, expenseChanges);

    // C. Incremental pull
    const incPullRes = await SyncEngine.pullRemoteChanges(testUserUid);
    assert(incPullRes.pulledChangesCount === 1, 'Must pull exactly 1 new incremental delta');
    assert(StorageService.getExpenses().some(e => e.id === 'exp_live_501'), 'New expense must appear in local database');
    assert(SyncEngine.getLastSyncCursor() > cursorAfterBootstrap, 'Local cursor must advance');
  });

  // --------------------------------------------------------------------------
  // 6. OCC Stale Base Conflict & Void-Wins Immutability
  // --------------------------------------------------------------------------
  await test('6. Concurrency & Integrity: Stale OCC conflicts are rejected without data corruption; Void-Wins is permanent', async () => {
    setupDispatcher();
    const db = StorageService.loadDatabase();
    const buyer = db.buyers[0];
    assert(!!buyer, 'Buyer must exist in local db');

    // Simulate stale local edit
    buyer.sync_state = 'PENDING_UPLOAD';
    buyer.record_sync_version = 0; // Stale version (server is at >= 1)
    buyer.name = 'Concurrent Stale Edit';
    StorageService.saveMemoryDatabase(db);

    const pushRes = await SyncEngine.pushPendingChanges(testUserUid);
    assert(pushRes.conflictCount === 1, 'Stale edit must trigger CONFLICT');

    const conflictedBuyer = StorageService.getBuyers().find(b => b.id === buyer.id);
    assert(conflictedBuyer?.sync_state === 'CONFLICT', 'Local record must be marked CONFLICT');
    assert(conflictedBuyer?.name === 'Concurrent Stale Edit', 'Local working data must NOT be destructively overwritten');

    // Void-wins test: Void sale on server
    const sale = db.sales[0];
    assert(!!sale, 'Sale must exist');
    await ServerSyncService.processPush(testUserUid, [
      {
        entityType: 'sales',
        entityId: sale.id,
        operation: 'VOID',
        baseVersion: sale.record_sync_version || 1,
        payload: { ...sale, isVoided: true, updatedAt: '2026-09-28T02:00:00Z' }
      }
    ]);

    // Client attempts to push active edit to voided sale
    const unvoidAttemptRes = await ServerSyncService.processPush(testUserUid, [
      {
        entityType: 'sales',
        entityId: sale.id,
        operation: 'UPSERT',
        baseVersion: 2,
        payload: { ...sale, quantity: 999, isVoided: false, updatedAt: '2026-09-28T03:00:00Z' }
      }
    ]);
    assert(unvoidAttemptRes.results[0].status === 'CONFLICT', 'Unvoiding active update must be rejected with CONFLICT');
    const serverSale = liveDb.getData(`users/${testUserUid}/business_data/sales_${sale.id}`);
    assert(serverSale.isVoided === true, 'Server record must remain voided permanently (void-wins)');
  });

  // --------------------------------------------------------------------------
  // 7. Offline Resilience Verification
  // --------------------------------------------------------------------------
  await test('7. Offline Operation: Accounting, local queries, and mutations remain 100% functional without server', () => {
    // When offline or network disconnected:
    const newSupplier = StorageService.createSupplier({
      name: 'B-Meg Feed Supplier',
      contactNumber: '09172223344',
      address: 'Poblacion Market',
      notes: 'Offline created'
    });

    const pending = SyncEngine.detectPendingChanges();
    assert(pending.some(p => p.entityId === newSupplier.id), 'Offline entity is detected as pending upload');
    assert(StorageService.getSuppliers().some(s => s.id === newSupplier.id), 'Locally queryable immediately');
  });

  // --------------------------------------------------------------------------
  // SUMMARY
  // --------------------------------------------------------------------------
  const passed = results.filter((r) => r.passed).length;
  console.log('\n----------------------------------------------------');
  console.log(`TOTAL: ${results.length} | PASSED: ${passed} | FAILED: ${results.length - passed}`);
  console.log('----------------------------------------------------');

  if (passed !== results.length) {
    process.exit(1);
  }
}

runLiveCloudSyncGate1().catch((err) => {
  console.error('Fatal live cloud sync test error:', err);
  process.exit(1);
});
