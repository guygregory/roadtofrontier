import { DISTRIBUTOR, PDM_NAME } from './data';
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
  sprite: 'pdm' | 'disti' | 'inbox';
}

export const ADVISORS: Record<AdvisorKind, AdvisorInfo> = {
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
  pdm: {
    kind: 'pdm',
    name: PDM_NAME,
    title: `${PDM_NAME.toUpperCase()}, YOUR PDM`,
    role: 'MICROSOFT (MPL)',
    shortName: PDM_NAME,
    shortRole: 'Your PDM',
    item: 'TIP',
    sprite: 'pdm',
  },
};

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
  return ADVISORS[advisorKind(s)];
}

/** Pick the variant of a line that matches the current advisor. */
export function byAdvisor<T>(s: GameState, v: Record<AdvisorKind, T>): T {
  return v[advisorKind(s)];
}
