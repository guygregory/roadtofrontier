import type { Gfx } from './gfx';
import type { Input } from './input';
import { audio } from './audio';
import { C, gradient12 } from './palette';
import { measure, text, wrap, LINE_H } from './font';
import { icon } from './sprites';

export interface ButtonOpts {
  disabled?: boolean;
  /** Description shown in info panels while focused. */
  desc?: string;
  icon?: string;
  /** Visual style. */
  style?: 'menu' | 'box' | 'tab' | 'plain';
  selected?: boolean;
  colour?: number;
  /** Right-aligned secondary text (e.g. a cost). */
  right?: string;
  /** Number key (1-9) that activates this button directly. */
  hotkey?: string;
  sound?: boolean;
  /** False: click/tap only, left out of keyboard focus (e.g. a BACK button when Esc does the same). */
  focusable?: boolean;
}

/**
 * Immediate-mode UI. Widgets are re-declared every frame; focus order follows
 * declaration order so keyboard navigation works without any extra wiring.
 */
export class UI {
  focus = 0;
  private count = 0;
  private descs: (string | undefined)[] = [];
  private disabledFlags: boolean[] = [];
  lastDesc: string | undefined;
  lastFocusDisabled = false;
  t = 0;
  input!: Input;
  g!: Gfx;
  private wantFocusLast = false;
  private resetPending = false;

  begin(g: Gfx, input: Input, t: number): void {
    this.g = g;
    this.input = input;
    this.t = t;
    this.count = 0;
    this.descs = [];
    this.disabledFlags = [];
  }

  end(): void {
    const n = this.count;
    if (this.resetPending) {
      // Focus was reset during this frame (e.g. a step change); don't clamp it
      // against the old widget count.
      this.resetPending = false;
      this.wantFocusLast = false;
      return;
    }
    if (n === 0) {
      this.focus = 0;
      return;
    }
    if (this.wantFocusLast) {
      this.focus = n - 1;
      this.wantFocusLast = false;
    }
    const inp = this.input;
    const prev = inp.take('up') || inp.take('left') || inp.take('backtab');
    const next = inp.take('down') || inp.take('right') || inp.take('tab');
    if (prev) {
      this.focus = (this.focus - 1 + n) % n;
      audio.sfx('move');
    }
    if (next) {
      this.focus = (this.focus + 1) % n;
      audio.sfx('move');
    }
    if (this.focus >= n) this.focus = n - 1;
    this.lastDesc = this.descs[this.focus];
    this.lastFocusDisabled = this.disabledFlags[this.focus] ?? false;
  }

  reset(focus = 0): void {
    this.focus = focus;
    this.lastDesc = undefined;
    this.resetPending = true;
  }

  focusLast(): void {
    this.wantFocusLast = true;
  }

  /** Register a focusable widget and return [index, isFocused]. */
  private register(x: number, y: number, w: number, h: number, desc: string | undefined, disabled: boolean): [number, boolean] {
    const idx = this.count++;
    this.descs[idx] = desc;
    this.disabledFlags[idx] = disabled;
    if (this.input.moved && this.input.inRect(x, y, w, h)) {
      if (this.focus !== idx) audio.sfx('tick');
      this.focus = idx;
    }
    return [idx, this.focus === idx];
  }

  /** Returns true when activated by click, Enter on focus, or hotkey. */
  button(x: number, y: number, w: number, h: number, label: string, opts: ButtonOpts = {}): boolean {
    const g = this.g;
    const inp = this.input;
    const disabled = !!opts.disabled;
    const focusable = opts.focusable !== false;
    const focused = focusable ? this.register(x, y, w, h, opts.desc, disabled)[1] : inp.lastDevice === 'mouse' && inp.inRect(x, y, w, h);
    const style = opts.style ?? 'menu';
    const hover = focused;

    if (style === 'menu') {
      if (hover) {
        for (let yy = 0; yy < h; yy++) {
          g.rectRGB(x, y + yy, w, 1, gradient12(disabled ? ['334', '223'] : ['07c', '048', '024'], yy / Math.max(1, h - 1)));
        }
        g.hline(x, x + w - 1, y, disabled ? C.DGREY : C.CYAN);
      } else if (opts.selected) {
        g.rect(x, y, w, h, C.NAVY);
      }
      let tx = x + 4;
      if (hover) text(g, '►', x + 1, y + Math.floor((h - 8) / 2), disabled ? C.GREY : C.YELLOW);
      tx = x + 9;
      if (opts.icon) {
        g.blit(icon(opts.icon), tx, y + Math.floor((h - 16) / 2));
        tx += 19;
      }
      const col = disabled ? C.DGREY : hover ? C.WHITE : opts.colour ?? C.LGREY;
      text(g, label, tx, y + Math.floor((h - 8) / 2) + 1, col);
      if (opts.right) text(g, opts.right, x + w - 4, y + Math.floor((h - 8) / 2) + 1, disabled ? C.DGREY : hover ? C.YELLOW : C.GREY, { align: 'right' });
    } else if (style === 'box' || style === 'tab') {
      const fill = disabled ? C.NEARBLACK : opts.selected ? C.BLUE : hover ? C.ROYAL : C.SLATE;
      g.bevel(x, y, w, h, fill, disabled ? C.DGREY : C.LSLATE, C.BLACK, false);
      if (hover) g.frame(x - 1, y - 1, w + 2, h + 2, disabled ? C.GREY : C.YELLOW);
      const col = disabled ? C.GREY : opts.colour ?? C.WHITE;
      let cx = x + w / 2;
      if (opts.icon) {
        g.blit(icon(opts.icon), x + 3, y + Math.floor((h - 16) / 2));
        cx += 8;
      }
      text(g, label, cx, y + Math.floor((h - 8) / 2) + 1, col, { align: 'center' });
    } else {
      const col = disabled ? C.DGREY : hover ? C.YELLOW : opts.colour ?? C.LGREY;
      text(g, (hover ? '►' : ' ') + label, x, y + 1, col);
    }

    let activated = false;
    if (!inp.consumed) {
      if (inp.clickIn(x, y, w, h)) activated = true;
      else if (focusable && focused && inp.keys.has('enter')) activated = true;
      else if (opts.hotkey && inp.typed.includes(opts.hotkey) && !inp.textMode) activated = true;
    }
    if (activated) {
      inp.consumed = true;
      inp.keys.delete('enter');
      if (disabled) {
        audio.sfx('error');
        return false;
      }
      if (opts.sound !== false) audio.sfx('select');
      return true;
    }
    return false;
  }

  /** Returns true if Escape/back was pressed (and consumes it). */
  back(): boolean {
    if (this.input.take('back')) {
      audio.sfx('back');
      return true;
    }
    return false;
  }
}

export const ui = new UI();

// ---------------------------------------------------------------------------
// Drawing helpers (non-interactive)

/** Copper-style horizontal gradient band. */
export function copper(g: Gfx, y: number, h: number, stops: string[]): void {
  for (let i = 0; i < h; i++) g.rectRGB(0, y + i, g.w, 1, gradient12(stops, h <= 1 ? 0 : i / (h - 1)));
}

export function copperRect(g: Gfx, x: number, y: number, w: number, h: number, stops: string[]): void {
  for (let i = 0; i < h; i++) g.rectRGB(x, y + i, w, 1, gradient12(stops, h <= 1 ? 0 : i / (h - 1)));
}

/** Amiga Workbench-style window with title bar. */
export function panel(g: Gfx, x: number, y: number, w: number, h: number, title?: string, accent: string[] = ['07c', '024']): void {
  g.rect(x, y, w, h, C.DNAVY);
  g.frame(x, y, w, h, C.BLACK);
  g.hline(x + 1, x + w - 2, y + 1, C.SLATE);
  g.vline(x + 1, y + 1, y + h - 2, C.SLATE);
  g.hline(x + 1, x + w - 2, y + h - 2, C.NAVY);
  g.vline(x + w - 2, y + 1, y + h - 2, C.NAVY);
  if (title) {
    copperRect(g, x + 2, y + 2, w - 4, 11, accent);
    // classic title-bar stripes
    for (let i = 0; i < 4; i++) g.hline(x + 4, x + w - 18, y + 4 + i * 2, i % 2 ? C.NAVY : C.ROYAL);
    const tw = measure(title, { bold: true }) + 8;
    g.rect(x + 6, y + 2, tw, 11, C.NAVY);
    text(g, title, x + 10, y + 4, C.WHITE, { bold: true });
    // depth gadget
    g.bevel(x + w - 14, y + 3, 10, 9, C.SLATE, C.LSLATE, C.BLACK);
    g.rect(x + w - 12, y + 5, 4, 3, C.WHITE);
    g.rect(x + w - 10, y + 7, 4, 3, C.LSLATE);
  }
}

/** Horizontal progress bar with optional threshold marker. */
export function bar(g: Gfx, x: number, y: number, w: number, h: number, value: number, max: number, colour: number, marker?: number): void {
  g.rect(x, y, w, h, C.BLACK);
  g.rect(x + 1, y + 1, w - 2, h - 2, C.NEARBLACK);
  const fw = Math.round(((w - 2) * Math.max(0, Math.min(max, value))) / Math.max(1, max));
  if (fw > 0) {
    g.rect(x + 1, y + 1, fw, h - 2, colour);
    g.hline(x + 1, x + fw, y + 1, C.WHITE);
    if (h > 3) g.dither(x + 1, y + h - 2, fw, 1, C.BLACK);
  }
  if (marker !== undefined) {
    const mx = x + 1 + Math.round(((w - 2) * marker) / Math.max(1, max));
    g.vline(mx, y - 1, y + h, C.YELLOW);
  }
}

export function divider(g: Gfx, x: number, y: number, w: number): void {
  g.hline(x, x + w - 1, y, C.NAVY);
  g.hline(x, x + w - 1, y + 1, C.SLATE);
}

/** Wrapped text box; returns height used. */
export function textBox(g: Gfx, s: string, x: number, y: number, w: number, colour: number = C.LGREY, maxLines = 99, lineH = LINE_H): number {
  const lines = wrap(s, w);
  const n = Math.min(lines.length, maxLines);
  for (let i = 0; i < n; i++) text(g, lines[i], x, y + i * lineH, colour);
  return n * lineH;
}

/** Modal dimming behind dialogs (dithered, very Amiga). */
export function dim(g: Gfx): void {
  g.dither(0, 0, g.w, g.h, C.BLACK);
}
