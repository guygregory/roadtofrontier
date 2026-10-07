import { migrateState, SAVE_VERSION } from './state';
import type { GameState } from './types';

const PREFIX = 'rtf_';

function storage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Saves from older versions lived in localStorage (an autosave plus three slots). Offer the most
// recent unfinished one once so players can carry on, then export it as a .sav file.

const LEGACY_KEYS = ['save_auto', 'save_1', 'save_2', 'save_3'].map((k) => PREFIX + k);

export function legacySave(): GameState | null {
  const st = storage();
  if (!st) return null;
  let best: { at: string; state: GameState } | null = null;
  for (const key of LEGACY_KEYS) {
    try {
      const raw = st.getItem(key);
      if (!raw) continue;
      const data = JSON.parse(raw) as { meta?: { savedAt?: string }; state?: GameState };
      if (!data.state || data.state.v !== SAVE_VERSION || data.state.status !== 'playing') continue;
      const at = data.meta?.savedAt ?? '';
      if (!best || at > best.at) best = { at, state: data.state };
    } catch {
      // ignore unreadable entries
    }
  }
  return best ? migrateState(best.state) : null;
}

export function clearLegacySaves(): void {
  const st = storage();
  for (const key of LEGACY_KEYS) {
    try {
      st?.removeItem(key);
    } catch {
      // ignore
    }
  }
  try {
    st?.removeItem(PREFIX + 'scores');
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// .sav files: the game state as JSON, lightly obfuscated so it can't be edited in a text editor.
// Format: "RTFSAV1:" + base64( XOR-scrambled bytes of "<fnv1a checksum hex>|<json>" ).

const MAGIC = 'RTFSAV1:';
const KEY = 'ROAD TO FRONTIER - MAICPP - FY27';

function fnv1a(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** XOR with a key stream that also depends on position, so repeated text doesn't show a pattern. */
function scramble(bytes: Uint8Array): Uint8Array {
  const out = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) out[i] = bytes[i] ^ KEY.charCodeAt(i % KEY.length) ^ ((i * 131 + 17) & 255);
  return out;
}

function toBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Encode a game as the contents of a .sav file. */
export function encodeSave(s: GameState): string {
  const json = JSON.stringify(s);
  const bytes = new TextEncoder().encode(`${fnv1a(json)}|${json}`);
  return MAGIC + toBase64(scramble(bytes));
}

export class SaveError extends Error {}

/** Decode a .sav file. Throws SaveError with a player-friendly reason if it isn't a valid, unedited save. */
export function decodeSave(text: string): GameState {
  const raw = text.trim();
  if (!raw.startsWith(MAGIC)) throw new SaveError('This is not a ROAD TO FRONTIER save file.');
  let plain: string;
  try {
    plain = new TextDecoder('utf-8', { fatal: true }).decode(scramble(fromBase64(raw.slice(MAGIC.length))));
  } catch {
    throw new SaveError('The save file is damaged and could not be read.');
  }
  const bar = plain.indexOf('|');
  const sum = plain.slice(0, bar);
  const json = plain.slice(bar + 1);
  if (bar !== 8 || fnv1a(json) !== sum) throw new SaveError('The save file has been modified or is damaged.');
  let state: GameState;
  try {
    state = JSON.parse(json) as GameState;
  } catch {
    throw new SaveError('The save file is damaged and could not be read.');
  }
  if (!state || typeof state !== 'object' || typeof state.company !== 'string' || typeof state.turn !== 'number') {
    throw new SaveError('The save file is damaged and could not be read.');
  }
  if (state.v !== SAVE_VERSION) throw new SaveError('This save is from a different version of the game.');
  return migrateState(state);
}

/** e.g. frontier-2026-10-25.sav (local date). */
export function saveFileName(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `frontier-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.sav`;
}

// ---------------------------------------------------------------------------
// Settings (the only thing kept in browser storage)

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