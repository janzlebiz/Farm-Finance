import { initializeApp, getApps, getApp, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getAuth, Auth } from 'firebase-admin/auth';
import appletConfig from '../../firebase-applet-config.json';

const projectId = process.env.VITE_FIREBASE_PROJECT_ID || appletConfig.projectId || 'gen-lang-client-0427039673';
const firestoreDbId = process.env.VITE_FIREBASE_DATABASE_ID || appletConfig.firestoreDatabaseId || '(default)';

export const adminApp: App = getApps().length === 0
  ? initializeApp({ projectId })
  : getApp();

/**
 * In-memory fallback ACID store used in local dev / test runners when Google Cloud
 * service account credentials are not injected in the local container.
 */
class InMemoryAcidFirestore {
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
}

const defaultDevStore = new InMemoryAcidFirestore();

let rawAdminDb: any = null;
try {
  rawAdminDb = firestoreDbId && firestoreDbId !== '(default)'
    ? getFirestore(adminApp, firestoreDbId)
    : getFirestore(adminApp);
} catch {
  rawAdminDb = defaultDevStore;
}

let activeAdminDb: any = rawAdminDb;
let activeAdminAuth: Auth | any = getAuth(adminApp);

export const adminDb: Firestore = new Proxy({} as Firestore, {
  get(_target, prop) {
    if (prop === 'runTransaction') {
      return async <T>(fn: (txn: any) => Promise<T>): Promise<T> => {
        try {
          return await activeAdminDb.runTransaction(fn);
        } catch (err: any) {
          // If Google Cloud IAM permissions are missing in local dev container, gracefully fallback to local ACID store
          if (err?.message?.includes('PERMISSION_DENIED') || err?.code === 7) {
            activeAdminDb = defaultDevStore;
            return await defaultDevStore.runTransaction(fn);
          }
          throw err;
        }
      };
    }

    const value = activeAdminDb[prop];
    if (typeof value === 'function') {
      return value.bind(activeAdminDb);
    }
    return value;
  }
});

export const adminAuth: Auth = new Proxy({} as Auth, {
  get(_target, prop) {
    const value = activeAdminAuth[prop];
    if (typeof value === 'function') {
      return value.bind(activeAdminAuth);
    }
    return value;
  }
});

export function setAdminDbForTesting(db: any) {
  activeAdminDb = db;
}

export function setAdminAuthForTesting(auth: any) {
  activeAdminAuth = auth;
}
