import { useState } from 'react';

interface AssetFieldProps {
  label: string;
  value: string;
  sourceLabel?: string;
  isManualSource?: boolean;
  subtitle?: string;
  editable?: boolean;
  onSave?: (newValue: string) => void;
  resetLabel?: string;
  onReset?: () => void;
}

export function AssetField({
  label,
  value,
  sourceLabel,
  isManualSource,
  subtitle,
  editable = true,
  onSave,
  resetLabel,
  onReset,
}: AssetFieldProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const startEditing = () => {
    setDraft(value.replace(/[^\d.,]/g, ''));
    setEditing(true);
  };

  const handleSave = () => {
    setEditing(false);
    if (draft !== value) {
      onSave?.(draft);
    }
  };

  return (
    <div className="bg-[#1a1a2e] rounded-xl p-3 mb-2">
      <div className="text-[11px] text-gray-500 mb-1">{label}</div>
      {editing ? (
        <div>
          <div className="flex gap-2">
            <input
              className="flex-1 bg-[#0d1117] border border-[#f59e0b] rounded-lg px-2 py-1 text-sm text-white outline-none"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={handleSave}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              autoFocus
            />
            <button
              className="bg-[#2d6a4f] text-white px-2 py-1 rounded-lg text-xs"
              onMouseDown={(e) => { e.preventDefault(); handleSave(); }}
            >
              ✓
            </button>
          </div>
          {resetLabel && onReset && (
            <button
              className="w-full mt-2 border border-[#334155] text-[#94a3b8] py-1 rounded-lg text-[11px]"
              onMouseDown={(e) => {
                e.preventDefault();
                setEditing(false);
                onReset();
              }}
            >
              ↩ {resetLabel}
            </button>
          )}
        </div>
      ) : (
        <div>
          <div className="flex justify-between items-center">
            <span
              className={`text-sm font-medium text-white ${editable ? 'cursor-pointer' : ''}`}
              onClick={() => editable && startEditing()}
            >
              {value}
            </span>
            {sourceLabel && (
              <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold ${
                isManualSource
                  ? 'bg-[#431407] text-[#fb923c]'
                  : 'bg-[#14532d] text-[#4ade80]'
              }`}>
                {sourceLabel}
              </span>
            )}
          </div>
          {subtitle && (
            <div className="text-[10px] text-gray-600 mt-1">{subtitle}</div>
          )}
        </div>
      )}
    </div>
  );
}
