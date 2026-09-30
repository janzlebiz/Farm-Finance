import { initializeApp, getApps, getApp, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getAuth, Auth } from 'firebase-admin/auth';
import appletConfig from '../firebase-applet-config.json';

const EXPECTED_PROJECT_ID = 'farm-finance-510206';
const EXPECTED_DATABASE_ID = 'ai-studio-farmfinance-93149cfe-1ff5-4e4b-a384-aa96984b5b0f';

const projectId = appletConfig.projectId;
const firestoreDbId = appletConfig.firestoreDatabaseId;

if (projectId !== EXPECTED_PROJECT_ID) {
  throw new Error(`CRITICAL CONFIG ERROR: Expected Project ID ${EXPECTED_PROJECT_ID}, but found ${projectId}`);
}
if (firestoreDbId !== EXPECTED_DATABASE_ID) {
  throw new Error(`CRITICAL CONFIG ERROR: Expected Database ID ${EXPECTED_DATABASE_ID}, but found ${firestoreDbId}`);
}

console.log('[Firebase Admin] Initializing with project:', projectId);
console.log('[Firebase Admin] Initializing with database:', firestoreDbId);

export const adminApp: App = getApps().length === 0
  ? initializeApp({ projectId })
  : getApp();

let activeAdminDb: any = firestoreDbId && firestoreDbId !== '(default)'
  ? getFirestore(adminApp, firestoreDbId)
  : getFirestore(adminApp);

let activeAdminAuth: any = getAuth(adminApp);

export const adminDb: Firestore = new Proxy({} as Firestore, {
  get(_target, prop) {
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
