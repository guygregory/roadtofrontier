import type { App, Scene } from '../app';
import { audio } from '../engine/audio';
import { C } from '../engine/palette';
import { text, paragraph } from '../engine/font';
import { burst, drawParticles, Particle, starfield, titleText, updateParticles } from '../engine/fx';
import { panel, ui } from '../engine/ui';
import { icon, msLogo } from '../engine/sprites';
import { AREA, AREAS, AreaId } from '../game/data';
import { money, turnLabel } from '../game/format';
import { finalScore } from '../game/score';
import { totalCustomers } from '../game/rules';
import { ShareScene } from './share';
import { TitleScene } from './title';

/** Designations held, using the fullest area names that fit the 53-character stats line. */
function designationList(areas: AreaId[]): string {
  if (areas.length === 0) return 'none';
  for (const key of ['label', 'mid'] as const) {
    const t = areas.map((a) => AREA[a][key]).join(', ');
    if (t.length <= 39) return t;
  }
  const short = areas.map((a) => AREA[a].short).join(', ');
  if (short.length <= 39) return short;
  return areas.length === AREAS.length ? `all ${AREAS.length} areas` : `${areas.length} of ${AREAS.length} areas`;
}

export class EndingScene implements Scene {
  music: string | undefined = '';
  private parts: Particle[] = [];
  private t0 = -1;
  private stage = 0;
  private burstT = 0;

  enter(app: App): void {
    const s = app.state;
    if (!s) return;
    audio.playSong(s.status === 'won' ? 'win' : 'lose');
    // Coming back from the share screen: keep the ending tune playing.
    this.music = undefined;
  }

  frame(app: App, dt: number): void {
    const s = app.state;
    const g = app.g;
    if (!s) return;
    if (this.t0 < 0) this.t0 = app.t;
    const e = app.t - this.t0;
    if (s.status === 'won') this.win(app, dt, e);
    else this.lose(app, e);
    void g;
  }

  private stats(app: App, y: number): number {
    const s = app.state!;
    const g = app.g;
    const lines = [
      `Finished: ${turnLabel(s.flags.endTurn ?? Math.max(0, s.turn - 1))}`,
      `Designations: ${designationList(s.designations.map((d) => d.area))}`,
      `Specializations: ${s.specs.length}   Offers: ${s.offers.filter((o) => o.published).length}`,
      `Customers: ${totalCustomers(s)}   Staff: ${s.tech + s.sales}`,
      `Cash: ${money(s.cash)}   Revenue/qtr: ${money(s.lastReport?.revenue.total ?? 0)}`,
    ];
    for (const l of lines) {
      text(g, l, 160, y, C.WHITE, { align: 'center' });
      y += 10;
    }
    return y;
  }

  private finish(app: App, y: number): void {
    const s = app.state!;
    const score = finalScore(s);
    text(app.g, `SCORE ${score}`, 160, y, C.YELLOW, { align: 'center', bold: true, shadow: C.BLACK });
    if (ui.button(84, y + 14, 74, 14, 'SHARE ►', { style: 'box' })) app.go(new ShareScene(this, score));
    if (ui.button(162, y + 14, 74, 14, 'TITLE ►', { style: 'box' })) app.go(new TitleScene());
  }

  private win(app: App, dt: number, e: number): void {
    const s = app.state!;
    const g = app.g;
    g.fill(C.BLACK);
    starfield(g, app.t, 256, 15);
    this.burstT -= dt;
    if (this.burstT <= 0) {
      this.burstT = 0.5;
      burst(this.parts, 40 + Math.random() * 240, 30 + Math.random() * 100, 40, [C.MSRED, C.MSGREEN, C.MSBLUE, C.MSYELLOW, C.WHITE]);
      audio.sfx('tick');
    }
    updateParticles(this.parts, dt);
    drawParticles(g, this.parts);
    const frontier = s.endKind === 'frontier';
    titleText(g, frontier ? 'FRONTIER' : 'PARTNER OF', 160, 14, 3, ['fff', 'ff6', 'fb0', 'f93'], app.t, 2);
    titleText(g, frontier ? 'PARTNER!' : 'THE YEAR!', 160, 44, 3, ['fff', '6df', '0af', '048'], app.t + 1, 2);
    g.blit(icon(frontier ? 'rocket' : 'trophy'), 144, 76, { scale: 2 });
    msLogo(g, 112, 84, 6, 1);
    msLogo(g, 194, 84, 6, 1);
    panel(g, 20, 112, 280, 140);
    paragraph(g, s.endReason, 30, 120, 260, C.CREAM, 10);
    let y = this.stats(app, 150);
    if (e > 1.5) this.finish(app, y + 4);
    y += 0;
  }

  private lose(app: App, e: number): void {
    const s = app.state!;
    const g = app.g;
    g.fill(C.BLACK);
    if (this.stage === 0) {
      // Amiga "Guru Meditation" homage
      const on = Math.floor(e * 1.5) % 2 === 0;
      const col = C.RED;
      if (on) {
        g.frame(8, 8, 304, 60, col);
        g.frame(9, 9, 302, 58, col);
        g.frame(10, 10, 300, 56, col);
      }
      text(g, 'Business Failure.  Press mouse button to continue.', 160, 22, col, { align: 'center' });
      const code = s.endKind === 'bankrupt' ? '0000000B.ANKRUPT' : '0000000D.EMBERED';
      text(g, `Guru Meditation #${code}`, 160, 40, col, { align: 'center' });
      paragraph(g, s.endReason, 24, 90, 272, C.LGREY, 10);
      text(g, 'CLICK TO CONTINUE', 160, 236, Math.floor(e * 2) % 2 ? C.GREY : C.DGREY, { align: 'center' });
      if (e > 0.6 && (app.input.clicked || app.input.anyKey)) {
        this.stage = 1;
        this.t0 = app.t;
        ui.reset();
      }
      return;
    }
    starfield(g, app.t, 256, 6);
    titleText(g, 'GAME OVER', 160, 20, 3, ['fff', 'ccc', 'f52', '700'], app.t, 1);
    const title = s.endKind === 'bankrupt' ? 'OUT OF BUSINESS' : 'MEMBERSHIP REMOVED';
    text(g, title, 160, 56, C.ORANGE, { align: 'center', bold: true });
    panel(g, 20, 70, 280, 180);
    paragraph(g, s.endReason, 30, 78, 260, C.CREAM, 10);
    const y = this.stats(app, 118);
    this.finish(app, y + 8);
  }
}
