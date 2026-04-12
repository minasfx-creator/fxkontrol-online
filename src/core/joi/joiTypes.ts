/**
 * ─── JOI Intelligence Types ────────────────────────────────────────
 * Formalized contract types for JOI's intelligence layer.
 * Covers insights, recommendations, artifacts, context state, and truth.
 */

import type { IntegrationMode, EvidenceLevel } from '@/core/hardware/provenance';

// ── Confidence ──
export type JOIConfidenceLevel = 'low' | 'medium' | 'high';

// ── Artifact types ──
export type JOIArtifactType = 'mermaid' | 'matrix' | 'report' | 'checklist' | 'blueprint' | 'svg_spec';

// ── Severity ──
export type JOIInsightSeverity = 'info' | 'warning' | 'error' | 'critical';

// ── Insight — a single observation or finding ──
export interface JOIInsight {
  id: string;
  source: string;             // e.g. 'VerificationEngine', 'ReadinessEvaluator'
  severity: JOIInsightSeverity;
  message: string;
  integration_mode: IntegrationMode;
  evidence_level: EvidenceLevel;
  timestamp: number;
}

// ── Recommendation — an actionable suggestion ──
export interface JOIRecommendation {
  id: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  action: string;
  rationale: string;
  confidence: JOIConfidenceLevel;
}

// ── Artifact — a generated output ──
export interface JOIArtifact {
  id: string;
  type: JOIArtifactType;
  title: string;
  content: string;           // Mermaid code, markdown table, report text, etc.
  generated_at: number;
}

// ── Context State — current system awareness ──
export interface JOIContextState {
  mode: string;
  source_of_truth: string[];
  integration_mode: IntegrationMode;
  evidence_level: EvidenceLevel;
  confidence: JOIConfidenceLevel;
  readiness_status: string;
  health_score: number;
  simulated_count: number;
  total_adapters: number;
  blockers_count: number;
}

// ── Truth Summary — integration honesty ──
export interface JOITruthSummary {
  simulated: { count: number; devices: string[] };
  replay: { count: number; devices: string[] };
  live_read_only: { count: number; devices: string[] };
  not_integrated: { count: number; devices: string[] };
  dominant_mode: IntegrationMode;
  overall_evidence: EvidenceLevel;
}

// ── Response Envelope — structured AI response metadata ──
export interface JOIResponseEnvelope {
  mode: string;
  title: string;
  summary: string;
  insights: JOIInsight[];
  recommendations: JOIRecommendation[];
  artifacts: JOIArtifact[];
  source_of_truth: string[];
  integration_mode: IntegrationMode;
  evidence_level: EvidenceLevel;
  confidence: JOIConfidenceLevel;
  next_steps: string[];
}
