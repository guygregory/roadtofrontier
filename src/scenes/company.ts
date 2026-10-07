import type { App, Scene } from '../app';
import { C } from '../engine/palette';
import { text, paragraph } from '../engine/font';
import { panel, ui } from '../engine/ui';
import { AREA, AREAS, CFG } from '../game/data';
import { money } from '../game/format';
import { buyBenefits, borrow, cancelUnified, fireStaff, hireArchitect, hireStaff, repay } from '../game/actions';
import { creditLimit, maxHires, totalCerts } from '../game/rules';
import { background, footer, header, keyHint, meter, requireState, statusLine } from './common';
import { HubScene } from './hub';

export class CompanyScene implements Scene {
  music = 'hub';

  frame(app: App): void {
    const s = requireState(app);
    const g = app.g;
    background(g);
    header(app, 'COMPANY & STAFF');
    const say = (r: string) => app.toast(r.replace(/\{.\}/g, '').slice(0, 50));

    // Staff
    panel(g, 2, 16, 158, 132, 'PEOPLE');
    const certs = totalCerts(s);
    statusLine(g, 8, 32, 'Engineers', String(s.tech), C.WHITE, 146);
    statusLine(g, 8, 41, 'Sellers', String(s.sales), C.WHITE, 146);
    statusLine(g, 8, 50, 'Certs int/adv', `${certs.inter}/${certs.adv}`, C.CYAN, 146);
    statusLine(g, 8, 59, 'Hires left (qtr)', `${Math.max(0, maxHires(s) - s.hiresThisQuarter)}/${maxHires(s)}`, C.YELLOW, 146);
    const hireLeft = maxHires(s) - s.hiresThisQuarter > 0;
    if (ui.button(6, 70, 150, 12, 'Hire engineer', { right: money(CFG.hireCost), disabled: !hireLeft, desc: 'Adds delivery capacity (uncertified).' })) say(hireStaff(s, 'tech', 1));
    if (ui.button(6, 83, 150, 12, 'Hire seller', { right: money(CFG.hireCost), disabled: !hireLeft, desc: 'Each seller can close about 3 deals a quarter.' })) say(hireStaff(s, 'sales', 1));
    if (ui.button(6, 96, 150, 12, 'Hire architect', { right: money(CFG.architectCost), disabled: !hireLeft, desc: 'An engineer with an advanced certification in the area you choose.' })) {
      app.dialog({
        title: 'ARCHITECT SPECIALISM',
        text: 'Which solution area should your new architect be certified in?',
        icon: 'hire',
        buttons: [...AREAS.map((a) => ({ label: AREA[a].name, action: () => say(hireArchitect(s, a)) })), { label: 'Cancel' }],
      });
    }
    if (ui.button(6, 112, 150, 12, 'Let engineer go', { right: money(CFG.severance), colour: C.ORANGE, desc: 'Cuts cost, but they take their certifications and morale drops.' })) say(fireStaff(s, 'tech', 1));
    if (ui.button(6, 125, 150, 12, 'Let seller go', { right: money(CFG.severance), colour: C.ORANGE, desc: 'Cuts cost; fewer deals closed.' })) say(fireStaff(s, 'sales', 1));

    // Finance
    panel(g, 162, 16, 156, 132, 'FINANCE');
    statusLine(g, 168, 32, 'Cash', money(s.cash), s.cash < 0 ? C.RED : C.YELLOW, 144);
    statusLine(g, 168, 41, 'Debt', money(s.debt), s.debt > 0 ? C.ORANGE : C.WHITE, 144);
    statusLine(g, 168, 50, 'Credit limit', money(creditLimit(s)), C.WHITE, 144);
    statusLine(g, 168, 59, 'Interest', `${Math.round(CFG.interest * 400)}% APR`, C.WHITE, 144);
    if (s.flags.dividends) statusLine(g, 168, 68, 'VC dividends', `${money(s.flags.dividends)}/qtr`, C.ORANGE, 144);
    if (ui.button(166, 80, 148, 12, 'Borrow $100K', { disabled: s.debt >= creditLimit(s), desc: 'Draw on your credit line. Interest is charged every quarter.' })) say(borrow(s, 100));
    if (ui.button(166, 93, 148, 12, 'Repay $100K', { disabled: s.debt <= 0 || s.cash <= 0, desc: 'Pay down debt to save interest.' })) say(repay(s, 100));
    paragraph(g, 'Negative cash at quarter end draws on the credit line. {r}Two quarters in the red = bankrupt!{/}', 168, 110, 144, C.LSLATE, 9);

    // Programme membership & services
    panel(g, 2, 150, 316, 94, 'MEMBERSHIP & SERVICES');
    const cspTxt = s.csp === 'none' ? 'Not enrolled (see ACTIONS)' : s.csp === 'indirect' ? 'Indirect Reseller' : 'Direct Bill';
    statusLine(g, 8, 166, 'CSP', cspTxt, s.csp === 'none' ? C.ORANGE : C.GREEN, 150);
    statusLine(g, 8, 175, 'Partner Success', s.benefits === 'none' ? 'None' : s.benefits === 'core' ? 'Core' : 'Expanded', C.WHITE, 150);
    statusLine(g, 8, 184, 'Unified', s.unified ? `Active ${money(CFG.unifiedCost)}/qtr` : 'Not subscribed', s.unified ? C.GREEN : C.GREY, 150);
    if (s.benefits !== 'expanded') {
      if (ui.button(6, 196, 150, 12, s.benefits === 'none' ? 'Buy Core Benefits' : 'Upgrade to Expanded', { right: s.benefits === 'none' ? '$1K' : '$4K' })) say(buyBenefits(s, s.benefits === 'none' ? 'core' : 'expanded'));
    }
    if (s.unified && ui.button(6, 210, 150, 12, 'Cancel Unified', { colour: C.ORANGE })) say(cancelUnified(s));
    meter(g, 166, 166, 'Morale', s.morale, s.morale < 40 ? C.RED : C.GREEN, 146);
    meter(g, 166, 176, 'Reputation', s.reputation, C.MSBLUE, 146);
    meter(g, 166, 186, 'Compliance', s.compliance, s.compliance < 40 ? C.RED : C.PURPLE, 146);
    if (ui.lastDesc) text(g, ui.lastDesc.slice(0, 50), 8, 228, C.CYAN);

    if (ui.button(262, 228, 52, 13, 'DONE', { style: 'box' }) || ui.back()) app.go(new HubScene());
    footer(app, keyHint(app));
  }
}
