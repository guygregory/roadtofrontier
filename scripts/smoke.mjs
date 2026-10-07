// Headless smoke test: drives the game with keyboard/mouse and saves screenshots.
// Usage: node scripts/smoke.mjs [url]   (needs a running `npm run preview` or `npm run dev`)
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const url = process.argv[2] ?? 'http://localhost:4173/';
const out = 'screenshots';
mkdirSync(out, { recursive: true });

let browser;
try {
  browser = await chromium.launch({ channel: 'msedge', headless: true });
} catch {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
}
const page = await browser.newPage({ viewport: { width: 640, height: 512 } });
const errors = [];
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
page.on('pageerror', (e) => errors.push(String(e)));

const wait = (ms) => page.waitForTimeout(ms);
let n = 0;
async function shot(name) {
  n++;
  await page.locator('#screen').screenshot({ path: `${out}/${String(n).padStart(2, '0')}-${name}.png` });
}
async function key(k, times = 1, delay = 120) {
  for (let i = 0; i < times; i++) {
    await page.keyboard.press(k);
    await wait(delay);
  }
}
const state = () =>
  page.evaluate(() => {
    const s = window.__rtf.state;
    return s ? { turn: s.turn, phase: s.phase, pending: s.pending.length, cash: Math.round(s.cash), status: s.status, ap: s.ap } : null;
  });
const sceneName = () => page.evaluate(() => window.__rtf.scene?.constructor?.name ?? '');

await page.goto(url);
await wait(700);
await shot('boot');
await page.mouse.click(320, 256);
await wait(3800);
await shot('title');

// New game
await key('Enter');
await wait(500);
await shot('setup-name');
await key('Enter');
await wait(400);
await key('ArrowDown');
await shot('setup-heritage');
await key('Enter');
await wait(300);
await shot('setup-difficulty');
await key('Enter');
await wait(300);
await shot('setup-welcome');
await key('Enter');
await wait(600);
await shot('plan-briefing');
await key('Enter');
await wait(300);
await shot('plan-primary');
await key('Enter');
await wait(300);
await shot('plan-secondary');
await key('ArrowDown', 6);
await key('Enter');
await wait(300);
await shot('plan-bet');
await key('Enter');
await wait(300);
await shot('plan-budget');
await key('ArrowUp');
await key('Enter');
await wait(800);
console.log('after plan', await sceneName(), await state());
await shot('event-1');

// Resolve events
for (let i = 0; i < 6 && (await state())?.phase === 'events'; i++) {
  await key('Enter');
  await wait(250);
  await shot(`event-outcome-${i}`);
  await key('Enter');
  await wait(600);
}
console.log('hub?', await sceneName(), await state());
await wait(400);
await shot('hub');

// Actions screen
await key('1');
await wait(500);
await shot('actions');
await key('ArrowDown', 3);
await shot('actions-csp');
await key('Enter');
await wait(300);
await shot('actions-csp-options');
await key('Enter');
await wait(400);
await shot('actions-csp-result');
await key('Enter');
await wait(300);
await key('Escape');
await wait(500);

// Partner Center
await key('3');
await wait(500);
await shot('partnercenter-sp');
await key('ArrowRight');
await key('Enter');
await wait(300);
await shot('partnercenter-specs');
await key('ArrowRight');
await key('Enter');
await wait(300);
await shot('partnercenter-frontier');
await key('Escape');
await wait(500);

// Programmes, company, customers
await key('2');
await wait(500);
await shot('programmes');
await key('Escape');
await wait(500);
await key('4');
await wait(500);
await shot('company');
await key('Escape');
await wait(500);
await key('5');
await wait(500);
await shot('customers');
await key('Escape');
await wait(500);

// End quarter
await key('7');
await wait(300);
await shot('end-confirm');
await key('Enter');
await wait(2200);
await shot('report-1');
await key('ArrowRight');
await wait(200);
await shot('report-2');
await key('ArrowRight');
await wait(200);
await shot('report-3');
await key('ArrowRight');
await wait(200);
await shot('report-4');
console.log('after report', await sceneName(), await state());

console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
await browser.close();
