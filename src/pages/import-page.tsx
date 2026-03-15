import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '@/components/layout/app-shell';
import { useMoexSync } from '@/hooks/use-moex-sync';
import type { ImportMode } from '@/services/import-diff';

export function ImportPage() {
  const [mode, setMode] = useState<ImportMode>('update');
  const navigate = useNavigate();
  const { syncing, sync } = useMoexSync();

  const backButton = (
    <button onClick={() => navigate(-1)} className="text-gray-400 text-lg" aria-label="Назад">‹</button>
  );

  return (
    <AppShell leftAction={backButton} title="Импорт данных">
      <div className="flex gap-2 mb-4">
        {(['update', 'add'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
              mode === m
                ? 'bg-[#4ecca3] text-black'
                : 'bg-[#1a1a2e] text-gray-400'
            }`}
          >
            {m === 'update' ? '⟳ Обновить' : '+ Добавить'}
          </button>
        ))}
      </div>

      <p className="text-gray-500 text-xs mb-6">
        {mode === 'update'
          ? 'Обновит существующие позиции по тикеру и добавит новые.'
          : 'Добавит только новые тикеры. Существующие позиции не изменит.'}
      </p>

      <div className="space-y-3">
        <MethodButton
          icon="🤖"
          label="Через AI-помощник"
          desc="Промт для ChatGPT/Claude → вставьте таблицу"
          onClick={() => navigate('/import/ai', { state: { mode } })}
        />
        <MethodButton
          icon="📄"
          label="CSV / Markdown"
          desc="Загрузите файл или вставьте текст"
          onClick={() => navigate('/import/file', { state: { mode } })}
        />
        <MethodButton
          icon="⟳"
          label="Обновить с MOEX"
          desc={syncing ? 'Обновление...' : 'Цены, дивиденды, купоны'}
          onClick={() => sync()}
          disabled={syncing}
        />
        <MethodButton
          icon="✏️"
          label="Добавить вручную"
          desc="Заполнить форму для одного актива"
          onClick={() => navigate('/add-asset')}
        />
      </div>
    </AppShell>
  );
}

function MethodButton({ icon, label, desc, onClick, disabled }: {
  icon: string; label: string; desc: string;
  onClick: () => void; disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full flex items-center gap-3 bg-[#1a1a2e] rounded-xl p-4 text-left
        hover:bg-[#252545] transition-colors disabled:opacity-50"
    >
      <span className="text-xl">{icon}</span>
      <div>
        <div className="text-sm text-white font-medium">{label}</div>
        <div className="text-[11px] text-gray-500">{desc}</div>
      </div>
    </button>
  );
}
