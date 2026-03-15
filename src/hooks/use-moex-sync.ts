import { useState, useEffect, useCallback } from 'react';
import { syncAllAssets, getLastSyncAt, type SyncResult } from '@/services/moex-sync';

export function useMoexSync() {
  const [syncing, setSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getLastSyncAt().then(setLastSyncAt);
  }, []);

  const sync = useCallback(async (): Promise<SyncResult | null> => {
    if (syncing) return null;
    setSyncing(true);
    setError(null);
    try {
      const result = await syncAllAssets();
      setLastSyncAt(new Date());
      if (result.failed > 0) {
        setError(`Ошибки: ${result.errors.join(', ')}`);
      }
      return result;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return null;
    } finally {
      setSyncing(false);
    }
  }, [syncing]);

  return { syncing, lastSyncAt, error, sync };
}
