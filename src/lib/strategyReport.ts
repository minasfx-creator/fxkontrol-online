/**
 * Strategy Report builder
 * ------------------------------------------------------------------
 * Pure data transformation. Takes a demo session, the assets shown,
 * and the relevant claims, and returns a structured report ready
 * for PDF rendering or JSON export.
 *
 * No I/O. No DOM. Safe to use server-side or in tests.
 */

import { CLAIMS, type Claim } from '@/lib/claims';
import { SEED_ASSETS, type StrategicAsset } from '@/components/strategy/AssetLibrary';

export interface DemoSessionInput {
  id?: string;
  prospect_company: string;
  prospect_audience: 'enterprise' | 'producer' | 'operator' | 'investor';
  asset_ids: string[];
  objections?: string | null;
  next_step?: string | null;
  outcome: 'pending' | 'won' | 'lost' | 'nurture';
  notes?: string | null;
  created_at?: string;
}

export interface ClientApprovalInput {
  scope: string;
  preview_version: string;
  comments: Array<{ author?: string; text: string; at?: string }>;
  approved: boolean;
  approved_at?: string | null;
  approver_email?: string | null;
}

export interface StrategyReport {
  schema: 'fxkontrol.report.v1';
  generatedAt: string;
  kind: 'demo-session' | 'client-approval';
  positioning: string;
  coreMessages: string[];
  session?: DemoSessionInput;
  approval?: ClientApprovalInput;
  assets: StrategicAsset[];
  claims: Claim[];
  disclaimers: string[];
}

const POSITIONING = 'The Operating System for Massive Spectacles.';
const CORE = [
  'End the broken stage',
  'Sell before deployment',
  'Safety-first spectacle OS',
];

function disclaimersForAssets(assets: StrategicAsset[], claims: Claim[]): string[] {
  // Auto-attach claim disclaimers whenever a referenced asset is non-validated,
  // OR when a claim used in copy carries one.
  const out = new Set<string>();
  for (const a of assets) {
    if (a.claimStatus === 'pilot') {
      out.add(`${a.title}: pilot — usable in pilot language only, with disclaimer.`);
    } else if (a.claimStatus === 'marketing_hypothesis') {
      out.add(`${a.title}: marketing hypothesis — narrative only, never quote as guarantee.`);
    }
  }
  for (const c of claims) {
    if (c.disclaimer) out.add(`${c.label}: ${c.disclaimer}`);
  }
  return Array.from(out);
}

export function buildDemoSessionReport(session: DemoSessionInput): StrategyReport {
  const assets = SEED_ASSETS.filter((a) => session.asset_ids.includes(a.id));
  const claims = CLAIMS; // ship full claim policy for audit
  return {
    schema: 'fxkontrol.report.v1',
    generatedAt: new Date().toISOString(),
    kind: 'demo-session',
    positioning: POSITIONING,
    coreMessages: CORE,
    session,
    assets,
    claims,
    disclaimers: disclaimersForAssets(assets, claims),
  };
}

export function buildClientApprovalReport(
  approval: ClientApprovalInput,
  linkedSession?: DemoSessionInput,
): StrategyReport {
  const assets = linkedSession
    ? SEED_ASSETS.filter((a) => linkedSession.asset_ids.includes(a.id))
    : [];
  const claims = CLAIMS;
  return {
    schema: 'fxkontrol.report.v1',
    generatedAt: new Date().toISOString(),
    kind: 'client-approval',
    positioning: POSITIONING,
    coreMessages: CORE,
    session: linkedSession,
    approval,
    assets,
    claims,
    disclaimers: disclaimersForAssets(assets, claims),
  };
}
