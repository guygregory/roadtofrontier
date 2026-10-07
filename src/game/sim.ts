import { AREA, AREAS, AreaId, areaName, AZURE_ZERO, CFG, CSP, OFFER, PROGRAMMES, PS_FEE, SPEC } from './data';
import { credits, fyOf, money, qOf, turnLabel } from './format';
import { rollEvents } from './events';
import { advisor, assignFirstPdm, currentPdm, rotatePdm } from './advisor';
import {
  adjMorale,
  adjRep,
  attrition,
  businessArea,
  certGain,
  clamp,
  gainKeyAccount,
  grantAzureCredits,
  hasMod,
  lose,
  loseKeyAccount,
  news,
  removeTech,
  schedule,
  spend,
  win,
} from './ops';
import { potyChance, categoryName } from './poty';
import {
  allPcs,
  azureAllowance,
  canStopBenefits,
  creditLimit,
  cspBilled,
  cspFee,
  hasDesignation,
  pcs,
  publishedOffers,
  skillRatio,
  specQualified,
  specsInArea,
  specUnlocked,
  sum,
  totalCerts,
  totalCustomers,
  apMax,
  unifiedCost,
} from './rules';
import { binomial, rand, randInt, stochasticRound } from './rng';
import { emptyBoosts } from './state';
import type { GameState, QuarterReport, YearEndReport } from './types';

/** Recurring programme spend per quarter (before co-op offsets). */
export function programmeCost(s: GameState): number {
  let c = 0;
  for (const p of PROGRAMMES) c += p.costs[s.programmes[p.id]];
  return c;
}

/**
 * Overhead relief from internal-use licences. Partner Success and Solutions Partner benefits overlap
 * (you only need one set of licences), and Solutions Partner benefits outgrow Partner Success.
 */
export function licenceRelief(s: GameState): number {
  const ps = s.benefits === 'core' ? 4 : s.benefits === 'expanded' ? 8 : 0;
  const n = s.designations.length;
  const sp = n > 0 ? 10 + 6 * (n - 1) : 0;
  return Math.min(30, Math.max(ps, sp));
}

export function overheadCost(s: GameState): number {
  const base = CFG.overheadBase + CFG.overheadPerStaff * (s.tech + s.sales) - licenceRelief(s) + (s.flags.officeDelta ?? 0);
  return Math.max(10, base * (s.bet === 'ops' ? 0.85 : 1));
}

export function offerDevCost(s: GameState): number {
  const per = CFG.offerBuildCost * (s.bet === 'innovation' ? 0.75 : 1) * (s.benefits === 'expanded' || s.designations.length > 0 ? 0.85 : 1);
  return Math.round(per * s.offers.filter((o) => !o.published).length);
}

/** Cash needed this quarter for Customer Zero for Azure consumption, after Azure credits. */
export function azureRunCash(s: GameState): number {
  if (!s.flags.azureZero) return 0;
  return Math.max(0, AZURE_ZERO.runCost - Math.max(0, s.azureCredits));
}

/** Estimated recurring quarterly costs, for dashboards and planning. */
export function forecastCosts(s: GameState): number {
  return (
    s.tech * CFG.techCost +
    s.sales * CFG.salesCost +
    overheadCost(s) +
    programmeCost(s) +
    unifiedCost(s) +
    cspFee(s) +
    s.debt * CFG.interest +
    (s.flags.dividends ?? 0) +
    offerDevCost(s) +
    (s.flags.integration ? 20 : 0) +
    azureRunCash(s)
  );
}

function focusShares(s: GameState): [AreaId, number][] {
  return s.focus.secondary && s.focus.secondary !== s.focus.primary
    ? [
        [s.focus.primary, 0.65],
        [s.focus.secondary, 0.35],
      ]
    : [[s.focus.primary, 1]];
}

/**
 * 1 July: the new membership year. Partner Success renews (or lapses, if you switched renewal off)
 * and the year's Azure bulk credits are granted for every benefit you hold.
 */
export function startFiscalYear(s: GameState): string[] {
  const notes: string[] = [];
  const fy = fyOf(s.turn);
  if (s.benefits !== 'none' && s.flags.psPaidFY !== fy) {
    const name = s.benefits === 'core' ? 'Core' : 'Expanded';
    if (s.benefitsRenew) {
      spend(s, PS_FEE[s.benefits]);
      s.flags.psPaidFY = fy;
      notes.push(`Partner Success ${name} Benefits renewed for FY${fy} (${money(PS_FEE[s.benefits])}).`);
    } else {
      s.benefits = 'none';
      s.benefitsRenew = true;
      notes.push(`Partner Success ${name} Benefits ended${s.designations.length > 0 ? ': your Solutions Partner benefits have you covered' : ''}.`);
    }
  }
  s.azureCredits = azureAllowance(s).total;
  if (s.azureCredits > 0) notes.push(`${credits(s.azureCredits)} of Azure credits granted for FY${fy}.`);
  for (const n of notes) news(s, n);
  return notes;
}

/** Start a quarter: roll PCS windows, reset per-quarter state and queue events. */
export function beginQuarter(s: GameState): string[] {
  for (const a of AREAS) {
    const ar = s.areas[a];
    ar.adds.shift();
    ar.adds.push(0);
    ar.deploys.shift();
    ar.deploys.push(0);
    ar.usage.shift();
    ar.usage.push(0);
  }
  s.q = emptyBoosts();
  s.ap = apMax(s);
  s.adjustments = 2;
  s.hiresThisQuarter = 0;
  s.targets = s.targets.filter((t) => t.expires >= s.turn);
  s.modifiers = s.modifiers.filter((m) => m.until >= s.turn);
  const notes = qOf(s.turn) === 1 ? startFiscalYear(s) : [];
  s.pending = rollEvents(s);
  s.phase = s.status === 'playing' ? (s.pending.length > 0 ? 'events' : 'hub') : 'ended';
  news(s, `${turnLabel(s.turn)} begins.`);
  return notes;
}

/** Resolve the quarter. Mutates state and returns the report. */
export function endQuarter(s: GameState): QuarterReport {
  const notices: string[] = [];
  const pcsPrev = allPcs(s);
  const down = hasMod(s, 'downturn');
  const crunch = hasMod(s, 'capacity');
  const priceWar = hasMod(s, 'pricewar');
  const discounting = hasMod(s, 'discounting');
  const q = s.q;
  const shares = focusShares(s);
  const growth = s.bet === 'growth' ? 1.25 : 1;
  const nDes = s.designations.length;

  // --- Programmes & co-op
  const mktCost = PROGRAMMES.find((p) => p.id === 'marketing')!.costs[s.programmes.marketing];
  const coopUsed = Math.min(s.coop, mktCost * 0.5);
  s.coop -= coopUsed;
  const progCost = programmeCost(s) - coopUsed;

  // --- Skilling
  const pts = CFG.skillPts[s.programmes.skilling] * (s.bet === 'skills' ? 1.35 : 1) + q.skillPts;
  let gainedInter = 0;
  let gainedAdv = 0;
  for (const [a, share] of shares) {
    const g = certGain(s, a, pts * share);
    gainedInter += g.inter;
    gainedAdv += g.adv;
  }

  // --- Leads
  const leads: Partial<Record<AreaId, number>> = {};
  const addLeads = (a: AreaId, n: number) => (leads[a] = (leads[a] ?? 0) + n);
  const repF = 0.6 + s.reputation / 100;
  const mkt = CFG.mktLeads[s.programmes.marketing] * repF * growth * (down ? 0.65 : 1);
  for (const [a, share] of shares) addLeads(a, mkt * share);
  for (const a of AREAS) if (q.leads[a]) addLeads(a, (q.leads[a] ?? 0) * (down ? 0.75 : 1));
  const refs = (CFG.cosellRefs[s.programmes.cosell] + 0.4 * nDes + 0.3 * publishedOffers(s) + (s.mpl ? 1 : 0)) * (s.bet === 'align' ? 1.5 : 1) * growth + q.referralLeads;
  const refAreas = nDes > 0 ? s.designations.map((d) => d.area) : [s.focus.primary];
  for (const a of refAreas) addLeads(a, refs / refAreas.length);
  const organic = (s.reputation / 40) * (1 + 0.1 * nDes) * (down ? 0.7 : 1);
  const totalCust = Math.max(1, AREAS.reduce((n, a) => n + s.areas[a].customers, 0));
  for (const a of AREAS) addLeads(a, (organic * s.areas[a].customers) / totalCust);

  // --- Conversion
  const wins: Partial<Record<AreaId, number>> = {};
  let totalWins = 0;
  for (const a of AREAS) {
    const l = leads[a] ?? 0;
    if (l <= 0) continue;
    let p = 0.25 + CFG.cosellConv[s.programmes.cosell];
    if (hasDesignation(s, a)) p += 0.08;
    p += 0.04 * specsInArea(s, a);
    p += 0.05 * Math.min(2, publishedOffers(s, a));
    if (s.frontier) p += 0.1;
    if (s.flags.azureZero && AREA[a].azure) p += AZURE_ZERO.azureEdge;
    if (s.bet === 'growth') p += 0.05;
    if (down) p -= 0.08;
    if (priceWar && !discounting) p -= 0.1;
    p += (skillRatio(s, a) - 0.5) * 0.1;
    p = clamp(p, 0.05, 0.85);
    const w = binomial(s, stochasticRound(s, l), p);
    wins[a] = w;
    totalWins += w;
  }
  const maxWins = s.sales * 3;
  if (totalWins > maxWins) {
    const k = maxWins / totalWins;
    totalWins = 0;
    for (const a of AREAS) {
      if (!wins[a]) continue;
      wins[a] = Math.floor((wins[a] ?? 0) * k);
      totalWins += wins[a] ?? 0;
    }
    notices.push(`{o}Your ${s.sales} sellers couldn't close every lead - hire more sales staff.{/}`);
  }
  for (const a of AREAS) {
    const w = wins[a] ?? 0;
    if (!w) continue;
    s.areas[a].customers += w;
    const rec = s.csp !== 'none' ? w : binomial(s, w, 0.6);
    s.areas[a].adds[3] += rec;
  }
  s.stats.customersWon += totalWins;
  if (s.csp === 'none' && totalWins > 0) notices.push('Without CSP, only some new customers were associated to you in Partner Center (PCS net adds).');

  // --- Key account wins
  const newKey: string[] = [];
  let pKey =
    0.02 +
    0.015 * s.programmes.cosell +
    0.025 * Math.min(3, nDes) +
    0.02 * Math.min(4, s.specs.length) +
    0.025 * Math.min(3, publishedOffers(s)) +
    q.keyBonus +
    (s.frontier ? 0.1 : 0) -
    (down ? 0.04 : 0);
  if (s.reputation < 30) pKey *= 0.5;
  pKey = Math.min(0.45, pKey);
  const keyRolls = [pKey];
  for (const pk of keyRolls) {
    if (pk > 0 && rand(s) < pk) {
      const area = businessArea(s);
      const rev = randInt(s, 60, 130) * (1 + 0.1 * specsInArea(s, area)) * (down ? 0.85 : 1);
      const k = gainKeyAccount(s, area, rev);
      // Shown as "+ name (area, $X/qtr)" in a 50-character report line.
      newKey.push(`${k.name} (${areaName(area, 39 - k.name.length - money(k.revenue).length)}, ${money(k.revenue)}/qtr)`);
      notices.push(`{g}New key account: ${k.name}!{/}`);
    }
  }

  // --- Workload & capacity
  const smallCount = AREAS.reduce((n, a) => n + s.areas[a].customers, 0);
  const smallRev = smallCount * CFG.smallRevenue * (down ? 0.9 : 1) * (discounting ? 0.9 : 1);
  const keyRev = s.key.reduce((n, k) => n + k.revenue, 0) * (down ? 0.88 : 1);
  let offerRev = 0;
  for (const o of s.offers) if (o.published) offerRev += 15 + 4 * Math.min(o.age, 8);
  offerRev *= down ? 0.9 : 1;
  const certs = totalCerts(s);
  const certBoost = Math.min(0.15, (0.03 * (certs.inter + 2 * certs.adv)) / Math.max(1, s.tech));
  const prod = s.productivity * (1 + certBoost) * (1 - 0.03 * s.programmes.skilling - q.capacityLoss + q.capacityGain) * (s.morale < 35 ? 0.9 : 1);
  const capacity = Math.max(1, s.tech * CFG.techCapacity * prod);
  const workload = smallCount * CFG.smallRevenue + s.key.reduce((n, k) => n + k.revenue, 0) + offerRev * 0.3 + q.workshopRevenue;
  const util = workload / capacity;
  const deliverable = Math.min(1, 1 / util);
  const services = (smallRev + keyRev + q.workshopRevenue) * deliverable;
  if (util > 1.05) notices.push(`{o}Team overloaded (${Math.round(util * 100)}% utilisation): revenue capped, quality slipping. Hire engineers!{/}`);

  // --- Churn
  let churn = 0.04 + Math.max(0, util - 1) * 0.4 + (s.morale < 40 ? 0.02 : 0) + (down ? 0.02 : 0) - (s.bet === 'customer' ? 0.015 : 0) - (s.unified ? 0.005 : 0) + q.extraChurn;
  churn = clamp(churn, 0.005, 0.3);
  let lost = 0;
  for (const a of AREAS) {
    const ar = s.areas[a];
    const l = binomial(s, ar.customers, churn);
    ar.customers -= l;
    lost += l;
    ar.adds[3] -= s.csp !== 'none' ? l : binomial(s, l, 0.6);
  }

  // --- Key account satisfaction
  const lostKey: string[] = [];
  for (const k of [...s.key]) {
    let d = util > 1.15 ? -8 : util > 1.0 ? -4 : util < 0.9 ? 3 : 1;
    if (s.unified) d += 2;
    if (s.bet === 'customer') d += 5;
    d += s.morale > 70 ? 1 : s.morale < 40 ? -4 : 0;
    if (specsInArea(s, k.area) > 0) d += 1;
    d += randInt(s, -3, 3);
    k.sat = clamp(k.sat + d, 0, 100);
    if (k.sat < 25 && rand(s) < 0.35) {
      loseKeyAccount(s, k.id);
      lostKey.push(k.name);
      notices.push(`{r}${k.name} terminated their contract (satisfaction too low).{/} PCS performance and customer success fall.`);
    }
  }

  // --- Projects & deployments
  let projects = 0;
  let successes = 0;
  let failures = 0;
  let awryScheduled = false;
  for (const a of AREAS) {
    const ar = s.areas[a];
    const keys = s.key.filter((k) => k.area === a).length;
    let n = stochasticRound(s, (wins[a] ?? 0) * 0.8 + keys * 0.45 + publishedOffers(s, a) * 0.5 + ar.customers * 0.02) + (q.workshops[a] ?? 0);
    if (crunch && AREA[a].azure) n = Math.round(n * 0.6);
    if (n <= 0) continue;
    let p = 0.55 + 0.3 * skillRatio(s, a) + (s.unified ? 0.05 : 0) + (s.bet === 'ops' ? 0.05 : 0) + 0.03 * specsInArea(s, a);
    if (s.flags.azureZero && AREA[a].azure) p += AZURE_ZERO.azureEdge;
    p -= Math.max(0, util - 1) * 0.6;
    if (s.morale < 40) p -= 0.08;
    p += q.projectBoost[a] ?? 0;
    p -= q.successPenalty;
    p = clamp(p, 0.2, 0.97);
    const ok = binomial(s, n, p);
    projects += n;
    successes += ok;
    failures += n - ok;
    ar.deploys[3] += ok;
    ar.usage[3] += ok * 1.5;
    if (n - ok > 0 && !awryScheduled && rand(s) < 0.45) {
      schedule(s, 1, 'project_awry');
      awryScheduled = true;
    }
  }
  s.stats.deploys += successes;
  if (failures > 0) adjRep(s, -Math.min(3, failures));

  // --- Usage growth (customer success)
  for (const a of AREAS) {
    const ar = s.areas[a];
    const happyKeys = s.key.filter((k) => k.area === a && k.sat >= 50).length;
    let u = happyKeys * 1.0 + publishedOffers(s, a) * 1.5 + ar.customers * 0.03;
    if (s.unified && ar.customers > 0) u += 0.3;
    if (crunch && AREA[a].azure) u -= 2;
    ar.usage[3] += u;
  }

  // --- Revenue
  let csp = 0;
  let incentives = 0;
  const billed = cspBilled(s);
  // Indirect Resellers pay their Indirect Provider 1% of billed cloud; Direct Bill keeps it.
  const fee = s.csp === 'indirect' ? billed.total * CSP.indirectFee : 0;
  if (s.csp !== 'none') {
    csp = billed.total * CSP.margin[s.csp];
    incentives = 0.25 * totalCustomers(s) * (1 + 0.25 * nDes) * (s.csp === 'direct' ? 1.3 : 1) * (hasMod(s, 'incentiveBoost') ? 1.5 : 1);
  }
  const revenue = services + offerRev + csp + incentives;

  // --- Costs
  const salaries = s.tech * CFG.techCost + s.sales * CFG.salesCost;
  const overhead = overheadCost(s);
  const interest = s.debt * CFG.interest;
  // Customer Zero for Azure: internal Azure consumption, paid from Azure credits first.
  let azureUsed = 0;
  let azureCash = 0;
  if (s.flags.azureZero) {
    azureUsed = Math.min(Math.max(0, s.azureCredits), AZURE_ZERO.runCost);
    s.azureCredits = Math.round((s.azureCredits - azureUsed) * 10) / 10;
    azureCash = AZURE_ZERO.runCost - azureUsed;
  }
  const other = unifiedCost(s) + fee + (s.flags.dividends ?? 0) + offerDevCost(s) + (s.flags.integration ? 20 : 0) + azureCash;
  if (s.flags.integration) s.flags.integration = Math.max(0, s.flags.integration - 1);
  const costs = salaries + overhead + progCost + interest + other;
  const profit = revenue - costs;
  s.cash += profit;

  // --- Morale
  let dm = CFG.peopleMorale[s.programmes.people] + (util > 1.15 ? -6 : util > 1 ? -3 : util < 0.6 ? -2 : 1) + (profit < 0 ? -1 : 0) + q.moraleDelta;
  dm += (60 - s.morale) * 0.05;
  adjMorale(s, dm);

  // --- Attrition
  const techLeave = attrition(s);
  const salesLeave = binomial(s, s.sales, 0.012 + Math.max(0, 55 - s.morale) / 600);
  if (techLeave > 0) {
    const l = removeTech(s, techLeave);
    notices.push(`${techLeave} engineer${techLeave > 1 ? 's' : ''} resigned${l.inter ? `, taking ${l.inter} certification${l.inter > 1 ? 's' : ''}` : ''}.`);
  }
  if (salesLeave > 0) s.sales = Math.max(0, s.sales - salesLeave);

  // --- Offers
  for (const o of s.offers) {
    if (o.published) {
      o.age++;
      continue;
    }
    o.progress += (s.bet === 'innovation' ? 1.5 : 1) + (q.build ? 0.5 : 0);
    if (o.progress >= o.required) {
      o.published = true;
      adjRep(s, 2);
      notices.push(`{g}${OFFER[o.id].name} is live on Microsoft Marketplace!{/}`);
      news(s, `${s.company} launches ${OFFER[o.id].name} on Microsoft Marketplace.`);
    }
  }

  // --- Co-op accrual
  if (s.csp !== 'none' || nDes > 0) {
    const acc = (2 + 3 * nDes + 1 * s.specs.length) * (s.bet === 'align' ? 1.5 : 1);
    s.coop += acc;
  }

  // --- Reputation & compliance drift
  let dr = (successes >= 3 ? 1 : 0) + (s.bet === 'align' ? 2 : 0) - (s.reputation > 70 ? 2 : s.reputation > 50 ? 1 : 0);
  if (q.ignite || q.build) dr += 1;
  adjRep(s, dr);
  if (s.compliance < 75) s.compliance++;

  // --- PCS & designations
  const creditsBefore = azureAllowance(s).total;
  for (const a of AREAS) {
    const p = pcs(s, a);
    const ar = s.areas[a];
    ar.qualHist.shift();
    ar.qualHist.push(p.qualified);
    if (p.qualified && !hasDesignation(s, a)) {
      if (nDes > 0) {
        s.cash -= CFG.designationFee;
        s.designations.push({ area: a, since: s.turn, renewAt: s.turn + 4 });
        adjRep(s, 3);
        notices.push(`{g}Qualified! Automatically enrolled as Solutions Partner for ${AREA[a].name}.{/}`);
        news(s, `${s.company} adds Solutions Partner for ${AREA[a].name}.`);
      } else if (!ar.qualHist.slice(0, 3).some(Boolean)) {
        notices.push(`{y}You QUALIFY for Solutions Partner for ${AREA[a].name}! Purchase it in PARTNER CENTER.{/}`);
      }
    }
  }

  // --- Business Applications specializations enrol automatically
  for (const spec of Object.values(SPEC)) {
    if (spec.validation !== 'auto' || s.specs.some((x) => x.id === spec.id)) continue;
    if (specUnlocked(s, spec) && specQualified(s, spec)) {
      s.specs.push({ id: spec.id, since: s.turn, renewAt: s.turn + 4, renewals: 0 });
      notices.push(`{g}Specialization earned: ${spec.name}!{/}`);
      news(s, `${s.company} earns the ${spec.name} specialization.`);
    }
  }

  // --- Audits & references
  for (const au of s.audits) {
    const pass = rand(s) < au.chance;
    if (au.kind === 'frontier') {
      if (pass) {
        s.frontier = true;
        notices.push('{y}*** FRONTIER PARTNER SPECIALIZATION EARNED! ***{/}');
        win(s, 'frontier', `${s.company} passed the Frontier Partner audit and joined Microsoft's elite agentic AI partners.`);
      } else {
        adjRep(s, -2);
        notices.push('{r}The Frontier Partner audit found gaps. Strengthen your offers and skills, then try again.{/}');
      }
      continue;
    }
    const spec = SPEC[au.spec ?? ''];
    if (!spec) continue;
    if (pass) {
      s.specs.push({ id: spec.id, since: s.turn, renewAt: s.turn + 4, renewals: 0 });
      adjRep(s, 2);
      notices.push(`{g}${au.kind === 'reference' ? 'References approved' : 'Audit passed'}: ${spec.name} specialization earned!{/}`);
      news(s, `${s.company} earns the ${spec.name} specialization.`);
    } else {
      adjRep(s, -1);
      notices.push(`{r}${au.kind === 'reference' ? 'References rejected' : 'Audit failed'} for ${spec.name}.{/} You can try again next quarter.`);
    }
  }
  s.audits = [];

  // --- New benefits activate straight away: their Azure credits run to the end of the FY.
  // Earned as Q4 closes, there is no time left to use them, so they arrive with the new year on 1 July.
  const creditsGained = Math.round((azureAllowance(s).total - creditsBefore) * 10) / 10;
  if (creditsGained > 0) {
    if (qOf(s.turn) === 4) notices.push(`{c}Your new benefits add ${credits(creditsGained)} a year of Azure credits{/}, from 1 July.`);
    else {
      grantAzureCredits(s, creditsGained);
      notices.push(`{c}+${credits(creditsGained)} of Azure credits{/} from your new benefits (they expire on 30 June).`);
    }
  }

  // --- A second specialization puts you on Microsoft's Managed Partner List from the next FY
  if (s.specs.length >= 2 && s.flags.secondSpec === undefined) {
    s.flags.secondSpec = s.turn;
    if (!s.mpl) notices.push(`{y}Two specializations! Microsoft will add you to its Managed Partner List from FY${fyOf(s.turn) + 1}, with your own Partner Development Manager.{/}`);
  }

  // --- Anniversaries: designations
  for (const d of [...s.designations]) {
    if (d.renewAt > s.turn) continue;
    const ar = s.areas[d.area];
    if (ar.qualHist.slice(-3).some(Boolean)) {
      d.renewAt = s.turn + 4;
      s.cash -= CFG.designationFee;
      notices.push(`Solutions Partner for ${AREA[d.area].name} renewed for another year.`);
    } else {
      s.designations = s.designations.filter((x) => x !== d);
      adjRep(s, -4);
      notices.push(`{r}Solutions Partner for ${AREA[d.area].name} lapsed - PCS below 70 at renewal.{/}`);
      news(s, `${s.company} loses its ${AREA[d.area].label} designation.`);
    }
  }

  // --- Anniversaries: specializations (audit/reference again every other year)
  for (const sp of [...s.specs]) {
    if (sp.renewAt > s.turn) continue;
    const spec = SPEC[sp.id];
    sp.renewals++;
    const ok = specQualified(s, spec);
    let reval = true;
    if (ok && sp.renewals % 2 === 0 && spec.validation !== 'auto') {
      s.cash -= spec.validation === 'audit' ? CFG.auditCost : CFG.refCost;
      reval = rand(s) < 0.8;
    }
    if (ok && reval) {
      sp.renewAt = s.turn + 4;
      notices.push(`${spec.name} specialization renewed.`);
    } else {
      s.specs = s.specs.filter((x) => x !== sp);
      notices.push(`{r}${spec.name} specialization lapsed at renewal.{/}`);
    }
  }

  // --- History & stats
  const pcsNow = allPcs(s);
  s.history.push({ turn: s.turn, cash: Math.round(s.cash), revenue: Math.round(revenue), profit: Math.round(profit), customers: totalCustomers(s), staff: s.tech + s.sales, pcs: pcsNow, cloud: Math.round(billed.total), cloudAzure: Math.round(billed.azure) });
  s.stats.peakRevenue = Math.max(s.stats.peakRevenue, revenue);

  const report: QuarterReport = {
    turn: s.turn,
    revenue: { services: Math.round(services), offers: Math.round(offerRev), csp: Math.round(csp), incentives: Math.round(incentives), total: Math.round(revenue) },
    costs: { salaries: Math.round(salaries), overhead: Math.round(overhead), programmes: Math.round(progCost), other: Math.round(other), interest: Math.round(interest), total: Math.round(costs) },
    oneOff: Math.round(q.oneOffSpend),
    profit: Math.round(profit),
    cashEnd: Math.round(s.cash),
    coopUsed: Math.round(coopUsed),
    azureUsed: Math.round(azureUsed * 10) / 10,
    utilisation: util,
    wins,
    lost,
    newKey,
    lostKey,
    projects,
    successes,
    failures,
    certs: { inter: gainedInter, adv: gainedAdv },
    leavers: techLeave + salesLeave,
    pcs: pcsNow,
    pcsPrev,
    notices,
  };
  s.lastReport = report;

  // --- Cash crisis
  if (s.cash < 0) {
    const room = creditLimit(s) - s.debt;
    if (room > 0) {
      const draw = Math.min(-s.cash, room);
      s.debt += draw;
      s.cash += draw;
      notices.push(`{o}Overdraft: drew ${money(draw)} on your credit line.{/}`);
    }
  }
  if (s.cash < 0) {
    s.negativeQuarters++;
    if (s.negativeQuarters >= 2) {
      lose(s, 'bankrupt', `${s.company} ran out of cash two quarters in a row. The administrators have taken the coffee machine.`);
    } else {
      notices.push('{r}CASH CRISIS! You are out of cash and credit. Get back above zero by the end of next quarter or the business fails.{/}');
    }
  } else s.negativeQuarters = 0;

  // --- Year end
  s.yearEnd = qOf(s.turn) === 4 ? endYear(s) : null;

  // There is no time limit: the journey continues past FY31 until you win or lose.
  s.turn++;
  if (s.status !== 'playing') s.phase = 'ended';
  return report;
}

function endYear(s: GameState): YearEndReport {
  const fy = fyOf(s.turn);
  const notices: string[] = [];
  const fyHist = s.history.filter((h) => fyOf(h.turn) === fy);
  const report: YearEndReport = {
    fy,
    revenue: sum(fyHist.map((h) => h.revenue)),
    profit: sum(fyHist.map((h) => h.profit)),
    poty: [],
    coopExpired: 0,
    notices,
  };

  // Partner of the Year results
  for (const n of s.nominations.filter((x) => x.fy === fy)) {
    const p = potyChance(s, n.category, n.premium);
    const r = rand(s);
    const name = categoryName(n.category);
    if (r < p) {
      report.poty.push({ category: name, result: 'winner', chance: p });
      win(s, 'poty', `${s.company} is the ${name} Partner of the Year!`);
    } else if (r < p * 2.2) {
      report.poty.push({ category: name, result: 'finalist', chance: p });
      adjRep(s, 8);
      s.stats.potyFinalist++;
    } else report.poty.push({ category: name, result: 'none', chance: p });
  }

  // Co-op funds expire
  if (s.coop > 0) {
    report.coopExpired = Math.round(s.coop);
    notices.push(`${money(s.coop)} of unused Marketing Co-op funds expired.`);
    s.coop = 0;
  }

  // Azure bulk credits expire with the membership year
  if (s.azureCredits > 0) {
    report.azureExpired = s.azureCredits;
    notices.push(`${credits(s.azureCredits)} of unused Azure credits expired.`);
    s.azureCredits = 0;
  }

  // MAICPP membership renewal
  if (s.status === 'playing') {
    if (s.compliance < 20) {
      lose(s, 'removed', 'Microsoft declined to renew your AI Cloud Partner Program membership after repeated compliance failures.');
      notices.push('{r}MAICPP membership NOT renewed.{/}');
    } else {
      notices.push('MAICPP membership renewed: agreement accepted, profile verified.');
      // Managed partners get a new PDM every few years, at the start of an FY.
      const pdmChange = rotatePdm(s, s.turn + 1);
      if (pdmChange) {
        notices.push(pdmChange);
        news(s, `${currentPdm(s).name} becomes ${s.company}'s Partner Development Manager.`);
      }
      // Managed Partner List: from the FY after your second specialization, a PDM looks after you.
      if (!s.mpl && s.flags.secondSpec !== undefined) {
        const before = advisor(s);
        s.mpl = true;
        s.flags.mplSince = s.turn + 1;
        assignFirstPdm(s, s.turn + 1);
        const from = before.kind === 'distributor' ? `${before.name} at your distributor` : 'the MAICPP programme emails';
        notices.push(`{g}You join Microsoft's Managed Partner List for FY${fy + 1}!{/} ${currentPdm(s).name}, your new Partner Development Manager, takes over from ${from}.`);
        news(s, `${s.company} joins Microsoft's Managed Partner List.`);
      }
      if (s.benefits !== 'none') {
        const name = s.benefits === 'core' ? 'Core' : 'Expanded';
        if (!s.benefitsRenew) notices.push(`Partner Success ${name} Benefits end on 30 June (not renewing).`);
        else
          notices.push(
            `Partner Success ${name} Benefits renew on 1 July (${money(PS_FEE[s.benefits])}).${canStopBenefits(s) ? ' Your Solutions Partner benefits now exceed them: you can stop renewing in your FY plan.' : ''}`,
          );
      }
    }
  }
  return report;
}

/** Estimate of next quarter's revenue, used by the dashboard. */
export function lastRevenue(s: GameState): number {
  return s.lastReport?.revenue.total ?? estimateRevenue(s);
}

export function estimateRevenue(s: GameState): number {
  const small = AREAS.reduce((n, a) => n + s.areas[a].customers, 0);
  return Math.round(small * CFG.smallRevenue + s.key.reduce((n, k) => n + k.revenue, 0));
}
