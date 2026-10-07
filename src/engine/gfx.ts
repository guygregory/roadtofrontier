import { PALETTE } from './palette';

export const SCREEN_W = 320;
export const SCREEN_H = 256;

export interface Sprite {
  w: number;
  h: number;
  /** Palette indices, 255 = transparent. */
  px: Uint8Array;
}

/**
 * Software framebuffer (320x256, PAL Amiga low-res). All drawing goes through
 * palette indices (or explicit 12-bit "copper" colours) into a Uint32 buffer
 * that is pushed to the canvas once per frame.
 */
export class Gfx {
  readonly w = SCREEN_W;
  readonly h = SCREEN_H;
  readonly buf: Uint32Array;
  private img: ImageData;
  private ctx: CanvasRenderingContext2D | null;
  private cx0 = 0;
  private cy0 = 0;
  private cx1 = SCREEN_W;
  private cy1 = SCREEN_H;
  /** Drawing offset (applied to all primitives except fill). */
  tx = 0;
  ty = 0;

  translate(x: number, y: number): void {
    this.tx = x;
    this.ty = y;
  }

  constructor(canvas?: HTMLCanvasElement) {
    this.ctx = canvas ? canvas.getContext('2d', { alpha: false }) : null;
    this.img = this.ctx ? this.ctx.createImageData(SCREEN_W, SCREEN_H) : ({ data: new Uint8ClampedArray(SCREEN_W * SCREEN_H * 4) } as ImageData);
    this.buf = new Uint32Array(this.img.data.buffer);
  }

  clip(x: number, y: number, w: number, h: number): void {
    this.cx0 = Math.max(0, x);
    this.cy0 = Math.max(0, y);
    this.cx1 = Math.min(SCREEN_W, x + w);
    this.cy1 = Math.min(SCREEN_H, y + h);
  }

  unclip(): void {
    this.cx0 = 0;
    this.cy0 = 0;
    this.cx1 = SCREEN_W;
    this.cy1 = SCREEN_H;
  }

  pset(x: number, y: number, c: number): void {
    x = (x + this.tx) | 0;
    y = (y + this.ty) | 0;
    if (x < this.cx0 || y < this.cy0 || x >= this.cx1 || y >= this.cy1) return;
    this.buf[y * SCREEN_W + x] = PALETTE[c];
  }

  psetRGB(x: number, y: number, rgb: number): void {
    x = (x + this.tx) | 0;
    y = (y + this.ty) | 0;
    if (x < this.cx0 || y < this.cy0 || x >= this.cx1 || y >= this.cy1) return;
    this.buf[y * SCREEN_W + x] = rgb;
  }

  fill(c: number): void {
    this.buf.fill(PALETTE[c]);
  }

  rect(x: number, y: number, w: number, h: number, c: number): void {
    this.rectRGB(x, y, w, h, PALETTE[c]);
  }

  rectRGB(x: number, y: number, w: number, h: number, rgb: number): void {
    x += this.tx;
    y += this.ty;
    const x0 = Math.max(this.cx0, x | 0);
    const y0 = Math.max(this.cy0, y | 0);
    const x1 = Math.min(this.cx1, (x + w) | 0);
    const y1 = Math.min(this.cy1, (y + h) | 0);
    if (x1 <= x0 || y1 <= y0) return;
    for (let yy = y0; yy < y1; yy++) {
      const row = yy * SCREEN_W;
      this.buf.fill(rgb, row + x0, row + x1);
    }
  }

  hlineRGB(x0: number, x1: number, y: number, rgb: number): void {
    this.rectRGB(Math.min(x0, x1), y, Math.abs(x1 - x0) + 1, 1, rgb);
  }

  hline(x0: number, x1: number, y: number, c: number): void {
    this.rect(Math.min(x0, x1), y, Math.abs(x1 - x0) + 1, 1, c);
  }

  vline(x: number, y0: number, y1: number, c: number): void {
    this.rect(x, Math.min(y0, y1), 1, Math.abs(y1 - y0) + 1, c);
  }

  frame(x: number, y: number, w: number, h: number, c: number): void {
    this.hline(x, x + w - 1, y, c);
    this.hline(x, x + w - 1, y + h - 1, c);
    this.vline(x, y, y + h - 1, c);
    this.vline(x + w - 1, y, y + h - 1, c);
  }

  line(x0: number, y0: number, x1: number, y1: number, c: number): void {
    x0 |= 0;
    y0 |= 0;
    x1 |= 0;
    y1 |= 0;
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.pset(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
  }

  /** Workbench-style raised (or sunken) bevelled box. */
  bevel(x: number, y: number, w: number, h: number, fill: number, light: number, dark: number, sunken = false): void {
    if (fill >= 0) this.rect(x, y, w, h, fill);
    const a = sunken ? dark : light;
    const b = sunken ? light : dark;
    this.hline(x, x + w - 1, y, a);
    this.vline(x, y, y + h - 1, a);
    this.hline(x, x + w - 1, y + h - 1, b);
    this.vline(x + w - 1, y, y + h - 1, b);
  }

  /** Ordered 50% checkerboard dither, a classic Amiga shading trick. */
  dither(x: number, y: number, w: number, h: number, c: number, phase = 0): void {
    for (let yy = y; yy < y + h; yy++) {
      for (let xx = x; xx < x + w; xx++) {
        if (((xx + yy + phase) & 1) === 0) this.pset(xx, yy, c);
      }
    }
  }

  circle(cx: number, cy: number, r: number, c: number, filled = true): void {
    for (let y = -r; y <= r; y++) {
      for (let x = -r; x <= r; x++) {
        const d = x * x + y * y;
        if (filled ? d <= r * r + r * 0.8 : d <= r * r + r * 0.8 && d >= (r - 1) * (r - 1) + (r - 1) * 0.8) {
          this.pset(cx + x, cy + y, c);
        }
      }
    }
  }

  blit(s: Sprite, x: number, y: number, opts: { scale?: number; flipX?: boolean; tint?: number; shadow?: number } = {}): void {
    const scale = opts.scale ?? 1;
    if (opts.shadow !== undefined) {
      this.blit(s, x + scale, y + scale, { scale, flipX: opts.flipX, tint: opts.shadow });
    }
    for (let sy = 0; sy < s.h; sy++) {
      for (let sx = 0; sx < s.w; sx++) {
        const p = s.px[sy * s.w + (opts.flipX ? s.w - 1 - sx : sx)];
        if (p === 255) continue;
        const col = opts.tint !== undefined ? opts.tint : p;
        if (scale === 1) this.pset(x + sx, y + sy, col);
        else this.rect(x + sx * scale, y + sy * scale, scale, scale, col);
      }
    }
  }

  /** Darken the whole frame by factor f (0..1) in 12-bit steps, like an Amiga palette fade. */
  fade(f: number): void {
    if (f >= 1) return;
    const k = Math.max(0, f);
    const b = this.buf;
    for (let i = 0; i < b.length; i++) {
      const v = b[i];
      const r = Math.round(((v & 255) / 17) * k) * 17;
      const g = Math.round((((v >> 8) & 255) / 17) * k) * 17;
      const bl = Math.round((((v >> 16) & 255) / 17) * k) * 17;
      b[i] = ((255 << 24) | (bl << 16) | (g << 8) | r) >>> 0;
    }
  }

  present(): void {
    if (this.ctx) this.ctx.putImageData(this.img, 0, 0);
  }
}
