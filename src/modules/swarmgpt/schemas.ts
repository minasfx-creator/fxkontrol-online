/**
 * SwarmGPT 2.0 — Zod schemas. Defense-in-depth against broken LLM JSON.
 */
import { z } from 'zod';

export const Vec3Schema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
});

export const BoundsSchema = z.object({
  minX: z.number(),
  maxX: z.number(),
  minY: z.number(),
  maxY: z.number(),
  minZ: z.number(),
  maxZ: z.number(),
});

export const RefinedPromptSchema = z.object({
  originalPrompt: z.string(),
  refinedPrompt: z.string(),
  creativeIntent: z.string(),
  style: z.enum([
    'cinematic',
    'epic',
    'luxury',
    'festival',
    'corporate',
    'emotional',
    'futuristic',
  ]),
  energyCurve: z.enum([
    'slow_build',
    'waves',
    'constant',
    'climax',
    'opening_climax',
  ]),
  keyMoments: z.array(z.number()),
  constraints: z.array(z.string()),
});

export const DroneFormationSchema = z.object({
  id: z.string(),
  name: z.string(),
  shape: z.enum([
    'circle',
    'sphere',
    'heart',
    'logo_placeholder',
    'text_placeholder',
    'wave',
    'spiral',
    'grid',
    'line',
    'custom',
  ]),
  startTime: z.number(),
  duration: z.number(),
  points: z.array(Vec3Schema),
  color: z.string().optional(),
  description: z.string().optional(),
});

export const DroneTransitionSchema = z.object({
  id: z.string(),
  fromFormationId: z.string(),
  toFormationId: z.string(),
  type: z.enum(['morph', 'fade', 'wave', 'spiral', 'explode', 'gather']),
  startTime: z.number(),
  duration: z.number(),
});

export const ChoreographyPlanSchema = z.object({
  version: z.literal('swarmgpt-2.0'),
  title: z.string(),
  duration: z.number(),
  droneCount: z.number(),
  formations: z.array(DroneFormationSchema),
  transitions: z.array(DroneTransitionSchema),
  notes: z.array(z.string()),
});

export const ChoreographyCritiqueSchema = z.object({
  score: z.number().min(0).max(100),
  issues: z.array(
    z.object({
      severity: z.enum(['low', 'medium', 'high']),
      category: z.enum([
        'timing',
        'geometry',
        'creativity',
        'safety',
        'clarity',
        'feasibility',
      ]),
      message: z.string(),
      suggestedFix: z.string(),
    }),
  ),
  improvementBrief: z.string(),
});

// ─────────────────────────────────────────────────────────────────────────────
// SwarmGPT 3.0 — Additional Zod schemas
// ─────────────────────────────────────────────────────────────────────────────

const _StyleEnum = z.enum([
  'cinematic','epic','luxury','festival','corporate','emotional','futuristic',
]);
const _EnergyCurveEnum = z.enum([
  'slow_build','waves','constant','climax','opening_climax',
]);
const _IssueSchema = z.object({
  severity: z.enum(['low', 'medium', 'high']),
  category: z.enum([
    'timing','geometry','creativity','safety','clarity','feasibility',
  ]),
  message: z.string(),
  suggestedFix: z.string(),
});

export const PromptVariantSchema = z.object({
  id: z.string(),
  direction: z.string(),
  style: _StyleEnum,
  energyCurve: _EnergyCurveEnum,
  keyMoments: z.array(z.number()),
  rationale: z.string(),
});

export const PromptExpansionResultSchema = z.object({
  variants: z.array(PromptVariantSchema).min(1).max(5),
  selectedVariantId: z.string(),
  selectionRationale: z.string(),
});

export const SpecialistCritiqueSchema = z.object({
  role: z.enum(['creativity', 'safety', 'tech']),
  score: z.number().min(0).max(100),
  issues: z.array(_IssueSchema),
  summary: z.string(),
});

export const MultiCritiqueResultSchema = z.object({
  specialists: z.array(SpecialistCritiqueSchema).min(1).max(3),
  aggregateScore: z.number().min(0).max(100),
  combinedIssues: z.array(_IssueSchema),
  improvementBrief: z.string(),
});

export const DevilsAdvocateFindingSchema = z.object({
  risk: z.string(),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  mitigation: z.string(),
});

export const DevilsAdvocateReportSchema = z.object({
  passed: z.boolean(),
  findings: z.array(DevilsAdvocateFindingSchema),
  finalVerdict: z.string(),
});
