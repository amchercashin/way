import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { syncAllAssets, syncSingleAsset, getLastSyncAt, type SyncResult } from '@/services/moex-sync';

interface SyncContextValue {
  syncing: boolean;
  lastSyncAt: Date | null;
  error: string | null;
  triggerSync: () => Promise<SyncResult | null>;
  syncAsset: (assetId: number) => Promise<void>;
}

const SyncContext = createContext<SyncContextValue | null>(null);

export function SyncProvider({ children }: { children: ReactNode }) {
  const [syncing, setSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const syncingRef = useRef(false);

  const triggerSync = useCallback(async (): Promise<SyncResult | null> => {
    if (syncingRef.current) return null;
    syncingRef.current = true;
    setSyncing(true);
    setError(null);
    try {
      const result = await syncAllAssets();
      if (result.synced > 0) {
        setLastSyncAt(new Date());
      }
      if (result.failed > 0) {
        setError(`Ошибки: ${result.errors.join(', ')}`);
      }
      return result;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return null;
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  }, []);

  const syncAsset = useCallback(async (assetId: number): Promise<void> => {
    // Skip if full sync is running — it will cover this asset
    if (syncingRef.current) return;
    await syncSingleAsset(assetId);
  }, []);

  // Auto-sync on mount (once per session)
  useEffect(() => {
    getLastSyncAt().then(setLastSyncAt);
    triggerSync();
  }, [triggerSync]);

  return (
    <SyncContext.Provider value={{ syncing, lastSyncAt, error, triggerSync, syncAsset }}>
      {children}
    </SyncContext.Provider>
  );
}

export function useSyncContext(): SyncContextValue {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error('useSyncContext must be used within SyncProvider');
  return ctx;
}
