import type { App, Scene } from '../app';
import { C, gradient12 } from '../engine/palette';
import { text } from '../engine/font';
import { starfield, titleText } from '../engine/fx';
import { ui } from '../engine/ui';
import { msLogo } from '../engine/sprites';
import { TitleScene } from './title';

const LINES = [
  'Created with {m}love{/} by',
  '{y}GUY GREGORY & GITHUB COPILOT',
  '',
  '{y}ROAD TO FRONTIER',
  '',
  'An Amiga-style tribute to the',
  'Microsoft AI Cloud Partner Program',
  '',
  '{c}DESIGN, CODE, PIXELS & CHIPTUNES',
  'Built with TypeScript, Vite and',
  'a 320x256 software framebuffer',
  '',
  '{c}FY THEMES (A NEW ONE EACH YEAR)',
  'Partner Journey - Downtown Development',
  'Bossa Budget - Night Shift',
  '',
  '{c}STARRING',
  'Your Partner Development Managers:',
  'Alex, Priya, Kwame, Mei, Aisha & Diego',
  'Sam, your distributor account manager',
  'The MAICPP inbox (no-reply)',
  'Contoso, Fabrikam, Northwind & friends',
  '',
  '{c}INSPIRED BY',
  'Kickstart floppies, copper bars,',
  'Lotus road raster tricks, demoscene',
  'scrollers and the Guru Meditation',
  '',
  '{c}PROGRAMME FACTS',
  'Partner Capability Score, designations,',
  'specializations and Frontier Partner',
  'follow Microsoft Learn & Partner Center,',
  'simplified and scaled for fun.',
  'Numbers in this game are not real',
  'programme thresholds or prices.',
  '',
  '{c}LEARN MORE',
  'aka.ms/specializations',
  'learn.microsoft.com/partner-center',
  '',
  '{y}THANKS FOR PLAYING!',
  '',
  '{m}♥',
];

export class CreditsScene implements Scene {
  music = 'title';
  private t0 = -1;

  frame(app: App): void {
    const g = app.g;
    if (this.t0 < 0) this.t0 = app.t;
    const e = app.t - this.t0;
    g.fill(C.BLACK);
    starfield(g, app.t, 256, 30);
    const y0 = 256 - e * 22;
    LINES.forEach((l, i) => {
      const y = y0 + i * 14;
      if (y < 40 || y > 250) return;
      text(g, l, 160, y, C.WHITE, { align: 'center' });
    });
    for (let y = 0; y < 40; y++) g.rectRGB(0, y, 320, 1, gradient12(['012', '000'], y / 40));
    titleText(g, 'CREDITS', 160, 8, 2, ['fff', '6df', '07c'], app.t, 1);
    msLogo(g, 300, 8, 6, 1);
    if (y0 + LINES.length * 14 < 30) this.t0 = app.t;
    if (ui.button(4, 4, 50, 13, 'BACK', { style: 'box' }) || ui.back()) app.go(new TitleScene());
  }
}
