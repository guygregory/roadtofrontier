// Second smoke pass: year-end, endings, sharing, help and credits.
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
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));
const wait = (ms) => page.waitForTimeout(ms);
let n = 50;
const shot = async (name) => page.locator('#screen').screenshot({ path: `${out}/${++n}-${name}.png` });
const key = async (k, times = 1) => {
  for (let i = 0; i < times; i++) {
    await page.keyboard.press(k);
    await wait(120);
  }
};
const phase = () => page.evaluate(() => window.__rtf.state?.phase);

await page.goto(url);
await wait(500);
await page.mouse.click(320, 256);
await wait(3800);
// Quick new game with defaults
for (let i = 0; i < 9; i++) {
  await page.keyboard.press('Enter');
  await wait(500);
}
await key('ArrowUp');
await wait(300);
await key('Enter'); // confirm plan
await wait(900);
for (let i = 0; i < 6 && (await phase()) === 'events'; i++) {
  await key('Enter');
  await wait(400);
  await key('Enter');
  await wait(800);
}
console.log('phase after events', await phase());
// Force a Q4 with a premium nomination to see the year-end reveal
await page.evaluate(() => {
  const s = window.__rtf.state;
  s.turn = 3;
  s.designations.push({ area: 'infra', since: 0, renewAt: 7 });
  s.nominations.push({ category: 'infra', premium: true, fy: 27 });
  s.reputation = 90;
});
await wait(300);
await shot('hub-q4');
await key('7');
await wait(400);
await key('Enter');
await wait(2600);
await key('Escape');
await wait(900);
await shot('yearend-drumroll');
await wait(2200);
await shot('yearend-result');
await key('Enter');
await wait(800);
await shot('plan-fy28');

// Win ending
await page.evaluate(() => {
  const s = window.__rtf.state;
  s.status = 'won';
  s.endKind = 'frontier';
  s.phase = 'ended';
  s.endReason = `${s.company} passed the Frontier Partner audit and joined Microsoft's elite agentic AI partners.`;
  window.__rtf.go(new window.__rtfScenes.EndingScene());
});
await wait(2600);
await shot('ending-win');
// Lose ending (reuse the same state)
await page.evaluate(() => {
  const s = window.__rtf.state;
  s.status = 'lost';
  s.endKind = 'bankrupt';
  s.phase = 'ended';
  s.endReason = `${s.company} ran out of cash two quarters in a row. The administrators have taken the coffee machine.`;
  window.__rtf.go(new window.__rtfScenes.EndingScene());
});
await wait(1200);
await shot('ending-guru');
await page.mouse.click(320, 256);
await wait(800);
await shot('ending-gameover');
await wait(500);
await key('Enter');
await wait(800);
await shot('share-from-ending');
// Share screen: stub window.open and capture the downloaded result card
await page.evaluate(() => {
  window.__opened = [];
  window.open = (u) => (window.__opened.push(u), null);
});
await page.evaluate(() => window.__rtf.go(new window.__rtfScenes.ShareScene(window.__rtf.scene, 12345)));
await wait(600);
await shot('share');
const box = await page.locator('#screen').boundingBox();
const clickG = (x, y) => page.mouse.click(box.x + (x * box.width) / 320, box.y + (y * box.height) / 256);
const dl = page.waitForEvent('download');
await clickG(40, 229); // LINKEDIN
const card = await dl;
await card.saveAs(`${out}/share-card.png`);
console.log('share download', card.suggestedFilename());
console.log('opened', await page.evaluate(() => window.__opened));
await wait(500);
await shot('share-dialog');
await key('Enter');
await wait(400);
await key('Escape');
await wait(600);
await key('Escape');
await page.evaluate(() => window.__rtf.go(new window.__rtfScenes.TitleScene()));
await wait(800);
await shot('title-menu');
// Help & credits from title
await key('ArrowDown', 2);
await key('Enter');
await wait(600);
await shot('help-1');
await key('ArrowRight', 3);
await wait(300);
await shot('help-4');
await key('Escape');
await wait(700);
await key('ArrowDown', 3);
await key('Enter');
await wait(4000);
await shot('credits');
console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
await browser.close();
