import { useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { parseMDTable, parseCSV } from '@/services/import-parser';
import type { ImportMode } from '@/services/import-diff';

export function ImportFilePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const mode = ((location.state as Record<string, unknown>)?.mode ?? 'update') as ImportMode;
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const content = await file.text();
    setText(content);
    setError(null);
  };

  const handleParse = () => {
    const isCSV = text.includes(',') && !text.includes('|');
    const rows = isCSV ? parseCSV(text) : parseMDTable(text);
    if (rows.length === 0) {
      setError('Не удалось распознать данные. Проверьте формат.');
      return;
    }
    const source = isCSV ? 'csv' : 'markdown';
    navigate('/import/preview', { state: { mode, rows, source } });
  };

  const backButton = (
    <button onClick={() => navigate(-1)} className="text-[var(--way-ash)] text-lg" aria-label="Назад">‹</button>
  );

  return (
    <AppShell leftAction={backButton} title="Импорт файла">
      <div className="space-y-4">
        <div>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.md,.txt"
            onChange={handleFile}
            className="hidden"
          />
          <button
            onClick={() => fileRef.current?.click()}
            className="w-full py-8 border-2 border-dashed border-[rgba(200,180,140,0.08)] rounded-xl
              text-[var(--way-ash)] text-sm hover:border-[var(--way-gold)] hover:text-[var(--way-gold)] transition-colors"
          >
            📂 Выбрать файл (.csv, .md, .txt)
          </button>
        </div>

        <div className="text-center text-[var(--way-muted)] text-xs">или вставьте текст</div>

        <textarea
          value={text}
          onChange={(e) => { setText(e.target.value); setError(null); }}
          placeholder="Вставьте CSV или Markdown-таблицу..."
          className="w-full h-48 bg-[var(--way-stone)] text-[var(--way-text)] text-sm p-3 rounded-lg
            border border-transparent focus:border-[var(--way-gold)] outline-none resize-none"
        />

        {error && <div className="text-[var(--destructive)] text-xs">{error}</div>}

        <Button
          onClick={handleParse}
          disabled={!text.trim()}
          className="w-full border border-[rgba(200,180,140,0.2)] text-[var(--way-gold)] bg-transparent hover:bg-[rgba(200,180,140,0.06)] font-semibold"
        >
          Импортировать
        </Button>
      </div>
    </AppShell>
  );
}
