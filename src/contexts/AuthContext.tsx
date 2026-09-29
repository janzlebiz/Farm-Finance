import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User } from 'firebase/auth';
import { AuthService } from '../services/authService';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: (password?: string) => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let resolved = false;
    // Listen to Firebase persistent auth state changes
    const unsubscribe = AuthService.onAuthStateChanged((currentUser) => {
      resolved = true;
      setUser(currentUser);
      setIsLoading(false);
    });

    // Safety timeout for WebView/offline environments where auth initialization might delay
    const timer = setTimeout(() => {
      if (!resolved) {
        setIsLoading(false);
      }
    }, 2500);

    return () => {
      resolved = true;
      clearTimeout(timer);
      unsubscribe();
    };
  }, []);

  const clearError = () => setError(null);

  const formatAuthError = (err: unknown): string => {
    if (err && typeof err === 'object' && 'code' in err) {
      const code = (err as { code: string }).code;
      switch (code) {
        case 'auth/invalid-email':
          return 'Invalid email address format.';
        case 'auth/user-disabled':
          return 'This user account has been disabled.';
        case 'auth/user-not-found':
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
          return 'Invalid email or password.';
        case 'auth/email-already-in-use':
          return 'An account with this email already exists.';
        case 'auth/weak-password':
          return 'Password should be at least 6 characters.';
        case 'auth/network-request-failed':
          return 'Network connection failed. Please check your internet.';
        default:
          return (err as { message?: string }).message || 'Authentication failed. Please try again.';
      }
    }
    return 'An unexpected error occurred during authentication.';
  };

  const signIn = async (email: string, password: string) => {
    setError(null);
    setIsLoading(true);
    try {
      await AuthService.signIn(email, password);
    } catch (err) {
      const message = formatAuthError(err);
      setError(message);
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (email: string, password: string) => {
    setError(null);
    setIsLoading(true);
    try {
      await AuthService.register(email, password);
    } catch (err) {
      const message = formatAuthError(err);
      setError(message);
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    setError(null);
    setIsLoading(true);
    try {
      await AuthService.signOut();
    } catch (err) {
      const message = formatAuthError(err);
      setError(message);
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteAccount = async (password?: string) => {
    setError(null);
    setIsLoading(true);
    try {
      await AuthService.deleteAccount(password);
    } catch (err) {
      const message = formatAuthError(err);
      setError(message);
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        error,
        signIn,
        register,
        signOut,
        deleteAccount,
        clearError
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
