import type { AreaId, BetId, Difficulty, ProgrammeId } from './data';

export interface AreaState {
  /** Non-key customers whose main workload is in this area. */
  customers: number;
  /** People holding an intermediate certification in this area. */
  inter: number;
  /** People holding an advanced certification in this area (subset of inter). */
  adv: number;
  /** Fractional certification progress (skilling points). */
  certProgress: number;
  /** Rolling 4-quarter windows, index 3 = current quarter. */
  adds: number[];
  deploys: number[];
  usage: number[];
  /** Qualified (PCS >= 70, all metrics > 0) at end of each of the last quarters. */
  qualHist: boolean[];
}

export interface KeyAccount {
  id: number;
  name: string;
  area: AreaId;
  revenue: number;
  sat: number;
  since: number;
}

export interface Designation {
  area: AreaId;
  since: number;
  renewAt: number;
}

export interface SpecHeld {
  id: string;
  since: number;
  renewAt: number;
  renewals: number;
}

export interface OfferState {
  id: string;
  progress: number;
  required: number;
  published: boolean;
  age: number;
}

export interface Target {
  id: number;
  name: string;
  area: AreaId;
  tech: number;
  sales: number;
  customers: number;
  inter: number;
  adv: number;
  keyRevenue: number;
  price: number;
  expires: number;
  /** Hidden traits revealed by due diligence. */
  skeleton: boolean;
  culture: boolean;
  diligence: boolean;
}

export interface PendingEvent {
  id: string;
  data: Record<string, unknown>;
}

export interface Scheduled {
  turn: number;
  id: string;
  data: Record<string, unknown>;
}

export interface Modifier {
  id: 'downturn' | 'capacity' | 'pricewar' | 'incentiveBoost' | 'discounting';
  until: number; // last turn (inclusive) it applies to
}

export interface AuditPending {
  kind: 'spec' | 'reference' | 'frontier';
  spec?: string;
  chance: number;
}

export interface Nomination {
  category: AreaId | 'frontier';
  premium: boolean;
  fy: number;
}

/** Per-quarter transient boosts set by actions/events, consumed at quarter end. */
export interface QuarterBoosts {
  leads: Partial<Record<AreaId, number>>;
  workshops: Partial<Record<AreaId, number>>;
  projectBoost: Partial<Record<AreaId, number>>;
  referralLeads: number;
  keyBonus: number;
  skillPts: number;
  capacityLoss: number;
  capacityGain: number;
  workshopRevenue: number;
  oneOffSpend: number;
  moraleDelta: number;
  successPenalty: number;
  extraChurn: number;
  ignite: boolean;
  build: boolean;
  actionsTaken: string[];
}

export interface QuarterReport {
  turn: number;
  revenue: { services: number; offers: number; csp: number; incentives: number; total: number };
  costs: { salaries: number; overhead: number; programmes: number; other: number; interest: number; total: number };
  oneOff: number;
  profit: number;
  cashEnd: number;
  coopUsed: number;
  /** Azure consumption paid from Azure credits this quarter. */
  azureUsed?: number;
  utilisation: number;
  wins: Partial<Record<AreaId, number>>;
  lost: number;
  newKey: string[];
  lostKey: string[];
  projects: number;
  successes: number;
  failures: number;
  certs: { inter: number; adv: number };
  leavers: number;
  pcs: Record<AreaId, number>;
  pcsPrev: Record<AreaId, number>;
  notices: string[];
}

export interface HistoryPoint {
  turn: number;
  cash: number;
  revenue: number;
  profit: number;
  customers: number;
  staff: number;
  pcs: Record<AreaId, number>;
}

export type Phase = 'plan' | 'events' | 'hub' | 'ended';

export interface GameState {
  v: number;
  seed: number;
  rng: number;
  company: string;
  heritage: string;
  difficulty: Difficulty;
  turn: number;
  phase: Phase;
  cash: number;
  debt: number;
  tech: number;
  sales: number;
  morale: number;
  reputation: number;
  compliance: number;
  productivity: number;
  areas: Record<AreaId, AreaState>;
  key: KeyAccount[];
  nextId: number;
  focus: { primary: AreaId; secondary: AreaId | null };
  programmes: Record<ProgrammeId, number>;
  bet: BetId;
  adjustments: number;
  ap: number;
  hiresThisQuarter: number;
  benefits: 'none' | 'core' | 'expanded';
  /** Partner Success renews at the start of each FY unless switched off (allowed once you hold a designation). */
  benefitsRenew: boolean;
  csp: 'none' | 'indirect' | 'direct';
  /** On Microsoft's Managed Partner List, with a Partner Development Manager. */
  mpl: boolean;
  /** Azure bulk credits ($K) from benefits; expire at the end of the FY. */
  azureCredits: number;
  unified: boolean;
  coop: number;
  designations: Designation[];
  specs: SpecHeld[];
  fte: number;
  dp600: number;
  frontier: boolean;
  offers: OfferState[];
  targets: Target[];
  pending: PendingEvent[];
  scheduled: Scheduled[];
  modifiers: Modifier[];
  audits: AuditPending[];
  nominations: Nomination[];
  q: QuarterBoosts;
  flags: Record<string, number>;
  eventLog: Record<string, number>;
  history: HistoryPoint[];
  lastReport: QuarterReport | null;
  yearEnd: YearEndReport | null;
  news: string[];
  negativeQuarters: number;
  status: 'playing' | 'won' | 'lost';
  endReason: string;
  endKind: '' | 'frontier' | 'poty' | 'bankrupt' | 'removed';
  stats: { peakRevenue: number; deploys: number; customersWon: number; audits: number; potyFinalist: number };
}

export interface YearEndReport {
  fy: number;
  revenue: number;
  profit: number;
  poty: { category: string; result: 'winner' | 'finalist' | 'none'; chance: number }[];
  coopExpired: number;
  azureExpired?: number;
  notices: string[];
}
