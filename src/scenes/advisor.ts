import { AREA, AREAS, DISTRIBUTOR, FRONTIER, PS_FEE, SPECS } from '../game/data';
import { credits, fyOf, money, qOf } from '../game/format';
import { advisorKind } from '../game/advisor';
import { canPurchaseDesignation, canStopBenefits, frontierQualified, hasSpec, specQualified, specUnlocked, totalCustomers } from '../game/rules';
import { forecastCosts, lastRevenue } from '../game/sim';
import type { GameState } from '../game/types';

/**
 * Context-sensitive advice, most urgent first. Who it comes from depends on the journey: automated
 * MAICPP programme emails before CSP, the account manager at your distributor once you resell
 * through one, and your Partner Development Manager once you are on the Managed Partner List.
 */
export function advisorTips(s: GameState): string[] {
  const kind = advisorKind(s);
  const tips: string[] = [];
  const util = s.lastReport?.utilisation ?? 0.9;
  const burn = forecastCosts(s) - lastRevenue(s);

  if (s.negativeQuarters > 0) tips.push('{r}CASH CRISIS!{/} Get cash above zero this quarter: cut programmes, borrow, or let staff go.');
  else if (s.cash < burn * 1.5 && burn > 0) tips.push(`{o}Cash is tight.{/} You burn about ${money(burn)} a quarter. Trim programmes or grow revenue.`);
  for (const a of AREAS) if (canPurchaseDesignation(s, a)) tips.push(`{g}You qualify!{/} Buy the ${AREA[a].label} Solutions Partner designation in PARTNER CENTER.`);
  if (frontierQualified(s) && !s.audits.some((x) => x.kind === 'frontier')) tips.push('{y}You meet every Frontier requirement!{/} Book the Frontier Partner audit in PARTNER CENTER.');
  const ready = SPECS.filter((sp) => sp.validation !== 'auto' && !hasSpec(s, sp.id) && specUnlocked(s, sp) && specQualified(s, sp));
  if (ready.length) tips.push(`{g}${ready[0].name}{/} is ready for ${ready[0].validation === 'audit' ? 'audit' : 'customer references'}. See PARTNER CENTER.`);
  if (util > 1.05) tips.push(`{o}Your team is at ${Math.round(util * 100)}% utilisation.{/} Hire engineers in COMPANY or projects will fail and customers will leave.`);

  // Voice of whoever advises you.
  if (kind === 'program') {
    if (s.csp === 'none')
      tips.push(`{c}Start selling Microsoft cloud!{/} Join CSP via a distributor such as ${DISTRIBUTOR.company} (ACTIONS).`);
    if (s.csp === 'direct') tips.push('{c}Direct bill partners{/} hear from MAICPP by email. Two specializations put you on the Managed Partner List, with a PDM.');
    tips.push(
      s.designations.length === 0
        ? '{c}Your Partner Capability Score was updated.{/} Check PARTNER CENTER to see how close you are to Solutions Partner.'
        : '{c}Your Partner Capability Score was updated.{/} Check PARTNER CENTER: designations only renew at 70+.',
    );
  } else if (kind === 'distributor') {
    tips.push(`Earn a {y}second specialization{/} and Microsoft adds you to its Managed Partner List next FY, with a PDM. - ${DISTRIBUTOR.am}`);
    tips.push(`Our CSP team can help you claim {c}partner incentives{/}: Microsoft-funded customer workshops (ACTIONS). - ${DISTRIBUTOR.am}`);
    if (s.designations.length > 0 && totalCustomers(s) >= 60) tips.push(`You qualify for {c}CSP Direct Bill{/}: better margins, but no more distributor support. We'd miss you! - ${DISTRIBUTOR.am}`);
  } else {
    tips.push("Let's co-sell: register referrals in Partner Center and I'll walk your pipeline with the account teams (ACTIONS).");
  }

  if (s.benefits === 'none' && s.designations.length === 0) tips.push('{c}Partner Success Benefits{/} bring internal-use licences and Azure credits. Buy them in COMPANY.');
  if (!s.flags.azureZero && s.azureCredits > 0)
    tips.push(`You have {c}${credits(s.azureCredits)} of Azure credits{/}. Use them to become {y}Customer Zero for Azure{/} before 30 June (ACTIONS).`);
  if (canStopBenefits(s) && s.benefitsRenew)
    tips.push(`Your Solutions Partner benefits now exceed Partner Success: stop renewing it (COMPANY or FY plan) to save ${money(PS_FEE[s.benefits as 'core' | 'expanded'])} a year.`);
  if (qOf(s.turn) === 2 && s.flags.igniteFY !== fyOf(s.turn)) tips.push('{c}Microsoft Ignite{/} is in November! Attending boosts reputation, leads and skills (ACTIONS).');
  if (qOf(s.turn) === 3 && s.designations.length > 0 && !s.nominations.some((n) => n.fy === fyOf(s.turn)))
    tips.push(kind === 'pdm' ? "{y}Partner of the Year{/} nominations are open (ACTIONS). I'll champion yours - and a win wins the game!" : '{y}Partner of the Year{/} nominations are open this quarter (ACTIONS). Winning wins the game!');
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
