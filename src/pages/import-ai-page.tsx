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
    <button onClick={() => navigate(-1)} className="text-gray-400 text-lg" aria-label="Назад">‹</button>
  );

  return (
    <AppShell leftAction={backButton} title="AI-импорт">
      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-gray-400 text-xs">Промт для AI</span>
            <button onClick={handleCopy} className="text-[#4ecca3] text-xs">
              {copied ? '✓ Скопировано' : '📋 Копировать'}
            </button>
          </div>
          <pre className="bg-[#1a1a2e] p-3 rounded-lg text-[11px] text-gray-300 whitespace-pre-wrap leading-relaxed">
            {AI_PROMPT}
          </pre>
        </div>

        <div>
          <span className="text-gray-400 text-xs block mb-1">Результат от AI</span>
          <textarea
            value={text}
            onChange={(e) => { setText(e.target.value); setError(null); }}
            placeholder="Вставьте сюда Markdown-таблицу от ChatGPT, Claude и др..."
            className="w-full h-48 bg-[#1a1a2e] text-white text-sm p-3 rounded-lg
              border border-transparent focus:border-[#4ecca3] outline-none resize-none"
          />
        </div>

        {error && <div className="text-red-400 text-xs">{error}</div>}

        <Button
          onClick={handleParse}
          disabled={!text.trim()}
          className="w-full bg-[#4ecca3] text-black font-semibold hover:bg-[#3dbb92]"
        >
          Распознать и импортировать
        </Button>
      </div>
    </AppShell>
  );
}
