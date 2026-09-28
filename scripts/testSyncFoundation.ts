import { ServerSyncService } from '../src/server/syncService';
import { SyncEngine } from '../src/services/syncEngine';
import { StorageService } from '../src/services/storage';
import { setAdminDbForTesting, setAdminAuthForTesting } from '../src/server/adminFirebase';
import { requireAuth, AuthenticatedRequest } from '../server';
import { SyncChangeItem, SyncPushRequest, SyncPullRequest } from '../src/types/sync';

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
 * In-memory transactional Firestore Admin implementation for automated test execution
 */
class MockFirestoreAdmin {
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

    // Apply all buffered transactional writes atomically
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
}

/**
 * Mock Firebase Admin Auth for testing authentication verification
 */
class MockAdminAuth {
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

async function runSyncFoundationTests() {
  console.log('====================================================');
  console.log('  RUNNING FINAL TRUSTED FIRESTORE AUTHORITY TESTS   ');
  console.log('====================================================\n');

  const mockDb = new MockFirestoreAdmin();
  const mockAuth = new MockAdminAuth();

  // Wire mock instances into adminFirebase
  setAdminDbForTesting(mockDb);
  setAdminAuthForTesting(mockAuth);

  const testToken = 'valid-test-token-12345';
  const testUserId = 'auth-uid-farmer-777';
  mockAuth.registerToken(testToken, { uid: testUserId, email: 'farmer777@farm.com' });

  // Configure SyncEngine dispatcher
  SyncEngine.setDispatcher({
    push: (req) => ServerSyncService.processPush(req.userId, req.changes),
    pull: (req) => ServerSyncService.processPull(req.userId, req.sinceCursor)
  });

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
  // TEST 1: Server Auth Boundary - Reject Missing / Invalid Token
  // --------------------------------------------------------------------------
  await test('Server Auth Boundary: Rejects missing or invalid Bearer token with HTTP 401', async () => {
    let statusSet = 0;
    let jsonSent: any = null;

    const mockRes: any = {
      status: (code: number) => {
        statusSet = code;
        return {
          json: (data: any) => { jsonSent = data; }
        };
      }
    };

    // 1. Missing Authorization header
    const reqNoHeader: any = { headers: {} };
    await requireAuth(reqNoHeader as AuthenticatedRequest, mockRes, () => {});
    assert(statusSet === 401, `Must set status 401 on missing header, got ${statusSet}`);
    assert(jsonSent?.error?.includes('Missing or invalid'), 'Must return missing/invalid error message');

    // 2. Invalid Token
    const reqInvalidToken: any = { headers: { authorization: 'Bearer bad-token-999' } };
    await requireAuth(reqInvalidToken as AuthenticatedRequest, mockRes, () => {});
    assert(statusSet === 401, `Must set status 401 on invalid token, got ${statusSet}`);
    assert(jsonSent?.error?.includes('Invalid or expired'), 'Must return invalid/expired error message');

    // 3. Valid Token -> Calls next() and sets req.userUid
    let nextCalled = false;
    const reqValid: any = { headers: { authorization: `Bearer ${testToken}` } };
    await requireAuth(reqValid as AuthenticatedRequest, mockRes, () => { nextCalled = true; });
    assert(nextCalled, 'next() must be called on valid token');
    assert(reqValid.userUid === testUserId, `req.userUid must be set to verified token UID ${testUserId}`);
  });

  // --------------------------------------------------------------------------
  // TEST 2: Server Push - Version & Monotonic Cursor Assignment in Firestore
  // --------------------------------------------------------------------------
  await test('Firestore Authority: Assigns record_sync_version=1 and monotonic change_cursor=1 on initial creation', async () => {
    const changes: SyncChangeItem[] = [
      {
        entityType: 'buyers',
        entityId: 'buyer_101',
        operation: 'UPSERT',
        baseVersion: 0,
        payload: {
          id: 'buyer_101',
          name: 'Juan Dela Cruz',
          contactNumber: '09171234567',
          address: 'Poblacion',
          notes: 'Primary Buyer',
          createdDate: '2026-09-28',
          status: 'ACTIVE'
        }
      }
    ];

    const res = await ServerSyncService.processPush(testUserId, changes);
    assert(res.currentServerCursor === 1, `Server cursor must advance to 1, got ${res.currentServerCursor}`);
    assert(res.results.length === 1, 'Must return 1 result item');
    assert(res.results[0].status === 'APPLIED', `Status must be APPLIED, got ${res.results[0].status}`);
    assert(res.results[0].newVersion === 1, `Assigned version must be 1, got ${res.results[0].newVersion}`);
    assert(res.results[0].newCursor === 1, `Assigned cursor must be 1, got ${res.results[0].newCursor}`);
    assert(!!res.results[0].lastSyncedAt, 'lastSyncedAt timestamp must be returned');

    // Verify Firestore document presence
    const docSnap = await mockDb.doc(`users/${testUserId}/business_data/buyers_buyer_101`).get();
    assert(docSnap.exists, 'Document must be written to Firestore business_data');
    assert(docSnap.data()?.name === 'Juan Dela Cruz', 'Document content must match');

    // Verify Firestore change_log presence
    const logSnap = await mockDb.doc(`users/${testUserId}/_sync/change_log_1`).get();
    assert(logSnap.exists, 'Changelog must be written to Firestore _sync');
    assert(logSnap.data()?.cursor === 1, 'Changelog cursor must be 1');
  });

  // --------------------------------------------------------------------------
  // TEST 3: Sequential Version & Cursor Progression
  // --------------------------------------------------------------------------
  await test('Firestore Authority: Increments record_sync_version to 2 and change_cursor to 2 on subsequent update', async () => {
    const changes: SyncChangeItem[] = [
      {
        entityType: 'buyers',
        entityId: 'buyer_101',
        operation: 'UPSERT',
        baseVersion: 1,
        payload: {
          id: 'buyer_101',
          name: 'Juan Dela Cruz Corp',
          contactNumber: '09171234567',
          address: 'Poblacion Ext.',
          notes: 'Updated commercial terms',
          createdDate: '2026-09-28',
          status: 'ACTIVE'
        }
      }
    ];

    const res = await ServerSyncService.processPush(testUserId, changes);
    assert(res.currentServerCursor === 2, `Server cursor must advance to 2, got ${res.currentServerCursor}`);
    assert(res.results[0].status === 'APPLIED', 'Status must be APPLIED');
    assert(res.results[0].newVersion === 2, `Assigned version must be 2, got ${res.results[0].newVersion}`);
    assert(res.results[0].newCursor === 2, `Assigned cursor must be 2, got ${res.results[0].newCursor}`);
  });

  // --------------------------------------------------------------------------
  // TEST 4: Optimistic Concurrency Control (OCC) - Stale Base Version Rejection
  // --------------------------------------------------------------------------
  await test('Optimistic Concurrency: Rejects update with stale baseVersion < serverVersion without mutating server record', async () => {
    const staleChanges: SyncChangeItem[] = [
      {
        entityType: 'buyers',
        entityId: 'buyer_101',
        operation: 'UPSERT',
        baseVersion: 0, // Stale base version (server is at version 2)
        payload: {
          id: 'buyer_101',
          name: 'Stale Name Attempt',
          contactNumber: '0000000',
          address: 'Unknown',
          notes: 'Stale payload',
          createdDate: '2026-09-28',
          status: 'ACTIVE'
        }
      }
    ];

    const res = await ServerSyncService.processPush(testUserId, staleChanges);
    assert(res.results[0].status === 'CONFLICT', `Status must be CONFLICT, got ${res.results[0].status}`);
    assert(res.results[0].serverVersion === 2, `Server version returned must be 2, got ${res.results[0].serverVersion}`);
    assert(res.results[0].serverRecord.name === 'Juan Dela Cruz Corp', 'Server record in Firestore must remain uncorrupted');
    assert(res.currentServerCursor === 2, 'Server cursor must not advance on rejected conflict');
  });

  // --------------------------------------------------------------------------
  // TEST 5: Financial Immutability & Void-Wins Semantics
  // --------------------------------------------------------------------------
  await test('Void-Wins Semantics: Voided record cannot be unvoided or overwritten by active updates', async () => {
    // 1. Create a sale
    const saleCreate: SyncChangeItem[] = [
      {
        entityType: 'sales',
        entityId: 'sale_201',
        operation: 'UPSERT',
        baseVersion: 0,
        payload: {
          id: 'sale_201',
          date: '2026-09-28',
          crop: 'Rice',
          quantity: 1000,
          unit: 'kg',
          unitPriceCentavos: 2500,
          grossAmountCentavos: 2500000,
          buyerId: 'buyer_101',
          buyerNameSnapshot: 'Juan Dela Cruz',
          isVoided: false,
          createdAt: '2026-09-28T00:00:00Z',
          updatedAt: '2026-09-28T00:00:00Z'
        }
      }
    ];
    const createRes = await ServerSyncService.processPush(testUserId, saleCreate);
    assert(createRes.results[0].status === 'APPLIED', 'Sale creation must succeed');

    // 2. Void the sale
    const saleVoid: SyncChangeItem[] = [
      {
        entityType: 'sales',
        entityId: 'sale_201',
        operation: 'VOID',
        baseVersion: 1,
        payload: {
          id: 'sale_201',
          date: '2026-09-28',
          crop: 'Rice',
          quantity: 1000,
          unit: 'kg',
          unitPriceCentavos: 2500,
          grossAmountCentavos: 2500000,
          buyerId: 'buyer_101',
          buyerNameSnapshot: 'Juan Dela Cruz',
          isVoided: true, // VOIDED
          createdAt: '2026-09-28T00:00:00Z',
          updatedAt: '2026-09-28T01:00:00Z'
        }
      }
    ];
    const voidRes = await ServerSyncService.processPush(testUserId, saleVoid);
    assert(voidRes.results[0].status === 'APPLIED', 'Sale void must succeed');
    assert(voidRes.results[0].newVersion === 2, 'Sale version must become 2');

    // 3. Attempt to push an active update to the voided sale -> Must be rejected with CONFLICT
    const unvoidAttempt: SyncChangeItem[] = [
      {
        entityType: 'sales',
        entityId: 'sale_201',
        operation: 'UPSERT',
        baseVersion: 2,
        payload: {
          id: 'sale_201',
          date: '2026-09-28',
          crop: 'Rice',
          quantity: 1200,
          unit: 'kg',
          unitPriceCentavos: 2500,
          grossAmountCentavos: 3000000,
          buyerId: 'buyer_101',
          buyerNameSnapshot: 'Juan Dela Cruz',
          isVoided: false, // Attempt to unvoid
          createdAt: '2026-09-28T00:00:00Z',
          updatedAt: '2026-09-28T02:00:00Z'
        }
      }
    ];
    const unvoidRes = await ServerSyncService.processPush(testUserId, unvoidAttempt);
    assert(unvoidRes.results[0].status === 'CONFLICT', 'Unvoiding active update must be rejected with CONFLICT');
    assert(unvoidRes.results[0].serverRecord.isVoided === true, 'Server record must remain voided (void-wins)');
  });

  // --------------------------------------------------------------------------
  // TEST 6: Batch Atomicity - Multi-Record Transaction Commit
  // --------------------------------------------------------------------------
  await test('Batch Atomicity: Multi-record push commits all documents, changelogs, and cursors atomically in Firestore transaction', async () => {
    const multiChanges: SyncChangeItem[] = [
      {
        entityType: 'suppliers',
        entityId: 'supp_301',
        operation: 'UPSERT',
        baseVersion: 0,
        payload: {
          id: 'supp_301',
          name: 'Agri Supply Corp',
          contactNumber: '09181234567',
          address: 'Highway',
          notes: 'Primary seed supplier',
          createdDate: '2026-09-28',
          status: 'ACTIVE'
        }
      },
      {
        entityType: 'expenses',
        entityId: 'exp_401',
        operation: 'UPSERT',
        baseVersion: 0,
        payload: {
          id: 'exp_401',
          date: '2026-09-28',
          category: 'Fertilizer',
          amountIncurredCentavos: 500000,
          amountPaidCentavos: 500000,
          description: 'Urea 50kg',
          supplierId: 'supp_301',
          isVoided: false,
          createdAt: '2026-09-28T00:00:00Z',
          updatedAt: '2026-09-28T00:00:00Z'
        }
      }
    ];

    const res = await ServerSyncService.processPush(testUserId, multiChanges);
    assert(res.results.length === 2, 'Must apply both records');
    assert(res.results[0].status === 'APPLIED' && res.results[1].status === 'APPLIED', 'Both must be APPLIED');
    assert(res.results[1].newCursor! > res.results[0].newCursor!, 'Cursors must be strictly monotonic');

    // Verify both are present in Firestore
    const suppSnap = await mockDb.doc(`users/${testUserId}/business_data/suppliers_supp_301`).get();
    const expSnap = await mockDb.doc(`users/${testUserId}/business_data/expenses_exp_401`).get();
    assert(suppSnap.exists && expSnap.exists, 'Both supplier and expense documents must exist in Firestore');
  });

  // --------------------------------------------------------------------------
  // TEST 7: Bootstrap Sync (Pull sinceCursor = 0)
  // --------------------------------------------------------------------------
  await test('Bootstrap Sync (sinceCursor = 0): Retrieves full user dataset and current cursor from Firestore', async () => {
    const pullRes = await ServerSyncService.processPull(testUserId, 0);
    assert(pullRes.isBootstrap === true, 'Must return isBootstrap = true');
    assert(pullRes.currentServerCursor >= 5, `Cursor must reflect all applied writes, got ${pullRes.currentServerCursor}`);
    assert(!!pullRes.dataset, 'Dataset must be returned');
    assert(pullRes.dataset.buyers.length >= 1, 'Buyers must be populated in bootstrap');
    assert(pullRes.dataset.sales.length >= 1, 'Sales must be populated in bootstrap');
    assert(pullRes.dataset.suppliers.length >= 1, 'Suppliers must be populated in bootstrap');
    assert(pullRes.dataset.expenses.length >= 1, 'Expenses must be populated in bootstrap');
  });

  // --------------------------------------------------------------------------
  // TEST 8: Incremental Cursor Sync (Pull sinceCursor = S)
  // --------------------------------------------------------------------------
  await test('Incremental Sync (sinceCursor = S): Replays only newer change-log entries from Firestore', async () => {
    const currentCursor = 3; // Pull changes after cursor 3
    const pullRes = await ServerSyncService.processPull(testUserId, currentCursor);
    assert(pullRes.isBootstrap === false, 'Must return isBootstrap = false');
    assert(Array.isArray(pullRes.changes), 'Changes array must be returned');
    assert(pullRes.changes.length > 0, 'Must return changelog items newer than cursor 3');
    assert(pullRes.changes.every((c) => c.cursor > currentCursor), 'All changes must have cursor > sinceCursor');
  });

  // --------------------------------------------------------------------------
  // TEST 9: Client SyncEngine - End-to-End Push & Local Metadata Updates
  // --------------------------------------------------------------------------
  await test('Client SyncEngine: Detects PENDING_UPLOAD, pushes to server boundary, and updates local records to SYNCED', async () => {
    StorageService.resetToCleanState();
    (global as any).localStorage.clear();

    // Create local buyer
    const buyer = StorageService.createBuyer({
      name: 'Sync Test Buyer',
      contactNumber: '09191112233',
      address: 'Barangay San Jose',
      notes: 'Local first'
    });

    const pending = SyncEngine.detectPendingChanges();
    assert(pending.length >= 1, 'Must detect newly created local buyer as PENDING_UPLOAD');

    const pushResult = await SyncEngine.pushPendingChanges(testUserId);
    assert(pushResult.appliedCount >= 1, 'Must apply local buyer');
    assert(pushResult.conflictCount === 0, 'No conflicts expected');

    // Verify local entity state in StorageService is updated to SYNCED
    const updatedBuyer = StorageService.getBuyers().find((b) => b.id === buyer.id);
    assert(updatedBuyer?.sync_state === 'SYNCED', 'Local buyer must transition to SYNCED');
    assert(updatedBuyer?.record_sync_version === 1, 'Local buyer version must be set to 1');
    assert(SyncEngine.getLastSyncCursor() > 0, 'Local sync cursor must be persisted');
  });

  // --------------------------------------------------------------------------
  // TEST 10: Client SyncEngine - Conflict Handling Without Overwriting Local State
  // --------------------------------------------------------------------------
  await test('Client SyncEngine: Handles conflict safely without corrupting local data', async () => {
    const db = StorageService.loadDatabase();
    const buyer = db.buyers[0];
    assert(!!buyer, 'Buyer must exist');

    // Simulate concurrent local change with stale baseVersion
    buyer.sync_state = 'PENDING_UPLOAD';
    buyer.record_sync_version = 0; // Stale version
    buyer.name = 'Local Edit Pending Conflict';
    StorageService.saveMemoryDatabase(db);

    const pushResult = await SyncEngine.pushPendingChanges(testUserId);
    assert(pushResult.conflictCount === 1, 'Must detect 1 conflict');

    // Verify local record is marked CONFLICT and local data is preserved
    const conflictedBuyer = StorageService.getBuyers().find((b) => b.id === buyer.id);
    assert(conflictedBuyer?.sync_state === 'CONFLICT', 'Conflicted buyer must transition to CONFLICT');
    assert(conflictedBuyer?.name === 'Local Edit Pending Conflict', 'Local data must NOT be overwritten');
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

runSyncFoundationTests().catch((err) => {
  console.error('Fatal sync test error:', err);
  process.exit(1);
});
