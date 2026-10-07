import { SAVE_VERSION } from './state';
import { turnLabel } from './format';
import type { GameState } from './types';

const PREFIX = 'rtf_';
export const SLOTS = ['auto', '1', '2', '3'] as const;
export type Slot = (typeof SLOTS)[number];

export interface SaveMeta {
  slot: Slot;
  company: string;
  label: string;
  savedAt: string;
}

function storage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

export function saveGame(s: GameState, slot: Slot): boolean {
  const st = storage();
  if (!st) return false;
  try {
    const meta: SaveMeta = { slot, company: s.company, label: turnLabel(Math.min(s.turn, 19)), savedAt: new Date().toISOString() };
    st.setItem(PREFIX + 'save_' + slot, JSON.stringify({ meta, state: s }));
    return true;
  } catch {
    return false;
  }
}

export function loadGame(slot: Slot): GameState | null {
  const st = storage();
  if (!st) return null;
  try {
    const raw = st.getItem(PREFIX + 'save_' + slot);
    if (!raw) return null;
    const data = JSON.parse(raw) as { state: GameState };
    if (!data.state || data.state.v !== SAVE_VERSION) return null;
    return data.state;
  } catch {
    return null;
  }
}

export function saveMeta(slot: Slot): SaveMeta | null {
  const st = storage();
  if (!st) return null;
  try {
    const raw = st.getItem(PREFIX + 'save_' + slot);
    if (!raw) return null;
    const data = JSON.parse(raw) as { meta: SaveMeta; state: GameState };
    if (!data.state || data.state.v !== SAVE_VERSION || data.state.status !== 'playing') return null;
    return data.meta;
  } catch {
    return null;
  }
}

export function deleteSave(slot: Slot): void {
  storage()?.removeItem(PREFIX + 'save_' + slot);
}

// ---------------------------------------------------------------------------
// Settings

export interface Settings {
  music: boolean;
  sfx: boolean;
  crt: boolean;
}

export function loadSettings(): Settings {
  const def: Settings = { music: true, sfx: true, crt: true };
  try {
    const raw = storage()?.getItem(PREFIX + 'settings');
    return raw ? { ...def, ...(JSON.parse(raw) as Partial<Settings>) } : def;
  } catch {
    return def;
  }
}

export function saveSettings(s: Settings): void {
  try {
    storage()?.setItem(PREFIX + 'settings', JSON.stringify(s));
  } catch {
    /* storage may be unavailable (private mode); settings just won't persist */
  }
}

// ---------------------------------------------------------------------------
// Hall of Fame

export interface HiScore {
  initials: string;
  company: string;
  score: number;
  result: string;
  date: string;
}

const DEFAULT_SCORES: HiScore[] = [
  { initials: 'BIL', company: 'Traf-O-Data', score: 42000, result: 'FRONTIER', date: '1975' },
  { initials: 'SAT', company: 'Contoso', score: 36000, result: 'POTY', date: '2014' },
  { initials: 'AMY', company: 'Fabrikam', score: 28000, result: 'FRONTIER', date: '2026' },
  { initials: 'JAY', company: 'Northwind', score: 21000, result: 'POTY', date: '2026' },
  { initials: 'LIZ', company: 'Litware', score: 15000, result: 'TIME UP', date: '2026' },
  { initials: 'KEV', company: 'Tailspin', score: 11000, result: 'TIME UP', date: '2026' },
  { initials: 'ROB', company: 'Proseware', score: 7000, result: 'BANKRUPT', date: '2026' },
  { initials: 'PAT', company: 'Woodgrove', score: 4000, result: 'BANKRUPT', date: '2026' },
];

export function loadScores(): HiScore[] {
  try {
    const raw = storage()?.getItem(PREFIX + 'scores');
    const list = raw ? (JSON.parse(raw) as HiScore[]) : DEFAULT_SCORES;
    return [...list].sort((a, b) => b.score - a.score).slice(0, 8);
  } catch {
    return DEFAULT_SCORES;
  }
}

export function qualifies(score: number): boolean {
  const list = loadScores();
  return list.length < 8 || score > list[list.length - 1].score;
}

export function addScore(entry: HiScore): number {
  const list = [...loadScores(), entry].sort((a, b) => b.score - a.score).slice(0, 8);
  try {
    storage()?.setItem(PREFIX + 'scores', JSON.stringify(list));
  } catch {
    /* ignore */
  }
  return list.indexOf(entry);
}
