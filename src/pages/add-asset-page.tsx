import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { addAsset } from '@/hooks/use-assets';
import { ASSET_TYPE_LABELS, type AssetType } from '@/models/types';

const FREQUENCIES = [
  { value: '1', label: '1 раз в год' },
  { value: '2', label: '2 раза в год' },
  { value: '4', label: '4 раза в год (кварт.)' },
  { value: '12', label: 'Ежемесячно' },
];

export function AddAssetPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const defaultType = (params.get('type') as AssetType) ?? 'stock';

  const [type, setType] = useState<AssetType>(defaultType);
  const [name, setName] = useState('');
  const [ticker, setTicker] = useState('');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [frequency, setFrequency] = useState('1');
  const [assetValue, setAssetValue] = useState('');

  const isBirzha = type === 'stock' || type === 'bond' || type === 'fund';

  const FREQ_DEFAULTS: Record<string, number> = {
    stock: 1, bond: 2, fund: 12, realestate: 12, deposit: 12, other: 12,
  };

  const handleSubmit = async () => {
    if (!name || !paymentAmount) return;
    if (isBirzha && !quantity) return;

    const freq = parseInt(frequency) || FREQ_DEFAULTS[type] || 12;

    await addAsset({
      type,
      name,
      ticker: isBirzha && ticker ? ticker : undefined,
      quantity: isBirzha ? parseInt(quantity) : 1,
      quantitySource: 'manual',
      averagePrice: isBirzha && price ? parseFloat(price) : undefined,
      currentPrice: isBirzha
        ? (price ? parseFloat(price) : undefined)
        : (assetValue ? parseFloat(assetValue) : undefined),
      faceValue: type === 'bond' ? 1000 : undefined,
      paymentPerUnit: parseFloat(paymentAmount),
      paymentPerUnitSource: 'manual',
      frequencyPerYear: freq,
      frequencySource: 'manual',
      dataSource: 'manual',
    });

    navigate(-1);
  };

  const backButton = (
    <button onClick={() => navigate(-1)} className="text-[var(--way-ash)] text-lg" aria-label="Назад">‹</button>
  );

  return (
    <AppShell leftAction={backButton} title="Добавить актив">
      <div className="space-y-4">
        <div>
          <Label className="text-[var(--way-ash)] text-xs">Тип актива</Label>
          <Select value={type} onValueChange={(v) => setType(v as AssetType)}>
            <SelectTrigger className="bg-[var(--way-stone)] border-none text-[var(--way-text)] mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[var(--way-stone)] border-[rgba(200,180,140,0.08)]">
              {Object.entries(ASSET_TYPE_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key} className="text-[var(--way-text)]">
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-[var(--way-ash)] text-xs">Название</Label>
          <Input
            className="bg-[var(--way-stone)] border-none text-[var(--way-text)] mt-1"
            placeholder={isBirzha ? 'Сбербанк' : 'Квартира на Ленина'}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        {isBirzha && (
          <div>
            <Label className="text-[var(--way-ash)] text-xs">Тикер</Label>
            <Input
              className="bg-[var(--way-stone)] border-none text-[var(--way-text)] mt-1"
              placeholder="SBER"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
            />
          </div>
        )}

        {isBirzha && (
          <div>
            <Label className="text-[var(--way-ash)] text-xs">Количество</Label>
            <Input
              type="number"
              className="bg-[var(--way-stone)] border-none text-[var(--way-text)] mt-1"
              placeholder="800"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>
        )}

        {isBirzha && (
          <div>
            <Label className="text-[var(--way-ash)] text-xs">Цена покупки (средняя)</Label>
            <Input
              type="number"
              className="bg-[var(--way-stone)] border-none text-[var(--way-text)] mt-1"
              placeholder="298.60"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>
        )}

        {!isBirzha && (
          <div>
            <Label className="text-[var(--way-ash)] text-xs">Оценочная стоимость актива (₽)</Label>
            <Input
              type="number"
              className="bg-[var(--way-stone)] border-none text-[var(--way-text)] mt-1"
              placeholder="5000000"
              value={assetValue}
              onChange={(e) => setAssetValue(e.target.value)}
            />
          </div>
        )}

        <div>
          <Label className="text-[var(--way-ash)] text-xs">
            {isBirzha ? 'Размер выплаты на 1 шт (₽)' : 'Размер дохода за период (₽)'}
          </Label>
          <Input
            type="number"
            className="bg-[var(--way-stone)] border-none text-[var(--way-text)] mt-1"
            placeholder={isBirzha ? '186' : '45000'}
            value={paymentAmount}
            onChange={(e) => setPaymentAmount(e.target.value)}
          />
        </div>

        <div>
          <Label className="text-[var(--way-ash)] text-xs">Частота выплат</Label>
          <Select value={frequency} onValueChange={setFrequency}>
            <SelectTrigger className="bg-[var(--way-stone)] border-none text-[var(--way-text)] mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[var(--way-stone)] border-[rgba(200,180,140,0.08)]">
              {FREQUENCIES.map((f) => (
                <SelectItem key={f.value} value={f.value} className="text-[var(--way-text)]">
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          onClick={handleSubmit}
          disabled={!name || !paymentAmount || (isBirzha && !quantity)}
          className="w-full border border-[rgba(200,180,140,0.2)] text-[var(--way-gold)] bg-transparent hover:bg-[rgba(200,180,140,0.06)] font-semibold mt-4"
        >
          Добавить
        </Button>
      </div>
    </AppShell>
  );
}
