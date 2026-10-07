import type { App, Scene } from '../app';
import { C } from '../engine/palette';
import { paragraph, text } from '../engine/font';
import { bar, panel, ui } from '../engine/ui';
import { AREA, AREAS, areaName } from '../game/data';
import { money, turnLabel } from '../game/format';
import { background, footer, header, keyHint, requireState } from './common';
import { HubScene } from './hub';
import { ActionsScene } from './actions';

export class CustomersScene implements Scene {
  music = 'hub';
  private first = 0;

  frame(app: App): void {
    const s = requireState(app);
    const g = app.g;
    background(g);
    header(app, 'CUSTOMERS & M&A');
    panel(g, 2, 16, 316, 124, `KEY ACCOUNTS (${s.key.length})`);
    text(g, 'CUSTOMER', 8, 30, C.LSLATE);
    text(g, 'AREA', 128, 30, C.LSLATE);
    text(g, 'REV/QTR', 214, 30, C.LSLATE, { align: 'right' });
    text(g, 'SATISFACTION', 226, 30, C.LSLATE);
    const keys = [...s.key].sort((a, b) => b.revenue - a.revenue);
    const visible = 9;
    if (app.input.wheel) this.first = Math.max(0, Math.min(Math.max(0, keys.length - visible), this.first + app.input.wheel));
    if (app.input.take('pgdn')) this.first = Math.max(0, Math.min(Math.max(0, keys.length - visible), this.first + visible));
    if (app.input.take('pgup')) this.first = Math.max(0, this.first - visible);
    keys.slice(this.first, this.first + visible).forEach((k, i) => {
      const y = 41 + i * 10;
      text(g, k.name.slice(0, 19), 8, y, C.WHITE);
      text(g, AREA[k.area].short, 128, y, AREA[k.area].colour);
      text(g, money(k.revenue), 214, y, C.YELLOW, { align: 'right' });
      bar(g, 226, y + 1, 70, 6, k.sat, 100, k.sat < 30 ? C.RED : k.sat < 55 ? C.ORANGE : C.GREEN);
      text(g, String(k.sat), 314, y, C.WHITE, { align: 'right' });
    });
    if (keys.length === 0) paragraph(g, 'No key accounts yet. Co-sell, events and offers attract them.', 8, 44, 304, C.GREY, 10);
    if (keys.length > visible) text(g, `${this.first + 1}-${Math.min(keys.length, this.first + visible)} of ${keys.length}`, 260, 131, C.GREY, { align: 'right' });

    panel(g, 2, 142, 140, 102, 'BY AREA');
    AREAS.forEach((a, i) => {
      const y = 158 + i * 11;
      g.rect(8, y + 1, 5, 6, AREA[a].colour);
      text(g, areaName(a, 15), 16, y, C.LGREY);
      const n = s.areas[a].customers + s.key.filter((k) => k.area === a).length;
      text(g, String(n), 136, y, C.WHITE, { align: 'right' });
    });

    panel(g, 144, 142, 174, 102, 'COMPANIES FOR SALE');
    if (s.targets.length === 0) {
      text(g, 'Nobody is for sale now.', 150, 160, C.GREY);
      text(g, 'Offers come up as events.', 150, 170, C.GREY);
    }
    s.targets.slice(0, 2).forEach((t, i) => {
      const y = 158 + i * 34;
      text(g, t.name, 150, y, C.YELLOW);
      const tail = ` ${t.tech} eng ${t.customers} cust`;
      text(g, `${areaName(t.area, 27 - tail.length)}${tail}`, 150, y + 9, C.WHITE);
      text(g, `Price ~${money(t.price)} until ${turnLabel(t.expires)}`, 150, y + 18, C.LSLATE);
    });
    if (s.targets.length > 0 && ui.button(150, 226, 100, 13, 'GO TO ACQUIRE', { style: 'box' })) app.go(new ActionsScene());
    if (ui.button(262, 226, 52, 13, 'DONE', { style: 'box' }) || ui.back()) app.go(new HubScene());
    // Pages through the key accounts without a keyboard or mouse wheel (wraps back to the top).
    if (keys.length > visible && ui.button(266, 129, 48, 10, 'MORE ▼', { style: 'box' })) {
      this.first = this.first + visible >= keys.length ? 0 : Math.min(keys.length - visible, this.first + visible);
    }
    footer(app, keys.length > visible ? 'PGUP/PGDN OR WHEEL TO SCROLL ACCOUNTS' : keyHint(app));
  }
}
