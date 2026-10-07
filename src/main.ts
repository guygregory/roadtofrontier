import { Gfx, SCREEN_H, SCREEN_W } from './engine/gfx';
import { Input } from './engine/input';
import { audio } from './engine/audio';
import { SPR } from './engine/sprites';
import { App } from './app';
import { ui } from './engine/ui';
import { loadSettings } from './game/save';
import { BootScene } from './scenes/boot';
import { toggleFullscreen } from './fullscreen';
import { isMobile, lockLandscape } from './mobile';
import { initTouchpad } from './touchpad';
import { ShareScene } from './scenes/share';
import { EndingScene } from './scenes/ending';
import { YearEndScene } from './scenes/yearend';
import { HelpScene } from './scenes/help';
import { CreditsScene } from './scenes/credits';
import { TitleScene } from './scenes/title';
import { HubScene } from './scenes/hub';
import { PlanScene } from './scenes/plan';
import { ActionsScene } from './scenes/actions';
import { CompanyScene } from './scenes/company';
import { EventScene } from './scenes/event';
import { SetupScene } from './scenes/setup';
import { PartnerCenterScene } from './scenes/partnercenter';
import { GameMenuScene } from './scenes/gamemenu';

const canvas = document.getElementById('screen') as HTMLCanvasElement;
const stage = document.getElementById('stage') as HTMLDivElement;
const crt = document.getElementById('crt') as HTMLDivElement;
const shell = document.getElementById('shell') as HTMLDivElement;
const root = document.documentElement;
root.classList.toggle('mobile', isMobile);

let scale = 1;
let rotated = false;
/** True while the on-screen keyboard is up: keep the layout steady instead of re-fitting the game. */
let typing = false;
/** Orientation at the last fit: turning the phone always re-fits, even while typing. */
let fittedOrientation = '';

function orientation(): string {
  return screen.orientation?.type ?? (window.innerWidth > window.innerHeight ? 'landscape' : 'portrait');
}

/**
 * Mobile: always landscape (the game is turned sideways when the phone is held upright),
 * filling the full height with the D-pad and fire button in the space either side.
 */
function resizeMobile(): void {
  rotated = window.innerHeight > window.innerWidth;
  root.classList.toggle('portrait', rotated);
  const w = rotated ? window.innerHeight : window.innerWidth;
  const h = rotated ? window.innerWidth : window.innerHeight;
  const reserve = Math.min(180, Math.max(90, h * 0.3));
  scale = Math.max(0.5, Math.min((w - 2 * reserve) / SCREEN_W, h / SCREEN_H));
  const cw = Math.round(SCREEN_W * scale);
  const ch = Math.round(SCREEN_H * scale);
  const side = (w - cw) / 2;
  shell.style.width = `${w}px`;
  shell.style.height = `${h}px`;
  shell.style.setProperty('--side', `${side}px`);
  shell.style.setProperty('--pad', `${Math.round(Math.min(side * 0.85, h * 0.5, 200))}px`);
  canvas.style.width = `${cw}px`;
  canvas.style.height = `${ch}px`;
  stage.style.width = `${cw}px`;
  stage.style.height = `${ch}px`;
  crt.style.backgroundSize = `100% ${Math.max(2, Math.round(scale))}px, 100% 100%`;
}

/** Integer scaling keeps every pixel crisp, like a real low-res display. */
function resize(): void {
  if (isMobile) {
    // An on-screen keyboard shrinks the window: ignore that, but not a turn of the phone.
    if (!typing || orientation() !== fittedOrientation) {
      fittedOrientation = orientation();
      resizeMobile();
    }
    return;
  }
  const w = window.innerWidth;
  const h = window.innerHeight;
  // Allow non-integer scaling only on small screens where integer would be tiny.
  let s = Math.floor(Math.min(w / SCREEN_W, h / SCREEN_H));
  if (s < 1) s = Math.min(w / SCREEN_W, h / SCREEN_H);
  scale = Math.max(0.5, s);
  const cw = Math.round(SCREEN_W * scale);
  const ch = Math.round(SCREEN_H * scale);
  canvas.style.width = `${cw}px`;
  canvas.style.height = `${ch}px`;
  stage.style.width = `${cw}px`;
  stage.style.height = `${ch}px`;
  crt.style.backgroundSize = `100% ${Math.max(2, Math.round(scale))}px, 100% 100%`;
}

window.addEventListener('resize', resize);
window.addEventListener('orientationchange', resize);
document.addEventListener('focusin', (e) => {
  typing = e.target instanceof HTMLInputElement;
});
document.addEventListener('focusout', () => {
  typing = false;
  // Re-fit once the on-screen keyboard has gone.
  window.setTimeout(resize, 300);
});
resize();

const g = new Gfx(canvas);
const input = new Input(canvas, () => scale, () => rotated, isMobile);
if (isMobile) {
  initTouchpad(input, () => rotated);
  // Fullscreen / orientation lock need a user gesture.
  window.addEventListener('pointerdown', lockLandscape, { once: true });
}
const settings = loadSettings();
audio.musicOn = settings.music;
audio.sfxOn = settings.sfx;
crt.classList.toggle('on', settings.crt);
canvas.style.cursor = 'none';

const app = new App(g, input, settings);
app.go(new BootScene(), true);

// Expose a tiny debug hook for automated smoke tests.
(window as unknown as { __rtf: App; __rtfScenes: unknown }).__rtf = app;
(window as unknown as { __rtfUi: unknown }).__rtfUi = ui;
(window as unknown as { __rtfAudio: unknown }).__rtfAudio = audio;
(window as unknown as { __rtfScenes: unknown }).__rtfScenes = { EndingScene, YearEndScene, HelpScene, CreditsScene, TitleScene, HubScene, PlanScene, ActionsScene, CompanyScene, EventScene, ShareScene, SetupScene, PartnerCenterScene, GameMenuScene };

let last = performance.now();
function loop(now: number): void {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  input.poll();
  if (!input.textMode) {
    if (input.take('mute')) {
      settings.music = !settings.music;
      audio.setMusic(settings.music);
      app.persistSettings();
      app.toast(settings.music ? 'MUSIC ON' : 'MUSIC OFF');
    }
    if (input.take('fullscreen')) toggleFullscreen();
  }
  if (input.anyKey || input.clicked) audio.unlock();
  try {
    app.frame(dt);
  } catch (err) {
    // Never let one bad frame kill the game loop.
    console.error(err);
  }
  // Amiga-style mouse pointer (not on touch screens)
  if (!isMobile && input.mx >= 0 && input.my >= 0 && input.mx < SCREEN_W && input.my < SCREEN_H && input.lastDevice === 'mouse') {
    g.blit(SPR.pointer, input.mx, input.my);
  }
  g.present();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// Exported .sav files are the only saves, so warn before closing the tab mid-game.
window.addEventListener('beforeunload', (e) => {
  if (app.hasUnsavedProgress()) e.preventDefault();
});

document.addEventListener('visibilitychange', () => {
  last = performance.now();
});
