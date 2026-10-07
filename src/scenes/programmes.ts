import type { App, Scene } from '../app';
import { audio } from '../engine/audio';
import { C } from '../engine/palette';
import { text, paragraph } from '../engine/font';
import { panel, ui } from '../engine/ui';
import { AREA, AREAS, AreaId, BETS, LEVEL_NAMES, PROGRAMMES, ProgrammeId } from '../game/data';
import { money } from '../game/format';
import { forecastCosts, lastRevenue, overheadCost, programmeCost, offerDevCost } from '../game/sim';
import { CFG } from '../game/data';
import { background, footer, header, requireState } from './common';
import { HubScene } from './hub';

export class ProgrammesScene implements Scene {
  music = 'hub';

  frame(app: App): void {
    const s = requireState(app);
    const g = app.g;
    background(g);
    header(app, 'PROGRAMMES & FOCUS');
    panel(g, 2, 16, 316, 116, `QUARTERLY ADJUSTMENTS LEFT: ${s.adjustments}`);
    const inp = app.input;
    const change = (id: ProgrammeId, d: number) => {
      const lvl = s.programmes[id];
      const nl = lvl + d;
      if (nl < 0 || nl > 3) return;
      if (s.adjustments <= 0) {
        audio.sfx('error');
        app.toast('No adjustments left this quarter');
        return;
      }
      s.programmes[id] = nl;
      s.adjustments--;
      audio.sfx('move');
    };
    PROGRAMMES.forEach((p, i) => {
      const y = 32 + i * 18;
      if (ui.focus < 12 && Math.floor(ui.focus / 3) === i) {
        if (inp.take('left')) change(p.id, -1);
        if (inp.take('right')) change(p.id, 1);
      }
      ui.button(6, y, 104, 14, p.name, { desc: p.blurb });
      if (ui.button(114, y, 14, 14, '-', { style: 'box', disabled: s.programmes[p.id] === 0 })) change(p.id, -1);
      for (let k = 0; k < 3; k++) {
        const on = k < s.programmes[p.id];
        g.rect(132 + k * 12, y + 3, 10, 8, on ? (k === 2 ? C.ORANGE : C.GREEN) : C.NEARBLACK);
        g.frame(132 + k * 12, y + 3, 10, 8, C.BLACK);
      }
      if (ui.button(170, y, 14, 14, '+', { style: 'box', disabled: s.programmes[p.id] === 3 })) change(p.id, 1);
      text(g, LEVEL_NAMES[s.programmes[p.id]], 190, y + 4, C.WHITE);
      text(g, `${money(p.costs[s.programmes[p.id]])}/qtr`, 312, y + 4, C.YELLOW, { align: 'right' });
    });
    // Secondary focus
    const fy = 32 + 4 * 18;
    text(g, `Primary: {y}${AREA[s.focus.primary].mid}{/}`, 6, fy, C.LSLATE);
    text(g, `Secondary: {c}${s.focus.secondary ? AREA[s.focus.secondary].mid : 'none'}{/}`, 6, fy + 10, C.LSLATE);
    if (ui.button(222, fy, 92, 14, 'SWAP 2ND', { style: 'box', desc: 'Change your secondary focus area (costs one adjustment). The primary area is fixed for the year.' })) {
      if (s.adjustments <= 0) {
        audio.sfx('error');
        app.toast('No adjustments left this quarter');
      } else {
        const opts: (AreaId | null)[] = [null, ...AREAS.filter((a) => a !== s.focus.primary)];
        const idx = opts.indexOf(s.focus.secondary);
        s.focus.secondary = opts[(idx + 1) % opts.length];
        s.adjustments--;
      }
    }

    // Forecast
    panel(g, 2, 134, 158, 110, 'COST FORECAST');
    const rows: [string, number][] = [
      ['Salaries', s.tech * CFG.techCost + s.sales * CFG.salesCost],
      ['Overheads', overheadCost(s)],
      ['Programmes', programmeCost(s)],
      ['Offer dev.', offerDevCost(s)],
      ['Unified', s.unified ? CFG.unifiedCost : 0],
      ['Interest/other', s.debt * CFG.interest + (s.flags.dividends ?? 0) + (s.flags.integration ? 20 : 0)],
    ];
    rows.forEach(([l, v], i) => {
      text(g, l, 8, 150 + i * 10, C.LSLATE);
      text(g, money(v), 154, 150 + i * 10, C.WHITE, { align: 'right' });
    });
    const total = forecastCosts(s);
    const rev = lastRevenue(s);
    g.hline(8, 154, 211, C.SLATE);
    text(g, 'Total', 8, 214, C.WHITE);
    text(g, money(total), 154, 214, C.ORANGE, { align: 'right' });
    text(g, 'vs revenue', 8, 224, C.LSLATE);
    text(g, money(rev), 154, 224, C.GREEN, { align: 'right' });

    panel(g, 162, 134, 156, 110, 'INFO');
    const bet = BETS.find((b) => b.id === s.bet)!;
    text(g, `Strategy: ${bet.name}`, 168, 150, C.YELLOW);
    if (ui.lastDesc) paragraph(g, ui.lastDesc, 168, 162, 146, C.WHITE, 9);
    else paragraph(g, bet.blurb, 168, 162, 146, C.WHITE, 9);
    if (ui.button(250, 228, 64, 13, 'DONE', { style: 'box' }) || ui.back()) app.go(new HubScene());
    footer(app, 'LEFT/RIGHT OR +/- CHANGE LEVEL (1 ADJUSTMENT EACH)');
  }
}
