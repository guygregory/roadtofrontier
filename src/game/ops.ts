import { AREA, AREAS, AreaId, AZURE_ZERO, CFG, SPEC } from './data';
import { credits, money } from './format';
import { allPcs, hasDesignation } from './rules';
import { binomial, rand, randInt } from './rng';
import { freshCustomerName } from './state';
import type { GameState, KeyAccount } from './types';

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export function news(s: GameState, msg: string): void {
  s.news.push(msg);
  if (s.news.length > 30) s.news.splice(0, s.news.length - 30);
}

export function spend(s: GameState, amount: number): void {
  s.cash -= amount;
  s.q.oneOffSpend += amount;
}

export function hasMod(s: GameState, id: string): boolean {
  return s.modifiers.some((m) => m.id === id && m.until >= s.turn);
}

export function addMod(s: GameState, id: GameState['modifiers'][number]['id'], quarters: number): void {
  const until = s.turn + quarters - 1;
  const ex = s.modifiers.find((m) => m.id === id);
  if (ex) ex.until = Math.max(ex.until, until);
  else s.modifiers.push({ id, until });
}

export function schedule(s: GameState, inQuarters: number, id: string, data: Record<string, unknown> = {}): void {
  s.scheduled.push({ turn: s.turn + inQuarters, id, data });
}

export function adjRep(s: GameState, d: number): void {
  s.reputation = clamp(Math.round(s.reputation + d), 0, 100);
}

export function adjMorale(s: GameState, d: number): void {
  s.morale = clamp(Math.round(s.morale + d), 0, 100);
}

export function adjCompliance(s: GameState, d: number): void {
  s.compliance = clamp(Math.round(s.compliance + d), 0, 100);
}

/** Keep certification counts consistent with headcount (certs are held by people). */
export function normaliseCerts(s: GameState): void {
  for (const a of AREAS) {
    const ar = s.areas[a];
    ar.inter = clamp(ar.inter, 0, s.tech);
    ar.adv = clamp(ar.adv, 0, ar.inter);
  }
  s.fte = clamp(s.fte, 0, s.tech);
  s.dp600 = clamp(s.dp600, 0, s.tech);
}

/**
 * Technical staff leave; each leaver takes their certifications with them.
 * If `area` is given, the leavers are the senior people of that practice.
 */
export function removeTech(s: GameState, n: number, area?: AreaId): { inter: number; adv: number } {
  n = Math.min(n, Math.max(0, s.tech - 1));
  let lostInter = 0;
  let lostAdv = 0;
  for (let i = 0; i < n; i++) {
    const before = s.tech;
    if (area) {
      const ar = s.areas[area];
      if (ar.adv > 0) {
        ar.adv--;
        lostAdv++;
      }
      if (ar.inter > 0) {
        ar.inter--;
        lostInter++;
      }
    } else {
      for (const a of AREAS) {
        const ar = s.areas[a];
        if (ar.inter > 0 && rand(s) < ar.inter / before) {
          if (ar.adv > 0 && rand(s) < ar.adv / ar.inter) {
            ar.adv--;
            lostAdv++;
          }
          ar.inter--;
          lostInter++;
        }
      }
    }
    if (s.fte > 0 && rand(s) < s.fte / before) s.fte--;
    if (s.dp600 > 0 && rand(s) < s.dp600 / before) s.dp600--;
    s.tech--;
  }
  normaliseCerts(s);
  return { inter: lostInter, adv: lostAdv };
}

export function addCerts(s: GameState, area: AreaId, inter: number, adv: number): { inter: number; adv: number } {
  const ar = s.areas[area];
  const i0 = ar.inter;
  const a0 = ar.adv;
  ar.inter = Math.min(s.tech, ar.inter + inter + adv);
  ar.adv = Math.min(ar.inter, ar.adv + adv);
  return { inter: ar.inter - i0, adv: ar.adv - a0 };
}

/** Spend skilling points in an area (intermediate = 2 pts, advanced = 4 pts), balancing against PCS thresholds. */
export function certGain(s: GameState, area: AreaId, pts: number): { inter: number; adv: number } {
  const ar = s.areas[area];
  const th = AREA[area].th;
  ar.certProgress += pts;
  let gi = 0;
  let ga = 0;
  for (let guard = 0; guard < 40; guard++) {
    const wantAdv = ar.adv < ar.inter && (ar.adv / th.adv < ar.inter / th.inter || ar.inter >= s.tech);
    if (wantAdv && ar.certProgress >= 4 && ar.adv < ar.inter) {
      ar.adv++;
      ga++;
      ar.certProgress -= 4;
    } else if (ar.inter < s.tech && ar.certProgress >= 2) {
      ar.inter++;
      gi++;
      ar.certProgress -= 2;
    } else break;
  }
  // Cap banked progress so idle points don't snowball.
  ar.certProgress = Math.min(ar.certProgress, 6);
  return { inter: gi, adv: ga };
}

export function gainKeyAccount(s: GameState, area: AreaId, revenue: number, name?: string): KeyAccount {
  const k: KeyAccount = { id: s.nextId++, name: name ?? freshCustomerName(s), area, revenue: Math.round(revenue), sat: 65, since: s.turn };
  s.key.push(k);
  s.areas[area].adds[3] += 1;
  return k;
}

export function loseKeyAccount(s: GameState, id: number): KeyAccount | null {
  const i = s.key.findIndex((k) => k.id === id);
  if (i < 0) return null;
  const [k] = s.key.splice(i, 1);
  const ar = s.areas[k.area];
  ar.adds[3] -= 1;
  ar.usage[3] -= 4;
  adjRep(s, -3);
  return k;
}

export function hireTech(s: GameState, n: number): void {
  s.tech += n;
}

export function keyInArea(s: GameState, area: AreaId): KeyAccount[] {
  return s.key.filter((k) => k.area === area);
}

/** Weighted area choice biased toward designations and focus. */
export function businessArea(s: GameState): AreaId {
  const items = AREAS.map((a) => {
    let w = 0.3 + s.areas[a].customers / 20;
    if (hasDesignation(s, a)) w += 3;
    if (s.focus.primary === a) w += 2;
    if (s.focus.secondary === a) w += 1;
    return { a, w };
  });
  const total = items.reduce((x, y) => x + y.w, 0);
  let r = rand(s) * total;
  for (const it of items) {
    r -= it.w;
    if (r <= 0) return it.a;
  }
  return s.focus.primary;
}

export function lowestSatKey(s: GameState): KeyAccount | null {
  if (s.key.length === 0) return null;
  return [...s.key].sort((a, b) => a.sat - b.sat)[0];
}

export function randomKey(s: GameState): KeyAccount | null {
  if (s.key.length === 0) return null;
  return s.key[Math.floor(rand(s) * s.key.length)];
}

export function lose(s: GameState, kind: GameState['endKind'], reason: string): void {
  if (s.status !== 'playing') return;
  s.status = 'lost';
  s.endKind = kind;
  s.endReason = reason;
  s.phase = 'ended';
  s.flags.endTurn = s.turn;
}

export function win(s: GameState, kind: GameState['endKind'], reason: string): void {
  if (s.status !== 'playing') return;
  s.status = 'won';
  s.endKind = kind;
  s.endReason = reason;
  s.phase = 'ended';
  s.flags.endTurn = s.turn;
}

/** Add Azure bulk credits ($K) from a newly activated benefit. Credits expire at the end of the FY. */
export function grantAzureCredits(s: GameState, amount: number): number {
  if (amount <= 0) return 0;
  s.azureCredits = Math.round((s.azureCredits + amount) * 10) / 10;
  return amount;
}

/** How Customer Zero for Azure would be paid: Azure credits first (if chosen), cash for the rest. */
export function azureZeroSplit(s: GameState, useCredits: boolean): { credits: number; cash: number } {
  const c = useCredits ? Math.min(Math.max(0, s.azureCredits), AZURE_ZERO.cost) : 0;
  return { credits: Math.round(c * 10) / 10, cash: Math.round((AZURE_ZERO.cost - c) * 10) / 10 };
}

/** Customer Zero for Azure: run the company on Azure (internal agents on Azure AI Foundry, a Fabric data estate). */
export function becomeAzureZero(s: GameState, useCredits: boolean): string {
  const split = azureZeroSplit(s, useCredits);
  s.azureCredits = Math.round((s.azureCredits - split.credits) * 10) / 10;
  spend(s, split.cash);
  s.flags.azureZero = 1;
  s.productivity += AZURE_ZERO.productivity;
  s.dp600 = Math.min(s.tech, s.dp600 + 1);
  certGain(s, 'dai', 2);
  certGain(s, 'dataai', 2);
  adjMorale(s, 2);
  const paid = split.credits > 0 ? `${credits(split.credits)} of Azure credits${split.cash > 0 ? ` + ${credits(split.cash)} cash` : ''}` : `${money(split.cash)} cash`;
  return `{g}You now run your own business on Azure!{/} Paid with ${paid}. Productivity +${Math.round(AZURE_ZERO.productivity * 100)}%, +1 DP-600, better Azure deals. Runs at ${money(AZURE_ZERO.runCost)}/qtr (credits first).`;
}

/** A competitor that could be acquired. */
export function makeTarget(s: GameState, rivalName: string): GameState['targets'][number] {
  const area = businessArea(s);
  const tech = randInt(s, 4, 12);
  const sales = randInt(s, 1, 3);
  const customers = randInt(s, 8, 24);
  const inter = randInt(s, 1, Math.min(tech, 5));
  const adv = randInt(s, 0, Math.min(inter, 2));
  const keyRevenue = rand(s) < 0.5 ? randInt(s, 50, 100) : 0;
  const price = Math.round((customers * 16 + tech * 30 + (inter + adv * 2) * 8 + keyRevenue * 1.5) * (0.85 + rand(s) * 0.4));
  return {
    id: s.nextId++,
    name: rivalName,
    area,
    tech,
    sales,
    customers,
    inter,
    adv,
    keyRevenue,
    price,
    expires: s.turn + 2,
    skeleton: rand(s) < 0.22,
    culture: rand(s) < 0.35,
    diligence: false,
  };
}

export function acquire(s: GameState, targetId: number, financed: boolean): string {
  const t = s.targets.find((x) => x.id === targetId);
  if (!t) return 'That company is no longer for sale.';
  s.targets = s.targets.filter((x) => x.id !== targetId);
  if (financed) {
    const fromCash = Math.max(0, Math.min(s.cash, t.price));
    const loan = t.price - fromCash;
    s.cash -= fromCash;
    s.q.oneOffSpend += fromCash;
    s.debt += loan;
  } else spend(s, t.price);
  s.tech += t.tech;
  s.sales += t.sales;
  const ar = s.areas[t.area];
  ar.customers += t.customers;
  addCerts(s, t.area, t.inter - t.adv, t.adv);
  // Customer associations transfer over time; half count as net adds now.
  ar.adds[3] += Math.round(t.customers / 2);
  let msg = `${t.name} is now part of ${s.company}! +${t.tech} engineers, +${t.customers} ${AREA[t.area].label} customers.`;
  if (t.keyRevenue > 0) {
    const k = gainKeyAccount(s, t.area, t.keyRevenue);
    msg += ` Key account ${k.name} comes too.`;
  }
  adjMorale(s, -6);
  s.flags.integration = 2;
  if (t.culture) schedule(s, 1, 'culture_clash', { area: t.area, n: Math.max(1, Math.round(t.tech / 3)), name: t.name });
  if (t.skeleton) schedule(s, 1 + Math.floor(rand(s) * 2), 'acq_skeleton', { name: t.name });
  return msg;
}

export function pcsSnapshot(s: GameState): Record<AreaId, number> {
  return allPcs(s);
}

export function specName(id: string): string {
  return SPEC[id]?.name ?? id;
}

export function cashLine(amount: number): string {
  return amount === 0 ? 'free' : money(amount);
}

export function attrition(s: GameState): number {
  return binomial(s, s.tech, 0.012 + Math.max(0, 55 - s.morale) / 600);
}

export { CFG };
