/**
 * ─── JOI Intelligence Types ────────────────────────────────────────
 * Formalized contract types for JOI's intelligence layer.
 * Covers insights, recommendations, artifacts, context state, truth,
 * execution engine, task planning, resolvers, and visual blueprints.
 */

import type { IntegrationMode, EvidenceLevel } from '@/core/hardware/provenance';

// ── Confidence ──
export type JOIConfidenceLevel = 'low' | 'medium' | 'high';

// ── Artifact types ──
export type JOIArtifactType =
  | 'mermaid' | 'matrix' | 'report' | 'checklist'
  | 'blueprint' | 'svg_spec' | 'wireframe'
  | 'ui_layout_plan' | 'image_render_spec' | 'task_graph';

// ── Severity ──
export type JOIInsightSeverity = 'info' | 'warning' | 'error' | 'critical';

// ── Intent classification ──
export type JOIIntentCategory =
  | 'diagnose' | 'plan' | 'generate_visual' | 'document'
  | 'verify' | 'style_learn' | 'style_apply' | 'show_design'
  | 'architecture' | 'hardware_truth' | 'explain' | 'resolve';

// ── Insight ──
export interface JOIInsight {
  id: string;
  source: string;
  severity: JOIInsightSeverity;
  message: string;
  integration_mode: IntegrationMode;
  evidence_level: EvidenceLevel;
  timestamp: number;
}

// ── Recommendation ──
export interface JOIRecommendation {
  id: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  action: string;
  rationale: string;
  confidence: JOIConfidenceLevel;
}

// ── Artifact ──
export interface JOIArtifact {
  id: string;
  type: JOIArtifactType;
  title: string;
  content: string;
  generated_at: number;
}

// ── Context State ──
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

// ── Truth Summary ──
export interface JOITruthSummary {
  simulated: { count: number; devices: string[] };
  replay: { count: number; devices: string[] };
  live_read_only: { count: number; devices: string[] };
  not_integrated: { count: number; devices: string[] };
  dominant_mode: IntegrationMode;
  overall_evidence: EvidenceLevel;
}

// ── Response Envelope ──
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

// ══════════════════════════════════════════════════════════════════
// ── Execution Engine Types ──
// ══════════════════════════════════════════════════════════════════

/** Classified user intent */
export interface JOIIntent {
  category: JOIIntentCategory;
  subcategories: JOIIntentCategory[];
  raw_input: string;
  enhanced_input: string; // improved version of user request
  suggested_mode: string;
}

/** A subtask in the task graph */
export interface JOISubtask {
  id: string;
  label: string;
  category: JOIIntentCategory;
  resolver: string; // resolver name
  status: 'pending' | 'running' | 'done' | 'skipped';
  output?: string;
}

/** Task plan produced by JOITaskPlanner */
export interface JOITaskPlan {
  intent: JOIIntent;
  subtasks: JOISubtask[];
  created_at: number;
}

/** Execution trace — what resolvers ran and what they found */
export interface JOIExecutionTrace {
  plan: JOITaskPlan;
  resolver_outputs: JOIResolverOutput[];
  artifacts: JOIArtifact[];
  total_ms: number;
  source_of_truth: string[];
  integration_mode: IntegrationMode;
  evidence_level: EvidenceLevel;
  confidence: JOIConfidenceLevel;
}

/** Output from a single resolver */
export interface JOIResolverOutput {
  resolver: string;
  confidence: JOIConfidenceLevel;
  source_of_truth: string[];
  data_type: 'inferred' | 'source_of_truth' | 'style_based' | 'conceptual';
  summary: string;
  detail: string;
  artifacts: JOIArtifact[];
}

// ══════════════════════════════════════════════════════════════════
// ── Visual Blueprint Types ──
// ══════════════════════════════════════════════════════════════════

/** SVG shape in a blueprint */
export interface JOISVGShape {
  type: 'rect' | 'circle' | 'ellipse' | 'line' | 'path' | 'text' | 'group';
  x: number;
  y: number;
  w?: number;
  h?: number;
  r?: number;
  label?: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  children?: JOISVGShape[];
  className?: string;
}

/** Connector between shapes */
export interface JOISVGConnector {
  from: string; // shape id
  to: string;
  label?: string;
  style?: 'solid' | 'dashed' | 'dotted';
  color?: string;
}

/** Full SVG specification */
export interface JOISVGSpec {
  width: number;
  height: number;
  background: string;
  layers: JOISVGShape[][];
  connectors: JOISVGConnector[];
  legend?: { label: string; color: string }[];
  title?: string;
}

/** Wireframe node for UI layout plans */
export interface JOIWireframeNode {
  id: string;
  type: 'panel' | 'header' | 'sidebar' | 'card' | 'button' | 'input' | 'chart' | 'table' | 'canvas' | 'container';
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  state?: 'active' | 'disabled' | 'highlighted' | 'error';
  style_token?: string;
  children?: JOIWireframeNode[];
}

/** Visual blueprint — high-level layout plan */
export interface JOIVisualBlueprint {
  title: string;
  description: string;
  canvas: { width: number; height: number };
  zones: JOIWireframeNode[];
  annotations: { x: number; y: number; text: string; color?: string }[];
  color_scheme: Record<string, string>;
  layout_grid: { columns: number; rows: number; gap: number };
  output_format: 'svg' | 'mermaid' | 'wireframe';
}

/** Image render specification for future PNG generation */
export interface JOIImageRenderSpec {
  prompt: string;
  style: string;
  width: number;
  height: number;
  elements: string[];
  color_palette: string[];
}
