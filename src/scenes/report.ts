import type { App, Scene } from '../app';
import { audio } from '../engine/audio';
import type { Gfx } from '../engine/gfx';
import { C, gradient12 } from '../engine/palette';
import { text, wrap } from '../engine/font';
import { bar, panel, ui } from '../engine/ui';
import { AREA, AREAS } from '../game/data';
import { credits, money, signedMoney, turnLabel } from '../game/format';
import type { QuarterReport } from '../game/types';
import { background, footer, header, requireState, signCol } from './common';
import { reportDone } from './flow';

export class ProcessingScene implements Scene {
  private t0 = -1;
  private done = false;
  constructor(private then: () => void) {}

  frame(app: App, dt: number): void {
    const g = app.g;
    if (this.t0 < 0) this.t0 = app.t;
    const e = app.t - this.t0;
    g.fill(C.BLACK);
    for (let y = 0; y < 256; y += 2) g.rectRGB(0, y, 320, 1, gradient12(['012', '024', '012'], y / 256));
    const s = app.state;
    panel(g, 50, 96, 220, 64, 'PLEASE WAIT');
    text(g, `CLOSING THE BOOKS: ${s ? turnLabel(s.turn) : ''}`, 160, 116, C.WHITE, { align: 'center' });
    const p = Math.min(1, e / 1.1);
    g.rect(62, 132, 196, 10, C.NEARBLACK);
    for (let x = 0; x < Math.floor(196 * p); x++) g.rectRGB(62 + x, 132, 1, 10, gradient12(['f52', 'fb0', '8b0', '0af'], x / 196));
    g.frame(61, 131, 198, 12, C.LSLATE);
    if (Math.floor(e * 5) !== Math.floor((e - dt) * 5)) audio.sfx('disk');
    if (!this.done && (e > 1.2 || (app.input.clicked && e > 0.2))) {
      this.done = true;
      this.then();
    }
  }
}

export const REPORT_PAGES = ['FINANCIALS', 'OPERATIONS', 'CAPABILITY', 'NOTICES'];

/** Draw one page of a quarter report into the content area (y 30..226). */
export function drawReportPage(g: Gfx, r: QuarterReport, page: number): void {
  const L = 10;
  const R = 150;
  const L2 = 166;
  const R2 = 310;
  if (page === 0) {
    text(g, 'REVENUE', L, 34, C.CYAN);
    const rev: [string, number][] = [
      ['Services', r.revenue.services],
      ['Repeatable offers', r.revenue.offers],
      ['CSP licence margin', r.revenue.csp],
      ['Partner incentives', r.revenue.incentives],
    ];
    rev.forEach(([l, v], i) => {
      text(g, l, L, 46 + i * 10, C.LGREY);
      text(g, money(v), R, 46 + i * 10, C.WHITE, { align: 'right' });
    });
    g.hline(L, R, 87, C.SLATE);
    text(g, 'Total', L, 90, C.WHITE);
    text(g, money(r.revenue.total), R, 90, C.GREEN, { align: 'right' });

    text(g, 'RUNNING COSTS', L2, 34, C.CYAN);
    const cost: [string, number][] = [
      ['Salaries', r.costs.salaries],
      ['Overheads', r.costs.overhead],
      ['Programmes', r.costs.programmes],
      ['Unified/offers/etc', r.costs.other],
      ['Interest', r.costs.interest],
    ];
    cost.forEach(([l, v], i) => {
      text(g, l, L2, 46 + i * 10, C.LGREY);
      text(g, money(v), R2, 46 + i * 10, C.WHITE, { align: 'right' });
    });
    g.hline(L2, R2, 97, C.SLATE);
    text(g, 'Total', L2, 100, C.WHITE);
    text(g, money(r.costs.total), R2, 100, C.ORANGE, { align: 'right' });

    g.rect(L, 120, R2 - L, 70, C.NAVY);
    text(g, 'Operating profit', L + 6, 126, C.WHITE);
    text(g, signedMoney(r.profit), R2 - 6, 126, signCol(r.profit), { align: 'right' });
    text(g, 'One-off spending (actions, events)', L + 6, 138, C.LGREY);
    text(g, money(-r.oneOff), R2 - 6, 138, r.oneOff > 0 ? C.ORANGE : C.LGREY, { align: 'right' });
    if (r.coopUsed > 0) {
      text(g, 'Marketing paid by co-op funds', L + 6, 150, C.LGREY);
      text(g, money(r.coopUsed), R2 - 6, 150, C.CYAN, { align: 'right' });
    }
    const azureUsed = r.azureUsed ?? 0;
    if (azureUsed > 0) {
      const ay = r.coopUsed > 0 ? 159 : 150;
      text(g, 'Azure usage paid by Azure credits', L + 6, ay, C.LGREY);
      text(g, credits(azureUsed), R2 - 6, ay, C.CYAN, { align: 'right' });
    }
    text(g, 'Cash at quarter end', L + 6, 168, C.WHITE, { bold: true });
    text(g, money(r.cashEnd), R2 - 6, 168, r.cashEnd < 0 ? C.RED : C.YELLOW, { align: 'right', bold: true });
    text(g, `Team utilisation ${Math.round(r.utilisation * 100)}%`, L + 6, 180, r.utilisation > 1.05 ? C.RED : r.utilisation < 0.7 ? C.ORANGE : C.GREEN);
    text(g, r.utilisation > 1.05 ? 'Hire engineers!' : r.utilisation < 0.7 ? 'Grow sales!' : 'Healthy workload', R2 - 6, 180, C.LSLATE, { align: 'right' });
  } else if (page === 1) {
    const won = AREAS.reduce((n, a) => n + (r.wins[a] ?? 0), 0);
    text(g, 'CUSTOMERS', L, 34, C.CYAN);
    text(g, `Won: {g}${won}{/}   Lost: {r}${r.lost}{/}`, L, 46, C.WHITE);
    AREAS.filter((a) => (r.wins[a] ?? 0) > 0).forEach((a, i) => text(g, `${AREA[a].short}: +${r.wins[a]}`, L + (i % 3) * 100, 58 + Math.floor(i / 3) * 10, AREA[a].colour));
    let y = 82;
    text(g, 'KEY ACCOUNTS', L, y, C.CYAN);
    y += 12;
    if (r.newKey.length === 0 && r.lostKey.length === 0) {
      text(g, 'No change.', L, y, C.GREY);
      y += 10;
    }
    r.newKey.forEach((k) => {
      text(g, `+ ${k}`, L, y, C.GREEN);
      y += 10;
    });
    r.lostKey.forEach((k) => {
      text(g, `- ${k}`, L, y, C.RED);
      y += 10;
    });
    y = Math.max(y + 6, 130);
    text(g, 'DELIVERY', L, y, C.CYAN);
    text(g, `Projects ${r.projects}   Deployed {g}${r.successes}{/}   Failed ${r.failures ? '{r}' : ''}${r.failures}{/}`, L, y + 12, C.WHITE);
    text(g, 'SKILLS', L, y + 30, C.CYAN);
    text(g, `New certifications: {g}${r.certs.inter} intermediate, ${r.certs.adv} advanced{/}`, L, y + 42, C.WHITE);
    if (r.leavers > 0) text(g, `{o}${r.leavers} staff resigned this quarter.{/}`, L, y + 54, C.WHITE);
  } else if (page === 2) {
    text(g, 'PARTNER CAPABILITY SCORE CHANGES', L, 34, C.CYAN);
    AREAS.forEach((a, i) => {
      const y = 50 + i * 24;
      const prev = r.pcsPrev[a];
      const now = r.pcs[a];
      g.rect(L, y + 2, 5, 8, AREA[a].colour);
      text(g, AREA[a].name, L + 9, y, C.WHITE);
      bar(g, L + 9, y + 11, 200, 6, now, 100, now >= 70 ? C.YELLOW : AREA[a].colour, 70);
      const d = now - prev;
      text(g, `${prev} ► ${now}`, R2, y + 1, C.LGREY, { align: 'right' });
      text(g, d === 0 ? '=' : d > 0 ? `+${d}` : String(d), R2, y + 11, signCol(d), { align: 'right' });
    });
  } else {
    text(g, 'NOTICES', L, 34, C.CYAN);
    let y = 48;
    if (r.notices.length === 0) text(g, 'A quiet quarter. No news is good news.', L, y, C.GREY);
    for (const n of r.notices) {
      for (const l of wrap(`• ${n}`, 296)) {
        if (y > 220) break;
        text(g, l, L, y, C.WHITE);
        y += 10;
      }
      y += 2;
    }
  }
}

export class ReportScene implements Scene {
  // Keep the current tune: after Q4 the turn has already moved into the next FY, whose tune starts with its plan.
  music = undefined;
  private page = 0;
  constructor(private r: QuarterReport) {}

  enter(): void {
    audio.sfx(this.r.profit >= 0 ? 'coin' : 'error');
  }

  frame(app: App): void {
    const s = requireState(app);
    const g = app.g;
    background(g);
    header(app, `${turnLabel(this.r.turn)} REPORT`);
    panel(g, 4, 18, 312, 210, `${REPORT_PAGES[this.page]}  (${this.page + 1}/${REPORT_PAGES.length})`);
    drawReportPage(g, this.r, this.page);
    const last = this.page === REPORT_PAGES.length - 1;
    if (this.page > 0 && (ui.button(4, 230, 70, 13, '◄ PREV', { style: 'box' }) || app.input.take('left'))) this.page--;
    if (ui.button(222, 230, 94, 13, last ? 'CONTINUE ►' : 'NEXT ►', { style: 'box' }) || (!last && app.input.take('right'))) {
      if (last) reportDone(app);
      else this.page++;
    }
    if (ui.back()) reportDone(app);
    void s;
    footer(app, 'LEFT/RIGHT CHANGE PAGE  ESC SKIP');
  }
}
