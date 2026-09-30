import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import appletConfig from '../firebase-config.json';

// Helper to safely read environment variables across Vite and Node/test environments
const getEnvVar = (key: string): string => {
  let val = '';
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
    val = import.meta.env[key] as string;
  } else if (typeof process !== 'undefined' && process.env && process.env[key]) {
    val = process.env[key] as string;
  }
  
  // Guard against string "undefined" or "null"
  if (val === 'undefined' || val === 'null') return '';
  return val || '';
};

// Normalize config object
const config = {
  "projectId": "farm-finance-510206",
  "appId": "1:592186513548:web:583a03466e1b398dc443a9",
  "apiKey": "AIzaSyC9pYSiXe4J33dClvCUcnGO0tJM14hkp3g",
  "authDomain": "farm-finance-510206.firebaseapp.com",
  "firestoreDatabaseId": "ai-studio-farmfinance-93149cfe-1ff5-4e4b-a384-aa96984b5b0f",
  "storageBucket": "farm-finance-510206.firebasestorage.app",
  "messagingSenderId": "592186513548"
};
console.log('[Firebase] Hardcoded config object updated for project: farm-finance-510206');

export const firebaseConfig = {
  apiKey: config.apiKey || '',
  authDomain: config.authDomain || '',
  projectId: config.projectId || '',
  storageBucket: config.storageBucket || '',
  messagingSenderId: config.messagingSenderId || '',
  appId: config.appId || '',
  firestoreDatabaseId: config.firestoreDatabaseId || '(default)',
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
      const { apiKey, projectId } = firebaseConfig;
      if (!apiKey || !projectId || apiKey === 'undefined' || projectId === 'undefined') {
        console.error('[Firebase] Critical: Incomplete or invalid Firebase configuration. API Key or Project ID is missing.');
        return null;
      }
      cachedApp = initializeApp(firebaseConfig);
      console.log('[Firebase] App initialized successfully.');
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

export const setFirebaseAuthForTesting = (auth: any) => {
  cachedAuth = auth;
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
