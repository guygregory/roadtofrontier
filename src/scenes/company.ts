import type { App, Scene } from '../app';
import { C } from '../engine/palette';
import { text, paragraph, wrap } from '../engine/font';
import { panel, ui } from '../engine/ui';
import { AREA, AREAS, CFG, PS_FEE } from '../game/data';
import { credits, money } from '../game/format';
import { advisor } from '../game/advisor';
import { buyBenefits, borrow, cancelUnified, fireStaff, hireArchitect, hireStaff, repay, setBenefitsRenewal } from '../game/actions';
import { canStopBenefits, creditLimit, maxHires, totalCerts, unifiedCost } from '../game/rules';
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
    if (ui.button(6, 83, 150, 12, 'Hire seller', { right: money(CFG.hireCost), disabled: !hireLeft, desc: 'Each closes about 3 deals a quarter.' })) say(hireStaff(s, 'sales', 1));
    if (ui.button(6, 96, 150, 12, 'Hire architect', { right: money(CFG.architectCost), disabled: !hireLeft, desc: 'Comes with an advanced certification.' })) {
      app.dialog({
        title: 'ARCHITECT SPECIALISM',
        text: 'Which solution area should your new architect be certified in?',
        icon: 'hire',
        buttons: [...AREAS.map((a) => ({ label: AREA[a].name, action: () => say(hireArchitect(s, a)) })), { label: 'Cancel' }],
      });
    }
    if (ui.button(6, 112, 150, 12, 'Let engineer go', { right: money(CFG.severance), colour: C.ORANGE, desc: 'Cuts cost, but certs leave; morale dips.' })) say(fireStaff(s, 'tech', 1));
    if (ui.button(6, 125, 150, 12, 'Let seller go', { right: money(CFG.severance), colour: C.ORANGE, desc: 'Cuts cost; fewer deals closed.' })) say(fireStaff(s, 'sales', 1));

    // Finance
    panel(g, 162, 16, 156, 132, 'FINANCE');
    statusLine(g, 168, 32, 'Cash', money(s.cash), s.cash < 0 ? C.RED : C.YELLOW, 144);
    statusLine(g, 168, 41, 'Debt', money(s.debt), s.debt > 0 ? C.ORANGE : C.WHITE, 144);
    statusLine(g, 168, 50, 'Credit limit', money(creditLimit(s)), C.WHITE, 144);
    statusLine(g, 168, 59, 'Interest', `${Math.round(CFG.interest * 400)}% APR`, C.WHITE, 144);
    if (s.flags.dividends) statusLine(g, 168, 68, 'VC dividends', `${money(s.flags.dividends)}/qtr`, C.ORANGE, 144);
    if (ui.button(166, 80, 148, 12, 'Borrow $100K', { disabled: s.debt >= creditLimit(s), desc: 'Credit line draw. Interest each quarter.' })) say(borrow(s, 100));
    if (ui.button(166, 93, 148, 12, 'Repay $100K', { disabled: s.debt <= 0 || s.cash <= 0, desc: 'Pay down debt to save interest.' })) say(repay(s, 100));
    paragraph(g, 'Negative cash at quarter end draws on the credit line. {r}Two quarters in the red = bankrupt!{/}', 168, 110, 144, C.LSLATE, 9);

    // Programme membership & services
    panel(g, 2, 150, 316, 94, 'MEMBERSHIP & SERVICES');
    const cspTxt = s.csp === 'none' ? 'Not enrolled' : s.csp === 'indirect' ? 'Indirect (1% fee)' : 'Direct Bill';
    statusLine(g, 8, 165, 'CSP', cspTxt, s.csp === 'none' ? C.ORANGE : C.GREEN, 150);
    const psTxt = s.benefits === 'none' ? 'None' : s.benefits === 'core' ? 'Core' : 'Expanded';
    statusLine(g, 8, 174, 'Partner Success', psTxt, s.benefits !== 'none' && !s.benefitsRenew ? C.ORANGE : C.WHITE, 150);
    statusLine(g, 8, 183, 'Azure credits', credits(s.azureCredits), C.CYAN, 150);
    statusLine(g, 8, 192, 'Unified', s.unified ? `Active ${money(unifiedCost(s))}/qtr` : 'Not subscribed', s.unified ? C.GREEN : C.GREY, 150);
    if (s.benefits !== 'expanded') {
      const label = s.benefits === 'none' ? 'Buy Core Benefits' : 'Upgrade to Expanded';
      const desc = s.benefits === 'none' ? 'Licences + $2.4K/yr of Azure credits.' : 'More licences + $5K/yr Azure credits.';
      if (ui.button(6, 204, 150, 12, label, { right: s.benefits === 'none' ? money(PS_FEE.core) : money(PS_FEE.expanded), desc })) say(buyBenefits(s, s.benefits === 'none' ? 'core' : 'expanded'));
    }
    if (s.benefits !== 'none') {
      const canStop = canStopBenefits(s);
      const label = s.benefitsRenew ? 'Stop renewing PS' : 'Keep renewing PS';
      const desc = s.benefitsRenew ? (canStop ? 'Lapses 30 June. SP benefits cover you.' : 'Needs a Solutions Partner designation.') : 'Partner Success renews on 1 July.';
      if (ui.button(162, 204, 150, 12, label, { disabled: s.benefitsRenew && !canStop, colour: s.benefitsRenew ? C.ORANGE : undefined, desc })) say(setBenefitsRenewal(s, !s.benefitsRenew));
    }
    if (s.unified && ui.button(6, 217, 150, 12, 'Cancel Unified', { colour: C.ORANGE, disabled: s.csp === 'direct', desc: s.csp === 'direct' ? 'Direct Bill partners must keep Unified.' : 'Stop the quarterly Unified charge.' })) say(cancelUnified(s));
    meter(g, 166, 165, 'Morale', s.morale, s.morale < 40 ? C.RED : C.GREEN, 146);
    meter(g, 166, 174, 'Reputation', s.reputation, C.MSBLUE, 146);
    meter(g, 166, 183, 'Compliance', s.compliance, s.compliance < 40 ? C.RED : C.PURPLE, 146);
    const who = advisor(s);
    statusLine(g, 166, 192, 'Advice', who.kind === 'program' ? 'MAICPP emails' : who.kind === 'distributor' ? `${who.name} (distributor)` : `${who.name} (your PDM)`, C.YELLOW, 146);
    if (ui.lastDesc) {
      // One line, clear of the DONE button: cut at a word with an ellipsis if it is too long.
      const fits = wrap(ui.lastDesc, 246).length === 1;
      text(g, fits ? ui.lastDesc : `${wrap(ui.lastDesc, 228)[0]}...`, 8, 231, C.CYAN);
    }

    if (ui.button(262, 228, 52, 13, 'DONE', { style: 'box' }) || ui.back()) app.go(new HubScene());
    footer(app, keyHint(app));
  }
}
