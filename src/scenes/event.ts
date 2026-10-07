import type { App, Scene } from '../app';
import { audio } from '../engine/audio';
import { C, gradient12 } from '../engine/palette';
import { text, wrap, LINE_H } from '../engine/font';
import { panel, ui } from '../engine/ui';
import { icon } from '../engine/sprites';
import { EVENT, resolveEvent } from '../game/events';
import type { PendingEvent } from '../game/types';
import { background, footer, header, keyHint, requireState } from './common';
import { eventsDone } from './flow';

const KIND_STYLE: Record<string, { label: string; accent: string[]; col: number }> = {
  bad: { label: 'INCIDENT', accent: ['e33', '700'], col: C.RED },
  good: { label: 'OPPORTUNITY', accent: ['4e4', '252'], col: C.GREEN },
  dilemma: { label: 'DECISION', accent: ['fb0', '842'], col: C.YELLOW },
  followup: { label: 'CONSEQUENCES', accent: ['f5a', '326'], col: C.PINK },
};

/** Presents each pending event in turn: description, choices, then the outcome. */
export class EventScene implements Scene {
  music = 'hub';
  private current: PendingEvent | null = null;
  private outcome: string | null = null;
  private shown = 0;
  private enterT = 0;

  enter(app: App): void {
    this.next(app);
  }

  private next(app: App): void {
    const s = requireState(app);
    this.outcome = null;
    this.current = s.pending[0] ?? null;
    this.enterT = app.t;
    ui.reset(0);
    if (!this.current) {
      eventsDone(app);
      return;
    }
    this.shown++;
    const kind = EVENT[this.current.id]?.kind;
    audio.sfx(kind === 'bad' ? 'alarm' : kind === 'good' ? 'good' : 'select');
  }

  frame(app: App): void {
    const s = requireState(app);
    const g = app.g;
    background(g);
    header(app, 'INCOMING');
    const pe = this.current;
    if (!pe) return;
    const def = EVENT[pe.id];
    if (!def) {
      s.pending.shift();
      this.next(app);
      return;
    }
    const style = KIND_STYLE[def.kind] ?? KIND_STYLE.dilemma;
    const remaining = s.pending.length;
    // Flashing alert strip
    const flash = Math.floor((app.t - this.enterT) * 6) % 2 === 0 && app.t - this.enterT < 1;
    for (let y = 18; y < 28; y++) g.rectRGB(6, y, 308, 1, gradient12(style.accent, (y - 18) / 10));
    text(g, `${style.label}${remaining > 1 && !this.outcome ? `  (${remaining - 1} more after this)` : ''}`, 12, 20, flash ? C.BLACK : C.WHITE, { bold: true });

    panel(g, 6, 30, 308, 212, def.title, style.accent);
    g.rect(14, 50, 36, 36, C.NAVY);
    g.frame(14, 50, 36, 36, style.col);
    g.blit(icon(def.icon), 16, 52, { scale: 2 });

    const body = def.text(s, pe.data);
    const lines = wrap(body, 248);
    lines.slice(0, 9).forEach((l, i) => text(g, l, 58, 50 + i * LINE_H, C.WHITE));

    if (this.outcome === null) {
      const choices = def.choices(s, pe.data);
      let y = 242 - 6 - choices.length * 28;
      y = Math.max(y, 50 + Math.min(9, lines.length) * LINE_H + 6);
      choices.forEach((c, i) => {
        const hit = ui.button(14, y, 292, 14, `${i + 1}. ${c.label}`, { disabled: !!c.disabled, hotkey: String(i + 1) });
        const hint = c.disabled ?? c.hint ?? '';
        if (hint) text(g, hint, 30, y + 15, c.disabled ? C.DGREY : C.LSLATE);
        if (hit && !c.disabled) {
          this.outcome = resolveEvent(s, pe, i);
          ui.reset(0);
          audio.sfx(/\{r\}/.test(this.outcome) ? 'error' : /\{g\}/.test(this.outcome) ? 'coin' : 'select');
        }
        y += 28;
      });
    } else {
      g.rect(14, 160, 292, 56, C.NAVY);
      g.frame(14, 160, 292, 56, C.SLATE);
      wrap(this.outcome, 280)
        .slice(0, 5)
        .forEach((l, i) => text(g, l, 20, 165 + i * LINE_H, C.CREAM));
      if (ui.button(196, 222, 110, 14, s.status !== 'playing' ? 'OH NO...' : 'CONTINUE ►', { style: 'box' })) {
        if (s.status !== 'playing') eventsDone(app);
        else this.next(app);
      }
    }
    footer(app, keyHint(app) + '   1-4 QUICK PICK');
  }
}
