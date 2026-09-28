import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { User } from 'firebase/auth';

export interface UserProfile {
  uid: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

export const UserService = {
  /**
   * Retrieves the user profile document at /users/{uid}
   */
  async getUserProfile(uid: string): Promise<UserProfile | null> {
    const userRef = doc(db, 'users', uid);
    const snapshot = await getDoc(userRef);
    if (!snapshot.exists()) {
      return null;
    }
    return snapshot.data() as UserProfile;
  },

  /**
   * Creates or updates the user profile document at /users/{uid} upon registration/sign-in
   */
  async createOrUpdateProfile(user: User): Promise<UserProfile> {
    const userRef = doc(db, 'users', user.uid);
    const now = new Date().toISOString();

    const existingSnap = await getDoc(userRef).catch(() => null);
    
    let profile: UserProfile;
    if (existingSnap && existingSnap.exists()) {
      const existingData = existingSnap.data() as Partial<UserProfile>;
      profile = {
        uid: user.uid,
        email: user.email || '',
        createdAt: existingData.createdAt || now,
        updatedAt: now
      };
      await setDoc(userRef, profile, { merge: true });
    } else {
      profile = {
        uid: user.uid,
        email: user.email || '',
        createdAt: now,
        updatedAt: now
      };
      await setDoc(userRef, profile);
    }

    return profile;
  }
};
