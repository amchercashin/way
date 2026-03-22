import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAccounts } from '@/hooks/use-accounts';
import { useHoldings } from '@/hooks/use-holdings';
import { useAssets } from '@/hooks/use-assets';
import { AppShell } from '@/components/layout/app-shell';
import { AccountSection } from '@/components/data/account-section';
import { AddAccountSheet } from '@/components/data/add-account-sheet';
import { ImportFlow } from '@/components/data/import-flow';

export function DataPage() {
  const accounts = useAccounts();
  const holdings = useHoldings();
  const assets = useAssets();
  const [addAccountOpen, setAddAccountOpen] = useState(false);
  const [importTarget, setImportTarget] = useState<{ accountId: number | null; accountName?: string } | null>(null);

  const location = useLocation();
  const highlightState = location.state as { highlightAccountId?: number; highlightAssetId?: number } | null;

  // Clear location state after reading so back navigation doesn't re-highlight
  useEffect(() => {
    if (highlightState?.highlightAssetId) {
      window.history.replaceState({}, '');
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AppShell title="Данные">
      <div className="space-y-4">
        {accounts.map((account) => {
          const accountHoldings = holdings.filter(h => h.accountId === account.id);
          return (
            <AccountSection
              key={account.id}
              account={account}
              holdings={accountHoldings}
              assets={assets}
              onImport={() => setImportTarget({ accountId: account.id!, accountName: account.name })}
              highlightAssetId={highlightState?.highlightAccountId === account.id ? highlightState?.highlightAssetId : undefined}
            />
          );
        })}

        <button
          onClick={() => setAddAccountOpen(true)}
          className="w-full border border-dashed border-[var(--way-shadow)] text-[var(--way-text)] py-3 rounded-xl text-[length:var(--way-text-body)] hover:bg-[var(--way-stone)] transition-colors"
        >
          + Добавить счёт
        </button>
      </div>

      <AddAccountSheet
        open={addAccountOpen}
        onClose={() => setAddAccountOpen(false)}
        onImport={() => { setAddAccountOpen(false); setImportTarget({ accountId: null }); }}
      />

      <ImportFlow
        open={importTarget !== null}
        onClose={() => setImportTarget(null)}
        accountId={importTarget?.accountId ?? null}
        accountName={importTarget?.accountName}
      />
    </AppShell>
  );
}
