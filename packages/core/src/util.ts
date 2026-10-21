import type { ID, PlatformState } from './types';

const DAY_MS = 86_400_000;

/** Converte um ISO em data de calendário (YYYY-MM-DD) no fuso informado. */
export function toLocalDate(iso: string, timeZone = 'America/Sao_Paulo'): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
  return parts; // en-CA já formata como YYYY-MM-DD
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date.slice(0, 10)}T12:00:00Z`);
  return new Date(d.getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

export function addDaysIso(iso: string, days: number): string {
  return new Date(new Date(iso).getTime() + days * DAY_MS).toISOString();
}

export function daysBetween(from: string, to: string): number {
  const a = new Date(`${from.slice(0, 10)}T12:00:00Z`).getTime();
  const b = new Date(`${to.slice(0, 10)}T12:00:00Z`).getTime();
  return Math.round((b - a) / DAY_MS);
}

export function ageAt(birthDate: string, onDate: string): number {
  const [by, bm, bd] = birthDate.split('-').map(Number);
  const [y, m, d] = onDate.slice(0, 10).split('-').map(Number);
  let age = y - by;
  if (m < bm || (m === bm && d < bd)) age -= 1;
  return age;
}

/** Gera IDs determinísticos a partir do contador do estado (idempotente em testes). */
export function nextId(state: PlatformState, prefix: string): ID {
  state.seq += 1;
  return `${prefix}_${state.seq.toString(36).padStart(4, '0')}`;
}

export function round(value: number, step = 0.5): number {
  return Math.round(value / step) * step;
}

export function clone<T>(value: T): T {
  return structuredClone(value);
}

export function formatBRL(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
}

export function formatDate(date: string): string {
  const d = new Date(date.length === 10 ? `${date}T12:00:00Z` : date);
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Sao_Paulo' }).format(d);
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(iso));
}

export function formatNumber(n: number, digits = 1): string {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: digits, minimumFractionDigits: 0 }).format(n);
}
