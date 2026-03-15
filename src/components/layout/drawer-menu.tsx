import { Link } from 'react-router-dom';
import { SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

interface DrawerMenuProps {
  onClose: () => void;
}

const MENU_SECTIONS = [
  {
    title: 'Просмотр',
    items: [
      { label: '📊 Мой доход', path: '/' },
      { label: '📅 Календарь выплат', path: '/calendar' },
    ],
  },
  {
    title: 'Управление',
    items: [
      { label: '📥 Импорт данных', path: '/import' },
    ],
  },
  {
    title: 'Прочее',
    items: [
      { label: '⚙️ Настройки', path: '/settings' },
      { label: '💾 Экспорт/Бэкап', path: '/backup' },
    ],
  },
];

export function DrawerMenu({ onClose }: DrawerMenuProps) {
  return (
    <SheetContent side="left" className="bg-[#0d1117] border-r-[#1a1a2e] w-64">
      <SheetHeader>
        <SheetTitle className="text-[#4ecca3] text-lg font-bold">CashFlow</SheetTitle>
      </SheetHeader>
      <nav className="mt-6">
        {MENU_SECTIONS.map((section) => (
          <div key={section.title} className="mb-6">
            <div className="text-[10px] uppercase tracking-widest text-gray-600 mb-2 px-2">
              {section.title}
            </div>
            {section.items.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={onClose}
                className="block px-2 py-2 text-sm text-gray-300 hover:text-white hover:bg-[#1a1a2e] rounded-lg"
              >
                {item.label}
              </Link>
            ))}
          </div>
        ))}
      </nav>
    </SheetContent>
  );
}
