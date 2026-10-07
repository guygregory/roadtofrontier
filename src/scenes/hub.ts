import type { App, Scene } from '../app';
import { C, gradient12 } from '../engine/palette';
import { text, wrap } from '../engine/font';
import { bar, divider, panel, ui } from '../engine/ui';
import { SPR, designationBadge, drawHQ } from '../engine/sprites';
import { AREA, AREAS } from '../game/data';
import { money } from '../game/format';
import { hasDesignation, partnerStage, pcs, totalCustomers } from '../game/rules';
import { forecastCosts, lastRevenue } from '../game/sim';
import { header, meter, requireState, statusLine } from './common';
import { advisorTips } from './advisor';
import { ActionsScene } from './actions';
import { ProgrammesScene } from './programmes';
import { PartnerCenterScene } from './partnercenter';
import { CompanyScene } from './company';
import { CustomersScene } from './customers';
import { ReportsScene } from './reports';
import { GameMenuScene } from './gamemenu';
import { endTurn } from './flow';

export class HubScene implements Scene {
  music = 'hub';
  private tipIdx = 0;
  private tipT = 0;
  private tickerX = 320;

  enter(app: App): void {
    this.tipT = app.t;
  }

  frame(app: App, dt: number): void {
    const s = requireState(app);
    const g = app.g;
    g.fill(C.DNAVY);
    header(app, 'ROAD TO FRONTIER');

    // ---------------- Left: company panel
    panel(g, 0, 14, 132, 230);
    let y = 18;
    text(g, s.company.slice(0, 20), 5, y, C.YELLOW, { bold: true });
    y += 10;
    text(g, partnerStage(s), 5, y, s.frontier ? C.MSYELLOW : s.designations.length ? C.GREEN : C.CYAN);
    y += 10;
    divider(g, 4, y, 124);
    y += 4;
    const rev = lastRevenue(s);
    const prof = s.lastReport?.profit ?? rev - forecastCosts(s);
    statusLine(g, 5, y, 'Cash', money(s.cash), s.cash < 0 ? C.RED : C.YELLOW);
    y += 9;
    statusLine(g, 5, y, 'Revenue/qtr', money(rev), C.WHITE);
    y += 9;
    statusLine(g, 5, y, 'Profit/qtr', money(prof), prof >= 0 ? C.GREEN : C.RED);
    y += 9;
    if (s.debt > 0) {
      statusLine(g, 5, y, 'Debt', money(s.debt), C.ORANGE);
      y += 9;
    }
    statusLine(g, 5, y, 'Staff', `${s.tech} eng ${s.sales} sales`, C.WHITE);
    y += 9;
    statusLine(g, 5, y, 'Customers', `${totalCustomers(s)} (${s.key.length} key)`, C.WHITE);
    y += 9;
    const util = s.lastReport?.utilisation ?? 0.9;
    statusLine(g, 5, y, 'Utilisation', `${Math.round(util * 100)}%`, util > 1.05 ? C.RED : util > 0.95 ? C.ORANGE : C.GREEN);
    y += 9;
    if (s.csp !== 'none' || s.coop > 0) {
      statusLine(g, 5, y, 'Co-op funds', money(s.coop), C.CYAN);
      y += 9;
    }
    y += 2;
    meter(g, 5, y, 'Morale', s.morale, s.morale < 40 ? C.RED : C.GREEN, 122);
    y += 9;
    meter(g, 5, y, 'Reputation', s.reputation, C.MSBLUE, 122);
    y += 9;
    meter(g, 5, y, 'Compliance', s.compliance, s.compliance < 40 ? C.RED : C.PURPLE, 122);
    y += 11;
    divider(g, 4, y, 124);
    y += 4;
    text(g, 'PARTNER CAPABILITY', 5, y, C.LSLATE);
    y += 10;
    for (const a of AREAS) {
      const p = pcs(s, a);
      const held = hasDesignation(s, a);
      designationBadge(g, 4, y - 1, AREA[a].colour, held);
      text(g, AREA[a].short, 16, y, held ? C.WHITE : C.LGREY);
      bar(g, 68, y + 1, 40, 6, p.total, 100, held ? C.MSGREEN : p.qualified ? C.YELLOW : AREA[a].colour, 70);
      text(g, String(p.total), 127, y, p.qualified ? C.YELLOW : C.GREY, { align: 'right' });
      y += 10;
    }
    text(g, `${s.specs.length} SPECIALIZATION${s.specs.length === 1 ? '' : 'S'}`, 5, y + 1, s.specs.length ? C.GREEN : C.GREY);

    // ---------------- Right: menu
    panel(g, 132, 14, 188, 118);
    const items: [string, string, () => void, boolean?][] = [
      ['ACTIONS', `${s.ap} AP`, () => app.go(new ActionsScene())],
      ['PROGRAMMES & FOCUS', `${s.adjustments} chg`, () => app.go(new ProgrammesScene())],
      ['PARTNER CENTER', '', () => app.go(new PartnerCenterScene())],
      ['COMPANY & STAFF', '', () => app.go(new CompanyScene())],
      ['CUSTOMERS & M&A', s.targets.length ? `${s.targets.length} for sale` : '', () => app.go(new CustomersScene())],
      ['REPORTS', '', () => app.go(new ReportsScene())],
      ['END QUARTER', '►►', () => this.confirmEnd(app)],
      ['GAME MENU', '', () => app.go(new GameMenuScene())],
    ];
    let my = 17;
    items.forEach(([label, right, act], i) => {
      if (ui.button(135, my, 182, 14, label, { right, hotkey: String(i + 1), colour: i === 6 ? C.YELLOW : undefined })) act();
      my += 14;
    });
    if (ui.back()) app.go(new GameMenuScene());

    // ---------------- Right: HQ + advisor
    panel(g, 132, 132, 188, 112);
    for (let yy = 134; yy < 200; yy++) g.rectRGB(134, yy, 52, 1, gradient12(['012', '125', '348', 'a68'], (yy - 134) / 66));
    const staffN = s.tech + s.sales;
    drawHQ(g, 160 - (staffN >= 60 ? 22 : staffN >= 30 ? 18 : 14), 198, staffN, app.t, s.company);
    text(g, 'HQ', 136, 204, C.LSLATE);
    text(g, `${staffN}`, 184, 204, C.GREY, { align: 'right' });

    const tips = advisorTips(s);
    if (app.t - this.tipT > 7) {
      this.tipIdx++;
      this.tipT = app.t;
    }
    if (app.input.clicked && app.input.inRect(190, 134, 128, 106)) {
      this.tipIdx++;
      this.tipT = app.t;
    }
    const tip = tips[this.tipIdx % tips.length];
    g.blit(SPR.pdm, 192, 136);
    g.frame(191, 135, 26, 26, C.LSLATE);
    text(g, 'ALEX, YOUR PDM', 222, 138, C.YELLOW);
    text(g, `TIP ${(this.tipIdx % tips.length) + 1}/${tips.length}`, 222, 148, C.GREY);
    wrap(tip, 124)
      .slice(0, 8)
      .forEach((l, i) => text(g, l, 192, 164 + i * 9, C.WHITE));
    text(g, 'Click for next tip', 316, 234, C.DGREY, { align: 'right' });

    // ---------------- Ticker
    g.rect(0, 245, 320, 11, C.BLACK);
    g.hline(0, 319, 245, C.MSBLUE);
    const ticker = s.news.slice(-6).join('   ★   ');
    this.tickerX -= dt * 40;
    const tw = ticker.length * 6;
    if (this.tickerX < -tw) this.tickerX = 320;
    g.clip(0, 246, 320, 10);
    text(g, ticker, this.tickerX, 247, C.CYAN);
    g.unclip();
  }

  private confirmEnd(app: App): void {
    const s = requireState(app);
    const warn: string[] = [];
    if (s.ap > 0) warn.push(`You still have ${s.ap} action point${s.ap > 1 ? 's' : ''}.`);
    const net = lastRevenue(s) - forecastCosts(s);
    if (s.cash + net < 0) warn.push('{r}Warning: you may run out of cash this quarter!{/}');
    app.dialog({
      title: 'END QUARTER?',
      text: warn.length ? warn.join(' ') : 'Close the books and see how the quarter went?',
      icon: 'calendar',
      buttons: [
        { label: 'YES - END THE QUARTER', action: () => endTurn(app) },
        { label: 'NOT YET' },
      ],
    });
  }
}
