import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import { useNdflRates } from '@/hooks/use-ndfl-rates';
import { updateNdflRate } from '@/services/app-settings';
import { getTypeColor } from '@/models/account';
import { NdflRateSelector } from './ndfl-rate-selector';

export function NdflSettings() {
  const categories = useLiveQuery(async () => {
    const assets = await db.assets.toArray();
    const types = new Set(assets.map((a) => a.type));
    return [...types].sort();
  }, []);

  const ndflRates = useNdflRates();

  if (!categories || categories.length === 0) return null;

  return (
    <div>
      <div className="text-[var(--hi-ash)] text-[length:var(--hi-text-caption)] font-mono uppercase tracking-[0.15em] mb-3">
        НДФЛ
      </div>
      <div className="bg-[var(--hi-stone)] rounded-xl px-4 border border-[rgba(200,180,140,0.06)]">
        {categories.map((type, i) => (
          <div key={type} className={i > 0 ? 'border-t border-[rgba(200,180,140,0.06)]' : ''}>
            <NdflRateSelector
              category={type}
              color={getTypeColor(type)}
              rate={ndflRates.get(type) ?? 0}
              onChange={(rate) => updateNdflRate(type, rate)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
