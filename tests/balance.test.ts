import { describe as d, it, expect } from 'vitest';
import { newGame } from '../src/game/state';
import { botGame, describe as describeState } from '../src/game/bot';
import { HERITAGES } from '../src/game/data';
import type { Difficulty } from '../src/game/data';

/** Play n bot games for up to maxQuarters each. Games still running at the cap count as unfinished. */
function run(difficulty: Difficulty, n: number, maxQuarters: number, verbose = false) {
  const res = { frontier: 0, poty: 0, bankrupt: 0, removed: 0, unfinished: 0, turns: [] as number[] };
  for (let i = 0; i < n; i++) {
    const her = HERITAGES[i % HERITAGES.length].id;
    const s = newGame({ company: 'Bot Co', heritage: her, difficulty, seed: 1000 + i * 7919 });
    botGame(s, maxQuarters);
    if (s.status === 'playing') res.unfinished++;
    else res[s.endKind as 'frontier' | 'poty' | 'bankrupt' | 'removed']++;
    res.turns.push(s.turn);
    if (verbose && i < 6) console.log(her.padEnd(5), describeState(s));
  }
  return res;
}

const summary = (r: ReturnType<typeof run>) => JSON.stringify({ ...r, turns: undefined, avgTurn: r.turns.reduce((a, b) => a + b, 0) / r.turns.length });

d('balance (bot simulation)', () => {
  it('a competent bot can win within FY27-FY31 on normal, but not every time', () => {
    const r = run('normal', 120, 20, true);
    const wins = r.frontier + r.poty;
    console.log('NORMAL by FY31', summary(r));
    expect(wins).toBeGreaterThan(120 * 0.25);
    expect(wins).toBeLessThan(120 * 0.95);
  });

  it('hard is harder than easy', () => {
    const e = run('easy', 60, 20);
    const h = run('hard', 60, 20);
    console.log('EASY by FY31', summary(e));
    console.log('HARD by FY31', summary(h));
    expect(e.frontier + e.poty).toBeGreaterThanOrEqual(h.frontier + h.poty);
  });

  it('play carries on past FY31 until the game is won or lost', () => {
    const r = run('normal', 60, 60);
    console.log('NORMAL up to FY41', summary(r));
    expect(r.turns.some((t) => t > 20)).toBe(true);
    expect(r.frontier + r.poty + r.bankrupt + r.removed).toBeGreaterThan(60 * 0.8);
  });
});
