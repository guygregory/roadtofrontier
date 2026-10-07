// 32-colour Amiga OCS-style palette. Every colour is 12-bit (#RGB, 4 bits per channel).
export const PALETTE_HEX: string[] = [
  '000', 'fff', 'ccc', '889', '556', '223', // 0-5  black, white, greys
  'f52', '8b0', '0af', 'fb0', // 6-9  Microsoft logo red, green, blue, yellow
  'e33', '4e4', 'ff6', '6df', 'f5a', '95e', // 10-15 brights
  '024', '048', '07c', '012', // 16-19 blues
  'f93', '842', '520', 'fca', 'd96', // 20-24 warm tones
  '252', '5a4', '700', 'b22', // 25-28 greens / reds
  '335', '779', 'fec', // 29-31 slate, cream
];

export const C = {
  BLACK: 0,
  WHITE: 1,
  LGREY: 2,
  GREY: 3,
  DGREY: 4,
  NEARBLACK: 5,
  MSRED: 6,
  MSGREEN: 7,
  MSBLUE: 8,
  MSYELLOW: 9,
  RED: 10,
  GREEN: 11,
  YELLOW: 12,
  CYAN: 13,
  PINK: 14,
  PURPLE: 15,
  NAVY: 16,
  ROYAL: 17,
  BLUE: 18,
  DNAVY: 19,
  ORANGE: 20,
  BROWN: 21,
  DBROWN: 22,
  SKIN: 23,
  SKIN2: 24,
  DGREEN: 25,
  MGREEN: 26,
  DRED: 27,
  MRED: 28,
  SLATE: 29,
  LSLATE: 30,
  CREAM: 31,
} as const;

/** Pack 8-bit RGB into an ABGR Uint32 (little-endian canvas ImageData layout). */
export function packRGB(r: number, g: number, b: number): number {
  return ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
}

/** Quantise 8-bit channels to the Amiga's 4-bit-per-channel colour space. */
export function rgb12(r: number, g: number, b: number): number {
  const q = (v: number) => Math.max(0, Math.min(15, Math.round(v / 17))) * 17;
  return packRGB(q(r), q(g), q(b));
}

export function hexToRGB(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  if (h.length === 3) {
    return [parseInt(h[0], 16) * 17, parseInt(h[1], 16) * 17, parseInt(h[2], 16) * 17];
  }
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export const PALETTE_RGB: [number, number, number][] = PALETTE_HEX.map(hexToRGB);
export const PALETTE: Uint32Array = new Uint32Array(PALETTE_RGB.map(([r, g, b]) => packRGB(r, g, b)));

/** Interpolate between two hex colours and quantise to 12-bit (copper-style gradients). */
export function lerp12(a: string, b: string, t: number): number {
  const [r1, g1, b1] = hexToRGB(a);
  const [r2, g2, b2] = hexToRGB(b);
  const k = Math.max(0, Math.min(1, t));
  return rgb12(r1 + (r2 - r1) * k, g1 + (g2 - g1) * k, b1 + (b2 - b1) * k);
}

/** Multi-stop gradient sampled at t (0..1), quantised to 12-bit. */
export function gradient12(stops: string[], t: number): number {
  if (stops.length === 1) return lerp12(stops[0], stops[0], 0);
  const k = Math.max(0, Math.min(0.99999, t)) * (stops.length - 1);
  const i = Math.floor(k);
  return lerp12(stops[i], stops[i + 1], k - i);
}
