import type { App, Scene } from '../app';
import { C } from '../engine/palette';
import { text, wrap } from '../engine/font';
import { panel, ui } from '../engine/ui';
import { icon } from '../engine/sprites';
import { ACTIONS, ActionDef, ActionOption, performAction } from '../game/actions';
import { AREA, AREAS, AreaId } from '../game/data';
import { money } from '../game/format';
import { hasDesignation, pcs } from '../game/rules';
import { background, footer, header, keyHint, requireState, scrollTo } from './common';
import { HubScene } from './hub';

type Mode = 'list' | 'options' | 'area';

export class ActionsScene implements Scene {
  music = 'hub';
  private mode: Mode = 'list';
  private action: ActionDef | null = null;
  private option: ActionOption | null = null;
  private listFocus = 0;
  private optFirst = 0;

  frame(app: App): void {
    const s = requireState(app);
    const g = app.g;
    background(g);
    header(app, 'ACTIONS');
    panel(g, 2, 16, 166, 228, this.mode === 'list' ? `ACTION POINTS: ${s.ap}` : this.mode === 'options' ? 'CHOOSE OPTION' : 'CHOOSE AREA');

    let focusDef: ActionDef | null = this.action;
    if (this.mode === 'list') {
      ACTIONS.forEach((a, i) => {
        const reason = a.available(s) ?? (s.ap < a.ap ? 'No action points left' : null);
        const y = 32 + i * 14;
        if (ui.button(5, y, 160, 13, a.name, { disabled: !!reason, desc: a.id })) {
          this.action = a;
          this.listFocus = i;
          this.mode = 'options';
          ui.reset(0);
        }
      });
      focusDef = ACTIONS.find((a) => a.id === ui.lastDesc) ?? ACTIONS[0];
      if (ui.back()) app.go(new HubScene());
    } else if (this.mode === 'options' && this.action) {
      const opts = this.action.options(s);
      text(g, this.action.name, 8, 32, C.YELLOW);
      const VIS = 6;
      this.optFirst = scrollTo(ui.focus, this.optFirst, VIS);
      if (this.optFirst > 0) text(g, '▲', 158, 32, C.CYAN);
      if (this.optFirst + VIS < opts.length) text(g, '▼', 158, 236, C.CYAN);
      opts.forEach((o, i) => {
        const y = 44 + (i - this.optFirst) * 32;
        if (i < this.optFirst || i >= this.optFirst + VIS) {
          // keep focus order stable for keyboard navigation (off-screen)
          if (ui.button(-200, -200, 1, 1, '', { disabled: !!o.disabled })) {
            this.option = o;
          }
          return;
        }
        const costTxt = o.cost > 0 ? money(o.cost) : '';
        if (ui.button(5, y, 160, 13, o.label.slice(0, 25), { disabled: !!o.disabled, hotkey: String(i + 1) })) {
          this.option = o;
          if (this.action!.needsArea) {
            this.mode = 'area';
            ui.reset(Math.max(0, AREAS.indexOf(s.focus.primary)));
          } else this.perform(app);
        }
        const hint = o.disabled ?? o.hint ?? '';
        const line = o.disabled ? hint : `${costTxt ? `{y}${costTxt}{/} ` : ''}${hint}`;
        wrap(line, 152)
          .slice(0, 2)
          .forEach((l, k) => text(g, l, 12, y + 14 + k * 9, o.disabled ? C.DGREY : C.LSLATE));
      });
      if (opts.length === 0) text(g, 'Nothing available.', 8, 48, C.GREY);
      if (ui.back()) {
        this.mode = 'list';
        ui.reset(this.listFocus);
      }
    } else if (this.mode === 'area' && this.action) {
      text(g, `${this.action.name}`, 8, 32, C.YELLOW);
      AREAS.forEach((a, i) => {
        const y = 46 + i * 26;
        const p = pcs(s, a);
        g.rect(6, y + 4, 4, 6, AREA[a].colour);
        if (ui.button(12, y, 153, 13, AREA[a].name.replace(' (Azure)', ''), { right: hasDesignation(s, a) ? '★' : '' })) this.perform(app, a);
        text(g, `PCS ${p.total}  certs ${s.areas[a].inter}/${s.areas[a].adv}  cust ${s.areas[a].customers}`, 14, y + 14, C.LSLATE);
      });
      if (ui.back()) {
        this.mode = 'options';
        ui.reset(0);
      }
    }

    // Detail panel
    panel(g, 170, 16, 148, 228, 'DETAILS');
    if (focusDef) {
      g.rect(176, 32, 36, 36, C.NAVY);
      g.blit(icon(focusDef.icon), 178, 34, { scale: 2 });
      const nameLines = wrap(focusDef.name, 98).slice(0, 2);
      nameLines.forEach((l, i) => text(g, l, 216, 34 + i * 10, C.YELLOW));
      text(g, `${focusDef.ap} action point`, 216, 36 + nameLines.length * 10, C.GREY);
      const reason = focusDef.available(s);
      let y = 74;
      wrap(focusDef.blurb, 138)
        .slice(0, 13)
        .forEach((l) => {
          text(g, l, 176, y, C.WHITE);
          y += 10;
        });
      if (reason) {
        y += 4;
        wrap(`Unavailable: ${reason}`, 138).forEach((l) => {
          text(g, l, 176, y, C.ORANGE);
          y += 10;
        });
      }
      if (focusDef.id === 'coop') text(g, `Co-op balance: ${money(s.coop)}`, 176, 222, C.CYAN);
      if (focusDef.id === 'frontier_skills') text(g, `FTE ${s.fte}/5   DP-600 ${s.dp600}/3`, 176, 222, C.CYAN);
    }
    footer(app, keyHint(app));
  }

  private perform(app: App, area?: AreaId): void {
    const s = requireState(app);
    if (!this.action || !this.option) return;
    const res = performAction(s, this.action.id, this.option.id, area);
    const bad = res.startsWith('{r}');
    app.message(this.action.name.toUpperCase(), res, bad ? 'bad' : 'good', this.action.icon);
    this.mode = 'list';
    ui.reset(this.listFocus);
  }
}
