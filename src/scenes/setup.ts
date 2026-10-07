import type { App, Scene } from '../app';
import { audio } from '../engine/audio';
import { C } from '../engine/palette';
import { text, paragraph } from '../engine/font';
import { panel, ui } from '../engine/ui';
import { SPR } from '../engine/sprites';
import { AREA, DIFFICULTY, Difficulty, HERITAGES } from '../game/data';
import { newGame } from '../game/state';
import { background, footer, header, keyHint } from './common';
import { PlanScene } from './plan';
import { TitleScene } from './title';

const DEFAULT_NAMES = ['Pixel Partners', 'Copper Cloud', 'Byte Bros', 'Blitter Labs', 'Paula Digital', 'Agnus Advisory', 'Denise Data'];

export class SetupScene implements Scene {
  music = 'title';
  private step = 0;
  private name = DEFAULT_NAMES[Math.floor(Math.random() * DEFAULT_NAMES.length)];
  private heritage = 0;
  private difficulty: Difficulty = 'normal';

  enter(app: App): void {
    app.input.textMode = true;
  }

  frame(app: App): void {
    const g = app.g;
    background(g);
    header(app, 'NEW COMPANY');
    const steps = ['NAME', 'HERITAGE', 'DIFFICULTY', 'WELCOME'];
    steps.forEach((s, i) => text(g, `${i + 1}.${s}`, 8 + i * 78, 19, i === this.step ? C.YELLOW : i < this.step ? C.GREEN : C.GREY));
    if (this.step === 0) this.nameStep(app);
    else if (this.step === 1) this.heritageStep(app);
    else if (this.step === 2) this.difficultyStep(app);
    else this.welcomeStep(app);
    footer(app, this.step === 0 ? 'TYPE A NAME, ENTER TO CONTINUE, ESC TO GO BACK' : keyHint(app));
  }

  private back(app: App): void {
    if (this.step === 0) app.go(new TitleScene());
    else {
      this.step--;
      app.input.textMode = this.step === 0;
      ui.reset(this.step === 1 ? this.heritage : 0);
    }
  }

  private nameStep(app: App): void {
    const g = app.g;
    const inp = app.input;
    panel(g, 20, 36, 280, 120, 'NAME YOUR COMPANY');
    paragraph(g, 'Every great partner starts somewhere. What is your company called?', 30, 56, 260, C.LGREY);
    g.bevel(30, 84, 260, 16, C.BLACK, C.BLACK, C.LSLATE, true);
    for (const ch of inp.typed) {
      if (this.name.length < 22 && /[A-Za-z0-9 &.'\-]/.test(ch)) {
        this.name += ch;
        audio.sfx('type');
      }
    }
    if (inp.take('backspace') && this.name.length > 0) {
      this.name = this.name.slice(0, -1);
      audio.sfx('type');
    }
    const cursor = Math.floor(app.t * 3) % 2 ? '_' : ' ';
    text(g, this.name + cursor, 36, 89, C.YELLOW);
    text(g, `${this.name.length}/22`, 286, 104, C.GREY, { align: 'right' });
    const ok = this.name.trim().length > 0;
    if (ui.button(110, 124, 100, 14, 'CONTINUE', { style: 'box', disabled: !ok }) && ok) {
      this.step = 1;
      inp.textMode = false;
      ui.reset(0);
    }
    if (inp.take('back')) this.back(app);
  }

  private heritageStep(app: App): void {
    const g = app.g;
    panel(g, 6, 32, 308, 210, 'CHOOSE YOUR HERITAGE');
    text(g, 'Your existing practice. You start partway to that', 14, 50, C.LGREY);
    text(g, 'Solutions Partner designation.', 14, 60, C.LGREY);
    HERITAGES.forEach((h, i) => {
      const y = 74 + i * 15;
      g.rect(14, y + 3, 6, 6, AREA[h.area].colour);
      if (ui.button(22, y, 160, 14, h.name, { desc: h.id })) {
        this.heritage = i;
        this.step = 2;
        ui.reset(1);
      }
    });
    const idx = HERITAGES.findIndex((h) => h.id === ui.lastDesc);
    const h = HERITAGES[idx >= 0 ? idx : 0];
    g.rect(188, 74, 118, 100, C.NAVY);
    g.frame(188, 74, 118, 100, AREA[h.area].colour);
    text(g, AREA[h.area].short, 194, 79, AREA[h.area].colour, { bold: true });
    paragraph(g, h.blurb, 194, 92, 108, C.WHITE, 10);
    paragraph(g, AREA[h.area].blurb, 194, 136, 108, C.LSLATE, 9);
    paragraph(g, 'Tip: Frontier Partner needs Security AND an AI designation, plus Modern Work skills for Copilot.', 14, 182, 290, C.CYAN, 10);
    if (ui.button(14, 222, 60, 13, 'BACK', { style: 'box' }) || ui.back()) this.back(app);
  }

  private difficultyStep(app: App): void {
    const g = app.g;
    panel(g, 30, 40, 260, 150, 'DIFFICULTY');
    (Object.keys(DIFFICULTY) as Difficulty[]).forEach((d, i) => {
      const info = DIFFICULTY[d];
      const y = 64 + i * 26;
      if (ui.button(40, y, 240, 14, `${info.name.toUpperCase()}  - starting cash $${info.cash}K`, { selected: this.difficulty === d })) {
        this.difficulty = d;
        this.step = 3;
        ui.reset(0);
      }
      text(g, info.blurb, 58, y + 15, C.LSLATE);
    });
    if (ui.button(40, 168, 60, 13, 'BACK', { style: 'box' }) || ui.back()) this.back(app);
  }

  private welcomeStep(app: App): void {
    const g = app.g;
    const her = HERITAGES[this.heritage];
    panel(g, 6, 30, 308, 212, 'INBOX: 1 UNREAD EMAIL');
    g.blit(SPR.inbox, 14, 48, { scale: 2 });
    g.frame(13, 47, 50, 50, C.SLATE);
    text(g, 'MAICPP', 38, 100, C.CYAN, { align: 'center' });
    text(g, 'No-reply', 38, 110, C.GREY, { align: 'center' });
    const msg =
      `{c}From:{/} MAICPP (no-reply)\n{c}Subject:{/} Welcome, {y}${this.name}{/}!\n\n` +
      `You join as a Network member on {c}1 July 2026{/} (FY27), with a head start in {y}${AREA[her.area].short}{/}.\n\n` +
      `Reach a Partner Capability Score of 70 to become a {g}Solutions Partner{/}, earn {g}specializations{/}, then reach {y}Frontier Partner{/} or win {y}Partner of the Year{/}. There is no deadline - but stay solvent and play by the rules, or lose your membership.\n\n` +
      `{d}Automated message. Please do not reply.{/}`;
    paragraph(g, msg, 72, 48, 236, C.WHITE, 10);
    if (ui.button(196, 222, 112, 14, 'START FY27 ►', { style: 'box' })) {
      app.state = newGame({ company: this.name.trim(), heritage: her.id, difficulty: this.difficulty });
      app.go(new PlanScene());
    }
    if (ui.button(14, 222, 60, 14, 'BACK', { style: 'box' }) || ui.back()) this.back(app);
  }
}
