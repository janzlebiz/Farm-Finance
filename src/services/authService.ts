import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  reauthenticateWithCredential,
  EmailAuthProvider,
  GoogleAuthProvider,
  signInWithPopup,
  User,
  NextOrObserver
} from 'firebase/auth';
import { getFirebaseAuth } from './firebase';
import { UserService, UserProfile } from './userService';
import { SyncEngine } from './syncEngine';
import { StorageService } from './storage';
import { SyncClient } from './syncClient';

export interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  isLoading: boolean;
}

export const AuthService = {
  /**
   * Sign in existing user with email and password
   */
  async signIn(email: string, password: string): Promise<User> {
    const auth = getFirebaseAuth();
    if (!auth) {
      throw new Error('Firebase Authentication is not available on this device.');
    }
    const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
    // Ensure profile document is synchronized on sign in
    await UserService.createOrUpdateProfile(userCredential.user).catch((err) => {
      console.warn('Could not sync user profile document on sign-in:', err);
    });
    return userCredential.user;
  },

  /**
   * Register a new user with email and password and create their Firestore user document
   */
  async register(email: string, password: string): Promise<User> {
    const auth = getFirebaseAuth();
    if (!auth) {
      throw new Error('Firebase Authentication is not available on this device.');
    }
    const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
    // Create the minimal user profile document at /users/{uid}
    await UserService.createOrUpdateProfile(userCredential.user).catch((err) => {
      console.warn('Could not create user profile document on registration:', err);
    });
    return userCredential.user;
  },

  /**
   * Sign in with Google Popup
   */
  async signInWithGoogle(): Promise<User> {
    const auth = getFirebaseAuth();
    if (!auth) {
      throw new Error('Firebase Authentication is not available on this device.');
    }
    const provider = new GoogleAuthProvider();
    const userCredential = await signInWithPopup(auth, provider);
    await UserService.createOrUpdateProfile(userCredential.user).catch((err) => {
      console.warn('Could not sync user profile document on Google sign-in:', err);
    });
    return userCredential.user;
  },

  /**
   * Safe sign out with pending sync detection.
   * Prevents silent data loss of PENDING_UPLOAD data unless force = true.
   */
  async signOut(force: boolean = false): Promise<void> {
    const pendingChanges = SyncEngine.detectPendingChanges();
    if (pendingChanges.length > 0 && !force) {
      throw new Error(`Cannot sign out: ${pendingChanges.length} pending offline change(s) exist. Sync before signing out or use force sign-out.`);
    }

    // Safely clear local Web IndexedDB / memory data and sync cursors
    StorageService.clearLocalUserData();

    const auth = getFirebaseAuth();
    if (auth) {
      await firebaseSignOut(auth);
    }
  },

  /**
   * Secure account deletion with authenticated server-side cloud purge and Firebase Auth deletion.
   * Requires recent re-authentication and never silently continues if cloud purge fails.
   */
  async deleteAccount(password?: string): Promise<void> {
    const auth = getFirebaseAuth();
    const user = auth ? auth.currentUser : null;
    if (!user) {
      throw new Error('No authenticated user found for account deletion.');
    }

    if (password && user.email) {
      try {
        const credential = EmailAuthProvider.credential(user.email, password);
        await reauthenticateWithCredential(user, credential);
      } catch (err: any) {
        throw new Error(`Re-authentication failed: ${err.message || 'Invalid password'}`);
      }
    }

    // Get fresh ID token for authenticated server request
    const token = await user.getIdToken(true);
    const isNativeAvailable = typeof window !== 'undefined' && 
      Boolean((window as any).FarmFinanceNative?.nativeDeleteAccount);

    if (isNativeAvailable) {
      const rawRes = (window as any).FarmFinanceNative.nativeDeleteAccount(token);
      let res: { success: boolean; status: number; body: string; error?: string };
      try {
        res = JSON.parse(rawRes);
      } catch {
        throw new Error('Account deletion failed: Invalid response from native bridge.');
      }
      if (!res.success) {
        throw new Error(res.error || `Account deletion failed on server (Status: ${res.status}).`);
      }
    } else {
      const baseUrl = SyncClient.getBaseUrl();

      const response = await fetch(`${baseUrl}/api/auth/delete-account`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Account deletion and cloud purge failed on server.');
      }
    }

    // Clear Android Room / Web local data ONLY after successful server-side cloud purge and auth deletion
    StorageService.clearLocalUserData();
  },

  /**
   * Get current authenticated user synchronously
   */
  getCurrentUser(): User | null {
    const auth = getFirebaseAuth();
    return auth ? auth.currentUser : null;
  },

  /**
   * Subscribe to auth state changes (persisted session).
   * Safe against Firebase initialization failures.
   */
  onAuthStateChanged(observer: NextOrObserver<User | null>) {
    try {
      const auth = getFirebaseAuth();
      if (!auth) {
        if (typeof observer === 'function') {
          observer(null);
        } else if (observer && typeof observer.next === 'function') {
          observer.next(null);
        }
        return () => {};
      }
      return onAuthStateChanged(auth, observer);
    } catch (err) {
      console.warn('[AuthService] onAuthStateChanged subscription failed:', err);
      if (typeof observer === 'function') {
        observer(null);
      } else if (observer && typeof observer.next === 'function') {
        observer.next(null);
      }
      return () => {};
    }
  }
};
