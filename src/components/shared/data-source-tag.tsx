import type { DataSource } from '@/models/types';

const TAG_STYLES: Record<DataSource, { bg: string; text: string; label: string }> = {
  moex: { bg: 'bg-[#4ecca322]', text: 'text-[#4ecca3]', label: 'MOEX' },
  import: { bg: 'bg-[#e9c46a22]', text: 'text-[#e9c46a]', label: 'импорт' },
  manual: { bg: 'bg-[#88888822]', text: 'text-gray-400', label: 'ручной' },
};

export function DataSourceTag({ source }: { source: DataSource }) {
  const style = TAG_STYLES[source];
  return (
    <span className={`text-[9px] ${style.bg} ${style.text} px-1.5 py-0.5 rounded`}>
      {style.label}
    </span>
  );
}
