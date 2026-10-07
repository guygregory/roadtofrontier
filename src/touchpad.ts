import type { Input, Key } from './engine/input';

const REPEAT_DELAY = 380;
const REPEAT_RATE = 110;

function buzz(): void {
  navigator.vibrate?.(8);
}

/**
 * Wires the on-screen NES-style D-pad and the red arcade button (mobile only)
 * into the normal key input, so they behave like the arrow keys and Enter.
 */
export function initTouchpad(input: Input, rotated: () => boolean): void {
  const dpad = document.getElementById('dpad');
  const fire = document.getElementById('fire');
  if (!dpad || !fire) return;

  let dir: Key | null = null;
  let timer = 0;
  const arms = new Map<string, HTMLElement>();
  dpad.querySelectorAll<HTMLElement>('.dpad-btn').forEach((el) => arms.set(el.dataset.key ?? '', el));

  const setDir = (k: Key | null) => {
    if (k === dir) return;
    window.clearTimeout(timer);
    if (dir) arms.get(dir)?.classList.remove('down');
    dir = k;
    if (!k) return;
    arms.get(k)?.classList.add('down');
    input.press(k);
    buzz();
    const repeat = () => {
      input.press(k);
      timer = window.setTimeout(repeat, REPEAT_RATE);
    };
    timer = window.setTimeout(repeat, REPEAT_DELAY);
  };

  /** Direction from the touch position relative to the pad centre, so the thumb can roll between arms. */
  const dirAt = (e: PointerEvent): Key | null => {
    const r = dpad.getBoundingClientRect();
    let dx = e.clientX - (r.left + r.width / 2);
    let dy = e.clientY - (r.top + r.height / 2);
    // The pad is drawn rotated along with the game when held in portrait.
    if (rotated()) [dx, dy] = [dy, -dx];
    if (Math.hypot(dx, dy) < r.width * 0.12) return null;
    if (Math.abs(dx) > Math.abs(dy)) return dx < 0 ? 'left' : 'right';
    return dy < 0 ? 'up' : 'down';
  };

  dpad.addEventListener('pointerdown', (e) => {
    dpad.setPointerCapture(e.pointerId);
    setDir(dirAt(e));
    e.preventDefault();
  });
  dpad.addEventListener('pointermove', (e) => {
    if (dpad.hasPointerCapture(e.pointerId)) setDir(dirAt(e));
  });
  const release = () => setDir(null);
  dpad.addEventListener('pointerup', release);
  dpad.addEventListener('pointercancel', release);
  dpad.addEventListener('lostpointercapture', release);

  const button = fire.querySelector<HTMLElement>('.fire-btn') ?? fire;
  fire.addEventListener('pointerdown', (e) => {
    button.classList.add('down');
    input.press('enter');
    buzz();
    e.preventDefault();
  });
  const up = () => button.classList.remove('down');
  fire.addEventListener('pointerup', up);
  fire.addEventListener('pointercancel', up);
  fire.addEventListener('pointerleave', up);

  for (const el of [dpad, fire]) el.addEventListener('contextmenu', (e) => e.preventDefault());
}
