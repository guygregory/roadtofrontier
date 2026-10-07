import { Gfx, SCREEN_W } from './engine/gfx';
import { C } from './engine/palette';
import { text } from './engine/font';
import { copperSky, starfield, titleText } from './engine/fx';
import { icon, msLogo } from './engine/sprites';
import { DIFFICULTY } from './game/data';
import { turnLabel } from './game/format';
import { totalCustomers } from './game/rules';
import { outcomeTitle } from './game/share';
import type { GameState } from './game/types';

/** Card size in game pixels: 1.91:1, the link-preview shape LinkedIn and X both display uncropped. */
export const CARD_W = SCREEN_W;
export const CARD_H = 168;
export const CARD_SCALE = 4;

/** Draw the share card into the top CARD_H rows of a framebuffer. */
export function drawShareCard(g: Gfx, s: GameState, score: number): void {
  const won = s.status === 'won';
  g.unclip();
  g.translate(0, 0);
  g.fill(C.BLACK);
  copperSky(g, 0, CARD_H, won ? ['012', '024', '137', '024', '012'] : ['100', '311', '522', '311', '100']);
  starfield(g, 3.7, CARD_H, 0);
  g.frame(0, 0, CARD_W, CARD_H, C.MSYELLOW);
  g.frame(2, 2, CARD_W - 4, CARD_H - 4, C.SLATE);

  titleText(g, 'ROAD TO FRONTIER', 160, 9, 2, ['fff', 'ff6', 'fb0', 'f93'], 0, 0);
  msLogo(g, 10, 9, 6, 1);
  msLogo(g, 297, 9, 6, 1);

  const head = outcomeTitle(s);
  g.blit(icon(s.endKind === 'frontier' ? 'rocket' : s.endKind === 'poty' ? 'trophy' : s.endKind === 'bankrupt' ? 'chartdown' : 'heartbreak'), 144, 30, { scale: 2 });
  text(g, head, 160, 66, won ? C.MSGREEN : C.ORANGE, { align: 'center', scale: 2, shadow: C.BLACK });
  text(g, s.company, 160, 86, C.WHITE, { align: 'center', bold: true, shadow: C.BLACK });

  g.dither(40, 99, 240, 36, C.BLACK);
  g.frame(40, 99, 240, 36, C.SLATE);
  text(g, `SCORE ${score}`, 160, 103, C.YELLOW, { align: 'center', scale: 2, shadow: C.BLACK });
  const when = turnLabel(s.flags.endTurn ?? Math.max(0, s.turn - 1));
  text(g, `${DIFFICULTY[s.difficulty].name.toUpperCase()} DIFFICULTY  -  ${when}`, 160, 123, C.CREAM, { align: 'center' });

  const stats = `Designations ${s.designations.length}   Specializations ${s.specs.length}   Customers ${totalCustomers(s)}`;
  text(g, stats, 160, 140, C.LGREY, { align: 'center' });

  g.rect(3, CARD_H - 17, CARD_W - 6, 14, C.NAVY);
  text(g, '{y}PLAY FREE:{/} AKA.MS/ROADTOFRONTIER  {c}#ROADTOFRONTIER{/}', 160, CARD_H - 13, C.WHITE, { align: 'center' });
}

/** Render the share card to a full-size canvas (nearest-neighbour scaled, so pixels stay crisp). */
export function shareCardCanvas(s: GameState, score: number): HTMLCanvasElement {
  const g = new Gfx();
  drawShareCard(g, s, score);
  const src = document.createElement('canvas');
  src.width = CARD_W;
  src.height = CARD_H;
  const sctx = src.getContext('2d')!;
  const img = sctx.createImageData(CARD_W, CARD_H);
  new Uint32Array(img.data.buffer).set(g.buf.subarray(0, CARD_W * CARD_H));
  sctx.putImageData(img, 0, 0);
  const out = document.createElement('canvas');
  out.width = CARD_W * CARD_SCALE;
  out.height = CARD_H * CARD_SCALE;
  const ctx = out.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(src, 0, 0, out.width, out.height);
  return out;
}

export function shareCardBlob(s: GameState, score: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    shareCardCanvas(s, score).toBlob((b) => (b ? resolve(b) : reject(new Error('Could not create image'))), 'image/png');
  });
}
