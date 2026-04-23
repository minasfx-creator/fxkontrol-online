/**
 * Joi Compiler v2 — AST → IR pipeline.
 *
 * CAMADA EXTERNA, ISOLADA. Não toca:
 *  - core determinístico (showCompiler/ShowGraph clássico)
 *  - HIL / SafetyStateMachine / runtime
 *  - hardware adapters
 *
 * Fluxo:  JoiAST (intenção) → constraint analysis → JoiIR (plano físico) → validateIR
 * Próximas camadas (não implementadas aqui): IR → Timeline determinística → HIL → Cert.
 */

// ─── AST ───────────────────────────────────────────────────────────
export type JoiNodeKind =
  | 'scene'
  | 'formation'
  | 'transition'
  | 'accent'
  | 'pulse'
  | 'finale';

export type JoiTarget = 'drone' | 'pyro' | 'dmx';

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
  readonly t0: number;
  readonly t1: number;
  readonly commands: readonly IRCommand[];
  readonly context: {
    readonly activeActors: number;
    readonly risk: number;
  };
}

export interface JoiIR {
  readonly showId: string;
  readonly version: 'joi-ir-v1';
  readonly steps: readonly IRStep[];
  readonly globalStats: {
    readonly duration: number;
    readonly maxDroneSpeedUsed: number;
    readonly maxPyroConcurrency: number;
    readonly dmxChannelLoad: number;
  };
  readonly safety: {
    readonly collisionRiskScore: number;
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

// ─── Action mapping por target (intent → physical action) ──────────
function actionFor(target: JoiTarget, kind: JoiNodeKind): IRAction {
  if (target === 'pyro') return kind === 'finale' || kind === 'accent' ? 'ignite' : 'hold';
  if (target === 'dmx') return kind === 'pulse' ? 'intensity' : 'color';
  // drone
  if (kind === 'formation' || kind === 'scene') return 'pattern';
  if (kind === 'transition') return 'move';
  return 'hold';
}

// ─── IR builder ────────────────────────────────────────────────────
function buildIR(ast: JoiAST, violations: readonly string[]): JoiIR {
  const violationCount = violations.length;
  const baseRisk = violationCount > 0 ? 0.8 : 0.2;

  const steps: IRStep[] = ast.nodes.map((n) => {
    const commands: IRCommand[] = n.targets.map((t) => ({
      target: t,
      action: actionFor(t, n.kind),
      params: { ...n.params, intensity: n.intensity ?? 1 },
      constraints: {
        safe: violationCount === 0,
        riskScore: Math.min(1, violationCount * 0.1),
        bounded: true,
      },
    }));
    return Object.freeze<IRStep>({
      id: n.id,
      t0: n.start,
      t1: n.start + n.duration,
      commands: Object.freeze(commands),
      context: { activeActors: n.targets.length, risk: baseRisk },
    });
  });

  const duration = ast.nodes.reduce(
    (acc, n) => Math.max(acc, n.start + n.duration),
    0,
  );

  // Concurrency: pyro events overlapping in time
  let maxPyroConcurrency = 0;
  for (const a of ast.nodes) {
    if (!a.targets.includes('pyro')) continue;
    let c = 1;
    for (const b of ast.nodes) {
      if (b === a || !b.targets.includes('pyro')) continue;
      const overlap = b.start < a.start + a.duration && b.start + b.duration > a.start;
      if (overlap) c++;
    }
    maxPyroConcurrency = Math.max(maxPyroConcurrency, c);
  }

  const dmxChannelLoad = ast.nodes.filter((n) => n.targets.includes('dmx')).length;

  return Object.freeze<JoiIR>({
    showId: ast.showId,
    version: 'joi-ir-v1',
    steps: Object.freeze(steps),
    globalStats: {
      duration,
      maxDroneSpeedUsed: 0,
      maxPyroConcurrency,
      dmxChannelLoad,
    },
    safety: {
      collisionRiskScore: Math.min(1, violationCount * 0.2),
      constraintViolations: Object.freeze([...violations]),
    },
  });
}

// ─── IR validator ──────────────────────────────────────────────────
function validateIR(ir: JoiIR): boolean {
  return (
    ir.steps.length > 0 &&
    ir.safety.collisionRiskScore < 1 &&
    ir.safety.constraintViolations.length < 10
  );
}

// ─── Public pipeline ───────────────────────────────────────────────
export function compileJoiV2(ast: JoiAST): CompileResultV2 {
  const astErrors = validateAST(ast);
  if (astErrors.length > 0) {
    return {
      success: false,
      errors: astErrors,
      diagnostics: { astValid: false, irValid: false, constraintPass: false },
    };
  }

  const violations = analyzeConstraints(ast);
  const ir = buildIR(ast, violations);
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
export const __internals = { validateAST, analyzeConstraints, buildIR, validateIR };
