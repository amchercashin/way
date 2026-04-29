import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import { useExchangeRates } from '@/hooks/use-exchange-rates';
import { normalizeCurrency, updateExchangeRate } from '@/services/exchange-rates';

const COMMON_CURRENCIES = ['USD', 'EUR', 'CNY'] as const;

export function ExchangeRatesSettings() {
  const assets = useLiveQuery(() => db.assets.toArray(), [], []);
  const rates = useExchangeRates();
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const currencies = new Set<string>();
  for (const asset of assets) {
    const currency = normalizeCurrency(asset.currency);
    if (currency !== 'RUB') currencies.add(currency);
  }
  for (const rate of rates) {
    const currency = normalizeCurrency(rate.currency);
    if (currency !== 'RUB') currencies.add(currency);
  }
  for (const currency of COMMON_CURRENCIES) currencies.add(currency);

  const rateByCurrency = new Map(rates.map((rate) => [normalizeCurrency(rate.currency), rate]));
  const sortedCurrencies = [...currencies].sort();

  const commit = async (currency: string) => {
    const raw = drafts[currency] ?? String(rateByCurrency.get(currency)?.rateToRub ?? '');
    const parsed = Number(raw.replace(',', '.'));
    if (isFinite(parsed) && parsed > 0) {
      await updateExchangeRate(currency, parsed);
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[currency];
        return next;
      });
    }
  };

  return (
    <div>
      <div className="text-[var(--hi-ash)] text-[length:var(--hi-text-caption)] font-mono uppercase tracking-[0.15em] mb-3">
        Курсы валют
      </div>
      <div className="bg-[var(--hi-stone)] rounded-xl px-4 border border-[rgba(200,180,140,0.06)]">
        <div className="flex items-center justify-between py-2.5 border-b border-[rgba(200,180,140,0.06)]">
          <span className="text-[var(--hi-text)] text-[length:var(--hi-text-body)]">RUB</span>
          <span className="font-mono text-[length:var(--hi-text-body)] text-[var(--hi-ash)]">1 ₽</span>
        </div>
        {sortedCurrencies.map((currency) => {
          const rate = rateByCurrency.get(currency);
          const value = drafts[currency] ?? (rate ? String(rate.rateToRub) : '');
          return (
            <div key={currency} className="flex items-center justify-between gap-3 py-2.5 border-b border-[rgba(200,180,140,0.06)] last:border-b-0">
              <div>
                <div className="text-[var(--hi-text)] text-[length:var(--hi-text-body)]">{currency}</div>
                {rate?.updatedAt && (
                  <div className="font-mono text-[length:var(--hi-text-micro)] text-[var(--hi-muted)]">
                    обновлён {rate.updatedAt.toLocaleDateString('ru-RU')}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  inputMode="decimal"
                  value={value}
                  onChange={(e) => setDrafts((prev) => ({ ...prev, [currency]: e.target.value.replace(/[^0-9.,]/g, '') }))}
                  onBlur={() => commit(currency)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      commit(currency);
                      e.currentTarget.blur();
                    }
                  }}
                  placeholder="курс"
                  className="w-20 bg-[var(--hi-void)] border border-[var(--hi-shadow)] rounded-md px-2 py-1 text-base text-right text-[var(--hi-text)] outline-none focus:border-[var(--hi-gold)]"
                />
                <span className="font-mono text-[length:var(--hi-text-caption)] text-[var(--hi-ash)]">₽</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
