import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { withViewTransition } from '@/lib/view-transition';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { clearAllData } from '@/services/app-settings';
import { exportAllData, importAllData } from '@/services/backup';
import { NdflSettings } from '@/components/settings/ndfl-settings';
import { ExchangeRatesSettings } from '@/components/settings/exchange-rates-settings';

export function SettingsPage() {
  const navigate = useNavigate();

  const handleClear = async () => {
    if (!confirm('Удалить все данные? Это действие необратимо.')) return;
    await clearAllData();
    withViewTransition(() => navigate('/'));
  };

  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [backupError, setBackupError] = useState<string | null>(null);

  const handleExport = async () => {
    const json = await exportAllData();
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `heroincome-backup-${new Date().toISOString().slice(0, 10)}.json`;
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
      setBackupError(null);
    } catch (e) {
      setBackupError(e instanceof Error ? e.message : 'Ошибка: невалидный JSON файл');
    }
  };

  const backButton = (
    <button onClick={() => withViewTransition(() => navigate(-1))} className="text-[var(--hi-ash)] text-[length:var(--hi-text-nav)]" aria-label="Назад">‹</button>
  );

  return (
    <AppShell leftAction={backButton} title="Настройки">
      <div className="space-y-6">
        <NdflSettings />
        <ExchangeRatesSettings />

        <div>
          <div className="text-[var(--hi-ash)] text-[length:var(--hi-text-body)] mb-2">Экспорт</div>
          <Button onClick={handleExport} className="w-full border border-[rgba(200,180,140,0.2)] text-[var(--hi-gold)] bg-transparent hover:bg-[rgba(200,180,140,0.06)] font-semibold">
            Скачать бэкап (JSON)
          </Button>
        </div>

        <div>
          <div className="text-[var(--hi-ash)] text-[length:var(--hi-text-body)] mb-2">Восстановление</div>
          <input ref={fileRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
          <Button variant="outline" onClick={() => fileRef.current?.click()} className="w-full border-[rgba(200,180,140,0.08)] text-[var(--hi-text)]">
            Загрузить бэкап
          </Button>
        </div>

        {status && <div className="text-[var(--hi-gold)] text-[length:var(--hi-text-body)] text-center">{status}</div>}
        {backupError && <div className="text-[var(--destructive)] text-[length:var(--hi-text-body)] text-center">{backupError}</div>}

        <div>
          <div className="text-[var(--hi-ash)] text-[length:var(--hi-text-body)] mb-2">Подсказки</div>
          <button
            onClick={() => {
              localStorage.removeItem('hi-onboarding-done');
              localStorage.removeItem('hi-tip-payments');
              localStorage.removeItem('hi-tip-data');
              localStorage.removeItem('hi-tip-category');
              localStorage.removeItem('hi-tip-asset');
            }}
            className="w-full py-3 rounded-lg border border-[rgba(200,180,140,0.08)] text-[var(--hi-ash)] transition-all hover:text-[var(--hi-gold)] hover:border-[rgba(200,180,140,0.15)] active:translate-y-px"
            style={{ fontSize: 'var(--hi-text-body)' }}
          >
            Сбросить подсказки
          </button>
        </div>

        <div className="border-t border-[rgba(200,180,140,0.08)] pt-6 mt-8">
          <div className="text-[var(--destructive)] text-[length:var(--hi-text-body)] uppercase tracking-widest mb-3">Опасная зона</div>
          <button
            onClick={handleClear}
            className="w-full py-3 rounded-lg border border-red-900 text-[var(--destructive)] text-[length:var(--hi-text-body)] hover:bg-red-900/20 transition-colors"
          >
            Удалить все данные
          </button>
        </div>
      </div>
    </AppShell>
  );
}
