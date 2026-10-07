import { FY_MONTHS } from './data';

/** Money is tracked in $K. */
export function money(k: number): string {
  const neg = k < 0;
  const v = Math.abs(k);
  let s: string;
  if (v >= 1000) s = `$${(v / 1000).toFixed(v >= 10000 ? 1 : 2)}M`;
  else s = `$${Math.round(v)}K`;
  return neg ? `-${s}` : s;
}

export function signedMoney(k: number): string {
  return (k >= 0 ? '+' : '') + money(k);
}

export function fyOf(turn: number): number {
  return 27 + Math.floor(turn / 4);
}

export function qOf(turn: number): number {
  return (turn % 4) + 1;
}

/** e.g. "FY27 Q1" */
export function turnLabel(turn: number): string {
  return `FY${fyOf(turn)} Q${qOf(turn)}`;
}

/** e.g. "JUL-SEP 2026" (Microsoft FY27 starts 1 July 2026). */
export function monthsLabel(turn: number): string {
  const fy = fyOf(turn);
  const q = qOf(turn);
  const year = 2000 + fy - (q <= 2 ? 1 : 0);
  return `${FY_MONTHS[q - 1]} ${year}`;
}

export function pct(v: number): string {
  return `${Math.round(v * 100)}%`;
}

export function plural(n: number, word: string, pluralWord?: string): string {
  return `${n} ${n === 1 ? word : pluralWord ?? word + 's'}`;
}
