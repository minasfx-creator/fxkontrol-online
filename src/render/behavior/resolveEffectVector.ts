/**
 * resolveEffectVector — converte (effect PTS + parent heading + behavior) num
 * vetor unit de lançamento, em coords locais (+Y up, audience-facing).
 *
 * Modos:
 *  - 'pts'           : usa pan/tilt/spin canônicos do effect (Finale 3D PTS).
 *  - 'pattern-fan'   : usa angleDeg vindo do firing pattern (mines/cakes).
 *  - 'parent-vector' : herda heading/pitch do parent (gerb, roman candle, cake).
 *  - 'omni'          : retorna +Y (caller faz a distribuição esférica).
 *
 * Pure: data-in/data-out. Nenhum import de Three.js — devolvemos {x,y,z}.
 */

import {
  normalizePan,
  normalizeTilt,
  normalizeSpin,
  type PTS,
} from '@/lib/finalePanTiltSpin';
import type { EffectBehavior } from './effectBehaviorMap';

const DEG = Math.PI / 180;

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface ResolveInput {
  behavior: EffectBehavior;
  /** Pan/Tilt/Spin do effect (graus). Default {0,0,0}. */
  pts?: Partial<PTS>;
  /** Heading do parent (graus, rotação em torno de +Y). Default 0. */
  parentHeadingDeg?: number;
  /** Pitch do parent (graus, 0=horizontal, 90=up). Default 90. */
  parentPitchDeg?: number;
  /** Para 'pattern-fan': ângulo do tubo (graus, 0=up no plano vertical). */
  patternAngleDeg?: number;
  /** Hash determinístico [0,1) usado pra jitter — caller passa pra ficar replayable. */
  jitterSeed?: number;
}

export interface ResolveOutput {
  /** Vetor unit em coords locais. */
  unit: Vec3;
  /** Speed sugerida (média do range em behavior.motion.initialSpeed). */
  suggestedSpeed: number;
  /** Modo efetivamente usado (útil pra debug/teste). */
  modeUsed: EffectBehavior['launch']['mode'];
}

function applyPTS(pan: number, tilt: number): Vec3 {
  // Convenção: identity (pan=0, tilt=0) → +Y up.
  // Tilt rotaciona em torno do eixo +X (rake do moving-head),
  // depois Pan rotaciona em torno de +Y (heading).
  const t = tilt * DEG;
  const p = pan * DEG;
  // Após Rx(tilt) aplicado a +Y: (0, cos(t), sin(t))
  // Após Ry(pan) aplicado: (sin(p)*cos(t), cos(t)... ERROR
  // Correta: Ry(pan) · Rx(tilt) · (0,1,0)
  // Rx(tilt)·(0,1,0) = (0, cos t, sin t)
  // Ry(pan)·(0, cos t, sin t) = (sin p · sin t, cos t, cos p · sin t)
  const x = Math.sin(p) * Math.sin(t);
  const y = Math.cos(t);
  const z = Math.cos(p) * Math.sin(t);
  return { x, y, z };
}

function rotateY(v: Vec3, headingDeg: number): Vec3 {
  if (!headingDeg) return v;
  const a = headingDeg * DEG;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { x: c * v.x + s * v.z, y: v.y, z: -s * v.x + c * v.z };
}

function normalize(v: Vec3): Vec3 {
  const m = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / m, y: v.y / m, z: v.z / m };
}

/** Aplica jitter cônico em torno do vetor (graus). seed em [0,1). */
function jitter(v: Vec3, jitterDeg: number, seed: number): Vec3 {
  if (!jitterDeg) return v;
  // Eixo perpendicular determinístico a partir de seed
  const phi = seed * Math.PI * 2;
  const amp = jitterDeg * DEG * (0.5 + 0.5 * Math.cos(seed * 7.13));
  // Construir frame local: perp1 ortogonal a v
  const refX = Math.abs(v.y) < 0.99 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
  const perp1 = normalize({
    x: refX.y * v.z - refX.z * v.y,
    y: refX.z * v.x - refX.x * v.z,
    z: refX.x * v.y - refX.y * v.x,
  });
  const perp2 = normalize({
    x: v.y * perp1.z - v.z * perp1.y,
    y: v.z * perp1.x - v.x * perp1.z,
    z: v.x * perp1.y - v.y * perp1.x,
  });
  const cosA = Math.cos(amp);
  const sinA = Math.sin(amp);
  const dir = {
    x: cosA * v.x + sinA * (Math.cos(phi) * perp1.x + Math.sin(phi) * perp2.x),
    y: cosA * v.y + sinA * (Math.cos(phi) * perp1.y + Math.sin(phi) * perp2.y),
    z: cosA * v.z + sinA * (Math.cos(phi) * perp1.z + Math.sin(phi) * perp2.z),
  };
  return normalize(dir);
}

export function resolveEffectVector(input: ResolveInput): ResolveOutput {
  const { behavior, pts, parentHeadingDeg = 0, parentPitchDeg = 90 } = input;
  const mode = behavior.launch.mode;
  const seed = typeof input.jitterSeed === 'number'
    ? Math.max(0, Math.min(0.99999, input.jitterSeed))
    : 0.5;

  let unit: Vec3;
  switch (mode) {
    case 'pts': {
      const pan = normalizePan(pts?.pan ?? 0);
      const tilt = normalizeTilt(pts?.tilt ?? 0);
      // spin não afeta vetor (afeta orientação da estrela/asset)
      normalizeSpin(pts?.spin ?? 0);
      unit = applyPTS(pan, tilt);
      unit = rotateY(unit, parentHeadingDeg);
      break;
    }
    case 'pattern-fan': {
      // patternAngleDeg: 0 = up (+Y); ângulos positivos abrem pra +X (palco direita).
      const a = (input.patternAngleDeg ?? 0) * DEG;
      unit = { x: Math.sin(a), y: Math.cos(a), z: 0 };
      unit = rotateY(unit, parentHeadingDeg);
      break;
    }
    case 'parent-vector': {
      // 0° pitch = horizontal +Z, 90° = +Y up.
      const p = parentPitchDeg * DEG;
      unit = { x: 0, y: Math.sin(p), z: Math.cos(p) };
      unit = rotateY(unit, parentHeadingDeg);
      break;
    }
    case 'omni':
    default: {
      unit = { x: 0, y: 1, z: 0 };
      break;
    }
  }

  unit = normalize(unit);
  unit = jitter(unit, behavior.launch.jitterDeg, seed);

  const [vmin, vmax] = behavior.motion.initialSpeed;
  const suggestedSpeed = (vmin + vmax) * 0.5;

  return { unit, suggestedSpeed, modeUsed: mode };
}
