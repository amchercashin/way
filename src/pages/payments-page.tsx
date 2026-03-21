import { useMemo, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { AppShell } from '@/components/layout/app-shell';
import { TypeSection } from '@/components/payments/type-section';
import { useAssets } from '@/hooks/use-assets';
import { useAllPaymentHistory } from '@/hooks/use-payment-history';
import type { PaymentHistory } from '@/models/types';

export function PaymentsPage() {
  const assets = useAssets();
  const allPayments = useAllPaymentHistory();

  const location = useLocation();
  const highlightState = location.state as { highlightAssetId?: number } | null;

  // Clear location state after reading
  useEffect(() => {
    if (highlightState?.highlightAssetId) {
      window.history.replaceState({}, '');
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Group payments by asset
  const paymentsByAsset = useMemo(() => {
    const map = new Map<number, PaymentHistory[]>();
    for (const p of allPayments) {
      const arr = map.get(p.assetId) ?? [];
      arr.push(p);
      map.set(p.assetId, arr);
    }
    return map;
  }, [allPayments]);

  // Group assets by type — show all assets
  const typeGroups = useMemo(() => {
    const map = new Map<string, typeof assets>();
    for (const asset of assets) {
      const group = map.get(asset.type) ?? [];
      group.push(asset);
      map.set(asset.type, group);
    }
    return map;
  }, [assets]);

  return (
    <AppShell title="Выплаты">
      {typeGroups.size === 0 ? (
        <div className="text-center text-[var(--way-muted)] font-mono text-sm py-12">
          Нет активов
        </div>
      ) : (
        <div className="space-y-4">
          {Array.from(typeGroups.entries()).map(([type, groupAssets]) => (
            <TypeSection
              key={type}
              type={type}
              assets={groupAssets}
              paymentsByAsset={paymentsByAsset}
              highlightAssetId={highlightState?.highlightAssetId}
            />
          ))}
        </div>
      )}
    </AppShell>
  );
}
