import { SCREEN_H, SCREEN_W } from './gfx';

export type Key =
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'enter'
  | 'back'
  | 'tab'
  | 'pgup'
  | 'pgdn'
  | 'backspace'
  | 'mute'
  | 'fullscreen';

/**
 * Collects DOM input between frames and exposes it as per-frame state.
 * Mouse coordinates are converted to the 320x256 logical screen.
 */
export class Input {
  mx = -1;
  my = -1;
  moved = false;
  clicked = false;
  clickX = -1;
  clickY = -1;
  wheel = 0;
  keys = new Set<Key>();
  typed: string[] = [];
  anyKey = false;
  /** Set when a widget consumed this frame's click/enter so nothing else reacts. */
  consumed = false;
  lastDevice: 'mouse' | 'keyboard' = 'mouse';
  /** When true, printable keys are only delivered as typed text (no WASD/M/F shortcuts). */
  textMode = false;

  private pendingKeys: Key[] = [];
  private pendingTyped: string[] = [];
  private pendingClick: { x: number; y: number } | null = null;
  private pendingMove = false;
  private pendingWheel = 0;
  private pendingAny = false;
  private listeners: Array<() => void> = [];

  constructor(canvas: HTMLCanvasElement, private scaleRef: () => number) {
    const toLogical = (e: { clientX: number; clientY: number }) => {
      const r = canvas.getBoundingClientRect();
      const s = this.scaleRef();
      return { x: Math.floor((e.clientX - r.left) / s), y: Math.floor((e.clientY - r.top) / s) };
    };
    const onMove = (e: PointerEvent) => {
      const p = toLogical(e);
      if (p.x !== this.mx || p.y !== this.my) {
        this.mx = p.x;
        this.my = p.y;
        this.pendingMove = true;
        this.lastDevice = 'mouse';
      }
    };
    const onDown = (e: PointerEvent) => {
      if (e.button === 2) {
        this.pendingKeys.push('back');
        this.pendingAny = true;
        e.preventDefault();
        return;
      }
      const p = toLogical(e);
      this.mx = p.x;
      this.my = p.y;
      if (p.x >= 0 && p.y >= 0 && p.x < SCREEN_W && p.y < SCREEN_H) {
        this.pendingClick = p;
        this.pendingMove = true;
        this.lastDevice = 'mouse';
      }
      this.pendingAny = true;
      canvas.focus();
      e.preventDefault();
    };
    const onWheel = (e: WheelEvent) => {
      this.pendingWheel += Math.sign(e.deltaY);
      e.preventDefault();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const printable = e.key.length === 1;
      const k = this.textMode && printable ? null : mapKey(e.key);
      this.pendingAny = true;
      this.lastDevice = 'keyboard';
      if (k) {
        this.pendingKeys.push(k);
        e.preventDefault();
      }
      if (printable) {
        this.pendingTyped.push(e.key);
        if (e.key === ' ' || this.textMode) e.preventDefault();
      }
    };
    const onContext = (e: Event) => e.preventDefault();
    canvas.addEventListener('pointermove', onMove);
    window.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKey);
    canvas.addEventListener('contextmenu', onContext);
    this.listeners.push(
      () => canvas.removeEventListener('pointermove', onMove),
      () => window.removeEventListener('pointermove', onMove),
      () => canvas.removeEventListener('pointerdown', onDown),
      () => canvas.removeEventListener('wheel', onWheel),
      () => window.removeEventListener('keydown', onKey),
      () => canvas.removeEventListener('contextmenu', onContext),
    );
  }

  /** Move pending DOM events into this frame's state. Call once at frame start. */
  poll(): void {
    this.keys = new Set(this.pendingKeys);
    this.typed = this.pendingTyped;
    this.clicked = this.pendingClick !== null;
    this.clickX = this.pendingClick?.x ?? -1;
    this.clickY = this.pendingClick?.y ?? -1;
    this.moved = this.pendingMove;
    this.wheel = this.pendingWheel;
    this.anyKey = this.pendingAny;
    this.consumed = false;
    this.pendingKeys = [];
    this.pendingTyped = [];
    this.pendingClick = null;
    this.pendingMove = false;
    this.pendingWheel = 0;
    this.pendingAny = false;
  }

  pressed(k: Key): boolean {
    return this.keys.has(k);
  }

  /** Consume a key so later widgets in this frame don't also react to it. */
  take(k: Key): boolean {
    if (this.keys.has(k)) {
      this.keys.delete(k);
      return true;
    }
    return false;
  }

  inRect(x: number, y: number, w: number, h: number): boolean {
    return this.mx >= x && this.my >= y && this.mx < x + w && this.my < y + h;
  }

  clickIn(x: number, y: number, w: number, h: number): boolean {
    return !this.consumed && this.clicked && this.clickX >= x && this.clickY >= y && this.clickX < x + w && this.clickY < y + h;
  }

  dispose(): void {
    this.listeners.forEach((f) => f());
  }
}

function mapKey(key: string): Key | null {
  switch (key) {
    case 'ArrowUp':
    case 'w':
    case 'W':
      return 'up';
    case 'ArrowDown':
    case 's':
    case 'S':
      return 'down';
    case 'ArrowLeft':
    case 'a':
    case 'A':
      return 'left';
    case 'ArrowRight':
    case 'd':
    case 'D':
      return 'right';
    case 'Enter':
    case ' ':
      return 'enter';
    case 'Escape':
      return 'back';
    case 'Tab':
      return 'tab';
    case 'PageUp':
      return 'pgup';
    case 'PageDown':
      return 'pgdn';
    case 'Backspace':
      return 'backspace';
    case 'm':
    case 'M':
      return 'mute';
    case 'f':
    case 'F':
      return 'fullscreen';
    default:
      return null;
  }
}
