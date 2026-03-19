import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number | null | undefined): string {
  if (value == null) return '—';
  if (Math.abs(value) >= 1_000_000) {
    return `₽ ${(value / 1_000_000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1_000) {
    return `₽ ${(value / 1_000).toFixed(0)}K`;
  }
  return `₽ ${Math.round(value).toLocaleString('ru-RU')}`;
}

export function formatCurrencyFull(value: number | null | undefined): string {
  if (value == null) return '—';
  return `₽ ${Math.round(value).toLocaleString('ru-RU')}`;
}

export function formatPercent(value: number | null | undefined): string {
  if (value == null) return '—';
  return `${(Math.round(value * 10) / 10).toFixed(1)}%`;
}

export function formatCompact(value: number): string {
  if (value < 1000) return String(Math.round(value));
  const k = value / 1000;
  const rounded = Math.round(k * 10) / 10;
  return rounded % 1 === 0 ? `${rounded}K` : `${rounded.toFixed(1)}K`;
}

export function formatFrequency(perYear: number): string {
  return `${perYear}/год`;
}
