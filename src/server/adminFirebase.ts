import { initializeApp, getApps, getApp, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import appletConfig from '../../firebase-applet-config.json';

const projectId = process.env.VITE_FIREBASE_PROJECT_ID || appletConfig.projectId || 'gen-lang-client-0427039673';
const firestoreDbId = process.env.VITE_FIREBASE_DATABASE_ID || appletConfig.firestoreDatabaseId || '(default)';

export const adminApp: App = getApps().length === 0
  ? initializeApp({ projectId })
  : getApp();

export const adminDb: Firestore = firestoreDbId && firestoreDbId !== '(default)'
  ? getFirestore(adminApp, firestoreDbId)
  : getFirestore(adminApp);
