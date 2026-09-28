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

// Initialize Firebase App exactly once
export const app: FirebaseApp = getApps().length === 0
  ? initializeApp(firebaseConfig)
  : getApp();

// Initialize Auth instance
export const auth: Auth = getAuth(app);

// Initialize Firestore instance with specific database ID if provisioned
export const db: Firestore = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

export default app;
