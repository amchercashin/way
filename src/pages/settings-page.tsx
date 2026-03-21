import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '@/components/layout/app-shell';
import { getAppSettings, updateAppSetting, clearAllData, type AppSettings } from '@/services/app-settings';

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
    navigate('/');
  };

  const backButton = (
    <button onClick={() => navigate(-1)} className="text-[var(--way-ash)] text-lg" aria-label="Назад">‹</button>
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
        <div className="border-t border-[rgba(200,180,140,0.08)] pt-6 mt-8">
          <div className="text-[var(--destructive)] text-xs uppercase tracking-widest mb-3">Опасная зона</div>
          <button
            onClick={handleClear}
            className="w-full py-3 rounded-lg border border-red-900 text-[var(--destructive)] text-sm hover:bg-red-900/20 transition-colors"
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
      <span className="text-[var(--way-text)] text-sm">{label}</span>
      <button onClick={onToggle} className="bg-[var(--way-stone)] text-[var(--way-gold)] text-sm px-3 py-1.5 rounded-lg">
        {value}
      </button>
    </div>
  );
}
