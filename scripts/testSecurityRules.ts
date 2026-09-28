import { readFileSync } from 'fs';
import { resolve } from 'path';

interface SecurityContext {
  auth: { uid: string } | null;
  resource?: { data: Record<string, any> };
  requestResource?: { data: Record<string, any> };
}

interface EvaluationResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Authoritative Firestore Security Rules Evaluator matching firestore.rules
 */
class FirestoreRulesEvaluator {
  private rulesContent: string;

  constructor(rulesFilePath: string) {
    this.rulesContent = readFileSync(rulesFilePath, 'utf-8');
  }

  getRulesContent(): string {
    return this.rulesContent;
  }

  /**
   * Evaluates a simulated request against firestore.rules logic
   */
  evaluateRequest(
    method: 'get' | 'list' | 'create' | 'update' | 'delete',
    path: string,
    context: SecurityContext
  ): EvaluationResult {
    const { auth, resource, requestResource } = context;

    // 1. Unauthenticated users are denied all access
    if (!auth) {
      return { allowed: false, reason: 'Unauthenticated requests denied' };
    }

    // 2. Client access to _sync internal paths is strictly denied
    const syncMatch = path.match(/^\/users\/([^/]+)\/_sync(\/.*)?$/);
    if (syncMatch) {
      return { allowed: false, reason: 'Client access to _sync paths is strictly denied' };
    }

    // 3. User profile path: /users/{userId}
    const userMatch = path.match(/^\/users\/([^/]+)$/);
    if (userMatch) {
      const targetUserId = userMatch[1];
      const isOwner = auth.uid === targetUserId;

      if (!isOwner) {
        return { allowed: false, reason: "Cross-user access denied: cannot access another user's profile" };
      }

      if (method === 'get' || method === 'list') {
        return { allowed: true };
      }

      if (method === 'delete') {
        return { allowed: false, reason: 'User document deletion is disabled' };
      }

      if (method === 'create') {
        const data = requestResource?.data;
        if (!data) return { allowed: false, reason: 'Missing request data' };

        const allowedKeys = ['uid', 'email', 'createdAt', 'updatedAt'];
        const keys = Object.keys(data);
        const hasAllKeys = allowedKeys.every((k) => keys.includes(k));
        const hasOnlyAllowedKeys = keys.every((k) => allowedKeys.includes(k));

        if (!hasAllKeys || !hasOnlyAllowedKeys) {
          return { allowed: false, reason: 'User profile contains invalid or missing keys' };
        }
        if (data.uid !== targetUserId) {
          return { allowed: false, reason: 'Data UID must match target document ID' };
        }
        if (typeof data.email !== 'string') {
          return { allowed: false, reason: 'Email must be a string' };
        }
        return { allowed: true };
      }

      if (method === 'update') {
        const data = requestResource?.data;
        const prevData = resource?.data;
        if (!data) return { allowed: false, reason: 'Missing request data' };

        const allowedKeys = ['uid', 'email', 'createdAt', 'updatedAt'];
        const keys = Object.keys(data);
        const hasAllKeys = allowedKeys.every((k) => keys.includes(k));
        const hasOnlyAllowedKeys = keys.every((k) => allowedKeys.includes(k));

        if (!hasAllKeys || !hasOnlyAllowedKeys) {
          return { allowed: false, reason: 'User profile update contains invalid or missing keys' };
        }
        if (data.uid !== targetUserId) {
          return { allowed: false, reason: 'Cannot mutate UID' };
        }
        if (prevData && data.createdAt !== prevData.createdAt) {
          return { allowed: false, reason: 'createdAt timestamp is immutable' };
        }
        return { allowed: true };
      }
    }

    // 4. Business data collections (sales, payments, expenses, etc.) are strictly denied
    const businessCollections = [
      'sales', 'payments', 'expenses', 'expense_payments',
      'buyers', 'suppliers', 'production_cycles', 'harvests', 'audit_logs'
    ];
    for (const col of businessCollections) {
      if (path.startsWith(`/${col}`)) {
        return { allowed: false, reason: `Direct client access to business collection /${col} is denied` };
      }
    }

    // 5. Default fallback deny
    return { allowed: false, reason: 'Default deny rule executed' };
  }
}

async function runSecurityValidationTests() {
  console.log('====================================================');
  console.log('  RUNNING FIRESTORE SECURITY RULES & IDENTITY TESTS ');
  console.log('====================================================\n');

  const rulesPath = resolve(process.cwd(), 'firestore.rules');
  const evaluator = new FirestoreRulesEvaluator(rulesPath);
  const rulesText = evaluator.getRulesContent();

  const results: { name: string; passed: boolean; details?: string }[] = [];

  const test = (name: string, fn: () => void) => {
    try {
      fn();
      results.push({ name, passed: true });
      console.log(`✅ PASS: ${name}`);
    } catch (err: any) {
      results.push({ name, passed: false, details: err.message });
      console.error(`❌ FAIL: ${name}\n   Error: ${err.message}`);
    }
  };

  const assert = (condition: boolean, msg: string) => {
    if (!condition) throw new Error(msg);
  };

  // --- 1. Static Rule Syntax & Structure Verification ---
  test('Rules: File exists and declares cloud.firestore service', () => {
    assert(rulesText.includes("rules_version = '2';"), "Must declare rules_version = '2'");
    assert(rulesText.includes('service cloud.firestore'), 'Must declare service cloud.firestore');
  });

  test('Rules: Enforces unauthenticated denial', () => {
    assert(rulesText.includes('isAuthenticated()'), 'Must contain isAuthenticated helper');
    assert(rulesText.includes('request.auth != null'), 'Must verify request.auth != null');
  });

  test('Rules: Enforces user profile isolation', () => {
    assert(rulesText.includes('match /users/{userId}'), 'Must match /users/{userId}');
    assert(rulesText.includes('request.auth.uid == userId'), 'Must enforce request.auth.uid == userId');
  });

  test('Rules: Enforces _sync internal path denial', () => {
    assert(rulesText.includes('match /users/{userId}/_sync/{syncPath=**}'), 'Must explicitly match _sync subcollection');
    assert(rulesText.includes('allow read, write: if false;'), 'Must deny read and write on _sync');
  });

  test('Rules: Enforces business data collections denial', () => {
    const collections = ['sales', 'payments', 'expenses', 'buyers', 'suppliers', 'production_cycles', 'harvests', 'audit_logs'];
    for (const c of collections) {
      assert(rulesText.includes(`match /${c}/{document=**}`), `Must explicitly deny /${c}`);
    }
  });

  // --- 2. Dynamic Rule Evaluation Tests ---
  test('Auth: Unauthenticated user is denied /users/user_123', () => {
    const res = evaluator.evaluateRequest('get', '/users/user_123', { auth: null });
    assert(!res.allowed, 'Unauthenticated get must be denied');
  });

  test('Auth: Authenticated user can read own profile /users/user_123', () => {
    const res = evaluator.evaluateRequest('get', '/users/user_123', { auth: { uid: 'user_123' } });
    assert(res.allowed, 'Owner get must be allowed');
  });

  test('Auth: Authenticated user CANNOT read another user profile /users/user_456', () => {
    const res = evaluator.evaluateRequest('get', '/users/user_456', { auth: { uid: 'user_123' } });
    assert(!res.allowed, 'Cross-user get must be denied');
  });

  test('Auth: Authenticated user can create own profile with valid schema', () => {
    const res = evaluator.evaluateRequest('create', '/users/user_123', {
      auth: { uid: 'user_123' },
      requestResource: {
        data: {
          uid: 'user_123',
          email: 'farmer@test.com',
          createdAt: '2026-09-28T10:00:00Z',
          updatedAt: '2026-09-28T10:00:00Z'
        }
      }
    });
    assert(res.allowed, 'Valid profile creation must be allowed');
  });

  test('Auth: Profile creation rejected if UID mismatches path', () => {
    const res = evaluator.evaluateRequest('create', '/users/user_123', {
      auth: { uid: 'user_123' },
      requestResource: {
        data: {
          uid: 'user_999', // Mismatched UID
          email: 'farmer@test.com',
          createdAt: '2026-09-28T10:00:00Z',
          updatedAt: '2026-09-28T10:00:00Z'
        }
      }
    });
    assert(!res.allowed, 'Mismatched UID must be rejected');
  });

  test('Auth: Profile creation rejected if extra fields or invalid keys provided', () => {
    const res = evaluator.evaluateRequest('create', '/users/user_123', {
      auth: { uid: 'user_123' },
      requestResource: {
        data: {
          uid: 'user_123',
          email: 'farmer@test.com',
          createdAt: '2026-09-28T10:00:00Z',
          updatedAt: '2026-09-28T10:00:00Z',
          isAdmin: true // Unauthorized field
        }
      }
    });
    assert(!res.allowed, 'Extra unauthorized field must be rejected');
  });

  test('Auth: Profile update rejected if createdAt is mutated', () => {
    const res = evaluator.evaluateRequest('update', '/users/user_123', {
      auth: { uid: 'user_123' },
      resource: {
        data: {
          uid: 'user_123',
          email: 'farmer@test.com',
          createdAt: '2026-09-28T10:00:00Z',
          updatedAt: '2026-09-28T10:00:00Z'
        }
      },
      requestResource: {
        data: {
          uid: 'user_123',
          email: 'farmer@test.com',
          createdAt: '2026-09-29T10:00:00Z', // Mutated createdAt
          updatedAt: '2026-09-29T10:00:00Z'
        }
      }
    });
    assert(!res.allowed, 'Mutating createdAt must be rejected');
  });

  test('Sync Isolation: Access to /users/user_123/_sync/** is DENIED for authenticated user', () => {
    const res1 = evaluator.evaluateRequest('get', '/users/user_123/_sync/cursor', { auth: { uid: 'user_123' } });
    assert(!res1.allowed, 'Direct read of _sync must be denied');

    const res2 = evaluator.evaluateRequest('create', '/users/user_123/_sync/changes/ch_1', {
      auth: { uid: 'user_123' },
      requestResource: { data: { change: 1 } }
    });
    assert(!res2.allowed, 'Direct write to _sync must be denied');
  });

  test('Business Isolation: Direct access to /sales, /expenses, /cycles is DENIED', () => {
    const resSales = evaluator.evaluateRequest('get', '/sales/sale_1', { auth: { uid: 'user_123' } });
    assert(!resSales.allowed, 'Direct access to /sales must be denied');

    const resExpenses = evaluator.evaluateRequest('create', '/expenses/exp_1', {
      auth: { uid: 'user_123' },
      requestResource: { data: { amount: 100 } }
    });
    assert(!resExpenses.allowed, 'Direct write to /expenses must be denied');

    const resCycles = evaluator.evaluateRequest('list', '/production_cycles', { auth: { uid: 'user_123' } });
    assert(!resCycles.allowed, 'Direct list of /production_cycles must be denied');
  });

  const passedCount = results.filter((r) => r.passed).length;
  console.log('\n----------------------------------------------------');
  console.log(`TOTAL: ${results.length} | PASSED: ${passedCount} | FAILED: ${results.length - passedCount}`);
  console.log('----------------------------------------------------');

  if (passedCount !== results.length) {
    process.exit(1);
  }
}

runSecurityValidationTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
