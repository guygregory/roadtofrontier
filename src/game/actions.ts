import { AREA, AREAS, AreaId, areaName, AZURE_ZERO, CFG, DISTRIBUTOR, FRONTIER, OFFER, OFFERS, PS_FEE, SPEC } from './data';
import { credits, fyOf, money, pct, qOf } from './format';
import {
  acquire,
  adjCompliance,
  adjMorale,
  adjRep,
  azureZeroSplit,
  becomeAzureZero,
  certGain,
  addCerts,
  grantAzureCredits,
  news,
  spend,
} from './ops';
import {
  auditChance,
  azureAllowance,
  canPurchaseDesignation,
  canStopBenefits,
  creditLimit,
  frontierAuditChance,
  frontierOffers,
  frontierQualified,
  hasDesignation,
  hasSpec,
  maxHires,
  referenceChance,
  specQualified,
  specsInArea,
  totalCustomers,
} from './rules';
import { potyChance } from './poty';
import type { GameState } from './types';

export interface ActionOption {
  id: string;
  label: string;
  cost: number;
  hint?: string;
  disabled?: string;
}

export interface ActionDef {
  id: string;
  name: string;
  /** Name for the current situation, if it changes (e.g. "Join CSP" becomes "CSP Direct Bill"). */
  title?: (s: GameState) => string;
  icon: string;
  ap: number;
  blurb: string;
  needsArea?: boolean;
  /** null if available, otherwise the reason it isn't. */
  available: (s: GameState) => string | null;
  options: (s: GameState) => ActionOption[];
  apply: (s: GameState, optionId: string, area?: AreaId) => string;
}

export function actionTitle(s: GameState, a: ActionDef): string {
  return a.title?.(s) ?? a.name;
}

/**
 * Why an action can't be taken right now, or null if it can. An action whose options are all
 * disabled is blocked too, so the menu never offers something with nothing to choose.
 */
export function actionBlocked(s: GameState, a: ActionDef): string | null {
  const reason = a.available(s);
  if (reason) return reason;
  const opts = a.options(s);
  if (!opts.some((o) => !o.disabled)) return opts.find((o) => o.disabled)?.disabled ?? 'Nothing available right now';
  if (s.ap < a.ap) return 'No action points left';
  return null;
}

const inDev = (s: GameState) => s.offers.filter((o) => !o.published).length;

export const ACTIONS: ActionDef[] = [
  {
    id: 'bootcamp',
    name: 'Certification Bootcamp',
    icon: 'skill',
    ap: 1,
    needsArea: true,
    blurb: 'Intensive exam prep in one solution area. Certifications feed PCS skilling points, specializations and project quality. Costs some billable time.',
    available: () => null,
    options: () => [
      { id: 'std', label: 'Standard bootcamp', cost: 30, hint: '~2 certs, -3% capacity' },
      { id: 'int', label: 'Intensive bootcamp', cost: 55, hint: '~4 certs, -6% capacity' },
    ],
    apply: (s, opt, area) => {
      const a = area ?? s.focus.primary;
      const intense = opt === 'int';
      spend(s, intense ? 55 : 30);
      s.q.capacityLoss += intense ? 0.06 : 0.03;
      const g = certGain(s, a, intense ? 8 : 4);
      return `${AREA[a].label} bootcamp complete: {g}+${g.inter} intermediate, +${g.adv} advanced{/} certifications.`;
    },
  },
  {
    id: 'frontier_skills',
    name: 'Frontier Skilling Journey',
    icon: 'rocket',
    ap: 1,
    blurb: `Frontier Partner needs ${FRONTIER.fte} Frontier Transformation Engineers (Titan badge) and ${FRONTIER.dp600} Fabric Analytics Engineers (DP-600).`,
    available: () => null,
    options: (s) => [
      { id: 'fte', label: 'Frontier Transformation Engineer', cost: 30, hint: `+2 badges (have ${s.fte})`, disabled: s.fte >= s.tech ? 'Not enough engineers' : undefined },
      { id: 'dp600', label: 'Fabric DP-600 cohort', cost: 20, hint: `+2 DP-600 (have ${s.dp600}), +1 D&AI cert`, disabled: s.dp600 >= s.tech ? 'Not enough engineers' : undefined },
    ],
    apply: (s, opt) => {
      if (opt === 'fte') {
        spend(s, 30);
        const before = s.fte;
        s.fte = Math.min(s.tech, s.fte + 2);
        s.q.capacityLoss += 0.02;
        return `{g}+${s.fte - before} Frontier Transformation Engineer badges.{/} Total: ${s.fte}/${FRONTIER.fte}.`;
      }
      spend(s, 20);
      const before = s.dp600;
      s.dp600 = Math.min(s.tech, s.dp600 + 2);
      addCerts(s, 'dataai', 1, 0);
      s.q.capacityLoss += 0.02;
      return `{g}+${s.dp600 - before} Fabric Analytics Engineers (DP-600).{/} Total: ${s.dp600}/${FRONTIER.dp600}.`;
    },
  },
  {
    id: 'offer',
    name: 'Develop Repeatable Offer',
    icon: 'offer',
    ap: 1,
    blurb: 'Package your IP into a repeatable offer and publish it on Microsoft Marketplace. Offers earn high-margin revenue, win deals, boost audits and Partner of the Year. Frontier offers are key to the Frontier audit.',
    available: (s) =>
      OFFERS.every((o) => s.offers.some((x) => x.id === o.id))
        ? 'Every offer is built or in development'
        : inDev(s) >= 2
          ? 'Two offers already in development'
          : null,
    options: (s) =>
      OFFERS.filter((o) => !s.offers.some((x) => x.id === o.id)).map((o) => {
        const q = Math.ceil(o.quarters / (s.bet === 'innovation' ? 1.5 : 1));
        const cost = Math.round(CFG.offerBuildCost * (s.bet === 'innovation' ? 0.75 : 1) * (s.benefits === 'expanded' || s.designations.length > 0 ? 0.85 : 1));
        return {
          id: o.id,
          label: `${o.name}${o.frontier ? ' ★' : ''}`,
          cost: 0,
          hint: `${AREA[o.area].label}. ${money(cost)}/qtr for ~${q} qtrs`,
          disabled: s.areas[o.area].inter < 2 ? `Needs 2+ ${AREA[o.area].label} certs` : undefined,
        };
      }),
    apply: (s, opt) => {
      const o = OFFER[opt];
      s.offers.push({ id: o.id, progress: 0, required: o.quarters, published: false, age: 0 });
      return `Development of {y}${o.name}{/} begins. Costs are charged each quarter until it ships.`;
    },
  },
  {
    id: 'csp',
    name: 'Join CSP',
    title: (s) => (s.csp === 'none' ? 'Join CSP' : 'CSP Direct Bill'),
    icon: 'cart',
    ap: 1,
    blurb: `Resell Microsoft cloud via an Indirect Provider (${DISTRIBUTOR.company}): licence margin, incentives, co-op funds, full PCS credit for new customers and an account manager. Direct Bill: designation + 60 customers.`,
    available: (s) => {
      if (s.csp === 'direct') return 'Already a CSP Direct Bill partner';
      if (s.csp === 'indirect') {
        if (s.designations.length === 0) return 'Already Indirect. Direct Bill needs a designation';
        const c = totalCustomers(s);
        if (c < 60) return `Already Indirect. Direct Bill needs 60+ customers (have ${c})`;
      }
      return null;
    },
    options: (s) =>
      s.csp === 'none'
        ? [
            { id: 'indirect', label: 'CSP Indirect Reseller', cost: 10, hint: `Via ${DISTRIBUTOR.company}` },
            { id: 'direct', label: 'CSP Direct Bill', cost: 60, disabled: 'Join as an Indirect Reseller first' },
          ]
        : [
            {
              id: 'direct',
              label: 'CSP Direct Bill',
              cost: 60,
              hint: 'Better margins. You leave your distributor',
              disabled: s.csp === 'direct' ? 'Already Direct Bill' : s.designations.length === 0 ? 'Needs a Solutions Partner designation' : totalCustomers(s) < 60 ? 'Needs 60+ customers' : undefined,
            },
          ],
    apply: (s, opt) => {
      if (opt === 'indirect') {
        spend(s, 10);
        s.csp = 'indirect';
        const who = s.mpl ? '' : ` ${DISTRIBUTOR.am}, your account manager there, will advise you from now on.`;
        return `{g}You are now a CSP Indirect Reseller with ${DISTRIBUTOR.company}!{/} Licence margin, incentives and full PCS recognition of new customers.${who}`;
      }
      spend(s, 60);
      s.csp = 'direct';
      const who = s.mpl ? '' : ` You buy direct from Microsoft now, so ${DISTRIBUTOR.am} moves on: MAICPP programme emails keep you posted until you join the Managed Partner List.`;
      return `{g}Upgraded to CSP Direct Bill.{/} Margins and incentives up.${who}`;
    },
  },
  {
    id: 'incentives',
    name: 'Claim Partner Incentives',
    icon: 'coin',
    ap: 1,
    needsArea: true,
    blurb: 'Microsoft-funded pre-sales workshops and deployment acceleration. Wins customers, adds funded deployments and improves project success. Full eligibility needs the designation (or a specialization) in that area.',
    available: (s) => (s.csp === 'none' && s.designations.length === 0 ? 'Needs CSP enrolment or a designation' : null),
    options: () => [{ id: 'claim', label: 'Request workshop funding', cost: 2, hint: 'Paid by Microsoft' }],
    apply: (s, _opt, area) => {
      const a = area ?? s.focus.primary;
      spend(s, 2);
      const boost = s.modifiers.some((m) => m.id === 'incentiveBoost' && m.until >= s.turn) ? 1.5 : 1;
      const n = specsInArea(s, a) > 0 ? 4 : hasDesignation(s, a) ? 3 : 2;
      s.q.workshops[a] = (s.q.workshops[a] ?? 0) + n;
      s.q.projectBoost[a] = (s.q.projectBoost[a] ?? 0) + 0.1;
      s.q.leads[a] = (s.q.leads[a] ?? 0) + n;
      s.q.workshopRevenue += Math.round(n * 12 * boost);
      return `${n} funded ${AREA[a].label} workshop${n > 1 ? 's' : ''} approved${n === 2 ? ' (limited eligibility without the designation)' : ''}. Microsoft pays ${money(Math.round(n * 12 * boost))}.`;
    },
  },
  {
    id: 'coop',
    name: 'Co-op Marketing Event',
    icon: 'calendar',
    ap: 1,
    needsArea: true,
    blurb: 'Spend Marketing Co-op funds (topped up with cash if needed) on events that generate leads. Co-op funds expire at the end of each financial year - use them or lose them!',
    available: () => null,
    options: (s) => [
      { id: 'webinar', label: 'Webinar series', cost: 8, hint: '~3 leads' },
      { id: 'roadshow', label: 'Customer roadshow', cost: 20, hint: '~7 leads, +2 rep' },
      { id: 'exec', label: 'Executive briefing', cost: 35, hint: '~10 leads + big-deal chance', disabled: s.designations.length === 0 ? 'Needs a designation' : undefined },
    ],
    apply: (s, opt, area) => {
      const a = area ?? s.focus.primary;
      const cost = opt === 'webinar' ? 8 : opt === 'roadshow' ? 20 : 35;
      const fromCoop = Math.min(s.coop, cost);
      s.coop -= fromCoop;
      spend(s, cost - fromCoop);
      const leads = opt === 'webinar' ? 3 : opt === 'roadshow' ? 7 : 10;
      s.q.leads[a] = (s.q.leads[a] ?? 0) + leads;
      if (opt === 'roadshow') adjRep(s, 2);
      if (opt === 'exec') {
        adjRep(s, 2);
        s.q.keyBonus += 0.08;
      }
      return `Event booked in ${AREA[a].label}: +${leads} leads expected. ${fromCoop > 0 ? `${money(fromCoop)} paid from co-op funds.` : 'Paid in cash (no co-op funds left).'}`;
    },
  },
  {
    id: 'ignite',
    name: 'Attend Microsoft Ignite',
    icon: 'flame',
    ap: 1,
    blurb: "Microsoft's flagship November conference. Meet account teams, learn what's new, find customers and boost your reputation. Only in Q2 (October-December).",
    available: (s) => (qOf(s.turn) !== 2 ? 'Ignite is in November (Q2)' : s.flags.igniteFY === fyOf(s.turn) ? 'Already attending this year' : null),
    options: () => [
      { id: 'delegation', label: 'Send a delegation', cost: 25, hint: '+rep, leads, skills' },
      { id: 'booth', label: 'Sponsor a booth', cost: 70, hint: 'Big rep & lead boost' },
    ],
    apply: (s, opt) => {
      const booth = opt === 'booth';
      spend(s, booth ? 70 : 25);
      s.flags.igniteFY = fyOf(s.turn);
      s.q.ignite = true;
      adjRep(s, booth ? 6 : 3);
      s.q.skillPts += 2;
      const a = s.focus.primary;
      s.q.leads[a] = (s.q.leads[a] ?? 0) + (booth ? 6 : 3);
      if (s.focus.secondary) s.q.leads[s.focus.secondary] = (s.q.leads[s.focus.secondary] ?? 0) + (booth ? 3 : 1);
      s.q.keyBonus += booth ? 0.08 : 0.03;
      s.q.referralLeads += 1;
      return booth ? '{g}Your booth is buzzing!{/} +6 reputation, a stack of leads and new friends at Microsoft.' : 'Great sessions, useful meetings. +3 reputation and new leads.';
    },
  },
  {
    id: 'build',
    name: 'Attend Microsoft Build',
    icon: 'monitor',
    ap: 1,
    blurb: "Microsoft's developer conference in May. Accelerates offer development and developer skills. Only in Q4 (April-June).",
    available: (s) => (qOf(s.turn) !== 4 ? 'Build is in May (Q4)' : s.flags.buildFY === fyOf(s.turn) ? 'Already attending this year' : null),
    options: () => [
      { id: 'delegation', label: 'Send a delegation', cost: 20, hint: 'Offers +50% progress, skills' },
      { id: 'speaker', label: 'Land a speaker session', cost: 45, hint: '+rep, offers +1 quarter' },
    ],
    apply: (s, opt) => {
      const speaker = opt === 'speaker';
      spend(s, speaker ? 45 : 20);
      s.flags.buildFY = fyOf(s.turn);
      s.q.build = true;
      if (speaker) for (const o of s.offers) if (!o.published) o.progress += 0.5;
      adjRep(s, speaker ? 4 : 2);
      certGain(s, 'dai', 2);
      certGain(s, 'dataai', 1);
      const a = s.focus.primary;
      s.q.leads[a] = (s.q.leads[a] ?? 0) + (speaker ? 5 : 2);
      return speaker ? '{g}Your session is a hit!{/} +4 reputation; offers leap forward.' : 'Developers return buzzing with ideas. Offer development accelerated.';
    },
  },
  {
    id: 'poty',
    name: 'Partner of the Year',
    icon: 'trophy',
    ap: 1,
    blurb: 'Nominations open in Q3 (January-March); one per year. Winners are announced at the end of the financial year. Win and you win the game! You need the designation for a category. Competition is fierce.',
    available: (s) => {
      if (qOf(s.turn) !== 3) return 'Nominations open in Q3 (Jan-Mar)';
      if (s.designations.length === 0) return 'Needs a Solutions Partner designation';
      if (s.nominations.some((n) => n.fy === fyOf(s.turn))) return 'One nomination per year - already submitted';
      return null;
    },
    options: (s) => {
      const fy = fyOf(s.turn);
      const cats: (AreaId | 'frontier')[] = s.designations.map((d) => d.area);
      if (frontierOffers(s) >= 1 && ['copilot', 'datasec', 'iam', 'aiapps', 'aiplatform'].some((x) => hasSpec(s, x))) cats.push('frontier');
      const out: ActionOption[] = [];
      for (const c of cats) {
        const done = s.nominations.some((n) => n.fy === fy && n.category === c);
        // Option labels fit 25 characters: full names where they fit, shorter ones where they don't.
        const name = (suffix: string) => (c === 'frontier' ? 'Frontier AI' : areaName(c, 25 - suffix.length));
        out.push({ id: `${c}|std`, label: `${name(' (standard)')} (standard)`, cost: 12, hint: `Est. chance ${pct(potyChance(s, c, false))}`, disabled: done ? 'Already nominated' : undefined });
        out.push({ id: `${c}|premium`, label: `${name(' (premium)')} (premium)`, cost: 30, hint: `Video case study. ${pct(potyChance(s, c, true))}`, disabled: done ? 'Already nominated' : undefined });
      }
      return out;
    },
    apply: (s, opt) => {
      const [cat, kind] = opt.split('|');
      const premium = kind === 'premium';
      spend(s, premium ? 30 : 12);
      s.nominations.push({ category: cat as AreaId | 'frontier', premium, fy: fyOf(s.turn) });
      const name = cat === 'frontier' ? 'Frontier AI Transformation' : AREA[cat as AreaId].name;
      return `Nomination submitted: {y}${name} Partner of the Year{/}. Results at the end of the financial year. Keep growing to improve your odds!`;
    },
  },
  {
    id: 'acquire',
    name: 'Acquire a Competitor',
    icon: 'briefcase',
    ap: 1,
    blurb: 'Buy a rival partner for instant engineers, certifications and customers. Integration costs money and morale. Due diligence uncovers hidden problems. Short on cash? Finance it with debt.',
    available: (s) => (s.targets.length === 0 ? 'No companies for sale right now' : null),
    options: (s) => {
      const out: ActionOption[] = [];
      for (const t of s.targets) {
        const traits = t.diligence ? ` [${t.skeleton ? 'COMPLIANCE RISK' : 'clean books'}, ${t.culture ? 'culture risk' : 'good fit'}]` : '';
        out.push({
          id: `buy|${t.id}`,
          label: `Buy ${t.name}`,
          cost: Math.min(t.price, Math.max(0, s.cash)),
          hint: `${money(t.price)}${s.cash < t.price ? ' (part financed)' : ''}. ${t.tech} eng, ${t.customers} ${AREA[t.area].short} cust${traits}`,
        });
        if (!t.diligence) out.push({ id: `dd|${t.id}`, label: `Due diligence: ${t.name}`, cost: 15, hint: 'Reveal hidden risks' });
      }
      return out;
    },
    apply: (s, opt) => {
      const [kind, idStr] = opt.split('|');
      const id = Number(idStr);
      const t = s.targets.find((x) => x.id === id);
      if (!t) return 'That deal is off the table.';
      if (kind === 'dd') {
        spend(s, 15);
        t.diligence = true;
        t.expires = Math.max(t.expires, s.turn + 1);
        return `Due diligence on ${t.name}: ${t.skeleton ? '{r}incentive over-claiming found!{/}' : '{g}books are clean.{/}'} ${t.culture ? '{o}Culture clash likely.{/}' : '{g}Good cultural fit.{/}'}`;
      }
      return acquire(s, id, s.cash < t.price);
    },
  },
  {
    id: 'unified',
    name: 'Unified for Partners',
    icon: 'headset',
    ap: 1,
    blurb: 'Microsoft support plan for partners: rapid escalation during outages, capacity crunches and failing projects. Improves project success and customer satisfaction. Charged every quarter until cancelled.',
    available: (s) => (s.unified ? 'Already subscribed (cancel in COMPANY)' : null),
    options: () => [{ id: 'sub', label: 'Subscribe', cost: 0, hint: `${money(CFG.unifiedCost)}/qtr` }],
    apply: (s) => {
      s.unified = true;
      return '{g}Unified for Partners is active.{/} Help is a phone call away.';
    },
  },
  {
    id: 'cosell',
    name: 'Co-sell with Microsoft',
    icon: 'handshake',
    ap: 1,
    blurb: 'Register referrals in Partner Center and work joint opportunities with Microsoft account teams. More referral leads, a better shot at big deals, and a stronger Microsoft relationship.',
    available: (s) => (s.sales < 1 ? 'Needs at least one seller' : null),
    options: (s) => [{ id: 'push', label: 'Register referrals', cost: 5, hint: `~${2 + s.designations.length + (s.mpl ? 1 : 0)} referral leads${s.mpl ? ' (PDM boost)' : ''}` }],
    apply: (s) => {
      spend(s, 5);
      s.q.referralLeads += 2 + s.designations.length + (s.mpl ? 1 : 0);
      s.q.keyBonus += 0.05 + 0.02 * s.designations.length;
      adjRep(s, 1);
      return s.mpl
        ? 'Referrals registered, and your PDM walks your pipeline through with the account teams. +1 reputation.'
        : 'Referrals registered and pipeline reviewed with your account teams. +1 reputation.';
    },
  },
  {
    id: 'compliance',
    name: 'Compliance Health Check',
    icon: 'clipboard',
    ap: 1,
    blurb: 'Review Partner Center records, PAL/CPOR associations and incentive claims. Raises compliance, and self-disclosing past mistakes defuses future audits.',
    available: () => null,
    options: () => [{ id: 'review', label: 'Run the review', cost: 10, hint: '+15 compliance' }],
    apply: (s) => {
      spend(s, 10);
      adjCompliance(s, 15);
      let extra = '';
      if (s.flags.palAbuse) {
        s.flags.palAbuse = 0;
        s.scheduled = s.scheduled.filter((x) => x.id !== 'pal_audit');
        adjCompliance(s, 5);
        extra = ' You self-disclose the over-linked associations; Microsoft appreciates the honesty.';
      }
      return `Records tidied. Compliance now ${s.compliance}.${extra}`;
    },
  },
  {
    id: 'internal_ai',
    name: 'Customer Zero: Copilot',
    icon: 'monitor',
    ap: 1,
    blurb: "Become 'customer zero' for Copilot: roll out Microsoft 365 Copilot and agents inside your own company. Permanent productivity boost, a Frontier Transformation Engineer badge and better Frontier audit odds.",
    available: (s) => (s.flags.customerZero ? 'Already done' : null),
    options: () => [{ id: 'go', label: 'Roll it out', cost: 30, hint: '+5% productivity forever' }],
    apply: (s) => {
      spend(s, 30);
      s.flags.customerZero = 1;
      s.productivity += 0.05;
      s.fte = Math.min(s.tech, s.fte + 1);
      adjMorale(s, 3);
      return '{g}You are customer zero for Copilot!{/} Productivity +5%, +1 Frontier Transformation Engineer.';
    },
  },
  {
    id: 'azure_zero',
    name: 'Customer Zero: Azure',
    icon: 'cloud',
    ap: 1,
    blurb: `Run your company on Azure: agents on Azure AI Foundry and a Fabric data estate. Pay cash, or use the yearly Azure credits from Partner Success, designation and specialization benefits. Then ${money(AZURE_ZERO.runCost)}/qtr of Azure usage, credits first.`,
    available: (s) => (s.flags.azureZero ? 'Already running on Azure' : null),
    options: (s) => {
      const split = azureZeroSplit(s, true);
      return [
        {
          id: 'credits',
          label: 'Use Azure credits',
          cost: 0,
          hint: `${credits(split.credits)} credits${split.cash > 0 ? ` + ${credits(split.cash)} cash` : ', no cash'}`,
          disabled: s.azureCredits <= 0 ? 'No Azure credits from benefits yet' : undefined,
        },
        { id: 'cash', label: 'Pay in cash', cost: AZURE_ZERO.cost, hint: `+${pct(AZURE_ZERO.productivity)} productivity, +1 DP-600` },
      ];
    },
    apply: (s, opt) => becomeAzureZero(s, opt === 'credits'),
  },
];

export const ACTION: Record<string, ActionDef> = Object.fromEntries(ACTIONS.map((a) => [a.id, a]));

export function performAction(s: GameState, id: string, optionId: string, area?: AreaId): string {
  const a = ACTION[id];
  if (!a) return '';
  if (s.ap < a.ap) return '{r}No action points left this quarter.{/}';
  const reason = actionBlocked(s, a);
  if (reason) return `{r}${reason}{/}`;
  const opt = a.options(s).find((o) => o.id === optionId);
  if (!opt || opt.disabled) return `{r}${opt?.disabled ?? 'Not available'}{/}`;
  s.ap -= a.ap;
  s.q.actionsTaken.push(id);
  const out = a.apply(s, optionId, area);
  news(s, out.replace(/\{[a-zA-Z/]\}/g, ''));
  return out;
}

// ---------------------------------------------------------------------------
// Partner Center operations

export function purchaseDesignation(s: GameState, area: AreaId): string {
  if (!canPurchaseDesignation(s, area)) return '{r}Not qualified yet.{/}';
  const before = azureAllowance(s).total;
  spend(s, CFG.designationFee);
  s.designations.push({ area, since: s.turn, renewAt: s.turn + 4 });
  adjRep(s, 3);
  const added = grantAzureCredits(s, azureAllowance(s).total - before);
  news(s, `${s.company} earns Solutions Partner for ${AREA[area].name}!`);
  return `{g}Congratulations! You are now a Solutions Partner for ${AREA[area].name}.{/} New specializations unlocked${added > 0 ? `, and {c}${credits(added)} of Azure credits{/} added to your benefits` : ''}.`;
}

export function scheduleAudit(s: GameState, specId: string, prep: boolean): string {
  const spec = SPEC[specId];
  if (!spec) return '';
  if (s.ap < 1) return '{r}No action points left this quarter.{/}';
  if (!specQualified(s, spec)) return '{r}Qualification requirements not met.{/}';
  if (s.audits.some((a) => a.spec === specId)) return '{r}Already scheduled.{/}';
  s.ap -= 1;
  if (spec.validation === 'reference') {
    spend(s, CFG.refCost);
    s.audits.push({ kind: 'reference', spec: specId, chance: referenceChance(s, spec) });
    return `Customer reference submitted for ${spec.name}. Result at quarter end.`;
  }
  const cost = CFG.auditCost + (prep ? 15 : 0);
  spend(s, cost);
  s.audits.push({ kind: 'spec', spec: specId, chance: auditChance(s, spec, prep) });
  s.stats.audits++;
  return `Third-party audit for ${spec.name} booked (${money(cost)}). Result at quarter end.`;
}

export function scheduleFrontierAudit(s: GameState, prep: boolean): string {
  if (s.ap < 1) return '{r}No action points left this quarter.{/}';
  if (!frontierQualified(s)) return '{r}Frontier requirements not met.{/}';
  if (s.audits.some((a) => a.kind === 'frontier')) return '{r}Already scheduled.{/}';
  s.ap -= 1;
  const cost = FRONTIER.auditCost + (prep ? 20 : 0);
  spend(s, cost);
  s.audits.push({ kind: 'frontier', chance: frontierAuditChance(s, prep) });
  s.stats.audits++;
  return `{y}Frontier Partner audit booked!{/} (${money(cost)}). The auditors arrive this quarter...`;
}

// ---------------------------------------------------------------------------
// Company operations (no action points)

export function hireStaff(s: GameState, kind: 'tech' | 'sales', n: number): string {
  const room = maxHires(s) - s.hiresThisQuarter;
  const k = Math.min(n, room);
  if (k <= 0) return '{r}Recruiting is maxed out this quarter.{/}';
  spend(s, CFG.hireCost * k);
  s.hiresThisQuarter += k;
  if (kind === 'tech') s.tech += k;
  else s.sales += k;
  return `Hired ${k} ${kind === 'tech' ? 'engineer' : 'seller'}${k > 1 ? 's' : ''}.`;
}

export function hireArchitect(s: GameState, area: AreaId): string {
  if (s.hiresThisQuarter >= maxHires(s)) return '{r}Recruiting is maxed out this quarter.{/}';
  spend(s, CFG.architectCost);
  s.hiresThisQuarter++;
  s.tech++;
  addCerts(s, area, 0, 1);
  return `New ${areaName(area, 15)} architect: +1 advanced cert.`;
}

export function fireStaff(s: GameState, kind: 'tech' | 'sales', n: number): string {
  const have = kind === 'tech' ? s.tech - 1 : s.sales;
  const k = Math.min(n, have);
  if (k <= 0) return '{r}Nobody left to let go.{/}';
  spend(s, CFG.severance * k);
  if (kind === 'tech') {
    s.tech -= k;
    for (const a of AREAS) {
      const ar = s.areas[a];
      ar.inter = Math.min(ar.inter, s.tech);
      ar.adv = Math.min(ar.adv, ar.inter);
    }
    s.fte = Math.min(s.fte, s.tech);
    s.dp600 = Math.min(s.dp600, s.tech);
  } else s.sales -= k;
  adjMorale(s, -Math.min(15, 4 * k));
  return `${k} ${kind === 'tech' ? 'engineer' : 'seller'}${k > 1 ? 's' : ''} let go (${money(CFG.severance * k)} severance). Morale falls.`;
}

export function borrow(s: GameState, amount: number): string {
  const room = creditLimit(s) - s.debt;
  const k = Math.min(amount, room);
  if (k <= 0) return '{r}Credit line exhausted.{/}';
  s.debt += k;
  s.cash += k;
  return `Borrowed ${money(k)} at ${Math.round(CFG.interest * 400)}% APR.`;
}

export function repay(s: GameState, amount: number): string {
  const k = Math.min(amount, s.debt, Math.max(0, s.cash));
  if (k <= 0) return '{r}Nothing to repay (or no cash).{/}';
  s.debt -= k;
  s.cash -= k;
  return `Repaid ${money(k)}.`;
}

export function cancelUnified(s: GameState): string {
  s.unified = false;
  return 'Unified for Partners cancelled.';
}

export function buyBenefits(s: GameState, pkg: 'core' | 'expanded'): string {
  if (s.benefits === pkg || (s.benefits === 'expanded' && pkg === 'core')) return '{r}Already have that package.{/}';
  const before = azureAllowance(s).total;
  spend(s, PS_FEE[pkg]);
  s.benefits = pkg;
  s.benefitsRenew = true;
  s.flags.psPaidFY = fyOf(s.turn);
  const added = grantAzureCredits(s, azureAllowance(s).total - before);
  return `Partner Success ${pkg === 'core' ? 'Core' : 'Expanded'} on${added > 0 ? `: +${credits(added)} Azure credits` : ''}`;
}

/** Is the Partner Success renewal for the current FY still to be charged (FY plan not yet confirmed)? */
export function benefitsRenewalDue(s: GameState): boolean {
  return s.benefits !== 'none' && s.flags.psPaidFY !== fyOf(s.turn);
}

/** Switch Partner Success auto-renewal. Stopping is allowed once you hold a Solutions Partner designation. */
export function setBenefitsRenewal(s: GameState, renew: boolean): string {
  if (s.benefits === 'none') return '{r}No Partner Success package to renew.{/}';
  if (!renew && !canStopBenefits(s)) return '{r}You can stop Partner Success once you hold a Solutions Partner designation.{/}';
  s.benefitsRenew = renew;
  const thisYear = s.phase === 'plan' && benefitsRenewalDue(s);
  if (renew) return thisYear ? 'Partner Success renews when you confirm the plan' : 'Partner Success will renew on 1 July';
  return thisYear ? 'Partner Success will not be renewed this year' : 'Partner Success will lapse on 30 June';
}

export function areaOptions(): AreaId[] {
  return AREAS;
}
