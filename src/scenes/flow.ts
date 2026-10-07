import type { App } from '../app';
import { credits } from '../game/format';
import { beginQuarter, endQuarter } from '../game/sim';
import type { GameState } from '../game/types';
import { PlanScene } from './plan';
import { EventScene } from './event';
import { HubScene } from './hub';
import { ProcessingScene, ReportScene } from './report';
import { YearEndScene } from './yearend';
import { EndingScene } from './ending';

/** Route to the right scene for a loaded/continued game. */
export function resumeGame(app: App, s: GameState): void {
  app.state = s;
  if (s.status !== 'playing' || s.phase === 'ended') app.go(new EndingScene());
  else if (s.phase === 'plan') app.go(new PlanScene());
  else if (s.pending.length > 0) app.go(new EventScene());
  else app.go(new HubScene());
}

/** After the FY plan is confirmed: start Q1 (Partner Success renews, Azure credits are granted). */
export function planCommitted(app: App): void {
  const s = app.state!;
  const notes = beginQuarter(s);
  app.autosave();
  app.go(s.pending.length ? new EventScene() : new HubScene());
  const parts: string[] = [];
  if (notes.some((n) => n.includes('renewed for'))) parts.push('PARTNER SUCCESS RENEWED');
  if (notes.some((n) => n.includes('Benefits ended'))) parts.push('PARTNER SUCCESS ENDED');
  if (s.azureCredits > 0) parts.push(`${credits(s.azureCredits)} AZURE CREDITS`);
  if (parts.length) app.toast(parts.join('  '));
}

export function eventsDone(app: App): void {
  const s = app.state!;
  if (s.status !== 'playing') {
    app.go(new EndingScene());
    return;
  }
  s.phase = 'hub';
  app.autosave();
  app.go(new HubScene());
}

/** End the quarter: short "closing the books" animation, then the report. */
export function endTurn(app: App): void {
  app.go(
    new ProcessingScene(() => {
      const s = app.state!;
      const report = endQuarter(s);
      app.go(new ReportScene(report));
    }),
  );
}

export function reportDone(app: App): void {
  const s = app.state!;
  if (s.yearEnd) {
    app.go(new YearEndScene(s.yearEnd));
    return;
  }
  if (s.status !== 'playing') {
    app.go(new EndingScene());
    return;
  }
  beginQuarter(s);
  app.autosave();
  app.go(s.pending.length ? new EventScene() : new HubScene());
}

export function yearEndDone(app: App): void {
  const s = app.state!;
  s.yearEnd = null;
  if (s.status !== 'playing') {
    app.go(new EndingScene());
    return;
  }
  s.phase = 'plan';
  app.autosave();
  app.go(new PlanScene());
}
