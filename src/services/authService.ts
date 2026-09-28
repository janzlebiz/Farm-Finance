import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
  NextOrObserver
} from 'firebase/auth';
import { auth } from './firebase';

export interface AuthState {
  user: User | null;
  isLoading: boolean;
}

export const AuthService = {
  /**
   * Sign in existing user with email and password
   */
  async signIn(email: string, password: string): Promise<User> {
    const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
    return userCredential.user;
  },

  /**
   * Register a new user with email and password
   */
  async register(email: string, password: string): Promise<User> {
    const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
    return userCredential.user;
  },

  /**
   * Sign out current user
   */
  async signOut(): Promise<void> {
    await firebaseSignOut(auth);
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
