import type { App, Scene } from '../app';
import { audio } from '../engine/audio';
import { C } from '../engine/palette';
import { text, wrap, paragraph } from '../engine/font';
import { bar, panel, ui } from '../engine/ui';
import { designationBadge, icon } from '../engine/sprites';
import { AREA, AREAS, AreaId, CFG, FRONTIER, OFFER, PCS_WEIGHTS, SPECS, SpecDef } from '../game/data';
import { money, pct, turnLabel } from '../game/format';
import {
  auditChance,
  canPurchaseDesignation,
  frontierAuditChance,
  frontierOffers,
  frontierQualified,
  frontierRequirements,
  hasDesignation,
  hasSpec,
  pcs,
  referenceChance,
  specQualified,
  specRequirements,
  specUnlocked,
} from '../game/rules';
import { purchaseDesignation, scheduleAudit, scheduleFrontierAudit } from '../game/actions';
import { background, footer, header, keyHint, requireState, scrollTo } from './common';
import { HubScene } from './hub';

type Tab = 'sp' | 'spec' | 'frontier';

const AREA_LABEL: Record<AreaId, string> = {
  dataai: 'Data & AI',
  infra: 'Infrastructure',
  dai: 'Digital & App Innov.',
  bizapps: 'Business Apps',
  modern: 'Modern Work',
  security: 'Security',
};

export class PartnerCenterScene implements Scene {
  music = 'hub';
  private tab: Tab = 'sp';
  private selArea: AreaId = 'dataai';
  private selSpec = SPECS[0].id;
  private specFirst = 0;

  enter(app: App): void {
    const s = requireState(app);
    this.selArea = s.focus.primary;
  }

  frame(app: App): void {
    const s = requireState(app);
    const g = app.g;
    background(g);
    header(app, 'PARTNER CENTER');
    const tabs: [Tab, string][] = [
      ['sp', 'SOLUTIONS PARTNER'],
      ['spec', 'SPECIALIZATIONS'],
      ['frontier', 'FRONTIER'],
    ];
    tabs.forEach(([id, label], i) => {
      if (ui.button(2 + i * 106, 16, 104, 13, label, { style: 'tab', selected: this.tab === id })) {
        this.tab = id;
        this.specFirst = 0;
        if (id === 'spec') this.selSpec = this.specList(s)[0].id;
      }
    });
    if (this.tab === 'sp') this.spTab(app);
    else if (this.tab === 'spec') this.specTab(app);
    else this.frontierTab(app);
    if (ui.back()) app.go(new HubScene());
    footer(app, `${keyHint(app)}   AP LEFT: ${s.ap}`);
  }

  private spTab(app: App): void {
    const s = requireState(app);
    const g = app.g;
    panel(g, 2, 31, 316, 102);
    AREAS.forEach((a, i) => {
      const y = 34 + i * 16;
      const p = pcs(s, a);
      const held = hasDesignation(s, a);
      designationBadge(g, 6, y + 2, AREA[a].colour, held);
      if (ui.button(18, y, 130, 15, AREA_LABEL[a], { desc: a })) this.selArea = a;
      bar(g, 152, y + 5, 64, 6, p.total, 100, held ? C.MSGREEN : p.qualified ? C.YELLOW : AREA[a].colour, 70);
      text(g, String(p.total), 236, y + 4, p.qualified ? C.YELLOW : C.WHITE, { align: 'right' });
      const status = held ? 'ENROLLED' : canPurchaseDesignation(s, a) ? 'QUALIFIED!' : 'IN PROGRESS';
      text(g, status, 314, y + 4, held ? C.GREEN : canPurchaseDesignation(s, a) ? C.YELLOW : C.GREY, { align: 'right' });
    });
    if (ui.lastDesc && (AREAS as string[]).includes(ui.lastDesc)) this.selArea = ui.lastDesc as AreaId;

    const a = this.selArea;
    const p = pcs(s, a);
    const th = AREA[a].th;
    panel(g, 2, 134, 316, 110, `${AREA[a].short}: PARTNER CAPABILITY SCORE ${p.total}/100`);
    const rows: [string, string, number, number, number, number][] = [
      ['PERFORMANCE', 'Net customer adds (12m)', p.values.adds, th.adds, p.adds, PCS_WEIGHTS.adds],
      ['SKILLING', 'Intermediate certifications', p.values.inter, th.inter, p.inter, PCS_WEIGHTS.inter],
      ['SKILLING', 'Advanced certifications', p.values.adv, th.adv, p.adv, PCS_WEIGHTS.adv],
      ['CUST. SUCCESS', 'Usage growth % (12m)', p.values.usage, th.usage, p.usage, PCS_WEIGHTS.usage],
      ['CUST. SUCCESS', 'Deployments (12m)', p.values.deploys, th.deploys, p.deploys, PCS_WEIGHTS.deploys],
    ];
    rows.forEach(([cat, label, v, t, pts, w], i) => {
      const y = 150 + i * 12;
      text(g, label, 8, y, pts === 0 ? C.RED : C.WHITE);
      text(g, `${v}/${t}`, 196, y, v >= t ? C.GREEN : C.LGREY, { align: 'right' });
      bar(g, 202, y + 1, 70, 6, pts, w, pts >= w ? C.GREEN : C.BLUE);
      text(g, `${pts}/${w}`, 314, y, C.YELLOW, { align: 'right' });
      void cat;
    });
    const by = 214;
    if (hasDesignation(s, a)) {
      const d = s.designations.find((x) => x.area === a)!;
      text(g, `{g}ENROLLED.{/} Renews ${turnLabel(d.renewAt)} - keep PCS at 70+.`, 8, by + 4, C.LGREY);
    } else if (canPurchaseDesignation(s, a)) {
      if (ui.button(8, by, 304, 14, `PURCHASE SOLUTIONS PARTNER DESIGNATION  ${money(CFG.designationFee)}`, { style: 'box', colour: C.YELLOW })) {
        const r = purchaseDesignation(s, a);
        audio.sfx('levelup');
        app.message('SOLUTIONS PARTNER!', r, 'good', 'trophy');
      }
    } else {
      const missing = rows.filter((r) => r[4] === 0).map((r) => r[1].toLowerCase());
      const msg = missing.length ? `Every metric needs points. Missing: ${missing.join(', ')}.` : `Reach 70 points to qualify (${70 - p.total} to go).`;
      paragraph(g, msg, 8, by - 2, 304, C.ORANGE, 9);
    }
    if (s.designations.length > 0 && !hasDesignation(s, a)) text(g, 'Already a Solutions Partner: new areas enrol automatically.', 8, 234, C.LSLATE);
  }

  private specList(s: ReturnType<typeof requireState>): SpecDef[] {
    const unlocked = SPECS.filter((x) => specUnlocked(s, x) || hasSpec(s, x.id));
    const locked = SPECS.filter((x) => !unlocked.includes(x));
    return [...unlocked, ...locked];
  }

  private specTab(app: App): void {
    const s = requireState(app);
    const g = app.g;
    const list = this.specList(s);
    panel(g, 2, 31, 168, 213);
    const visible = 16;
    const focusIdx = ui.focus - 3; // tabs come first
    if (focusIdx >= 0 && focusIdx < list.length) this.specFirst = scrollTo(focusIdx, this.specFirst, visible);
    if (app.input.wheel) this.specFirst = Math.max(0, Math.min(list.length - visible, this.specFirst + app.input.wheel));
    list.forEach((sp, i) => {
      const vis = i >= this.specFirst && i < this.specFirst + visible;
      const y = vis ? 34 + (i - this.specFirst) * 13 : -100;
      const held = hasSpec(s, sp.id);
      const unlocked = specUnlocked(s, sp);
      const ready = !held && unlocked && specQualified(s, sp);
      const glyph = held ? '✓' : ready ? '★' : unlocked ? '•' : ' ';
      const col = held ? C.GREEN : ready ? C.YELLOW : unlocked ? C.WHITE : C.DGREY;
      if (ui.button(4, y, 164, 12, `${glyph}${sp.short}`, { desc: sp.id, colour: col })) this.selSpec = sp.id;
    });
    if (this.specFirst > 0) text(g, '▲', 160, 32, C.CYAN);
    if (this.specFirst + visible < list.length) text(g, '▼', 160, 236, C.CYAN);
    if (ui.lastDesc && list.some((x) => x.id === ui.lastDesc)) this.selSpec = ui.lastDesc;

    const sp = list.find((x) => x.id === this.selSpec) ?? list[0];
    panel(g, 172, 31, 146, 213);
    let y = 35;
    wrap(sp.name, 136).forEach((l) => {
      text(g, l, 178, y, C.YELLOW);
      y += 10;
    });
    if (sp.frontier) {
      text(g, '★ Frontier prerequisite', 178, y, C.MSYELLOW);
      y += 10;
    }
    y += 2;
    const reqs = specRequirements(s, sp);
    for (const r of reqs) {
      const lines = wrap(`${r.ok ? '{g}✓{/}' : '{r}✗{/}'} ${r.label}${r.detail ? ` (${r.detail})` : ''}`, 136);
      lines.forEach((l) => {
        text(g, l, 178, y, r.ok ? C.LGREY : C.WHITE);
        y += 9;
      });
    }
    y += 3;
    const val = sp.validation === 'audit' ? 'third-party audit' : sp.validation === 'reference' ? 'customer reference' : 'automatic';
    wrap(`Validation: ${val}`, 136).forEach((l) => {
      text(g, l, 178, y, C.CYAN);
      y += 9;
    });
    y += 3;
    const held = s.specs.find((x) => x.id === sp.id);
    const pending = s.audits.some((x) => x.spec === sp.id);
    if (held) {
      paragraph(g, `{g}ENROLLED{/} since ${turnLabel(held.since)}. Renews ${turnLabel(held.renewAt)}.`, 178, y, 136, C.LGREY, 9);
    } else if (pending) {
      paragraph(g, '{y}Validation booked.{/} Result at the end of the quarter.', 178, y, 136, C.LGREY, 9);
    } else if (!specUnlocked(s, sp)) {
      paragraph(g, `{o}Locked:{/} needs a ${sp.aligned.map((x) => AREA[x].short).join(' or ')} Solutions Partner designation.`, 178, y, 136, C.LGREY, 9);
    } else if (sp.validation === 'auto') {
      paragraph(g, 'Enrols automatically at quarter end once every requirement is met.', 178, y, 136, C.LGREY, 9);
    } else {
      const ok = specQualified(s, sp);
      const noAp = s.ap < 1;
      if (sp.validation === 'audit') {
        const c0 = auditChance(s, sp, false);
        const c1 = auditChance(s, sp, true);
        if (ui.button(176, 206, 138, 13, `AUDIT ${money(CFG.auditCost)} (${pct(c0)})`, { style: 'box', disabled: !ok || noAp })) this.book(app, sp.id, false);
        if (ui.button(176, 222, 138, 13, `+PREP ${money(CFG.auditCost + 15)} (${pct(c1)})`, { style: 'box', disabled: !ok || noAp })) this.book(app, sp.id, true);
      } else {
        const c = referenceChance(s, sp);
        if (ui.button(176, 222, 138, 13, `REFERENCE ${money(CFG.refCost)} (${pct(c)})`, { style: 'box', disabled: !ok || noAp })) this.book(app, sp.id, false);
      }
      if (!ok) text(g, 'Meet all requirements first.', 178, 194, C.ORANGE);
      else if (noAp) text(g, 'Needs 1 action point.', 178, 194, C.ORANGE);
    }
  }

  private book(app: App, id: string, prep: boolean): void {
    const s = requireState(app);
    const r = scheduleAudit(s, id, prep);
    app.message('VALIDATION BOOKED', r, r.startsWith('{r}') ? 'bad' : 'info', 'clipboard');
  }

  private frontierTab(app: App): void {
    const s = requireState(app);
    const g = app.g;
    panel(g, 2, 31, 316, 213, 'FRONTIER PARTNER SPECIALIZATION', ['fb0', 'f52']);
    g.rect(10, 50, 36, 36, C.NAVY);
    g.blit(icon('rocket'), 12, 52, { scale: 2 });
    paragraph(
      g,
      'Design, build, deploy, govern and secure AI agents across Microsoft 365, Azure, GitHub and security. Earn it and you WIN.',
      54,
      50,
      258,
      C.WHITE,
      10,
    );
    let y = 92;
    for (const r of frontierRequirements(s)) {
      text(g, `${r.ok ? '{g}✓{/}' : '{r}✗{/}'} ${r.label}${r.detail ? `  (${r.detail})` : ''}`, 12, y, r.ok ? C.LGREY : C.WHITE);
      y += 11;
    }
    y += 4;
    const fo = frontierOffers(s);
    const names = s.offers.filter((o) => o.published && OFFER[o.id].frontier).map((o) => OFFER[o.id].name);
    text(g, `Published Frontier offers: ${fo}  (more = better audit odds, max 3)`, 12, y, fo > 0 ? C.CYAN : C.ORANGE);
    y += 10;
    if (names.length) text(g, names.join(', ').slice(0, 50), 12, y, C.LSLATE);
    const ok = frontierQualified(s);
    const pending = s.audits.some((x) => x.kind === 'frontier');
    if (pending) text(g, '{y}Audit booked!{/} The auditors report at quarter end.', 12, 222, C.WHITE);
    else {
      const c0 = frontierAuditChance(s, false);
      const c1 = frontierAuditChance(s, true);
      if (ui.button(10, 210, 148, 14, `AUDIT ${money(FRONTIER.auditCost)} (${pct(c0)})`, { style: 'box', disabled: !ok || s.ap < 1 })) this.bookFrontier(app, false);
      if (ui.button(162, 210, 152, 14, `+PREP ${money(FRONTIER.auditCost + 20)} (${pct(c1)})`, { style: 'box', disabled: !ok || s.ap < 1 })) this.bookFrontier(app, true);
      if (!ok) text(g, 'Meet every requirement to book the audit.', 12, 228, C.ORANGE);
    }
  }

  private bookFrontier(app: App, prep: boolean): void {
    const s = requireState(app);
    const r = scheduleFrontierAudit(s, prep);
    audio.sfx('levelup');
    app.message('FRONTIER AUDIT', r, 'info', 'rocket');
  }
}
