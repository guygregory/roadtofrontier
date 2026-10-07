import type { App, Scene } from '../app';
import { audio } from '../engine/audio';
import { C } from '../engine/palette';
import { text } from '../engine/font';
import { panel, ui } from '../engine/ui';
import { saveGame, saveMeta } from '../game/save';
import { background, footer, header, keyHint, requireState } from './common';
import { HubScene } from './hub';
import { HelpScene } from './help';
import { TitleScene } from './title';
import { toggleFullscreen } from '../fullscreen';

export class GameMenuScene implements Scene {
  music = 'hub';

  frame(app: App): void {
    const s = requireState(app);
    const g = app.g;
    background(g);
    header(app, 'GAME MENU');
    panel(g, 40, 22, 240, 214, 'OPTIONS');
    let y = 40;
    const row = (label: string, act: () => void, right = '') => {
      if (ui.button(48, y, 224, 13, label, { right })) act();
      y += 15;
    };
    row('RESUME', () => app.go(new HubScene()));
    for (const slot of ['1', '2', '3'] as const) {
      const m = saveMeta(slot);
      row(`SAVE TO SLOT ${slot}`, () => {
        if (saveGame(s, slot)) {
          app.toast(`Saved to slot ${slot}`);
          audio.sfx('coin');
        } else app.toast('Could not save (storage unavailable)');
      }, m ? `${m.company.slice(0, 10)} ${m.label}` : 'empty');
    }
    row(`MUSIC: ${app.settings.music ? 'ON' : 'OFF'}`, () => {
      app.settings.music = !app.settings.music;
      audio.setMusic(app.settings.music);
      app.persistSettings();
    });
    row(`SOUND FX: ${app.settings.sfx ? 'ON' : 'OFF'}`, () => {
      app.settings.sfx = !app.settings.sfx;
      audio.setSfx(app.settings.sfx);
      app.persistSettings();
    });
    row(`CRT SCANLINES: ${app.settings.crt ? 'ON' : 'OFF'}`, () => {
      app.settings.crt = !app.settings.crt;
      document.getElementById('crt')?.classList.toggle('on', app.settings.crt);
      app.persistSettings();
    });
    row('FULLSCREEN', () => toggleFullscreen());
    row('HOW TO PLAY', () => app.go(new HelpScene(this)));
    row('QUIT TO TITLE', () =>
      app.dialog({
        title: 'QUIT?',
        text: 'Return to the title screen? Your progress is autosaved at the start of each quarter - use CONTINUE to pick it up again.',
        icon: 'door',
        buttons: [
          {
            label: 'YES, QUIT',
            action: () => app.go(new TitleScene()),
          },
          { label: 'NO' },
        ],
      }),
    );
    text(g, `${s.company} - ${s.difficulty.toUpperCase()}`, 160, 222, C.LSLATE, { align: 'center' });
    if (ui.back()) app.go(new HubScene());
    footer(app, keyHint(app));
  }
}
