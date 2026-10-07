import { C } from '../engine/palette';

// ---------------------------------------------------------------------------
// Solution areas (Solutions Partner designations)

export type AreaId = 'dataai' | 'infra' | 'dai' | 'bizapps' | 'modern' | 'security';
export const AREAS: AreaId[] = ['dataai', 'infra', 'dai', 'bizapps', 'modern', 'security'];

export interface AreaInfo {
  id: AreaId;
  name: string;
  short: string;
  colour: number;
  azure: boolean;
  blurb: string;
  /** PCS thresholds (game-scaled). */
  th: { adds: number; inter: number; adv: number; usage: number; deploys: number };
}

export const AREA: Record<AreaId, AreaInfo> = {
  dataai: {
    id: 'dataai',
    name: 'Data & AI (Azure)',
    short: 'D&AI',
    colour: C.PURPLE,
    azure: true,
    blurb: 'Fabric, Azure AI Foundry, analytics and AI platforms.',
    th: { adds: 8, inter: 6, adv: 3, usage: 24, deploys: 8 },
  },
  infra: {
    id: 'infra',
    name: 'Infrastructure (Azure)',
    short: 'INFRA',
    colour: C.MSBLUE,
    azure: true,
    blurb: 'Migration, hybrid cloud, VMware, AVD and networking.',
    th: { adds: 10, inter: 6, adv: 2, usage: 28, deploys: 9 },
  },
  dai: {
    id: 'dai',
    name: 'Digital & App Innovation (Azure)',
    short: 'DAI',
    colour: C.CYAN,
    azure: true,
    blurb: 'App modernization, AI apps, DevOps with GitHub.',
    th: { adds: 8, inter: 6, adv: 3, usage: 24, deploys: 8 },
  },
  bizapps: {
    id: 'bizapps',
    name: 'Business Applications',
    short: 'BIZAPPS',
    colour: C.ORANGE,
    azure: false,
    blurb: 'Dynamics 365, Power Platform and agentic business apps.',
    th: { adds: 6, inter: 5, adv: 3, usage: 20, deploys: 6 },
  },
  modern: {
    id: 'modern',
    name: 'Modern Work',
    short: 'MODERN',
    colour: C.MSGREEN,
    azure: false,
    blurb: 'Microsoft 365 Copilot, Teams, endpoints and adoption.',
    th: { adds: 12, inter: 6, adv: 2, usage: 26, deploys: 10 },
  },
  security: {
    id: 'security',
    name: 'Security',
    short: 'SECURITY',
    colour: C.MSRED,
    azure: false,
    blurb: 'Defender, Entra, Purview and Sentinel.',
    th: { adds: 10, inter: 5, adv: 3, usage: 24, deploys: 9 },
  },
};

/** PCS metric weights (sum 100), mirroring Performance / Skilling / Customer success. */
export const PCS_WEIGHTS = { adds: 30, inter: 15, adv: 15, usage: 20, deploys: 20 };
export const PCS_QUALIFY = 70;

// ---------------------------------------------------------------------------
// Specializations (aligned designations follow Microsoft Learn's prerequisite table)

export type Validation = 'audit' | 'reference' | 'auto';

export interface SpecDef {
  id: string;
  name: string;
  short: string;
  aligned: AreaId[];
  /** Technical area whose certifications and deployments count. */
  skill: AreaId;
  inter: number;
  adv: number;
  deploys: number;
  customers?: number;
  offer?: boolean;
  validation: Validation;
  frontier?: boolean;
}

export const SPECS: SpecDef[] = [
  { id: 'aiplatform', name: 'AI Platform on Microsoft Azure', short: 'AI Platform on Azure', aligned: ['dataai', 'dai'], skill: 'dataai', inter: 6, adv: 3, deploys: 7, customers: 10, validation: 'audit', frontier: true },
  { id: 'analytics', name: 'Analytics on Microsoft Azure', short: 'Analytics on Azure', aligned: ['dataai'], skill: 'dataai', inter: 6, adv: 3, deploys: 7, customers: 10, validation: 'audit' },
  { id: 'aiapps', name: 'AI Apps on Microsoft Azure', short: 'AI Apps on Azure', aligned: ['dataai', 'bizapps'], skill: 'dai', inter: 6, adv: 3, deploys: 6, customers: 8, validation: 'audit', frontier: true },
  { id: 'appmod', name: 'App Modernization on Microsoft Azure', short: 'App Modernization', aligned: ['dataai', 'dai'], skill: 'dai', inter: 6, adv: 3, deploys: 7, customers: 10, validation: 'audit' },
  { id: 'devops', name: 'Agentic DevOps with Microsoft Azure and GitHub', short: 'Agentic DevOps + GitHub', aligned: ['dai'], skill: 'dai', inter: 5, adv: 2, deploys: 6, customers: 8, validation: 'audit' },
  { id: 'infradb', name: 'Infra and Database Migration to Microsoft Azure', short: 'Infra & DB Migration', aligned: ['dataai', 'infra'], skill: 'infra', inter: 6, adv: 3, deploys: 8, customers: 12, validation: 'audit' },
  { id: 'hybrid', name: 'Hybrid Cloud Infrastructure with Azure Stack HCI', short: 'Hybrid Cloud (HCI)', aligned: ['infra', 'dataai', 'dai'], skill: 'infra', inter: 5, adv: 2, deploys: 6, customers: 8, validation: 'audit' },
  { id: 'avd', name: 'Microsoft Azure Virtual Desktop', short: 'Azure Virtual Desktop', aligned: ['infra'], skill: 'infra', inter: 5, adv: 2, deploys: 6, customers: 8, validation: 'audit' },
  { id: 'avs', name: 'Microsoft Azure VMware Solution', short: 'Azure VMware Solution', aligned: ['infra'], skill: 'infra', inter: 5, adv: 2, deploys: 6, customers: 8, validation: 'audit' },
  { id: 'networking', name: 'Networking Services in Microsoft Azure', short: 'Azure Networking', aligned: ['infra'], skill: 'infra', inter: 5, adv: 2, deploys: 6, customers: 8, validation: 'audit' },
  { id: 'sap', name: 'SAP on Microsoft Azure', short: 'SAP on Azure', aligned: ['infra'], skill: 'infra', inter: 6, adv: 3, deploys: 5, customers: 6, validation: 'audit' },
  { id: 'copilot', name: 'Microsoft 365 Copilot', short: 'Microsoft 365 Copilot', aligned: ['modern', 'security'], skill: 'modern', inter: 6, adv: 3, deploys: 8, customers: 12, validation: 'audit', frontier: true },
  { id: 'calling', name: 'Calling for Microsoft Teams', short: 'Calling for Teams', aligned: ['modern'], skill: 'modern', inter: 5, adv: 2, deploys: 6, customers: 12, validation: 'reference' },
  { id: 'meetings', name: 'Meetings and Meeting Rooms for Microsoft Teams', short: 'Teams Meetings & Rooms', aligned: ['modern'], skill: 'modern', inter: 5, adv: 2, deploys: 6, customers: 12, validation: 'reference' },
  { id: 'teamsdev', name: 'Custom Solutions for Microsoft Teams', short: 'Custom Teams Solutions', aligned: ['modern'], skill: 'modern', inter: 5, adv: 2, deploys: 5, customers: 8, validation: 'reference' },
  { id: 'endpoints', name: 'Modernize Endpoints', short: 'Modernize Endpoints', aligned: ['modern'], skill: 'modern', inter: 5, adv: 2, deploys: 6, customers: 12, validation: 'reference' },
  { id: 'secureai', name: 'Secure AI Productivity', short: 'Secure AI Productivity', aligned: ['modern', 'security'], skill: 'modern', inter: 5, adv: 2, deploys: 6, customers: 10, validation: 'reference' },
  { id: 'cloudsec', name: 'Cloud Security', short: 'Cloud Security', aligned: ['security'], skill: 'security', inter: 6, adv: 3, deploys: 7, customers: 10, validation: 'audit' },
  { id: 'iam', name: 'Identity and Access Management', short: 'Identity & Access Mgmt', aligned: ['security'], skill: 'security', inter: 5, adv: 3, deploys: 7, customers: 10, validation: 'audit', frontier: true },
  { id: 'datasec', name: 'Data Security', short: 'Data Security', aligned: ['security'], skill: 'security', inter: 5, adv: 3, deploys: 7, customers: 10, validation: 'audit', frontier: true },
  { id: 'threat', name: 'Threat Protection', short: 'Threat Protection', aligned: ['security'], skill: 'security', inter: 6, adv: 3, deploys: 7, customers: 10, validation: 'audit' },
  { id: 'agenticbiz', name: 'Agentic Business Solutions', short: 'Agentic Business Sol.', aligned: ['bizapps', 'dai', 'modern'], skill: 'bizapps', inter: 5, adv: 2, deploys: 6, customers: 8, validation: 'auto' },
  { id: 'sales', name: 'Sales', short: 'Sales', aligned: ['bizapps'], skill: 'bizapps', inter: 5, adv: 2, deploys: 5, customers: 8, validation: 'auto' },
  { id: 'service', name: 'Service', short: 'Service', aligned: ['bizapps'], skill: 'bizapps', inter: 5, adv: 2, deploys: 5, customers: 8, validation: 'auto' },
  { id: 'finance', name: 'Finance', short: 'Finance', aligned: ['bizapps'], skill: 'bizapps', inter: 5, adv: 2, deploys: 5, customers: 8, validation: 'auto' },
  { id: 'supply', name: 'Supply Chain', short: 'Supply Chain', aligned: ['bizapps'], skill: 'bizapps', inter: 5, adv: 2, deploys: 4, customers: 6, offer: true, validation: 'auto' },
  { id: 'smb', name: 'Small and Midsize Business Management', short: 'SMB Management', aligned: ['bizapps'], skill: 'bizapps', inter: 4, adv: 1, deploys: 5, customers: 15, validation: 'auto' },
];

export const SPEC: Record<string, SpecDef> = Object.fromEntries(SPECS.map((s) => [s.id, s]));

/** Frontier Partner: Copilot + Data Security + IAM + (AI Apps OR AI Platform), 5 FTE badges, 3 DP-600, audit. */
export const FRONTIER = {
  required: ['copilot', 'datasec', 'iam'],
  anyOf: ['aiapps', 'aiplatform'],
  fte: 5,
  dp600: 3,
  auditCost: 40,
};

// ---------------------------------------------------------------------------
// Repeatable offers

export interface OfferDef {
  id: string;
  name: string;
  area: AreaId;
  frontier: boolean;
  quarters: number;
  blurb: string;
}

export const OFFERS: OfferDef[] = [
  { id: 'agentfactory', name: 'Copilot Agent Factory', area: 'modern', frontier: true, quarters: 3, blurb: 'Packaged design-build-run service for Copilot agents.' },
  { id: 'secureai', name: 'Secure AI Foundations', area: 'security', frontier: true, quarters: 3, blurb: 'Purview, Entra and Defender guardrails for AI at scale.' },
  { id: 'fabricfast', name: 'Fabric Data Accelerator', area: 'dataai', frontier: true, quarters: 3, blurb: 'Land a governed Fabric data estate ready for agents.' },
  { id: 'agenticapps', name: 'Agentic App Launchpad', area: 'dai', frontier: true, quarters: 3, blurb: 'Azure AI Foundry + GitHub Copilot app factory.' },
  { id: 'bizagents', name: 'D365 Agent Quickstart', area: 'bizapps', frontier: true, quarters: 3, blurb: 'Pre-built agents for sales, service and finance.' },
  { id: 'migfactory', name: 'Azure Migration Factory', area: 'infra', frontier: false, quarters: 2, blurb: 'Repeatable lift, shift and modernise runbooks.' },
  { id: 'zerotrust', name: 'Zero Trust Jumpstart', area: 'security', frontier: false, quarters: 2, blurb: 'Fixed-scope identity and endpoint hardening.' },
  { id: 'teamsrooms', name: 'Teams Rooms in a Box', area: 'modern', frontier: false, quarters: 2, blurb: 'Meeting room rollouts with managed service.' },
];

export const OFFER: Record<string, OfferDef> = Object.fromEntries(OFFERS.map((o) => [o.id, o]));

// ---------------------------------------------------------------------------
// Company heritage (starting practice)

export interface HeritageDef {
  id: string;
  name: string;
  area: AreaId;
  blurb: string;
}

export const HERITAGES: HeritageDef[] = [
  { id: 'msp', name: 'Cloud Infrastructure MSP', area: 'infra', blurb: 'You keep servers humming and are moving customers to Azure.' },
  { id: 'mw', name: 'Modern Workplace Boutique', area: 'modern', blurb: 'Teams, M365 and now Copilot rollouts are your bread and butter.' },
  { id: 'sec', name: 'Security Consultancy', area: 'security', blurb: 'Zero Trust evangelists with a SOC in the basement.' },
  { id: 'data', name: 'Data & AI Startup', area: 'dataai', blurb: 'Fabric fanatics with a whiteboard full of agent diagrams.' },
  { id: 'apps', name: 'App Development House', area: 'dai', blurb: 'You ship code, love GitHub and modernise legacy apps.' },
  { id: 'dyn', name: 'Dynamics Specialist', area: 'bizapps', blurb: 'Dynamics 365 and Power Platform veterans.' },
];

// ---------------------------------------------------------------------------
// Difficulty

export type Difficulty = 'easy' | 'normal' | 'hard';
export const DIFFICULTY: Record<Difficulty, { name: string; cash: number; events: number; poty: number; blurb: string }> = {
  easy: { name: 'Easy', cash: 900, events: 0.75, poty: 1.2, blurb: 'Deep pockets, kind markets.' },
  normal: { name: 'Normal', cash: 600, events: 1, poty: 1, blurb: 'The partner life as we know it.' },
  hard: { name: 'Hard', cash: 380, events: 1.3, poty: 0.85, blurb: 'Thin margins and stormy weather.' },
};

// ---------------------------------------------------------------------------
// Standing programmes (set at FY planning, tweak quarterly)

export type ProgrammeId = 'skilling' | 'marketing' | 'cosell' | 'people';
export const PROGRAMMES: { id: ProgrammeId; name: string; costs: number[]; blurb: string }[] = [
  { id: 'skilling', name: 'Skilling', costs: [0, 20, 45, 80], blurb: 'Certification time and exam vouchers. Earns intermediate and advanced certs in your focus areas. Each level also costs ~3% billable time.' },
  { id: 'marketing', name: 'Marketing', costs: [0, 15, 35, 65], blurb: 'Campaigns and content that generate leads in your focus areas. Marketing co-op funds cover up to half the cost.' },
  { id: 'cosell', name: 'Sales & Co-sell', costs: [0, 10, 25, 45], blurb: 'Sellers working with Microsoft account teams: better conversion, more Partner Center referrals and big-deal chances.' },
  { id: 'people', name: 'People & Culture', costs: [0, 10, 22, 40], blurb: 'Wellbeing, career paths and recognition. Raises morale, reduces attrition and lets you hire faster.' },
];
export const LEVEL_NAMES = ['OFF', 'LOW', 'MED', 'HIGH'];

// ---------------------------------------------------------------------------
// FY strategic bets

export type BetId = 'growth' | 'skills' | 'innovation' | 'ops' | 'align' | 'customer';
export const BETS: { id: BetId; name: string; blurb: string }[] = [
  { id: 'growth', name: 'Growth Engine', blurb: 'Marketing and co-sell generate 25% more leads; conversion +5%.' },
  { id: 'skills', name: 'Skills First', blurb: 'Skilling programme earns 35% more certification progress.' },
  { id: 'innovation', name: 'Innovation Lab', blurb: 'Offers develop 50% faster and cost 25% less to build.' },
  { id: 'ops', name: 'Operational Excellence', blurb: 'Overheads -15% and project success +5%.' },
  { id: 'align', name: 'Microsoft Alignment', blurb: 'More referrals, +2 reputation a quarter, co-op accrual +50%.' },
  { id: 'customer', name: 'Customer Obsession', blurb: 'Key account satisfaction rises faster; churn much lower.' },
];

// ---------------------------------------------------------------------------
// Economy constants (all money in $K)

export const CFG = {
  techCost: 29,
  salesCost: 24,
  techCapacity: 45,
  smallRevenue: 13,
  overheadBase: 40,
  overheadPerStaff: 3.5,
  hireCost: 8,
  architectCost: 25,
  severance: 15,
  skillPts: [0, 2, 5, 8],
  mktLeads: [0, 2, 5, 8],
  cosellConv: [0, 0.05, 0.1, 0.15],
  cosellRefs: [0, 0.8, 1.6, 2.6],
  peopleMorale: [-3, 1, 3, 5],
  unifiedCost: 15,
  interest: 0.025,
  designationFee: 6,
  offerBuildCost: 35,
  auditCost: 20,
  refCost: 3,
  /** Wins before the end of FY31 (turn 20) earn a speed bonus; play itself has no time limit. */
  speedTurns: 20,
};

// ---------------------------------------------------------------------------
// Partner benefits: yearly Azure bulk credits ($K), per the MAICPP Benefits Guide (July 2026).
// Credits are granted for the membership year (1 July) and expire if unused on 30 June.

export type CreditCategory = 'azure' | 'bizapps' | 'modern' | 'security';

export const AZURE_CREDITS = {
  /** Partner Success Core / Expanded Benefits. */
  ps: { core: 2.4, expanded: 5 } as Record<'core' | 'expanded', number>,
  /** Solutions Partner designation-specific (incremental) benefits. */
  designation: { dataai: 10, dai: 10, infra: 10, security: 10, bizapps: 4, modern: 4 } as Record<AreaId, number>,
  /** Specialization benefits per specialization, capped per category. Only with Solutions Partner benefits. */
  spec: {
    azure: { per: 14, cap: 5 },
    bizapps: { per: 6, cap: 3 },
    modern: { per: 6, cap: 3 },
    security: { per: 10, cap: 3 },
  } as Record<CreditCategory, { per: number; cap: number }>,
};

/** Specialization benefit category (Azure, Business Applications, Modern Work, Security). */
export function creditCategory(spec: SpecDef): CreditCategory {
  return AREA[spec.skill].azure ? 'azure' : (spec.skill as CreditCategory);
}

/** Partner Success Benefits annual fee ($K). */
export const PS_FEE: Record<'core' | 'expanded', number> = { core: 1, expanded: 4 };

/** Customer Zero for Azure: run your own business on Azure. */
export const AZURE_ZERO = {
  cost: 20,
  /** Quarterly Azure consumption once live, paid from Azure credits first. */
  runCost: 2,
  productivity: 0.03,
  /** Better win rates and project success in Azure solution areas: you demo what you run. */
  azureEdge: 0.02,
};

// ---------------------------------------------------------------------------
// Who advises you: MAICPP programme emails, then your distributor's account manager
// (once you join CSP through an Indirect Provider), then a Microsoft PDM (Managed Partner List).

export const DISTRIBUTOR = { company: 'Kickstart Distribution', am: 'Sam' };
export const PDM_NAME = 'Alex';

// ---------------------------------------------------------------------------
// Flavour: Microsoft's fictitious company names

export const CUSTOMER_NAMES = [
  'Contoso', 'Fabrikam', 'Northwind Traders', 'Tailspin Toys', 'Woodgrove Bank', 'Litware', 'Adventure Works',
  'Proseware', 'Wide World Importers', 'Alpine Ski House', 'Fourth Coffee', 'Coho Winery', 'Lucerne Publishing',
  "Margie's Travel", 'Trey Research', 'VanArsdel', 'Relecloud', 'Humongous Insurance', 'Blue Yonder Airlines',
  'City Power & Light', 'Consolidated Messenger', 'Southridge Video', 'Wingtip Toys', 'A. Datum', 'Bellows College',
  'Lamna Healthcare', 'Nod Publishers', 'Tailwind Traders', 'Fincher Architects', 'Graphic Design Institute',
  'Best For You Organics', 'Munson\'s Pickles', 'First Up Consultants', 'School of Fine Art', 'Contoso Pharmaceuticals',
  'Woodgrove Hospital', 'Northwind Health', 'Fabrikam Residences',
];

export const RIVAL_NAMES = [
  'Cloudwise Ltd', 'Bytebridge Partners', 'Nimbus & Co', 'Azurite Consulting', 'Bluebird IT', 'Stratus Systems',
  'Pixelforge Digital', 'Quantum Quill', 'Copperline Tech', 'Northstar Cloud', 'Lighthouse Labs', 'Redwood Data',
];

export const FY_MONTHS = ['JUL-SEP', 'OCT-DEC', 'JAN-MAR', 'APR-JUN'];
