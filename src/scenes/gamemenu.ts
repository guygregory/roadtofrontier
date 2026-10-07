import type { App, Scene } from '../app';
import { audio } from '../engine/audio';
import { C } from '../engine/palette';
import { text } from '../engine/font';
import { panel, ui } from '../engine/ui';
import { saveFileName } from '../game/save';
import { exportSave, importSave } from './saveio';
import { background, footer, header, keyHint, requireState } from './common';
import { HubScene } from './hub';
import { HelpScene } from './help';
import { TitleScene } from './title';
import { toggleFullscreen } from '../fullscreen';
import { isMobile } from '../mobile';

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
    // .sav files need a file system, so phones and tablets don't offer them.
    if (!isMobile) row('SAVE GAME', () => exportSave(app), app.hasUnsavedProgress() ? 'download .sav' : 'saved');
    if (!isMobile) row('LOAD GAME', () => {
      const load = () => importSave(app);
      if (!app.hasUnsavedProgress()) load();
      else
        app.dialog({
          title: 'LOAD GAME?',
          text: 'Load a .sav file? Progress since your last save will be lost.',
          icon: 'door',
          buttons: [{ label: 'CHOOSE FILE', action: load }, { label: 'CANCEL' }],
        });
    }, 'open .sav');
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
      app.dialog(
        isMobile
          ? {
              title: 'QUIT?',
              text: 'Return to the title screen? This game will end - games cannot be saved on this device.',
              icon: 'door',
              buttons: [{ label: 'YES, QUIT', action: () => app.go(new TitleScene()) }, { label: 'NO' }],
            }
          : app.hasUnsavedProgress()
          ? {
              title: 'QUIT?',
              text: `Return to the title screen? Progress since your last save will be lost.\n\nSAVE & QUIT downloads {y}${saveFileName()}{/} first - use LOAD GAME on the title screen to carry on later.`,
              icon: 'door',
              buttons: [
                {
                  label: 'SAVE & QUIT',
                  action: () => {
                    exportSave(app);
                    app.go(new TitleScene());
                  },
                },
                { label: 'QUIT', action: () => app.go(new TitleScene()) },
                { label: 'CANCEL' },
              ],
            }
          : {
              title: 'QUIT?',
              text: 'Return to the title screen? Your game is saved - use LOAD GAME on the title screen to carry on later.',
              icon: 'door',
              buttons: [{ label: 'YES, QUIT', action: () => app.go(new TitleScene()) }, { label: 'NO' }],
            },
      ),
    );
    text(g, `${s.company} - ${s.difficulty.toUpperCase()}`, 160, 222, C.LSLATE, { align: 'center' });
    if (ui.back()) app.go(new HubScene());
    footer(app, keyHint(app));
  }
}
