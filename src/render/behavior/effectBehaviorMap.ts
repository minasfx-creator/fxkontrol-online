/**
 * Effect Behavior Map — vetor + cinemática canônica por família.
 *
 * Fonte única de verdade pra como cada efeito DEVE se comportar:
 *  - como o vetor de lançamento é resolvido (PTS, fan, parent, omni)
 *  - cinemática pós-eject (gravidade, drag, velocidade, spread)
 *  - tail/trail
 *  - decaimento de cor
 *
 * Pure data, sem Three.js. Consumido pelo helper resolveEffectVector e
 * pelos renderers (CometEffect, MineEffect, SaluteEffect, ShellBurstRenderer
 * branch falling-leaves) atrás do flag r_behavior_map_v1.
 *
 * Ancorado em:
 *  - finalePanTiltSpin.ts (PTS canônico Finale 3D)
 *  - mineSilhouettes.ts (Mine_01/02/03 fan FWsim)
 *  - fwsimGraphicsConfig.json (perTypeStars + flashes)
 *  - vdlFiringPatterns.ts (STR/STL/FN*/etc)
 *  - Piroex/Skyking ballistics (industrial dataset)
 */

export type BehaviorKind =
  | 'comet'
  | 'mine'
  | 'shell-peony'
  | 'shell-dahlia'
  | 'shell-chrysanthemum'
  | 'shell-willow'
  | 'shell-palm'
  | 'shell-crossette'
  | 'shell-ring'
  | 'shell-salute'
  | 'falling-leaves'
  | 'bombette'
  | 'roman-candle'
  | 'cake-bombette'
  | 'gerb'
  | 'whistle'
  | 'farfalle'
  | 'tourbillon'
  | 'bengal'
  | 'lancework'
  | 'setpiece';

export type LaunchMode = 'pts' | 'pattern-fan' | 'parent-vector' | 'omni';
export type SpreadBias = 'uniform' | 'gaussian' | 'silhouette';
export type TailType =
  | 'none'
  | 'glitter'
  | 'glitter-strobe'
  | 'willow-drag'
  | 'comet-thick';
export type ColorPhaseModel = 'newton' | 'planckian' | 'flat';

export interface EffectBehavior {
  kind: BehaviorKind;
  launch: {
    mode: LaunchMode;
    /** jitter angular extra aplicado ao vetor resolvido (graus). */
    jitterDeg: number;
  };
  motion: {
    /** m/s². 9.81 padrão; ~4.5 falling-leaves (drag-dominated). */
    gravity: number;
    /** coeficiente de drag em exp(-k·dt). */
    drag: number;
    /** velocidade inicial [min, max] em m/s. */
    initialSpeed: [number, number];
    spread: {
      /** ângulo do cone de espalhamento, em graus. */
      coneDeg: number;
      bias: SpreadBias;
    };
    /** opcional: swirl rotacional (falling leaves, willow). */
    swirl?: { axis: 'y' | 'tangent'; rpm: number };
    /** opcional: split tipo bouquet/crossette/pistil. */
    bouquetSplit?: { atLifeRatio: number; childCount: number };
  };
  tail: {
    type: TailType;
    /** multiplicador de comprimento (1.0 = padrão). */
    lengthMul: number;
  };
  decay: {
    /** multiplicador do tempo de vida vs baseline 1.0. */
    lifeMul: number;
    colorPhase: ColorPhaseModel;
  };
}

/**
 * Tabela canônica. Mantida pequena e revisável: cada linha tem justificativa
 * documentada (FWsim/Finale/Piroex). NÃO usar Math.random aqui — é pure data.
 */
export const EFFECT_BEHAVIOR_MAP: Record<BehaviorKind, EffectBehavior> = {
  // ── Comet: PTS-driven, tail grosso, gravidade real, sem swirl. ──
  comet: {
    kind: 'comet',
    launch: { mode: 'pts', jitterDeg: 1.5 },
    motion: {
      gravity: 9.81,
      drag: 0.18,
      initialSpeed: [35, 55], // 3" caliber range
      spread: { coneDeg: 4, bias: 'gaussian' },
    },
    tail: { type: 'comet-thick', lengthMul: 1.4 },
    decay: { lifeMul: 1.0, colorPhase: 'planckian' },
  },

  // ── Mine: ground fan, silhouette-driven (Mine_01/02/03 = 5/7/9 jets). ──
  mine: {
    kind: 'mine',
    launch: { mode: 'pattern-fan', jitterDeg: 2.5 },
    motion: {
      gravity: 9.81,
      drag: 0.22,
      initialSpeed: [28, 42],
      spread: { coneDeg: 70, bias: 'silhouette' },
    },
    tail: { type: 'glitter', lengthMul: 0.6 },
    decay: { lifeMul: 0.85, colorPhase: 'newton' },
  },

  // ── Shells: omni-burst pós-detonação, gravidade real. ──
  'shell-peony': {
    kind: 'shell-peony',
    launch: { mode: 'omni', jitterDeg: 0 },
    motion: {
      gravity: 9.81,
      drag: 0.32,
      initialSpeed: [40, 60],
      spread: { coneDeg: 360, bias: 'uniform' },
    },
    tail: { type: 'none', lengthMul: 0 },
    decay: { lifeMul: 1.0, colorPhase: 'newton' },
  },
  'shell-dahlia': {
    kind: 'shell-dahlia',
    launch: { mode: 'omni', jitterDeg: 0 },
    motion: {
      gravity: 9.81,
      drag: 0.18, // menos drag → estrelas vão mais longe
      initialSpeed: [55, 75],
      spread: { coneDeg: 360, bias: 'uniform' },
    },
    tail: { type: 'glitter', lengthMul: 0.4 },
    decay: { lifeMul: 1.2, colorPhase: 'newton' },
  },
  'shell-chrysanthemum': {
    kind: 'shell-chrysanthemum',
    launch: { mode: 'omni', jitterDeg: 0 },
    motion: {
      gravity: 9.81,
      drag: 0.28,
      initialSpeed: [42, 60],
      spread: { coneDeg: 360, bias: 'uniform' },
    },
    tail: { type: 'glitter', lengthMul: 1.1 },
    decay: { lifeMul: 1.3, colorPhase: 'newton' },
  },
  // Willow: longas trilhas que caem, baixa gravidade efetiva (drag alto).
  'shell-willow': {
    kind: 'shell-willow',
    launch: { mode: 'omni', jitterDeg: 0 },
    motion: {
      gravity: 9.81,
      drag: 0.55,
      initialSpeed: [22, 32],
      spread: { coneDeg: 280, bias: 'gaussian' },
      swirl: { axis: 'tangent', rpm: 8 },
    },
    tail: { type: 'willow-drag', lengthMul: 2.4 },
    decay: { lifeMul: 2.2, colorPhase: 'planckian' },
  },
  'shell-palm': {
    kind: 'shell-palm',
    launch: { mode: 'omni', jitterDeg: 0 },
    motion: {
      gravity: 9.81,
      drag: 0.42,
      initialSpeed: [30, 45],
      spread: { coneDeg: 180, bias: 'gaussian' }, // hemisfério superior
    },
    tail: { type: 'willow-drag', lengthMul: 1.8 },
    decay: { lifeMul: 1.6, colorPhase: 'planckian' },
  },
  'shell-crossette': {
    kind: 'shell-crossette',
    launch: { mode: 'omni', jitterDeg: 0 },
    motion: {
      gravity: 9.81,
      drag: 0.25,
      initialSpeed: [38, 52],
      spread: { coneDeg: 360, bias: 'uniform' },
      bouquetSplit: { atLifeRatio: 0.45, childCount: 4 },
    },
    tail: { type: 'glitter-strobe', lengthMul: 0.5 },
    decay: { lifeMul: 1.0, colorPhase: 'newton' },
  },
  'shell-ring': {
    kind: 'shell-ring',
    launch: { mode: 'omni', jitterDeg: 0 },
    motion: {
      gravity: 9.81,
      drag: 0.20,
      initialSpeed: [48, 58],
      spread: { coneDeg: 4, bias: 'silhouette' }, // anel planar fino
    },
    tail: { type: 'none', lengthMul: 0 },
    decay: { lifeMul: 1.1, colorPhase: 'newton' },
  },
  // Salute: flash branco-azul, expansão muito curta, hard-stop.
  'shell-salute': {
    kind: 'shell-salute',
    launch: { mode: 'omni', jitterDeg: 0 },
    motion: {
      gravity: 9.81,
      drag: 0.85, // freia quase imediato
      initialSpeed: [120, 150], // explosão violenta
      spread: { coneDeg: 360, bias: 'silhouette' },
    },
    tail: { type: 'none', lengthMul: 0 },
    decay: { lifeMul: 0.25, colorPhase: 'flat' },
  },

  // ── Falling leaves: drag alto, swirl tangencial, gravidade reduzida. ──
  'falling-leaves': {
    kind: 'falling-leaves',
    launch: { mode: 'omni', jitterDeg: 0 },
    motion: {
      gravity: 4.5,
      drag: 0.65,
      initialSpeed: [8, 14],
      spread: { coneDeg: 360, bias: 'uniform' },
      swirl: { axis: 'tangent', rpm: 22 },
    },
    tail: { type: 'willow-drag', lengthMul: 1.6 },
    decay: { lifeMul: 2.6, colorPhase: 'planckian' },
  },

  // ── Bombette / Roman Candle / Cake-bombette: PTS-launched. ──
  bombette: {
    kind: 'bombette',
    launch: { mode: 'pts', jitterDeg: 3 },
    motion: {
      gravity: 9.81,
      drag: 0.20,
      initialSpeed: [30, 45],
      spread: { coneDeg: 6, bias: 'gaussian' },
    },
    tail: { type: 'glitter', lengthMul: 0.7 },
    decay: { lifeMul: 0.9, colorPhase: 'newton' },
  },
  'roman-candle': {
    kind: 'roman-candle',
    launch: { mode: 'parent-vector', jitterDeg: 1 },
    motion: {
      gravity: 9.81,
      drag: 0.22,
      initialSpeed: [32, 48],
      spread: { coneDeg: 5, bias: 'gaussian' },
    },
    tail: { type: 'comet-thick', lengthMul: 1.1 },
    decay: { lifeMul: 1.0, colorPhase: 'planckian' },
  },
  'cake-bombette': {
    kind: 'cake-bombette',
    launch: { mode: 'pts', jitterDeg: 4 }, // fan tipico em cakes
    motion: {
      gravity: 9.81,
      drag: 0.20,
      initialSpeed: [28, 42],
      spread: { coneDeg: 6, bias: 'gaussian' },
    },
    tail: { type: 'glitter', lengthMul: 0.6 },
    decay: { lifeMul: 0.9, colorPhase: 'newton' },
  },

  // ── Ground / sustained ──
  gerb: {
    kind: 'gerb',
    launch: { mode: 'parent-vector', jitterDeg: 1 },
    motion: {
      gravity: 9.81,
      drag: 0.40,
      initialSpeed: [12, 18],
      spread: { coneDeg: 12, bias: 'gaussian' },
    },
    tail: { type: 'glitter', lengthMul: 0.5 },
    decay: { lifeMul: 1.0, colorPhase: 'newton' },
  },
  whistle: {
    kind: 'whistle',
    launch: { mode: 'pts', jitterDeg: 8 }, // trajetória errática
    motion: {
      gravity: 9.81,
      drag: 0.30,
      initialSpeed: [18, 28],
      spread: { coneDeg: 30, bias: 'gaussian' },
      swirl: { axis: 'y', rpm: 180 },
    },
    tail: { type: 'glitter', lengthMul: 0.9 },
    decay: { lifeMul: 1.2, colorPhase: 'planckian' },
  },
  farfalle: {
    kind: 'farfalle',
    launch: { mode: 'omni', jitterDeg: 0 },
    motion: {
      gravity: 6.5, // drag-borboleta
      drag: 0.55,
      initialSpeed: [10, 18],
      spread: { coneDeg: 200, bias: 'gaussian' },
      swirl: { axis: 'tangent', rpm: 90 },
    },
    tail: { type: 'glitter-strobe', lengthMul: 0.4 },
    decay: { lifeMul: 1.8, colorPhase: 'planckian' },
  },
  tourbillon: {
    kind: 'tourbillon',
    launch: { mode: 'parent-vector', jitterDeg: 2 },
    motion: {
      gravity: 9.81,
      drag: 0.35,
      initialSpeed: [16, 24],
      spread: { coneDeg: 8, bias: 'gaussian' },
      swirl: { axis: 'y', rpm: 720 },
    },
    tail: { type: 'glitter', lengthMul: 0.8 },
    decay: { lifeMul: 1.4, colorPhase: 'planckian' },
  },
  bengal: {
    kind: 'bengal',
    launch: { mode: 'parent-vector', jitterDeg: 0 },
    motion: {
      gravity: 9.81,
      drag: 0.80, // sustained jet
      initialSpeed: [2, 4],
      spread: { coneDeg: 6, bias: 'gaussian' },
    },
    tail: { type: 'glitter', lengthMul: 0.3 },
    decay: { lifeMul: 5.0, colorPhase: 'flat' },
  },
  lancework: {
    kind: 'lancework',
    launch: { mode: 'parent-vector', jitterDeg: 0 },
    motion: {
      gravity: 0,
      drag: 1.0, // estático
      initialSpeed: [0, 0],
      spread: { coneDeg: 0, bias: 'silhouette' },
    },
    tail: { type: 'none', lengthMul: 0 },
    decay: { lifeMul: 4.0, colorPhase: 'flat' },
  },
  setpiece: {
    kind: 'setpiece',
    launch: { mode: 'parent-vector', jitterDeg: 0 },
    motion: {
      gravity: 0,
      drag: 1.0,
      initialSpeed: [0, 0],
      spread: { coneDeg: 0, bias: 'silhouette' },
    },
    tail: { type: 'none', lengthMul: 0 },
    decay: { lifeMul: 6.0, colorPhase: 'flat' },
  },
};

/** Lookup tolerante (case-insensitive). */
export function getBehavior(kind: BehaviorKind | string): EffectBehavior | null {
  const k = String(kind).toLowerCase() as BehaviorKind;
  return EFFECT_BEHAVIOR_MAP[k] ?? null;
}

/** Lista de todas as kinds cobertas, p/ testes paramétricos. */
export const ALL_BEHAVIOR_KINDS: BehaviorKind[] = Object.keys(
  EFFECT_BEHAVIOR_MAP
) as BehaviorKind[];
