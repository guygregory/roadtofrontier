// New features: advisors (MAICPP emails -> distributor AM -> PDM on the MPL), the CSP action after
// enrolling, Customer Zero for Azure with Azure credits, Partner Success renewal, and endless play.
// Usage: node scripts/smoke5.mjs [url]   (needs a running `npm run preview`)
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
const failures = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));
const wait = (ms) => page.waitForTimeout(ms);
const press = async (k, ms = 300) => {
  await page.keyboard.press(k);
  await wait(ms);
};
const shot = (name) => page.locator('#screen').screenshot({ path: `screenshots/n-${name}.png` });
const st = () => page.evaluate(() => window.__rtf.state);
const check = (label, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${detail ? `: ${detail}` : ''}`);
  if (!ok) failures.push(label);
};
const go = (scene) => page.evaluate((name) => window.__rtf.go(new window.__rtfScenes[name](), true), scene);
const focus = (i) => page.evaluate((n) => (window.__rtfUi.focus = n), i);

await page.goto(url);
await wait(500);
await page.mouse.click(320, 256);
await wait(3800);
for (let i = 0; i < 9; i++) await press('Enter', 450);
await press('ArrowUp');
await press('Enter', 900);
for (let i = 0; i < 6 && (await st()).phase === 'events'; i++) {
  await press('Enter', 300);
  await press('Enter', 600);
}
check('reached the hub', (await st()).phase === 'hub');
await shot('hub-maicpp');

// 1. After joining CSP Indirect, the CSP action is blocked (Direct Bill not yet possible) and Sam advises.
await page.evaluate(() => {
  const s = window.__rtf.state;
  s.csp = 'indirect';
  s.ap = 2;
  s.cash = 5000;
});
await go('HubScene');
await wait(400);
await shot('hub-distributor');
await go('ActionsScene');
await wait(300);
await focus(3);
await wait(300);
await shot('actions-csp-blocked');
await press('Enter', 300);
check('CSP entry cannot be opened once Indirect', (await page.evaluate(() => window.__rtf.scene.mode)) === 'list');
await page.evaluate(() => (window.__rtf.state.designations = [{ area: 'modern', since: 0, renewAt: 8 }]));
await wait(300);
await shot('actions-csp-blocked-customers');

// 2. Customer Zero for Azure, paid with Azure credits (topped up with cash).
await page.evaluate(() => {
  const s = window.__rtf.state;
  s.benefits = 'expanded';
  s.azureCredits = 12.4;
});
await focus(14);
await wait(300);
await shot('actions-azure');
await press('Enter', 300);
await shot('actions-azure-options');
const cashBefore = (await st()).cash;
await press('Enter', 500);
await shot('actions-azure-result');
await press('Enter', 300);
let s = await st();
check('Azure CZ used credits first', s.azureCredits === 0 && Math.abs(cashBefore - s.cash - 7.6) < 0.01 && s.flags.azureZero === 1, `credits ${s.azureCredits}, cash -${(cashBefore - s.cash).toFixed(1)}`);

// 3. Partner Success can be stopped once you hold a designation.
await page.evaluate(() => {
  const s = window.__rtf.state;
  s.designations = [{ area: 'modern', since: 0, renewAt: 4 }];
  s.azureCredits = 9;
});
await go('CompanyScene');
await wait(300);
await shot('company-ps');
await focus(7);
await wait(200);
await press('Enter', 400);
await shot('company-ps-stopped');
check('Partner Success renewal switched off', (await st()).benefitsRenew === false);

// 4. Managed Partner List: Alex introduces himself in the FY briefing and advises in the hub.
await page.evaluate(() => {
  const s = window.__rtf.state;
  s.mpl = true;
  s.flags.mplSince = s.turn;
});
await go('PlanScene');
await wait(400);
await shot('plan-pdm-intro');
await page.evaluate(() => {
  window.__rtf.scene.step = 4;
  window.__rtfUi.reset(6);
});
await wait(300);
await shot('plan-budget-renew');
await go('HubScene');
await wait(400);
await shot('hub-pdm');

// 5. New events.
for (const id of ['disti_offer', 'maicpp_email', 'azure_zero_pitch']) {
  await page.evaluate((eid) => {
    const s = window.__rtf.state;
    if (eid === 'azure_zero_pitch') {
      s.flags.azureZero = 0;
      s.azureCredits = 9;
    }
    s.pending = [{ id: eid, data: {} }];
    s.phase = 'events';
  }, id);
  await go('EventScene');
  await wait(500);
  await shot(`event-${id}`);
  await press('Enter', 400);
  await shot(`event-${id}-outcome`);
  await press('Enter', 600);
}
check('events resolved', (await st()).pending.length === 0);

// 6. FY31 year end: MPL onboarding, credits expire, Partner Success lapses, and play continues into FY32.
await page.evaluate(() => {
  const s = window.__rtf.state;
  s.turn = 19;
  s.phase = 'hub';
  s.pending = [];
  s.cash = 5000;
  s.mpl = false;
  s.flags.secondSpec = 18;
  s.flags.azureZero = 1;
  s.azureCredits = 7.6;
  s.benefits = 'expanded';
  s.benefitsRenew = false;
  s.flags.psPaidFY = 31;
  s.designations = [{ area: 'modern', since: 16, renewAt: 24 }];
  s.specs = [
    { id: 'copilot', since: 18, renewAt: 22, renewals: 0 },
    { id: 'calling', since: 18, renewAt: 22, renewals: 0 },
  ];
});
await go('HubScene');
await wait(400);
await shot('hub-fy31-q4');
await press('7', 400);
await press('Enter', 2800);
await shot('report-fy31-q4');
await press('Escape', 900);
await shot('yearend-fy31');
s = await st();
check('MPL from FY32', s.mpl === true && s.flags.mplSince === 20, `mpl=${s.mpl} since=${s.flags.mplSince}`);
check('game continues past FY31', s.status === 'playing' && s.turn === 20, `status=${s.status} turn=${s.turn}`);
await press('Enter', 900);
await shot('plan-fy32-briefing');
for (let i = 0; i < 4; i++) await press('Enter', 400);
await shot('plan-fy32-budget');
await press('ArrowUp', 250);
await press('Enter', 1000);
s = await st();
check('Partner Success lapsed at the FY32 start', s.benefits === 'none', s.benefits);
check('FY32 Azure credits granted', s.azureCredits > 0, String(s.azureCredits));
for (let i = 0; i < 6 && (await st()).phase === 'events'; i++) {
  await press('Enter', 300);
  await press('Enter', 600);
}
await shot('hub-fy32');
check('FY32 Q1 in the hub', (await st()).turn === 20 && (await st()).phase === 'hub');

console.log('FAILURES:', failures.length ? failures.join(', ') : 'none');
console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
await browser.close();
process.exit(failures.length || errors.length ? 1 : 0);
