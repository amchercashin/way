import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number): string {
  if (Math.abs(value) >= 1_000_000) {
    return `₽ ${(value / 1_000_000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1_000) {
    return `₽ ${(value / 1_000).toFixed(0)}K`;
  }
  return `₽ ${Math.round(value).toLocaleString('ru-RU')}`;
}

export function formatCurrencyFull(value: number): string {
  return `₽ ${Math.round(value).toLocaleString('ru-RU')}`;
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function formatFrequency(perYear: number): string {
  const labels: Record<number, string> = {
    1: '1×/год',
    2: '2×/год',
    4: '4×/год (кварт.)',
    12: 'ежемес.',
  };
  return labels[perYear] ?? `${perYear}×/год`;
}
