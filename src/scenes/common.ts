import type { App } from '../app';
import type { Gfx } from '../engine/gfx';
import { C, gradient12 } from '../engine/palette';
import { text, measure } from '../engine/font';
import { bar, copperRect, ui } from '../engine/ui';
import { AREA, AreaId } from '../game/data';
import { money, monthsLabel, turnLabel } from '../game/format';
import type { GameState } from '../game/types';
import { msLogo } from '../engine/sprites';

export const HEADER_H = 14;

/** Copper header bar with the title, the date and cash. */
export function header(app: App, title: string): void {
  const g = app.g;
  copperRect(g, 0, 0, 320, HEADER_H, ['48c', '137', '012']);
  g.hline(0, 319, HEADER_H - 1, C.BLACK);
  msLogo(g, 3, 2, 4, 1);
  text(g, title, 15, 3, C.WHITE, { bold: true, shadow: C.BLACK });
  const s = app.state;
  if (s) {
    const right = `${turnLabel(Math.min(s.turn, 19))} ${monthsLabel(Math.min(s.turn, 19))}`;
    const cash = money(s.cash);
    const cw = measure(cash);
    text(g, cash, 317, 3, s.cash < 0 ? C.RED : C.YELLOW, { align: 'right', shadow: C.BLACK });
    text(g, right, 317 - cw - 8, 3, C.CYAN, { align: 'right', shadow: C.BLACK });
  }
}

export function footer(app: App, hint: string): void {
  const g = app.g;
  g.rect(0, 245, 320, 11, C.DNAVY);
  g.hline(0, 319, 245, C.NAVY);
  text(g, hint, 4, 247, C.LSLATE);
}

export function background(g: Gfx): void {
  for (let y = HEADER_H; y < 256; y++) g.rectRGB(0, y, 320, 1, gradient12(['012', '024', '012'], (y - HEADER_H) / (256 - HEADER_H)));
}

export function areaColour(a: AreaId): number {
  return AREA[a].colour;
}

/** PCS bar with the 70-point qualification marker. */
export function pcsBar(g: Gfx, x: number, y: number, w: number, total: number, qualified: boolean, held: boolean): void {
  bar(g, x, y, w, 6, total, 100, held ? C.MSGREEN : qualified ? C.YELLOW : C.BLUE, 70);
}

export function keyHint(app: App): string {
  return app.input.lastDevice === 'keyboard' ? 'ARROWS MOVE  ENTER SELECT  ESC BACK' : 'CLICK TO SELECT  ESC/RIGHT-CLICK BACK';
}

/** Standard "BACK" button in the footer area. Returns true if pressed (or Esc). */
export function backButton(app: App, x = 262, y = 230, label = 'BACK'): boolean {
  const hit = ui.button(x, y, 54, 13, label, { style: 'box' });
  return hit || ui.back();
}

export function statusLine(g: Gfx, x: number, y: number, label: string, value: string, colour: number = C.WHITE, w = 120): void {
  text(g, label, x, y, C.LSLATE);
  text(g, value, x + w, y, colour, { align: 'right' });
}

export function meter(g: Gfx, x: number, y: number, label: string, v: number, colour: number, w = 120): void {
  text(g, label, x, y, C.LSLATE);
  bar(g, x + 58, y + 1, w - 76, 6, v, 100, colour);
  text(g, String(Math.round(v)), x + w, y, C.WHITE, { align: 'right' });
}

export function signCol(v: number): number {
  return v > 0 ? C.GREEN : v < 0 ? C.RED : C.LGREY;
}

/** Scrolling list helper: returns first visible index for a focused index. */
export function scrollTo(focus: number, first: number, visible: number): number {
  if (focus < first) return focus;
  if (focus >= first + visible) return focus - visible + 1;
  return first;
}

export function requireState(app: App): GameState {
  if (!app.state) throw new Error('No game in progress');
  return app.state;
}
