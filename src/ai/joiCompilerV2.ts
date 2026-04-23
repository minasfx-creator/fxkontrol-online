/**
 * Joi Compiler v2.1 — AST → IR (engine-grade, deterministic).
 *
 * CAMADA EXTERNA, ISOLADA. Não toca:
 *  - core determinístico (showCompiler/ShowGraph clássico)
 *  - HIL / SafetyStateMachine / runtime
 *  - hardware adapters
 *
 * Refinos v2.1:
 *  - ACTION_MAP declarativo (auditável, LLM-explainable)
 *  - frameIndex + sequenceId (FNV1a) → determinismo forte / replay
 *  - Sweep-line O(n log n) para concurrency (substitui O(n²))
 *  - Weighted risk model (pyro/drone/dmx/overlap)
 *  - executionLayer flag (simulated | real | shadow)
 */

// ─── Constantes do engine ──────────────────────────────────────────
export const FRAME_SIZE_MS = 100; // 10 Hz scheduling grid (HIL-ready)

const RISK_WEIGHTS = {
  pyro: 0.5,
  drone: 0.3,
  dmx: 0.1,
  overlap: 0.1,
} as const;

// ─── AST ───────────────────────────────────────────────────────────
export type JoiNodeKind =
  | 'scene'
  | 'formation'
  | 'transition'
  | 'accent'
  | 'pulse'
  | 'finale';

export type JoiTarget = 'drone' | 'pyro' | 'dmx';
export type ExecutionLayer = 'simulated' | 'real' | 'shadow';

export interface JoiASTNode {
  readonly id: string;
  readonly kind: JoiNodeKind;
  readonly start: number;
  readonly duration: number;
  readonly targets: readonly JoiTarget[];
  readonly params: Readonly<Record<string, number>>;
  readonly intensity?: number;
  readonly spatialHint?: {
    readonly type: 'circle' | 'line' | 'wave' | 'grid' | 'freeform';
    readonly radius?: number;
  };
}

export interface JoiAST {
  readonly showId: string;
  readonly version: 'joi-ast-v1';
  readonly nodes: readonly JoiASTNode[];
  readonly metadata?: {
    readonly title?: string;
    readonly tags?: readonly string[];
  };
}

// ─── IR ────────────────────────────────────────────────────────────
export type IRAction =
  | 'move'
  | 'hold'
  | 'ignite'
  | 'color'
  | 'intensity'
  | 'pattern';

export interface IRCommand {
  readonly target: JoiTarget;
  readonly action: IRAction;
  readonly params: Readonly<Record<string, number>>;
  readonly constraints: {
    readonly safe: boolean;
    readonly riskScore: number;
    readonly bounded: boolean;
  };
}

export interface IRStep {
  readonly id: string;
  readonly sequenceId: string; // deterministic hash (FNV1a)
  readonly frameIndex: number; // floor(t0 / FRAME_SIZE_MS)
  readonly frameOffset: number; // ms within the frame (t0 % FRAME_SIZE_MS)
  readonly t0: number;
  readonly t1: number;
  readonly commands: readonly IRCommand[];
  readonly context: {
    readonly activeActors: number;
    readonly risk: number;
    readonly overlapCount: number;
  };
  readonly executionHint: {
    readonly mode: ExecutionLayer;
    readonly degraded: boolean;
  };
}

export interface JoiIR {
  readonly showId: string;
  readonly version: 'joi-ir-v1';
  readonly executionLayer: ExecutionLayer;
  readonly frameSizeMs: number;
  readonly steps: readonly IRStep[];
  readonly globalStats: {
    readonly duration: number;
    readonly frames: number;
    readonly maxDroneSpeedUsed: number;
    readonly maxPyroConcurrency: number;
    readonly dmxChannelLoad: number;
    readonly riskEnvelope: {
      readonly avg: number;
      readonly peak: number;
    };
  };
  readonly safety: {
    readonly collisionRiskScore: number;
    readonly peakRisk: number;
    readonly constraintViolations: readonly string[];
  };
}

export interface CompileResultV2 {
  readonly success: boolean;
  readonly ast?: JoiAST;
  readonly ir?: JoiIR;
  readonly errors: readonly string[];
  readonly diagnostics: {
    readonly astValid: boolean;
    readonly irValid: boolean;
    readonly constraintPass: boolean;
  };
}

export interface CompileOptionsV2 {
  readonly executionLayer?: ExecutionLayer;
}

// ─── Action mapping declarativo (auditável) ────────────────────────
type ActionMap = {
  readonly [T in JoiTarget]: { readonly [K in JoiNodeKind]: IRAction };
};

export const ACTION_MAP: ActionMap = {
  drone: {
    scene: 'pattern',
    formation: 'pattern',
    transition: 'move',
    accent: 'move',
    pulse: 'hold',
    finale: 'pattern',
  },
  pyro: {
    scene: 'hold',
    formation: 'hold',
    transition: 'hold',
    accent: 'ignite',
    pulse: 'ignite',
    finale: 'ignite',
  },
  dmx: {
    scene: 'color',
    formation: 'color',
    transition: 'color',
    accent: 'intensity',
    pulse: 'intensity',
    finale: 'intensity',
  },
} as const;

// ─── FNV1a 32-bit (deterministic, no deps) ─────────────────────────
function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

// ─── AST validation (estrutural) ───────────────────────────────────
function validateAST(ast: JoiAST): string[] {
  const errs: string[] = [];
  if (!ast || ast.version !== 'joi-ast-v1') errs.push('ast: invalid version');
  if (!ast?.showId) errs.push('ast: missing showId');
  if (!Array.isArray(ast?.nodes) || ast.nodes.length === 0) {
    errs.push('ast: empty nodes');
  }
  const seen = new Set<string>();
  for (const n of ast?.nodes ?? []) {
    if (!n.id) errs.push('node: missing id');
    if (seen.has(n.id)) errs.push(`node ${n.id}: duplicate id`);
    seen.add(n.id);
    if (!Number.isFinite(n.start) || n.start < 0) {
      errs.push(`node ${n.id}: invalid start`);
    }
    if (!Number.isFinite(n.duration) || n.duration <= 0) {
      errs.push(`node ${n.id}: invalid duration`);
    }
    if (!n.targets?.length) errs.push(`node ${n.id}: empty targets`);
  }
  return errs;
}

// ─── Constraint analysis (pré-IR) ──────────────────────────────────
function analyzeConstraints(ast: JoiAST): string[] {
  const violations: string[] = [];
  for (const node of ast.nodes) {
    if (node.duration <= 0) {
      violations.push(`node ${node.id}: invalid duration`);
    }
    if (node.targets.includes('drone') && (node.intensity ?? 0) > 1) {
      violations.push(`node ${node.id}: drone intensity overflow`);
    }
    if (node.targets.includes('pyro') && (node.intensity ?? 0) > 1) {
      violations.push(`node ${node.id}: pyro intensity overflow`);
    }
  }
  return violations;
}

// ─── Sweep-line: per-node overlap count + max pyro concurrency ─────
type SweepEvent = { t: number; type: 0 | 1; idx: number }; // 0=start,1=end

function computeOverlaps(ast: JoiAST): {
  perNodeOverlap: number[];
  maxPyroConcurrency: number;
} {
  const n = ast.nodes.length;
  const perNodeOverlap = new Array<number>(n).fill(0);
  if (n === 0) return { perNodeOverlap, maxPyroConcurrency: 0 };

  // Generic overlap (all nodes) for risk model
  const events: SweepEvent[] = [];
  for (let i = 0; i < n; i++) {
    events.push({ t: ast.nodes[i].start, type: 0, idx: i });
    events.push({ t: ast.nodes[i].start + ast.nodes[i].duration, type: 1, idx: i });
  }
  // ends before starts at same t to avoid counting touching intervals
  events.sort((a, b) => a.t - b.t || a.type - b.type);

  // Linear sweep using activeCount (avoids O(n²) on dense scenes).
  // Each new start adds activeCount to itself; each currently active node
  // gains +1 (tracked separately via end-of-interval increments).
  // To keep per-node accuracy without iterating `active`, we accumulate
  // overlap as: starts seen while node was active = (endRank - startRank - 1) overlaps among them.
  let activeCount = 0;
  // overlapsAtStart[i] = activeCount when node i started
  const overlapsAtStart = new Array<number>(n).fill(0);
  for (const ev of events) {
    if (ev.type === 0) {
      overlapsAtStart[ev.idx] = activeCount;
      activeCount++;
    } else {
      activeCount--;
    }
  }
  // Second linear pass: a node's total overlap = (overlapsAtStart) + (starts that occurred while it was active)
  // Compute "starts during my interval" via second sweep.
  const startsBefore = new Array<number>(n).fill(0); // cumulative starts up to my end
  let startsCum = 0;
  for (const ev of events) {
    if (ev.type === 1) {
      startsBefore[ev.idx] = startsCum;
    } else {
      startsCum++;
    }
  }
  for (let i = 0; i < n; i++) {
    // starts that happened strictly between my start and my end
    const startsDuring = startsBefore[i] - (overlapsAtStart[i] + 1);
    perNodeOverlap[i] = overlapsAtStart[i] + Math.max(0, startsDuring);
  }

  // Pyro-only sweep for maxPyroConcurrency
  const pyroEvents: SweepEvent[] = [];
  for (let i = 0; i < n; i++) {
    if (!ast.nodes[i].targets.includes('pyro')) continue;
    pyroEvents.push({ t: ast.nodes[i].start, type: 0, idx: i });
    pyroEvents.push({ t: ast.nodes[i].start + ast.nodes[i].duration, type: 1, idx: i });
  }
  pyroEvents.sort((a, b) => a.t - b.t || b.type - a.type); // starts before ends => peak
  let cur = 0;
  let maxPyroConcurrency = 0;
  for (const ev of pyroEvents) {
    cur += ev.type === 0 ? 1 : -1;
    if (cur > maxPyroConcurrency) maxPyroConcurrency = cur;
  }

  return { perNodeOverlap, maxPyroConcurrency };
}

// ─── Weighted risk per step ────────────────────────────────────────
function computeStepRisk(
  node: JoiASTNode,
  overlapCount: number,
  hasViolation: boolean,
): number {
  const intensity = node.intensity ?? 0.5;
  let r = 0;
  if (node.targets.includes('pyro')) r += RISK_WEIGHTS.pyro * intensity;
  if (node.targets.includes('drone')) r += RISK_WEIGHTS.drone * intensity;
  if (node.targets.includes('dmx')) r += RISK_WEIGHTS.dmx * intensity;
  // Asymptotic saturation: fast initial growth, stable tail (avoids false red spikes)
  r += RISK_WEIGHTS.overlap * (1 - Math.exp(-overlapCount / 3));
  if (hasViolation) r = Math.max(r, 0.8);
  return Math.min(1, r);
}

// ─── IR builder ────────────────────────────────────────────────────
function buildIR(
  ast: JoiAST,
  violations: readonly string[],
  executionLayer: ExecutionLayer,
): JoiIR {
  const violationIds = new Set(
    violations.map((v) => v.split(':')[0].replace('node ', '').trim()),
  );
  const hasGlobalViolation = violations.length > 0;

  const { perNodeOverlap, maxPyroConcurrency } = computeOverlaps(ast);

  const steps: IRStep[] = ast.nodes.map((n, i) => {
    const overlapCount = perNodeOverlap[i];
    const hasViolation = violationIds.has(n.id) || hasGlobalViolation;
    const risk = computeStepRisk(n, overlapCount, hasViolation);
    const frameIndex = Math.floor(n.start / FRAME_SIZE_MS);
    const frameOffset = n.start % FRAME_SIZE_MS;

    const commands: IRCommand[] = n.targets.map((t) => ({
      target: t,
      action: ACTION_MAP[t][n.kind],
      params: Object.freeze({ ...n.params, intensity: n.intensity ?? 1 }),
      constraints: {
        safe: !hasViolation,
        riskScore: risk,
        bounded: true,
      },
    }));

    const sequenceId = fnv1a(
      `${ast.showId}|${n.id}|${frameIndex}|${n.start}|${n.duration}|${n.targets.join(',')}|${n.kind}`,
    );

    return Object.freeze<IRStep>({
      id: n.id,
      sequenceId,
      frameIndex,
      frameOffset,
      t0: n.start,
      t1: n.start + n.duration,
      commands: Object.freeze(commands),
      context: {
        activeActors: n.targets.length,
        risk,
        overlapCount,
      },
      executionHint: {
        mode: executionLayer,
        degraded: executionLayer !== 'real' && risk > 0.7,
      },
    });
  });

  // Deterministic ordering: frameIndex → t0 → sequenceId
  const orderedSteps = [...steps].sort(
    (a, b) =>
      a.frameIndex - b.frameIndex ||
      a.t0 - b.t0 ||
      a.sequenceId.localeCompare(b.sequenceId),
  );

  const duration = ast.nodes.reduce(
    (acc, n) => Math.max(acc, n.start + n.duration),
    0,
  );
  const frames = Math.ceil(duration / FRAME_SIZE_MS);
  const dmxChannelLoad = ast.nodes.filter((n) => n.targets.includes('dmx')).length;

  const peakRisk = orderedSteps.reduce((m, s) => Math.max(m, s.context.risk), 0);
  const avgRisk =
    orderedSteps.length > 0
      ? orderedSteps.reduce((s, x) => s + x.context.risk, 0) / orderedSteps.length
      : 0;

  return Object.freeze<JoiIR>({
    showId: ast.showId,
    version: 'joi-ir-v1',
    executionLayer,
    frameSizeMs: FRAME_SIZE_MS,
    steps: Object.freeze(orderedSteps),
    globalStats: {
      duration,
      frames,
      maxDroneSpeedUsed: 0,
      maxPyroConcurrency,
      dmxChannelLoad,
      riskEnvelope: { avg: Math.min(1, avgRisk), peak: peakRisk },
    },
    safety: {
      collisionRiskScore: Math.min(1, avgRisk),
      peakRisk,
      constraintViolations: Object.freeze([...violations]),
    },
  });
}

// ─── IR validator ──────────────────────────────────────────────────
function validateIR(ir: JoiIR): boolean {
  return (
    ir.steps.length > 0 &&
    ir.safety.peakRisk < 1 &&
    ir.safety.constraintViolations.length < 10
  );
}

// ─── Public pipeline ───────────────────────────────────────────────
export function compileJoiV2(
  ast: JoiAST,
  options: CompileOptionsV2 = {},
): CompileResultV2 {
  const executionLayer: ExecutionLayer = options.executionLayer ?? 'simulated';

  const astErrors = validateAST(ast);
  if (astErrors.length > 0) {
    return {
      success: false,
      errors: astErrors,
      diagnostics: { astValid: false, irValid: false, constraintPass: false },
    };
  }

  const violations = analyzeConstraints(ast);
  const ir = buildIR(ast, violations, executionLayer);
  const irValid = validateIR(ir);

  return {
    success: irValid && violations.length === 0,
    ast,
    ir,
    errors: violations,
    diagnostics: {
      astValid: true,
      irValid,
      constraintPass: violations.length === 0,
    },
  };
}

// Helpers expostos para testes / UI de debug
export const __internals = {
  validateAST,
  analyzeConstraints,
  buildIR,
  validateIR,
  computeOverlaps,
  computeStepRisk,
  fnv1a,
};
