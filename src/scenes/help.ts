import type { App, Scene } from '../app';
import { C } from '../engine/palette';
import { text, paragraph } from '../engine/font';
import { panel, ui } from '../engine/ui';
import { icon } from '../engine/sprites';
import { background, footer } from './common';

export const PAGES: { title: string; icon: string; body: string }[] = [
  {
    title: 'THE GOAL',
    icon: 'rocket',
    body:
      'You run a Microsoft partner. Starting on {c}1 July 2026{/} (FY27) as a {y}Network member{/}, grow through {g}Solutions Partner{/} designations and {g}specializations{/} to become a {y}Frontier Partner{/}.\n\n' +
      '{g}WIN:{/} pass the Frontier Partner audit, or win {y}Partner of the Year{/}.\n' +
      '{r}LOSE:{/} run out of cash two quarters running, or lose your MAICPP membership.\n\n' +
      'There is {c}no time limit{/}: play carries on past FY31 until you win or lose. Win sooner for a bigger score.',
  },
  {
    title: 'TURNS',
    icon: 'calendar',
    body:
      'Each turn is a {c}quarter{/} of Microsoft\'s financial year (Q1 = Jul-Sep). At the start of every year you set your {y}strategy{/}: focus areas, a strategic bet, programme budgets and Partner Success benefits.\n\n' +
      'Each quarter: handle incoming {o}events and decisions{/}, spend {y}action points{/}, make up to 2 budget tweaks, hire staff, then END QUARTER to see the results.\n\n' +
      'Calendar: Ignite in Q2, Partner of the Year nominations in Q3, Build in Q4.',
  },
  {
    title: 'PARTNER CAPABILITY SCORE',
    icon: 'clipboard',
    body:
      'Each of the six solution areas has a {y}PCS out of 100{/}:\n' +
      '{c}Performance{/} - net customer adds (12 months)\n' +
      '{c}Skilling{/} - intermediate & advanced certifications\n' +
      '{c}Customer success{/} - usage growth & deployments\n\n' +
      'Score {y}70+{/} with points in every metric to qualify, then buy the designation in PARTNER CENTER. Later areas enrol automatically. Keep scoring 70+ to renew every year!',
  },
  {
    title: 'SPECIALIZATIONS & FRONTIER',
    icon: 'trophy',
    body:
      'Specializations unlock only under designations you hold. They need more certifications, deployments and customers, then a {y}third-party audit{/} or {y}customer reference{/} (Business Apps enrol automatically).\n\n' +
      '{y}Frontier Partner{/} needs: Microsoft 365 Copilot, Data Security, Identity & Access Management and AI Apps OR AI Platform specializations, 5 Frontier Transformation Engineers, 3 DP-600 holders, and a passed audit. Repeatable Frontier offers boost your odds.',
  },
  {
    title: 'MONEY & PEOPLE',
    icon: 'coin',
    body:
      'Revenue comes from services (limited by engineer {y}capacity{/}), repeatable offers, CSP licence margin and incentives. Keep {y}utilisation{/} under 100% or projects fail and customers leave.\n\n' +
      'Certifications belong to people: when engineers leave, their certs go with them. Keep {y}morale{/} up!\n\n' +
      'Keep {y}compliance{/} high. Shortcuts may pay now but audits can remove your membership.',
  },
  {
    title: 'ADVISORS & BENEFITS',
    icon: 'mail',
    body:
      'At first only {c}MAICPP programme emails{/} advise you. Join {c}CSP{/} through a distributor and {y}Sam{/}, their account manager, takes over. Earn a {g}second specialization{/} and Microsoft adds you to its {y}Managed Partner List{/} next FY, with {y}Alex{/}, your own PDM.\n\n' +
      'Partner Success, designations and specializations grant yearly {c}Azure credits{/} (they expire on 30 June). Use them to become {y}Customer Zero for Azure{/}, or pay cash.\n\n' +
      'Once you hold a designation you can {o}stop renewing Partner Success{/}: Solutions Partner benefits exceed it.',
  },
  {
    title: 'GOOD HABITS',
    icon: 'bulb',
    body:
      '• Join {c}CSP{/} early: margin, incentives, co-op funds, full PCS credit.\n' +
      '• Invest in {c}skilling{/} - certifications drive PCS, audits and project success.\n' +
      '• Spend {c}co-op funds{/} on events before they expire at year end.\n' +
      '• Claim {c}partner incentives{/} for funded workshops.\n' +
      '• Build {c}repeatable offers{/} and co-sell with Microsoft account teams.\n' +
      '• Be {c}customer zero{/} for Copilot and Azure.\n' +
      '• {c}Unified for Partners{/} softens outages and failing projects.\n\n' +
      'Controls: mouse, or arrows/WASD + Enter, Esc to go back. M = music, F = fullscreen.',
  },
];

export class HelpScene implements Scene {
  music = undefined;
  private page = 0;
  constructor(private back: Scene) {}

  frame(app: App): void {
    const g = app.g;
    background(g);
    g.rect(0, 0, 320, 14, C.NAVY);
    text(g, 'HOW TO PLAY', 6, 3, C.WHITE, { bold: true });
    text(g, `${this.page + 1}/${PAGES.length}`, 314, 3, C.LSLATE, { align: 'right' });
    const p = PAGES[this.page];
    panel(g, 4, 18, 312, 208, p.title);
    g.blit(icon(p.icon), 14, 38, { scale: 2 });
    paragraph(g, p.body, 54, 38, 254, C.WHITE, 10);
    if (ui.button(4, 230, 70, 13, '◄ PREV', { style: 'box', disabled: this.page === 0 }) || app.input.take('left')) this.page = Math.max(0, this.page - 1);
    if (ui.button(236, 230, 80, 13, this.page === PAGES.length - 1 ? 'DONE' : 'NEXT ►', { style: 'box' }) || app.input.take('right')) {
      if (this.page === PAGES.length - 1) app.go(this.back);
      else this.page++;
    }
    if (ui.back()) app.go(this.back);
    footer(app, 'LEFT/RIGHT TURN PAGES  ESC BACK');
  }
}
