import { Gfx } from './engine/gfx';
import { C } from './engine/palette';
import { measure, text } from './engine/font';
import { copperSky, starfield, titleText } from './engine/fx';
import { icon, msLogo } from './engine/sprites';
import { DIFFICULTY } from './game/data';
import { turnLabel } from './game/format';
import { totalCustomers } from './game/rules';
import { outcomeTitle } from './game/share';
import type { GameState } from './game/types';

/** 4:5 social portrait, rendered at 5x from a compact pixel-art framebuffer. */
export const CARD_W = 216;
export const CARD_H = 270;
export const CARD_SCALE = 5;
export const CARD_IMAGE_W = CARD_W * CARD_SCALE;
export const CARD_IMAGE_H = CARD_H * CARD_SCALE;

/** Draw the complete portrait share card into a CARD_W x CARD_H framebuffer. */
export function drawShareCard(g: Gfx, s: GameState, score: number): void {
  const won = s.status === 'won';
  g.unclip();
  g.translate(0, 0);
  g.fill(C.BLACK);
  copperSky(g, 0, CARD_H, won ? ['012', '024', '137', '024', '012'] : ['100', '311', '522', '311', '100']);
  starfield(g, 3.7, CARD_H, 0);
  g.frame(0, 0, CARD_W, CARD_H, C.MSYELLOW);
  g.frame(2, 2, CARD_W - 4, CARD_H - 4, C.SLATE);

  titleText(g, 'ROAD TO FRONTIER', 108, 11, 1, ['fff', 'ff6', 'fb0', 'f93'], 0, 0);
  msLogo(g, 9, 10, 5, 1);
  msLogo(g, 197, 10, 5, 1);

  const head = outcomeTitle(s);
  const resultIcon = icon(s.endKind === 'frontier' ? 'rocket' : s.endKind === 'poty' ? 'trophy' : s.endKind === 'bankrupt' ? 'chartdown' : 'heartbreak');
  g.blit(resultIcon, Math.round((CARD_W - resultIcon.w * 3) / 2), 34, { scale: 3 });
  const headScale = measure(head, { scale: 2 }) <= CARD_W - 12 ? 2 : 1;
  text(g, head, 108, 86, won ? C.MSGREEN : C.ORANGE, { align: 'center', scale: headScale, bold: headScale === 1, shadow: C.BLACK });
  text(g, s.company, 108, 106, C.WHITE, { align: 'center', bold: true, shadow: C.BLACK });

  g.dither(14, 120, 188, 47, C.BLACK);
  g.frame(14, 120, 188, 47, C.SLATE);
  text(g, `SCORE ${score}`, 108, 126, C.YELLOW, { align: 'center', scale: 2, shadow: C.BLACK });
  const when = turnLabel(s.flags.endTurn ?? Math.max(0, s.turn - 1));
  text(g, `${DIFFICULTY[s.difficulty].name.toUpperCase()} DIFFICULTY`, 108, 149, C.CREAM, { align: 'center' });
  text(g, when, 108, 158, C.LGREY, { align: 'center' });

  text(g, 'YOUR PARTNER JOURNEY', 108, 177, C.CREAM, { align: 'center', bold: true });
  const stats: Array<[string, number]> = [
    ['DESIGNATIONS', s.designations.length],
    ['SPECIALIZATIONS', s.specs.length],
    ['CUSTOMERS', totalCustomers(s)],
  ];
  stats.forEach(([label, value], i) => {
    const y = 190 + i * 16;
    g.rect(24, y, 168, 13, i % 2 === 0 ? C.NAVY : C.DNAVY);
    g.frame(24, y, 168, 13, C.SLATE);
    text(g, label, 30, y + 3, C.LGREY);
    text(g, String(value), 185, y + 3, C.YELLOW, { align: 'right', bold: true });
  });

  g.rect(3, CARD_H - 28, CARD_W - 6, 25, C.NAVY);
  text(g, '{y}PLAY FREE:{/} AKA.MS/ROADTOFRONTIER', 108, CARD_H - 23, C.WHITE, { align: 'center' });
  text(g, '{c}#ROADTOFRONTIER{/}', 108, CARD_H - 13, C.WHITE, { align: 'center' });
}

/** Render the share card to a full-size canvas (nearest-neighbour scaled, so pixels stay crisp). */
export function shareCardCanvas(s: GameState, score: number): HTMLCanvasElement {
  const g = new Gfx(undefined, CARD_W, CARD_H);
  drawShareCard(g, s, score);
  const src = document.createElement('canvas');
  src.width = CARD_W;
  src.height = CARD_H;
  const sctx = src.getContext('2d')!;
  const img = sctx.createImageData(CARD_W, CARD_H);
  new Uint32Array(img.data.buffer).set(g.buf.subarray(0, CARD_W * CARD_H));
  sctx.putImageData(img, 0, 0);
  const out = document.createElement('canvas');
  out.width = CARD_IMAGE_W;
  out.height = CARD_IMAGE_H;
  const ctx = out.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(src, 0, 0, out.width, out.height);
  return out;
}

/** Draw a nearest-neighbour preview of the portrait card inside the game screen. */
export function drawShareCardPreview(g: Gfx, s: GameState, score: number, x: number, y: number, width: number, height: number): void {
  const card = new Gfx(undefined, CARD_W, CARD_H);
  drawShareCard(card, s, score);
  const scale = Math.min(width / CARD_W, height / CARD_H);
  const outW = Math.floor(CARD_W * scale);
  const outH = Math.floor(CARD_H * scale);
  const left = x + Math.floor((width - outW) / 2);
  const top = y + Math.floor((height - outH) / 2);
  for (let dy = 0; dy < outH; dy++) {
    const sy = Math.floor(dy / scale);
    for (let dx = 0; dx < outW; dx++) {
      const sx = Math.floor(dx / scale);
      g.psetRGB(left + dx, top + dy, card.buf[sy * CARD_W + sx]);
    }
  }
}

export function shareCardBlob(s: GameState, score: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    shareCardCanvas(s, score).toBlob((b) => (b ? resolve(b) : reject(new Error('Could not create image'))), 'image/png');
  });
}
