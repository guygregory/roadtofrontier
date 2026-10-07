import { describe, it, expect } from 'vitest';
import { newGame, migrateState } from '../src/game/state';
import { AREAS, AREA, AZURE_ZERO, OFFERS, PS_FEE, SPEC, SPECS, FRONTIER } from '../src/game/data';
import { pcs, canPurchaseDesignation, specRequirements, specQualified, specUnlocked, frontierQualified, frontierRequirements, apMax, azureAllowance } from '../src/game/rules';
import { beginQuarter, endQuarter, licenceRelief } from '../src/game/sim';
import {
  ACTION,
  actionBlocked,
  actionTitle,
  performAction,
  purchaseDesignation,
  scheduleAudit,
  hireStaff,
  fireStaff,
  borrow,
  repay,
  buyBenefits,
  setBenefitsRenewal,
} from '../src/game/actions';
import { advisorKind } from '../src/game/advisor';
import { EVENTS, EVENT, resolveEvent } from '../src/game/events';
import { monthsLabel, turnLabel, money } from '../src/game/format';
import { removeTech, certGain } from '../src/game/ops';
import type { GameState } from '../src/game/types';

const fresh = (heritage = 'mw', seed = 7): GameState => newGame({ company: 'Test Co', heritage, difficulty: 'normal', seed });

function maxArea(s: GameState, a: (typeof AREAS)[number]): void {
  const th = AREA[a].th;
  const ar = s.areas[a];
  ar.adds = [th.adds, 0, 0, 0];
  ar.usage = [th.usage, 0, 0, 0];
  ar.deploys = [th.deploys, 0, 0, 0];
  s.tech = Math.max(s.tech, th.inter + 2);
  ar.inter = th.inter;
  ar.adv = th.adv;
}

describe('dates and formatting', () => {
  it('maps turns to Microsoft fiscal quarters', () => {
    expect(turnLabel(0)).toBe('FY27 Q1');
    expect(monthsLabel(0)).toBe('JUL-SEP 2026');
    expect(monthsLabel(2)).toBe('JAN-MAR 2027');
    expect(turnLabel(19)).toBe('FY31 Q4');
    expect(monthsLabel(19)).toBe('APR-JUN 2031');
    expect(turnLabel(20)).toBe('FY32 Q1');
    expect(monthsLabel(20)).toBe('JUL-SEP 2031');
  });
  it('formats money in $K and $M', () => {
    expect(money(600)).toBe('$600K');
    expect(money(1250)).toBe('$1.25M');
    expect(money(-45)).toBe('-$45K');
  });
});

describe('new game', () => {
  it('starts as a Network member with a head start in the heritage area', () => {
    const s = fresh('sec');
    expect(s.designations).toHaveLength(0);
    expect(s.cash).toBe(600);
    const heritage = pcs(s, 'security').total;
    for (const a of AREAS) if (a !== 'security') expect(pcs(s, a).total).toBeLessThan(heritage);
    expect(heritage).toBeGreaterThan(30);
    expect(heritage).toBeLessThan(70);
  });
  it('is deterministic for a seed', () => {
    expect(JSON.stringify(fresh('mw', 99))).toBe(JSON.stringify(fresh('mw', 99)));
  });
});

describe('Partner Capability Score', () => {
  it('scores 100 when every threshold is met', () => {
    const s = fresh();
    maxArea(s, 'dataai');
    const p = pcs(s, 'dataai');
    expect(p.total).toBe(100);
    expect(p.qualified).toBe(true);
  });
  it('requires points in every metric, not just 70 total', () => {
    const s = fresh();
    maxArea(s, 'dataai');
    s.areas.dataai.adv = 0; // 85 points but zero in advanced certs
    const p = pcs(s, 'dataai');
    expect(p.total).toBeGreaterThanOrEqual(70);
    expect(p.qualified).toBe(false);
  });
  it('lets you purchase a designation once qualified, unlocking aligned specializations', () => {
    const s = fresh();
    maxArea(s, 'security');
    expect(canPurchaseDesignation(s, 'security')).toBe(true);
    expect(specUnlocked(s, SPEC.datasec)).toBe(false);
    purchaseDesignation(s, 'security');
    expect(s.designations.map((d) => d.area)).toContain('security');
    expect(specUnlocked(s, SPEC.datasec)).toBe(true);
    expect(specUnlocked(s, SPEC.copilot)).toBe(true); // Copilot aligns with Modern Work OR Security
    expect(specUnlocked(s, SPEC.aiplatform)).toBe(false);
  });
});

describe('specializations', () => {
  it('every specialization is aligned to at least one designation and its skill area exists', () => {
    for (const sp of SPECS) {
      expect(sp.aligned.length).toBeGreaterThan(0);
      expect(AREA[sp.skill]).toBeDefined();
    }
  });
  it('lists unmet requirements and qualifies when they are met', () => {
    const s = fresh();
    const spec = SPEC.iam;
    expect(specQualified(s, spec)).toBe(false);
    maxArea(s, 'security');
    purchaseDesignation(s, 'security');
    const a = s.areas.security;
    s.tech = 30;
    a.inter = spec.inter;
    a.adv = spec.adv;
    a.deploys = [spec.deploys, 0, 0, 0];
    a.customers = spec.customers ?? 0;
    expect(specRequirements(s, spec).every((r) => r.ok)).toBe(true);
    expect(scheduleAudit(s, 'iam', false)).toMatch(/audit/i);
    expect(s.audits).toHaveLength(1);
  });
});

describe('Frontier Partner', () => {
  it('needs Copilot, Data Security, IAM, an AI spec and Frontier skilling', () => {
    const s = fresh();
    expect(frontierQualified(s)).toBe(false);
    s.specs = ['copilot', 'datasec', 'iam', 'aiplatform'].map((id) => ({ id, since: 0, renewAt: 4, renewals: 0 }));
    s.tech = 20;
    s.fte = FRONTIER.fte;
    s.dp600 = FRONTIER.dp600 - 1;
    expect(frontierRequirements(s).filter((r) => !r.ok)).toHaveLength(1);
    s.dp600 = FRONTIER.dp600;
    expect(frontierQualified(s)).toBe(true);
  });
  it('a passed Frontier audit wins the game', () => {
    const s = fresh();
    beginQuarter(s);
    s.pending = [];
    s.audits.push({ kind: 'frontier', chance: 1 });
    endQuarter(s);
    expect(s.status).toBe('won');
    expect(s.endKind).toBe('frontier');
  });
});

describe('quarter simulation', () => {
  it('runs a whole quarter, advances time and records history', () => {
    const s = fresh();
    beginQuarter(s);
    expect(s.ap).toBe(apMax(s));
    s.pending = [];
    const r = endQuarter(s);
    expect(s.turn).toBe(1);
    expect(s.history).toHaveLength(1);
    expect(r.revenue.total).toBeGreaterThan(0);
    expect(r.costs.total).toBeGreaterThan(0);
  });
  it('goes bankrupt after two quarters with negative cash and no credit', () => {
    const s = fresh();
    for (let i = 0; i < 2; i++) {
      beginQuarter(s);
      s.pending = [];
      s.cash = -5000;
      s.debt = 100000; // credit line exhausted
      endQuarter(s);
    }
    expect(s.status).toBe('lost');
    expect(s.endKind).toBe('bankrupt');
    expect(s.flags.endTurn).toBe(1);
    expect(s.turn).toBe(2);
  });
  it('removes membership at year end when compliance collapses', () => {
    const s = fresh();
    s.turn = 3;
    beginQuarter(s);
    s.pending = [];
    s.compliance = 5;
    endQuarter(s);
    expect(s.status).toBe('lost');
    expect(s.endKind).toBe('removed');
  });
  it('keeps playing past FY31: there is no time limit', () => {
    const s = fresh();
    s.turn = 19;
    for (let i = 0; i < 6; i++) {
      beginQuarter(s);
      s.pending = [];
      s.cash = 5000;
      endQuarter(s);
    }
    expect(s.status).toBe('playing');
    expect(s.turn).toBe(25);
    expect(turnLabel(s.turn)).toBe('FY33 Q2');
  });
  it('expires unused co-op funds at year end', () => {
    const s = fresh();
    s.turn = 3;
    beginQuarter(s);
    s.pending = [];
    s.coop = 50;
    s.csp = 'indirect';
    endQuarter(s);
    expect(s.coop).toBe(0);
    expect(s.yearEnd?.coopExpired).toBeGreaterThan(0);
  });
});

describe('actions', () => {
  it('spends action points and cash', () => {
    const s = fresh();
    beginQuarter(s);
    const ap = s.ap;
    const cash = s.cash;
    const res = performAction(s, 'csp', 'indirect');
    expect(res).toMatch(/CSP/);
    expect(s.csp).toBe('indirect');
    expect(s.ap).toBe(ap - 1);
    expect(s.cash).toBe(cash - 10);
  });
  it('refuses actions when out of action points', () => {
    const s = fresh();
    beginQuarter(s);
    s.ap = 0;
    expect(performAction(s, 'csp', 'indirect')).toMatch(/No action points/);
    expect(s.csp).toBe('none');
  });
  it('gates calendar events to the right quarter', () => {
    const s = fresh();
    beginQuarter(s); // Q1
    expect(performAction(s, 'ignite', 'delegation')).toMatch(/November/);
  });
  it('hires within the recruiting limit and fires with severance', () => {
    const s = fresh();
    beginQuarter(s);
    const t = s.tech;
    hireStaff(s, 'tech', 50);
    expect(s.tech).toBeGreaterThan(t);
    expect(s.tech - t).toBeLessThanOrEqual(6);
    const t2 = s.tech;
    fireStaff(s, 'tech', 1);
    expect(s.tech).toBe(t2 - 1);
  });
  it('borrows within the credit limit and repays', () => {
    const s = fresh();
    borrow(s, 100);
    expect(s.debt).toBe(100);
    repay(s, 100);
    expect(s.debt).toBe(0);
  });
});

describe('people and certifications', () => {
  it('certifications leave with the people who hold them', () => {
    const s = fresh();
    s.tech = 10;
    s.areas.security.inter = 5;
    s.areas.security.adv = 3;
    const lost = removeTech(s, 2, 'security');
    expect(lost.adv).toBe(2);
    expect(s.areas.security.adv).toBe(1);
    expect(s.areas.security.inter).toBe(3);
    expect(s.tech).toBe(8);
  });
  it('skilling points buy intermediate (2) and advanced (4) certifications', () => {
    const s = fresh();
    s.tech = 20;
    s.areas.dataai.inter = 0;
    s.areas.dataai.adv = 0;
    s.areas.dataai.certProgress = 0;
    const g = certGain(s, 'dataai', 8);
    expect(g.inter * 2 + g.adv * 4).toBe(8);
  });
});

describe('events', () => {
  it('every event resolves without throwing for every choice', () => {
    for (const ev of EVENTS) {
      for (let choice = 0; choice < 4; choice++) {
        const s = fresh('mw', 1234 + choice);
        s.turn = 4;
        s.unified = true;
        s.designations.push({ area: 'modern', since: 0, renewAt: 4 });
        s.areas.security.inter = 3;
        s.offers.push({ id: 'agentfactory', progress: 3, required: 3, published: true, age: 1 });
        const data = ev.prepare ? ev.prepare(s) : ev.kind === 'followup' ? { area: 'security', n: 2, name: 'Contoso', p: 0.5, keyId: s.key[0]?.id } : {};
        if (data === null) continue;
        const pe = { id: ev.id, data: data ?? {} };
        s.pending = [pe];
        const choices = ev.choices(s, pe.data);
        if (choice >= choices.length || choices[choice].disabled) continue;
        expect(() => resolveEvent(s, pe, choice)).not.toThrow();
        expect(Number.isFinite(s.cash)).toBe(true);
      }
    }
    expect(Object.keys(EVENT).length).toBe(EVENTS.length);
  });
  it('ignoring verification twice removes your membership', () => {
    const s = fresh();
    const pe = { id: 'verification_final', data: {} };
    s.pending = [pe];
    resolveEvent(s, pe, 1);
    expect(s.status).toBe('lost');
    expect(s.endKind).toBe('removed');
  });
});

describe('CSP enrolment', () => {
  it('is not offered again once you are an Indirect Reseller, until Direct Bill is possible', () => {
    const s = fresh();
    beginQuarter(s);
    const csp = ACTION.csp;
    expect(actionBlocked(s, csp)).toBeNull();
    expect(actionTitle(s, csp)).toBe('Join CSP');
    performAction(s, 'csp', 'indirect');
    expect(s.csp).toBe('indirect');
    s.ap = 3;
    expect(actionBlocked(s, csp)).toMatch(/Already Indirect/);
    expect(csp.options(s).map((o) => o.id)).toEqual(['direct']);
    expect(performAction(s, 'csp', 'indirect')).toMatch(/\{r\}/);
    maxArea(s, 'modern');
    purchaseDesignation(s, 'modern');
    expect(actionBlocked(s, csp)).toMatch(/60\+ customers/);
    s.areas.modern.customers = 80;
    expect(actionBlocked(s, csp)).toBeNull();
    expect(actionTitle(s, csp)).toBe('CSP Direct Bill');
    performAction(s, 'csp', 'direct');
    expect(s.csp).toBe('direct');
    expect(actionBlocked(s, csp)).toMatch(/Direct Bill partner/);
  });
  it('blocks any action whose options are all disabled', () => {
    const s = fresh();
    beginQuarter(s);
    s.offers = OFFERS.map((o) => ({ id: o.id, progress: 9, required: 1, published: true, age: 1 }));
    expect(actionBlocked(s, ACTION.offer)).toBeTruthy();
    expect(performAction(s, 'offer', OFFERS[0].id)).toMatch(/\{r\}/);
  });
});

describe('advisors and the Managed Partner List', () => {
  it('MAICPP emails before CSP, the distributor account manager after, a PDM only on the MPL', () => {
    const s = fresh();
    expect(advisorKind(s)).toBe('program');
    s.csp = 'indirect';
    expect(advisorKind(s)).toBe('distributor');
    s.mpl = true;
    expect(advisorKind(s)).toBe('pdm');
  });
  it('direct bill partners without a PDM hear from the programme by email', () => {
    const s = fresh();
    s.csp = 'direct';
    expect(advisorKind(s)).toBe('program');
  });
  it('joins the MPL at the start of the FY after the second specialization', () => {
    const s = fresh();
    s.csp = 'indirect';
    s.turn = 1; // FY27 Q2
    beginQuarter(s);
    s.pending = [];
    maxArea(s, 'security');
    purchaseDesignation(s, 'security');
    s.specs = [{ id: 'datasec', since: 0, renewAt: 4, renewals: 0 }];
    s.audits.push({ kind: 'spec', spec: 'iam', chance: 1 });
    endQuarter(s);
    expect(s.specs).toHaveLength(2);
    expect(s.flags.secondSpec).toBe(1);
    expect(s.mpl).toBe(false);
    expect(advisorKind(s)).toBe('distributor');
    for (let i = 0; i < 2; i++) {
      beginQuarter(s);
      s.pending = [];
      s.cash = 5000;
      expect(s.mpl).toBe(false);
      endQuarter(s);
    }
    expect(s.turn).toBe(4);
    expect(s.mpl).toBe(true);
    expect(s.flags.mplSince).toBe(4);
    expect(advisorKind(s)).toBe('pdm');
    expect(s.yearEnd?.notices.join(' ')).toMatch(/Managed Partner List/);
  });
  it('only managed partners meet their PDM; the distributor and programme have their own events', () => {
    const s = fresh();
    const w = (id: string) => EVENT[id].weight!(s);
    expect(w('pdm_pilot')).toBe(0);
    expect(w('maicpp_email')).toBeGreaterThan(0);
    expect(w('disti_offer')).toBe(0);
    s.csp = 'indirect';
    expect(w('disti_offer')).toBeGreaterThan(0);
    expect(w('maicpp_email')).toBe(0);
    s.mpl = true;
    expect(w('pdm_pilot')).toBeGreaterThan(0);
    expect(w('disti_offer')).toBe(0);
  });
});

describe('Azure credits and Customer Zero for Azure', () => {
  const spec = (id: string) => ({ id, since: 0, renewAt: 4, renewals: 0 });
  it('adds up yearly credits from Partner Success, designations and capped specializations', () => {
    const s = fresh();
    expect(azureAllowance(s).total).toBe(0);
    s.benefits = 'expanded';
    expect(azureAllowance(s).total).toBe(5);
    s.designations = [
      { area: 'security', since: 0, renewAt: 4 },
      { area: 'modern', since: 0, renewAt: 4 },
    ];
    expect(azureAllowance(s).designations).toBe(14);
    s.specs = ['datasec', 'iam', 'cloudsec', 'threat'].map(spec);
    expect(azureAllowance(s).specs).toBe(30); // Security category capped at 3
    s.specs.push(spec('aiplatform'), spec('copilot'));
    expect(azureAllowance(s).specs).toBe(50);
    expect(azureAllowance(s).total).toBe(69);
  });
  it('specialization credits need Solutions Partner benefits', () => {
    const s = fresh();
    s.specs = [spec('datasec')];
    expect(azureAllowance(s).specs).toBe(0);
  });
  it('new benefits grant credits at once; unused credits expire on 30 June and the year is re-granted on 1 July', () => {
    const s = fresh();
    buyBenefits(s, 'core');
    expect(s.azureCredits).toBe(2.4);
    maxArea(s, 'infra');
    purchaseDesignation(s, 'infra');
    expect(s.azureCredits).toBe(12.4);
    s.turn = 3;
    beginQuarter(s);
    s.pending = [];
    s.cash = 5000;
    endQuarter(s);
    expect(s.azureCredits).toBe(0);
    expect(s.yearEnd?.azureExpired).toBe(12.4);
    beginQuarter(s); // FY28 Q1
    expect(s.azureCredits).toBe(12.4);
  });
  it('earning a specialization adds its credits straight away', () => {
    const s = fresh();
    beginQuarter(s);
    s.pending = [];
    s.designations = [{ area: 'security', since: 0, renewAt: 4 }];
    s.audits.push({ kind: 'spec', spec: 'datasec', chance: 1 });
    const before = s.azureCredits;
    endQuarter(s);
    expect(s.azureCredits).toBe(before + 10);
  });
  it('benefits earned as Q4 closes bring their credits on 1 July instead of expiring at once', () => {
    const s = fresh();
    s.turn = 3;
    beginQuarter(s);
    s.pending = [];
    s.cash = 5000;
    s.designations = [{ area: 'security', since: 0, renewAt: 8 }];
    s.audits.push({ kind: 'spec', spec: 'datasec', chance: 1 });
    const r = endQuarter(s);
    expect(r.notices.join(' ')).toMatch(/from 1 July/);
    expect(s.yearEnd?.azureExpired ?? 0).toBe(0);
    beginQuarter(s); // FY28 Q1
    expect(s.azureCredits).toBe(20); // Security designation + Data Security specialization
  });
  it('Customer Zero for Azure uses credits first, topped up with cash, then runs on credits', () => {
    const s = fresh();
    beginQuarter(s);
    s.pending = [];
    s.azureCredits = 12;
    const cash = s.cash;
    const prod = s.productivity;
    expect(performAction(s, 'azure_zero', 'credits')).toMatch(/Azure/);
    expect(s.azureCredits).toBe(0);
    expect(s.cash).toBeCloseTo(cash - (AZURE_ZERO.cost - 12));
    expect(s.productivity).toBeCloseTo(prod + AZURE_ZERO.productivity);
    expect(s.flags.azureZero).toBe(1);
    expect(actionBlocked(s, ACTION.azure_zero)).toMatch(/Already/);
    s.azureCredits = 3;
    const r = endQuarter(s);
    expect(r.azureUsed).toBe(AZURE_ZERO.runCost);
    expect(s.azureCredits).toBe(3 - AZURE_ZERO.runCost);
  });
  it('can always be paid in cash; the credits option needs credits', () => {
    const s = fresh();
    beginQuarter(s);
    expect(ACTION.azure_zero.options(s).find((o) => o.id === 'credits')?.disabled).toBeTruthy();
    const cash = s.cash;
    performAction(s, 'azure_zero', 'cash');
    expect(s.cash).toBe(cash - AZURE_ZERO.cost);
    expect(s.flags.azureZero).toBe(1);
  });
});

describe('Partner Success benefits', () => {
  it('can only stop renewing once you hold a Solutions Partner designation', () => {
    const s = fresh();
    buyBenefits(s, 'expanded');
    expect(setBenefitsRenewal(s, false)).toMatch(/\{r\}/);
    expect(s.benefitsRenew).toBe(true);
    maxArea(s, 'modern');
    purchaseDesignation(s, 'modern');
    expect(setBenefitsRenewal(s, false)).not.toMatch(/\{r\}/);
    expect(s.benefitsRenew).toBe(false);
  });
  it('renews and charges on 1 July, or lapses for free if switched off', () => {
    const s = fresh();
    buyBenefits(s, 'core');
    s.turn = 4;
    const cash = s.cash;
    beginQuarter(s);
    expect(s.benefits).toBe('core');
    expect(s.cash).toBe(cash - PS_FEE.core);
    expect(s.flags.psPaidFY).toBe(28);
    maxArea(s, 'security');
    purchaseDesignation(s, 'security');
    setBenefitsRenewal(s, false);
    s.turn = 8;
    const cash2 = s.cash;
    beginQuarter(s);
    expect(s.benefits).toBe('none');
    expect(s.cash).toBe(cash2);
    expect(s.azureCredits).toBe(10);
  });
  it('is not charged twice when bought during the FY plan', () => {
    const s = fresh();
    buyBenefits(s, 'expanded');
    const cash = s.cash;
    beginQuarter(s);
    expect(s.cash).toBe(cash);
    expect(s.azureCredits).toBe(5);
  });
  it('Solutions Partner licences supersede Partner Success instead of stacking', () => {
    const s = fresh();
    s.benefits = 'expanded';
    expect(licenceRelief(s)).toBe(8);
    s.designations = [{ area: 'modern', since: 0, renewAt: 4 }];
    expect(licenceRelief(s)).toBe(10);
    s.benefits = 'none';
    expect(licenceRelief(s)).toBe(10);
  });
});

describe('saves', () => {
  const oldSave = (turn: number, specSince: number[]): GameState => {
    const s = fresh() as unknown as Record<string, unknown> & GameState;
    delete (s as Partial<GameState>).mpl;
    delete (s as Partial<GameState>).benefitsRenew;
    delete (s as Partial<GameState>).azureCredits;
    s.benefits = 'core';
    s.turn = turn;
    s.specs = specSince.map((since, i) => ({ id: ['datasec', 'iam', 'cloudsec'][i], since, renewAt: since + 4, renewals: 0 }));
    return migrateState(s);
  };
  it('migrates games saved before the latest changes', () => {
    const m = oldSave(6, [4, 5]);
    expect(m.mpl).toBe(false);
    expect(m.benefitsRenew).toBe(true);
    expect(m.azureCredits).toBe(2.4); // this year's Partner Success Core credits
    expect(m.flags.psPaidFY).toBe(28);
    expect(m.flags.secondSpec).toBe(5); // second specialization this FY: MPL from FY29
  });
  it('puts old saves on the MPL from the FY after their second specialization', () => {
    const m = oldSave(6, [1, 0, 5]); // second specialization earned in FY27
    expect(m.flags.secondSpec).toBe(1);
    expect(m.mpl).toBe(true);
    expect(m.flags.mplSince).toBe(4);
    const q4 = oldSave(4, [2, 3]); // earned in FY27 Q4, saved at the FY28 plan
    expect(q4.mpl).toBe(true);
    expect(q4.flags.mplSince).toBe(4);
  });
});