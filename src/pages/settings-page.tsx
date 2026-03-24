import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { withViewTransition } from '@/lib/view-transition';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { getAppSettings, updateAppSetting, clearAllData, type AppSettings } from '@/services/app-settings';
import { exportAllData, importAllData } from '@/services/backup';

export function SettingsPage() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<AppSettings | null>(null);

  useEffect(() => {
    getAppSettings().then(setSettings);
  }, []);

  const toggle = async (key: string, value: string) => {
    await updateAppSetting(key, value);
    setSettings(await getAppSettings());
  };

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
      setBackupError(null);
    } catch {
      setBackupError('Ошибка: невалидный JSON файл');
    }
  };

  const backButton = (
    <button onClick={() => withViewTransition(() => navigate(-1))} className="text-[var(--way-ash)] text-[length:var(--way-text-nav)]" aria-label="Назад">‹</button>
  );

  if (!settings) return <AppShell leftAction={backButton} title="Настройки"><div /></AppShell>;

  return (
    <AppShell leftAction={backButton} title="Настройки">
      <div className="space-y-6">
        <SettingRow
          label="Период по умолчанию"
          value={settings.defaultPeriod === 'month' ? 'Месяц' : 'Год'}
          onToggle={() => toggle('defaultPeriod', settings.defaultPeriod === 'month' ? 'year' : 'month')}
        />

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
        {backupError && <div className="text-[var(--destructive)] text-[length:var(--way-text-body)] text-center">{backupError}</div>}

        <div className="border-t border-[rgba(200,180,140,0.08)] pt-6 mt-8">
          <div className="text-[var(--destructive)] text-[length:var(--way-text-body)] uppercase tracking-widest mb-3">Опасная зона</div>
          <button
            onClick={handleClear}
            className="w-full py-3 rounded-lg border border-red-900 text-[var(--destructive)] text-[length:var(--way-text-body)] hover:bg-red-900/20 transition-colors"
          >
            Удалить все данные
          </button>
        </div>
      </div>
    </AppShell>
  );
}

function SettingRow({ label, value, onToggle }: {
  label: string; value: string; onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[var(--way-text)] text-[length:var(--way-text-heading)]">{label}</span>
      <button onClick={onToggle} className="bg-[var(--way-stone)] text-[var(--way-gold)] text-[length:var(--way-text-body)] px-3 py-1.5 rounded-lg">
        {value}
      </button>
    </div>
  );
}
