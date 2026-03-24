import { useState, useCallback, useRef } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { parseSberHTML, extractAgreementNumber } from '@/services/sber-html-parser';
import { parseMDTable } from '@/services/import-parser';
import { computeImportDiff } from '@/services/import-diff';
import { applyImportDiff } from '@/services/import-applier';
import type { ImportDiff } from '@/services/import-diff';
import type { ImportRecord } from '@/models/types';
import { ImportPreview } from './import-preview';
import { Landmark, Bot, ArrowLeft, Copy, Check } from 'lucide-react';
import { useSyncContext } from '@/contexts/sync-context';
import { syncSingleAsset, isSyncable } from '@/services/moex-sync';
import { db } from '@/db/database';

interface ImportFlowProps {
  open: boolean;
  onClose: () => void;
  accountId: number | null;  // null = new account
  accountName?: string;       // current name for existing account
}

type Step = 'method' | 'ai' | 'preview';

const AI_PROMPT = `Преобразуй данные из отчёта брокера в Markdown-таблицу:

| Тикер | ISIN | Название | Тип | Кол-во | Ср.цена | Посл.выплата | Частота |
|-------|------|----------|-----|--------|---------|--------------|---------|

Правила:
- Тип: акция, облигация, фонд, вклад, недвижимость, прочее
- Частота: число выплат в год (1, 2, 4, 12)
- Посл.выплата: последняя выплата на 1 единицу (₽)
- Ср.цена: средняя цена покупки (₽)
- ISIN: международный идентификатор (если есть в отчёте)
- Если данные неизвестны, оставь ячейку пустой`;

function MethodButton({ icon: Icon, label, desc, onClick }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 bg-[var(--way-stone)] border border-[var(--way-shadow)] rounded-lg p-4 text-left hover:border-[var(--way-gold)] transition-colors"
    >
      <Icon className="w-5 h-5 text-[var(--way-ash)] shrink-0" />
      <div>
        <div className="text-[length:var(--way-text-heading)] font-medium text-[var(--way-text)]">{label}</div>
        <div className="text-[length:var(--way-text-body)] text-[var(--way-ash)]">{desc}</div>
      </div>
    </button>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 text-[length:var(--way-text-body)] text-[var(--way-ash)] hover:text-[var(--way-text)] transition-colors mb-3"
    >
      <ArrowLeft className="w-3.5 h-3.5" />
      Назад
    </button>
  );
}

export function ImportFlow({ open, onClose, accountId, accountName }: ImportFlowProps) {
  const [step, setStep] = useState<Step>('method');
  const [diff, setDiff] = useState<ImportDiff | null>(null);
  const [suggestedName, setSuggestedName] = useState('');
  const [editableName, setEditableName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [importSource, setImportSource] = useState<ImportRecord['source']>('sber_html');
  const [aiText, setAiText] = useState('');
  const [copied, setCopied] = useState(false);
  const sberFileRef = useRef<HTMLInputElement>(null);
  const { triggerSync } = useSyncContext();

  const reset = useCallback(() => {
    setStep('method');
    setDiff(null);
    setSuggestedName('');
    setEditableName('');
    setError(null);
    setApplying(false);
    setImportSource('sber_html');
    setAiText('');
    setCopied(false);
  }, []);

  const handleClose = () => {
    reset();
    onClose();
  };

  const setDefaultName = (name: string) => {
    if (accountId === null) {
      setSuggestedName(name);
      setEditableName(name);
    }
  };

  const goToPreview = async (rows: import('@/services/import-parser').ImportAssetRow[]) => {
    const importDiff = await computeImportDiff(rows, accountId);
    setDiff(importDiff);
    setStep('preview');
  };

  // --- Sber HTML upload ---
  const handleSberUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    try {
      const html = await file.text();
      const rows = parseSberHTML(html);
      if (rows.length === 0) {
        setError('Не удалось разобрать отчёт. Убедитесь что это HTML-отчёт Сбера.');
        return;
      }

      if (accountId === null) {
        const agreement = extractAgreementNumber(html);
        const name = agreement ? `Сбер / ${agreement}` : 'Новый счёт';
        setDefaultName(name);
      }

      setImportSource('sber_html');
      await goToPreview(rows);
    } catch {
      setError('Ошибка при разборе файла');
    }

    e.target.value = '';
  };

  // --- AI paste ---
  const handleAiParse = async () => {
    setError(null);
    try {
      const rows = parseMDTable(aiText);
      if (rows.length === 0) {
        setError('Не удалось распознать таблицу. Убедитесь что вставлен Markdown-ответ AI.');
        return;
      }
      setDefaultName('Новый счёт');
      setImportSource('ai_import');
      await goToPreview(rows);
    } catch {
      setError('Ошибка при разборе текста');
    }
  };

  // --- Apply ---
  const handleApply = async () => {
    if (!diff) return;
    setApplying(true);
    try {
      const name = accountId === null ? editableName.trim() || suggestedName : undefined;
      const { newAssetIds } = await applyImportDiff(diff, importSource, name);
      handleClose();
      triggerSync();

      // Sync payments for newly created syncable assets (fire-and-forget)
      (async () => {
        for (const id of newAssetIds) {
          const asset = await db.assets.get(id);
          if (asset && isSyncable(asset)) {
            try { await syncSingleAsset(id); } catch { /* ignore */ }
          }
        }
      })();
    } catch {
      setError('Ошибка при применении импорта');
      setApplying(false);
    }
  };

  const handleCopyPrompt = async () => {
    await navigator.clipboard.writeText(AI_PROMPT);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && handleClose()}>
      <SheetContent side="bottom" className="bg-[var(--way-void)] border-t-[var(--way-shadow)] max-h-[85vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-[var(--way-text)]">
            {accountId !== null ? `Импорт: ${accountName}` : 'Импорт в новый счёт'}
          </SheetTitle>
          <SheetDescription className="sr-only">
            Загрузка и предпросмотр импорта брокерского отчёта
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 px-4">
          {/* Step: method selection */}
          {step === 'method' && (
            <div className="space-y-2">
              <MethodButton
                icon={Landmark}
                label="Отчёт Сбера"
                desc="HTML-отчёт брокера"
                onClick={() => sberFileRef.current?.click()}
              />
              <MethodButton
                icon={Bot}
                label="Markdown / через AI"
                desc="Промт для ChatGPT/Claude → вставьте таблицу"
                onClick={() => setStep('ai')}
              />
            </div>
          )}
          {step === 'method' && error && (
            <p className="text-[length:var(--way-text-body)] text-red-400 mt-2">{error}</p>
          )}

          {/* Step: AI import */}
          {step === 'ai' && (
            <div className="space-y-3">
              <BackButton onClick={() => { setStep('method'); setError(null); }} />
              <p className="text-[length:var(--way-text-body)] text-[var(--way-ash)]">
                Скопируйте промт, отправьте в ChatGPT или Claude вместе с отчётом, затем вставьте ответ
              </p>

              {/* AI prompt with copy button */}
              <div className="relative">
                <pre className="bg-[var(--way-stone)] border border-[var(--way-shadow)] rounded-lg p-3 pr-10 text-xs text-[var(--way-ash)] whitespace-pre-wrap overflow-x-auto max-h-40 overflow-y-auto max-w-full">
                  {AI_PROMPT}
                </pre>
                <button
                  onClick={handleCopyPrompt}
                  className="absolute top-2 right-2 p-1.5 rounded-md bg-[var(--way-void)] hover:bg-[var(--way-shadow)] transition-colors"
                  title="Скопировать промт"
                >
                  {copied
                    ? <Check className="w-3.5 h-3.5 text-green-400" />
                    : <Copy className="w-3.5 h-3.5 text-[var(--way-ash)]" />
                  }
                </button>
              </div>

              {/* Textarea for pasting AI response */}
              <textarea
                value={aiText}
                onChange={(e) => setAiText(e.target.value)}
                placeholder="Вставьте Markdown-таблицу из ответа AI..."
                className="w-full bg-[var(--way-stone)] border border-[var(--way-shadow)] rounded-lg px-3 py-2 text-base text-[var(--way-text)] placeholder:text-[var(--way-shadow)] outline-none focus:border-[var(--way-gold)] min-h-[120px] resize-y font-mono"
              />

              <button
                onClick={handleAiParse}
                disabled={!aiText.trim()}
                className="w-full bg-[var(--way-stone)] text-[var(--way-text)] py-2.5 rounded-lg text-[length:var(--way-text-body)] font-medium disabled:opacity-40 hover:border-[var(--way-gold)] border border-[var(--way-shadow)] transition-colors"
              >
                Распознать
              </button>

              {error && (
                <p className="text-[length:var(--way-text-body)] text-red-400">{error}</p>
              )}
            </div>
          )}

          {/* Step: preview */}
          {step === 'preview' && diff && (
            <div className="space-y-3">
              {/* Editable name for new accounts */}
              {accountId === null && (
                <div>
                  <label className="text-[length:var(--way-text-body)] text-[var(--way-ash)] block mb-1">Название счёта</label>
                  <input
                    type="text"
                    value={editableName}
                    onChange={(e) => setEditableName(e.target.value)}
                    className="w-full bg-[var(--way-stone)] border border-[var(--way-shadow)] rounded-lg px-3 py-2 text-base text-[var(--way-text)] outline-none focus:border-[var(--way-gold)]"
                  />
                </div>
              )}

              <ImportPreview diff={diff} />

              {error && <p className="text-[length:var(--way-text-body)] text-red-400">{error}</p>}

              <div className="flex gap-2">
                <button
                  onClick={handleClose}
                  className="flex-1 bg-[var(--way-stone)] text-[var(--way-ash)] py-2.5 rounded-lg text-[length:var(--way-text-body)]"
                >
                  Отмена
                </button>
                <button
                  onClick={handleApply}
                  disabled={applying}
                  className="flex-[2] bg-[#2d5a2d] text-[#6be06b] py-2.5 rounded-lg text-[length:var(--way-text-body)] font-medium disabled:opacity-50"
                >
                  {applying ? 'Применяю...' : 'Применить'}
                </button>
              </div>
            </div>
          )}
        </div>
        <input
          ref={sberFileRef}
          type="file"
          accept=".html,.htm"
          onChange={handleSberUpload}
          className="hidden"
        />
      </SheetContent>
    </Sheet>
  );
}
