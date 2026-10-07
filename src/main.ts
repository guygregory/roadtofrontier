import { Gfx, SCREEN_H, SCREEN_W } from './engine/gfx';
import { Input } from './engine/input';
import { audio } from './engine/audio';
import { SPR } from './engine/sprites';
import { App } from './app';
import { ui } from './engine/ui';
import { loadSettings } from './game/save';
import { BootScene } from './scenes/boot';
import { toggleFullscreen } from './fullscreen';
import { EndingScene } from './scenes/ending';
import { YearEndScene } from './scenes/yearend';
import { HiscoreScene } from './scenes/hiscore';
import { HelpScene } from './scenes/help';
import { CreditsScene } from './scenes/credits';
import { TitleScene } from './scenes/title';
import { HubScene } from './scenes/hub';
import { PlanScene } from './scenes/plan';
import { ActionsScene } from './scenes/actions';
import { CompanyScene } from './scenes/company';
import { EventScene } from './scenes/event';

const canvas = document.getElementById('screen') as HTMLCanvasElement;
const stage = document.getElementById('stage') as HTMLDivElement;
const crt = document.getElementById('crt') as HTMLDivElement;

let scale = 1;

/** Integer scaling keeps every pixel crisp, like a real low-res display. */
function resize(): void {
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
resize();

const g = new Gfx(canvas);
const input = new Input(canvas, () => scale);
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
(window as unknown as { __rtfScenes: unknown }).__rtfScenes = { EndingScene, YearEndScene, HiscoreScene, HelpScene, CreditsScene, TitleScene, HubScene, PlanScene, ActionsScene, CompanyScene, EventScene };

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
  // Amiga-style mouse pointer
  if (input.mx >= 0 && input.my >= 0 && input.mx < SCREEN_W && input.my < SCREEN_H && input.lastDevice === 'mouse') {
    g.blit(SPR.pointer, input.mx, input.my);
  }
  g.present();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

document.addEventListener('visibilitychange', () => {
  last = performance.now();
});
