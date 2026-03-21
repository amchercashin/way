import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { addAccount } from '@/hooks/use-accounts';

interface AddAccountSheetProps {
  open: boolean;
  onClose: () => void;
  onImport?: () => void; // Will be wired in Task 15
}

export function AddAccountSheet({ open, onClose, onImport }: AddAccountSheetProps) {
  const [name, setName] = useState('');

  const handleAdd = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    await addAccount(trimmed);
    setName('');
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="bottom" className="bg-[var(--way-void)] border-t-[var(--way-shadow)]">
        <SheetHeader>
          <SheetTitle className="text-[var(--way-text)]">Добавить счёт</SheetTitle>
          <SheetDescription className="sr-only">Создание нового брокерского счёта</SheetDescription>
        </SheetHeader>
        <div className="mt-4 space-y-4">
          {/* Empty account */}
          <div>
            <label className="text-xs text-[var(--way-ash)] block mb-1">Название</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              placeholder="Сбер / Недвижимость / Вклады / Прочее"
              className="w-full bg-[var(--way-stone)] border border-[var(--way-shadow)] rounded-lg px-3 py-2 text-sm text-[var(--way-text)] placeholder:text-[var(--way-muted)] outline-none focus:border-[var(--way-gold)]"
              autoFocus
            />
            <button
              onClick={handleAdd}
              disabled={!name.trim()}
              className="mt-2 w-full bg-[var(--way-stone)] text-[var(--way-text)] py-2 rounded-lg text-sm hover:bg-[var(--way-shadow)] transition-colors disabled:opacity-40"
            >
              Создать пустой
            </button>
          </div>

          <div className="flex items-center gap-2 text-[var(--way-muted)] text-xs">
            <div className="flex-1 border-t border-[var(--way-shadow)]" />
            <span>или</span>
            <div className="flex-1 border-t border-[var(--way-shadow)]" />
          </div>

          {/* Import */}
          <button
            onClick={() => { onClose(); onImport?.(); }}
            className="w-full border border-[var(--way-shadow)] text-[var(--way-text)] py-2 rounded-lg text-sm hover:bg-[var(--way-stone)] transition-colors"
          >
            Из импорта
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
