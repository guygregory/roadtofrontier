// Mobile and touch: no key hints, no .sav options, on-screen BACK buttons, the device keyboard
// for the company name, and the new area abbreviations and focus-area names.
// Usage: node scripts/smoke8.mjs [url]   (needs a running `npm run preview`)
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
const errors = [];
const failures = [];
const check = (label, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${detail ? `: ${detail}` : ''}`);
  if (!ok) failures.push(label);
};

async function open(mobile) {
  const ctx = await browser.newContext(
    mobile ? { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 640, height: 512 } },
  );
  const page = await ctx.newPage();
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(url);
  await page.waitForTimeout(500);
  return page;
}

const wait = (page, ms) => page.waitForTimeout(ms);
const shot = (page, name) => page.locator('#screen').screenshot({ path: `screenshots/m-${name}.png` });
const st = (page) => page.evaluate(() => window.__rtf.state);
// Class names are minified in the build, so match scenes against the debug hook's classes.
const scene = (page) => page.evaluate(() => Object.entries(window.__rtfScenes).find(([, c]) => window.__rtf.scene instanceof c)?.[0] ?? '?');
const go = (page, name) => page.evaluate((n) => window.__rtf.go(new window.__rtfScenes[n](), true), name);
/** Tap a point on the 320x256 logical screen (the canvas may be scaled, but not rotated in landscape). */
async function tap(page, x, y) {
  const box = await page.locator('#screen').boundingBox();
  await page.touchscreen.tap(box.x + ((x + 0.5) * box.width) / 320, box.y + ((y + 0.5) * box.height) / 256);
  // Scene changes fade for ~0.4s, during which input is ignored.
  await wait(page, 700);
}

// ---------------------------------------------------------------- mobile
const m = await open(true);
check('mobile layout detected', await m.evaluate(() => document.documentElement.classList.contains('mobile')));
await shot(m, 'boot');
await tap(m, 160, 128);
await wait(m, 3800);
await shot(m, 'title');
const menu = await scene(m);
check('title screen reached', menu === 'TitleScene', menu);
// NEW GAME is the first title menu item; LOAD GAME is gone, so only NEW GAME / HOW TO PLAY / CREDITS remain.
await tap(m, 160, 236 - (3 * 17 + 12) + 6 + 7);
check('setup opened by tapping NEW GAME', (await scene(m)) === 'SetupScene', await scene(m));
await shot(m, 'setup-name');
// Tap the name box: the hidden text field takes the focus, which brings up the device keyboard.
await tap(m, 120, 92);
check('tapping the name box focuses the text field', await m.evaluate(() => document.activeElement?.id === 'textfield'));
await m.evaluate(() => {
  const f = document.getElementById('textfield');
  f.value = '';
  f.dispatchEvent(new Event('input'));
});
await wait(m, 200);
await m.keyboard.insertText('Tap Tech');
await wait(m, 300);
await shot(m, 'setup-typed');
check('typing on the on-screen keyboard names the company', (await m.evaluate(() => window.__rtf.scene.name)) === 'Tap Tech', await m.evaluate(() => window.__rtf.scene.name));
await m.keyboard.press('Enter');
await wait(m, 400);
check('Enter on the on-screen keyboard continues', await m.evaluate(() => window.__rtf.scene.step === 1));
check('keyboard closed after continuing', await m.evaluate(() => document.activeElement?.id !== 'textfield'));
// Heritage -> difficulty -> welcome -> plan
await tap(m, 60, 81);
await tap(m, 100, 71);
await tap(m, 250, 229);
check('plan reached', (await scene(m)) === 'PlanScene', await scene(m));
await tap(m, 250, 229); // PLAN THE YEAR
await shot(m, 'plan-primary');
await tap(m, 290, 250); // footer BACK
check('footer BACK goes back a plan step', await m.evaluate(() => window.__rtf.scene.step === 0));
await m.evaluate(() => {
  const s = window.__rtf.state;
  window.__rtf.scene.step = 4;
  s.phase = 'plan';
});
await wait(m, 200);
await tap(m, 250, 230); // CONFIRM PLAN
for (let i = 0; i < 6 && (await st(m)).phase === 'events'; i++) {
  await m.evaluate(() => window.__rtfUi.focus = 0);
  await m.keyboard.press('Enter');
  await wait(m, 300);
  await m.keyboard.press('Enter');
  await wait(m, 500);
}
await go(m, 'HubScene');
await wait(m, 400);
await shot(m, 'hub');
for (const name of ['ActionsScene', 'CompanyScene', 'HelpScene']) {
  if (name === 'HelpScene') await m.evaluate(() => window.__rtf.go(new window.__rtfScenes.HelpScene(new window.__rtfScenes.HubScene()), true));
  else await go(m, name);
  await wait(m, 400);
  await shot(m, name.toLowerCase());
}
// Help: the footer BACK closes it from any page.
await tap(m, 290, 250);
check('help closes with the footer BACK', (await scene(m)) === 'HubScene', await scene(m));
// Partner Center: the footer BACK returns to the hub.
await tap(m, 200, 52); // PARTNER CENTER (hub menu item 3)
check('partner center opened', (await scene(m)) === 'PartnerCenterScene', await scene(m));
await shot(m, 'partnercenter');
await tap(m, 290, 250);
check('partner center closes with the footer BACK', (await scene(m)) === 'HubScene', await scene(m));
// Actions: BACK steps out of an option list, then back to the hub.
await tap(m, 200, 24); // ACTIONS
await tap(m, 80, 38); // first action
check('action options open', await m.evaluate(() => window.__rtf.scene.mode === 'options'));
await tap(m, 290, 250);
check('BACK returns to the action list', await m.evaluate(() => window.__rtf.scene.mode === 'list'));
await tap(m, 290, 250);
check('BACK returns to the hub from actions', (await scene(m)) === 'HubScene', await scene(m));
// Game menu: no SAVE GAME or LOAD GAME on mobile.
await tap(m, 200, 122); // GAME MENU (hub menu item 8)
check('game menu opened', (await scene(m)) === 'GameMenuScene', await scene(m));
await shot(m, 'gamemenu');
await m.close();

// ---------------------------------------------------------------- desktop
const d = await open(false);
await d.mouse.click(320, 256);
await wait(d, 3800);
await shot(d, 'desktop-title');
check('desktop not treated as mobile', !(await d.evaluate(() => document.documentElement.classList.contains('mobile'))));
check('desktop has no hidden text field', !(await d.evaluate(() => !!document.getElementById('textfield'))));

console.log('FAILURES:', failures.length ? failures.join(', ') : 'none');
console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
await browser.close();
process.exit(failures.length || errors.length ? 1 : 0);
