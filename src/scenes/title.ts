import type { App, Scene } from '../app';
import { audio } from '../engine/audio';
import { C } from '../engine/palette';
import { text } from '../engine/font';
import { ui } from '../engine/ui';
import { copperSky, logoSun, mountains, rasterRoad, sineScroller, titleText, twinkleStars } from '../engine/fx';
import { msLogo } from '../engine/sprites';
import { loadGame, saveMeta } from '../game/save';
import { SetupScene } from './setup';
import { HelpScene } from './help';
import { HiscoreScene } from './hiscore';
import { CreditsScene } from './credits';
import { LoadScene } from './load';
import { resumeGame } from './flow';

const SCROLL =
  '*** ROAD TO FRONTIER *** GROW YOUR MICROSOFT PARTNER FROM NETWORK MEMBER TO SOLUTIONS PARTNER, SPECIALIZED AND FINALLY FRONTIER PARTNER ... ' +
  'INVEST IN SKILLING, BUILD REPEATABLE OFFERS, JOIN CSP, CO-SELL WITH MICROSOFT AND WATCH YOUR CASH! ... ' +
  'GREETINGS TO EVERY PARTNER, PDM AND PARTNER SUCCESS HERO OUT THERE ... ' +
  'PRESS M TO TOGGLE MUSIC, F FOR FULLSCREEN ... THE ROAD AWAITS!       ';

export class TitleScene implements Scene {
  music = 'title';

  enter(app: App): void {
    // Leaving a game: drop the in-memory state only once we are safely on the title screen.
    app.state = null;
  }

  frame(app: App): void {
    const g = app.g;
    const t = app.t;
    const horizon = 150;
    copperSky(g, 0, horizon, ['012', '113', '326', '638', 'b46', 'f84', 'fc6']);
    twinkleStars(g, t, 70);
    logoSun(g, 160, horizon - 2, 38, t, horizon);
    mountains(g, horizon, t, C.DNAVY, 18, 0.03, 6, 0);
    mountains(g, horizon, t, C.NAVY, 10, 0.05, 12, 90);
    rasterRoad(g, horizon, t, 6, Math.sin(t * 0.4) * 1.2);

    titleText(g, 'ROAD TO', 160, 14, 2, ['fff', 'cef', '6df', '07c'], t, 1);
    titleText(g, 'FRONTIER', 160, 34, 3, ['ff6', 'fb0', 'f93', 'f52', 'b22'], t, 2);
    msLogo(g, 140, 66, 8, 2);
    text(g, 'A MICROSOFT PARTNER JOURNEY', 160, 88, C.CREAM, { align: 'center', shadow: C.BLACK });

    // Menu panel over the road
    const px = 96;
    const py = 156;
    const pw = 128;
    g.dither(px, py, pw, 80, C.BLACK);
    g.dither(px, py, pw, 80, C.BLACK, 1);
    g.frame(px, py, pw, 80, C.MSYELLOW);
    const auto = saveMeta('auto');
    const items: [string, boolean, () => void][] = [
      ['NEW GAME', false, () => app.go(new SetupScene())],
      [auto ? `CONTINUE ${auto.label}` : 'CONTINUE', !auto, () => {
        const s = loadGame('auto');
        if (s) resumeGame(app, s);
      }],
      ['LOAD GAME', false, () => app.go(new LoadScene(this))],
      ['HOW TO PLAY', false, () => app.go(new HelpScene(this))],
      ['HALL OF FAME', false, () => app.go(new HiscoreScene())],
      ['CREDITS', false, () => app.go(new CreditsScene())],
    ];
    let y = py + 4;
    items.forEach(([label, disabled, act], i) => {
      if (ui.button(px + 3, y, pw - 6, 12, label, { disabled, hotkey: String(i + 1) })) act();
      y += 12;
    });

    sineScroller(g, SCROLL, 238, t, 55, 4, 2);
    text(g, 'v1.0', 318, 2, C.LSLATE, { align: 'right' });
    if (app.input.take('back')) audio.sfx('back');
  }
}
