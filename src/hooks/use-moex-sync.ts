import { useState, useEffect, useCallback, useRef } from 'react';
import { syncAllAssets, getLastSyncAt, type SyncResult } from '@/services/moex-sync';

export function useMoexSync() {
  const [syncing, setSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const syncingRef = useRef(false);

  useEffect(() => {
    getLastSyncAt().then(setLastSyncAt);
  }, []);

  const sync = useCallback(async (): Promise<SyncResult | null> => {
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

  return { syncing, lastSyncAt, error, sync };
}
