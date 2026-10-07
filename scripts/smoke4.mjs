// Late-game UI states: designations, specializations, offers, charts.
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const url = process.argv[2] ?? 'http://localhost:4173/';
mkdirSync('screenshots', { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 640, height: 512 } });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));
const wait = (ms) => page.waitForTimeout(ms);
const press = async (k, ms = 350) => {
  await page.keyboard.press(k);
  await wait(ms);
};
const shot = (name) => page.locator('#screen').screenshot({ path: `screenshots/l-${name}.png` });

await page.goto(url);
await wait(500);
await page.mouse.click(320, 256);
await wait(3800);
for (let i = 0; i < 9; i++) await press('Enter', 500);
await press('ArrowUp', 300);
await press('Enter', 900);
for (let i = 0; i < 4; i++) {
  const ph = await page.evaluate(() => window.__rtf.state.phase);
  if (ph !== 'events') break;
  await press('Enter', 300);
  await press('Enter', 700);
}
await page.evaluate(() => {
  const s = window.__rtf.state;
  s.turn = 9;
  s.tech = 42;
  s.sales = 7;
  s.cash = 1850;
  s.debt = 150;
  s.csp = 'indirect';
  s.coop = 24;
  s.unified = true;
  s.reputation = 77;
  s.designations = [
    { area: 'modern', since: 3, renewAt: 11 },
    { area: 'security', since: 6, renewAt: 10 },
  ];
  s.specs = [
    { id: 'copilot', since: 5, renewAt: 9, renewals: 0 },
    { id: 'datasec', since: 7, renewAt: 11, renewals: 0 },
    { id: 'calling', since: 4, renewAt: 12, renewals: 0 },
  ];
  s.offers = [
    { id: 'agentfactory', progress: 3, required: 3, published: true, age: 3 },
    { id: 'secureai', progress: 1, required: 3, published: false, age: 0 },
  ];
  s.fte = 3;
  s.dp600 = 1;
  for (const a of ['security', 'modern']) {
    const ar = s.areas[a];
    ar.inter = 9;
    ar.adv = 4;
    ar.customers = 30;
    ar.adds = [4, 3, 4, 3];
    ar.usage = [8, 7, 8, 9];
    ar.deploys = [3, 3, 2, 3];
  }
  s.areas.dataai.inter = 4;
  s.areas.dataai.adv = 1;
  s.areas.dataai.customers = 6;
  s.areas.dataai.deploys = [1, 1, 2, 1];
  s.areas.dataai.usage = [2, 3, 2, 3];
  s.areas.dataai.adds = [1, 2, 1, 2];
  s.targets = [{ id: 999, name: 'Nimbus & Co', area: 'dataai', tech: 8, sales: 2, customers: 14, inter: 4, adv: 1, keyRevenue: 70, price: 520, expires: 10, skeleton: false, culture: true, diligence: true }];
  const hist = [];
  for (let t = 0; t < 9; t++) hist.push({ turn: t, cash: 600 + t * 140 - (t === 2 ? 300 : 0), revenue: 620 + t * 95, profit: -40 + t * 30, customers: 40 + t * 6, staff: 17 + t * 3, pcs: { dataai: t * 4, infra: 0, dai: 0, bizapps: 0, modern: 36 + t * 7, security: 4 + t * 9 } });
  s.history = hist;
  s.news.push('Contoso signs a three-year Copilot programme.');
  window.__rtf.go(new window.__rtfScenes.HubScene(), true);
});
await wait(600);
await shot('hub');
await press('3', 700);
await shot('pc-sp');
await press('ArrowDown', 200);
await press('ArrowDown', 200);
await press('ArrowDown', 200);
await press('ArrowDown', 200);
await press('ArrowDown', 200);
await press('ArrowDown', 200);
await press('ArrowDown', 200);
await shot('pc-sp-security');
await press('Tab', 200);
await page.evaluate(() => (window.__rtfUi.focus = 1));
await press('Enter', 300);
await shot('pc-specs');
await page.evaluate(() => (window.__rtfUi.focus = 2));
await press('Enter', 300);
await shot('pc-frontier');
await press('Escape', 700);
await press('1', 700);
await page.evaluate(() => (window.__rtfUi.focus = 2));
await wait(200);
await press('Enter', 400);
await shot('actions-offers');
await press('Escape', 300);
await press('Escape', 700);
await press('5', 700);
await shot('customers');
await press('Escape', 700);
await press('6', 700);
await page.evaluate(() => (window.__rtfUi.focus = 1));
await press('Enter', 300);
await shot('reports-money');
await page.evaluate(() => (window.__rtfUi.focus = 2));
await press('Enter', 300);
await shot('reports-pcs');
console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
await browser.close();
