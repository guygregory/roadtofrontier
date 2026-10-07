// Round-two features: Partner Center keyboard navigation, a tune per financial year, rotating PDMs
// and "Modern Work" naming. Also renders each FY tune offline: checks levels and writes WAV files.
// Usage: node scripts/smoke6.mjs [url]   (needs a running `npm run preview`)
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';

const url = process.argv[2] ?? 'http://localhost:4173/';
mkdirSync('screenshots/music', { recursive: true });
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
const press = async (k, ms = 250) => {
  await page.keyboard.press(k);
  await wait(ms);
};
const shot = (name, clip) =>
  clip ? page.screenshot({ path: `screenshots/r2-${name}.png`, clip }) : page.locator('#screen').screenshot({ path: `screenshots/r2-${name}.png` });
const check = (label, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${detail ? `: ${detail}` : ''}`);
  if (!ok) failures.push(label);
};
const go = (scene) => page.evaluate((name) => window.__rtf.go(new window.__rtfScenes[name](), true), scene);
const ev = (fn, arg) => page.evaluate(fn, arg);
const song = () => ev(() => window.__rtfAudio.current);

await page.goto(url);
await wait(500);
await page.mouse.click(320, 256);
await wait(3800);
// New game: title -> name -> heritage (Modern Workplace Boutique is second) -> difficulty -> welcome
await press('Enter', 450);
await press('Enter', 450);
await press('ArrowDown', 250);
await shot('setup-heritage-mw');
for (let i = 0; i < 3; i++) await press('Enter', 450);
check('FY27 plan plays the FY27 tune', (await song()) === 'hub', await song());
await shot('plan-briefing-fy27');
for (let i = 0; i < 4; i++) await press('Enter', 400);
await press('ArrowUp');
await press('Enter', 900);
for (let i = 0; i < 6 && (await ev(() => window.__rtf.state.phase)) === 'events'; i++) {
  await press('Enter', 300);
  await press('Enter', 600);
}
check('reached the hub', (await ev(() => window.__rtf.state.phase)) === 'hub');

// --- Partner Center keyboard navigation ------------------------------------------------
await ev(() => {
  const s = window.__rtf.state;
  s.designations = [
    { area: 'modern', since: 0, renewAt: 8 },
    { area: 'security', since: 0, renewAt: 8 },
  ];
  s.ap = 2;
});
await go('HubScene');
await wait(300);
await press('3', 700);
const pc = () =>
  ev(() => {
    const sc = window.__rtf.scene;
    return { tab: sc.tab, side: sc.side, area: sc.selArea, spec: sc.selSpec, bookIdx: sc.bookIdx, focus: window.__rtfUi.focus };
  });
let st = await pc();
check('Partner Center opens on Solutions Partner', st.tab === 'sp', JSON.stringify(st));
const area0 = st.area;
await press('ArrowDown');
st = await pc();
check('Down selects the next area', st.area !== area0 && st.side === 'list', `${area0} -> ${st.area}`);
await press('ArrowUp');
st = await pc();
check('Up goes back', st.area === area0, st.area);
await shot('pc-sp-modern');
await press('Tab', 400);
st = await pc();
check('Tab moves to Specializations', st.tab === 'spec' && st.side === 'list', JSON.stringify(st));
check('Specializations open on the first workable one, not a locked one', st.spec === 'copilot' && st.focus === 3, JSON.stringify(st));
const spec0 = st.spec;
await press('ArrowDown');
await press('ArrowDown');
st = await pc();
check('Down/Down moves through the specialization list', st.spec !== spec0 && st.focus >= 3, `${spec0} -> ${st.spec} (focus ${st.focus})`);
await ev(() => {
  window.__rtf.scene.selSpec = 'copilot';
  window.__rtf.scene.placeFocus = true;
});
await wait(200);
const listFocus = (await pc()).focus;
await press('ArrowRight');
st = await pc();
check('Right moves to the audit booking buttons', st.side === 'book' && st.bookIdx === 0 && st.focus > listFocus, JSON.stringify(st));
await press('ArrowDown');
st = await pc();
check('Down moves between the booking buttons', st.side === 'book' && st.bookIdx === 1, JSON.stringify(st));
await shot('pc-spec-book');
await press('ArrowLeft');
st = await pc();
check('Left returns to the list', st.side === 'list' && st.spec === 'copilot' && st.focus === listFocus, JSON.stringify(st));
await shot('pc-spec-list');
await press('Shift+Tab', 400);
check('Shift+Tab moves right to left', (await pc()).tab === 'sp');
await press('Shift+Tab', 400);
check('Shift+Tab wraps round to Frontier', (await pc()).tab === 'frontier');
await shot('pc-frontier');
await press('Tab', 400);
check('Tab wraps round to Solutions Partner', (await pc()).tab === 'sp');
await press('Escape', 700);

// --- Booking with the keyboard: Enter books or buys, and Enter closes the confirmation -------
const dialogs = () => ev(() => window.__rtf.dialogs.length);
await ev(() => {
  const s = window.__rtf.state;
  Object.assign(s.areas.modern, { inter: 9, adv: 4, customers: 30, deploys: [3, 3, 2, 3], adds: [4, 3, 4, 3], usage: [8, 7, 8, 9] });
  s.ap = 2;
  s.audits = [];
});
await go('HubScene');
await wait(300);
await press('3', 700);
await press('Tab', 400);
await ev(() => {
  window.__rtf.scene.selSpec = 'calling';
  window.__rtf.scene.placeFocus = true;
});
await wait(200);
await press('ArrowRight');
await press('Enter', 500);
const booked = await ev(() => window.__rtf.state.audits.some((a) => a.spec === 'calling'));
check('Enter on the reference button books it', booked && (await dialogs()) === 1);
await shot('pc-booked');
await press('Enter', 500);
check('Enter closes the booking confirmation', (await dialogs()) === 0);
st = await pc();
check('the booked specialization stays selected', st.spec === 'calling' && st.side === 'list', JSON.stringify(st));
await press('Shift+Tab', 400);
await ev(() => {
  window.__rtf.state.designations = [];
  window.__rtf.scene.selArea = 'modern';
  window.__rtf.scene.placeFocus = true;
});
await wait(200);
await press('ArrowRight');
st = await pc();
check('Right moves to the purchase button', st.tab === 'sp' && st.side === 'book', JSON.stringify(st));
await press('Enter', 500);
const bought = await ev(() => window.__rtf.state.designations.some((d) => d.area === 'modern'));
check('Enter buys the designation', bought && (await dialogs()) === 1);
await press('Enter', 500);
check('Enter closes the purchase confirmation', (await dialogs()) === 0);
st = await pc();
check('the new designation stays selected', st.area === 'modern' && st.side === 'list', JSON.stringify(st));
await press('Escape', 700);
await ev(() => {
  const s = window.__rtf.state;
  s.designations = [
    { area: 'modern', since: 0, renewAt: 8 },
    { area: 'security', since: 0, renewAt: 8 },
  ];
  s.audits = [];
});

// --- Names in tight and roomy places --------------------------------------------------
await ev(() => {
  const s = window.__rtf.state;
  s.focus = { primary: 'modern', secondary: 'dai' };
});
await go('HubScene');
await wait(300);
await shot('hub-names');
await press('2', 600);
await shot('programmes-names');
await press('Escape', 600);
await press('5', 600);
await shot('customers-names');
await press('Escape', 600);
await ev(() => {
  const s = window.__rtf.state;
  window.__smokeKeys = s.key;
  s.key = [];
  const t = { sales: 2, inter: 4, adv: 1, keyRevenue: 0, skeleton: false, culture: false, diligence: false };
  s.targets = [
    { ...t, id: 901, name: 'Contoso Workplace Ltd', area: 'modern', tech: 12, customers: 18, price: 1250, expires: s.turn + 2 },
    { ...t, id: 902, name: 'Fabrikam App Studio', area: 'dai', tech: 8, customers: 9, price: 800, expires: s.turn + 1 },
  ];
});
await go('HubScene');
await wait(250);
await press('5', 600);
await shot('customers-for-sale');
await press('Escape', 600);
await ev(() => {
  const s = window.__rtf.state;
  s.key = window.__smokeKeys;
  s.targets = [];
});

// --- PDMs: portraits, and the new PDM introduces themselves ----------------------------
await ev(() => {
  const s = window.__rtf.state;
  s.mpl = true;
  s.flags.mplSince = 0;
});
for (const [i, name] of ['alex', 'priya', 'kwame', 'mei', 'aisha', 'diego'].entries()) {
  await ev((n) => (window.__rtf.state.flags.pdm = n), i);
  await go('HubScene');
  await wait(250);
  await shot(`pdm-${name}`, { x: 264, y: 264, width: 376, height: 224 });
}
await ev(() => {
  const s = window.__rtf.state;
  s.turn = 8;
  s.phase = 'plan';
  s.flags.pdm = 4;
  s.flags.pdmPrev = 0;
  s.flags.pdmReason = 2;
  s.flags.pdmSince = 8;
});
await go('PlanScene');
await wait(500);
await shot('plan-new-pdm');
const intro = await ev(() => window.__rtf.state.flags.pdm);
check('new PDM briefing shown', intro === 4);

// --- A tune per financial year --------------------------------------------------------
check('FY29 plan plays the FY29 tune', (await song()) === 'hub3', await song());
await ev(() => {
  const s = window.__rtf.state;
  s.turn = 7; // FY28 Q4
  s.phase = 'hub';
  s.pending = [];
  s.cash = 5000;
  s.flags.pdmNext = 99;
});
await go('HubScene');
await wait(300);
check('FY28 hub plays the FY28 tune', (await song()) === 'hub2', await song());
await press('7', 400);
await press('Enter', 2600);
check('Q4 report keeps the FY28 tune', (await song()) === 'hub2', await song());
await press('Escape', 900);
check('year-end review keeps the FY28 tune', (await song()) === 'hub2', await song());
await shot('yearend-fy28');
await press('Enter', 900);
check('FY29 plan switches to the FY29 tune', (await song()) === 'hub3', await song());
await shot('plan-briefing-fy29');
for (const [turn, want] of [[12, 'hub4'], [16, 'hub'], [20, 'hub2']]) {
  await ev((t) => (window.__rtf.state.turn = t), turn);
  await go('PlanScene');
  await wait(200);
  check(`FY${27 + turn / 4} plays ${want}`, (await song()) === want, await song());
}

// --- Render each FY tune offline: no clipping, no silence, similar loudness -----------
const stats = {};
for (const name of ['hub', 'hub2', 'hub3', 'hub4']) {
  const r = await ev(async (n) => {
    let d = await window.__rtfAudio.renderSong(n, 32, 22050);
    let peak = 0;
    let sum = 0;
    let nan = 0;
    const perSec = [];
    for (let s = 0; s < Math.floor(d.length / 22050); s++) {
      let q = 0;
      for (let i = s * 22050; i < (s + 1) * 22050; i++) q += d[i] * d[i];
      perSec.push(Math.sqrt(q / 22050));
    }
    const pcm = new Int16Array(d.length);
    for (let i = 0; i < d.length; i++) {
      const v = d[i];
      if (Number.isNaN(v)) nan++;
      peak = Math.max(peak, Math.abs(v));
      sum += v * v;
      pcm[i] = Math.max(-32768, Math.min(32767, Math.round(v * 32767)));
    }
    // Rough perceived loudness: RMS after two 150 Hz high-pass stages, as bass sounds quieter than it measures
    let w = 0;
    for (const _ of [0, 1]) {
      const a = 1 / (1 + 2 * Math.PI * 150 / 22050);
      let y = 0;
      let x0 = d[0];
      const out = new Float32Array(d.length);
      for (let i = 1; i < d.length; i++) {
        y = a * (y + d[i] - x0);
        x0 = d[i];
        out[i] = y;
      }
      d = out;
    }
    for (let i = 0; i < d.length; i++) w += d[i] * d[i];
    const bytes = new Uint8Array(pcm.buffer);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return { peak, rms: Math.sqrt(sum / d.length), weighted: Math.sqrt(w / d.length), nan, quietest: Math.min(...perSec), b64: btoa(bin), len: d.length };
  }, name);
  const data = Buffer.from(r.b64, 'base64');
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(22050, 24);
  header.writeUInt32LE(44100, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  writeFileSync(`screenshots/music/${name}.wav`, Buffer.concat([header, data]));
  stats[name] = { peak: +r.peak.toFixed(3), rms: +r.rms.toFixed(4), weighted: +r.weighted.toFixed(4), quietest: +r.quietest.toFixed(4), nan: r.nan, seconds: r.len / 22050 };
}
console.log('MUSIC', JSON.stringify(stats));
for (const [name, x] of Object.entries(stats)) {
  check(`${name}: rendered without NaNs or clipping`, x.nan === 0 && x.peak < 0.99 && x.seconds >= 31, JSON.stringify(x));
  check(`${name}: never silent`, x.quietest > 0.005, String(x.quietest));
  const ratio = x.rms / stats.hub.rms;
  check(`${name}: level close to the original tune`, ratio > 0.6 && ratio < 1.7, ratio.toFixed(2));
  const db = 20 * Math.log10(x.weighted / stats.hub.weighted);
  check(`${name}: perceived loudness within 2.5 dB of the original tune`, Math.abs(db) <= 2.5, `${db.toFixed(1)} dB`);
}

console.log('FAILURES:', failures.length ? failures.join(', ') : 'none');
console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
await browser.close();
process.exit(failures.length || errors.length ? 1 : 0);
