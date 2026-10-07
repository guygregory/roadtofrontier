import { CFG } from './data';
import { totalCustomers } from './rules';
import type { GameState } from './types';

/** Final score: business value + programme achievements + victory bonus (bigger for a quick win). */
export function finalScore(s: GameState): number {
  const value = Math.max(0, s.cash - s.debt) * 2 + (s.lastReport?.revenue.total ?? 0) * 4;
  const achievements =
    s.designations.length * 1500 +
    s.specs.length * 1000 +
    s.offers.filter((o) => o.published).length * 400 +
    totalCustomers(s) * 15 +
    s.key.length * 200 +
    s.reputation * 20 +
    s.stats.potyFinalist * 1000;
  let bonus = 0;
  const quarters = (s.flags.endTurn ?? s.turn - 1) + 1;
  if (s.status === 'won') bonus = 10000 + Math.max(0, CFG.speedTurns - quarters) * 600;
  return Math.round((value + achievements + bonus) / 10) * 10;
}

export function resultLabel(s: GameState): string {
  switch (s.endKind) {
    case 'frontier':
      return 'FRONTIER';
    case 'poty':
      return 'POTY';
    case 'bankrupt':
      return 'BANKRUPT';
    case 'removed':
      return 'REMOVED';
    default:
      return 'QUIT';
  }
}
