import { AREA, AREAS, AreaId, areaList, AZURE_CREDITS, CreditCategory, creditCategory, FRONTIER, OFFER, PCS_QUALIFY, PCS_WEIGHTS, SPEC, SpecDef } from './data';
import type { GameState } from './types';

export const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);

export interface PcsBreakdown {
  adds: number;
  inter: number;
  adv: number;
  usage: number;
  deploys: number;
  total: number;
  values: { adds: number; inter: number; adv: number; usage: number; deploys: number };
  qualified: boolean;
}

function pts(value: number, threshold: number, weight: number): number {
  if (value <= 0) return 0;
  return Math.max(1, Math.floor((Math.min(value, threshold) / threshold) * weight));
}

/** Partner Capability Score for a solution area (game-scaled thresholds). */
export function pcs(s: GameState, area: AreaId): PcsBreakdown {
  const a = s.areas[area];
  const th = AREA[area].th;
  const values = {
    adds: Math.max(0, Math.round(sum(a.adds))),
    inter: a.inter,
    adv: a.adv,
    usage: Math.max(0, Math.round(sum(a.usage))),
    deploys: Math.max(0, Math.round(sum(a.deploys))),
  };
  const b = {
    adds: pts(values.adds, th.adds, PCS_WEIGHTS.adds),
    inter: pts(values.inter, th.inter, PCS_WEIGHTS.inter),
    adv: pts(values.adv, th.adv, PCS_WEIGHTS.adv),
    usage: pts(values.usage, th.usage, PCS_WEIGHTS.usage),
    deploys: pts(values.deploys, th.deploys, PCS_WEIGHTS.deploys),
  };
  const total = b.adds + b.inter + b.adv + b.usage + b.deploys;
  const allPositive = b.adds > 0 && b.inter > 0 && b.adv > 0 && b.usage > 0 && b.deploys > 0;
  return { ...b, total, values, qualified: total >= PCS_QUALIFY && allPositive };
}

export function allPcs(s: GameState): Record<AreaId, number> {
  const out = {} as Record<AreaId, number>;
  for (const a of AREAS) out[a] = pcs(s, a).total;
  return out;
}

export function hasDesignation(s: GameState, area: AreaId): boolean {
  return s.designations.some((d) => d.area === area);
}

export function hasSpec(s: GameState, id: string): boolean {
  return s.specs.some((x) => x.id === id);
}

export function specsInArea(s: GameState, area: AreaId): number {
  return s.specs.filter((x) => SPEC[x.id]?.skill === area).length;
}

export function publishedOffers(s: GameState, area?: AreaId): number {
  return s.offers.filter((o) => o.published && (!area || OFFER[o.id].area === area)).length;
}

export function frontierOffers(s: GameState): number {
  return s.offers.filter((o) => o.published && OFFER[o.id].frontier).length;
}

/** Eligible to buy a Solutions Partner designation: qualified this or last quarter. */
export function canPurchaseDesignation(s: GameState, area: AreaId): boolean {
  if (hasDesignation(s, area)) return false;
  const h = s.areas[area].qualHist;
  return pcs(s, area).qualified || h.slice(-2).some(Boolean);
}

export interface Req {
  label: string;
  ok: boolean;
  detail?: string;
}

/**
 * Qualification requirements for a specialization (before audit / reference). The skill and
 * customer lines all refer to the specialization's skill area (AREA[spec.skill]).
 */
export function specRequirements(s: GameState, spec: SpecDef): Req[] {
  const a = s.areas[spec.skill];
  const deploys = Math.round(sum(a.deploys));
  const reqs: Req[] = [
    {
      label: `Solutions Partner: ${areaList(spec.aligned)}`,
      ok: spec.aligned.some((x) => hasDesignation(s, x)),
    },
    { label: `${spec.inter}+ intermediate certs`, ok: a.inter >= spec.inter, detail: `${a.inter}/${spec.inter}` },
    { label: `${spec.adv}+ advanced certs`, ok: a.adv >= spec.adv, detail: `${a.adv}/${spec.adv}` },
    { label: `${spec.deploys}+ deployments in 12 months`, ok: deploys >= spec.deploys, detail: `${deploys}/${spec.deploys}` },
  ];
  if (spec.customers) {
    const c = a.customers + s.key.filter((k) => k.area === spec.skill).length;
    reqs.push({ label: `${spec.customers}+ customers`, ok: c >= spec.customers, detail: `${c}/${spec.customers}` });
  }
  if (spec.offer) reqs.push({ label: 'Marketplace offer', ok: publishedOffers(s, spec.skill) > 0 });
  return reqs;
}

export function specQualified(s: GameState, spec: SpecDef): boolean {
  return specRequirements(s, spec).every((r) => r.ok);
}

export function specUnlocked(s: GameState, spec: SpecDef): boolean {
  return spec.aligned.some((x) => hasDesignation(s, x));
}

export function auditChance(s: GameState, spec: SpecDef, prep: boolean): number {
  const a = s.areas[spec.skill];
  let p = 0.5;
  p += 0.06 * Math.min(3, a.adv - spec.adv);
  p += 0.03 * Math.min(4, a.inter - spec.inter);
  p += Math.min(0.2, 0.1 * publishedOffers(s, spec.skill));
  p += (s.compliance - 60) / 400;
  if (s.unified) p += 0.03;
  if (prep) p += 0.2;
  return Math.max(0.1, Math.min(0.95, p));
}

export function referenceChance(s: GameState, spec: SpecDef): number {
  const happyKey = s.key.some((k) => k.area === spec.skill && k.sat >= 60);
  const deploys = sum(s.areas[spec.skill].deploys);
  let p = 0.45 + (happyKey ? 0.35 : 0) + Math.min(0.15, deploys * 0.02);
  p += (s.compliance - 60) / 500;
  return Math.max(0.1, Math.min(0.95, p));
}

export function frontierRequirements(s: GameState): Req[] {
  return [
    { label: 'Microsoft 365 Copilot specialization', ok: hasSpec(s, 'copilot') },
    { label: 'Data Security specialization', ok: hasSpec(s, 'datasec') },
    { label: 'Identity and Access Management spec.', ok: hasSpec(s, 'iam') },
    { label: 'AI Apps OR AI Platform on Azure spec.', ok: FRONTIER.anyOf.some((id) => hasSpec(s, id)) },
    { label: `${FRONTIER.fte} Frontier Transformation Engineers`, ok: s.fte >= FRONTIER.fte, detail: `${s.fte}/${FRONTIER.fte}` },
    { label: `${FRONTIER.dp600} Fabric Analytics Engineers (DP-600)`, ok: s.dp600 >= FRONTIER.dp600, detail: `${s.dp600}/${FRONTIER.dp600}` },
  ];
}

export function frontierQualified(s: GameState): boolean {
  return frontierRequirements(s).every((r) => r.ok);
}

export function frontierAuditChance(s: GameState, prep: boolean): number {
  let p = 0.4;
  p += 0.12 * Math.min(3, frontierOffers(s));
  p += 0.03 * Math.min(4, s.fte - FRONTIER.fte);
  p += 0.04 * Math.min(3, s.dp600 - FRONTIER.dp600);
  p += (s.compliance - 60) / 300;
  // Being your own customer zero proves the agentic transformation you sell.
  if (s.flags.customerZero) p += 0.04;
  if (s.flags.azureZero) p += 0.04;
  if (prep) p += 0.15;
  return Math.max(0.1, Math.min(0.95, p));
}

export interface CreditBreakdown {
  ps: number;
  designations: number;
  specs: number;
  total: number;
}

/**
 * Yearly Azure bulk credits ($K) from the benefits you hold: Partner Success, each Solutions Partner
 * designation, and each specialization (capped per category, and only with Solutions Partner benefits).
 */
export function azureAllowance(s: GameState): CreditBreakdown {
  const ps = s.benefits === 'none' ? 0 : AZURE_CREDITS.ps[s.benefits];
  const designations = s.designations.reduce((n, d) => n + AZURE_CREDITS.designation[d.area], 0);
  let specs = 0;
  if (s.designations.length > 0) {
    const used: Partial<Record<CreditCategory, number>> = {};
    for (const held of s.specs) {
      const def = SPEC[held.id];
      if (!def) continue;
      const cat = creditCategory(def);
      const n = used[cat] ?? 0;
      if (n >= AZURE_CREDITS.spec[cat].cap) continue;
      used[cat] = n + 1;
      specs += AZURE_CREDITS.spec[cat].per;
    }
  }
  return { ps, designations, specs, total: Math.round((ps + designations + specs) * 10) / 10 };
}

/** Can Partner Success stop renewing? Only once a Solutions Partner designation is held. */
export function canStopBenefits(s: GameState): boolean {
  return s.benefits !== 'none' && s.designations.length > 0;
}

/** Total certifications, used for productivity and project quality. */
export function totalCerts(s: GameState): { inter: number; adv: number } {
  let inter = 0;
  let adv = 0;
  for (const a of AREAS) {
    inter += s.areas[a].inter;
    adv += s.areas[a].adv;
  }
  return { inter, adv };
}

export function totalCustomers(s: GameState): number {
  return AREAS.reduce((n, a) => n + s.areas[a].customers, 0) + s.key.length;
}

export function staff(s: GameState): number {
  return s.tech + s.sales;
}

export function apMax(s: GameState): number {
  const n = staff(s);
  return 2 + (n >= 25 ? 1 : 0) + (n >= 50 ? 1 : 0);
}

export function maxHires(s: GameState): number {
  return 3 + s.programmes.people + (s.reputation >= 70 ? 2 : 0);
}

export function creditLimit(s: GameState): number {
  const rev = s.lastReport?.revenue.total ?? 500;
  return Math.max(150, Math.round(rev * 0.6 / 10) * 10);
}

export function partnerStage(s: GameState): string {
  if (s.frontier) return 'FRONTIER PARTNER';
  if (s.specs.length > 0) return 'SPECIALIZED PARTNER';
  if (s.designations.length > 0) return 'SOLUTIONS PARTNER';
  return s.benefits === 'none' ? 'NETWORK MEMBER' : 'NETWORK + SUCCESS';
}

/** Capability index per area (0..1) driving project success. */
export function skillRatio(s: GameState, area: AreaId): number {
  const a = s.areas[area];
  return Math.min(1, (a.inter + 2 * a.adv) / 8);
}
