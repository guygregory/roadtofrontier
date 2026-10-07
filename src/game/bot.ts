import { ACTION, performAction, purchaseDesignation, scheduleAudit, scheduleFrontierAudit, hireStaff, borrow, buyBenefits } from './actions';
import { AREA, AREAS, AreaId, OFFERS, SPEC, SPECS } from './data';
import { EVENT, resolveEvent } from './events';
import { qOf } from './format';
import { canPurchaseDesignation, frontierQualified, hasDesignation, hasSpec, pcs, specQualified, specUnlocked } from './rules';
import { beginQuarter, endQuarter, forecastCosts } from './sim';
import type { GameState } from './types';

/** Preferred (ethical, sensible) choice per event; falls back to the first enabled option. */
const PREF: Record<string, number> = {
  pal_shortcut: 1,
  exam_dumps: 1,
  licence_bend: 1,
  phishing: 0,
  verification: 0,
  verification_final: 0,
  investor: 1,
  raise: 0,
  office: 2,
  poach: 1,
  discount_logo: 0,
  fixed_price: 1,
  burnout: 0,
  lose_key: 0,
  staff_leave: 0,
  project_awry: 0,
  outage: 0,
  capacity: 0,
  downturn: 2,
  price_war: 1,
  bcdr: 0,
  pdm_pilot: 0,
};

function needsFor(s: GameState): { primary: AreaId; secondary: AreaId | null } {
  // Target: Security + an AI designation, and Modern Work skills for the Copilot spec.
  const her = s.focus.primary;
  const ai: AreaId = hasDesignation(s, 'dai') ? 'dai' : 'dataai';
  if (s.designations.length === 0) return { primary: her, secondary: her === 'security' ? 'dataai' : 'security' };
  if (!hasDesignation(s, 'security')) return { primary: 'security', secondary: hasDesignation(s, 'dataai') || hasDesignation(s, 'dai') || hasDesignation(s, 'bizapps') ? 'modern' : ai };
  if (!hasDesignation(s, 'dataai') && !hasDesignation(s, 'dai') && !hasDesignation(s, 'bizapps')) return { primary: ai, secondary: 'modern' };
  const copilotOk = hasSpec(s, 'copilot');
  const aiOk = hasSpec(s, 'aiplatform') || hasSpec(s, 'aiapps');
  if (!copilotOk) return { primary: 'modern', secondary: aiOk ? 'security' : 'dataai' };
  if (!aiOk) return { primary: 'dataai', secondary: 'security' };
  return { primary: 'security', secondary: 'modern' };
}

export function botPlan(s: GameState): void {
  const f = needsFor(s);
  // Protect a held designation that is slipping toward the renewal line.
  const weak = s.designations.map((d) => d.area).find((a) => pcs(s, a).total < 78);
  if (weak && weak !== f.primary) f.secondary = weak;
  s.focus = { primary: f.primary, secondary: f.secondary !== f.primary ? f.secondary : null };
  const rich = s.cash > 500;
  s.programmes = { skilling: rich ? 3 : 2, marketing: 2, cosell: s.designations.length > 0 ? 2 : 1, people: s.morale < 55 ? 2 : 1 };
  s.bet = s.turn === 0 ? 'growth' : s.designations.length < 2 ? 'skills' : 'align';
  if (s.benefits === 'none') buyBenefits(s, s.cash > 500 ? 'expanded' : 'core');
}

function tryAction(s: GameState, id: string, opt: string, area?: AreaId): boolean {
  if (s.ap < 1) return false;
  const a = ACTION[id];
  if (a.available(s)) return false;
  const o = a.options(s).find((x) => x.id === opt);
  if (!o || o.disabled) return false;
  performAction(s, id, opt, area);
  return true;
}

export function botQuarter(s: GameState): void {
  // Events
  let guard = 0;
  while (s.pending.length > 0 && guard++ < 10 && s.status === 'playing') {
    const pe = s.pending[0];
    const def = EVENT[pe.id];
    const choices = def.choices(s, pe.data);
    let idx = PREF[pe.id] ?? 0;
    if (idx >= choices.length || choices[idx].disabled) idx = choices.findIndex((c) => !c.disabled);
    if (pe.id === 'investor' && s.cash < 150) idx = 0;
    resolveEvent(s, pe, Math.max(0, idx));
  }
  if (s.status !== 'playing') return;

  // Designations
  for (const a of AREAS) if (canPurchaseDesignation(s, a)) purchaseDesignation(s, a);

  // Frontier audit
  if (frontierQualified(s) && s.cash > 80) scheduleFrontierAudit(s, s.cash > 200);

  // Specialization audits: Frontier-relevant first
  const order = ['datasec', 'iam', 'copilot', 'aiplatform', 'aiapps', ...SPECS.map((x) => x.id)];
  for (const id of order) {
    if (s.ap < 1 || s.cash < 60) break;
    const spec = SPEC[id];
    if (hasSpec(s, id) || spec.validation === 'auto') continue;
    if (specUnlocked(s, spec) && specQualified(s, spec)) scheduleAudit(s, id, s.cash > 300);
    if (s.specs.length + s.audits.length > 8) break;
  }

  // CSP early
  if (s.csp === 'none') tryAction(s, 'csp', 'indirect');

  // Calendar moments
  if (qOf(s.turn) === 2 && s.cash > 250) tryAction(s, 'ignite', s.cash > 900 ? 'booth' : 'delegation');
  if (qOf(s.turn) === 3 && s.designations.length > 0 && s.cash > 150) {
    const opts = ACTION.poty.options(s).filter((o) => !o.disabled);
    if (opts.length) tryAction(s, 'poty', opts.find((o) => o.id.startsWith('frontier'))?.id ?? opts[opts.length - 1].id);
  }

  // Frontier skilling once specs are coming
  const fSpecs = ['copilot', 'datasec', 'iam', 'aiplatform', 'aiapps'].filter((x) => hasSpec(s, x)).length;
  if (fSpecs >= 2 && s.fte < 5 && s.cash > 150) tryAction(s, 'frontier_skills', 'fte');
  if (fSpecs >= 2 && s.dp600 < 3 && s.cash > 150) tryAction(s, 'frontier_skills', 'dp600');

  // Offers in needed areas
  if (s.cash > 300 && s.offers.filter((o) => !o.published).length < 1) {
    const want = OFFERS.filter((o) => o.frontier && !s.offers.some((x) => x.id === o.id) && s.areas[o.area].inter >= 2);
    if (want.length) tryAction(s, 'offer', want[0].id);
  }

  // Skills where specialization requirements fall short
  const gapArea = (() => {
    for (const id of ['datasec', 'copilot', 'aiplatform']) {
      const spec = SPEC[id];
      const a = s.areas[spec.skill];
      if (!hasSpec(s, id) && (a.inter < spec.inter || a.adv < spec.adv)) return spec.skill;
    }
    return s.focus.primary;
  })();
  if (s.cash > 200) tryAction(s, 'bootcamp', s.cash > 600 ? 'int' : 'std', gapArea);
  if (s.coop >= 8) tryAction(s, 'coop', s.coop >= 20 ? 'roadshow' : 'webinar', s.focus.primary);
  if (s.csp !== 'none' || s.designations.length > 0) tryAction(s, 'incentives', 'claim', s.focus.primary);
  if (!s.unified && s.cash > 700) tryAction(s, 'unified', 'sub');
  tryAction(s, 'cosell', 'push');

  // Staffing: keep utilisation below ~95%
  const util = s.lastReport?.utilisation ?? 0.9;
  if (util > 0.95 && s.cash > 120) hireStaff(s, 'tech', Math.ceil((util - 0.88) * s.tech));
  void forecastCosts;
  const neededSales = Math.ceil((s.lastReport ? Object.values(s.lastReport.wins).reduce((a, b) => a + (b ?? 0), 0) : 4) / 3);
  if (s.sales < neededSales + 1 && s.cash > 150) hireStaff(s, 'sales', 1);

  // Cash safety
  if (s.cash < 60) borrow(s, 150);
  if (s.cash < 120) s.programmes.skilling = Math.min(s.programmes.skilling, 1);
}

/** Play an entire game with the bot. Returns the final state. */
export function botGame(s: GameState): GameState {
  for (let guard = 0; guard < 30 && s.status === 'playing'; guard++) {
    if (qOf(s.turn) === 1) botPlan(s);
    beginQuarter(s);
    botQuarter(s);
    if (s.status !== 'playing') break;
    endQuarter(s);
  }
  return s;
}

export function describe(s: GameState): string {
  return `${s.status}/${s.endKind} turn=${s.turn} cash=${Math.round(s.cash)} debt=${Math.round(s.debt)} des=${s.designations.map((d) => AREA[d.area].short).join(',')} specs=${s.specs.map((x) => x.id).join(',')} fte=${s.fte} dp=${s.dp600} tech=${s.tech} cust=${AREAS.reduce((n, a) => n + s.areas[a].customers, 0)}+${s.key.length} pcs=${AREAS.map((a) => pcs(s, a).total).join('/')}`;
}
