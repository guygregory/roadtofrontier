import { describe as d, it, expect } from 'vitest';
import { newGame } from '../src/game/state';
import { botGame, describe as describeState } from '../src/game/bot';
import { HERITAGES } from '../src/game/data';
import type { Difficulty } from '../src/game/data';

function run(difficulty: Difficulty, n: number, verbose = false) {
  const res = { frontier: 0, poty: 0, bankrupt: 0, removed: 0, timeout: 0, turns: [] as number[], firstDes: [] as number[] };
  for (let i = 0; i < n; i++) {
    const her = HERITAGES[i % HERITAGES.length].id;
    const s = newGame({ company: 'Bot Co', heritage: her, difficulty, seed: 1000 + i * 7919 });
    botGame(s);
    res[s.endKind as 'frontier']++;
    res.turns.push(s.turn);
    if (verbose && i < 6) console.log(her.padEnd(5), describeState(s));
  }
  return res;
}

d('balance (bot simulation)', () => {
  it('a competent bot can win on normal, but not every time', () => {
    const r = run('normal', 120, true);
    const wins = r.frontier + r.poty;
    console.log('NORMAL', JSON.stringify({ ...r, turns: undefined, avgTurn: r.turns.reduce((a, b) => a + b, 0) / r.turns.length }));
    expect(wins).toBeGreaterThan(120 * 0.25);
    expect(wins).toBeLessThan(120 * 0.95);
  });

  it('hard is harder than easy', () => {
    const e = run('easy', 60);
    const h = run('hard', 60);
    console.log('EASY', JSON.stringify({ ...e, turns: undefined }));
    console.log('HARD', JSON.stringify({ ...h, turns: undefined }));
    expect(e.frontier + e.poty).toBeGreaterThanOrEqual(h.frontier + h.poty);
  });
});
