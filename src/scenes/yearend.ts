import type { App, Scene } from '../app';
import { audio } from '../engine/audio';
import { C } from '../engine/palette';
import { text, wrap } from '../engine/font';
import { panel, ui } from '../engine/ui';
import { icon } from '../engine/sprites';
import { money, pct } from '../game/format';
import type { YearEndReport } from '../game/types';
import { background, footer, header, keyHint, requireState } from './common';
import { yearEndDone } from './flow';

export class YearEndScene implements Scene {
  // Keep the outgoing year's tune; the next one starts with the FY plan.
  music = undefined;
  private t0 = -1;
  private revealed = false;
  constructor(private r: YearEndReport) {}

  frame(app: App): void {
    requireState(app);
    const g = app.g;
    if (this.t0 < 0) this.t0 = app.t;
    const e = app.t - this.t0;
    background(g);
    header(app, `FY${this.r.fy} REVIEW`);
    panel(g, 4, 18, 312, 210, `FY${this.r.fy} IN REVIEW`);
    text(g, 'Revenue', 12, 36, C.LGREY);
    text(g, money(this.r.revenue), 150, 36, C.GREEN, { align: 'right' });
    text(g, 'Operating profit', 12, 46, C.LGREY);
    text(g, money(this.r.profit), 150, 46, this.r.profit >= 0 ? C.GREEN : C.RED, { align: 'right' });

    let y = 64;
    text(g, 'PARTNER OF THE YEAR AWARDS', 12, y, C.CYAN);
    y += 12;
    if (this.r.poty.length === 0) {
      text(g, 'You did not submit a nomination this year.', 12, y, C.GREY);
      y += 10;
    } else {
      g.blit(icon('trophy'), 290, 60);
      for (const p of this.r.poty) {
        text(g, `${p.category} (est. ${pct(p.chance)})`, 12, y, C.WHITE);
        y += 10;
        if (e < 2.2) {
          const dots = '.'.repeat(1 + (Math.floor(e * 4) % 4));
          text(g, `And the winner is${dots}`, 20, y, C.YELLOW);
          if (Math.floor(e * 10) % 2 === 0) audio.sfx('tick');
        } else {
          if (!this.revealed) {
            this.revealed = true;
            audio.sfx(this.r.poty.some((x) => x.result === 'winner') ? 'levelup' : this.r.poty.some((x) => x.result === 'finalist') ? 'good' : 'back');
          }
          const msg = p.result === 'winner' ? '{y}*** YOU WON! ***{/}' : p.result === 'finalist' ? '{g}Finalist!{/} +8 reputation' : 'Not this time. Keep building your story.';
          text(g, msg, 20, y, C.WHITE);
        }
        y += 14;
      }
    }
    y += 4;
    text(g, 'MEMBERSHIP & RENEWALS', 12, y, C.CYAN);
    y += 12;
    for (const n of this.r.notices) {
      for (const l of wrap(`• ${n}`, 296)) {
        if (y > 218) break;
        text(g, l, 12, y, C.WHITE);
        y += 10;
      }
    }
    const ready = this.r.poty.length === 0 || e >= 2.2;
    if (ready && (ui.button(196, 230, 120, 13, 'CONTINUE ►', { style: 'box' }) || ui.back())) yearEndDone(app);
    footer(app, keyHint(app));
  }
}
