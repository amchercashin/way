import { useState, type ReactNode } from 'react';
import { Sheet, SheetTrigger } from '@/components/ui/sheet';
import { DrawerMenu } from './drawer-menu';

interface AppShellProps {
  title?: string;
  leftAction?: ReactNode;
  rightAction?: ReactNode;
  children: ReactNode;
}

export function AppShell({ title, leftAction, rightAction, children }: AppShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const defaultLeft = (
    <button
      onClick={() => setDrawerOpen(true)}
      className="text-[var(--way-ash)] text-lg"
      aria-label="Открыть меню"
    >
      ☰
    </button>
  );

  return (
    <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
      <div className="min-h-screen bg-[var(--way-void)] text-[var(--way-text)]">
        <header className="flex items-center justify-between px-5 pb-2" style={{ paddingTop: 'max(38px, env(safe-area-inset-top))' }}>
          <div>{leftAction ?? <SheetTrigger asChild>{defaultLeft}</SheetTrigger>}</div>
          {title && <h1 className="text-sm font-medium text-[var(--way-text)]">{title}</h1>}
          <div>{rightAction ?? <div className="w-5" />}</div>
        </header>
        <main className="px-5 pb-8">{children}</main>
      </div>
      <DrawerMenu onClose={() => setDrawerOpen(false)} />
    </Sheet>
  );
}
