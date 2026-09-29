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
import { auth } from './firebase';
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
   * Secure account deletion with authenticated server-side cloud purge and Firebase Auth deletion.
   * Requires recent re-authentication and never silently continues if cloud purge fails.
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

    // Get fresh ID token for authenticated server request
    const token = await user.getIdToken(true);

    const response = await fetch('/api/auth/delete-account', {
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

    // Clear Android Room / Web local data ONLY after successful server-side cloud purge and auth deletion
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
