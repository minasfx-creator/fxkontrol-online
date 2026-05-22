/**
 * Product Maturity Matrix — FXKONTROL
 * ------------------------------------------------------------------
 * Honest map of where each module sits in the product lifecycle.
 * Used by the Strategic Command Hub to set sales expectations and
 * by claim policy to gate "validated" vs "pilot" vs "hypothesis".
 *
 *   production → shipped, stable, used in real shows, has evidence.
 *   pilot      → working, used in controlled bench/demo. Disclaimer.
 *   scaffold   → UI/skeleton wired, real binding pending. Demo only.
 *   research   → exploration / spike. Not for sales conversation.
 */

export type MaturityStatus = 'production' | 'pilot' | 'scaffold' | 'research';

export interface ProductMaturity {
  module: string;
  status: MaturityStatus;
  proof: string;
  risks: string;
  nextMilestone: string;
}

export const MATURITY_META: Record<
  MaturityStatus,
  { label: string; tone: 'ok' | 'warn' | 'info' | 'muted'; description: string }
> = {
  production: {
    label: 'Production',
    tone: 'ok',
    description: 'Shipped and stable. Safe to use as commercial proof.',
  },
  pilot: {
    label: 'Pilot',
    tone: 'warn',
    description: 'Bench / controlled demos. Carry pilot disclaimer.',
  },
  scaffold: {
    label: 'Scaffold',
    tone: 'info',
    description: 'UI wired, real binding pending. Demo / preview only.',
  },
  research: {
    label: 'Research',
    tone: 'muted',
    description: 'Exploration. Not for external sales conversation.',
  },
};

export const MATURITY_MATRIX: ProductMaturity[] = [
  {
    module: 'Go-Live Center',
    status: 'production',
    proof: 'Checklist + GO/NO-GO engine + PDF report shipping today.',
    risks: 'Evidence capture is manual; auto-capture per-family is next.',
    nextMilestone: 'Hardware-driven evidence capture (FXK16 / DMX).',
  },
  {
    module: 'SkyCanvas Previs',
    status: 'production',
    proof: 'Cinematic Studio Mode 11-layer pipeline + WebGPU/WebGL2 fallback.',
    risks: 'Mobile WebGPU limited; falls back to WebGL2 GPGPU.',
    nextMilestone: 'Pixel Streaming hand-off to Unreal swarm.',
  },
  {
    module: 'Strategic Command Hub',
    status: 'production',
    proof: '/strategy with assets, claims, demo sessions, approval, PDF export.',
    risks: 'Asset inventory still seeded; client-side only.',
    nextMilestone: 'Maturity matrix + asset filters (this round).',
  },
  {
    module: 'AI Choreography Studio',
    status: 'pilot',
    proof: 'Beginner/Expert UI + validation + Skybrush honest export.',
    risks: 'Generation wired to deterministic templates, not LLM yet.',
    nextMilestone: 'LLM scene synthesis with safety guardrail (day 36–60).',
  },
  {
    module: 'Skybrush Export',
    status: 'pilot',
    proof: 'Honest ZIP with validation + disclaimer; FAA Part 107 sanity.',
    risks: 'Not validated against live Skybrush importer.',
    nextMilestone: 'Validate against Skybrush Studio session.',
  },
  {
    module: 'DockTwin Pilot',
    status: 'scaffold',
    proof: 'Digital twin panel + bench/dummy mode (no real commands).',
    risks: 'No physical companion device shipped yet.',
    nextMilestone: 'Companion telemetry stream + service flow.',
  },
  {
    module: 'FXK16 Pyro Module',
    status: 'pilot',
    proof: 'BLE + USB pairing wizards, ARM/FIRE/E-STOP via gateway.',
    risks: 'Field-validated only on bench. Dummy load required.',
    nextMilestone: 'Field validation log (50 cycles) + signed firmware.',
  },
  {
    module: 'Multi-Transport Aggregation',
    status: 'production',
    proof: 'Web Serial + USB + BLE + Art-Net unified per device.',
    risks: 'Auto-fallback session-scoped; no persistent quarantine.',
    nextMilestone: 'Persistent transport quarantine across sessions.',
  },
  {
    module: 'Black Box / Audit Journal',
    status: 'production',
    proof: 'Command journal with 100 ms granularity, dedupe, replay.',
    risks: 'Storage retention not configurable per show.',
    nextMilestone: 'Per-show retention policy + signed export.',
  },
  {
    module: 'Pixel Streaming / Unreal',
    status: 'research',
    proof: 'BP_SwarmManager contract documented.',
    risks: 'No hosted Pixel Streaming environment yet.',
    nextMilestone: 'Hosted demo with one client showcase.',
  },
  {
    module: 'Tuya Smart Outlets (low-prec)',
    status: 'pilot',
    proof: 'BLE Mesh + Wi-Fi catalog, pairing panel, set-dp command.',
    risks: '200–800 ms latency. Never for pyro <50 ms timing.',
    nextMilestone: 'Visible UI guard preventing pyro role assignment.',
  },
  {
    module: 'Client Approval Flow',
    status: 'production',
    proof: 'Lovable Cloud table + comments + PDF approval report.',
    risks: 'No video annotation timeline yet.',
    nextMilestone: 'Timestamped comment pins on previs timeline.',
  },
];
