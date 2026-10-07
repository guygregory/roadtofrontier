import { describe, it, expect } from 'vitest';
import { newGame } from '../src/game/state';
import { AREAS, AREA, SPEC, SPECS, FRONTIER } from '../src/game/data';
import { pcs, canPurchaseDesignation, specRequirements, specQualified, specUnlocked, frontierQualified, frontierRequirements, apMax } from '../src/game/rules';
import { beginQuarter, endQuarter } from '../src/game/sim';
import { performAction, purchaseDesignation, scheduleAudit, hireStaff, fireStaff, borrow, repay } from '../src/game/actions';
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
  it('ends with a time-out after FY31 Q4', () => {
    const s = fresh();
    s.turn = 19;
    beginQuarter(s);
    s.pending = [];
    s.cash = 5000;
    endQuarter(s);
    expect(s.status).toBe('lost');
    expect(s.endKind).toBe('timeout');
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
