import { AREAS, AreaId, CUSTOMER_NAMES, DIFFICULTY, Difficulty, HERITAGES } from './data';
import { fyOf } from './format';
import { azureAllowance } from './rules';
import { pick, rand, randInt } from './rng';
import type { AreaState, GameState, QuarterBoosts } from './types';

export const SAVE_VERSION = 1;

export function emptyBoosts(): QuarterBoosts {
  return {
    leads: {},
    workshops: {},
    projectBoost: {},
    referralLeads: 0,
    keyBonus: 0,
    skillPts: 0,
    capacityLoss: 0,
    capacityGain: 0,
    workshopRevenue: 0,
    oneOffSpend: 0,
    moraleDelta: 0,
    successPenalty: 0,
    extraChurn: 0,
    ignite: false,
    build: false,
    actionsTaken: [],
  };
}

function emptyArea(): AreaState {
  return { customers: 0, inter: 0, adv: 0, certProgress: 0, adds: [0, 0, 0, 0], deploys: [0, 0, 0, 0], usage: [0, 0, 0, 0], qualHist: [false, false, false, false] };
}

export interface NewGameOpts {
  company: string;
  heritage: string;
  difficulty: Difficulty;
  seed?: number;
}

export function newGame(opts: NewGameOpts): GameState {
  const seed = opts.seed ?? Math.floor(Math.random() * 2 ** 31);
  const her = HERITAGES.find((h) => h.id === opts.heritage) ?? HERITAGES[0];
  const areas = {} as Record<AreaId, AreaState>;
  for (const a of AREAS) areas[a] = emptyArea();

  const s: GameState = {
    v: SAVE_VERSION,
    seed,
    rng: seed,
    company: opts.company.trim() || 'Pixel Partners',
    heritage: her.id,
    difficulty: opts.difficulty,
    turn: 0,
    phase: 'plan',
    cash: DIFFICULTY[opts.difficulty].cash,
    debt: 0,
    tech: 14,
    sales: 3,
    morale: 65,
    reputation: 40,
    compliance: 80,
    productivity: 1,
    areas,
    key: [],
    nextId: 1,
    focus: { primary: her.area, secondary: null },
    programmes: { skilling: 1, marketing: 1, cosell: 1, people: 1 },
    bet: 'growth',
    adjustments: 2,
    ap: 2,
    hiresThisQuarter: 0,
    benefits: 'none',
    benefitsRenew: true,
    csp: 'none',
    mpl: false,
    azureCredits: 0,
    unified: false,
    coop: 0,
    designations: [],
    specs: [],
    fte: 0,
    dp600: 0,
    frontier: false,
    offers: [],
    targets: [],
    pending: [],
    scheduled: [],
    modifiers: [],
    audits: [],
    nominations: [],
    q: emptyBoosts(),
    flags: {},
    eventLog: {},
    history: [],
    lastReport: null,
    yearEnd: null,
    news: [],
    negativeQuarters: 0,
    status: 'playing',
    endReason: '',
    endKind: '',
    stats: { peakRevenue: 0, deploys: 0, customersWon: 0, audits: 0, potyFinalist: 0 },
  };

  // Heritage practice: an established but not yet qualified Solutions Partner area.
  const h = areas[her.area];
  h.customers = 22;
  h.inter = 3;
  h.adv = 1;
  h.adds = [1, 1, 1, 1];
  h.deploys = [1, 1, 1, 0];
  h.usage = [2, 2, 3, 2];

  // A couple of side practices with a few customers.
  const others = AREAS.filter((a) => a !== her.area);
  const side1 = pick(s, others);
  const side2 = pick(s, others.filter((a) => a !== side1));
  areas[side1].customers = 5;
  areas[side1].inter = 1;
  areas[side1].usage = [0, 1, 0, 1];
  areas[side2].customers = 3;

  // Key accounts
  const names = [...CUSTOMER_NAMES];
  const takeName = () => {
    const i = Math.floor(rand(s) * names.length);
    return names.splice(i, 1)[0];
  };
  const addKey = (area: AreaId, revenue: number, sat: number) => {
    s.key.push({ id: s.nextId++, name: takeName(), area, revenue, sat, since: -4 });
  };
  addKey(her.area, randInt(s, 70, 90), 70);
  addKey(her.area, randInt(s, 55, 70), 60);
  addKey(side1, randInt(s, 45, 60), 55);

  s.news.push(`${s.company} joins the Microsoft AI Cloud Partner Program as a Network member.`);
  return s;
}

/** Name for a new key account not already used in this game. */
export function freshCustomerName(s: GameState): string {
  const used = new Set(s.key.map((k) => k.name));
  const free = CUSTOMER_NAMES.filter((n) => !used.has(n));
  if (free.length === 0) return `${pick(s, CUSTOMER_NAMES)} ${randInt(s, 2, 9)}`;
  return pick(s, free);
}

/** Bring a save from an earlier build up to date (fields added since SAVE_VERSION 1 shipped). */
export function migrateState(s: GameState): GameState {
  const m = s as Partial<GameState> & GameState;
  if (typeof m.benefitsRenew !== 'boolean') m.benefitsRenew = true;
  if (typeof m.mpl !== 'boolean') m.mpl = false;
  if (!m.flags) m.flags = {};
  // Saves from before Azure credits existed get this membership year's allowance straight away.
  if (typeof m.azureCredits !== 'number') m.azureCredits = azureAllowance(m).total;
  // Older builds charged Partner Success at year end, so the current FY is already paid for.
  if (m.benefits !== 'none' && m.flags.psPaidFY === undefined) m.flags.psPaidFY = fyOf(m.turn);
  // Already holding two specializations: the Managed Partner List starts the FY after the second was earned.
  if (m.flags.secondSpec === undefined && m.specs.length >= 2) {
    const earned = m.specs.map((x) => x.since).sort((a, b) => a - b)[1];
    m.flags.secondSpec = earned;
    if (!m.mpl && fyOf(earned) < fyOf(m.turn)) {
      m.mpl = true;
      m.flags.mplSince = 4 * (Math.floor(earned / 4) + 1);
    }
  }
  return m;
}
