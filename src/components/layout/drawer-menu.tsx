import { Link } from 'react-router-dom';
import { SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { BarChart3, Database, CalendarDays, Settings, Save } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface DrawerMenuProps {
  onClose: () => void;
}

const MENU_SECTIONS: {
  title: string;
  items: { label: string; path: string; icon: LucideIcon }[];
}[] = [
  {
    title: 'Просмотр',
    items: [
      { label: 'Мой доход', path: '/', icon: BarChart3 },
    ],
  },
  {
    title: 'Управление',
    items: [
      { label: 'Данные', path: '/data', icon: Database },
      { label: 'Выплаты', path: '/payments', icon: CalendarDays },
    ],
  },
  {
    title: 'Прочее',
    items: [
      { label: 'Настройки', path: '/settings', icon: Settings },
      { label: 'Экспорт / Бэкап', path: '/backup', icon: Save },
    ],
  },
];

export function DrawerMenu({ onClose }: DrawerMenuProps) {
  return (
    <SheetContent side="left" className="bg-[var(--way-void)] border-r-[var(--way-stone)] w-64">
      <SheetHeader>
        <SheetTitle className="font-serif text-lg font-light text-[var(--way-gold)]">Путь</SheetTitle>
      </SheetHeader>
      <nav className="mt-6">
        {MENU_SECTIONS.map((section) => (
          <div key={section.title} className="mb-6">
            <div className="text-[8px] uppercase tracking-[0.3em] text-[var(--way-shadow)] font-mono mb-2 px-2">
              {section.title}
            </div>
            {section.items.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={onClose}
                className="flex items-center gap-3 px-2 py-2 text-sm text-[var(--way-text)] hover:bg-[var(--way-stone)] transition-colors rounded-lg"
              >
                <item.icon size={16} strokeWidth={1.2} className="text-[var(--way-ash)]" />
                {item.label}
              </Link>
            ))}
          </div>
        ))}
      </nav>
    </SheetContent>
  );
}
