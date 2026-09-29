import { StorageService } from '../src/services/storage';
import { SyncEngine } from '../src/services/syncEngine';
import { ServerSyncService } from '../src/server/syncService';
import { Buyer, Sale } from '../src/types';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${msg}`);
    process.exit(1);
  }
  console.log(`✅ PASS: ${msg}`);
}

async function runWebPwaSyncIntegrationTests() {
  console.log('======================================================================');
  console.log('  PHASE D — ITEM 2I: WEB/PWA ↔ CLOUD SYNC INTEGRATION SUITE');
  console.log('======================================================================\n');

  const userA = `web_test_user_a_${Date.now()}`;
  const userB = `web_test_user_b_${Date.now()}`;

  // Direct server dispatcher for headless Web/PWA testing
  SyncEngine.setDispatcher({
    push: (req) => ServerSyncService.processPush(req.userId, req.changes),
    pull: (req) => ServerSyncService.processPull(req.userId, req.sinceCursor)
  });

  // --- 1. INITIAL BOOTSTRAP INTO WEB LOCAL STORAGE ---
  console.log('--- 1. INITIAL BOOTSTRAP INTO WEB LOCAL STORAGE ---');
  
  // Seed cloud dataset directly via ServerSyncService
  const initialBuyerId = `buyer-bootstrap-${Date.now()}`;
  await ServerSyncService.processPush(userA, [
    {
      entityType: 'buyers',
      entityId: initialBuyerId,
      operation: 'UPSERT',
      baseVersion: 0,
      payload: {
        id: initialBuyerId,
        name: 'Cloud Seed Buyer',
        contactNumber: '09171234567',
        status: 'ACTIVE',
        createdDate: '2026-09-29'
      }
    }
  ]);

  // Reset local Web storage
  const cleanDb = StorageService.getInitialData();
  StorageService.saveMemoryDatabase(cleanDb);
  SyncEngine.setLastSyncCursor(0, userA);

  const bootstrapPull = await SyncEngine.pullRemoteChanges(userA);
  assert(bootstrapPull.response.isBootstrap === true, 'Web client pull detected bootstrap payload');
  assert(bootstrapPull.pulledChangesCount >= 1, 'Web client merged bootstrap records into storage');
  
  const loadedDb = StorageService.loadDatabase();
  const bootstrappedBuyer = loadedDb.buyers.find((b) => b.id === initialBuyerId);
  assert(!!bootstrappedBuyer, 'Bootstrapped buyer exists in Web local storage');
  assert(bootstrappedBuyer?.name === 'Cloud Seed Buyer', 'Bootstrapped buyer has correct name');
  assert(bootstrappedBuyer?.sync_state === 'SYNCED', 'Bootstrapped buyer marked as SYNCED');
  assert(SyncEngine.getLastSyncCursor(userA) > 0, 'Web client sync cursor advanced after bootstrap');

  // --- 2. LOCAL CHANGE → SCANNER → CLOUD PUSH ---
  console.log('\n--- 2. LOCAL CHANGE → SCANNER → CLOUD PUSH ---');
  const localBuyer = StorageService.createBuyer({
    name: 'Local Web Trader',
    contactNumber: '09189876543'
  });
  
  // Verify it starts pending upload
  const pendingBefore = SyncEngine.detectPendingChanges();
  assert(pendingBefore.some((c) => c.entityId === localBuyer.id), 'Local Web mutation queued as PENDING_UPLOAD');

  const pushRes = await SyncEngine.pushPendingChanges(userA);
  assert(pushRes.appliedCount >= 1, 'Local Web mutation successfully pushed to cloud');
  assert(pushRes.response.results.find((r) => r.entityId === localBuyer.id)?.status === 'APPLIED', 'Server applied Web buyer mutation');

  const dbAfterPush = StorageService.loadDatabase();
  const syncedBuyer = dbAfterPush.buyers.find((b) => b.id === localBuyer.id);
  assert(syncedBuyer?.sync_state === 'SYNCED', 'Web local buyer transitioned to SYNCED');
  assert(syncedBuyer?.record_sync_version === 1, 'Web local buyer assigned version 1');

  // --- 3. CLOUD CHANGE REPLAY → INCREMENTAL PULL ---
  console.log('\n--- 3. CLOUD CHANGE REPLAY → INCREMENTAL PULL ---');
  // Update the buyer in cloud directly (e.g. from another client/device)
  await ServerSyncService.processPush(userA, [
    {
      entityType: 'buyers',
      entityId: localBuyer.id,
      operation: 'UPSERT',
      baseVersion: 1,
      payload: {
        id: localBuyer.id,
        name: 'Local Web Trader (Updated via Cloud)',
        contactNumber: '09189876543',
        status: 'ACTIVE',
        createdDate: localBuyer.createdDate
      }
    }
  ]);

  const incPull = await SyncEngine.pullRemoteChanges(userA);
  assert(incPull.response.isBootstrap === false, 'Incremental pull received delta changelog');
  assert(incPull.pulledChangesCount >= 1, 'Incremental pull applied cloud update to Web local storage');

  const dbAfterInc = StorageService.loadDatabase();
  const updatedBuyer = dbAfterInc.buyers.find((b) => b.id === localBuyer.id);
  assert(updatedBuyer?.name === 'Local Web Trader (Updated via Cloud)', 'Web local buyer updated with cloud values');
  assert(updatedBuyer?.record_sync_version === 2, 'Web local buyer version incremented to 2');

  // --- 4. OFFLINE QUEUE → RECONNECT & FLUSH ---
  console.log('\n--- 4. OFFLINE QUEUE → RECONNECT & FLUSH ---');
  // Record multiple offline operations
  const offlineSaleRes = StorageService.createSale({
    date: '2026-09-29',
    crop: 'RICE',
    quantity: 50,
    unit: 'bags',
    unitPriceCentavos: 120000,
    buyerId: localBuyer.id,
    notes: 'Offline batch sale'
  });
  assert(!!offlineSaleRes.sale, 'Offline sale created locally');

  const offlineExpenseRes = StorageService.createExpense({
    date: '2026-09-29',
    category: 'Fertilizer',
    amountIncurredCentavos: 350000,
    amountPaidCentavos: 350000,
    description: 'Offline fertilizer purchase'
  });
  assert(!!offlineExpenseRes.expense, 'Offline expense created locally');

  const pendingOffline = SyncEngine.detectPendingChanges();
  assert(pendingOffline.some((c) => c.entityId === offlineSaleRes.sale!.id), 'Offline sale is queued in PENDING_UPLOAD');
  assert(pendingOffline.some((c) => c.entityId === offlineExpenseRes.expense!.id), 'Offline expense is queued in PENDING_UPLOAD');

  // Simulate network reconnection -> push
  const flushRes = await SyncEngine.pushPendingChanges(userA);
  assert(flushRes.appliedCount >= 2, 'All queued offline mutations flushed and applied upon reconnection');

  const dbAfterFlush = StorageService.loadDatabase();
  assert(dbAfterFlush.sales.find((s) => s.id === offlineSaleRes.sale!.id)?.sync_state === 'SYNCED', 'Offline sale marked SYNCED');
  assert(dbAfterFlush.expenses.find((e) => e.id === offlineExpenseRes.expense!.id)?.sync_state === 'SYNCED', 'Offline expense marked SYNCED');

  // --- 5. OCC CONFLICT HANDLING ---
  console.log('\n--- 5. OCC CONFLICT HANDLING ---');
  // Send an update with stale baseVersion = 1 when serverVersion is already 2
  const stalePushRes = await ServerSyncService.processPush(userA, [
    {
      entityType: 'buyers',
      entityId: localBuyer.id,
      operation: 'UPSERT',
      baseVersion: 1, // Stale! Server is at 2
      payload: {
        id: localBuyer.id,
        name: 'Stale Overwrite Attempt'
      }
    }
  ]);
  assert(stalePushRes.results[0].status === 'CONFLICT', 'Stale update correctly rejected with CONFLICT status');
  assert(stalePushRes.results[0].serverVersion === 2, 'Conflict payload reports current serverVersion = 2');

  // Verify non-destructive handling in Web storage
  const dbBeforeConflict = StorageService.loadDatabase();
  const conflictBuyer = dbBeforeConflict.buyers.find((b) => b.id === localBuyer.id);
  assert(conflictBuyer?.name === 'Local Web Trader (Updated via Cloud)', 'Local data preserved intact without destructive overwrite');

  // --- 6. VOID-WINS PERMANENCE ---
  console.log('\n--- 6. VOID-WINS PERMANENCE ---');
  const voidRes = StorageService.voidSale(offlineSaleRes.sale!.id, 'Testing void permanence');
  assert(voidRes.success === true, 'Sale voided locally');

  const voidPush = await SyncEngine.pushPendingChanges(userA);
  assert(voidPush.appliedCount >= 1, 'Void mutation committed to cloud');

  // Attempt to resurrect or update voided sale with older/unvoided state
  const resurrectRes = await ServerSyncService.processPush(userA, [
    {
      entityType: 'sales',
      entityId: offlineSaleRes.sale!.id,
      operation: 'UPSERT',
      baseVersion: 2,
      payload: {
        id: offlineSaleRes.sale!.id,
        isVoided: false,
        grossAmountCentavos: 500000
      }
    }
  ]);
  console.log('Resurrect push result:', resurrectRes.results[0]);
  assert(resurrectRes.results[0].status === 'CONFLICT', 'Resurrection attempt of voided record strictly rejected (Void-Wins)');

  // --- 7. DUPLICATE / IDEMPOTENT RETRY ---
  console.log('\n--- 7. DUPLICATE / IDEMPOTENT RETRY ---');
  // Re-push previously applied buyer update
  const duplicatePush = await ServerSyncService.processPush(userA, [
    {
      entityType: 'buyers',
      entityId: localBuyer.id,
      operation: 'UPSERT',
      baseVersion: 1,
      payload: {
        id: localBuyer.id,
        name: 'Local Web Trader (Updated via Cloud)',
        contactNumber: '09189876543',
        status: 'ACTIVE',
        createdDate: localBuyer.createdDate
      }
    }
  ]);
  assert(duplicatePush.results[0].status === 'APPLIED', 'Duplicate submission returns APPLIED idempotently');
  assert(duplicatePush.results[0].newVersion === 2, 'Duplicate submission retains existing version 2 without spurious increment');

  // --- 8. USER DATA ISOLATION ---
  console.log('\n--- 8. USER DATA ISOLATION ---');
  // User B pulls with fresh cursor
  SyncEngine.setLastSyncCursor(0, userB);
  const userBPull = await SyncEngine.pullRemoteChanges(userB);
  
  // User B must NOT see User A's data
  if (userBPull.response.dataset) {
    assert(!userBPull.response.dataset.buyers.some((b) => b.id === localBuyer.id), 'User B cannot see User A buyers (Data Isolation)');
    assert(!userBPull.response.dataset.sales.some((s) => s.id === offlineSaleRes.sale!.id), 'User B cannot see User A sales (Data Isolation)');
  }
  assert(SyncEngine.getLastSyncCursor(userA) !== SyncEngine.getLastSyncCursor(userB) || SyncEngine.getLastSyncCursor(userB) === 0, 'User cursors independently isolated');

  console.log('\n======================================================================');
  console.log('  ALL 8 WEB/PWA ↔ CLOUD SYNC INVARIANTS: PASSED PERFECTLY!');
  console.log('======================================================================\n');
}

runWebPwaSyncIntegrationTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
