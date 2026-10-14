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
  if (mobile) {
    await ctx.addInitScript(() => {
      window.__testOrientation = 'landscape-primary';
      window.__viewportDescriptors = {
        width: Object.getOwnPropertyDescriptor(window, 'innerWidth'),
        height: Object.getOwnPropertyDescriptor(window, 'innerHeight'),
      };
      Object.defineProperty(screen.orientation, 'type', { configurable: true, get: () => window.__testOrientation });
      Object.defineProperty(window, 'orientation', { configurable: true, value: undefined });
    });
  }
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
/** Tap a point on the 320x256 logical screen, including the rotated portrait fallback. */
async function tap(page, x, y) {
  const box = await page.locator('#screen').boundingBox();
  const rotated = await page.evaluate(() => document.documentElement.classList.contains('portrait'));
  await page.touchscreen.tap(
    box.x + (rotated ? (1 - (y + 0.5) / 256) : (x + 0.5) / 320) * box.width,
    box.y + (rotated ? (x + 0.5) / 320 : (y + 0.5) / 256) * box.height,
  );
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
check('setup does not focus the name field without a tap', await m.evaluate(() => document.activeElement?.id !== 'textfield'));
await m.evaluate(() => {
  window.__fieldBlurs = 0;
  document.getElementById('textfield').addEventListener('blur', () => window.__fieldBlurs++);
});
// Tap the native name box; its default action focuses it without a canvas focus cycle.
await tap(m, 120, 92);
check('tapping the name box focuses the text field', await m.evaluate(() => document.activeElement?.id === 'textfield'));
check('only active name editing hides the game controls', await m.evaluate(() =>
  document.documentElement.classList.contains('name-typing') &&
  getComputedStyle(document.getElementById('dpad')).display === 'none' &&
  getComputedStyle(document.getElementById('fire')).display === 'none'));
check('native input is aligned with the name box', await m.evaluate(() => {
  const canvas = document.getElementById('screen').getBoundingClientRect();
  const f = document.getElementById('textfield').getBoundingClientRect();
  return Math.abs(f.left - (canvas.left + canvas.width * 30 / 320)) < 1 &&
    Math.abs(f.top - (canvas.top + canvas.height * 84 / 256)) < 1 &&
    parseFloat(getComputedStyle(document.getElementById('textfield')).fontSize) >= 16;
}));
await tap(m, 120, 92);
check('repeated taps retain focus without blurring', await m.evaluate(() => document.activeElement?.id === 'textfield' && window.__fieldBlurs === 0));
await m.evaluate(() => {
  Object.defineProperty(window.visualViewport, 'height', { configurable: true, value: 140 });
  window.visualViewport.dispatchEvent(new Event('resize'));
});
check('keyboard visual viewport keeps the field and Continue row visible', await m.evaluate(() => {
  const field = document.getElementById('textfield').getBoundingClientRect();
  const canvas = document.getElementById('screen').getBoundingClientRect();
  return field.top >= 8 && field.bottom <= 132 &&
    canvas.top + canvas.height * 144 / 256 <= 133 &&
    document.activeElement?.id === 'textfield' && window.__fieldBlurs === 0;
}));
await m.evaluate(() => {
  delete window.visualViewport.height;
  window.visualViewport.dispatchEvent(new Event('resize'));
});
const fit = await m.evaluate(() => ({
  width: document.getElementById('screen').style.width,
  height: document.getElementById('screen').style.height,
  portrait: document.documentElement.classList.contains('portrait'),
}));
// Simulate a keyboard-only window resize, not a change to physical screen orientation.
await m.evaluate(() => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 100 });
  window.dispatchEvent(new Event('resize'));
});
check('keyboard resizing preserves scale and landscape', await m.evaluate((before) =>
  document.getElementById('screen').style.width === before.width &&
  document.getElementById('screen').style.height === before.height &&
  document.documentElement.classList.contains('portrait') === before.portrait, fit));
await m.evaluate(() => {
  window.__testOrientation = undefined;
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 100 });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 390 });
  window.dispatchEvent(new Event('resize'));
});
check('missing orientation API does not mistake keyboard aspect inversion for rotation', await m.evaluate((before) =>
  document.getElementById('screen').style.width === before.width &&
  !document.documentElement.classList.contains('portrait'), fit));
await m.evaluate(() => {
  window.__testOrientation = 'landscape-primary';
  Object.defineProperty(window, 'innerWidth', window.__viewportDescriptors.width);
  Object.defineProperty(window, 'innerHeight', window.__viewportDescriptors.height);
  window.dispatchEvent(new Event('resize'));
});
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
await m.evaluate(() => {
  const f = document.getElementById('textfield');
  f.dispatchEvent(new CompositionEvent('compositionstart'));
  f.value = 'Composing';
  f.dispatchEvent(new Event('input'));
  f.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true }));
});
await wait(m, 100);
check('composition is not overwritten or mistaken for Continue', await m.evaluate(() =>
  document.getElementById('textfield').value === 'Composing' && window.__rtf.scene.step === 0));
await m.evaluate(() => {
  const f = document.getElementById('textfield');
  f.value = 'Tap Tech';
  f.dispatchEvent(new CompositionEvent('compositionend'));
});
await wait(m, 100);
await m.keyboard.press('End');
await m.keyboard.press('Backspace');
await wait(m, 100);
check('native deletion updates the company name', await m.evaluate(() => window.__rtf.scene.name === 'Tap Tec'));
await m.evaluate(() => {
  const f = document.getElementById('textfield');
  f.value = 'O\u2019Brien\u2014Tech!_' + 'A'.repeat(30);
  f.dispatchEvent(new Event('input'));
});
await wait(m, 100);
check('smart punctuation, allowed characters and 22-character limit preserved', await m.evaluate(() =>
  window.__rtf.scene.name === "O'Brien-Tech" + 'A'.repeat(10) &&
  document.getElementById('textfield').value === window.__rtf.scene.name));
await m.evaluate(() => {
  const f = document.getElementById('textfield');
  f.value = 'Tap Tech';
  f.dispatchEvent(new Event('input'));
  f.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
});
await wait(m, 400);
check('Enter on the on-screen keyboard continues', await m.evaluate(() => window.__rtf.scene.step === 1));
check('keyboard closed after continuing', await m.evaluate(() => document.activeElement?.id !== 'textfield'));
check('continuing restores normal gameplay layout and controls', await m.evaluate(() =>
  !document.documentElement.classList.contains('name-typing') &&
  getComputedStyle(document.getElementById('dpad')).display !== 'none'));
check('final input before Enter is retained and field hidden', await m.evaluate(() =>
  window.__rtf.scene.name === 'Tap Tech' && document.getElementById('textfield').hidden));
await tap(m, 40, 228);
check('Back restores name entry without reopening keyboard', await m.evaluate(() =>
  window.__rtf.scene.step === 0 && window.__rtf.scene.name === 'Tap Tech' &&
  !document.getElementById('textfield').hidden && document.activeElement?.id !== 'textfield'),
  JSON.stringify(await m.evaluate(() => ({ step: window.__rtf.scene.step, name: window.__rtf.scene.name, hidden: document.getElementById('textfield').hidden, focus: document.activeElement?.id }))));
await tap(m, 120, 92);
await m.evaluate(() => {
  document.getElementById('textfield').setSelectionRange(1, 3);
});
await wait(m, 150);
check('frames preserve native selection', await m.evaluate(() => {
  const f = document.getElementById('textfield');
  return document.activeElement === f && f.selectionStart === 1 && f.selectionEnd === 3;
}));
await m.evaluate(() => {
  const f = document.getElementById('textfield');
  f.value = '';
  f.dispatchEvent(new Event('input'));
});
await wait(m, 100);
await tap(m, 240, 137);
check('empty names cannot Continue', await m.evaluate(() => window.__rtf.scene.step === 0));
await tap(m, 120, 92);
await m.keyboard.insertText('Tap Tech');
await wait(m, 100);
await tap(m, 240, 137);
check('Continue button advances and hides the native field', await m.evaluate(() =>
  window.__rtf.scene.step === 1 && document.getElementById('textfield').hidden));
// Heritage -> difficulty -> welcome -> plan
await tap(m, 60, 81);
check('heritage selected after keyboard entry', await m.evaluate(() => window.__rtf.scene.step === 2),
  String(await m.evaluate(() => window.__rtf.scene.step)));
await tap(m, 100, 71);
check('difficulty selected after keyboard entry', await m.evaluate(() => window.__rtf.scene.step === 3),
  String(await m.evaluate(() => window.__rtf.scene.step)));
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
// Actual device rotation while editing, followed by the portrait fallback.
await go(m, 'SetupScene');
await wait(m, 100);
await tap(m, 120, 92);
await m.evaluate(() => {
  window.__testOrientation = 'portrait-primary';
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 844 });
  window.dispatchEvent(new Event('orientationchange'));
});
await wait(m, 500);
check('actual rotation updates layout while editing without losing focus', await m.evaluate(() =>
  !document.documentElement.classList.contains('portrait') &&
  document.documentElement.classList.contains('name-typing') &&
  document.activeElement?.id === 'textfield'));
await m.setViewportSize({ width: 390, height: 844 });
await tap(m, 120, 92);
check('upright portrait name box remains tappable without refocusing', await m.evaluate(() =>
  document.activeElement?.id === 'textfield' && !document.documentElement.classList.contains('portrait')));
await shot(m, 'setup-portrait-editing');
await tap(m, 240, 137);
check('Continue restores landscape for heritage immediately', await m.evaluate(() =>
  window.__rtf.scene.step === 1 && document.documentElement.classList.contains('portrait') &&
  !document.documentElement.classList.contains('name-typing')));
await tap(m, 40, 228);
check('returning to name entry stays landscape until the field is tapped', await m.evaluate(() =>
  window.__rtf.scene.step === 0 && document.documentElement.classList.contains('portrait')));
await tap(m, 120, 92);
check('a tap changes portrait-held name entry to upright without losing focus', await m.evaluate(() =>
  !document.documentElement.classList.contains('portrait') && document.activeElement?.id === 'textfield'));
const portraitEditingFit = await m.evaluate(() => document.getElementById('screen').style.width);
await m.evaluate(() => {
  window.__portraitBlurs = 0;
  document.getElementById('textfield').addEventListener('blur', () => window.__portraitBlurs++);
  Object.defineProperty(window.visualViewport, 'height', { configurable: true, value: 400 });
  window.visualViewport.dispatchEvent(new Event('resize'));
});
await tap(m, 120, 92);
check('portrait editing stays upright and focused through keyboard resize and repeated taps', await m.evaluate((width) =>
  document.getElementById('screen').style.width === width &&
  !document.documentElement.classList.contains('portrait') &&
  document.activeElement?.id === 'textfield' && window.__portraitBlurs === 0, portraitEditingFit));
await m.evaluate(() => document.getElementById('textfield').blur());
check('dismissing editing restores landscape before the keyboard finishes closing', await m.evaluate(() =>
  document.documentElement.classList.contains('portrait') &&
  !document.documentElement.classList.contains('name-typing') &&
  getComputedStyle(document.getElementById('dpad')).display !== 'none'));
await m.evaluate(() => {
  delete window.visualViewport.height;
  window.visualViewport.dispatchEvent(new Event('resize'));
});
await wait(m, 400);
await tap(m, 120, 92);
await m.keyboard.press('Enter');
await wait(m, 400);
check('Done/Enter restores landscape on a portrait-held device', await m.evaluate(() =>
  window.__rtf.scene.step === 1 && document.documentElement.classList.contains('portrait') &&
  !document.documentElement.classList.contains('name-typing')));
await tap(m, 60, 81);
check('heritage selection keeps difficulty in landscape', await m.evaluate(() =>
  window.__rtf.scene.step === 2 && document.documentElement.classList.contains('portrait')));
await tap(m, 100, 71);
check('difficulty selection keeps welcome in landscape', await m.evaluate(() =>
  window.__rtf.scene.step === 3 && document.documentElement.classList.contains('portrait')));
for (const name of ['HubScene', 'GameMenuScene', 'CompanyScene', 'PartnerCenterScene', 'TitleScene']) {
  await go(m, name);
  await wait(m, 100);
  check(`${name} retains landscape when the device is held upright`, await m.evaluate(() =>
    document.documentElement.classList.contains('portrait') &&
    !document.documentElement.classList.contains('name-typing') &&
    document.getElementById('textfield').hidden));
}
await m.evaluate(() => {
  window.__testOrientation = 'landscape-primary';
  Object.defineProperty(window, 'innerWidth', window.__viewportDescriptors.width);
  Object.defineProperty(window, 'innerHeight', window.__viewportDescriptors.height);
});
await m.setViewportSize({ width: 844, height: 390 });
await m.evaluate(() => window.dispatchEvent(new Event('orientationchange')));
await wait(m, 500);
check('landscape rotation uses the normal gameplay layout', await m.evaluate(() =>
  !document.documentElement.classList.contains('portrait') &&
  !document.documentElement.classList.contains('name-typing')));
await go(m, 'SetupScene');
await wait(m, 100);
await tap(m, 120, 92);
await go(m, 'TitleScene');
check('scene exit hides and blurs the field', await m.evaluate(() =>
  document.getElementById('textfield').hidden && document.activeElement?.id !== 'textfield'));
await go(m, 'SetupScene');
await wait(m, 100);
await tap(m, 120, 92);
await tap(m, 50, 137);
check('name-step Back returns to title and hides the field', await m.evaluate(() =>
  window.__rtf.scene instanceof window.__rtfScenes.TitleScene && document.getElementById('textfield').hidden));
await m.close();

// ---------------------------------------------------------------- desktop
const d = await open(false);
await d.mouse.click(320, 256);
await wait(d, 3800);
await shot(d, 'desktop-title');
check('desktop not treated as mobile', !(await d.evaluate(() => document.documentElement.classList.contains('mobile'))));
check('desktop has no hidden text field', !(await d.evaluate(() => !!document.getElementById('textfield'))));
await go(d, 'SetupScene');
await d.keyboard.press('m');
await d.keyboard.press('f');
await wait(d, 100);
check('desktop M/F type into names instead of activating shortcuts', await d.evaluate(() => window.__rtf.scene.name.endsWith('mf')));

console.log('FAILURES:', failures.length ? failures.join(', ') : 'none');
console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
await browser.close();
process.exit(failures.length || errors.length ? 1 : 0);
