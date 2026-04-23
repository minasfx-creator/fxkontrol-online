/**
 * ShowGraph V2 — Multi-layer intent model for Joi.
 *
 * V1 (showGraph.ts) continua funcional para o JoiPanel atual.
 * V2 introduz: stages, layers especializados (drone/dmx/pyro), constraints.
 *
 * REGRAS INVIOLÁVEIS:
 *  - AI NUNCA calcula física (apenas sugere posições)
 *  - Tempo é SEMPRE offset relativo ao stage (nunca wall-clock)
 *  - Layers não se conhecem entre si (coexistem no stage)
 *  - Nenhum campo executável (sem timers, fire, ack, HIL)
 *
 * Este módulo é puro: sem efeitos colaterais, sem Date.now em compile path.
 */

// ─── Metadata ─────────────────────────────────────────────────────────
export interface JoiMetadataV2 {
  readonly id: string;
  readonly title: string;
  readonly createdAt: number;
  readonly source: 'joi';
  readonly version: 'v2';
  readonly tags?: readonly string[];
  readonly notes?: string;
}

// ─── Drone Layer ──────────────────────────────────────────────────────
export interface JoiDroneMove {
  readonly at: number; // offset dentro do stage (s)
  readonly position: { readonly x: number; readonly y: number; readonly z: number };
  readonly orientation?: { readonly yaw: number; readonly pitch: number; readonly roll: number };
  readonly speed?: number; // m/s (sugestão; core valida)
}

export interface JoiDroneLayer {
  readonly type: 'drone';
  readonly system: {
    readonly formation: 'grid' | 'circle' | 'wave' | 'custom';
    readonly count: number;
  };
  readonly movements: readonly JoiDroneMove[];
}

// ─── DMX Layer ────────────────────────────────────────────────────────
export interface JoiFixture {
  readonly id: string;
  readonly channelStart: number;
  readonly channels: number;
}

export interface JoiDMXCue {
  readonly at: number;
  readonly fixtureId?: string;
  readonly intensity?: number; // 0-100
  readonly color?: { readonly r: number; readonly g: number; readonly b: number };
  readonly strobe?: number; // Hz
}

export interface JoiDMXLayer {
  readonly type: 'dmx';
  readonly fixtures: readonly JoiFixture[];
  readonly cues: readonly JoiDMXCue[];
}

// ─── Pyro Layer ───────────────────────────────────────────────────────
export interface JoiPyroDevice {
  readonly id: string;
  readonly zone: string;
}

export interface JoiPyroEvent {
  readonly at: number;
  readonly deviceId: string;
  readonly effect: 'burst' | 'fountain' | 'comet' | 'flash';
  readonly intensity?: number; // 0-100 (sugestão criativa)
}

export interface JoiPyroLayer {
  readonly type: 'pyro';
  readonly devices: readonly JoiPyroDevice[];
  readonly events: readonly JoiPyroEvent[];
}

// ─── Discriminated union ──────────────────────────────────────────────
export type JoiLayer = JoiDroneLayer | JoiDMXLayer | JoiPyroLayer;

// ─── Stage ────────────────────────────────────────────────────────────
export interface JoiStage {
  readonly id: string;
  readonly name: string;
  readonly startTime: number; // absoluto no show
  readonly duration: number;
  readonly layers: readonly JoiLayer[];
}

// ─── Constraints ──────────────────────────────────────────────────────
export interface JoiSafetyZone {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
}

export interface JoiConstraints {
  readonly maxConcurrentPyro: number;
  readonly maxDroneSpeed: number; // m/s
  readonly minDistanceBetweenDrones: number; // m
  readonly safetyZones: readonly JoiSafetyZone[];
}

// ─── Root ─────────────────────────────────────────────────────────────
export interface JoiShowGraphV2 {
  readonly metadata: JoiMetadataV2;
  readonly duration: number;
  readonly stages: readonly JoiStage[];
  readonly constraints?: JoiConstraints;
}

// ─── Validation ───────────────────────────────────────────────────────
export interface JoiValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
}

// ─── Constructor (deep freeze) ────────────────────────────────────────
function freezeLayer(layer: JoiLayer): JoiLayer {
  if (layer.type === 'drone') {
    return Object.freeze({
      ...layer,
      system: Object.freeze({ ...layer.system }),
      movements: Object.freeze(
        layer.movements.map((m) =>
          Object.freeze({
            ...m,
            position: Object.freeze({ ...m.position }),
            orientation: m.orientation ? Object.freeze({ ...m.orientation }) : undefined,
          }),
        ),
      ),
    });
  }
  if (layer.type === 'dmx') {
    return Object.freeze({
      ...layer,
      fixtures: Object.freeze(layer.fixtures.map((f) => Object.freeze({ ...f }))),
      cues: Object.freeze(
        layer.cues.map((c) =>
          Object.freeze({
            ...c,
            color: c.color ? Object.freeze({ ...c.color }) : undefined,
          }),
        ),
      ),
    });
  }
  // pyro
  return Object.freeze({
    ...layer,
    devices: Object.freeze(layer.devices.map((d) => Object.freeze({ ...d }))),
    events: Object.freeze(layer.events.map((e) => Object.freeze({ ...e }))),
  });
}

export function createShowGraphV2(input: {
  metadata: Omit<JoiMetadataV2, 'createdAt' | 'source' | 'version'> & { createdAt?: number };
  duration: number;
  stages: JoiStage[];
  constraints?: JoiConstraints;
}): JoiShowGraphV2 {
  const metadata: JoiMetadataV2 = Object.freeze({
    ...input.metadata,
    createdAt: input.metadata.createdAt ?? Date.now(),
    source: 'joi' as const,
    version: 'v2' as const,
  });

  const stages = Object.freeze(
    [...input.stages]
      .sort((a, b) => a.startTime - b.startTime)
      .map((s) =>
        Object.freeze({
          ...s,
          layers: Object.freeze(s.layers.map(freezeLayer)),
        }),
      ),
  );

  return Object.freeze({
    metadata,
    duration: input.duration,
    stages,
    constraints: input.constraints ? Object.freeze({
      ...input.constraints,
      safetyZones: Object.freeze(input.constraints.safetyZones.map((z) => Object.freeze({ ...z }))),
    }) : undefined,
  });
}

// ─── Structural + constraint validation (pure, pre-compile) ───────────
export function validateShowGraphV2(graph: JoiShowGraphV2): JoiValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!graph.metadata.id) errors.push('missing metadata.id');
  if (graph.duration <= 0) errors.push('duration must be > 0');
  if (graph.stages.length === 0) errors.push('no stages');

  const stageIds = new Set<string>();
  for (const stage of graph.stages) {
    if (stageIds.has(stage.id)) errors.push(`duplicate stage id: ${stage.id}`);
    stageIds.add(stage.id);

    if (stage.startTime < 0) errors.push(`stage ${stage.id} startTime < 0`);
    if (stage.duration <= 0) errors.push(`stage ${stage.id} duration <= 0`);
    if (stage.startTime + stage.duration > graph.duration + 0.001) {
      errors.push(`stage ${stage.id} exceeds graph duration`);
    }

    for (const layer of stage.layers) {
      if (layer.type === 'drone') {
        if (layer.system.count <= 0) errors.push(`drone layer in ${stage.id}: count <= 0`);
        for (const m of layer.movements) {
          if (m.at < 0 || m.at > stage.duration + 0.001) {
            errors.push(`drone move at=${m.at} outside stage ${stage.id}`);
          }
          if (graph.constraints && m.speed !== undefined && m.speed > graph.constraints.maxDroneSpeed) {
            warnings.push(`drone speed ${m.speed} > maxDroneSpeed in ${stage.id}`);
          }
        }
      } else if (layer.type === 'dmx') {
        for (const c of layer.cues) {
          if (c.at < 0 || c.at > stage.duration + 0.001) {
            errors.push(`dmx cue at=${c.at} outside stage ${stage.id}`);
          }
          if (c.intensity !== undefined && (c.intensity < 0 || c.intensity > 100)) {
            errors.push(`dmx intensity out of range in ${stage.id}`);
          }
        }
      } else {
        // pyro
        const deviceIds = new Set(layer.devices.map((d) => d.id));
        for (const e of layer.events) {
          if (!deviceIds.has(e.deviceId)) {
            errors.push(`pyro event references unknown device ${e.deviceId} in ${stage.id}`);
          }
          if (e.at < 0 || e.at > stage.duration + 0.001) {
            errors.push(`pyro event at=${e.at} outside stage ${stage.id}`);
          }
        }
        // Concurrent pyro check (constraint-aware)
        if (graph.constraints) {
          const window = 0.1;
          for (let i = 0; i < layer.events.length; i++) {
            const t = layer.events[i].at;
            const concurrent = layer.events.filter((e) => Math.abs(e.at - t) < window).length;
            if (concurrent > graph.constraints.maxConcurrentPyro) {
              warnings.push(`pyro burst at ${t}s in ${stage.id}: ${concurrent} > maxConcurrentPyro`);
              break;
            }
          }
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors: Object.freeze(errors),
    warnings: Object.freeze(warnings),
  };
}
