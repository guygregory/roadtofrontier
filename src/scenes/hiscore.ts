import type { App, Scene } from '../app';
import { audio } from '../engine/audio';
import { C } from '../engine/palette';
import { text } from '../engine/font';
import { copperSky, starfield, titleText } from '../engine/fx';
import { ui } from '../engine/ui';
import { addScore, loadScores } from '../game/save';
import { TitleScene } from './title';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ';

export class HiscoreScene implements Scene {
  music = 'title';
  private initials = ['A', 'A', 'A'];
  private pos = 0;
  private highlight = -1;

  constructor(private entry: { score: number; company: string; result: string } | null = null) {}

  enter(app: App): void {
    if (this.entry) app.input.textMode = true;
  }

  frame(app: App): void {
    const g = app.g;
    const inp = app.input;
    copperSky(g, 0, 256, ['012', '024', '137', '024', '012']);
    starfield(g, app.t, 256, 10);
    titleText(g, 'HALL OF FAME', 160, 10, 2, ['ff6', 'fb0', 'f52'], app.t, 1);

    if (this.entry) {
      text(g, 'NEW HIGH SCORE! ENTER YOUR INITIALS', 160, 38, C.WHITE, { align: 'center' });
      for (let i = 0; i < 3; i++) {
        const x = 136 + i * 18;
        g.rect(x - 2, 52, 14, 20, i === this.pos ? C.ROYAL : C.NAVY);
        text(g, this.initials[i], x, 55, i === this.pos && Math.floor(app.t * 4) % 2 ? C.WHITE : C.YELLOW, { scale: 2 });
      }
      const cycle = (d: number) => {
        const idx = LETTERS.indexOf(this.initials[this.pos]);
        this.initials[this.pos] = LETTERS[(idx + d + LETTERS.length) % LETTERS.length];
        audio.sfx('move');
      };
      if (inp.take('up')) cycle(1);
      if (inp.take('down')) cycle(-1);
      if (inp.take('left')) this.pos = Math.max(0, this.pos - 1);
      if (inp.take('right')) this.pos = Math.min(2, this.pos + 1);
      for (const ch of inp.typed) {
        const c = ch.toUpperCase();
        if (LETTERS.includes(c) && c !== ' ') {
          this.initials[this.pos] = c;
          audio.sfx('type');
          if (this.pos < 2) this.pos++;
        }
      }
      if (inp.take('backspace')) this.pos = Math.max(0, this.pos - 1);
      text(g, 'TYPE OR USE ARROWS, ENTER TO SAVE', 160, 78, C.LSLATE, { align: 'center' });
      if (ui.button(120, 90, 80, 13, 'SAVE', { style: 'box' })) {
        this.highlight = addScore({
          initials: this.initials.join(''),
          company: this.entry.company,
          score: this.entry.score,
          result: this.entry.result,
          date: new Date().toISOString().slice(0, 10),
        });
        this.entry = null;
        inp.textMode = false;
        audio.sfx('levelup');
      }
      return;
    }

    const list = loadScores();
    text(g, 'RANK  NAME  COMPANY            RESULT       SCORE', 14, 44, C.CYAN);
    list.forEach((h, i) => {
      const y = 58 + i * 16;
      const col = i === this.highlight && Math.floor(app.t * 4) % 2 ? C.WHITE : i === 0 ? C.YELLOW : i < 3 ? C.ORANGE : C.LGREY;
      text(g, `${String(i + 1).padStart(2)}.   ${h.initials.padEnd(3)}   ${h.company.slice(0, 18).padEnd(18)} ${h.result.padEnd(10)}`, 14, y, col);
      text(g, String(h.score), 306, y, col, { align: 'right' });
    });
    if (ui.button(120, 222, 80, 14, 'TITLE', { style: 'box' }) || ui.back()) app.go(new TitleScene());
  }
}
