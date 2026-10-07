import type { App, Scene } from '../app';
import { audio } from '../engine/audio';
import { C, gradient12, rgb12 } from '../engine/palette';
import { text } from '../engine/font';
import { SPR, msLogo } from '../engine/sprites';
import { TitleScene } from './title';
import { isMobile } from '../mobile';

/**
 * Kickstart-style "insert disk" screen. The first click/key also unlocks Web Audio
 * (browsers require a user gesture), then we "load" with decrunch raster bars.
 */
export class BootScene implements Scene {
  music = '';
  private loading = -1;

  frame(app: App, dt: number): void {
    const g = app.g;
    const t = app.t;
    if (this.loading < 0) {
      g.fill(C.WHITE);
      g.rect(0, 0, 320, 12, C.LGREY);
      text(g, 'PARTNER-OS ROM 1.3', 4, 2, C.DGREY);
      text(g, 'READY.', 316, 2, C.DGREY, { align: 'right' });
      // drive slot
      g.rect(96, 40, 128, 10, C.DGREY);
      g.rect(100, 43, 120, 4, C.BLACK);
      g.rect(198, 42, 8, 5, Math.floor(t * 2) % 2 ? C.MSGREEN : C.DGREEN);
      // floppy below, bobbing toward the slot
      const fy = 100 + Math.round(Math.sin(t * 3) * 4);
      g.blit(SPR.floppy, 112, fy, { scale: 3 });
      text(g, 'ROAD TO', 160, fy + 42, C.NAVY, { align: 'center', bold: true });
      text(g, 'FRONTIER', 160, fy + 54, C.NAVY, { align: 'center', bold: true });
      text(g, 'DISK 1', 160, fy + 66, C.GREY, { align: 'center' });
      msLogo(g, 154, fy + 78, 5, 2);
      // arrow pointing up from the disk into the slot
      const ay = 71 - (Math.floor(t * 4) % 2) * 3;
      for (let i = 0; i < 6; i++) g.hline(160 - i, 160 + i, ay + i, C.ROYAL);
      g.rect(158, ay + 5, 5, 6, C.ROYAL);
      // Touch screens have no keyboard: no key hints there.
      text(g, isMobile ? 'INSERT DISK - TAP TO START' : 'INSERT DISK - CLICK OR PRESS ANY KEY', 160, 222, C.NAVY, { align: 'center' });
      text(g, isMobile ? 'Best with sound on.' : 'Best with sound on. M toggles music, F fullscreen.', 160, 236, C.GREY, { align: 'center' });
      if (app.input.anyKey || app.input.clicked) {
        audio.unlock();
        audio.setMusic(app.settings.music);
        audio.setSfx(app.settings.sfx);
        audio.sfx('disk');
        this.loading = 0;
      }
      return;
    }
    // Decrunching!
    this.loading += dt;
    g.fill(C.BLACK);
    const seed = Math.floor(this.loading * 50);
    for (let y = 0; y < 256; y++) {
      const v = ((y * 7 + seed * 13) ^ (seed * 31)) & 63;
      g.rectRGB(0, y, 320, 1, rgb12((v * 4) & 255, (v * 9) & 255, (v * 15) & 255));
    }
    g.rect(40, 100, 240, 56, C.BLACK);
    g.frame(40, 100, 240, 56, C.WHITE);
    text(g, 'DECRUNCHING...', 160, 112, C.WHITE, { align: 'center' });
    const p = Math.min(1, this.loading / 1.6);
    g.rect(56, 130, 208, 10, C.DGREY);
    for (let x = 0; x < Math.floor(208 * p); x++) g.rectRGB(56 + x, 130, 1, 10, gradient12(['f52', 'fb0', '8b0', '0af'], x / 208));
    if (Math.floor(this.loading * 4) !== Math.floor((this.loading - dt) * 4)) audio.sfx('disk');
    if (this.loading > 1.7 || app.input.clicked) app.go(new TitleScene());
  }
}
