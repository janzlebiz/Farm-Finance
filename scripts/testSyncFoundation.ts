import { ServerSyncService } from '../src/server/syncService';
import { SyncEngine } from '../src/services/syncEngine';
import { StorageService } from '../src/services/storage';
import { SyncChangeItem, SyncPushRequest, SyncPullRequest } from '../src/types/sync';

// In-memory mock storage for tests
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

async function runSyncFoundationTests() {
  console.log('====================================================');
  console.log('  RUNNING PHASE D — ITEM 2F SYNC FOUNDATION TESTS   ');
  console.log('====================================================\n');

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

  const testUserId = `test-user-${Date.now()}`;

  // --------------------------------------------------------------------------
  // TEST 1: Server Push - Version & Monotonic Cursor Assignment
  // --------------------------------------------------------------------------
  await test('Server Push: Assigns record_sync_version=1 and monotonic change_cursor=1 on initial creation', async () => {
    const pushReq: SyncPushRequest = {
      userId: testUserId,
      changes: [
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
      ]
    };

    const res = await ServerSyncService.processPush(pushReq);
    assert(res.currentServerCursor === 1, `Server cursor must advance to 1, got ${res.currentServerCursor}`);
    assert(res.results.length === 1, 'Must return 1 result item');
    assert(res.results[0].status === 'APPLIED', `Status must be APPLIED, got ${res.results[0].status}`);
    assert(res.results[0].newVersion === 1, `Assigned version must be 1, got ${res.results[0].newVersion}`);
    assert(res.results[0].newCursor === 1, `Assigned cursor must be 1, got ${res.results[0].newCursor}`);
    assert(!!res.results[0].lastSyncedAt, 'lastSyncedAt timestamp must be returned');
  });

  // --------------------------------------------------------------------------
  // TEST 2: Server Push - Sequential Version & Cursor Increment
  // --------------------------------------------------------------------------
  await test('Server Push: Increments record_sync_version to 2 and change_cursor to 2 on subsequent update', async () => {
    const pushReq: SyncPushRequest = {
      userId: testUserId,
      changes: [
        {
          entityType: 'buyers',
          entityId: 'buyer_101',
          operation: 'UPSERT',
          baseVersion: 1, // Correct base version matching server
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
      ]
    };

    const res = await ServerSyncService.processPush(pushReq);
    assert(res.currentServerCursor === 2, `Server cursor must advance to 2, got ${res.currentServerCursor}`);
    assert(res.results[0].status === 'APPLIED', 'Status must be APPLIED');
    assert(res.results[0].newVersion === 2, `Assigned version must be 2, got ${res.results[0].newVersion}`);
    assert(res.results[0].newCursor === 2, `Assigned cursor must be 2, got ${res.results[0].newCursor}`);
  });

  // --------------------------------------------------------------------------
  // TEST 3: Optimistic Concurrency - Stale Base Version Conflict Rejection
  // --------------------------------------------------------------------------
  await test('Optimistic Concurrency: Rejects update with stale baseVersion < serverVersion without mutating server record', async () => {
    const stalePushReq: SyncPushRequest = {
      userId: testUserId,
      changes: [
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
      ]
    };

    const res = await ServerSyncService.processPush(stalePushReq);
    assert(res.results[0].status === 'CONFLICT', `Status must be CONFLICT, got ${res.results[0].status}`);
    assert(res.results[0].serverVersion === 2, `Server version returned must be 2, got ${res.results[0].serverVersion}`);
    assert(res.results[0].serverRecord.name === 'Juan Dela Cruz Corp', 'Server record must remain uncorrupted');
    assert(res.currentServerCursor === 2, 'Server cursor must not advance on rejected conflict');
  });

  // --------------------------------------------------------------------------
  // TEST 4: Financial Immutability & Void-Wins Semantics
  // --------------------------------------------------------------------------
  await test('Void-Wins Semantics: Voided record cannot be unvoided or overwritten by active updates', async () => {
    // 1. Create a sale
    const saleCreateReq: SyncPushRequest = {
      userId: testUserId,
      changes: [
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
      ]
    };
    const createRes = await ServerSyncService.processPush(saleCreateReq);
    assert(createRes.results[0].status === 'APPLIED', 'Sale creation must succeed');

    // 2. Void the sale
    const saleVoidReq: SyncPushRequest = {
      userId: testUserId,
      changes: [
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
      ]
    };
    const voidRes = await ServerSyncService.processPush(saleVoidReq);
    assert(voidRes.results[0].status === 'APPLIED', 'Sale void must succeed');
    assert(voidRes.results[0].newVersion === 2, 'Sale version must become 2');

    // 3. Attempt to push an active update to the voided sale -> Must be rejected with CONFLICT
    const unvoidAttemptReq: SyncPushRequest = {
      userId: testUserId,
      changes: [
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
      ]
    };
    const unvoidRes = await ServerSyncService.processPush(unvoidAttemptReq);
    assert(unvoidRes.results[0].status === 'CONFLICT', 'Unvoiding active update must be rejected with CONFLICT');
    assert(unvoidRes.results[0].serverRecord.isVoided === true, 'Server record must remain voided (void-wins)');
  });

  // --------------------------------------------------------------------------
  // TEST 5: Bootstrap Sync (Pull sinceCursor = 0)
  // --------------------------------------------------------------------------
  await test('Bootstrap Sync (sinceCursor = 0): Retrieves full user dataset and current cursor', async () => {
    const pullReq: SyncPullRequest = {
      userId: testUserId,
      sinceCursor: 0
    };

    const pullRes = await ServerSyncService.processPull(pullReq);
    assert(pullRes.isBootstrap === true, 'Must return isBootstrap = true');
    assert(pullRes.currentServerCursor >= 4, `Cursor must reflect all applied writes, got ${pullRes.currentServerCursor}`);
    assert(!!pullRes.dataset, 'Dataset must be returned');
    assert(pullRes.dataset.buyers.length >= 1, 'Buyers must be populated in bootstrap');
    assert(pullRes.dataset.sales.length >= 1, 'Sales must be populated in bootstrap');
  });

  // --------------------------------------------------------------------------
  // TEST 6: Incremental Cursor Sync (Pull sinceCursor = S)
  // --------------------------------------------------------------------------
  await test('Incremental Sync (sinceCursor = S): Replays only newer change-log entries', async () => {
    const currentCursor = 3; // Pull changes after cursor 3
    const pullReq: SyncPullRequest = {
      userId: testUserId,
      sinceCursor: currentCursor
    };

    const pullRes = await ServerSyncService.processPull(pullReq);
    assert(pullRes.isBootstrap === false, 'Must return isBootstrap = false');
    assert(Array.isArray(pullRes.changes), 'Changes array must be returned');
    assert(pullRes.changes.every((c) => c.cursor > currentCursor), 'All changes must have cursor > sinceCursor');
  });

  // --------------------------------------------------------------------------
  // TEST 7: Client SyncEngine - End-to-End Push & Local Metadata Updates
  // --------------------------------------------------------------------------
  await test('Client SyncEngine: Detects PENDING_UPLOAD, pushes to server, and updates local records to SYNCED', async () => {
    StorageService.resetToCleanState();
    (global as any).localStorage.clear();

    // Create local buyer and local expense
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
  // TEST 8: Client SyncEngine - Conflict Handling Without Overwriting Local State
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
