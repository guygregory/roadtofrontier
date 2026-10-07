import type { App, Scene } from '../app';
import { C } from '../engine/palette';
import { text } from '../engine/font';
import { panel, ui } from '../engine/ui';
import { loadGame, saveMeta, SLOTS } from '../game/save';
import { background, footer, keyHint } from './common';
import { resumeGame } from './flow';

export class LoadScene implements Scene {
  music = undefined;
  constructor(private back: Scene) {}

  frame(app: App): void {
    const g = app.g;
    background(g);
    g.rect(0, 0, 320, 14, C.NAVY);
    text(g, 'LOAD GAME', 6, 3, C.WHITE, { bold: true });
    panel(g, 30, 40, 260, 150, 'CHOOSE A SAVE');
    SLOTS.forEach((slot, i) => {
      const m = saveMeta(slot);
      const label = slot === 'auto' ? 'AUTOSAVE' : `SLOT ${slot}`;
      const y = 60 + i * 26;
      if (ui.button(40, y, 240, 14, `${label}: ${m ? `${m.company}` : 'empty'}`, { disabled: !m, right: m?.label ?? '' })) {
        const s = loadGame(slot);
        if (s) resumeGame(app, s);
      }
      if (m) text(g, new Date(m.savedAt).toLocaleString(), 52, y + 15, C.LSLATE);
    });
    if (ui.button(130, 172, 60, 13, 'BACK', { style: 'box' }) || ui.back()) app.go(this.back);
    footer(app, keyHint(app));
  }
}
