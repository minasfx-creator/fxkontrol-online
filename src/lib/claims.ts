/**
 * Claim Policy — FXKONTROL US Strategic Hub
 * ------------------------------------------------------------------
 * Every claim used in sales / marketing material MUST be tagged
 * before being shipped externally.
 *
 *  validated             → safe to use as factual or source-backed.
 *  pilot                 → usable with pilot language and disclaimers.
 *  marketing_hypothesis  → useful for narrative, NOT proof.
 *
 * NFPA, FAA, latency, cost-reduction, range and hardware claims
 * require careful review before being used as commercial guarantees
 * in the US. Default to `marketing_hypothesis` when in doubt.
 */

export type ClaimStatus = 'validated' | 'pilot' | 'marketing_hypothesis';

export type ClaimDomain =
  | 'safety'
  | 'latency'
  | 'compliance'
  | 'hardware'
  | 'cost'
  | 'range'
  | 'workflow'
  | 'narrative';

export interface Claim {
  /** stable id used in exports & audit */
  id: string;
  /** short human label */
  label: string;
  /** sentence-form claim, ready for sales copy */
  statement: string;
  status: ClaimStatus;
  domain: ClaimDomain;
  /** optional source / evidence link (doc, lab report, video) */
  evidence?: string;
  /** when this status was last reviewed */
  reviewedAt: string; // ISO date
  /** disclaimer to render alongside `pilot` / `marketing_hypothesis` */
  disclaimer?: string;
}

export const CLAIM_STATUS_META: Record<
  ClaimStatus,
  { label: string; tone: 'ok' | 'warn' | 'info'; description: string }
> = {
  validated: {
    label: 'Validated',
    tone: 'ok',
    description: 'Source-backed. Safe for commercial use without disclaimer.',
  },
  pilot: {
    label: 'Pilot',
    tone: 'warn',
    description: 'Usable in pilot language. Must carry disclaimer.',
  },
  marketing_hypothesis: {
    label: 'Marketing Hypothesis',
    tone: 'info',
    description: 'Narrative only. Not proof. Never quote as guarantee.',
  },
};

export const CLAIMS: Claim[] = [
  {
    id: 'safety-estop-50ms',
    label: 'E-STOP latency <50ms',
    statement: 'FXKONTROL guarantees E-STOP propagation under 50 ms in the operational command path.',
    status: 'pilot',
    domain: 'latency',
    reviewedAt: '2026-04-01',
    disclaimer: 'Measured in bench conditions over USB / BLE FXK16 link. Field results vary by transport and RF noise.',
  },
  {
    id: 'safety-blackbox-100ms',
    label: 'Black box 100ms granularity',
    statement: 'Every command and state transition is journaled with 100 ms granularity for audit and rollback.',
    status: 'validated',
    domain: 'safety',
    reviewedAt: '2026-04-01',
    evidence: 'src/core/safety/CommandJournal',
  },
  {
    id: 'workflow-unified-stack',
    label: 'One surface for DMX, Art-Net, drones, pyro',
    statement: 'A single command surface replaces fragmented DMX, Art-Net, drone, pyro and reporting tools.',
    status: 'validated',
    domain: 'workflow',
    reviewedAt: '2026-04-15',
  },
  {
    id: 'workflow-sell-before-deploy',
    label: 'Sell before deployment',
    statement: 'SkyCanvas, Unreal/Pixel Streaming, AR Overlay and reports let producers sell shows before any hardware is mobilized.',
    status: 'pilot',
    domain: 'workflow',
    reviewedAt: '2026-04-15',
    disclaimer: 'Unreal / Pixel Streaming integration is in pilot. AR Overlay requires field validation.',
  },
  {
    id: 'compliance-nfpa-faa',
    label: 'NFPA / FAA compliance',
    statement: 'Designed to align with NFPA 1126 and FAA Part 107 / 108 for US deployments.',
    status: 'marketing_hypothesis',
    domain: 'compliance',
    reviewedAt: '2026-04-15',
    disclaimer: 'Compliance posture is design-aligned, not certified. Each show requires AHJ review.',
  },
  {
    id: 'hardware-docktwin-pilot',
    label: 'DockTwin physical–digital twin',
    statement: 'DockTwin pairs the operator station with a digital twin for bench validation and serviceability.',
    status: 'pilot',
    domain: 'hardware',
    reviewedAt: '2026-04-20',
    disclaimer: 'DockTwin is a pilot product. Bench evidence, service flow and companion telemetry are still in validation.',
  },
  {
    id: 'ai-choreography-safe',
    label: 'AI choreography (no recipes / no ignition)',
    statement: 'AI Choreography Studio generates editable scenes, drone formations and DMX looks. It never produces chemical recipes, manufacturing instructions or ignition sequences.',
    status: 'validated',
    domain: 'safety',
    reviewedAt: '2026-04-20',
    evidence: 'mem://arquitetura/ai-guardrail-central',
  },
  {
    id: 'cost-reduction-30pct',
    label: '30% reduction in pre-production time',
    statement: 'Producers using the Strategic Hub report up to 30% reduction in pre-production cycles.',
    status: 'marketing_hypothesis',
    domain: 'cost',
    reviewedAt: '2026-04-20',
    disclaimer: 'Hypothesis pending case-study collection from days 61–90 pilots.',
  },
  {
    id: 'range-multi-transport',
    label: 'Multi-transport reach (USB, BLE, Art-Net, 433MHz, Starlink)',
    statement: 'Hybrid transport stack covers USB, BLE, Art-Net, 433 MHz TDMA and Starlink fallback.',
    status: 'pilot',
    domain: 'range',
    reviewedAt: '2026-04-20',
    disclaimer: 'Starlink and 433 MHz TDMA paths are in pilot integration. Range varies by terrain and licensing.',
  },
];

export function getClaim(id: string): Claim | undefined {
  return CLAIMS.find((c) => c.id === id);
}

export function claimsByStatus(status: ClaimStatus): Claim[] {
  return CLAIMS.filter((c) => c.status === status);
}
