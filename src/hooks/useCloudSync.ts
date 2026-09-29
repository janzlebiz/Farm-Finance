import { useState, useEffect, useCallback, useRef } from 'react';
import { User } from 'firebase/auth';
import { SyncEngine } from '../services/syncEngine';
import { useOnlineStatus } from './useOnlineStatus';

export interface CloudSyncState {
  isSyncing: boolean;
  lastSyncedAt: Date | null;
  syncError: string | null;
  pendingCount: number;
  conflictCount: number;
  syncNow: () => Promise<void>;
}

export function useCloudSync(user: User | null, onDataSynced?: () => void): CloudSyncState {
  const isOnline = useOnlineStatus();
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [summary, setSummary] = useState(() => SyncEngine.getSyncStateSummary());

  const isSyncingRef = useRef(false);
  const onDataSyncedRef = useRef(onDataSynced);
  onDataSyncedRef.current = onDataSynced;

  const updateSummary = useCallback(() => {
    setSummary(SyncEngine.getSyncStateSummary());
  }, []);

  const performSync = useCallback(async () => {
    if (!user || !isOnline || isSyncingRef.current) {
      return;
    }

    try {
      isSyncingRef.current = true;
      setIsSyncing(true);
      setSyncError(null);

      // 1. Push local pending mutations
      const pushRes = await SyncEngine.pushPendingChanges(user.uid);

      // 2. Pull remote updates / bootstrap
      const pullRes = await SyncEngine.pullRemoteChanges(user.uid);

      setLastSyncedAt(new Date());
      updateSummary();

      // If changes were applied or pulled, notify UI to reload
      if (pushRes.appliedCount > 0 || pullRes.pulledChangesCount > 0) {
        onDataSyncedRef.current?.();
      }
    } catch (err: any) {
      console.warn('[useCloudSync] Sync error:', err?.message || err);
      setSyncError(err?.message || 'Sync failed');
    } finally {
      isSyncingRef.current = false;
      setIsSyncing(false);
      updateSummary();
    }
  }, [user, isOnline, updateSummary]);

  // Initial sync on user login or auth state change
  useEffect(() => {
    if (user && isOnline) {
      performSync();
    }
  }, [user, isOnline, performSync]);

  // Trigger sync on network recovery (offline -> online)
  useEffect(() => {
    const handleOnline = () => {
      if (user) {
        performSync();
      }
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [user, performSync]);

  // Trigger sync when tab regains focus or becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && user && isOnline) {
        performSync();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
    };
  }, [user, isOnline, performSync]);

  // Listen for local database mutations to update summary and schedule background push
  useEffect(() => {
    let timeoutId: any = null;
    const handleDbUpdated = () => {
      updateSummary();
      if (user && isOnline) {
        // Debounce automatic push by 1.5 seconds after local edit
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          performSync();
        }, 1500);
      }
    };

    window.addEventListener('farm_finance_db_updated', handleDbUpdated);
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('farm_finance_db_updated', handleDbUpdated);
    };
  }, [user, isOnline, performSync, updateSummary]);

  // Periodic background sync every 30 seconds when active
  useEffect(() => {
    if (!user || !isOnline) return;

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        performSync();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [user, isOnline, performSync]);

  return {
    isSyncing,
    lastSyncedAt,
    syncError,
    pendingCount: summary.pendingUploadCount,
    conflictCount: summary.conflictCount,
    syncNow: performSync
  };
}
