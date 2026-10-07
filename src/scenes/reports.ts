import type { App, Scene } from '../app';
import type { Gfx } from '../engine/gfx';
import { C } from '../engine/palette';
import { text } from '../engine/font';
import { panel, ui } from '../engine/ui';
import { AREA, AREAS } from '../game/data';
import { money, turnLabel } from '../game/format';
import type { HistoryPoint } from '../game/types';
import { background, footer, header, keyHint, requireState } from './common';
import { HubScene } from './hub';
import { drawReportPage, REPORT_PAGES } from './report';

function chart(g: Gfx, x: number, y: number, w: number, h: number, hist: HistoryPoint[], series: { get: (p: HistoryPoint) => number; col: number }[], fixedMax?: number): void {
  g.rect(x, y, w, h, C.BLACK);
  for (let i = 1; i < 4; i++) g.hline(x, x + w - 1, y + Math.round((h * i) / 4), C.NAVY);
  if (hist.length === 0) {
    text(g, 'No history yet - end a quarter first.', x + w / 2, y + h / 2 - 4, C.GREY, { align: 'center' });
    return;
  }
  let max = fixedMax ?? 1;
  let min = 0;
  if (fixedMax === undefined) {
    for (const p of hist) for (const s of series) {
      max = Math.max(max, s.get(p));
      min = Math.min(min, s.get(p));
    }
  }
  const n = Math.max(2, hist.length);
  const px = (i: number) => x + 2 + Math.round(((w - 4) * i) / (n - 1));
  const py = (v: number) => y + h - 2 - Math.round(((h - 4) * (v - min)) / Math.max(1, max - min));
  if (min < 0) g.hline(x, x + w - 1, py(0), C.DRED);
  for (const s of series) {
    for (let i = 0; i < hist.length; i++) {
      const v = s.get(hist[i]);
      if (i > 0) g.line(px(i - 1), py(s.get(hist[i - 1])), px(i), py(v), s.col);
      g.rect(px(i) - 1, py(v) - 1, 2, 2, s.col);
    }
  }
  if (fixedMax === undefined) {
    text(g, money(max), x + 2, y + 2, C.GREY);
    if (min < 0) text(g, money(min), x + 2, y + h - 10, C.GREY);
  }
}

export class ReportsScene implements Scene {
  music = 'hub';
  private tab = 0;
  private page = 0;

  frame(app: App): void {
    const s = requireState(app);
    const g = app.g;
    background(g);
    header(app, 'REPORTS');
    ['LAST QUARTER', 'MONEY', 'CAPABILITY'].forEach((l, i) => {
      if (ui.button(2 + i * 106, 16, 104, 13, l, { style: 'tab', selected: this.tab === i })) this.tab = i;
    });
    if (this.tab === 0) {
      if (!s.lastReport) {
        panel(g, 4, 31, 312, 196, 'LAST QUARTER');
        text(g, 'No quarters completed yet.', 160, 120, C.GREY, { align: 'center' });
      } else {
        panel(g, 4, 31, 312, 196, `${turnLabel(s.lastReport.turn)}: ${REPORT_PAGES[this.page]}`);
        g.clip(4, 44, 312, 183);
        g.translate(0, 12);
        drawReportPage(g, s.lastReport, this.page);
        g.translate(0, 0);
        g.unclip();
        if (ui.button(4, 230, 60, 13, '◄', { style: 'box', disabled: this.page === 0 })) this.page = Math.max(0, this.page - 1);
        if (ui.button(68, 230, 60, 13, '►', { style: 'box', disabled: this.page === REPORT_PAGES.length - 1 })) this.page = Math.min(REPORT_PAGES.length - 1, this.page + 1);
      }
    } else if (this.tab === 1) {
      panel(g, 4, 31, 312, 196, 'REVENUE, PROFIT & CASH BY QUARTER');
      chart(g, 12, 48, 296, 140, s.history, [
        { get: (p) => p.revenue, col: C.GREEN },
        { get: (p) => p.profit, col: C.ORANGE },
        { get: (p) => p.cash, col: C.YELLOW },
      ]);
      text(g, '{g}■ REVENUE{/}  {o}■ PROFIT{/}  {y}■ CASH{/}', 12, 194, C.WHITE);
      const best = s.history.reduce((m, h) => Math.max(m, h.revenue), 0);
      text(g, `Peak quarterly revenue: ${money(best)}`, 12, 206, C.LGREY);
    } else {
      panel(g, 4, 31, 312, 196, 'PARTNER CAPABILITY SCORE BY QUARTER');
      chart(
        g,
        12,
        48,
        296,
        140,
        s.history,
        AREAS.map((a) => ({ get: (p: HistoryPoint) => p.pcs[a], col: AREA[a].colour })),
        100,
      );
      const y70 = 48 + 140 - 2 - Math.round(136 * 0.7);
      g.hline(12, 307, y70, C.DGREY);
      text(g, '70', 300, y70 - 9, C.GREY);
      AREAS.forEach((a, i) => text(g, AREA[a].short, 12 + i * 50, 196, AREA[a].colour));
    }
    if (ui.button(262, 230, 54, 13, 'DONE', { style: 'box' }) || ui.back()) app.go(new HubScene());
    footer(app, keyHint(app));
  }
}
