import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
  NextOrObserver
} from 'firebase/auth';
import { auth } from './firebase';
import { UserService, UserProfile } from './userService';

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
