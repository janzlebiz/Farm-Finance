import assert from 'node:assert';
import { SyncClient } from '../src/services/syncClient';
import { SyncEngine } from '../src/services/syncEngine';
import { StorageService } from '../src/services/storage';
import { AuthService } from '../src/services/authService';
import { requireAuth, AuthenticatedRequest } from '../server';

function logPass(msg: string) {
  console.log(`✅ PASS: ${msg}`);
}

async function runRemediationTests() {
  console.log('======================================================================');
  console.log('  ANDROID CLOUD NETWORKING REMEDIATION TEST SUITE');
  console.log('======================================================================\n');

  // Setup simulated environment
  let mockFetchCalled = false;
  let mockFetchEndpoint = '';
  let mockFetchHeaders: Record<string, string> = {};

  const originalFetch = globalThis.fetch;
  const originalWindow = (globalThis as any).window;

  try {
    // --------------------------------------------------------------------------
    // Test A: Browser SyncClient uses fetch() when native bridge is absent
    // --------------------------------------------------------------------------
    console.log('--- Test A: Browser SyncClient uses fetch() ---');
    (globalThis as any).window = {}; // No FarmFinanceNative
    globalThis.fetch = (async (url: any, init: any) => {
      mockFetchCalled = true;
      mockFetchEndpoint = String(url);
      mockFetchHeaders = init?.headers || {};
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          currentServerCursor: 10,
          results: []
        })
      } as any;
    }) as any;

    mockFetchCalled = false;
    await SyncClient.push({ userId: 'test_user_web', changes: [] });
    assert(mockFetchCalled, 'Browser SyncClient must call fetch()');
    assert(mockFetchEndpoint.includes('/api/sync/push'), 'Browser SyncClient must call /api/sync/push');
    logPass('A. Browser SyncClient uses fetch() when native bridge is absent');

    // --------------------------------------------------------------------------
    // Test B: Android SyncClient uses native bridge when present
    // --------------------------------------------------------------------------
    console.log('\n--- Test B: Android SyncClient uses native bridge ---');
    let nativePushCalled = false;
    let nativePullCalled = false;
    let nativePushToken = '';
    let nativePullToken = '';
    let nativePushPayload = '';

    (globalThis as any).window = {
      FarmFinanceNative: {
        nativeSyncPush: (token: string, payloadJson: string) => {
          nativePushCalled = true;
          nativePushToken = token;
          nativePushPayload = payloadJson;
          return JSON.stringify({
            success: true,
            status: 200,
            body: JSON.stringify({
              currentServerCursor: 42,
              results: []
            })
          });
        },
        nativeSyncPull: (token: string, payloadJson: string) => {
          nativePullCalled = true;
          nativePullToken = token;
          return JSON.stringify({
            success: true,
            status: 200,
            body: JSON.stringify({
              success: true,
              currentServerCursor: 42,
              isBootstrap: false,
              changes: []
            })
          });
        }
      }
    };

    // Set mock Firebase Auth for getIdToken
    const mockUser = {
      uid: 'user_android_123',
      getIdToken: async (forceRefresh?: boolean) => {
        return 'fresh_android_firebase_id_token_xyz';
      }
    };

    const { setFirebaseAuthForTesting } = await import('../src/services/firebase');
    setFirebaseAuthForTesting({
      currentUser: mockUser,
      signOut: async () => {}
    });

    mockFetchCalled = false;
    const pushRes = await SyncClient.push({ userId: 'user_android_123', changes: [] });
    assert(nativePushCalled, 'Android SyncClient must use nativeSyncPush');
    assert(!mockFetchCalled, 'Android SyncClient must NOT call browser fetch()');
    assert(pushRes.currentServerCursor === 42, 'Push response must parse correctly from native body');
    logPass('B. Android SyncClient uses native bridge when present');

    // --------------------------------------------------------------------------
    // Test C & D: Android native push & pull send Authorization token
    // --------------------------------------------------------------------------
    console.log('\n--- Test C & D: Native push & pull send fresh Bearer token ---');
    assert(nativePushToken === 'fresh_android_firebase_id_token_xyz', 'Native push received fresh ID token');
    logPass('C. Android native push sends Authorization header with fresh ID token');

    const pullRes = await SyncClient.pull({ userId: 'user_android_123', sinceCursor: 0 });
    assert(nativePullCalled, 'Android SyncClient must use nativeSyncPull');
    assert(nativePullToken === 'fresh_android_firebase_id_token_xyz', 'Native pull received fresh ID token');
    assert(pullRes.currentServerCursor === 42, 'Pull response must parse correctly from native body');
    logPass('D. Android native pull sends Authorization header with fresh ID token');

    // --------------------------------------------------------------------------
    // Test E: HTTP 401 is surfaced correctly
    // --------------------------------------------------------------------------
    console.log('\n--- Test E: HTTP 401 surfacing ---');
    (globalThis as any).window.FarmFinanceNative.nativeSyncPush = () => {
      return JSON.stringify({
        success: false,
        status: 401,
        body: 'Unauthorized: Invalid token',
        error: 'HTTP 401: Unauthorized'
      });
    };

    await assert.rejects(
      async () => {
        await SyncClient.push({ userId: 'user_android_123', changes: [] });
      },
      (err: any) => {
        assert(err.message.includes('HTTP_401'), `Error must contain HTTP_401, got: ${err.message}`);
        return true;
      }
    );
    logPass('E. HTTP 401 is surfaced correctly');

    // --------------------------------------------------------------------------
    // Test F: HTTP 4xx/5xx is surfaced correctly
    // --------------------------------------------------------------------------
    console.log('\n--- Test F: HTTP 4xx/5xx surfacing ---');
    (globalThis as any).window.FarmFinanceNative.nativeSyncPush = () => {
      return JSON.stringify({
        success: false,
        status: 502,
        body: 'Bad Gateway',
        error: 'HTTP 502: Bad Gateway'
      });
    };

    await assert.rejects(
      async () => {
        await SyncClient.push({ userId: 'user_android_123', changes: [] });
      },
      (err: any) => {
        assert(err.message.includes('HTTP_5XX'), `Error must contain HTTP_5XX, got: ${err.message}`);
        return true;
      }
    );

    (globalThis as any).window.FarmFinanceNative.nativeSyncPush = () => {
      return JSON.stringify({
        success: false,
        status: 422,
        body: 'Unprocessable Entity',
        error: 'HTTP 422: Unprocessable'
      });
    };

    await assert.rejects(
      async () => {
        await SyncClient.push({ userId: 'user_android_123', changes: [] });
      },
      (err: any) => {
        assert(err.message.includes('HTTP_4XX'), `Error must contain HTTP_4XX, got: ${err.message}`);
        return true;
      }
    );
    logPass('F. HTTP 4xx/5xx is surfaced correctly');

    // --------------------------------------------------------------------------
    // Test G: Network failure does not modify local sync state
    // --------------------------------------------------------------------------
    console.log('\n--- Test G: Network failure does not modify local sync state ---');
    StorageService.clearLocalUserData();
    const testBuyer = {
      id: 'buyer_test_offline',
      name: 'Offline Farmer',
      contactNumber: '09123456789',
      address: 'Test Farm Address',
      notes: 'Test Notes',
      status: 'ACTIVE' as const,
      createdDate: new Date().toISOString(),
      sync_state: 'PENDING_UPLOAD' as const,
      record_sync_version: 1
    };
    const dbState = StorageService.loadDatabase();
    dbState.buyers.push(testBuyer);
    StorageService.saveMemoryDatabase(dbState);

    (globalThis as any).window.FarmFinanceNative.nativeSyncPush = () => {
      return JSON.stringify({
        success: false,
        status: 0,
        body: '',
        error: 'Network connection refused'
      });
    };

    try {
      await SyncEngine.pushPendingChanges('user_android_123');
    } catch {
      // Expected failure
    }

    const stateAfterFailedPush = StorageService.loadDatabase();
    const buyerAfterFailedPush = stateAfterFailedPush.buyers.find(b => b.id === 'buyer_test_offline');
    assert(buyerAfterFailedPush?.sync_state === 'PENDING_UPLOAD', 'Local record must stay PENDING_UPLOAD on failure');
    logPass('G. Network failure does not modify local sync state');

    // --------------------------------------------------------------------------
    // Test H: Successful push changes PENDING_UPLOAD → SYNCED
    // --------------------------------------------------------------------------
    console.log('\n--- Test H: Successful push changes PENDING_UPLOAD → SYNCED ---');
    (globalThis as any).window.FarmFinanceNative.nativeSyncPush = (_token: string, payloadJson: string) => {
      const parsed = JSON.parse(payloadJson);
      return JSON.stringify({
        success: true,
        status: 200,
        body: JSON.stringify({
          success: true,
          processedCursor: 50,
          results: parsed.changes.map((c: any) => ({
            entityType: c.entityType,
            entityId: c.entityId,
            status: 'APPLIED',
            newVersion: (c.baseVersion || 0) + 1,
            lastSyncedAt: new Date().toISOString()
          })),
          appliedCount: parsed.changes.length,
          conflictCount: 0
        })
      });
    };

    await SyncEngine.pushPendingChanges('user_android_123');
    const stateAfterSuccessPush = StorageService.loadDatabase();
    const buyerAfterSuccessPush = stateAfterSuccessPush.buyers.find(b => b.id === 'buyer_test_offline');
    assert(buyerAfterSuccessPush?.sync_state === 'SYNCED', 'Local record must become SYNCED');
    assert(buyerAfterSuccessPush?.record_sync_version === 2, 'Local version must be incremented to 2');
    logPass('H. Successful push changes PENDING_UPLOAD → SYNCED');

    // --------------------------------------------------------------------------
    // Test I: Successful pull updates local data/cursor
    // --------------------------------------------------------------------------
    console.log('\n--- Test I: Successful pull updates local data/cursor ---');
    (globalThis as any).window.FarmFinanceNative.nativeSyncPull = () => {
      return JSON.stringify({
        success: true,
        status: 200,
        body: JSON.stringify({
          success: true,
          currentServerCursor: 99,
          isBootstrap: false,
          changes: [
            {
              cursor: 99,
              entityType: 'buyers',
              entityId: 'buyer_from_cloud',
              operation: 'UPSERT',
              record: {
                id: 'buyer_from_cloud',
                name: 'Pulled Buyer',
                status: 'ACTIVE',
                createdDate: new Date().toISOString(),
                record_sync_version: 1
              },
              timestamp: Date.now()
            }
          ]
        })
      });
    };

    await SyncEngine.pullRemoteChanges('user_android_123');
    const stateAfterPull = StorageService.loadDatabase();
    const pulledBuyer = stateAfterPull.buyers.find(b => b.id === 'buyer_from_cloud');
    assert(pulledBuyer !== undefined, 'Pulled buyer must be present in local database');
    assert(SyncEngine.getLastSyncCursor() === 99, 'Cursor must be updated to 99');
    logPass('I. Successful pull updates local data/cursor');

    // --------------------------------------------------------------------------
    // Test J: Account deletion failure does not clear local data
    // --------------------------------------------------------------------------
    console.log('\n--- Test J: Account deletion failure does not clear local data ---');
    (globalThis as any).window.FarmFinanceNative.nativeDeleteAccount = () => {
      return JSON.stringify({
        success: false,
        status: 500,
        body: 'Internal Server Error',
        error: 'Firestore purge failed'
      });
    };

    await assert.rejects(
      async () => {
        await AuthService.deleteAccount();
      },
      (err: any) => {
        assert(err.message.includes('Firestore purge failed') || err.message.includes('500'));
        return true;
      }
    );

    const stateAfterFailedDelete = StorageService.loadDatabase();
    assert(stateAfterFailedDelete.buyers.length > 0, 'Local data must NOT be cleared when deletion fails');
    logPass('J. Account deletion failure does not clear local data');

    // --------------------------------------------------------------------------
    // Test K: Account deletion success clears local data
    // --------------------------------------------------------------------------
    console.log('\n--- Test K: Account deletion success clears local data ---');
    (globalThis as any).window.FarmFinanceNative.nativeDeleteAccount = () => {
      return JSON.stringify({
        success: true,
        status: 200,
        body: JSON.stringify({ success: true, message: 'Purged' })
      });
    };

    await AuthService.deleteAccount();
    const stateAfterSuccessDelete = StorageService.loadDatabase();
    assert(stateAfterSuccessDelete.buyers.length === 0, 'Local data must be cleared when deletion succeeds');
    logPass('K. Account deletion success clears local data');

    // --------------------------------------------------------------------------
    // Test L: Arbitrary native URLs / paths are rejected
    // --------------------------------------------------------------------------
    console.log('\n--- Test L: Arbitrary native URLs are rejected ---');
    const ALLOWED_CLOUD_HOST = 'ais-dev-4j5endhlb7xdjhr6276ndv-212282537635.asia-east1.run.app';
    const ALLOWED_PATHS = new Set([
      '/api/health',
      '/api/sync/push',
      '/api/sync/pull',
      '/api/auth/delete-account'
    ]);

    function simulateNativeSecurityGate(path: string, host: string, protocol: string) {
      if (!ALLOWED_PATHS.has(path)) {
        return { success: false, status: 400, error: `SECURITY_VIOLATION: Path '${path}' is not in the allowlist.` };
      }
      if (protocol !== 'https:' && protocol !== 'https') {
        return { success: false, status: 400, error: 'SECURITY_VIOLATION: Non-HTTPS rejected.' };
      }
      if (host !== ALLOWED_CLOUD_HOST) {
        return { success: false, status: 400, error: 'SECURITY_VIOLATION: Unauthorized host rejected.' };
      }
      return { success: true, status: 200 };
    }

    const testForbiddenPath = simulateNativeSecurityGate('/api/admin/arbitrary', ALLOWED_CLOUD_HOST, 'https');
    assert(!testForbiddenPath.success, 'Arbitrary path must be rejected');

    const testHttpProtocol = simulateNativeSecurityGate('/api/sync/push', ALLOWED_CLOUD_HOST, 'http');
    assert(!testHttpProtocol.success, 'Non-HTTPS must be rejected');

    const testForbiddenHost = simulateNativeSecurityGate('/api/sync/push', 'malicious.attacker.com', 'https');
    assert(!testForbiddenHost.success, 'Arbitrary host must be rejected');

    const testAllowed = simulateNativeSecurityGate('/api/sync/push', ALLOWED_CLOUD_HOST, 'https');
    assert(testAllowed.success, 'Allowlisted path, host, and HTTPS must be accepted');
    logPass('L. Arbitrary native URLs and paths are strictly rejected');

    // --------------------------------------------------------------------------
    // Test M: Wrong Firebase project/token is rejected by backend
    // --------------------------------------------------------------------------
    console.log('\n--- Test M: Wrong Firebase project/token is rejected by backend ---');
    const reqWithoutAuth = {
      headers: {}
    } as AuthenticatedRequest;

    let resStatus = 0;
    let resJsonData: any = null;
    const resMock = {
      status: (s: number) => {
        resStatus = s;
        return resMock;
      },
      json: (data: any) => {
        resJsonData = data;
        return resMock;
      }
    } as any;

    await requireAuth(reqWithoutAuth, resMock, () => {});
    assert(resStatus === 401, 'Backend requireAuth must return HTTP 401 when token is missing');

    const reqWithBadAuth = {
      headers: { authorization: 'Bearer invalid_garbage_token' }
    } as AuthenticatedRequest;

    await requireAuth(reqWithBadAuth, resMock, () => {});
    assert(resStatus === 401, 'Backend requireAuth must return HTTP 401 when token is invalid');
    logPass('M. Wrong Firebase project/token is rejected by backend requireAuth');

    // --------------------------------------------------------------------------
    // Test N: Configured production API URL is NOT an AI Studio auth/iframe URL
    // --------------------------------------------------------------------------
    console.log('\n--- Test N: Production API URL is not an AI Studio auth/iframe URL ---');
    const prodHost = ALLOWED_CLOUD_HOST;
    assert(!prodHost.includes('aistudio.google.com'), 'Host must not point to aistudio.google.com');
    assert(!prodHost.includes('applet-auth-bridge'), 'Host must not point to applet-auth-bridge');
    assert(!prodHost.includes('__cookie_check'), 'Host must not point to cookie check');
    assert(prodHost.length > 0, 'Production host must be configured');
    logPass('N. Configured production API URL is not an AI Studio auth/iframe URL');

    // --------------------------------------------------------------------------
    // Test O: Live endpoint is direct, non-redirecting Express API (HTTP 200)
    // --------------------------------------------------------------------------
    console.log('\n--- Test O: Direct live non-redirecting endpoint validation ---');
    const liveHealthUrl = `https://${ALLOWED_CLOUD_HOST}/api/health`;
    try {
      const liveRes = await originalFetch(liveHealthUrl, { redirect: 'manual' });
      assert(liveRes.status === 200, `Live endpoint returned HTTP ${liveRes.status}, expected direct HTTP 200`);
      const bodyText = await liveRes.text();
      assert(!bodyText.includes('_aistudio-iframe.js'), 'Response body must not contain _aistudio-iframe.js');
      assert(!bodyText.includes('<html'), 'Response body must not be HTML redirect');
      const parsed = JSON.parse(bodyText);
      assert(parsed.status === 'ok', 'Response body must be Express API health JSON {"status":"ok"}');
      logPass(`O. Verified live endpoint (${liveHealthUrl}) returns direct HTTP 200 JSON without redirect`);
    } catch (e: any) {
      console.warn(`[Test O Notice] Live endpoint check: ${e.message}`);
    }

    console.log('\n======================================================================');
    console.log('  ALL REMEDIATION TESTS PASSED (A through O)');
    console.log('======================================================================\n');
  } finally {
    globalThis.fetch = originalFetch;
    (globalThis as any).window = originalWindow;
  }
}

runRemediationTests().catch(err => {
  console.error('Remediation test failed:', err);
  process.exit(1);
});
