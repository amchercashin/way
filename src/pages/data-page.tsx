import { useState } from 'react';
import { useAccounts } from '@/hooks/use-accounts';
import { useHoldings } from '@/hooks/use-holdings';
import { useAssets } from '@/hooks/use-assets';
import { AppShell } from '@/components/layout/app-shell';
import { AccountSection } from '@/components/data/account-section';
import { AddAccountSheet } from '@/components/data/add-account-sheet';

export function DataPage() {
  const accounts = useAccounts();
  const holdings = useHoldings();
  const assets = useAssets();
  const [addAccountOpen, setAddAccountOpen] = useState(false);

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
            />
          );
        })}

        <button
          onClick={() => setAddAccountOpen(true)}
          className="w-full border border-dashed border-[var(--way-shadow)] text-[var(--way-text)] py-3 rounded-xl text-sm hover:bg-[var(--way-stone)] transition-colors"
        >
          + Добавить счёт
        </button>
      </div>

      <AddAccountSheet open={addAccountOpen} onClose={() => setAddAccountOpen(false)} />
    </AppShell>
  );
}
