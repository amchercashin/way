import { useState, useRef, useEffect } from 'react';

const PRESETS = [0, 13, 15] as const;

interface NdflRateSelectorProps {
  category: string;
  color: string;
  rate: number;
  onChange: (rate: number) => void;
}

export function NdflRateSelector({ category, color, rate, onChange }: NdflRateSelectorProps) {
  const isCustom = !PRESETS.includes(rate as typeof PRESETS[number]);
  const [editing, setEditing] = useState(false);
  const [customValue, setCustomValue] = useState(isCustom ? String(rate) : '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const handlePreset = (preset: number) => {
    setEditing(false);
    setCustomValue('');
    onChange(preset);
  };

  const handleCustomClick = () => {
    setEditing(true);
    setCustomValue(isCustom ? String(rate) : '');
  };

  const commitCustom = () => {
    const parsed = parseFloat(customValue);
    if (isFinite(parsed) && parsed >= 0 && parsed <= 100) {
      onChange(parsed);
    }
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      commitCustom();
      inputRef.current?.blur();
    }
  };

  const segmentClass = (active: boolean) =>
    `px-2 py-1 font-mono text-[length:var(--hi-text-micro)] transition-colors ${
      active
        ? 'bg-[rgba(200,180,140,0.08)] text-[var(--hi-gold)]'
        : 'text-[var(--hi-ash)]'
    }`;

  return (
    <div className="flex items-center justify-between py-2.5">
      <span className="text-[var(--hi-text)] text-[length:var(--hi-text-body)] flex items-center gap-2">
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
        {category}
      </span>
      <div className="flex border border-[rgba(200,180,140,0.12)] rounded-md overflow-hidden">
        {PRESETS.map((preset) => (
          <button
            key={preset}
            onClick={() => handlePreset(preset)}
            className={segmentClass(!isCustom && rate === preset && !editing)}
          >
            {preset}%
          </button>
        ))}
        {editing || isCustom ? (
          <input
            ref={inputRef}
            type="text"
            inputMode="decimal"
            value={editing ? customValue : `${rate}%`}
            onChange={(e) => setCustomValue(e.target.value.replace(/[^0-9.]/g, ''))}
            onFocus={() => {
              setEditing(true);
              setCustomValue(isCustom ? String(rate) : '');
            }}
            onBlur={commitCustom}
            onKeyDown={handleKeyDown}
            className="w-12 px-1 py-1 font-mono text-base text-[var(--hi-gold)] bg-[rgba(200,180,140,0.08)] border-l border-[rgba(200,180,140,0.08)] text-center outline-none"
          />
        ) : (
          <button
            onClick={handleCustomClick}
            className={segmentClass(false)}
          >
            …
          </button>
        )}
      </div>
    </div>
  );
}
