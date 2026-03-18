import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { parseMDTable } from '@/services/import-parser';
import type { ImportMode } from '@/services/import-diff';

const AI_PROMPT = `Преобразуй данные из отчёта брокера в Markdown-таблицу:

| Тикер | Название | Тип | Кол-во | Ср.цена | Посл.выплата | Частота |
|-------|----------|-----|--------|---------|--------------|---------|

Правила:
- Тип: акция, облигация, фонд, вклад, недвижимость, прочее
- Частота: число выплат в год (1, 2, 4, 12)
- Посл.выплата: последняя выплата на 1 единицу (₽)
- Ср.цена: средняя цена покупки (₽)
- Если данные неизвестны, оставь ячейку пустой`;

export function ImportAIPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const mode = ((location.state as Record<string, unknown>)?.mode ?? 'update') as ImportMode;
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(AI_PROMPT);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleParse = () => {
    const rows = parseMDTable(text);
    if (rows.length === 0) {
      setError('Не удалось распознать таблицу. Проверьте формат Markdown.');
      return;
    }
    navigate('/import/preview', { state: { mode, rows, source: 'ai_import' } });
  };

  const backButton = (
    <button onClick={() => navigate(-1)} className="text-[var(--way-ash)] text-lg" aria-label="Назад">‹</button>
  );

  return (
    <AppShell leftAction={backButton} title="AI-импорт">
      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[var(--way-ash)] text-xs">Промт для AI</span>
            <button onClick={handleCopy} className="text-[var(--way-gold)] text-xs">
              {copied ? '✓ Скопировано' : '📋 Копировать'}
            </button>
          </div>
          <pre className="bg-[var(--way-stone)] p-3 rounded-lg text-[11px] text-[var(--way-text)] whitespace-pre-wrap leading-relaxed">
            {AI_PROMPT}
          </pre>
        </div>

        <div>
          <span className="text-[var(--way-ash)] text-xs block mb-1">Результат от AI</span>
          <textarea
            value={text}
            onChange={(e) => { setText(e.target.value); setError(null); }}
            placeholder="Вставьте сюда Markdown-таблицу от ChatGPT, Claude и др..."
            className="w-full h-48 bg-[var(--way-stone)] text-[var(--way-text)] text-sm p-3 rounded-lg
              border border-transparent focus:border-[var(--way-gold)] outline-none resize-none"
          />
        </div>

        {error && <div className="text-[var(--destructive)] text-xs">{error}</div>}

        <Button
          onClick={handleParse}
          disabled={!text.trim()}
          className="w-full border border-[rgba(200,180,140,0.2)] text-[var(--way-gold)] bg-transparent hover:bg-[rgba(200,180,140,0.06)] font-semibold"
        >
          Распознать и импортировать
        </Button>
      </div>
    </AppShell>
  );
}
