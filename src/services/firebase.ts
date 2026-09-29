import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import appletConfig from '../../firebase-applet-config.json';

// Helper to safely read environment variables across Vite and Node/test environments
const getEnvVar = (key: string): string => {
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
    return import.meta.env[key] as string;
  }
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key] as string;
  }
  return '';
};

// Environment-based configuration with fallback to firebase-applet-config.json
export const firebaseConfig = {
  apiKey: getEnvVar('VITE_FIREBASE_API_KEY') || appletConfig.apiKey || '',
  authDomain: getEnvVar('VITE_FIREBASE_AUTH_DOMAIN') || appletConfig.authDomain || '',
  projectId: getEnvVar('VITE_FIREBASE_PROJECT_ID') || appletConfig.projectId || '',
  storageBucket: getEnvVar('VITE_FIREBASE_STORAGE_BUCKET') || appletConfig.storageBucket || '',
  messagingSenderId: getEnvVar('VITE_FIREBASE_MESSAGING_SENDER_ID') || appletConfig.messagingSenderId || '',
  appId: getEnvVar('VITE_FIREBASE_APP_ID') || appletConfig.appId || '',
  firestoreDatabaseId: getEnvVar('VITE_FIREBASE_DATABASE_ID') || appletConfig.firestoreDatabaseId || '(default)',
};

let cachedApp: FirebaseApp | null = null;
let cachedAuth: Auth | null = null;
let cachedDb: Firestore | null = null;
let initError: Error | null = null;

/**
 * Lazy, fail-safe accessor for Firebase App instance.
 * Never throws at module load time.
 */
export const getFirebaseApp = (): FirebaseApp | null => {
  if (cachedApp) return cachedApp;
  if (initError) return null;
  try {
    if (getApps().length > 0) {
      cachedApp = getApp();
    } else {
      if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
        console.warn('[Firebase] Incomplete Firebase configuration, skipping app initialization.');
        return null;
      }
      cachedApp = initializeApp(firebaseConfig);
    }
    return cachedApp;
  } catch (err: any) {
    initError = err instanceof Error ? err : new Error(String(err));
    console.error('[Firebase] Lazy app initialization failed:', err);
    return null;
  }
};

/**
 * Lazy, fail-safe accessor for Firebase Auth instance.
 */
export const getFirebaseAuth = (): Auth | null => {
  if (cachedAuth) return cachedAuth;
  const appInstance = getFirebaseApp();
  if (!appInstance) return null;
  try {
    cachedAuth = getAuth(appInstance);
    return cachedAuth;
  } catch (err: any) {
    console.error('[Firebase] Lazy auth initialization failed:', err);
    return null;
  }
};

/**
 * Lazy, fail-safe accessor for Firestore instance.
 */
export const getFirebaseDb = (): Firestore | null => {
  if (cachedDb) return cachedDb;
  const appInstance = getFirebaseApp();
  if (!appInstance) return null;
  try {
    cachedDb = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
      ? getFirestore(appInstance, firebaseConfig.firestoreDatabaseId)
      : getFirestore(appInstance);
    return cachedDb;
  } catch (err: any) {
    console.error('[Firebase] Lazy firestore initialization failed:', err);
    return null;
  }
};
