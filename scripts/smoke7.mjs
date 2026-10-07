// Seventh smoke pass: .sav export from the game menu, quit dialog, import from the title screen.
import { chromium } from 'playwright-core';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const url = process.argv[2] ?? 'http://localhost:4173/';
const out = 'screenshots';
mkdirSync(out, { recursive: true });
let browser;
try {
  browser = await chromium.launch({ channel: 'msedge', headless: true });
} catch {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
}
const page = await browser.newPage({ viewport: { width: 640, height: 512 }, acceptDownloads: true });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));
page.on('dialog', (d) => d.accept());
const wait = (ms) => page.waitForTimeout(ms);
let n = 120;
const shot = async (name) => page.locator('#screen').screenshot({ path: `${out}/${++n}-${name}.png` });
const key = async (k, times = 1) => {
  for (let i = 0; i < times; i++) {
    await page.keyboard.press(k);
    await wait(150);
  }
};
const state = () => page.evaluate(() => ({ company: window.__rtf.state?.company, turn: window.__rtf.state?.turn, cash: window.__rtf.state?.cash, unsaved: window.__rtf.hasUnsavedProgress() }));

await page.goto(url);
await wait(500);
await page.mouse.click(320, 256);
await wait(3800);
await shot('title');
for (let i = 0; i < 9; i++) {
  await page.keyboard.press('Enter');
  await wait(500);
}
await key('ArrowUp');
await wait(300);
await key('Enter');
await wait(1200);
for (let i = 0; i < 6 && (await page.evaluate(() => window.__rtf.state?.phase)) === 'events'; i++) {
  await key('Enter');
  await wait(400);
  await key('Enter');
  await wait(800);
}
await page.evaluate(() => {
  window.__rtf.state.company = 'Save Test Ltd';
  window.__rtf.state.cash = 4321;
});
const before = await state();
console.log('before save', before);

// Game menu -> SAVE GAME
await key('Escape');
await wait(500);
await shot('gamemenu-unsaved');
await key('ArrowDown');
const dlP = page.waitForEvent('download');
await key('Enter');
const dl = await dlP;
const name = dl.suggestedFilename();
await dl.saveAs(`${out}/${name}`);
const file = readFileSync(`${out}/${name}`, 'utf8');
console.log('saved', name, /^frontier-\d{4}-\d{2}-\d{2}\.sav$/.test(name) ? 'name OK' : 'BAD NAME', file.slice(0, 20), file.includes('Save Test') ? 'PLAINTEXT!' : 'obfuscated');
await wait(500);
await shot('gamemenu-saved');
console.log('after save', await state());

// Make more progress so the quit dialog warns, then quit
await page.evaluate(() => (window.__rtf.state.cash = 1));
await key('ArrowDown', 7); // QUIT TO TITLE (last row)
await key('Enter');
await wait(500);
await shot('quit-dialog-unsaved');
await key('Escape');
await wait(300);
await page.evaluate(() => window.__rtf.go(new window.__rtfScenes.TitleScene()));
await wait(1200);

// Title -> LOAD GAME (.SAV): tampered file first
const tampered = 'RTFSAV1:' + file.slice(8, 30) + (file[30] === 'A' ? 'B' : 'A') + file.slice(31);
writeFileSync(`${out}/tampered.sav`, tampered);
await key('ArrowDown');
let fc = page.waitForEvent('filechooser');
await key('Enter');
await (await fc).setFiles(`${out}/tampered.sav`);
await wait(800);
await shot('load-tampered');
await key('Enter');
await wait(500);
await key('ArrowDown');
fc = page.waitForEvent('filechooser');
await key('Enter');
await (await fc).setFiles(`${out}/${name}`);
await wait(1500);
await shot('loaded');
const after = await state();
console.log('after load', after, after.company === before.company && after.cash === before.cash && after.turn === before.turn ? 'RESTORED' : 'MISMATCH');
console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
await browser.close();
