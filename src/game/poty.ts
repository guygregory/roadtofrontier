import { AREA, AreaId, DIFFICULTY } from './data';
import { fyOf } from './format';
import { frontierOffers, hasDesignation, hasSpec, publishedOffers, specsInArea, sum } from './rules';
import type { GameState } from './types';

const FRONTIER_SPECS = ['copilot', 'datasec', 'iam', 'aiapps', 'aiplatform'];

/** Probability of winning Partner of the Year in a category, judged at year end. */
export function potyChance(s: GameState, category: AreaId | 'frontier', premium: boolean): number {
  let sc = 0;
  if (category === 'frontier') {
    sc += 0.04;
    sc += Math.min(0.2, 0.05 * FRONTIER_SPECS.filter((x) => hasSpec(s, x)).length);
    sc += Math.min(0.12, 0.04 * frontierOffers(s));
    sc += Math.min(0.08, 0.02 * s.fte);
  } else {
    if (!hasDesignation(s, category)) return 0;
    sc += 0.04;
    sc += Math.min(0.15, 0.05 * specsInArea(s, category));
    sc += Math.min(0.08, 0.04 * publishedOffers(s, category));
    sc += Math.min(0.1, 0.02 * sum(s.areas[category].deploys));
    if (s.key.some((k) => k.area === category && k.sat >= 80)) sc += 0.05;
  }
  sc += Math.max(0, Math.min(0.15, (s.reputation - 40) / 300));
  const fy = fyOf(s.turn);
  if (s.flags.igniteFY === fy) sc += 0.03;
  if (s.flags.buildFY === fy) sc += 0.02;
  if (premium) sc += 0.05;
  const p = (sc - 0.28) * DIFFICULTY[s.difficulty].poty;
  return Math.max(0.01, Math.min(0.18, p));
}

export function categoryName(c: AreaId | 'frontier'): string {
  return c === 'frontier' ? 'Frontier AI Transformation' : AREA[c].name;
}
