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
import type { GameState } from '../game/types';
import { background, footer, header, keyHint, requireState, scrollTo } from './common';
import { HubScene } from './hub';

type Tab = 'sp' | 'spec' | 'frontier';

const TABS: [Tab, string][] = [
  ['sp', 'SOLUTIONS PARTNER'],
  ['spec', 'SPECIALIZATIONS'],
  ['frontier', 'FRONTIER'],
];

/** Widgets are declared tabs first, then the list, then the buttons: these are their focus indices. */
const LIST_START = TABS.length;
const SPEC_ROWS = 16;

/** Specializations in Partner Center order: the ones you can work towards come first. */
export function specList(s: GameState): SpecDef[] {
  const unlocked = SPECS.filter((x) => specUnlocked(s, x) || hasSpec(s, x.id));
  return [...unlocked, ...SPECS.filter((x) => !unlocked.includes(x))];
}

/** Booking buttons shown for a specialization: audit and audit with prep, or one reference button. */
export function bookingButtons(s: GameState, sp: SpecDef): number {
  if (hasSpec(s, sp.id) || s.audits.some((x) => x.spec === sp.id) || !specUnlocked(s, sp) || sp.validation === 'auto') return 0;
  return sp.validation === 'audit' ? 2 : 1;
}

export interface DetailLine {
  text: string;
  y: number;
  colour: number;
}

const tick = (ok: boolean) => (ok ? '{g}✓{/}' : '{r}✗{/}');

function joinNames(areas: AreaId[], key: 'label' | 'mid' | 'short'): string {
  const n = areas.map((a) => AREA[a][key]);
  return n.length > 1 ? `${n.slice(0, -1).join(', ')} or ${n[n.length - 1]}` : n[0];
}

function layoutSpec(s: GameState, sp: SpecDef, key: 'label' | 'mid' | 'short'): { lines: DetailLine[]; bottom: number } {
  const lines: DetailLine[] = [];
  let y = 35;
  let bottom = y;
  const add = (t: string, colour: number, lineH = 9) => {
    for (const l of wrap(t, 136)) {
      lines.push({ text: l, y, colour });
      bottom = y + 8;
      y += lineH;
    }
  };
  add(sp.name, C.YELLOW, 10);
  if (sp.frontier) add('★ Frontier prerequisite', C.MSYELLOW, 10);
  y += 2;
  const [designation, ...reqs] = specRequirements(s, sp);
  const names = joinNames(sp.aligned, key);
  add(`${tick(designation.ok)} Solutions Partner: ${names}`, designation.ok ? C.LGREY : C.WHITE);
  add(`In ${AREA[sp.skill].label}:`, C.CYAN);
  for (const r of reqs) add(`${tick(r.ok)} ${r.label}${r.detail ? ` (${r.detail})` : ''}`, r.ok ? C.LGREY : C.WHITE);
  y += 3;
  add(`Validation: ${sp.validation === 'audit' ? 'audit' : sp.validation === 'reference' ? 'references' : 'automatic'}`, C.CYAN);
  y += 3;
  const held = s.specs.find((x) => x.id === sp.id);
  if (held) add(`{g}ENROLLED{/} since ${turnLabel(held.since)}. Renews ${turnLabel(held.renewAt)}.`, C.LGREY);
  else if (s.audits.some((x) => x.spec === sp.id)) add('{y}Validation booked.{/} Result at the end of the quarter.', C.LGREY);
  else if (!specUnlocked(s, sp)) add(`{o}Locked:{/} needs a ${names} Solutions Partner designation.`, C.LGREY);
  else if (sp.validation === 'auto') add('Enrols automatically at quarter end once every requirement is met.', C.LGREY);
  return { lines, bottom };
}

/**
 * The text of the specialization details panel. Area names are written in full unless the text
 * would run into the booking buttons (or off the bottom of the panel); then shorter names are used.
 */
export function specDetail(s: GameState, sp: SpecDef): { lines: DetailLine[]; bottom: number; limit: number } {
  const limit = bookingButtons(s, sp) > 0 ? 192 : 241;
  let out = layoutSpec(s, sp, 'label');
  for (const key of ['mid', 'short'] as const) {
    if (out.bottom <= limit) break;
    out = layoutSpec(s, sp, key);
  }
  return { ...out, limit };
}

export class PartnerCenterScene implements Scene {
  music = 'hub';
  private tab: Tab = 'sp';
  private selArea: AreaId = 'dataai';
  private selSpec = SPECS[0].id;
  private specFirst = 0;
  /** Keyboard focus side within a tab: the list, or the booking / purchase buttons. */
  private side: 'list' | 'book' = 'list';
  private bookIdx = 0;
  /** Put the keyboard focus back on the selection (after entering, or changing tab). */
  private placeFocus = true;

  enter(app: App): void {
    const s = requireState(app);
    this.selArea = s.focus.primary;
    // Specializations open on the first one you can work towards (locked ones are listed last).
    this.selSpec = specList(s)[0].id;
    this.specFirst = 0;
    this.placeFocus = true;
  }

  frame(app: App): void {
    const s = requireState(app);
    const g = app.g;
    const inp = app.input;
    background(g);
    header(app, 'PARTNER CENTER');
    // Tab and Shift+Tab cycle through the tabs, left to right and right to left.
    if (inp.take('tab')) this.cycleTab(1);
    if (inp.take('backtab')) this.cycleTab(-1);
    TABS.forEach(([id, label], i) => {
      if (ui.button(2 + i * 106, 16, 104, 13, label, { style: 'tab', selected: this.tab === id })) this.setTab(id);
    });
    if (this.tab === 'sp') this.spTab(app);
    else if (this.tab === 'spec') this.specTab(app);
    else this.frontierTab(app);
    if (ui.back()) app.go(new HubScene());
    const hint = inp.lastDevice === 'keyboard' ? '▲▼ PICK  ◄► LIST/BUTTONS  (SHIFT+)TAB: TABS' : keyHint(app);
    footer(app, `${hint}  AP ${s.ap}`);
  }

  private setTab(id: Tab): void {
    this.tab = id;
    this.side = 'list';
    this.bookIdx = 0;
    this.placeFocus = true;
  }

  private cycleTab(dir: number): void {
    const i = TABS.findIndex(([id]) => id === this.tab);
    this.setTab(TABS[(i + dir + TABS.length) % TABS.length][0]);
    audio.sfx('move');
  }

  /**
   * Keyboard navigation within a tab: up/down move through the list (or between the buttons) and
   * left/right switch between the list and the buttons. Mouse hover moves the focus as usual.
   * Returns the selected list index.
   */
  private navigate(app: App, idx: number, nList: number, nBook: number): number {
    const inp = app.input;
    const bookStart = LIST_START + nList;
    // A dialog (such as a booking confirmation) owns the focus until it closes; then focus returns here.
    if (app.dialogs.length > 0) {
      this.placeFocus = true;
      return idx;
    }
    if (ui.focus < LIST_START && inp.lastDevice === 'keyboard') this.placeFocus = true;
    if (!this.placeFocus) {
      if (ui.focus >= LIST_START && ui.focus < bookStart) {
        this.side = 'list';
        idx = ui.focus - LIST_START;
      } else if (ui.focus >= bookStart && ui.focus < bookStart + nBook) {
        this.side = 'book';
        this.bookIdx = ui.focus - bookStart;
      }
    }
    if (nList === 0) this.side = 'book';
    else if (this.side === 'book' && nBook === 0) this.side = 'list';
    this.bookIdx = Math.max(0, Math.min(this.bookIdx, nBook - 1));
    const up = inp.take('up');
    const down = inp.take('down');
    const left = inp.take('left');
    const right = inp.take('right');
    const before = `${this.side}:${idx}:${this.bookIdx}`;
    if (this.side === 'list') {
      if (up) idx = (idx - 1 + nList) % nList;
      if (down) idx = (idx + 1) % nList;
      if (right && nBook > 0) {
        this.side = 'book';
        this.bookIdx = 0;
      }
    } else if (nBook > 0) {
      const alone = nList === 0; // no list: every arrow moves between the buttons
      if (up || (alone && left)) this.bookIdx = (this.bookIdx - 1 + nBook) % nBook;
      if (down || (alone && right)) this.bookIdx = (this.bookIdx + 1) % nBook;
      if (left && !alone) this.side = 'list';
    }
    if (`${this.side}:${idx}:${this.bookIdx}` !== before) audio.sfx('move');
    if (this.placeFocus || up || down || left || right) {
      ui.focus = this.side === 'list' || nBook === 0 ? LIST_START + Math.max(0, idx) : bookStart + this.bookIdx;
      this.placeFocus = false;
    }
    return idx;
  }

  private spTab(app: App): void {
    const s = requireState(app);
    const g = app.g;
    const idx = this.navigate(app, AREAS.indexOf(this.selArea), AREAS.length, canPurchaseDesignation(s, this.selArea) ? 1 : 0);
    this.selArea = AREAS[idx];
    panel(g, 2, 31, 316, 102);
    AREAS.forEach((a, i) => {
      const y = 34 + i * 16;
      const p = pcs(s, a);
      const held = hasDesignation(s, a);
      designationBadge(g, 6, y + 2, AREA[a].colour, held);
      if (ui.button(18, y, 130, 15, AREA[a].mid)) this.selArea = a;
      bar(g, 152, y + 5, 64, 6, p.total, 100, held ? C.MSGREEN : p.qualified ? C.YELLOW : AREA[a].colour, 70);
      text(g, String(p.total), 236, y + 4, p.qualified ? C.YELLOW : C.WHITE, { align: 'right' });
      const status = held ? 'ENROLLED' : canPurchaseDesignation(s, a) ? 'QUALIFIED!' : 'IN PROGRESS';
      text(g, status, 314, y + 4, held ? C.GREEN : canPurchaseDesignation(s, a) ? C.YELLOW : C.GREY, { align: 'right' });
    });

    const a = this.selArea;
    const p = pcs(s, a);
    const th = AREA[a].th;
    panel(g, 2, 134, 316, 110, `${AREA[a].mid.toUpperCase()}: PCS ${p.total}/100`);
    const rows: [string, number, number, number, number][] = [
      ['Net customer adds (12m)', p.values.adds, th.adds, p.adds, PCS_WEIGHTS.adds],
      ['Intermediate certifications', p.values.inter, th.inter, p.inter, PCS_WEIGHTS.inter],
      ['Advanced certifications', p.values.adv, th.adv, p.adv, PCS_WEIGHTS.adv],
      ['Usage growth % (12m)', p.values.usage, th.usage, p.usage, PCS_WEIGHTS.usage],
      ['Deployments (12m)', p.values.deploys, th.deploys, p.deploys, PCS_WEIGHTS.deploys],
    ];
    rows.forEach(([label, v, t, pts, w], i) => {
      const y = 150 + i * 12;
      text(g, label, 8, y, pts === 0 ? C.RED : C.WHITE);
      text(g, `${v}/${t}`, 196, y, v >= t ? C.GREEN : C.LGREY, { align: 'right' });
      bar(g, 202, y + 1, 70, 6, pts, w, pts >= w ? C.GREEN : C.BLUE);
      text(g, `${pts}/${w}`, 314, y, C.YELLOW, { align: 'right' });
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
      const missing = rows.filter((r) => r[3] === 0).map((r) => r[0].toLowerCase());
      const msg = missing.length ? `Every metric needs points. Missing: ${missing.join(', ')}.` : `Reach 70 points to qualify (${70 - p.total} to go).`;
      paragraph(g, msg, 8, by - 2, 304, C.ORANGE, 9);
    }
    if (s.designations.length > 0 && !hasDesignation(s, a)) text(g, 'Already a Solutions Partner: new areas enrol automatically.', 8, 234, C.LSLATE);
  }

  private specTab(app: App): void {
    const s = requireState(app);
    const g = app.g;
    const list = specList(s);
    const prev = Math.max(0, list.findIndex((x) => x.id === this.selSpec));
    const keyed = this.placeFocus || ['up', 'down'].some((k) => app.input.pressed(k as 'up' | 'down'));
    const idx = this.navigate(app, prev, list.length, bookingButtons(s, list[prev]));
    this.selSpec = list[idx].id;
    if (keyed) this.specFirst = scrollTo(idx, this.specFirst, SPEC_ROWS);
    if (app.input.wheel) this.specFirst = Math.max(0, Math.min(list.length - SPEC_ROWS, this.specFirst + app.input.wheel));

    panel(g, 2, 31, 168, 213);
    list.forEach((sp, i) => {
      const vis = i >= this.specFirst && i < this.specFirst + SPEC_ROWS;
      const y = vis ? 34 + (i - this.specFirst) * 13 : -100;
      const held = hasSpec(s, sp.id);
      const unlocked = specUnlocked(s, sp);
      const ready = !held && unlocked && specQualified(s, sp);
      const glyph = held ? '✓' : ready ? '★' : unlocked ? '•' : ' ';
      const col = held ? C.GREEN : ready ? C.YELLOW : unlocked ? C.WHITE : C.DGREY;
      if (ui.button(4, y, 164, 12, `${glyph}${sp.short}`, { colour: col })) this.selSpec = sp.id;
    });
    if (this.specFirst > 0) text(g, '▲', 160, 32, C.CYAN);
    if (this.specFirst + SPEC_ROWS < list.length) text(g, '▼', 160, 236, C.CYAN);

    const sp = list.find((x) => x.id === this.selSpec) ?? list[0];
    panel(g, 172, 31, 146, 213);
    for (const l of specDetail(s, sp).lines) text(g, l.text, 178, l.y, l.colour);
    if (bookingButtons(s, sp) > 0) {
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
      if (!ok) text(g, 'Meet all requirements.', 178, 194, C.ORANGE);
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
    const pending = s.audits.some((x) => x.kind === 'frontier');
    this.navigate(app, 0, 0, pending ? 0 : 2);
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
      text(g, `${tick(r.ok)} ${r.label}${r.detail ? `  (${r.detail})` : ''}`, 12, y, r.ok ? C.LGREY : C.WHITE);
      y += 11;
    }
    y += 4;
    const fo = frontierOffers(s);
    const names = s.offers.filter((o) => o.published && OFFER[o.id].frontier).map((o) => OFFER[o.id].name);
    y = paragraph(g, `Published Frontier offers: ${fo}. Each one, up to 3, improves your audit odds.`, 12, y, 300, fo > 0 ? C.CYAN : C.ORANGE, 10);
    if (names.length) text(g, names.join(', ').slice(0, 50), 12, y, C.LSLATE);
    const ok = frontierQualified(s);
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
