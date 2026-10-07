// Marathon smoke test: plays quarters through the UI, past the end of FY31 (there is no time limit),
// and checks for runtime errors. Stops when the game ends or FY32 Q3 is reached.
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const url = process.argv[2] ?? 'http://localhost:4173/';
mkdirSync('screenshots', { recursive: true });
let browser;
try {
  browser = await chromium.launch({ channel: 'msedge', headless: true });
} catch {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
}
const page = await browser.newPage({ viewport: { width: 640, height: 512 } });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));
const wait = (ms) => page.waitForTimeout(ms);
const press = async (k, ms = 350) => {
  await page.keyboard.press(k);
  await wait(ms);
};
const st = () =>
  page.evaluate(() => {
    const s = window.__rtf.state;
    const sc = window.__rtf.scene;
    return {
      turn: s?.turn,
      phase: s?.phase,
      status: s?.status,
      step: sc?.step,
      cash: s ? Math.round(s.cash) : null,
      des: s?.designations.length,
      specs: s?.specs.length,
      dialogs: window.__rtf.dialogs.length,
      hasReport: !!sc?.r,
    };
  });
const shot = (name) => page.locator('#screen').screenshot({ path: `screenshots/m-${name}.png` });

await page.goto(url);
await wait(500);
await page.mouse.click(320, 256);
await wait(3800);
for (let i = 0; i < 9; i++) await press('Enter', 500);
await press('ArrowUp', 300);
await press('Enter', 900);

// Give the company a leg up so later-game screens get exercised.
await page.evaluate(() => {
  const s = window.__rtf.state;
  s.cash += 3000;
  s.csp = 'indirect';
  s.tech = 30;
  s.sales = 6;
  for (const a of ['security', 'modern', 'dataai']) {
    const ar = s.areas[a];
    ar.inter = 8;
    ar.adv = 4;
    ar.customers = 20;
    ar.adds = [4, 4, 4, 4];
    ar.usage = [10, 10, 10, 10];
    ar.deploys = [3, 3, 3, 3];
  }
});

let lastTurn = -1;
for (let guard = 0; guard < 400; guard++) {
  const s = await st();
  if (s.status && s.status !== 'playing') {
    await shot(`ending-${s.status}`);
    console.log('ENDED', JSON.stringify(s));
    break;
  }
  if (s.turn >= 22) {
    await shot('past-fy31');
    console.log('PAST FY31, STILL PLAYING', JSON.stringify(s));
    break;
  }
  if (s.turn !== lastTurn) {
    lastTurn = s.turn;
    console.log('turn', JSON.stringify(s));
    if (s.turn === 2 || s.turn === 6) {
      await shot(`hub-t${s.turn}`);
      // Partner center: buy any designation we qualify for via the UI
      await press('3', 600);
      await shot(`pc-t${s.turn}`);
      await press('ArrowRight', 200);
      await press('Enter', 400);
      await shot(`pc-specs-t${s.turn}`);
      await press('Escape', 700);
    }
  }
  if (s.dialogs > 0) {
    await press('Enter', 400);
    continue;
  }
  if (s.phase === 'plan') {
    // walk the planning wizard
    for (let i = 0; i < 4; i++) await press('Enter', 400);
    await press('ArrowUp', 250);
    await press('Enter', 900);
    continue;
  }
  if (s.phase === 'events') {
    await press('Enter', 300);
    await press('Enter', 700);
    continue;
  }
  if (s.phase === 'hub') {
    if (s.hasReport) {
      await press('Escape', 900);
      continue;
    }
    // Buy designations directly when qualified (exercise the purchase dialog path)
    await page.evaluate(() => {
      const s = window.__rtf.state;
      for (const a of ['security', 'modern', 'dataai']) if (!s.designations.some((d) => d.area === a)) {
        // nothing - let the sim auto-enrol after the first purchase
      }
    });
    await press('7', 400);
    await press('Enter', 2600);
    // report / year end / plan handled next loop
    continue;
  }
  await press('Enter', 600);
}
const final = await st();
console.log('FINAL', JSON.stringify(final));
await shot('final');
console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
await browser.close();
