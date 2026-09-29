import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { CloudSyncState } from '../hooks/useCloudSync';
import { LogIn, UserPlus, LogOut, CheckCircle2, AlertCircle, Loader2, KeyRound, Mail, ShieldCheck, RefreshCw, Trash2 } from 'lucide-react';

interface AuthModalProps {
  onClose: () => void;
  onSyncComplete?: () => void;
  cloudSync: CloudSyncState;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onClose, onSyncComplete, cloudSync }) => {
  const { user, isLoading, error, signIn, register, signInWithGoogle, signOut, deleteAccount, clearError } = useAuth();
  const { isSyncing, lastSyncedAt, syncError, pendingCount, conflictCount, syncNow } = cloudSync;
  const [mode, setMode] = useState<'signin' | 'register'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Delete account confirmation flow states
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [confirmDeleteText, setConfirmDeleteText] = useState('');

  const handleSwitchMode = (newMode: 'signin' | 'register') => {
    setMode(newMode);
    clearError();
    setLocalError(null);
    setActionSuccess(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setActionSuccess(null);

    if (!email.trim()) {
      setLocalError('Please enter your email address.');
      return;
    }

    if (!password) {
      setLocalError('Please enter your password.');
      return;
    }

    if (mode === 'register') {
      if (password.length < 6) {
        setLocalError('Password must be at least 6 characters.');
        return;
      }
      if (password !== confirmPassword) {
        setLocalError('Passwords do not match.');
        return;
      }
    }

    try {
      if (mode === 'signin') {
        await signIn(email, password);
        setActionSuccess('Successfully signed in!');
      } else {
        await register(email, password);
        setActionSuccess('Account created and signed in successfully!');
      }
      setEmail('');
      setPassword('');
      setConfirmPassword('');
    } catch {
      // Error tracked in AuthContext
    }
  };

  const handleSignOut = async () => {
    setLocalError(null);
    setActionSuccess(null);
    try {
      await signOut();
      setActionSuccess('Successfully signed out.');
    } catch {
      // Handled in context
    }
  };

  const handleDeleteAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setActionSuccess(null);

    if (!deletePassword) {
      setLocalError('Please enter your password for recent re-authentication.');
      return;
    }

    if (confirmDeleteText !== 'DELETE') {
      setLocalError('Please type DELETE to confirm permanent account deletion.');
      return;
    }

    try {
      await deleteAccount(deletePassword);
      setActionSuccess('Account and cloud data successfully deleted.');
      setShowDeleteConfirm(false);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch {
      // Error handled in AuthContext; local data is NOT cleared on failure
    }
  };

  const handleGoogleSignIn = async () => {
    setLocalError(null);
    setActionSuccess(null);
    try {
      await signInWithGoogle();
      setActionSuccess('Successfully signed in with Google!');
    } catch {
      // Handled in context
    }
  };

  const activeError = localError || error;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-emerald-800 text-white px-5 py-4 flex items-center justify-between rounded-t-2xl">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-700/80">
              <ShieldCheck className="w-5 h-5 text-emerald-200" />
            </div>
            <div>
              <h2 className="text-base font-bold">Cloud Account & Identity</h2>
              <p className="text-[11px] text-emerald-200">Phase D · Secure User Profile Foundation</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-emerald-200 hover:bg-emerald-700/80 hover:text-white transition"
          >
            ✕
          </button>
        </div>

        <div className="p-5 space-y-4">
          
          {/* Status alerts */}
          {activeError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2 animate-in fade-in duration-150">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{activeError}</span>
            </div>
          )}

          {actionSuccess && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2 animate-in fade-in duration-150">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{actionSuccess}</span>
            </div>
          )}

          {/* Authenticated State Display */}
          {user ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-emerald-900 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Authenticated Session Active
                  </span>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-emerald-200 text-emerald-900 rounded-full">
                    Online
                  </span>
                </div>
                <div className="space-y-1.5 text-xs text-slate-700 pt-1">
                  <div className="flex items-center justify-between border-b border-emerald-100/80 pb-1">
                    <span className="text-slate-500">Email:</span>
                    <span className="font-semibold text-slate-900">{user.email || 'Anonymous'}</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-emerald-100/80 pb-1">
                    <span className="text-slate-500">User UID:</span>
                    <span className="font-mono text-[10px] text-slate-600 truncate max-w-[190px]" title={user.uid}>
                      {user.uid}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-0.5">
                    <span className="text-slate-500">Firestore Profile:</span>
                    <span className="font-mono text-[10px] text-emerald-800 font-medium">/users/{user.uid}</span>
                  </div>
                </div>
              </div>

              {/* Cloud Sync Status & Actions */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-slate-800">
                    <RefreshCw className={`w-3.5 h-3.5 text-emerald-700 ${isSyncing ? 'animate-spin' : ''}`} />
                    <span>Cloud Synchronization</span>
                  </div>
                  <span className="text-[10px] font-semibold text-slate-500">
                    {lastSyncedAt ? `Synced ${lastSyncedAt.toLocaleTimeString()}` : 'Ready to sync'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 bg-white rounded-lg border border-slate-200">
                    <div className="text-[10px] text-slate-500">Pending Upload</div>
                    <div className={`text-sm font-bold ${pendingCount > 0 ? 'text-amber-600' : 'text-slate-700'}`}>
                      {pendingCount} record{pendingCount === 1 ? '' : 's'}
                    </div>
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-slate-200">
                    <div className="text-[10px] text-slate-500">Sync Conflicts</div>
                    <div className={`text-sm font-bold ${conflictCount > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                      {conflictCount}
                    </div>
                  </div>
                </div>

                {syncError && (
                  <p className="text-[11px] text-rose-600 font-medium">
                    Sync Error: {syncError}
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => syncNow()}
                  disabled={isSyncing}
                  className="w-full py-2 px-3 bg-emerald-800 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-xs transition cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>{isSyncing ? 'Synchronizing with Cloud...' : 'Sync with Cloud Now'}</span>
                </button>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 space-y-1">
                <p className="font-semibold text-slate-800">🔒 Security & User Isolation</p>
                <p>Security rules restrict Firestore access strictly to your own user document. All other users, collections, and internal sync paths are strictly denied.</p>
              </div>

              <div className="space-y-2 pt-1">
                <button
                  onClick={handleSignOut}
                  disabled={isLoading}
                  className="w-full py-2.5 px-4 bg-slate-700 hover:bg-slate-800 disabled:opacity-50 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-sm transition cursor-pointer"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <LogOut className="w-4 h-4" />
                      <span>Sign Out</span>
                    </>
                  )}
                </button>

                {!showDeleteConfirm ? (
                  <button
                    onClick={() => {
                      setShowDeleteConfirm(true);
                      clearError();
                      setLocalError(null);
                    }}
                    className="w-full py-2 px-4 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Account & Cloud Data</span>
                  </button>
                ) : (
                  <form onSubmit={handleDeleteAccountSubmit} className="p-3 rounded-xl bg-rose-50 border border-rose-300 space-y-3 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-rose-900 flex items-center gap-1.5">
                        <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                        Confirm Permanent Deletion
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowDeleteConfirm(false)}
                        className="text-[11px] text-slate-500 hover:text-slate-800 font-semibold"
                      >
                        Cancel
                      </button>
                    </div>

                     <p className="text-[11px] text-rose-800">
                      This will permanently purge all cloud data under <code className="font-mono font-bold">/users/{user.uid}</code>, delete your Firebase Auth account, and clear local storage. This cannot be undone.
                    </p>

                    <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg text-[10px] text-amber-900 space-y-1">
                      <p className="font-bold flex items-center gap-1">⚠️ Warning: Pending Uploads</p>
                      <p>Any local records still marked <span className="font-bold">PENDING_UPLOAD</span> ({pendingCount} pending) will be permanently discarded as part of account deletion.</p>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-rose-900 mb-1">Recent Password (Re-authentication)</label>
                      <input
                        type="password"
                        required
                        value={deletePassword}
                        onChange={(e) => setDeletePassword(e.target.value)}
                        placeholder="Enter password"
                        className="w-full px-3 py-1.5 text-xs bg-white border border-rose-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-rose-500 transition"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-rose-900 mb-1">Type <span className="font-mono font-bold">DELETE</span> to confirm</label>
                      <input
                        type="text"
                        required
                        value={confirmDeleteText}
                        onChange={(e) => setConfirmDeleteText(e.target.value)}
                        placeholder="Type DELETE"
                        className="w-full px-3 py-1.5 text-xs bg-white border border-rose-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-rose-500 transition font-mono uppercase"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isLoading || !deletePassword.trim() || confirmDeleteText !== 'DELETE'}
                      className="w-full py-2 px-3 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-xs transition cursor-pointer"
                    >
                      {isLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <span>Permanently Delete My Account</span>
                      )}
                    </button>
                  </form>
                )}
              </div>
            </div>
          ) : (
            /* Unauthenticated Form (Sign In / Register) */
            <div className="space-y-4">
              {/* Google 1-Click Authentication */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isLoading}
                className="w-full py-2.5 px-4 bg-white hover:bg-slate-50 border border-slate-300 disabled:opacity-50 text-slate-700 font-bold text-xs rounded-xl flex items-center justify-center gap-2.5 shadow-xs transition cursor-pointer"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Continue with Google</span>
              </button>

              <div className="relative flex items-center justify-center">
                <div className="border-t border-slate-200 w-full" />
                <span className="bg-white px-2 text-[10px] uppercase font-bold text-slate-400 shrink-0">or use email</span>
                <div className="border-t border-slate-200 w-full" />
              </div>

              {/* Mode Toggle Tabs */}
              <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => handleSwitchMode('signin')}
                  className={`py-2 text-xs font-bold rounded-lg transition cursor-pointer ${
                    mode === 'signin'
                      ? 'bg-white text-emerald-800 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => handleSwitchMode('register')}
                  className={`py-2 text-xs font-bold rounded-lg transition cursor-pointer ${
                    mode === 'register'
                      ? 'bg-white text-emerald-800 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Create Account
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="farmer@example.com"
                      className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
                    />
                  </div>
                  {mode === 'register' && (
                    <p className="text-[10px] text-slate-500 mt-1">Minimum 6 characters</p>
                  )}
                </div>

                {mode === 'register' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Confirm Password</label>
                    <div className="relative">
                      <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="password"
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
                      />
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full mt-2 py-2.5 px-4 bg-emerald-800 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-sm transition cursor-pointer"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : mode === 'signin' ? (
                    <>
                      <LogIn className="w-4 h-4" />
                      <span>Sign In</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      <span>Register Account</span>
                    </>
                  )}
                </button>
              </form>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600">
                <p className="font-semibold text-slate-700">🌱 Local-First Architecture</p>
                <p>Signing in sets up your cloud identity document at <code className="font-mono text-emerald-800 font-bold">/users/&#123;uid&#125;</code>. All accounting operations remain offline and local.</p>
              </div>
            </div>
          )}
        </div>

        <div className="bg-slate-50 border-t border-slate-200 px-5 py-3 flex justify-end rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
