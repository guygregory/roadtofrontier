import type { App, Scene } from '../app';
import { audio } from '../engine/audio';
import { C, gradient12, rgb12 } from '../engine/palette';
import { text } from '../engine/font';
import { SPR, msLogo } from '../engine/sprites';
import { TitleScene } from './title';

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
      g.rect(96, 196, 128, 10, C.DGREY);
      g.rect(100, 199, 120, 4, C.BLACK);
      g.rect(198, 198, 8, 5, Math.floor(t * 2) % 2 ? C.MSGREEN : C.DGREEN);
      // floppy bobbing toward the slot
      const bob = Math.round(Math.sin(t * 3) * 4);
      g.blit(SPR.floppy, 112, 40 + bob, { scale: 3 });
      text(g, 'ROAD TO', 160, 82 + bob, C.NAVY, { align: 'center', bold: true });
      text(g, 'FRONTIER', 160, 94 + bob, C.NAVY, { align: 'center', bold: true });
      text(g, 'DISK 1', 160, 106 + bob, C.GREY, { align: 'center' });
      msLogo(g, 154, 118 + bob, 5, 2);
      // arrow
      const ay = 150 + (Math.floor(t * 4) % 2) * 3;
      for (let i = 0; i < 6; i++) g.hline(160 - i, 160 + i, ay + 26 - i, C.ROYAL);
      g.rect(158, ay + 16, 5, 6, C.ROYAL);
      text(g, 'INSERT DISK - CLICK OR PRESS ANY KEY', 160, 222, C.NAVY, { align: 'center' });
      text(g, 'Best with sound on. M toggles music, F fullscreen.', 160, 236, C.GREY, { align: 'center' });
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
