import type { App, Scene } from '../app';
import { audio } from '../engine/audio';
import { C } from '../engine/palette';
import { text } from '../engine/font';
import { ui } from '../engine/ui';
import { copperSky, logoSun, mountains, rasterRoad, sineScroller, titleText, twinkleStars } from '../engine/fx';
import { msLogo } from '../engine/sprites';
import { SetupScene } from './setup';
import { HelpScene } from './help';
import { CreditsScene } from './credits';
import { importSave } from './saveio';
import { resumeGame } from './flow';
import { clearLegacySaves, legacySave } from '../game/save';
import { turnLabel } from '../game/format';
import type { GameState } from '../game/types';
import { homeScreenHint, isMobile, isStandalone } from '../mobile';

const KEYS_TIP = isMobile ? '' : 'PRESS M TO TOGGLE MUSIC, F FOR FULLSCREEN ... ';

const SCROLL =
  '*** ROAD TO FRONTIER *** GROW YOUR MICROSOFT PARTNER FROM NETWORK MEMBER TO SOLUTIONS PARTNER, SPECIALIZED AND FINALLY FRONTIER PARTNER ... ' +
  'INVEST IN SKILLING, BUILD REPEATABLE OFFERS, JOIN CSP, CO-SELL WITH MICROSOFT AND WATCH YOUR CASH! ... ' +
  'GREETINGS TO EVERY PARTNER, DISTRIBUTOR, PDM AND PARTNER SUCCESS HERO OUT THERE ... ' +
  KEYS_TIP +
  'THE ROAD AWAITS!       ';

export class TitleScene implements Scene {
  music = 'title';
  private legacy: GameState | null = null;

  enter(app: App): void {
    // Leaving a game: drop the in-memory state only once we are safely on the title screen.
    app.state = null;
    this.legacy = legacySave();
  }

  /** Carry on a game autosaved in the browser by an older version, then forget the old browser saves. */
  private continueLegacy(app: App): void {
    const s = this.legacy;
    if (!s) return;
    this.legacy = null;
    clearLegacySaves();
    app.message(
      'OLD SAVE FOUND',
      isMobile
        ? `Welcome back, ${s.company} (${turnLabel(s.turn)}).\n\nGames are no longer saved in the browser, so this is your last chance to finish this one.`
        : `Welcome back, ${s.company} (${turnLabel(s.turn)}).\n\nGames are no longer saved in the browser. Use {y}SAVE GAME{/} in the GAME MENU to download a .sav file, and LOAD GAME on the title screen to carry on later.`,
      'good',
      'floppy',
      () => resumeGame(app, s),
    );
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
    // On phones/tablets, suggest installing to the home screen for a full-screen web app.
    if (isMobile && !isStandalone()) text(g, homeScreenHint(), 160, 100, Math.floor(t * 2) % 2 ? C.YELLOW : C.WHITE, { align: 'center', shadow: C.BLACK });

    // Menu panel over the road
    const items: [string, () => void][] = [
      ['NEW GAME', () => app.go(new SetupScene())],
      ...(this.legacy ? [['CONTINUE OLD SAVE', () => this.continueLegacy(app)] as [string, () => void]] : []),
      // .sav files need a file system, so phones and tablets don't offer them.
      ...(isMobile ? [] : [['LOAD GAME (.SAV)', () => importSave(app)] as [string, () => void]]),
      ['HOW TO PLAY', () => app.go(new HelpScene(this))],
      ['CREDITS', () => app.go(new CreditsScene())],
    ];
    const px = 96;
    const pw = 128;
    const ph = items.length * 17 + 12;
    const py = 236 - ph;
    g.dither(px, py, pw, ph, C.BLACK);
    g.dither(px, py, pw, ph, C.BLACK, 1);
    g.frame(px, py, pw, ph, C.MSYELLOW);
    let y = py + 6;
    items.forEach(([label, act], i) => {
      if (ui.button(px + 3, y, pw - 6, 14, label, { hotkey: String(i + 1) })) act();
      y += 17;
    });

    sineScroller(g, SCROLL, 238, t, 55, 4, 2);
    text(g, 'v1.0', 318, 2, C.LSLATE, { align: 'right' });
    if (app.input.take('back')) audio.sfx('back');
  }
}
