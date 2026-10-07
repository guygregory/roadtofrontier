import { describe, it, expect } from 'vitest';
import { wrap } from '../src/engine/font';
import { advisorTips } from '../src/scenes/advisor';
import { PAGES } from '../src/scenes/help';
import { ACTIONS, actionBlocked } from '../src/game/actions';
import { OFFERS } from '../src/game/data';
import { EVENTS } from '../src/game/events';
import { money } from '../src/game/format';
import { newGame } from '../src/game/state';
import type { GameState } from '../src/game/types';

/** States that trigger as many advisor tips and event variants as possible, for each kind of advisor. */
function busyStates(): GameState[] {
  const out: GameState[] = [];
  for (const kind of ['program', 'distributor', 'pdm', 'direct'] as const) {
    for (let q = 0; q < 4; q++) {
      const s = newGame({ company: 'Agnus Advisory Ltd', heritage: 'mw', difficulty: 'normal', seed: 5 + q });
      s.turn = 4 + q;
      if (kind !== 'program') s.csp = kind === 'direct' ? 'direct' : 'indirect';
      if (kind === 'pdm') s.mpl = true;
      s.negativeQuarters = q % 2;
      s.cash = 10;
      s.coop = 30;
      s.morale = 30;
      s.compliance = 30;
      s.sales = 0;
      s.azureCredits = 12.4;
      s.benefits = 'expanded';
      s.designations = [{ area: 'modern', since: 0, renewAt: 8 }];
      s.areas.modern.customers = 80;
      s.unified = q % 2 === 0;
      for (let i = 0; i < 5; i++) s.key.push({ id: 100 + i, name: 'Wide World Importers', area: 'modern', revenue: 150, sat: 40, since: 0 });
      out.push(s);
    }
  }
  return out;
}

const clone = (s: GameState): GameState => JSON.parse(JSON.stringify(s));

describe('text fits on screen', () => {
  it('advisor tips fit the hub panel (8 lines of 124px)', () => {
    for (const s of busyStates()) for (const tip of advisorTips(s)) expect(wrap(tip, 124).length, tip).toBeLessThanOrEqual(8);
  });

  it('help pages fit their panel', () => {
    for (const p of PAGES) expect(wrap(p.body, 254).length, p.title).toBeLessThanOrEqual(18);
  });

  it('action details fit the panel: blurb, any unavailability reason, and two-line option hints', () => {
    const states = [...busyStates(), newGame({ company: 'Fresh Co', heritage: 'sec', difficulty: 'normal', seed: 3 })];
    states[0].csp = 'indirect';
    states[0].designations = [];
    states[1].ap = 0;
    // Indirect reseller with a designation but too few customers for Direct Bill.
    const indirect = newGame({ company: 'Indirect Co', heritage: 'mw', difficulty: 'normal', seed: 4 });
    indirect.csp = 'indirect';
    indirect.designations = [{ area: 'modern', since: 0, renewAt: 8 }];
    // Every offer already built.
    const offers = newGame({ company: 'Offers Co', heritage: 'apps', difficulty: 'normal', seed: 5 });
    offers.offers = OFFERS.map((o) => ({ id: o.id, progress: 9, required: 1, published: true, age: 1 }));
    states.push(indirect, offers);
    for (const s of states) {
      for (const a of ACTIONS) {
        // Mirrors ActionsScene: blurb from y=74 (10px lines, max 13), reason below it, readouts at y=232.
        const blurb = wrap(a.blurb, 138).length;
        expect(blurb, a.id).toBeLessThanOrEqual(13);
        const reason = actionBlocked(s, a);
        if (reason) {
          const room = Math.max(1, Math.floor((232 - (74 + blurb * 10 + 4)) / 10));
          expect(wrap(`Unavailable: ${reason}`, 138).length, `${a.id}: ${reason}`).toBeLessThanOrEqual(room);
        }
        for (const o of a.options(s)) {
          const hint = o.disabled ?? `${o.cost > 0 ? `${money(o.cost)} ` : ''}${o.hint ?? ''}`;
          expect(wrap(hint, 152).length, `${a.id}/${o.id}: ${hint}`).toBeLessThanOrEqual(2);
        }
      }
    }
  });

  it('event texts, choices and outcomes fit the event screen', () => {
    for (const base of busyStates()) {
      for (const ev of EVENTS) {
        const s = clone(base);
        const data = ev.prepare ? ev.prepare(s) : { area: 'security', n: 2, name: 'Contoso', p: 0.5, keyId: s.key[0]?.id };
        if (data === null) continue;
        expect(wrap(ev.text(s, data), 248).length, ev.id).toBeLessThanOrEqual(9);
        ev.choices(s, data).forEach((c, i) => {
          expect(`${i + 1}. ${c.label}`.length, `${ev.id} label`).toBeLessThanOrEqual(46);
          expect((c.disabled ?? c.hint ?? '').length, `${ev.id} hint: ${c.disabled ?? c.hint}`).toBeLessThanOrEqual(46);
          if (c.disabled) return;
          const s2 = clone(s);
          const outcome = c.apply(s2, data);
          expect(wrap(outcome, 280).length, `${ev.id} outcome: ${outcome}`).toBeLessThanOrEqual(5);
        });
      }
    }
  });
});
