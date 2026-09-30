import { initializeApp, getApps, getApp, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getAuth, Auth } from 'firebase-admin/auth';
import appletConfig from '../firebase-config.json';

const projectId = process.env.VITE_FIREBASE_PROJECT_ID || appletConfig.projectId || 'gen-lang-client-0427039673';
const firestoreDbId = process.env.VITE_FIREBASE_DATABASE_ID || appletConfig.firestoreDatabaseId || '(default)';

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
