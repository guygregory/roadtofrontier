import type { Gfx } from './gfx';
import { C } from './palette';

// Hand-made 5x8 bitmap font (7 rows + 1 descender row). Monospaced, 6px advance.
const G: Record<string, string> = {
  ' ': '.....|.....|.....|.....|.....|.....|.....|.....',
  '!': '..#..|..#..|..#..|..#..|..#..|.....|..#..|.....',
  '"': '.#.#.|.#.#.|.#.#.|.....|.....|.....|.....|.....',
  '#': '.#.#.|.#.#.|#####|.#.#.|#####|.#.#.|.#.#.|.....',
  $: '..#..|.####|#.#..|.###.|..#.#|####.|..#..|.....',
  '%': '##...|##..#|...#.|..#..|.#...|#..##|...##|.....',
  '&': '.##..|#..#.|#.#..|.#...|#.#.#|#..#.|.##.#|.....',
  "'": '..#..|..#..|.#...|.....|.....|.....|.....|.....',
  '(': '...#.|..#..|.#...|.#...|.#...|..#..|...#.|.....',
  ')': '.#...|..#..|...#.|...#.|...#.|..#..|.#...|.....',
  '*': '.....|..#..|#.#.#|.###.|#.#.#|..#..|.....|.....',
  '+': '.....|..#..|..#..|#####|..#..|..#..|.....|.....',
  ',': '.....|.....|.....|.....|.....|.##..|..#..|.#...',
  '-': '.....|.....|.....|.###.|.....|.....|.....|.....',
  '.': '.....|.....|.....|.....|.....|.##..|.##..|.....',
  '/': '.....|....#|...#.|..#..|.#...|#....|.....|.....',
  '0': '.###.|#...#|#..##|#.#.#|##..#|#...#|.###.|.....',
  '1': '..#..|.##..|..#..|..#..|..#..|..#..|.###.|.....',
  '2': '.###.|#...#|....#|...#.|..#..|.#...|#####|.....',
  '3': '#####|...#.|..#..|...#.|....#|#...#|.###.|.....',
  '4': '...#.|..##.|.#.#.|#..#.|#####|...#.|...#.|.....',
  '5': '#####|#....|####.|....#|....#|#...#|.###.|.....',
  '6': '..##.|.#...|#....|####.|#...#|#...#|.###.|.....',
  '7': '#####|....#|...#.|..#..|.#...|.#...|.#...|.....',
  '8': '.###.|#...#|#...#|.###.|#...#|#...#|.###.|.....',
  '9': '.###.|#...#|#...#|.####|....#|...#.|.##..|.....',
  ':': '.....|.##..|.##..|.....|.##..|.##..|.....|.....',
  ';': '.....|.##..|.##..|.....|.##..|..#..|.#...|.....',
  '<': '...#.|..#..|.#...|#....|.#...|..#..|...#.|.....',
  '=': '.....|.....|#####|.....|#####|.....|.....|.....',
  '>': '.#...|..#..|...#.|....#|...#.|..#..|.#...|.....',
  '?': '.###.|#...#|....#|...#.|..#..|.....|..#..|.....',
  '@': '.###.|#...#|....#|.##.#|#.#.#|#.#.#|.###.|.....',
  A: '.###.|#...#|#...#|#####|#...#|#...#|#...#|.....',
  B: '####.|#...#|#...#|####.|#...#|#...#|####.|.....',
  C: '.###.|#...#|#....|#....|#....|#...#|.###.|.....',
  D: '###..|#..#.|#...#|#...#|#...#|#..#.|###..|.....',
  E: '#####|#....|#....|####.|#....|#....|#####|.....',
  F: '#####|#....|#....|####.|#....|#....|#....|.....',
  G: '.###.|#...#|#....|#.###|#...#|#...#|.####|.....',
  H: '#...#|#...#|#...#|#####|#...#|#...#|#...#|.....',
  I: '.###.|..#..|..#..|..#..|..#..|..#..|.###.|.....',
  J: '..###|...#.|...#.|...#.|...#.|#..#.|.##..|.....',
  K: '#...#|#..#.|#.#..|##...|#.#..|#..#.|#...#|.....',
  L: '#....|#....|#....|#....|#....|#....|#####|.....',
  M: '#...#|##.##|#.#.#|#.#.#|#...#|#...#|#...#|.....',
  N: '#...#|#...#|##..#|#.#.#|#..##|#...#|#...#|.....',
  O: '.###.|#...#|#...#|#...#|#...#|#...#|.###.|.....',
  P: '####.|#...#|#...#|####.|#....|#....|#....|.....',
  Q: '.###.|#...#|#...#|#...#|#.#.#|#..#.|.##.#|.....',
  R: '####.|#...#|#...#|####.|#.#..|#..#.|#...#|.....',
  S: '.####|#....|#....|.###.|....#|....#|####.|.....',
  T: '#####|..#..|..#..|..#..|..#..|..#..|..#..|.....',
  U: '#...#|#...#|#...#|#...#|#...#|#...#|.###.|.....',
  V: '#...#|#...#|#...#|#...#|#...#|.#.#.|..#..|.....',
  W: '#...#|#...#|#...#|#.#.#|#.#.#|#.#.#|.#.#.|.....',
  X: '#...#|#...#|.#.#.|..#..|.#.#.|#...#|#...#|.....',
  Y: '#...#|#...#|.#.#.|..#..|..#..|..#..|..#..|.....',
  Z: '#####|....#|...#.|..#..|.#...|#....|#####|.....',
  '[': '.###.|.#...|.#...|.#...|.#...|.#...|.###.|.....',
  '\\': '.....|#....|.#...|..#..|...#.|....#|.....|.....',
  ']': '.###.|...#.|...#.|...#.|...#.|...#.|.###.|.....',
  '^': '..#..|.#.#.|#...#|.....|.....|.....|.....|.....',
  _: '.....|.....|.....|.....|.....|.....|.....|#####',
  '`': '.#...|..#..|.....|.....|.....|.....|.....|.....',
  a: '.....|.....|.###.|....#|.####|#...#|.####|.....',
  b: '#....|#....|####.|#...#|#...#|#...#|####.|.....',
  c: '.....|.....|.###.|#....|#....|#...#|.###.|.....',
  d: '....#|....#|.####|#...#|#...#|#...#|.####|.....',
  e: '.....|.....|.###.|#...#|#####|#....|.###.|.....',
  f: '..##.|.#..#|.#...|###..|.#...|.#...|.#...|.....',
  g: '.....|.....|.####|#...#|#...#|.####|....#|.###.',
  h: '#....|#....|#.##.|##..#|#...#|#...#|#...#|.....',
  i: '..#..|.....|.##..|..#..|..#..|..#..|.###.|.....',
  j: '...#.|.....|..##.|...#.|...#.|...#.|#..#.|.##..',
  k: '#....|#....|#..#.|#.#..|##...|#.#..|#..#.|.....',
  l: '.##..|..#..|..#..|..#..|..#..|..#..|.###.|.....',
  m: '.....|.....|##.#.|#.#.#|#.#.#|#...#|#...#|.....',
  n: '.....|.....|#.##.|##..#|#...#|#...#|#...#|.....',
  o: '.....|.....|.###.|#...#|#...#|#...#|.###.|.....',
  p: '.....|.....|####.|#...#|#...#|####.|#....|#....',
  q: '.....|.....|.####|#...#|#...#|.####|....#|....#',
  r: '.....|.....|#.##.|##..#|#....|#....|#....|.....',
  s: '.....|.....|.####|#....|.###.|....#|####.|.....',
  t: '.#...|.#...|###..|.#...|.#...|.#..#|..##.|.....',
  u: '.....|.....|#...#|#...#|#...#|#..##|.##.#|.....',
  v: '.....|.....|#...#|#...#|#...#|.#.#.|..#..|.....',
  w: '.....|.....|#...#|#...#|#.#.#|#.#.#|.#.#.|.....',
  x: '.....|.....|#...#|.#.#.|..#..|.#.#.|#...#|.....',
  y: '.....|.....|#...#|#...#|#...#|.####|....#|.###.',
  z: '.....|.....|#####|...#.|..#..|.#...|#####|.....',
  '{': '...##|..#..|..#..|.#...|..#..|..#..|...##|.....',
  '|': '..#..|..#..|..#..|..#..|..#..|..#..|..#..|.....',
  '}': '##...|..#..|..#..|...#.|..#..|..#..|##...|.....',
  '~': '.....|.....|.#...|#.#.#|...#.|.....|.....|.....',
  '£': '..##.|.#..#|.#...|###..|.#...|.#...|#####|.....',
  '€': '..###|.#...|####.|.#...|####.|.#...|..###|.....',
  '►': '.#...|.##..|.###.|.####|.###.|.##..|.#...|.....',
  '◄': '...#.|..##.|.###.|####.|.###.|..##.|...#.|.....',
  '▲': '.....|..#..|..#..|.###.|.###.|#####|.....|.....',
  '▼': '.....|#####|.###.|.###.|..#..|..#..|.....|.....',
  '✓': '.....|....#|...##|#.##.|###..|.#...|.....|.....',
  '✗': '.....|#...#|.#.#.|..#..|.#.#.|#...#|.....|.....',
  '•': '.....|.....|.###.|.###.|.###.|.....|.....|.....',
  '…': '.....|.....|.....|.....|.....|.....|#.#.#|.....',
  '—': '.....|.....|.....|#####|.....|.....|.....|.....',
  '♥': '.....|.#.#.|#####|#####|.###.|..#..|.....|.....',
  '♪': '..##.|..#.#|..#..|..#..|.##..|###..|.#...|.....',
  '★': '..#..|..#..|#####|.###.|.###.|##.##|#...#|.....',
  '█': '#####|#####|#####|#####|#####|#####|#####|#####',
};

const ALIASES: Record<string, string> = { '’': "'", '‘': "'", '“': '"', '”': '"', '–': '-', 'é': 'e', 'è': 'e', 'ü': 'u', 'ö': 'o', 'ä': 'a', '©': 'c' };

export const GLYPH_W = 5;
export const GLYPH_H = 8;
export const ADVANCE = 6;
export const LINE_H = 10;

const glyphCache = new Map<string, Uint8Array>();

function glyph(ch: string): Uint8Array {
  let g = glyphCache.get(ch);
  if (g) return g;
  const src = G[ch] ?? G[ALIASES[ch] ?? ''] ?? G['?'];
  g = new Uint8Array(GLYPH_W * GLYPH_H);
  const rows = src.split('|');
  for (let y = 0; y < GLYPH_H; y++) {
    const row = rows[y] ?? '.....';
    for (let x = 0; x < GLYPH_W; x++) g[y * GLYPH_W + x] = row[x] === '#' ? 1 : 0;
  }
  glyphCache.set(ch, g);
  return g;
}

/** Colour markup used inside strings: {y}yellow{/} etc. */
export const TAGS: Record<string, number> = {
  w: C.WHITE,
  y: C.YELLOW,
  Y: C.MSYELLOW,
  r: C.RED,
  R: C.MSRED,
  g: C.GREEN,
  G: C.MSGREEN,
  c: C.CYAN,
  b: C.MSBLUE,
  o: C.ORANGE,
  m: C.PINK,
  p: C.PURPLE,
  d: C.GREY,
  l: C.LGREY,
  k: C.BLACK,
  s: C.LSLATE,
};

export interface TextOpts {
  scale?: number;
  bold?: boolean;
  shadow?: number;
  /** Per-row colour function for copper-gradient text (row 0..glyph height*scale-1). */
  rowColour?: (row: number) => number; // packed RGB
  align?: 'left' | 'center' | 'right';
}

export function stripTags(s: string): string {
  return s.replace(/\{[a-zA-Z/]\}/g, '');
}

export function measure(s: string, opts: TextOpts = {}): number {
  const scale = opts.scale ?? 1;
  const adv = (ADVANCE + (opts.bold ? 1 : 0)) * scale;
  const n = [...stripTags(s)].length;
  return n === 0 ? 0 : n * adv - scale;
}

function drawGlyph(g: Gfx, ch: string, x: number, y: number, colour: number, opts: TextOpts, rgb?: (row: number) => number): void {
  const scale = opts.scale ?? 1;
  const gl = glyph(ch);
  const bold = opts.bold ? 1 : 0;
  for (let gy = 0; gy < GLYPH_H; gy++) {
    for (let gx = 0; gx < GLYPH_W; gx++) {
      if (!gl[gy * GLYPH_W + gx]) continue;
      for (let b = 0; b <= bold; b++) {
        const px = x + (gx + b) * scale;
        const py = y + gy * scale;
        if (rgb) {
          for (let sy = 0; sy < scale; sy++) g.rectRGB(px, py + sy, scale, 1, rgb(gy * scale + sy));
        } else if (scale === 1) g.pset(px, py, colour);
        else g.rect(px, py, scale, scale, colour);
      }
    }
  }
}

/** Draw text with optional {tag} colour markup. Returns the x after the last character. */
export function text(g: Gfx, s: string, x: number, y: number, colour: number = C.WHITE, opts: TextOpts = {}): number {
  const scale = opts.scale ?? 1;
  const adv = (ADVANCE + (opts.bold ? 1 : 0)) * scale;
  if (opts.align === 'center') x = Math.round(x - measure(s, opts) / 2);
  else if (opts.align === 'right') x = x - measure(s, opts);
  if (opts.shadow !== undefined) {
    text(g, stripTags(s), x + scale, y + scale, opts.shadow, { ...opts, shadow: undefined, rowColour: undefined, align: 'left' });
  }
  let cur = colour;
  const chars = [...s];
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (ch === '{' && chars[i + 2] === '}') {
      const t = chars[i + 1];
      if (t === '/') {
        cur = colour;
        i += 2;
        continue;
      }
      if (TAGS[t] !== undefined) {
        cur = TAGS[t];
        i += 2;
        continue;
      }
    }
    if (ch !== ' ') drawGlyph(g, ch, x, y, cur, opts, opts.rowColour);
    x += adv;
  }
  return x;
}

/**
 * Word-wrap text (keeping colour tags) to a pixel width. Explicit '\n' forces a break.
 * Active colour tags are carried over to the following line.
 */
export function wrap(s: string, maxWidth: number, opts: TextOpts = {}): string[] {
  const scale = opts.scale ?? 1;
  const adv = (ADVANCE + (opts.bold ? 1 : 0)) * scale;
  const maxChars = Math.max(1, Math.floor((maxWidth + scale) / adv));
  const out: string[] = [];
  for (const para of s.split('\n')) {
    const words = para.split(' ');
    let line = '';
    let lineLen = 0;
    let activeTag = '';
    let lineStartTag = '';
    const scanTags = (w: string) => {
      const re = /\{([a-zA-Z/])\}/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(w))) activeTag = m[1] === '/' ? '' : `{${m[1]}}`;
    };
    for (const word of words) {
      const wl = [...stripTags(word)].length;
      if (lineLen > 0 && lineLen + 1 + wl > maxChars) {
        out.push(lineStartTag + line);
        lineStartTag = activeTag;
        line = '';
        lineLen = 0;
      }
      if (lineLen > 0) {
        line += ' ';
        lineLen += 1;
      }
      // hard-split very long words
      if (wl > maxChars) {
        const plain = [...stripTags(word)];
        for (let i = 0; i < plain.length; i += maxChars) {
          const chunk = plain.slice(i, i + maxChars).join('');
          if (i + maxChars < plain.length) {
            out.push(lineStartTag + line + chunk);
            line = '';
            lineLen = 0;
          } else {
            line += chunk;
            lineLen += chunk.length;
          }
        }
        scanTags(word);
        continue;
      }
      line += word;
      lineLen += wl;
      scanTags(word);
    }
    out.push(lineStartTag + line);
  }
  return out;
}

/** Draw wrapped paragraph; returns the y below the last line. */
export function paragraph(g: Gfx, s: string, x: number, y: number, maxWidth: number, colour: number = C.WHITE, lineH = LINE_H, opts: TextOpts = {}): number {
  const lines = wrap(s, maxWidth, opts);
  for (const l of lines) {
    text(g, l, x, y, colour, opts);
    y += lineH;
  }
  return y;
}
