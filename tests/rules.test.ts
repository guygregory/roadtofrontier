import { describe, it, expect } from 'vitest';
import { newGame, migrateState } from '../src/game/state';
import { AREAS, AREA, areaList, areaName, AZURE_ZERO, OFFERS, PDM_CHANGE_REASONS, PDMS, PS_FEE, SPEC, SPECS, FRONTIER } from '../src/game/data';
import { pcs, canPurchaseDesignation, specRequirements, specQualified, specUnlocked, frontierQualified, frontierRequirements, apMax, azureAllowance, cspBilled, cspMargin, distributorShare, unifiedPrice } from '../src/game/rules';
import { clearLegacySaves, decodeSave, encodeSave, legacySave, saveFileName } from '../src/game/save';
import { shareIntentUrl, shareMessage } from '../src/game/share';
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
  cancelUnified,
} from '../src/game/actions';
import { advisor, advisorKind, assignFirstPdm, currentPdm, rotatePdm } from '../src/game/advisor';
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
    expect(s.cash).toBe(cash); // no sign-up fee: the distributor takes a 5% margin share instead
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
    expect(actionBlocked(s, csp)).toMatch(/Direct Bill needs/);
    expect(csp.options(s).map((o) => o.id)).toEqual(['direct']);
    expect(performAction(s, 'csp', 'indirect')).toMatch(/\{r\}/);
    maxArea(s, 'modern');
    purchaseDesignation(s, 'modern');
    expect(actionBlocked(s, csp)).toMatch(/\$1M CSP rev/);
    // $1M of CSP billings over the last four quarters
    s.history = [0, 1, 2, 3].map((turn) => ({ turn, cash: 0, revenue: 0, profit: 0, customers: 0, staff: 0, pcs: s.history[0]?.pcs ?? ({} as never), cloud: 260, cloudAzure: 0 }));
    expect(actionBlocked(s, csp)).toMatch(/Unified for Partners/);
    performAction(s, 'unified', 'sub');
    expect(actionBlocked(s, csp)).toBeNull();
    expect(actionTitle(s, csp)).toBe('CSP Direct Bill');
    performAction(s, 'csp', 'direct');
    expect(s.csp).toBe('direct');
    expect(actionBlocked(s, csp)).toMatch(/Direct Bill partner/);
    expect(cancelUnified(s)).toMatch(/must keep/);
    expect(s.unified).toBe(true);
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

describe('.sav files', () => {
  it('round-trips the game state', () => {
    const s = fresh();
    beginQuarter(s);
    const file = encodeSave(s);
    expect(file.startsWith('RTFSAV1:')).toBe(true);
    expect(file).not.toContain('Test Co'); // not readable as plain JSON
    expect(decodeSave(file)).toEqual(JSON.parse(JSON.stringify(s)));
  });
  it('rejects edited, damaged or foreign files', () => {
    const file = encodeSave(fresh());
    const body = file.slice(8);
    const i = Math.floor(body.length / 2);
    const flipped = body[i] === 'A' ? 'B' : 'A';
    expect(() => decodeSave('RTFSAV1:' + body.slice(0, i) + flipped + body.slice(i + 1))).toThrow(/modified|damaged/);
    expect(() => decodeSave('{"company":"x"}')).toThrow(/not a ROAD TO FRONTIER save/);
    expect(() => decodeSave('RTFSAV1:!!!')).toThrow(/damaged/);
  });
  it('names files frontier-YYYY-MM-DD.sav', () => {
    expect(saveFileName(new Date(2026, 9, 25))).toBe('frontier-2026-10-25.sav');
    expect(saveFileName(new Date(2027, 0, 5))).toBe('frontier-2027-01-05.sav');
  });
  it('offers the newest unfinished browser save from older versions once', () => {
    const store = new Map<string, string>();
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    };
    try {
      expect(legacySave()).toBeNull();
      const a = fresh();
      a.company = 'Older Co';
      const b = fresh();
      b.company = 'Newer Co';
      b.turn = 5;
      const done = fresh();
      done.status = 'lost';
      store.set('rtf_save_auto', JSON.stringify({ meta: { savedAt: '2026-01-02T00:00:00Z' }, state: a }));
      store.set('rtf_save_2', JSON.stringify({ meta: { savedAt: '2026-03-04T00:00:00Z' }, state: b }));
      store.set('rtf_save_3', JSON.stringify({ meta: { savedAt: '2026-09-09T00:00:00Z' }, state: done }));
      store.set('rtf_save_1', '{broken');
      store.set('rtf_settings', '{}');
      expect(legacySave()?.company).toBe('Newer Co');
      clearLegacySaves();
      expect(legacySave()).toBeNull();
      expect([...store.keys()]).toEqual(['rtf_settings']);
    } finally {
      delete (globalThis as { localStorage?: unknown }).localStorage;
    }
  });
});

describe('sharing', () => {
  it('pre-writes a post with the score, company, outcome, difficulty, link and hashtag', () => {
    const s = fresh();
    s.status = 'won';
    s.endKind = 'frontier';
    s.flags.endTurn = 13;
    s.difficulty = 'hard';
    const msg = shareMessage(s, 23450);
    expect(msg).toContain('Test Co');
    expect(msg).toContain('Frontier Partner');
    expect(msg).toContain('23450');
    expect(msg).toContain('Hard difficulty');
    expect(msg).toContain('https://aka.ms/roadtofrontier');
    expect(msg).toContain('#roadtofrontier');
    expect([...msg].length).toBeLessThan(280);
    s.status = 'lost';
    s.endKind = 'bankrupt';
    expect(shareMessage(s, 900)).toMatch(/ran out of cash/);
    expect(shareIntentUrl('x', msg)).toBe('https://x.com/intent/post?text=' + encodeURIComponent(msg));
    expect(shareIntentUrl('linkedin', msg)).toContain('linkedin.com');
    expect(decodeURIComponent(shareIntentUrl('linkedin', msg).split('text=')[1])).toBe(msg);
  });
});

describe('CSP economics and Unified for Partners', () => {
  const t12 = (s: GameState, total: number, azure: number) => {
    s.history = [0, 1, 2, 3].map((turn) => ({ turn, cash: 0, revenue: 0, profit: 0, customers: 0, staff: 0, pcs: {} as never, cloud: total / 4, cloudAzure: azure / 4 }));
  };
  it('shares 5% of billed CSP spend with the distributor for Indirect Resellers only', () => {
    const s = fresh();
    s.areas.modern.customers = 50;
    expect(cspBilled(s).total).toBe(0);
    s.csp = 'indirect';
    const billed = cspBilled(s).total;
    expect(billed).toBeGreaterThan(0);
    expect(distributorShare(s)).toBeCloseTo(billed * 0.05, 1);
    expect(cspMargin(s)).toBeCloseTo(billed * 0.1, 1);
    s.csp = 'direct';
    expect(distributorShare(s)).toBe(0);
    expect(cspMargin(s)).toBeCloseTo(cspBilled(s).total * 0.2, 5);
  });
  it('records billed CSP revenue in the quarter history', () => {
    const s = fresh();
    s.csp = 'indirect';
    beginQuarter(s);
    endQuarter(s);
    expect(s.history[s.history.length - 1].cloud).toBeGreaterThan(0);
  });
  it('prices Unified at a $5K/month floor, then a % of trailing-12-month CSP revenue', () => {
    const s = fresh();
    expect(unifiedPrice(s).quarterly).toBe(15);
    t12(s, 1200, 600); // $1.2M: Category A, 4% Azure + 3% other = $42K/yr -> floor
    expect(unifiedPrice(s).quarterly).toBe(15);
    expect(unifiedPrice(s).cat).toBe('A');
    t12(s, 4000, 2000); // 4% x 2000 + 3% x 2000 = $140K/yr
    expect(unifiedPrice(s).quarterly).toBe(35);
    t12(s, 60000, 60000); // Category B: 3% Azure
    expect(unifiedPrice(s).cat).toBe('B');
    expect(unifiedPrice(s).annual).toBeCloseTo(1800);
    t12(s, 200000, 0); // Category C: 1.5% non-Azure
    expect(unifiedPrice(s).annual).toBeCloseTo(3000);
    t12(s, 600000, 300000); // Category D: 1.5% / 1%
    expect(unifiedPrice(s).cat).toBe('D');
    expect(unifiedPrice(s).annual).toBeCloseTo(7500);
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
describe('Partner Development Managers', () => {
  const managed = (): GameState => {
    const s = fresh();
    s.mpl = true;
    s.flags.mplSince = 4;
    assignFirstPdm(s, 4);
    return s;
  };
  it('Alex is your first PDM when you join the Managed Partner List', () => {
    const s = managed();
    expect(currentPdm(s).name).toBe('Alex');
    expect(advisor(s).title).toBe('ALEX, YOUR PDM');
    expect(advisor(s).sprite).toBe('pdm:alex');
    expect([12, 16, 20]).toContain(s.flags.pdmNext);
  });
  it('the PDM changes every 2-4 years at the start of an FY, for one of three reasons, to someone new', () => {
    const s = managed();
    const changes: number[] = [];
    const seen = new Set([s.flags.pdm]);
    for (let fyStart = 8; fyStart <= 124; fyStart += 4) {
      const prev = s.flags.pdm ?? 0;
      const notice = rotatePdm(s, fyStart);
      if (!notice) continue;
      changes.push(fyStart);
      expect(s.flags.pdm).not.toBe(prev);
      expect(notice).toContain(PDMS[prev].name);
      expect(notice).toContain(`${currentPdm(s).name} looks after you from FY${27 + fyStart / 4}`);
      expect(PDM_CHANGE_REASONS.some((r) => notice.includes(r))).toBe(true);
      expect(s.flags.pdmSince).toBe(fyStart);
      seen.add(s.flags.pdm);
    }
    changes.forEach((c, i) => expect([8, 12, 16]).toContain(c - (i ? changes[i - 1] : 4)));
    expect(changes.length).toBeGreaterThanOrEqual(7);
    expect(seen.size).toBe(PDMS.length); // everyone takes a turn before anyone comes back
  });
  it('a PDM who left Microsoft never comes back', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const s = managed();
      s.rng = seed;
      const left = new Set<number>();
      for (let fyStart = 8; fyStart <= 400; fyStart += 4) {
        const prev = s.flags.pdm ?? 0;
        if (!rotatePdm(s, fyStart)) continue;
        if (left.size < PDMS.length - 1) expect(left.has(s.flags.pdm ?? 0)).toBe(false);
        if (s.flags.pdmReason === 0) left.add(prev);
      }
    }
  });
  it('only managed partners have a PDM', () => {
    const s = fresh();
    expect(rotatePdm(s, 8)).toBeNull();
    expect(s.flags.pdm).toBeUndefined();
  });
  it('a new PDM makes no difference to the business', () => {
    const s = managed();
    s.flags.pdmNext = 8;
    const strip = (x: GameState) => JSON.stringify({ ...x, flags: undefined, rng: undefined });
    const before = strip(s);
    expect(rotatePdm(s, 8)).toBeTruthy();
    expect(strip(s)).toBe(before);
  });
  it('the change is announced in the year-end review', () => {
    const s = managed();
    s.flags.pdmNext = 8;
    s.turn = 7;
    beginQuarter(s);
    s.pending = [];
    s.cash = 5000;
    endQuarter(s);
    expect(s.yearEnd?.notices.join(' ')).toMatch(/New PDM:.*Alex/);
    expect(currentPdm(s).name).not.toBe('Alex');
    expect(s.flags.pdmSince).toBe(8);
  });
  it('saves from before PDMs rotated start the clock at the next FY', () => {
    const s = fresh();
    s.mpl = true;
    expect(rotatePdm(s, 8)).toBeNull();
    expect([16, 20, 24]).toContain(s.flags.pdmNext);
    expect(currentPdm(s).name).toBe('Alex');
  });
});

describe('area names', () => {
  it('uses full names where they fit and MW only where space is very tight', () => {
    expect(areaName('modern')).toBe('Modern Work');
    expect(areaName('modern', 11)).toBe('Modern Work');
    expect(areaName('modern', 10)).toBe('MW');
    expect(areaName('dai', 20)).toBe('Digital & App Innov.');
    expect(areaList(['modern', 'security'])).toBe('Modern Work or Security');
    expect(areaList(['bizapps', 'dai', 'modern'], 30)).toBe('BIZAPPS, DAI or MW');
  });
  it('designation notices use the full name', () => {
    const s = fresh();
    maxArea(s, 'modern');
    purchaseDesignation(s, 'modern');
    s.turn = 4;
    beginQuarter(s);
    s.pending = [];
    s.cash = 5000;
    maxArea(s, 'modern');
    const r = endQuarter(s);
    expect(r.notices.join(' ')).toContain('Solutions Partner for Modern Work renewed');
  });
});
