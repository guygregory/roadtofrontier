import type { App, Scene } from '../app';
import { audio } from '../engine/audio';
import { C } from '../engine/palette';
import { text, paragraph, wrap } from '../engine/font';

/** Truncate text to at most n wrapped lines at the given width. */
function wrapLimit(s: string, w: number, n: number): string {
  const lines = wrap(s, w);
  return lines.length <= n ? s : lines.slice(0, n).join(' ').replace(/\s*\S*$/, '...');
}
import { bar, panel, ui } from '../engine/ui';
import { advisorSprite } from '../engine/sprites';
import { AREA, AREAS, AreaId, BETS, DISTRIBUTOR, LEVEL_NAMES, PDM_NAME, PROGRAMMES, PS_FEE } from '../game/data';
import { fyOf, money } from '../game/format';
import { advisor } from '../game/advisor';
import { canStopBenefits, hasDesignation, pcs } from '../game/rules';
import { forecastCosts, lastRevenue } from '../game/sim';
import { benefitsRenewalDue, buyBenefits, setBenefitsRenewal } from '../game/actions';
import { background, footer, header, keyHint, requireState } from './common';
import { planCommitted } from './flow';

/** Start-of-FY strategy: focus areas, strategic bet, programme levels and benefits. */
export class PlanScene implements Scene {
  music = 'hub';
  private step = 0;

  frame(app: App): void {
    const s = requireState(app);
    const g = app.g;
    background(g);
    header(app, `FY${fyOf(s.turn)} STRATEGY`);
    const steps = ['BRIEFING', 'PRIMARY', 'SECONDARY', 'STRATEGY', 'BUDGET'];
    steps.forEach((st, i) => text(g, st, 6 + i * 63, 18, i === this.step ? C.YELLOW : i < this.step ? C.GREEN : C.GREY));
    if (this.step === 0) this.briefing(app);
    else if (this.step === 1) this.focus(app, true);
    else if (this.step === 2) this.focus(app, false);
    else if (this.step === 3) this.bet(app);
    else this.budget(app);
    footer(app, this.step === 4 ? 'LEFT/RIGHT CHANGE LEVELS  ENTER CONFIRM' : keyHint(app));
  }

  private nav(app: App, canBack = true): void {
    if (canBack && ui.back() && this.step > 0) {
      this.step--;
      ui.reset(0);
    }
    void app;
  }

  private briefing(app: App): void {
    const s = requireState(app);
    const g = app.g;
    const fy = fyOf(s.turn);
    const who = advisor(s);
    const email = who.kind === 'program';
    panel(g, 6, 30, 308, 212, `1 JULY ${2000 + fy - 1}: FY${fy} KICK-OFF`);
    g.blit(advisorSprite(who.sprite), 14, 48, { scale: 2 });
    g.frame(13, 47, 50, 50, C.LSLATE);
    text(g, who.shortName, 38, 100, email ? C.CYAN : C.YELLOW, { align: 'center' });
    text(g, who.shortRole, 38, 110, C.GREY, { align: 'center' });
    const tips: string[] = [];
    if (email) tips.push(`{c}From:{/} MAICPP (no-reply)\n{c}Subject:{/} FY${fy} starts today`);
    if (who.kind === 'pdm' && s.flags.mplSince === s.turn) {
      tips.push(
        `Hi, I'm {y}${PDM_NAME}{/}, your new Partner Development Manager! With two specializations, ${s.company} is now on Microsoft's {g}Managed Partner List{/}. I'll connect you with account teams for co-selling and champion your Partner of the Year nominations.`,
      );
    }
    if (s.turn === 0) {
      tips.push('A new financial year! Set your priorities: which Solutions Partner designations to chase, what to invest in, and your big strategic bet.');
      tips.push('You can tweak budgets a little each quarter, but your focus areas and strategy are locked for the year.');
    } else {
      const last = s.history.filter((h) => fyOf(h.turn) === fy - 1);
      const rev = last.reduce((a, h) => a + h.revenue, 0);
      const profit = last.reduce((a, h) => a + h.profit, 0);
      tips.push(`FY${fy - 1} wrap-up: revenue {y}${money(rev)}{/}, profit ${profit >= 0 ? '{g}' : '{r}'}${money(profit)}{/}.`);
      tips.push(`You hold ${s.designations.length} designation${s.designations.length === 1 ? '' : 's'} and ${s.specs.length} specialization${s.specs.length === 1 ? '' : 's'}.`);
      if (fy === 32) tips.push('{c}FY32 and beyond:{/} there is no deadline. Keep going until you reach the Frontier - or the money runs out.');
      tips.push('Remember: Frontier needs Copilot, Data Security, Identity & Access, and AI Apps or AI Platform specializations.');
    }
    if (who.kind === 'distributor') tips.push(`Talk soon! - ${DISTRIBUTOR.am}, ${DISTRIBUTOR.company}`);
    if (email) tips.push('{d}Automated message. Please do not reply.{/}');
    // Up to 17 lines: drop whole paragraphs (the least important come last) rather than cut one off.
    const lines: string[] = [];
    for (const t of tips) {
      const w = wrap(t, 236);
      if (lines.length + (lines.length ? 1 : 0) + w.length > 17) continue;
      if (lines.length) lines.push('');
      lines.push(...w);
    }
    lines.forEach((l, i) => text(g, l, 72, 48 + i * 10, C.WHITE));
    if (ui.button(196, 222, 112, 14, 'PLAN THE YEAR ►', { style: 'box' })) {
      this.step = 1;
      ui.reset(AREAS.indexOf(s.focus.primary));
    }
  }

  private focus(app: App, primary: boolean): void {
    const s = requireState(app);
    const g = app.g;
    panel(g, 6, 30, 308, 212, primary ? 'PRIMARY FOCUS AREA' : 'SECONDARY FOCUS AREA');
    paragraph(
      g,
      primary
        ? 'Where will most of your skilling and marketing go this year (65%, or 100% with no secondary)? Usually the designation you are chasing next.'
        : 'Optional second area for the remaining 35%. Spread too thin and nothing qualifies!',
      14,
      48,
      292,
      C.LGREY,
      10,
    );
    const rows: (AreaId | null)[] = primary ? [...AREAS] : [null, ...AREAS.filter((a) => a !== s.focus.primary)];
    rows.forEach((a, i) => {
      const y = 82 + i * 19;
      if (a === null) {
        if (ui.button(14, y, 292, 16, 'NONE - all-in on the primary area', { selected: s.focus.secondary === null })) {
          s.focus.secondary = null;
          this.step = 3;
          ui.reset(BETS.findIndex((b) => b.id === s.bet));
        }
        return;
      }
      const p = pcs(s, a);
      const held = hasDesignation(s, a);
      const sel = primary ? s.focus.primary === a : s.focus.secondary === a;
      g.rect(14, y + 5, 5, 5, AREA[a].colour);
      if (ui.button(20, y, 286, 16, `${AREA[a].name}${held ? ' ?' : p.qualified ? ' !' : ''}`, { selected: sel, colour: held ? C.GREEN : p.qualified ? C.YELLOW : undefined })) {
        if (primary) {
          s.focus.primary = a;
          if (s.focus.secondary === a) s.focus.secondary = null;
          this.step = 2;
          ui.reset(0);
        } else {
          s.focus.secondary = a;
          this.step = 3;
          ui.reset(BETS.findIndex((b) => b.id === s.bet));
        }
      }
      bar(g, 196, y + 12, 70, 3, p.total, 100, held ? C.MSGREEN : C.BLUE, 70);
      text(g, `PCS ${p.total}`, 270, y + 9, C.GREY);
    });
    this.nav(app);
  }

  private bet(app: App): void {
    const s = requireState(app);
    const g = app.g;
    panel(g, 6, 30, 308, 212, 'STRATEGIC BET FOR THE YEAR');
    BETS.forEach((b, i) => {
      const y = 48 + i * 32;
      if (ui.button(14, y, 292, 13, b.name, { selected: s.bet === b.id })) {
        s.bet = b.id;
        this.step = 4;
        ui.reset(0);
        audio.sfx('select');
      }
      wrap(b.blurb, 276)
        .slice(0, 2)
        .forEach((l, k) => text(g, l, 26, y + 14 + k * 9, C.LSLATE));
    });
    this.nav(app);
  }

  private budget(app: App): void {
    const s = requireState(app);
    const g = app.g;
    panel(g, 6, 30, 308, 212, 'BUDGET & PROGRAMMES');
    const inp = app.input;
    PROGRAMMES.forEach((p, i) => {
      const y = 50 + i * 18;
      const lvl = s.programmes[p.id];
      const focused = ui.focus === i;
      if (focused) {
        if (inp.take('left') && lvl > 0) {
          s.programmes[p.id] = lvl - 1;
          audio.sfx('move');
        }
        if (inp.take('right') && lvl < 3) {
          s.programmes[p.id] = lvl + 1;
          audio.sfx('move');
        }
      }
      if (ui.button(14, y, 120, 14, p.name, { desc: p.blurb })) {
        s.programmes[p.id] = (lvl + 1) % 4;
      }
      for (let k = 0; k < 3; k++) {
        const on = k < s.programmes[p.id];
        g.rect(140 + k * 12, y + 3, 10, 8, on ? (k === 2 ? C.ORANGE : C.GREEN) : C.NEARBLACK);
        g.frame(140 + k * 12, y + 3, 10, 8, C.BLACK);
      }
      text(g, LEVEL_NAMES[s.programmes[p.id]], 192, y + 4, C.WHITE);
      text(g, `${money(p.costs[s.programmes[p.id]])}/qtr`, 304, y + 4, C.YELLOW, { align: 'right' });
    });
    // Benefits package (Network member + Partner Success Benefits)
    const by = 124;
    const fy = fyOf(s.turn);
    text(g, 'PARTNER SUCCESS BENEFITS', 14, by, C.CYAN);
    let status = 'NOT PURCHASED';
    if (s.benefits !== 'none') {
      if (benefitsRenewalDue(s)) status = s.benefitsRenew ? `RENEWS ON CONFIRM -${money(PS_FEE[s.benefits])}` : 'ENDS: NOT RENEWING';
      else status = s.benefitsRenew ? `ACTIVE FOR FY${fy}` : 'ENDS 30 JUNE';
    }
    text(g, status, 306, by, s.benefits !== 'none' && !s.benefitsRenew ? C.ORANGE : C.LSLATE, { align: 'right' });
    const pk: ['core' | 'expanded', string, string][] = [
      ['core', 'CORE $1K/YR', 'Internal-use licences (overhead -$4K/qtr) and $2.4K a year of Azure credits.'],
      ['expanded', 'EXPANDED $4K', 'More licences (overhead -$8K/qtr), $5K a year of Azure credits and cheaper offers.'],
    ];
    pk.forEach(([id, label, desc], i) => {
      const owned = s.benefits === id || (s.benefits === 'expanded' && id === 'core');
      if (ui.button(14 + i * 99, by + 10, 96, 14, owned ? `${label} ✓` : label, { style: 'box', selected: s.benefits === id, disabled: owned, desc })) {
        const r = buyBenefits(s, id);
        app.toast(r.replace(/\{.\}/g, '').slice(0, 48));
      }
    });
    const canStop = canStopBenefits(s);
    const renewDesc = canStop
      ? 'Partner Success renews every July. Your Solutions Partner benefits now exceed it: switch renewal off to save the fee.'
      : 'Partner Success renews every July. You can stop renewing once you hold a Solutions Partner designation.';
    const renewOff = s.benefits === 'none' || (s.benefitsRenew && !canStop);
    if (ui.button(212, by + 10, 94, 14, `RENEW: ${s.benefitsRenew ? 'ON' : 'OFF'}`, { style: 'box', disabled: renewOff, desc: renewDesc })) {
      const r = setBenefitsRenewal(s, !s.benefitsRenew);
      app.toast(r.replace(/\{.\}/g, '').slice(0, 48));
    }
    // Summary
    const cost = forecastCosts(s);
    const rev = lastRevenue(s);
    g.rect(14, 154, 292, 46, C.NAVY);
    text(g, 'QUARTERLY FORECAST', 20, 158, C.LSLATE);
    text(g, `Revenue (last qtr) ${money(rev)}`, 20, 170, C.GREEN);
    text(g, `Running costs      ${money(cost)}`, 20, 180, C.ORANGE);
    const net = rev - cost;
    text(g, `Net before growth  ${money(net)}`, 20, 190, net >= 0 ? C.GREEN : C.RED);
    text(g, `Cash ${money(s.cash)}`, 300, 170, C.YELLOW, { align: 'right' });
    if (ui.lastDesc) paragraph(g, wrapLimit(ui.lastDesc, 176, 3), 14, 204, 176, C.LGREY, 9);
    if (ui.button(196, 224, 112, 14, 'CONFIRM PLAN ►', { style: 'box' })) {
      audio.sfx('levelup');
      planCommitted(app);
    }
    this.nav(app);
  }
}
