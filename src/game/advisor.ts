import { DISTRIBUTOR, PDM_CHANGE_REASONS, PDM_TENURE_YEARS, PDMS } from './data';
import { fyOf } from './format';
import { pick, randInt } from './rng';
import type { GameState } from './types';

export type AdvisorKind = 'program' | 'distributor' | 'pdm';

export interface AdvisorInfo {
  kind: AdvisorKind;
  /** Name used in prose ("Alex", "Sam", "the MAICPP team"). */
  name: string;
  /** Heading for the advice panel. */
  title: string;
  /** Second line under the heading. */
  role: string;
  /** Short labels under a large portrait. */
  shortName: string;
  shortRole: string;
  /** What each piece of advice is called ("TIP", "EMAIL"). */
  item: string;
  /** Portrait: 'inbox', 'disti' or 'pdm:<id>' (see engine/sprites.ts). */
  sprite: string;
}

export const ADVISORS: Record<'program' | 'distributor', AdvisorInfo> = {
  program: {
    kind: 'program',
    name: 'the MAICPP team',
    title: 'MAICPP INBOX',
    role: 'PROGRAMME EMAILS',
    shortName: 'MAICPP',
    shortRole: 'No-reply',
    item: 'EMAIL',
    sprite: 'inbox',
  },
  distributor: {
    kind: 'distributor',
    name: DISTRIBUTOR.am,
    title: `${DISTRIBUTOR.am.toUpperCase()}, DISTRIBUTOR`,
    role: 'ACCOUNT MANAGER',
    shortName: DISTRIBUTOR.am,
    shortRole: 'Disti AM',
    item: 'TIP',
    sprite: 'disti',
  },
};

/** Your Partner Development Manager (Alex until the first change). */
export function currentPdm(s: GameState): { id: string; name: string } {
  return PDMS[s.flags.pdm ?? 0] ?? PDMS[0];
}

/**
 * Who advises you. Before CSP, only automated MAICPP programme emails. Once you resell through an
 * Indirect Provider, the account manager at your distributor. A Microsoft Partner Development
 * Manager only once you are on the Managed Partner List (from the FY after your second
 * specialization). Direct bill partners have no distributor, so they get programme emails until then.
 */
export function advisorKind(s: GameState): AdvisorKind {
  if (s.mpl) return 'pdm';
  if (s.csp === 'indirect') return 'distributor';
  return 'program';
}

export function advisor(s: GameState): AdvisorInfo {
  const kind = advisorKind(s);
  if (kind !== 'pdm') return ADVISORS[kind];
  const p = currentPdm(s);
  return {
    kind,
    name: p.name,
    title: `${p.name.toUpperCase()}, YOUR PDM`,
    role: 'MICROSOFT (MPL)',
    shortName: p.name,
    shortRole: 'Your PDM',
    item: 'TIP',
    sprite: `pdm:${p.id}`,
  };
}

/** Pick the variant of a line that matches the current advisor. */
export function byAdvisor<T>(s: GameState, v: Record<AdvisorKind, T>): T {
  return v[advisorKind(s)];
}

/** Years until a managed partner's PDM next changes. */
function tenure(s: GameState): number {
  return 4 * randInt(s, PDM_TENURE_YEARS.min, PDM_TENURE_YEARS.max);
}

/** Joining the Managed Partner List: Alex becomes your PDM from `fyStart` (the new FY's first quarter). */
export function assignFirstPdm(s: GameState, fyStart: number): void {
  s.flags.pdm = 0;
  s.flags.pdmSince = fyStart;
  s.flags.pdmUsed = 1;
  s.flags.pdmNext = fyStart + tenure(s);
}

/** Why your previous PDM moved on, e.g. "Alex has left Microsoft". */
export function pdmChangeReason(s: GameState): string {
  const prev = PDMS[s.flags.pdmPrev ?? 0] ?? PDMS[0];
  return `${prev.name} ${PDM_CHANGE_REASONS[s.flags.pdmReason ?? 0] ?? PDM_CHANGE_REASONS[0]}`;
}

/**
 * At the start of an FY (`fyStart`), a managed partner's PDM changes every 2-4 years: they leave
 * Microsoft, move to a new role, or are realigned to a different partner. Someone you haven't
 * worked with yet takes over. Returns the year-end notice, or null if nothing changed.
 */
export function rotatePdm(s: GameState, fyStart: number): string | null {
  if (!s.mpl) return null;
  if (s.flags.pdmNext === undefined) {
    // Saves from before PDMs rotated: start the clock now.
    s.flags.pdmNext = fyStart + tenure(s);
    return null;
  }
  if (fyStart < s.flags.pdmNext) return null;
  const prev = s.flags.pdm ?? 0;
  const used = s.flags.pdmUsed ?? 1 << prev;
  const left = s.flags.pdmLeft ?? 0;
  const others = PDMS.map((_, i) => i).filter((i) => i !== prev);
  const fresh = others.filter((i) => !(used & (1 << i)));
  // Once everyone has had a turn, old PDMs can come back - unless they left Microsoft.
  const back = others.filter((i) => !(left & (1 << i)));
  const next = pick(s, fresh.length ? fresh : back.length ? back : others);
  s.flags.pdmPrev = prev;
  s.flags.pdm = next;
  s.flags.pdmReason = randInt(s, 0, PDM_CHANGE_REASONS.length - 1);
  if (s.flags.pdmReason === 0) s.flags.pdmLeft = left | (1 << prev);
  s.flags.pdmSince = fyStart;
  s.flags.pdmUsed = used | (1 << next);
  s.flags.pdmNext = fyStart + tenure(s);
  return `{y}New PDM:{/} ${pdmChangeReason(s)}. ${PDMS[next].name} looks after you from FY${fyOf(fyStart)}.`;
}
