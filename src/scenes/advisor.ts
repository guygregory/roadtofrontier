import { AREA, AREAS, FRONTIER } from '../game/data';
import { fyOf, money, qOf } from '../game/format';
import { canPurchaseDesignation, frontierQualified, hasSpec, specQualified, specUnlocked, totalCustomers } from '../game/rules';
import { SPECS } from '../game/data';
import { forecastCosts, lastRevenue } from '../game/sim';
import type { GameState } from '../game/types';

/** Context-sensitive advice from Alex, your PDM. Most urgent first. */
export function advisorTips(s: GameState): string[] {
  const tips: string[] = [];
  const util = s.lastReport?.utilisation ?? 0.9;
  const burn = forecastCosts(s) - lastRevenue(s);

  if (s.negativeQuarters > 0) tips.push('{r}CASH CRISIS!{/} Get cash above zero this quarter: cut programmes, borrow, or let staff go.');
  else if (s.cash < burn * 1.5 && burn > 0) tips.push(`{o}Cash is tight.{/} You burn about ${money(burn)} a quarter. Trim programmes or grow revenue.`);
  for (const a of AREAS) if (canPurchaseDesignation(s, a)) tips.push(`{g}You qualify!{/} Buy the ${AREA[a].short} Solutions Partner designation in PARTNER CENTER.`);
  if (frontierQualified(s) && !s.audits.some((x) => x.kind === 'frontier')) tips.push('{y}You meet every Frontier requirement!{/} Book the Frontier Partner audit in PARTNER CENTER.');
  const ready = SPECS.filter((sp) => sp.validation !== 'auto' && !hasSpec(s, sp.id) && specUnlocked(s, sp) && specQualified(s, sp));
  if (ready.length) tips.push(`{g}${ready[0].name}{/} is ready for ${ready[0].validation === 'audit' ? 'audit' : 'customer references'}. See PARTNER CENTER.`);
  if (util > 1.05) tips.push(`{o}Your team is at ${Math.round(util * 100)}% utilisation.{/} Hire engineers in COMPANY or projects will fail and customers will leave.`);
  if (s.csp === 'none') tips.push('Join {c}CSP{/} as an Indirect Reseller: licence margin, incentives, co-op funds, and every new customer counts toward your PCS.');
  if (s.benefits === 'none' && s.designations.length === 0) tips.push('Partner Success Core or Expanded Benefits cut your overheads with internal-use licences. Buy them in COMPANY.');
  if (qOf(s.turn) === 2 && s.flags.igniteFY !== fyOf(s.turn)) tips.push('{c}Microsoft Ignite{/} is in November! Attending boosts reputation, leads and skills (ACTIONS).');
  if (qOf(s.turn) === 3 && s.designations.length > 0 && !s.nominations.some((n) => n.fy === fyOf(s.turn))) tips.push('{y}Partner of the Year{/} nominations are open this quarter (ACTIONS). Winning wins the game!');
  if (qOf(s.turn) === 4 && s.flags.buildFY !== fyOf(s.turn)) tips.push('{c}Microsoft Build{/} is in May: speeds up offer development (ACTIONS).');
  if (s.coop >= 8) tips.push(`You have ${money(s.coop)} of {c}co-op funds{/}. Spend them on a marketing event before they expire at year end.`);
  if (s.morale < 45) tips.push('{o}Morale is low{/}: engineers will start leaving with their certifications. Raise People & Culture.');
  if (s.compliance < 50) tips.push('{r}Compliance is weak.{/} An audit could cost you your membership. Run a Compliance Health Check.');
  if (s.sales * 3 < 6 + totalCustomers(s) / 25) tips.push('Your sellers may not keep up with leads. Consider hiring sales staff.');
  if (s.offers.length === 0 && s.turn >= 2) tips.push('Repeatable offers (ACTIONS) earn high-margin revenue and strongly help the Frontier audit.');
  if (!s.unified && s.key.length >= 4) tips.push('Unified for Partners protects key accounts during outages and failing projects.');
  if (s.designations.length > 0 && !s.designations.some((d) => d.area === 'security')) tips.push('Frontier Partner needs the Security designation for Data Security and Identity specializations.');
  if (s.designations.length > 0 && (s.fte < FRONTIER.fte || s.dp600 < FRONTIER.dp600)) tips.push(`Frontier skilling: ${s.fte}/${FRONTIER.fte} Transformation Engineers, ${s.dp600}/${FRONTIER.dp600} DP-600. See ACTIONS.`);
  tips.push('Skilling builds PCS points, wins audits and makes projects succeed. Marketing and co-sell bring customers.');
  tips.push('Every action has a cost. Watch the forecast in PROGRAMMES before you end the quarter.');
  return tips;
}
