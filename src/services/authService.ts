import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  reauthenticateWithCredential,
  EmailAuthProvider,
  User,
  NextOrObserver
} from 'firebase/auth';
import { doc, deleteDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { UserService, UserProfile } from './userService';
import { SyncEngine } from './syncEngine';
import { StorageService } from './storage';

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
    const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
    // Create the minimal user profile document at /users/{uid}
    await UserService.createOrUpdateProfile(userCredential.user).catch((err) => {
      console.warn('Could not create user profile document on registration:', err);
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

    await firebaseSignOut(auth);
  },

  /**
   * Secure account deletion with server-side / Firestore user data purge and Firebase Auth deletion.
   * Handles required re-authentication if password is provided.
   */
  async deleteAccount(password?: string): Promise<void> {
    const user = auth.currentUser;
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

    const uid = user.uid;

    // Purge user data from Firestore (/users/{uid})
    try {
      const userRef = doc(db, 'users', uid);
      await deleteDoc(userRef);
    } catch (err) {
      console.warn('Could not delete user Firestore document:', err);
    }

    // Delete Firebase Auth account
    try {
      await user.delete();
    } catch (err: any) {
      if (err.code === 'auth/requires-recent-login') {
        throw new Error('Recent authentication required to delete account. Please sign out, sign in again, and retry.');
      }
      throw err;
    }

    // Clear local user data & sync cursors
    StorageService.clearLocalUserData();
  },

  /**
   * Get current authenticated user synchronously
   */
  getCurrentUser(): User | null {
    return auth.currentUser;
  },

  /**
   * Subscribe to auth state changes (persisted session)
   */
  onAuthStateChanged(observer: NextOrObserver<User | null>) {
    return onAuthStateChanged(auth, observer);
  }
};
