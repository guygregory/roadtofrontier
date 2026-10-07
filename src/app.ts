import type { Gfx } from './engine/gfx';
import type { Input } from './engine/input';
import { ui, panel, dim } from './engine/ui';
import { text, wrap, LINE_H } from './engine/font';
import { icon } from './engine/sprites';
import { audio, gameSong } from './engine/audio';
import { C } from './engine/palette';
import { fyOf } from './game/format';
import type { GameState } from './game/types';
import { saveSettings, Settings } from './game/save';

export interface Scene {
  /** Song to play while this scene is active ('' = silence, undefined = keep current). */
  music?: string;
  enter?(app: App): void;
  frame(app: App, dt: number): void;
}

export interface DialogButton {
  label: string;
  hint?: string;
  disabled?: boolean;
  action?: () => void;
}

export interface Dialog {
  title: string;
  text: string;
  icon?: string;
  tone?: 'good' | 'bad' | 'info';
  buttons: DialogButton[];
}

export class App {
  scene: Scene | null = null;
  private next: Scene | null = null;
  private fade = 1;
  private fadeDir = 0;
  t = 0;
  state: GameState | null = null;
  dialogs: Dialog[] = [];
  toastMsg = '';
  toastT = 0;
  private savedSnapshot = '';

  constructor(
    public g: Gfx,
    public input: Input,
    public settings: Settings,
  ) {}

  go(scene: Scene, instant = false): void {
    if (instant || !this.scene) {
      this.switchTo(scene);
      return;
    }
    this.next = scene;
    this.fadeDir = -1;
  }

  private switchTo(scene: Scene): void {
    this.scene = scene;
    this.dialogs = [];
    ui.reset();
    this.input.textMode = false;
    if (scene.music !== undefined) {
      if (scene.music === '') audio.stopSong();
      // 'hub' means the in-game music: each financial year has its own tune.
      else audio.playSong(scene.music === 'hub' && this.state ? gameSong(fyOf(this.state.turn)) : scene.music);
    }
    scene.enter?.(this);
  }

  dialog(d: Dialog): void {
    this.dialogs.push(d);
    ui.reset();
    if (d.tone === 'bad') audio.sfx('alarm');
    else if (d.tone === 'good') audio.sfx('good');
  }

  /** Quick message box with an OK button. */
  message(title: string, body: string, tone: Dialog['tone'] = 'info', iconId?: string, onClose?: () => void): void {
    this.dialog({ title, text: body, tone, icon: iconId, buttons: [{ label: 'OK', action: onClose }] });
  }

  toast(msg: string): void {
    this.toastMsg = msg;
    this.toastT = 2.5;
  }

  /** Ask before leaving the page with a game that hasn't been exported to a .sav file. */
  hasUnsavedProgress(): boolean {
    const s = this.state;
    return !!s && s.status === 'playing' && JSON.stringify(s) !== this.savedSnapshot;
  }

  /** Remember the state as it was saved (or loaded), so we can tell if there is unsaved progress. */
  markSaved(): void {
    this.savedSnapshot = this.state ? JSON.stringify(this.state) : '';
  }

  persistSettings(): void {
    saveSettings(this.settings);
  }

  frame(dt: number): void {
    this.t += dt;
    const g = this.g;
    const inp = this.input;
    const modal = this.dialogs.length > 0;

    // Scene (input suppressed while a dialog is open or during a fade)
    const blocked = modal || this.fadeDir !== 0;
    let saved: { clicked: boolean; keys: Set<import('./engine/input').Key>; moved: boolean; typed: string[]; wheel: number } | null = null;
    if (blocked) {
      saved = { clicked: inp.clicked, keys: inp.keys, moved: inp.moved, typed: inp.typed, wheel: inp.wheel };
      inp.clicked = false;
      inp.keys = new Set();
      inp.moved = false;
      inp.typed = [];
      inp.wheel = 0;
    }
    ui.begin(g, inp, this.t);
    this.scene?.frame(this, dt);
    if (!modal) ui.end();
    if (saved) {
      inp.clicked = saved.clicked;
      inp.keys = saved.keys;
      inp.moved = saved.moved;
      inp.typed = saved.typed;
      inp.wheel = saved.wheel;
    }

    if (modal && this.fadeDir === 0) {
      ui.begin(g, inp, this.t);
      this.drawDialog(this.dialogs[this.dialogs.length - 1]);
      ui.end();
    }

    if (this.toastT > 0) {
      this.toastT -= dt;
      const w = Math.min(300, this.toastMsg.length * 6 + 12);
      const x = 160 - w / 2;
      g.rect(x, 228, w, 13, C.BLACK);
      g.frame(x, 228, w, 13, C.YELLOW);
      text(g, this.toastMsg, 160, 231, C.YELLOW, { align: 'center' });
    }

    // Fades between scenes
    if (this.fadeDir !== 0) {
      this.fade += this.fadeDir * dt * 5;
      if (this.fade <= 0) {
        this.fade = 0;
        if (this.next) {
          this.switchTo(this.next);
          this.next = null;
        }
        this.fadeDir = 1;
      } else if (this.fade >= 1) {
        this.fade = 1;
        this.fadeDir = 0;
      }
    }
    if (this.fade < 1) g.fade(this.fade);
  }

  private drawDialog(d: Dialog): void {
    const g = this.g;
    dim(g);
    const w = 272;
    const textW = d.icon ? w - 40 : w - 16;
    const lines = wrap(d.text, textW);
    const btnH = 13;
    const h = Math.min(236, 22 + Math.max(lines.length * LINE_H, d.icon ? 20 : 0) + 8 + d.buttons.length * (btnH + 1) + 6);
    const x = (320 - w) / 2;
    const y = Math.max(8, (256 - h) / 2);
    const accent = d.tone === 'bad' ? ['e33', '700'] : d.tone === 'good' ? ['4e4', '252'] : ['07c', '024'];
    panel(g, x, y, w, h, d.title, accent);
    let ty = y + 18;
    if (d.icon) g.blit(icon(d.icon), x + 10, ty + 2);
    const tx = d.icon ? x + 32 : x + 8;
    const maxLines = Math.floor((h - 30 - d.buttons.length * (btnH + 1)) / LINE_H);
    lines.slice(0, maxLines).forEach((l, i) => text(g, l, tx, ty + i * LINE_H, C.WHITE));
    ty = y + h - 6 - d.buttons.length * (btnH + 1);
    for (const b of d.buttons) {
      const hit = ui.button(x + 6, ty, w - 12, btnH, b.label, { disabled: b.disabled, right: b.hint });
      if (hit) {
        this.dialogs.pop();
        ui.reset();
        b.action?.();
      }
      ty += btnH + 1;
    }
    if (d.buttons.length === 1 && this.input.take('back')) {
      this.dialogs.pop();
      ui.reset();
      d.buttons[0].action?.();
    }
  }
}
