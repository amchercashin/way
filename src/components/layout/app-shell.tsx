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
      className="text-[var(--way-ash)] text-[length:var(--way-text-nav)] min-w-[44px] min-h-[44px] flex items-center justify-center"
      aria-label="Открыть меню"
    >
      ☰
    </button>
  );

  return (
    <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
      <div className="h-[100vh] h-[100dvh] flex flex-col overflow-hidden bg-[var(--way-void)] text-[var(--way-text)]">
        <header className="flex-shrink-0 flex items-center justify-between px-5 pb-2" style={{ paddingTop: 'max(38px, env(safe-area-inset-top))' }}>
          <div>{leftAction ?? <SheetTrigger asChild>{defaultLeft}</SheetTrigger>}</div>
          {title && <h1 className="text-[length:var(--way-text-title)] font-medium text-[var(--way-text)]">{title}</h1>}
          <div>{rightAction ?? <div className="w-5" />}</div>
        </header>
        <main className="flex-1 overflow-y-auto overflow-x-hidden overscroll-none px-5 pb-8">{children}</main>
      </div>
      <DrawerMenu onClose={() => setDrawerOpen(false)} />
    </Sheet>
  );
}
