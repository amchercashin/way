import { useState } from 'react';
import type { DataSource } from '@/models/types';
import { DataSourceTag } from '@/components/shared/data-source-tag';

interface AssetFieldProps {
  label: string;
  value: string;
  source: DataSource;
  editable?: boolean;
  onSave?: (newValue: string) => void;
}

export function AssetField({ label, value, source, editable = true, onSave }: AssetFieldProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const startEditing = () => {
    setDraft(value);
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
        <input
          className="w-full bg-[#0d1117] border border-[#4ecca3] rounded-lg px-2 py-1 text-sm text-white outline-none"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={handleSave}
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          autoFocus
        />
      ) : (
        <div className="flex justify-between items-center">
          <span
            className={`text-sm font-medium text-white ${editable ? 'cursor-pointer' : ''}`}
            onClick={() => editable && startEditing()}
          >
            {value}
          </span>
          <DataSourceTag source={source} />
        </div>
      )}
    </div>
  );
}
