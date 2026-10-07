import { AREA, AREAS, AreaId, AZURE_ZERO, CFG, DIFFICULTY, DISTRIBUTOR, RIVAL_NAMES } from './data';
import { credits, money } from './format';
import { advisorKind, byAdvisor, currentPdm } from './advisor';
import {
  addCerts,
  addMod,
  adjCompliance,
  adjMorale,
  adjRep,
  azureZeroSplit,
  becomeAzureZero,
  businessArea,
  gainKeyAccount,
  keyInArea,
  lose,
  loseKeyAccount,
  lowestSatKey,
  makeTarget,
  news,
  randomKey,
  removeTech,
  schedule,
  spend,
} from './ops';
import { hasDesignation, publishedOffers, skillRatio, specsInArea, sum } from './rules';
import { pick, rand, randInt, weightedPick } from './rng';
import type { GameState, PendingEvent } from './types';

type Data = Record<string, unknown>;

export interface Choice {
  label: string;
  hint?: string;
  disabled?: string;
  apply: (s: GameState, d: Data) => string;
}

export interface EventDef {
  id: string;
  kind: 'bad' | 'good' | 'dilemma' | 'followup';
  icon: string;
  title: string;
  weight?: (s: GameState) => number;
  cooldown?: number;
  once?: boolean;
  minTurn?: number;
  prepare?: (s: GameState) => Data | null;
  text: (s: GameState, d: Data) => string;
  choices: (s: GameState, d: Data) => Choice[];
}

const A = (id: unknown) => AREA[id as AreaId] ?? AREA.dataai;
/** Area from event data, falling back safely for old saves. */
const areaOf = (s: GameState, id: unknown): AreaId => (AREAS.includes(id as AreaId) ? (id as AreaId) : s.focus.primary);
const keyById = (s: GameState, id: unknown) => s.key.find((k) => k.id === id);
const pctTxt = (p: number) => `${Math.round(p * 100)}%`;

function loseKeyText(s: GameState, id: unknown): string {
  const k = loseKeyAccount(s, id as number);
  if (!k) return 'The account had already moved on.';
  return `{r}${k.name} has gone.{/} -${money(k.revenue)}/qtr revenue. PCS hit in ${AREA[k.area].label}: net customer adds and usage growth both fall.`;
}

export const EVENTS: EventDef[] = [
  // ------------------------------------------------------------------ BAD
  {
    id: 'lose_key',
    kind: 'bad',
    icon: 'heartbreak',
    title: 'KEY ACCOUNT AT RISK',
    cooldown: 2,
    weight: (s) => (s.key.length === 0 ? 0 : 1 + s.key.filter((k) => k.sat < 50).length * 2.5),
    prepare: (s) => {
      const k = rand(s) < 0.7 ? lowestSatKey(s) : randomKey(s);
      return k ? { keyId: k.id, name: k.name, area: k.area, rev: k.revenue, sat: k.sat } : null;
    },
    text: (_s, d) =>
      `${d.name}'s new CIO is reviewing every supplier. Your ${A(d.area).label} contract, worth {y}${money(d.rev as number)}/qtr{/}, is on the table. Satisfaction is ${d.sat}%.`,
    choices: (s, d) => {
      const base = 0.4 + (d.sat as number) / 200 + (s.unified ? 0.1 : 0) + specsInArea(s, d.area as AreaId) * 0.05;
      return [
        {
          label: 'Executive rescue plan',
          hint: `$30K. ~${pctTxt(Math.min(0.95, base))} to keep them`,
          apply: (s2) => {
            spend(s2, 30);
            const k = keyById(s2, d.keyId);
            if (!k) return 'Too late.';
            if (rand(s2) < Math.min(0.95, base)) {
              k.sat = Math.min(100, k.sat + 20);
              adjRep(s2, 1);
              return `{g}Saved!{/} Your CEO's visit and a fresh roadmap win ${k.name} round.`;
            }
            return `The pitch lands badly. ${loseKeyText(s2, d.keyId)}`;
          },
        },
        {
          label: 'Offer a 20% discount',
          hint: 'Lower revenue, very likely to stay',
          apply: (s2) => {
            const k = keyById(s2, d.keyId);
            if (!k) return 'Too late.';
            if (rand(s2) < 0.85) {
              k.revenue = Math.round(k.revenue * 0.8);
              k.sat = Math.min(100, k.sat + 12);
              return `${k.name} signs on at a lower rate: now ${money(k.revenue)}/qtr.`;
            }
            return `Even the discount isn't enough. ${loseKeyText(s2, d.keyId)}`;
          },
        },
        { label: 'Let them go', hint: 'Lose the account', apply: (s2) => loseKeyText(s2, d.keyId) },
      ];
    },
  },
  {
    id: 'staff_leave',
    kind: 'bad',
    icon: 'door',
    title: 'KEY ENGINEERS RESIGN',
    cooldown: 2,
    weight: (s) => (s.tech < 6 ? 0 : 1 + Math.max(0, 62 - s.morale) / 7),
    prepare: (s) => {
      const best = [...AREAS].sort((a, b) => s.areas[b].adv - s.areas[a].adv)[0];
      const n = Math.max(1, Math.min(3, Math.round(s.tech / 10)));
      return { area: best, n, adv: s.areas[best].adv };
    },
    text: (_s, d) =>
      `A rival is offering big packages to ${d.n} of your senior ${A(d.area).label} engineers. Between them they hold {y}${Math.min(d.n as number, d.adv as number)} advanced{/} certifications.`,
    choices: (s, d) => {
      const n = d.n as number;
      const keep = 0.55 + s.programmes.people * 0.1;
      const leave = (s2: GameState) => {
        const lost = removeTech(s2, n, areaOf(s2, d.area));
        return `{r}${n} engineer${n > 1 ? 's' : ''} leave.{/} Lost ${lost.inter} intermediate and ${lost.adv} advanced certs: PCS skilling in ${A(d.area).label} drops.`;
      };
      return [
        {
          label: 'Counter-offer',
          hint: `${money(12 * n)}. ~${pctTxt(keep)} they stay`,
          apply: (s2) => {
            spend(s2, 12 * n);
            if (rand(s2) < keep) {
              adjMorale(s2, 3);
              return '{g}They stay.{/} The team notices you fought for them.';
            }
            return `They take the money and still go. ${leave(s2)}`;
          },
        },
        {
          label: 'Let them go, backfill fast',
          hint: `${money(8 * n)} for ${n} junior hires`,
          apply: (s2) => {
            const t = leave(s2);
            spend(s2, 8 * n);
            s2.tech += n;
            return `${t} ${n} uncertified junior${n > 1 ? 's' : ''} join.`;
          },
        },
        {
          label: 'Wish them well',
          apply: (s2) => {
            adjMorale(s2, -3);
            return leave(s2);
          },
        },
      ];
    },
  },
  {
    id: 'downturn',
    kind: 'bad',
    icon: 'chartdown',
    title: 'ECONOMIC DOWNTURN',
    minTurn: 3,
    cooldown: 8,
    weight: (s) => (s.modifiers.some((m) => m.id === 'downturn') ? 0 : 0.9),
    text: () =>
      'Markets tumble. Customers freeze discretionary spend for the next three quarters: fewer leads, tougher deals, smaller budgets.',
    choices: (s) => [
      {
        label: 'Cut costs: 10% layoffs',
        hint: 'Severance now, lower burn, morale hit',
        apply: (s2) => {
          addMod(s2, 'downturn', 3);
          const n = Math.max(1, Math.round(s2.tech * 0.1));
          removeTech(s2, n);
          spend(s2, n * CFG.severance);
          adjMorale(s2, -10);
          return `Downturn for 3 quarters. ${n} engineers let go (${money(n * CFG.severance)} severance).`;
        },
      },
      {
        label: 'Lean on Microsoft funding',
        hint: '+2 funded workshops in your primary area',
        apply: (s2) => {
          addMod(s2, 'downturn', 3);
          const a = s2.focus.primary;
          s2.q.workshops[a] = (s2.q.workshops[a] ?? 0) + 2;
          s2.q.workshopRevenue += 24;
          adjRep(s2, 2);
          const who = byAdvisor(s2, {
            pdm: `${currentPdm(s2).name}, your PDM, steers`,
            distributor: `${DISTRIBUTOR.am} at ${DISTRIBUTOR.company} points`,
            program: 'A MAICPP incentives email points',
          });
          return `Downturn for 3 quarters. ${who} incentive-funded workshops your way in ${AREA[a].label}.`;
        },
      },
      {
        label: 'Ride it out',
        apply: (s2) => {
          addMod(s2, 'downturn', 3);
          void s;
          return 'Downturn for 3 quarters. Steady as she goes.';
        },
      },
    ],
  },
  {
    id: 'project_awry',
    kind: 'bad',
    icon: 'warning',
    title: 'PROJECT GOES AWRY',
    cooldown: 1,
    weight: (s) => {
      const f = s.focus.primary;
      return 0.6 + (1 - skillRatio(s, f)) * 1.5 + (s.lastReport && s.lastReport.utilisation > 1 ? 1 : 0);
    },
    prepare: (s) => {
      // Prefer an area where skills are thin.
      const areas = AREAS.filter((a) => s.areas[a].customers > 0 || keyInArea(s, a).length > 0);
      if (areas.length === 0) return null;
      const area = areas.sort((a, b) => skillRatio(s, a) - skillRatio(s, b))[0];
      const k = keyInArea(s, area)[0];
      return { area, keyId: k?.id ?? -1, name: k?.name ?? 'a mid-size customer' };
    },
    text: (_s, d) =>
      `The ${A(d.area).label} deployment at ${d.name} has blown its timeline. Architecture choices are being questioned and the customer is furious.`,
    choices: (s, d) => {
      const area = d.area as AreaId;
      const swarm = 0.45 + skillRatio(s, area) * 0.45;
      const fail = (s2: GameState) => {
        adjRep(s2, -3);
        s2.areas[area].usage[3] -= 2;
        const k = keyById(s2, d.keyId);
        if (k) k.sat = Math.max(0, k.sat - 20);
        return `{r}The project fails.{/} Reputation and ${AREA[area].label} usage growth take a hit.`;
      };
      const ok = (s2: GameState) => {
        s2.areas[area].deploys[3] += 1;
        const k = keyById(s2, d.keyId);
        if (k) k.sat = Math.min(100, k.sat + 8);
        return '{g}Recovered!{/} The deployment lands and counts toward your PCS.';
      };
      return [
        {
          label: 'Swarm it with seniors',
          hint: `$25K, -5% capacity. ~${pctTxt(swarm)} success`,
          apply: (s2) => {
            spend(s2, 25);
            s2.q.capacityLoss += 0.05;
            return rand(s2) < swarm ? ok(s2) : fail(s2);
          },
        },
        {
          label: 'Escalate to Unified',
          hint: 'Free with Unified for Partners. ~85%',
          disabled: s.unified ? undefined : 'Needs Unified for Partners',
          apply: (s2) => (rand(s2) < 0.85 ? ok(s2) : fail(s2)),
        },
        {
          label: 'Use deployment funding',
          hint: '$5K. Needs the designation. ~70%',
          disabled: hasDesignation(s, area) ? undefined : `Needs ${AREA[area].label} designation`,
          apply: (s2) => {
            spend(s2, 5);
            return rand(s2) < 0.7 ? ok(s2) : fail(s2);
          },
        },
        {
          label: 'Renegotiate scope',
          hint: 'Free. Unhappy customer',
          apply: (s2) => {
            adjRep(s2, -2);
            const k = keyById(s2, d.keyId);
            if (k) k.sat = Math.max(0, k.sat - 12);
            s2.areas[area].usage[3] -= 1;
            return 'Scope is cut back. The customer grumbles, but the project limps home.';
          },
        },
      ];
    },
  },
  {
    id: 'capacity',
    kind: 'bad',
    icon: 'hourglass',
    title: 'AZURE CAPACITY CRUNCH',
    cooldown: 4,
    weight: (s) => {
      const az = AREAS.filter((a) => AREA[a].azure).reduce((n, a) => n + s.areas[a].customers, 0);
      return az < 3 ? 0 : 0.5 + az / 30;
    },
    text: () =>
      "GPU and VM capacity in your customers' preferred region is constrained. AI and migration projects are stalling this quarter.",
    choices: (s) => [
      {
        label: 'Re-architect to another region',
        hint: '$20K. Mostly mitigated',
        apply: (s2) => {
          spend(s2, 20);
          for (const a of AREAS) if (AREA[a].azure) s2.areas[a].usage[3] -= 1;
          return 'Workloads move to a region with headroom. Minor delays only.';
        },
      },
      {
        label: 'Escalate via Unified',
        hint: 'Free with Unified for Partners',
        disabled: s.unified ? undefined : 'Needs Unified for Partners',
        apply: () => '{g}Your Unified team secures capacity reservations.{/} No impact.',
      },
      {
        label: 'Wait it out',
        hint: 'Azure projects -40% this quarter',
        apply: (s2) => {
          addMod(s2, 'capacity', 1);
          for (const k of s2.key) if (AREA[k.area].azure) k.sat = Math.max(0, k.sat - 5);
          return 'Projects wait in the queue. Azure customers are restless.';
        },
      },
    ],
  },
  {
    id: 'outage',
    kind: 'bad',
    icon: 'server',
    title: 'DATACENTER REGION OUTAGE',
    cooldown: 4,
    weight: (s) => (s.key.length === 0 ? 0 : 0.8),
    text: (s) =>
      `A Microsoft datacenter region is down. Customers are calling - some workloads have no failover.${s.flags.resilient ? ' {g}Your multi-region designs are holding up.{/}' : ''}`,
    choices: (s) => {
      const r = s.flags.resilient ? 0.3 : 1;
      return [
        {
          label: 'War room + proactive comms',
          hint: '$15K. Limits the damage',
          apply: (s2) => {
            spend(s2, 15);
            for (const k of s2.key) k.sat = Math.max(0, k.sat - Math.round(5 * r));
            adjRep(s2, 3);
            return 'You keep customers informed hour by hour. They appreciate it.';
          },
        },
        {
          label: 'Engage Unified for Partners',
          hint: 'Free with Unified',
          disabled: s.unified ? undefined : 'Needs Unified for Partners',
          apply: (s2) => {
            for (const k of s2.key) k.sat = Math.max(0, k.sat - Math.round(2 * r));
            adjRep(s2, 4);
            return '{g}Unified engineers help you fail over fast.{/} Customers barely notice.';
          },
        },
        {
          label: 'Wait for the status page',
          hint: 'Free. Risky',
          apply: (s2) => {
            for (const k of s2.key) k.sat = Math.max(0, k.sat - Math.round(15 * r));
            s2.q.extraChurn += 0.02 * r;
            adjRep(s2, -3 * r);
            return 'Hours of silence. Customers are not impressed.';
          },
        },
      ];
    },
  },
  {
    id: 'price_war',
    kind: 'bad',
    icon: 'chartdown',
    title: 'COMPETITOR PRICE WAR',
    minTurn: 2,
    cooldown: 6,
    weight: () => 0.6,
    prepare: (s) => ({ rival: pick(s, RIVAL_NAMES) }),
    text: (_s, d) => `${d.rival} is undercutting everyone by 25% to grab market share. Your win rates are sliding.`,
    choices: (s) => [
      {
        label: 'Match their prices',
        hint: 'Small-customer revenue -10% for 2 qtrs',
        apply: (s2) => {
          addMod(s2, 'discounting', 2);
          return 'You match prices. Margins thin, but deals keep closing.';
        },
      },
      {
        label: 'Compete on value',
        hint: publishedOffers(s) > 0 ? 'Your offers differentiate you' : 'Needs a published offer to work',
        apply: (s2) => {
          if (publishedOffers(s2) > 0) return '{g}Your repeatable offers speak for themselves.{/} No impact.';
          addMod(s2, 'pricewar', 2);
          return 'Without a packaged offer, it is hard to stand out. Conversion -10% for 2 quarters.';
        },
      },
      {
        label: 'Ignore it',
        apply: (s2) => {
          addMod(s2, 'pricewar', 2);
          return 'Conversion -10% for 2 quarters.';
        },
      },
    ],
  },
  {
    id: 'ransomware',
    kind: 'bad',
    icon: 'shield',
    title: 'CUSTOMER HIT BY RANSOMWARE',
    cooldown: 5,
    weight: (s) => (s.key.length === 0 ? 0 : 0.6),
    prepare: (s) => {
      const k = randomKey(s);
      return k ? { keyId: k.id, name: k.name } : null;
    },
    text: (_s, d) => `${d.name} has been hit by ransomware. Their CISO is asking if you can help - tonight.`,
    choices: (s, d) => [
      {
        label: 'Lead the incident response',
        hint: 'Needs 2+ Security certs. Big win',
        disabled: s.areas.security.inter >= 2 ? undefined : 'Needs 2+ Security certified staff',
        apply: (s2) => {
          const k = keyById(s2, d.keyId);
          if (k) k.sat = Math.min(100, k.sat + 20);
          adjRep(s2, 5);
          s2.areas.security.customers += 1;
          s2.areas.security.adds[3] += 1;
          s2.areas.security.usage[3] += 3;
          s2.areas.security.deploys[3] += 1;
          return '{g}Your team restores operations in 36 hours.{/} A new Security workload is born.';
        },
      },
      {
        label: 'Bring in Microsoft Incident Response',
        apply: (s2) => {
          adjRep(s2, 1);
          return 'You connect them with Microsoft IR. Sensible, if not heroic.';
        },
      },
      {
        label: "It's not our area",
        apply: (s2) => {
          const k = keyById(s2, d.keyId);
          if (k) k.sat = Math.max(0, k.sat - 10);
          return 'The customer remembers who was there for them. It was not you.';
        },
      },
    ],
  },
  {
    id: 'verification',
    kind: 'bad',
    icon: 'mail',
    title: 'PARTNER CENTER VERIFICATION',
    cooldown: 6,
    weight: () => 0.5,
    text: () =>
      'Microsoft needs you to re-verify your legal business details and primary contact in Partner Center within 30 days.',
    choices: () => [
      {
        label: 'Complete it now',
        hint: '$2K of admin time',
        apply: (s2) => {
          spend(s2, 2);
          adjCompliance(s2, 4);
          return 'Done in an afternoon. Your account stays in good standing.';
        },
      },
      {
        label: "Ignore it - we're busy",
        hint: 'Risky',
        apply: (s2) => {
          adjCompliance(s2, -10);
          schedule(s2, 1, 'verification_final');
          return 'The email slides down the inbox...';
        },
      },
    ],
  },

  // ------------------------------------------------------------------ GOOD
  {
    id: 'referral_windfall',
    kind: 'good',
    icon: 'handshake',
    title: 'MICROSOFT BRINGS YOU A DEAL',
    cooldown: 2,
    weight: (s) => (s.designations.length === 0 && s.reputation < 55 ? 0.15 : 0.4 + s.designations.length * 0.35 + s.programmes.cosell * 0.25),
    prepare: (s) => ({ area: businessArea(s), rev: randInt(s, 70, 120) }),
    text: (s, d) =>
      `Your Microsoft account team needs a partner for a ${A(d.area).label} project at a big customer - fast. Worth about {y}${money(d.rev as number)}/qtr{/}.${s.lastReport && s.lastReport.utilisation > 1.05 ? ' {o}Your team is already stretched.{/}' : ''}`,
    choices: () => [
      {
        label: 'Take it!',
        apply: (s2, d) => {
          const k = gainKeyAccount(s2, d.area as AreaId, d.rev as number);
          adjRep(s2, 2);
          return `{g}${k.name} is now a key account!{/} Counts as a net customer add in ${AREA[k.area].label}.`;
        },
      },
      {
        label: "Pass - we're at capacity",
        apply: (s2) => {
          adjRep(s2, -1);
          return 'The account team finds another partner. They will remember next time... maybe.';
        },
      },
    ],
  },
  {
    id: 'talent',
    kind: 'good',
    icon: 'hire',
    title: 'STAR ARCHITECT AVAILABLE',
    cooldown: 3,
    weight: () => 0.6,
    prepare: (s) => ({ area: rand(s) < 0.6 ? s.focus.primary : pick(s, AREAS) }),
    text: (_s, d) => `A Microsoft MVP and ${A(d.area).label} architect is looking for a new home - and likes your style.`,
    choices: () => [
      {
        label: 'Hire them',
        hint: '$30K sign-on. +1 advanced cert',
        apply: (s2, d) => {
          spend(s2, 30);
          s2.tech += 1;
          addCerts(s2, d.area as AreaId, 0, 1);
          adjRep(s2, 2);
          return `{g}Welcome aboard!{/} +1 engineer with an advanced ${AREA[d.area as AreaId].label} cert.`;
        },
      },
      { label: 'Not right now', apply: () => 'They join a competitor instead.' },
    ],
  },
  {
    id: 'case_study',
    kind: 'good',
    icon: 'star',
    title: 'CASE STUDY GOES VIRAL',
    cooldown: 4,
    weight: (s) => (sum(AREAS.map((a) => s.areas[a].deploys[2])) >= 2 ? 0.5 : 0),
    text: () => 'Microsoft features your customer story on its blog and socials. Your phone starts ringing.',
    choices: () => [
      {
        label: 'Brilliant!',
        apply: (s2) => {
          adjRep(s2, 6);
          const a = s2.focus.primary;
          s2.q.leads[a] = (s2.q.leads[a] ?? 0) + 3;
          return '+6 reputation and extra leads this quarter.';
        },
      },
    ],
  },
  {
    id: 'expansion',
    kind: 'good',
    icon: 'coin',
    title: 'CUSTOMER EXPANSION',
    cooldown: 2,
    weight: (s) => s.key.filter((k) => k.sat >= 70).length * 0.4,
    prepare: (s) => {
      const happy = s.key.filter((k) => k.sat >= 70);
      if (happy.length === 0) return null;
      const k = pick(s, happy);
      return { keyId: k.id, name: k.name, area: k.area };
    },
    text: (_s, d) => `${d.name} loves your work and wants to expand the ${A(d.area).label} programme by 30%.`,
    choices: () => [
      {
        label: 'Staff it up (hire 2)',
        hint: '$16K recruiting',
        apply: (s2, d) => {
          const k = keyById(s2, d.keyId);
          if (!k) return 'The opportunity has passed.';
          spend(s2, 16);
          s2.tech += 2;
          k.revenue = Math.round(k.revenue * 1.3);
          s2.areas[k.area].usage[3] += 3;
          return `{g}${k.name} now pays ${money(k.revenue)}/qtr.{/} Usage growth up.`;
        },
      },
      {
        label: 'Stretch the current team',
        apply: (s2, d) => {
          const k = keyById(s2, d.keyId);
          if (!k) return 'The opportunity has passed.';
          k.revenue = Math.round(k.revenue * 1.3);
          s2.areas[k.area].usage[3] += 3;
          adjMorale(s2, -3);
          return `${k.name} now pays ${money(k.revenue)}/qtr. The team is busier than ever.`;
        },
      },
    ],
  },
  {
    id: 'ma_opportunity',
    kind: 'good',
    icon: 'briefcase',
    title: 'ACQUISITION OPPORTUNITY',
    minTurn: 1,
    cooldown: 3,
    weight: (s) => (s.targets.length > 0 ? 0 : 0.55),
    prepare: (s) => {
      const used = new Set(s.targets.map((t) => t.name));
      const name = pick(s, RIVAL_NAMES.filter((n) => !used.has(n)));
      const t = makeTarget(s, name);
      s.targets.push(t);
      return { name: t.name, price: t.price, area: t.area, tech: t.tech, customers: t.customers };
    },
    text: (_s, d) =>
      `${d.name}, a ${A(d.area).label} partner with ${d.tech} engineers and ${d.customers} customers, is quietly up for sale at around {y}${money(d.price as number)}{/}. The offer stands for two quarters.`,
    choices: () => [{ label: 'Noted', hint: 'See ACTIONS > Acquire a Competitor', apply: () => 'Your corporate development folder gets a little thicker.' }],
  },
  {
    id: 'new_program',
    kind: 'good',
    icon: 'coin',
    title: 'NEW INCENTIVE PROGRAMME',
    cooldown: 4,
    weight: () => 0.45,
    text: () => 'Microsoft launches a new partner incentive. For the next two quarters, incentive claims pay 50% more.',
    choices: () => [
      {
        label: 'Excellent',
        apply: (s2) => {
          addMod(s2, 'incentiveBoost', 2);
          return 'Incentive payouts boosted for 2 quarters.';
        },
      },
    ],
  },
  {
    id: 'mvp',
    kind: 'good',
    icon: 'trophy',
    title: 'ENGINEER AWARDED MVP',
    once: true,
    weight: (s) => (sum(AREAS.map((a) => s.areas[a].adv)) >= 4 ? 0.5 : 0),
    text: () => 'One of your engineers has been named a Microsoft Most Valuable Professional for their community work!',
    choices: () => [
      {
        label: 'Celebrate!',
        apply: (s2) => {
          adjRep(s2, 5);
          adjMorale(s2, 5);
          return '+5 reputation, +5 morale. Cake is served.';
        },
      },
    ],
  },

  // ------------------------------------------------------------------ DILEMMAS
  {
    id: 'pal_shortcut',
    kind: 'dilemma',
    icon: 'bulb',
    title: 'THE PAL SHORTCUT',
    once: true,
    minTurn: 1,
    weight: () => 1,
    text: () =>
      "A customer's IT manager offers to link your Partner ID (Partner Admin Link) to their whole Azure estate - even workloads you never touched. Your numbers would jump overnight.",
    choices: () => [
      {
        label: 'Link everything',
        hint: 'Big PCS boost... compliance risk',
        apply: (s2) => {
          const a = AREAS.find((x) => AREA[x].azure && s2.areas[x].customers > 0) ?? 'infra';
          s2.areas[a].adds[3] += 2;
          s2.areas[a].usage[3] += 6;
          adjCompliance(s2, -25);
          s2.flags.palAbuse = 1;
          if (rand(s2) < 0.55) schedule(s2, 2 + Math.floor(rand(s2) * 3), 'pal_audit');
          return `${AREA[a].label} PCS jumps. {o}Somewhere, a compliance analyst raises an eyebrow.{/}`;
        },
      },
      {
        label: 'Only link what we deliver',
        hint: 'The right thing',
        apply: (s2) => {
          adjCompliance(s2, 5);
          adjRep(s2, 1);
          return `Integrity intact. ${byAdvisor(s2, { pdm: `${currentPdm(s2).name}, your PDM, quietly approves.`, distributor: `${DISTRIBUTOR.am} at your distributor would approve.`, program: 'Exactly what the programme guidelines ask for.' })}`;
        },
      },
    ],
  },
  {
    id: 'exam_dumps',
    kind: 'dilemma',
    icon: 'bulb',
    title: 'CHEAP EXAM "PRACTICE TESTS"',
    once: true,
    weight: () => 1,
    text: () =>
      "A website promises guaranteed passes with 'real exam questions'. Your team could knock out a pile of certifications this month.",
    choices: (s) => [
      {
        label: 'Use them',
        hint: '+certs now. Cheating risks revocation',
        apply: (s2) => {
          const a = s2.focus.primary;
          const got = addCerts(s2, a, 3, 1);
          adjCompliance(s2, -30);
          s2.flags.dumps = 1;
          if (rand(s2) < 0.65) schedule(s2, 1 + Math.floor(rand(s2) * 3), 'cert_revoked', { area: a, n: got.inter + 1 });
          return `+${got.inter} certs in ${AREA[a].label}. {o}Exam security teams are not known for their sense of humour.{/}`;
        },
      },
      {
        label: 'Do it properly',
        hint: 'Bonus skilling momentum',
        apply: (s2) => {
          s2.q.skillPts += 2;
          adjCompliance(s2, 3);
          void s;
          return 'The team commits to Microsoft Learn paths. Extra skilling progress this quarter.';
        },
      },
    ],
  },
  {
    id: 'raise',
    kind: 'dilemma',
    icon: 'coin',
    title: 'PAY RISE REQUEST',
    cooldown: 6,
    weight: (s) => (s.tech >= 8 ? 1 : 0),
    prepare: (s) => ({ area: [...AREAS].sort((a, b) => s.areas[b].adv - s.areas[a].adv)[0] }),
    text: (_s, d) => `Your lead ${A(d.area).label} architect asks for a 20% raise, citing offers from competitors.`,
    choices: () => [
      {
        label: 'Approve it',
        hint: '$20K retention package',
        apply: (s2) => {
          spend(s2, 20);
          adjMorale(s2, 4);
          return 'Happy architect, happy team.';
        },
      },
      {
        label: 'Offer equity instead',
        hint: 'Free. 70% they accept',
        apply: (s2, d) => {
          if (rand(s2) < 0.7) {
            adjMorale(s2, 2);
            return 'They like the idea of owning a piece of the company.';
          }
          const lost = removeTech(s2, 1, areaOf(s2, d.area));
          return `{r}They decline and resign.{/} Lost ${lost.adv} advanced cert${lost.adv === 1 ? '' : 's'}.`;
        },
      },
      {
        label: 'Decline',
        apply: (s2, d) => {
          adjMorale(s2, -3);
          if (rand(s2) < 0.5) schedule(s2, 1, 'raise_quit', { area: d.area });
          return 'They nod politely and update their LinkedIn profile.';
        },
      },
    ],
  },
  {
    id: 'fixed_price',
    kind: 'dilemma',
    icon: 'bulb',
    title: 'FIXED-PRICE AI PILOT',
    cooldown: 4,
    weight: () => 1,
    prepare: (s) => ({ area: rand(s) < 0.5 ? 'dataai' : 'modern', name: pick(s, ['Relecloud', 'VanArsdel', 'Lamna Healthcare', 'Wide World Importers', 'Trey Research']) }),
    text: (_s, d) => `${d.name} wants a fixed-price agentic AI pilot (${A(d.area).label}) in 8 weeks. Big logo, tiny margin, zero slack.`,
    choices: (s, d) => {
      const p = 0.35 + skillRatio(s, d.area as AreaId) * 0.55;
      return [
        {
          label: 'Accept the challenge',
          hint: `~${pctTxt(p)} success: key account or write-off`,
          apply: (s2) => {
            schedule(s2, 1, 'fixed_price_result', { area: d.area, name: d.name, p });
            s2.q.capacityLoss += 0.03;
            return 'The war room is booked. Results next quarter.';
          },
        },
        {
          label: 'Counter with time & materials',
          hint: '50% they agree',
          apply: (s2) => {
            if (rand(s2) < 0.5) {
              const k = gainKeyAccount(s2, d.area as AreaId, 70, d.name as string);
              return `{g}They agree!{/} ${k.name} becomes a key account.`;
            }
            return 'They go with a cheaper rival.';
          },
        },
        { label: 'Decline politely', apply: () => 'You live to fight another day.' },
      ];
    },
  },
  {
    id: 'discount_logo',
    kind: 'dilemma',
    icon: 'star',
    title: 'FAMOUS LOGO, THIN MARGINS',
    cooldown: 5,
    weight: () => 0.8,
    prepare: (s) => ({ area: businessArea(s), name: pick(s, ['Blue Yonder Airlines', 'Fourth Coffee', 'Alpine Ski House', 'Adventure Works', 'Tailwind Traders']) }),
    text: (_s, d) => `${d.name}, a household name, will sign a ${A(d.area).label} deal if you cut your rates by 35%.`,
    choices: () => [
      {
        label: 'Sign them',
        hint: 'Prestige, low margin',
        apply: (s2, d) => {
          const k = gainKeyAccount(s2, d.area as AreaId, 55, d.name as string);
          adjRep(s2, 6);
          return `${k.name} signs! +6 reputation. Margins? Let's not talk about margins.`;
        },
      },
      { label: 'Hold your price', apply: () => 'They walk. Your finance director breathes again.' },
    ],
  },
  {
    id: 'office',
    kind: 'dilemma',
    icon: 'bank',
    title: 'OFFICE LEASE RENEWAL',
    once: true,
    minTurn: 2,
    weight: () => 0.8,
    text: () => 'Your office lease is up. The landlord wants an answer by Friday.',
    choices: () => [
      {
        label: 'Move to a flashy HQ',
        hint: '+$10K/qtr overhead, morale & rep up',
        apply: (s2) => {
          s2.flags.officeDelta = 10;
          adjMorale(s2, 6);
          adjRep(s2, 3);
          return 'Bean bags, a barista and a view. Customers are impressed.';
        },
      },
      {
        label: 'Go hybrid, smaller office',
        hint: '-$8K/qtr overhead',
        apply: (s2) => {
          s2.flags.officeDelta = -8;
          adjMorale(s2, -2);
          return 'Hot desks and Teams Rooms. The finance team is delighted.';
        },
      },
      { label: 'Renew as-is', apply: () => 'Same carpet, same coffee machine.' },
    ],
  },
  {
    id: 'burnout',
    kind: 'dilemma',
    icon: 'warning',
    title: 'BURNOUT WARNING',
    cooldown: 3,
    weight: (s) => (s.morale < 50 || (s.lastReport?.utilisation ?? 0) > 1 ? 1.5 : 0),
    text: () => 'Your delivery leads warn the team is exhausted. Sick days are rising.',
    choices: () => [
      {
        label: 'Mandatory recharge week',
        hint: '-8% capacity, +10 morale',
        apply: (s2) => {
          s2.q.capacityLoss += 0.08;
          adjMorale(s2, 10);
          return 'Laptops closed. Everyone comes back refreshed.';
        },
      },
      {
        label: 'Hire contractors',
        hint: '$30K, +10% capacity this quarter',
        apply: (s2) => {
          spend(s2, 30);
          s2.q.capacityGain += 0.1;
          adjMorale(s2, 3);
          return 'Contractors take the pressure off.';
        },
      },
      {
        label: 'Push through',
        hint: 'Morale -8, project success down',
        apply: (s2) => {
          adjMorale(s2, -8);
          s2.q.successPenalty += 0.05;
          return 'Heads down. Something will give eventually.';
        },
      },
    ],
  },
  {
    id: 'pdm_pilot',
    kind: 'dilemma',
    icon: 'mail',
    title: 'YOUR PDM ASKS A FAVOUR',
    cooldown: 5,
    // Only managed partners (on the MPL) have a Partner Development Manager.
    weight: (s) => (s.mpl ? 0.9 : 0),
    text: (s) =>
      `${currentPdm(s).name}, your Partner Development Manager, wants you to pilot a new Microsoft partner programme. It will eat time, but could pay off.`,
    choices: () => [
      {
        label: 'Sign us up',
        hint: '-5% capacity. Rep, co-op & incentives',
        apply: (s2) => {
          s2.q.capacityLoss += 0.05;
          adjRep(s2, 5);
          s2.coop += 10;
          addMod(s2, 'incentiveBoost', 2);
          return '+5 reputation, +$10K co-op funds and boosted incentives for 2 quarters.';
        },
      },
      {
        label: 'Not this time',
        apply: (s2) => {
          adjRep(s2, -1);
          return `${currentPdm(s2).name} understands. Mostly.`;
        },
      },
    ],
  },
  {
    id: 'disti_offer',
    kind: 'dilemma',
    icon: 'handshake',
    title: 'RESELLER ACCELERATOR',
    cooldown: 5,
    weight: (s) => (advisorKind(s) === 'distributor' ? 0.9 : 0),
    text: () =>
      `${DISTRIBUTOR.am}, your account manager at ${DISTRIBUTOR.company}, offers you a place on their Reseller Accelerator: subsidised exam vouchers and a joint campaign to your CSP customers.`,
    choices: () => [
      {
        label: 'Join the accelerator',
        hint: '$10K. Certifications and leads this quarter',
        apply: (s2) => {
          spend(s2, 10);
          s2.q.skillPts += 2;
          const a = s2.focus.primary;
          s2.q.leads[a] = (s2.q.leads[a] ?? 0) + 3;
          adjRep(s2, 1);
          return `Vouchers issued and the campaign is live: extra certification progress and +3 ${AREA[a].label} leads.`;
        },
      },
      { label: 'Not this time', apply: () => `${DISTRIBUTOR.am} promises to ask again next quarter.` },
    ],
  },
  {
    id: 'maicpp_email',
    kind: 'dilemma',
    icon: 'mail',
    title: 'EMAIL: PARTNER SKILLING SPRINT',
    cooldown: 5,
    weight: (s) => (advisorKind(s) === 'program' ? 0.9 : 0),
    text: () =>
      'An automated MAICPP email arrives: free, self-paced partner skilling sprints, with exam vouchers for the first teams to finish. It comes from a no-reply address, so the decision is yours.',
    choices: () => [
      {
        label: 'Enrol the team',
        hint: 'Free. -4% capacity, certification progress',
        apply: (s2) => {
          s2.q.capacityLoss += 0.04;
          s2.q.skillPts += 2;
          return 'The team works through the sprint between projects: extra certification progress this quarter.';
        },
      },
      { label: 'Archive the email', apply: () => 'Archived, along with 37 other unread programme emails.' },
    ],
  },
  {
    id: 'licence_bend',
    kind: 'dilemma',
    icon: 'shield',
    title: 'LICENSING GREY AREA',
    cooldown: 8,
    weight: () => 0.8,
    text: () =>
      "A customer wants you to 'recycle' licences across their subsidiaries' tenants. It breaks the product terms, but they'd sign a big renewal.",
    choices: (s) => [
      {
        label: 'Do it',
        hint: '+$40K now. Compliance risk',
        apply: (s2) => {
          s2.cash += 40;
          adjCompliance(s2, -20);
          if (rand(s2) < 0.4) schedule(s2, 2, 'pal_audit');
          return '{o}The renewal is signed. The paperwork is... creative.{/}';
        },
      },
      {
        label: 'Propose a proper CSP deal',
        hint: s.csp !== 'none' ? 'You can transact via CSP' : 'Better with CSP enrolment',
        apply: (s2) => {
          adjCompliance(s2, 3);
          adjRep(s2, 2);
          if (s2.csp !== 'none') {
            s2.areas.modern.customers += 1;
            s2.areas.modern.adds[3] += 1;
            return '{g}They buy properly through your CSP storefront.{/} +1 customer.';
          }
          return 'They appreciate the honesty and promise to think about it.';
        },
      },
    ],
  },
  {
    id: 'poach',
    kind: 'dilemma',
    icon: 'hire',
    title: "POACH A RIVAL'S TEAM",
    cooldown: 6,
    minTurn: 2,
    weight: () => 0.8,
    prepare: (s) => ({ area: rand(s) < 0.5 ? s.focus.primary : pick(s, AREAS), rival: pick(s, RIVAL_NAMES) }),
    text: (_s, d) => `${d.rival}'s ${A(d.area).label} team of three would jump ship - if the money is right.`,
    choices: () => [
      {
        label: 'Hire them',
        hint: '$45K sign-on. +3 certified engineers',
        apply: (s2, d) => {
          spend(s2, 45);
          s2.tech += 3;
          addCerts(s2, d.area as AreaId, 2, 1);
          adjRep(s2, -2);
          adjMorale(s2, -2);
          return `+3 engineers with ${AREA[d.area as AreaId].label} certs. The industry gossips.`;
        },
      },
      { label: 'Pass', apply: () => 'You keep the moral high ground.' },
    ],
  },
  {
    id: 'investor',
    kind: 'dilemma',
    icon: 'briefcase',
    title: 'VENTURE CAPITAL OFFER',
    once: true,
    minTurn: 2,
    weight: (s) => (s.cash < 400 ? 1.6 : 0.6),
    text: () => 'A VC fund offers {y}$800K{/} for a minority stake. They will expect {o}$30K/qtr{/} in dividends from then on.',
    choices: () => [
      {
        label: 'Take the money',
        hint: '+$800K now, -$30K every quarter',
        apply: (s2) => {
          s2.cash += 800;
          s2.flags.dividends = 30;
          return 'Champagne! And a new board member who loves spreadsheets.';
        },
      },
      { label: 'Stay independent', apply: () => 'You keep full control.' },
    ],
  },
  {
    id: 'community',
    kind: 'dilemma',
    icon: 'calendar',
    title: 'COMMUNITY SPOTLIGHT',
    cooldown: 4,
    weight: () => 0.8,
    text: () => 'Your engineers want to host a free Microsoft community user group and hackathon.',
    choices: () => [
      {
        label: 'Sponsor it',
        hint: '$10K. Rep, morale, leads',
        apply: (s2) => {
          spend(s2, 10);
          adjRep(s2, 4);
          adjMorale(s2, 4);
          const a = s2.focus.primary;
          s2.q.leads[a] = (s2.q.leads[a] ?? 0) + 2;
          return 'Pizza, demos and new friends. +4 rep, +4 morale.';
        },
      },
      { label: 'Not now', apply: () => 'Maybe next year.' },
    ],
  },
  {
    id: 'customer_zero',
    kind: 'dilemma',
    icon: 'rocket',
    title: 'CUSTOMER ZERO FOR COPILOT?',
    once: true,
    weight: (s) => (s.flags.customerZero ? 0 : 1),
    text: () => "Your team wants to roll out Copilot and agents internally first, to become 'customer zero' for the Frontier journey.",
    choices: () => [
      {
        label: 'Do it',
        hint: '$25K. +5% productivity forever, +1 FTE badge',
        apply: (s2) => {
          spend(s2, 25);
          s2.flags.customerZero = 1;
          s2.productivity += 0.05;
          s2.fte = Math.min(s2.tech, s2.fte + 1);
          adjMorale(s2, 3);
          return '{g}Agents now draft your proposals and status reports.{/} Productivity +5%.';
        },
      },
      { label: 'Later', apply: () => 'The idea goes on the backlog.' },
    ],
  },
  {
    id: 'azure_zero_pitch',
    kind: 'dilemma',
    icon: 'cloud',
    title: 'CUSTOMER ZERO FOR AZURE?',
    once: true,
    minTurn: 1,
    weight: (s) => (s.flags.azureZero ? 0 : s.azureCredits > 0 ? 1.2 : 0.6),
    text: (s) =>
      `Your architects want to run ${s.company} itself on Azure: internal agents on Azure AI Foundry and a Fabric data estate. ` +
      (s.azureCredits > 0
        ? `Your benefits include {c}${credits(s.azureCredits)}{/} of Azure credits this year.`
        : 'You have no Azure credits: Partner Success, designations and specializations all include them.'),
    choices: (s) => {
      const split = azureZeroSplit(s, true);
      return [
        {
          label: 'Fund it with Azure credits',
          hint: `${credits(split.credits)} credits${split.cash > 0 ? ` + ${credits(split.cash)} cash` : ''}. +${pctTxt(AZURE_ZERO.productivity)} productivity`,
          disabled: s.azureCredits > 0 ? undefined : 'No Azure credits from benefits',
          apply: (s2) => becomeAzureZero(s2, true),
        },
        { label: 'Pay in cash', hint: `${money(AZURE_ZERO.cost)}. +${pctTxt(AZURE_ZERO.productivity)} productivity, +1 DP-600`, apply: (s2) => becomeAzureZero(s2, false) },
        { label: 'Later', apply: () => 'The migration plan goes back in the drawer (see ACTIONS).' },
      ];
    },
  },
  {
    id: 'bcdr',
    kind: 'dilemma',
    icon: 'server',
    title: 'RESILIENCE REVIEW',
    once: true,
    minTurn: 1,
    weight: (s) => (s.key.length > 0 ? 0.8 : 0),
    text: () => "Your ops lead proposes multi-region failover designs for your key accounts' workloads.",
    choices: () => [
      {
        label: 'Fund it',
        hint: '$25K. Outages hurt far less',
        apply: (s2) => {
          spend(s2, 25);
          s2.flags.resilient = 1;
          for (const k of s2.key) k.sat = Math.min(100, k.sat + 5);
          return 'Resilience by design. Key accounts sleep better.';
        },
      },
      { label: 'Too expensive', apply: () => 'Fingers crossed, then.' },
    ],
  },
  {
    id: 'late_payer',
    kind: 'dilemma',
    icon: 'coin',
    title: 'LATE-PAYING CUSTOMER',
    cooldown: 6,
    weight: (s) => (s.key.length > 0 ? 0.7 : 0),
    prepare: (s) => {
      const k = randomKey(s);
      return k ? { keyId: k.id, name: k.name } : null;
    },
    text: (_s, d) => `${d.name} is 120 days late paying a {y}$50K{/} invoice. Cash is cash.`,
    choices: () => [
      {
        label: 'Chase hard',
        hint: 'Likely paid, unhappy customer',
        apply: (s2, d) => {
          const k = keyById(s2, d.keyId);
          if (k) k.sat = Math.max(0, k.sat - 12);
          if (rand(s2) < 0.85) {
            s2.cash += 50;
            return 'Paid in full. Relations are frosty.';
          }
          return 'Still waiting. And now they are annoyed too.';
        },
      },
      {
        label: 'Be patient',
        hint: 'Happier customer, maybe paid',
        apply: (s2, d) => {
          const k = keyById(s2, d.keyId);
          if (k) k.sat = Math.min(100, k.sat + 5);
          if (rand(s2) < 0.55) {
            s2.cash += 50;
            return 'They pay up with an apology and a box of biscuits.';
          }
          s2.cash += 20;
          return 'They pay $20K now and promise the rest. (They will not.)';
        },
      },
    ],
  },
  {
    id: 'marketplace',
    kind: 'dilemma',
    icon: 'cart',
    title: 'MARKETPLACE PRIVATE OFFER',
    cooldown: 4,
    weight: (s) => (publishedOffers(s) > 0 ? 1.1 : 0),
    text: () => 'A customer wants to buy your packaged offer through Microsoft Marketplace so it counts toward their Azure commitment.',
    choices: () => [
      {
        label: 'Set up a private offer',
        hint: '$5K. Likely a new key account',
        apply: (s2) => {
          spend(s2, 5);
          const pub = s2.offers.filter((o) => o.published);
          const area = pub.length ? (AREAS.find((a) => publishedOffers(s2, a) > 0) ?? s2.focus.primary) : s2.focus.primary;
          if (rand(s2) < 0.75) {
            const k = gainKeyAccount(s2, area, randInt(s2, 60, 95));
            adjRep(s2, 2);
            return `{g}${k.name} buys via Marketplace!{/} New key account.`;
          }
          s2.areas[area].customers += 2;
          s2.areas[area].adds[3] += 2;
          return 'Procurement shrinks the deal, but you land 2 new customers.';
        },
      },
      {
        label: 'Just invoice them',
        apply: (s2) => {
          const a = s2.focus.primary;
          s2.areas[a].customers += 1;
          s2.areas[a].adds[3] += 1;
          return '+1 customer.';
        },
      },
    ],
  },
  {
    id: 'phishing',
    kind: 'dilemma',
    icon: 'mail',
    title: 'PHISHING INCIDENT',
    once: true,
    minTurn: 2,
    weight: () => 0.8,
    text: () => 'An employee clicked a phishing link. Attackers accessed a mailbox containing customer data.',
    choices: (s) => {
      const secSkilled = s.areas.security.inter >= 2;
      return [
        {
          label: 'Disclose & remediate',
          hint: secSkilled ? '$8K (in-house security team)' : '$20K',
          apply: (s2) => {
            spend(s2, secSkilled ? 8 : 20);
            adjRep(s2, -2);
            adjCompliance(s2, 5);
            return 'Customers are informed, credentials rotated, MFA enforced everywhere. Painful but right.';
          },
        },
        {
          label: 'Quietly fix it',
          hint: 'Free... if nobody finds out',
          apply: (s2) => {
            adjCompliance(s2, -12);
            if (rand(s2) < 0.35) schedule(s2, 1 + Math.floor(rand(s2) * 2), 'phish_found');
            return 'Passwords are reset. Nobody needs to know. Probably.';
          },
        },
      ];
    },
  },

  // ------------------------------------------------------------------ FOLLOW-UPS (scheduled)
  {
    id: 'verification_final',
    kind: 'followup',
    icon: 'shield',
    title: 'FINAL NOTICE: ACCOUNT SUSPENSION',
    text: () => '{r}Microsoft has not received your verification.{/} Your Partner Center account will be suspended and your membership removed unless you act now.',
    choices: () => [
      {
        label: 'Complete it immediately',
        hint: '$5K rush job',
        apply: (s2) => {
          spend(s2, 5);
          adjCompliance(s2, 2);
          return 'Phew. Verification complete. Membership safe.';
        },
      },
      {
        label: 'Ignore it again',
        hint: 'GAME OVER',
        apply: (s2) => {
          lose(s2, 'removed', 'Your Partner Center account was suspended for failing verification, and your MAICPP membership was removed.');
          return '{r}Your membership has been removed.{/}';
        },
      },
    ],
  },
  {
    id: 'pal_audit',
    kind: 'followup',
    icon: 'clipboard',
    title: 'INCENTIVE & ASSOCIATION AUDIT',
    text: (s) =>
      `Microsoft's compliance team is auditing your partner associations and incentive claims. Current compliance score: {y}${s.compliance}{/}.`,
    choices: (s) => {
      const warn = s.compliance < 25 ? 'Compliance is critically low!' : undefined;
      const list: Choice[] = [
        { label: 'Cooperate fully', hint: warn, apply: (s2) => auditOutcome(s2, false) },
        {
          label: 'Hire specialist lawyers',
          hint: '$25K. Halves penalties',
          apply: (s2) => {
            spend(s2, 25);
            return auditOutcome(s2, true);
          },
        },
      ];
      return list;
    },
  },
  {
    id: 'cert_revoked',
    kind: 'followup',
    icon: 'warning',
    title: 'CERTIFICATIONS REVOKED',
    text: () => 'Microsoft exam security detected candidates using leaked exam content. The certifications are revoked and the candidates banned.',
    choices: () => [
      {
        label: 'Accept the consequences',
        apply: (s2, d) => {
          const a = areaOf(s2, d.area);
          const ar = s2.areas[a];
          const n = ((d.n as number) || 2) + 1;
          ar.inter = Math.max(0, ar.inter - n);
          ar.adv = Math.min(ar.adv, ar.inter);
          adjCompliance(s2, -10);
          adjRep(s2, -6);
          return `{r}${n} ${AREA[a].label} certifications revoked.{/} Reputation -6. Lesson learned.`;
        },
      },
    ],
  },
  {
    id: 'raise_quit',
    kind: 'followup',
    icon: 'door',
    title: 'ARCHITECT RESIGNS',
    text: (_s, d) => `Your lead ${A(d.area).label} architect has accepted a competitor's offer.`,
    choices: () => [
      {
        label: 'Ouch',
        apply: (s2, d) => {
          const lost = removeTech(s2, 1, areaOf(s2, d.area));
          adjMorale(s2, -3);
          return `Lost ${lost.inter} intermediate and ${lost.adv} advanced certs.`;
        },
      },
    ],
  },
  {
    id: 'fixed_price_result',
    kind: 'followup',
    icon: 'bulb',
    title: 'AI PILOT: THE VERDICT',
    text: (_s, d) => `The fixed-price agentic AI pilot for ${d.name} has reached its deadline...`,
    choices: () => [
      {
        label: 'Open the envelope',
        apply: (s2, d) => {
          if (rand(s2) < ((d.p as number) ?? 0.5)) {
            const k = gainKeyAccount(s2, areaOf(s2, d.area), 95, (d.name as string) || undefined);
            s2.areas[k.area].deploys[3] += 1;
            s2.areas[k.area].usage[3] += 3;
            adjRep(s2, 5);
            return `{g}A triumph!{/} ${k.name} becomes a key account. +5 reputation.`;
          }
          spend(s2, 40);
          adjRep(s2, -5);
          return '{r}It missed the mark.{/} $40K written off and -5 reputation.';
        },
      },
    ],
  },
  {
    id: 'phish_found',
    kind: 'followup',
    icon: 'shield',
    title: 'COVER-UP DISCOVERED',
    text: () => 'A journalist has learned about the phishing incident you quietly fixed. Customers are asking hard questions.',
    choices: () => [
      {
        label: 'Apologise publicly',
        apply: (s2) => {
          adjRep(s2, -10);
          adjCompliance(s2, -10);
          for (const k of s2.key) k.sat = Math.max(0, k.sat - 8);
          return '{r}Reputation -10, compliance -10, every key account less happy.{/}';
        },
      },
    ],
  },
  {
    id: 'culture_clash',
    kind: 'followup',
    icon: 'people',
    title: 'INTEGRATION CULTURE CLASH',
    text: (_s, d) => `Engineers from ${d.name} don't like your ways of working. Some are heading for the door.`,
    choices: () => [
      {
        label: 'Retention bonuses',
        hint: '$20K. Most stay',
        apply: (s2, d) => {
          spend(s2, 20);
          if (rand(s2) < 0.7) return 'Most of them stay. Integration back on track.';
          const lost = removeTech(s2, Math.ceil(((d.n as number) || 2) / 2), areaOf(s2, d.area));
          return `A few still leave (-${lost.inter} certs).`;
        },
      },
      {
        label: 'Let them go',
        apply: (s2, d) => {
          const lost = removeTech(s2, (d.n as number) || 2, areaOf(s2, d.area));
          return `${(d.n as number) || 2} engineers leave, taking ${lost.inter} certs with them.`;
        },
      },
    ],
  },
  {
    id: 'acq_skeleton',
    kind: 'followup',
    icon: 'clipboard',
    title: 'SKELETON IN THE CLOSET',
    text: (_s, d) => `It turns out ${d.name} had been over-claiming partner incentives for years. Microsoft wants the money back.`,
    choices: () => [
      {
        label: 'Repay and clean up',
        hint: '$60K',
        apply: (s2) => {
          spend(s2, 60);
          adjCompliance(s2, -5);
          return 'You repay $60K and tighten controls. Due diligence would have caught this.';
        },
      },
      {
        label: 'Dispute it',
        hint: 'Compliance -20',
        apply: (s2) => {
          adjCompliance(s2, -20);
          return '{o}Microsoft is unimpressed by your arguments.{/}';
        },
      },
    ],
  },
];

function auditOutcome(s: GameState, lawyers: boolean): string {
  if (s.compliance < 25) {
    lose(s, 'removed', 'A compliance audit found systemic misuse of partner associations and incentives. Your MAICPP membership was removed.');
    return '{r}Membership removed for serious compliance breaches.{/}';
  }
  if (s.compliance < 50) {
    const penalty = Math.round((lawyers ? 50 : 100) * (s.flags.palAbuse ? 1.5 : 1));
    spend(s, penalty);
    adjCompliance(s, 10);
    adjRep(s, -5);
    s.flags.palAbuse = 0;
    for (const a of AREAS) if (sum(s.areas[a].adds) > 0) s.areas[a].adds[3] -= 1;
    return `{o}Clawback: ${money(penalty)}.{/} Associations corrected, reputation -5. Final warning issued.`;
  }
  adjCompliance(s, 5);
  return '{g}Clean bill of health.{/} Your records are in order.';
}

export const EVENT: Record<string, EventDef> = Object.fromEntries(EVENTS.map((e) => [e.id, e]));

function eligible(s: GameState, e: EventDef): boolean {
  if (e.minTurn !== undefined && s.turn < e.minTurn) return false;
  const last = s.eventLog[e.id];
  if (last !== undefined) {
    if (e.once) return false;
    if (e.cooldown !== undefined && s.turn - last <= e.cooldown) return false;
  }
  return (e.weight?.(s) ?? 1) > 0;
}

function instantiate(s: GameState, e: EventDef): PendingEvent | null {
  const data = e.prepare ? e.prepare(s) : {};
  if (data === null) return null;
  s.eventLog[e.id] = s.turn;
  return { id: e.id, data };
}

/** Build this quarter's event queue: scheduled follow-ups, random incidents, one dilemma. */
export function rollEvents(s: GameState): PendingEvent[] {
  const out: PendingEvent[] = [];
  const due = s.scheduled.filter((x) => x.turn <= s.turn);
  s.scheduled = s.scheduled.filter((x) => x.turn > s.turn);
  for (const d of due) {
    const def = EVENT[d.id];
    if (!def) continue;
    let data = d.data;
    if (def.prepare && Object.keys(data).length === 0) {
      const p = def.prepare(s);
      if (p === null) continue;
      data = p;
    }
    out.push({ id: d.id, data });
  }

  const mult = DIFFICULTY[s.difficulty].events;
  let n = 0;
  if (s.turn > 0) {
    const r = rand(s);
    if (r < 0.14 * mult) n = 2;
    else if (r < 0.62 * mult) n = 1;
  }
  const used = new Set(out.map((o) => o.id));
  for (let i = 0; i < n; i++) {
    const pool = EVENTS.filter((e) => (e.kind === 'bad' || e.kind === 'good') && !used.has(e.id) && eligible(s, e));
    // Bad things get more likely on harder settings.
    const e = weightedPick(s, pool.map((x) => ({ item: x, weight: (x.weight?.(s) ?? 1) * (x.kind === 'bad' ? mult : 1) })));
    if (!e) break;
    const inst = instantiate(s, e);
    if (inst) {
      out.push(inst);
      used.add(e.id);
    }
  }
  const dpool = EVENTS.filter((e) => e.kind === 'dilemma' && eligible(s, e));
  const d = weightedPick(s, dpool.map((x) => ({ item: x, weight: x.weight?.(s) ?? 1 })));
  if (d) {
    const inst = instantiate(s, d);
    if (inst) out.push(inst);
  }
  return out;
}

/** Apply the chosen option of a pending event; returns outcome text. */
export function resolveEvent(s: GameState, pe: PendingEvent, choiceIndex: number): string {
  const def = EVENT[pe.id];
  if (!def) return '';
  const choices = def.choices(s, pe.data);
  const c = choices[Math.max(0, Math.min(choices.length - 1, choiceIndex))];
  if (c.disabled) return '';
  const out = c.apply(s, pe.data);
  s.pending = s.pending.filter((p) => p !== pe);
  news(s, `${def.title}: ${out.replace(/\{[a-zA-Z/]\}/g, '')}`);
  return out;
}
