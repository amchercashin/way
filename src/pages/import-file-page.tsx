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
    <button onClick={() => navigate(-1)} className="text-gray-400 text-lg" aria-label="Назад">‹</button>
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
            className="w-full py-8 border-2 border-dashed border-gray-700 rounded-xl
              text-gray-500 text-sm hover:border-[#4ecca3] hover:text-[#4ecca3] transition-colors"
          >
            📂 Выбрать файл (.csv, .md, .txt)
          </button>
        </div>

        <div className="text-center text-gray-600 text-xs">или вставьте текст</div>

        <textarea
          value={text}
          onChange={(e) => { setText(e.target.value); setError(null); }}
          placeholder="Вставьте CSV или Markdown-таблицу..."
          className="w-full h-48 bg-[#1a1a2e] text-white text-sm p-3 rounded-lg
            border border-transparent focus:border-[#4ecca3] outline-none resize-none"
        />

        {error && <div className="text-red-400 text-xs">{error}</div>}

        <Button
          onClick={handleParse}
          disabled={!text.trim()}
          className="w-full bg-[#4ecca3] text-black font-semibold hover:bg-[#3dbb92]"
        >
          Импортировать
        </Button>
      </div>
    </AppShell>
  );
}
