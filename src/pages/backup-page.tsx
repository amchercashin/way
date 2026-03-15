import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { exportAllData, importAllData } from '@/services/backup';

export function BackupPage() {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async () => {
    const json = await exportAllData();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cashflow-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatus('Бэкап сохранён');
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const json = await file.text();
      JSON.parse(json);
      if (!confirm('Это заменит все текущие данные. Продолжить?')) return;
      await importAllData(json);
      setStatus('Данные восстановлены');
      setError(null);
    } catch {
      setError('Ошибка: невалидный JSON файл');
    }
  };

  const backButton = (
    <button onClick={() => navigate(-1)} className="text-gray-400 text-lg" aria-label="Назад">‹</button>
  );

  return (
    <AppShell leftAction={backButton} title="Экспорт / Бэкап">
      <div className="space-y-6">
        <div>
          <div className="text-gray-400 text-xs mb-2">Экспорт</div>
          <Button onClick={handleExport} className="w-full bg-[#4ecca3] text-black font-semibold hover:bg-[#3dbb92]">
            Скачать бэкап (JSON)
          </Button>
        </div>
        <div>
          <div className="text-gray-400 text-xs mb-2">Восстановление</div>
          <input ref={fileRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
          <Button variant="outline" onClick={() => fileRef.current?.click()} className="w-full border-gray-700 text-gray-300">
            Загрузить бэкап
          </Button>
        </div>
        {status && <div className="text-[#4ecca3] text-xs text-center">{status}</div>}
        {error && <div className="text-red-400 text-xs text-center">{error}</div>}
      </div>
    </AppShell>
  );
}
