import type { Gfx } from './gfx';
import { C, gradient12, rgb12 } from './palette';
import { ADVANCE, text, measure, TextOpts } from './font';
import { msLogo } from './sprites';

/** Sunset copper sky from y0 to y1. */
export function copperSky(g: Gfx, y0: number, y1: number, stops: string[]): void {
  const h = y1 - y0;
  for (let y = y0; y < y1; y++) g.rectRGB(0, y, g.w, 1, gradient12(stops, (y - y0) / h));
}

const STARS = Array.from({ length: 70 }, (_, i) => ({
  x: (i * 97 + 13) % 320,
  y: (i * 53 + 7) % 256,
  s: 1 + (i % 3),
}));

export function starfield(g: Gfx, t: number, yMax = 256, speed = 20): void {
  for (const st of STARS) {
    if (st.y >= yMax) continue;
    const x = (st.x - t * speed * st.s + 3200) % 320;
    const c = st.s === 3 ? C.WHITE : st.s === 2 ? C.LGREY : C.GREY;
    g.pset(x, st.y, c);
  }
}

export function twinkleStars(g: Gfx, t: number, yMax: number): void {
  for (const st of STARS) {
    if (st.y >= yMax) continue;
    const on = Math.sin(t * 2 + st.x) > -0.6;
    if (on) g.pset(st.x, st.y, st.s === 3 ? C.WHITE : C.LSLATE);
  }
}

/** Mountain silhouette layer. */
export function mountains(g: Gfx, horizon: number, t: number, colour: number, amp: number, freq: number, speed: number, offset = 0): void {
  for (let x = 0; x < g.w; x++) {
    const xx = x + t * speed + offset;
    const h = Math.abs(Math.sin(xx * freq) * amp + Math.sin(xx * freq * 2.7 + 1.3) * amp * 0.45 + Math.sin(xx * freq * 0.37) * amp * 0.6);
    g.rect(x, Math.floor(horizon - h), 1, Math.ceil(h), colour);
  }
}

/** Synthwave-meets-Amiga sun: Microsoft logo colours in horizontal slices. */
export function logoSun(g: Gfx, cx: number, cy: number, r: number, t: number, horizon: number): void {
  for (let y = -r; y <= 0; y++) {
    const sy = cy + y;
    if (sy >= horizon) continue;
    const w = Math.floor(Math.sqrt(r * r - y * y));
    const band = Math.floor((y + r) / 4);
    // slice gaps widen toward the bottom
    if (y > -r * 0.55 && (Math.floor(y + t * 6) % 6 === 0)) continue;
    const t2 = (y + r) / r;
    const col = gradient12(['ff6', 'fb0', 'f93', 'f52'], t2);
    g.rectRGB(cx - w, sy, w * 2, 1, col);
    void band;
  }
}

/**
 * Lotus Esprit Turbo Challenge-style raster road: each scanline is coloured
 * according to its projected depth so stripes rush toward the camera.
 */
export function rasterRoad(g: Gfx, horizon: number, t: number, speed: number, curve: number): void {
  const bottom = g.h;
  const depth = bottom - horizon;
  const travel = t * speed;
  for (let y = horizon; y < bottom; y++) {
    const p = (y - horizon + 1) / depth; // 0 at horizon -> 1 at bottom
    const z = 1 / p;
    const stripe = Math.floor(z * 3 + travel) & 1;
    const half = 6 + p * 180;
    const cx = 160 + curve * (1 - p) * (1 - p) * 70;
    const grass = stripe ? rgb12(34, 136, 34) : rgb12(51, 170, 51);
    g.rectRGB(0, y, g.w, 1, grass);
    const rumble = half * 0.12;
    g.rectRGB(cx - half - rumble, y, half * 2 + rumble * 2, 1, stripe ? rgb12(255, 255, 255) : rgb12(221, 34, 34));
    g.rectRGB(cx - half, y, half * 2, 1, stripe ? rgb12(102, 102, 119) : rgb12(119, 119, 136));
    if (stripe) {
      const lw = Math.max(1, half * 0.04);
      g.rectRGB(cx - lw, y, lw * 2, 1, rgb12(255, 255, 255));
    }
  }
}

/** Big demo-style sine scroller with copper gradient letters. */
export function sineScroller(g: Gfx, msg: string, y: number, t: number, speed = 60, amp = 6, scale = 2): void {
  const adv = ADVANCE * scale;
  const total = msg.length * adv;
  const offset = (t * speed) % (total + g.w);
  let x = g.w - offset;
  for (let i = 0; i < msg.length; i++) {
    const cx = x + i * adv;
    if (cx < -adv || cx > g.w) continue;
    const yy = y + Math.round(Math.sin(t * 3 + cx * 0.035) * amp);
    const opts: TextOpts = {
      scale,
      rowColour: (row) => gradient12(['fff', 'ff6', 'f93', 'f52', 'b22'], row / (8 * scale)),
    };
    text(g, msg[i], cx + 1, yy + 1, C.BLACK, { scale });
    text(g, msg[i], cx, yy, C.WHITE, opts);
  }
}

/** Large gradient title text with drop shadow, optionally bobbing per letter. */
export function titleText(g: Gfx, s: string, cx: number, y: number, scale: number, stops: string[], t = 0, bob = 0): void {
  const w = measure(s, { scale, bold: true });
  let x = Math.round(cx - w / 2);
  const adv = (ADVANCE + 1) * scale;
  for (let i = 0; i < s.length; i++) {
    const yy = y + (bob ? Math.round(Math.sin(t * 4 + i * 0.6) * bob) : 0);
    text(g, s[i], x + scale, yy + scale, C.BLACK, { scale, bold: true });
    text(g, s[i], x, yy, C.WHITE, { scale, bold: true, rowColour: (row) => gradient12(stops, row / (8 * scale)) });
    x += adv;
  }
}

/** Kickstart-style "insert disk" hand-free floppy animation helper. */
export function bigLogo(g: Gfx, x: number, y: number, size: number): void {
  msLogo(g, x, y, size, Math.max(1, Math.floor(size / 8)));
}

/** Simple confetti/fireworks particles for the victory screen. */
export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  c: number;
  life: number;
}

export function updateParticles(ps: Particle[], dt: number): void {
  for (const p of ps) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 60 * dt;
    p.life -= dt;
  }
  for (let i = ps.length - 1; i >= 0; i--) if (ps[i].life <= 0 || ps[i].y > 260) ps.splice(i, 1);
}

export function burst(ps: Particle[], x: number, y: number, n: number, colours: number[]): void {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = 30 + Math.random() * 70;
    ps.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 20, c: colours[i % colours.length], life: 1 + Math.random() * 1.5 });
  }
}

export function drawParticles(g: Gfx, ps: Particle[]): void {
  for (const p of ps) {
    g.pset(p.x, p.y, p.c);
    if (p.life > 1) g.pset(p.x + 1, p.y, p.c);
  }
}
