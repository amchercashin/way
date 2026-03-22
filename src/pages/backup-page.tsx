import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { withViewTransition } from '@/lib/view-transition';
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
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
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
    <button onClick={() => withViewTransition(() => navigate(-1))} className="text-[var(--way-ash)] text-[length:var(--way-text-nav)]" aria-label="Назад">‹</button>
  );

  return (
    <AppShell leftAction={backButton} title="Экспорт / Бэкап">
      <div className="space-y-6">
        <div>
          <div className="text-[var(--way-ash)] text-[length:var(--way-text-body)] mb-2">Экспорт</div>
          <Button onClick={handleExport} className="w-full border border-[rgba(200,180,140,0.2)] text-[var(--way-gold)] bg-transparent hover:bg-[rgba(200,180,140,0.06)] font-semibold">
            Скачать бэкап (JSON)
          </Button>
        </div>
        <div>
          <div className="text-[var(--way-ash)] text-[length:var(--way-text-body)] mb-2">Восстановление</div>
          <input ref={fileRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
          <Button variant="outline" onClick={() => fileRef.current?.click()} className="w-full border-[rgba(200,180,140,0.08)] text-[var(--way-text)]">
            Загрузить бэкап
          </Button>
        </div>
        {status && <div className="text-[var(--way-gold)] text-[length:var(--way-text-body)] text-center">{status}</div>}
        {error && <div className="text-[var(--destructive)] text-[length:var(--way-text-body)] text-center">{error}</div>}
      </div>
    </AppShell>
  );
}
