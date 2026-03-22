import { useState, useRef, useEffect, useCallback } from 'react';
import { getTypeSuggestions } from '@/models/account';

interface TypeComboboxProps {
  value: string;
  existingTypes: string[];
  onSave: (value: string) => void;
  className?: string;
}

export function TypeCombobox({ value, existingTypes, onSave, className = '' }: TypeComboboxProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const suggestions = getTypeSuggestions(existingTypes).filter(
    s => s.toLowerCase().includes(editValue.toLowerCase())
  );

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
      setShowDropdown(true);
    }
  }, [editing]);

  const handleSave = useCallback(() => {
    setEditing(false);
    setShowDropdown(false);
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== value) {
      onSave(trimmed);
    }
  }, [editValue, value, onSave]);

  // Close dropdown on click outside
  useEffect(() => {
    if (!editing) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        handleSave();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [editing, handleSave]);

  const handleSelect = (suggestion: string) => {
    setEditValue(suggestion);
    setEditing(false);
    setShowDropdown(false);
    if (suggestion !== value) {
      onSave(suggestion);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') {
      setEditValue(value);
      setEditing(false);
      setShowDropdown(false);
    }
  };

  if (!editing) {
    return (
      <span
        onClick={() => { setEditValue(value); setEditing(true); }}
        className={`cursor-pointer hover:bg-[var(--way-stone)] rounded px-1 -mx-1 transition-colors ${className}`}
      >
        {value || '\u2014'}
      </span>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        value={editValue}
        onChange={(e) => { setEditValue(e.target.value); setShowDropdown(true); }}
        onKeyDown={handleKeyDown}
        className={`bg-[var(--way-void)] border border-[var(--way-gold)] rounded px-1.5 py-0.5 !text-base text-[var(--way-text)] outline-none w-full ${className}`}
      />
      {showDropdown && suggestions.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-[var(--way-stone)] border border-[var(--way-shadow)] rounded-md shadow-lg max-h-48 overflow-y-auto">
          {suggestions.map(s => (
            <button
              key={s}
              onMouseDown={(e) => { e.preventDefault(); handleSelect(s); }}
              className="w-full text-left px-2 py-1.5 text-[length:var(--way-text-heading)] text-[var(--way-text)] hover:bg-[var(--way-void)] transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
