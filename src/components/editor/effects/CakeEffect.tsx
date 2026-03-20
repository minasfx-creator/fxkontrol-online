import { useMemo } from 'react';
import * as THREE from 'three';
import { getBreakHeight, getMortarVelocity, GRAVITY, getStarLifetime } from '@/lib/pyroPhysics';
import { getThreeBlending } from '@/lib/niagaraBlenderRules';

const PARTICLES_PER_SHOT = 55;

// ═══════════════════════════════════════════════════════════════════════
// Finale 3D Firing Pattern System
// ═══════════════════════════════════════════════════════════════════════

/** All Finale firing pattern keywords mapped to tube angles and firing order */
type FiringPatternKey = 
  | 'str' | 'stl' | 'stt'  // Up sequences
  | 'alr' | 'all' | 'alt'  // Angled left sequences
  | 'arr' | 'arl' | 'art'  // Angled right sequences
  | 'fnr' | 'fnl' | 'fnt'  // Fan sequences
  | 'blr' | 'bll' | 'blt'  // Bookend left
  | 'brr' | 'brl' | 'brt'  // Bookend right
  | 'cto' | 'otc'          // Center-to-outside
  | 'tri' | 'trx' | 'trs'  // W-shape
  | 'vst' | 'vss'          // V-shape
  // Body pattern keywords
  | 'z-shape' | 'x-shape' | 'w-shape' | 'v-shape' | 'c-shape'
  | 'fan' | 'bookend' | 'wipe' | 'angle' | 'regular';

function getPatternAngles(pattern: FiringPatternKey | string, count: number, rowIdx: number = 0): number[] {
  const maxAngle = Math.PI / 4; // 45 degrees max spread
  const angles: number[] = [];
  const p = pattern.toLowerCase() as FiringPatternKey;

  switch (p) {
    // ── Straight Up ──
    case 'str': case 'stl': case 'stt': case 'regular':
      for (let i = 0; i < count; i++) angles.push(0);
      break;

    // ── Angled Left (all tubes angled left) ──
    case 'alr': case 'all': case 'alt':
      for (let i = 0; i < count; i++) angles.push(-maxAngle * 0.7);
      break;

    // ── Angled Right ──
    case 'arr': case 'arl': case 'art': case 'angle':
      for (let i = 0; i < count; i++) angles.push(maxAngle * 0.7);
      break;

    // ── Fan ──
    case 'fnr': case 'fnl': case 'fnt': case 'fan':
      for (let i = 0; i < count; i++) {
        const t = count > 1 ? i / (count - 1) : 0.5;
        angles.push((t - 0.5) * maxAngle * 2);
      }
      break;

    // ── Bookend Left (left half angled, right half straight) ──
    case 'blr': case 'bll': case 'blt': case 'bookend':
      for (let i = 0; i < count; i++) {
        const t = count > 1 ? i / (count - 1) : 0.5;
        angles.push(t < 0.5 ? (t - 0.5) * maxAngle * 2 : 0);
      }
      break;

    // ── Bookend Right ──
    case 'brr': case 'brl': case 'brt':
      for (let i = 0; i < count; i++) {
        const t = count > 1 ? i / (count - 1) : 0.5;
        angles.push(t >= 0.5 ? (t - 0.5) * maxAngle * 2 : 0);
      }
      break;

    // ── Center-to-Outside ──
    case 'cto':
      for (let i = 0; i < count; i++) {
        const t = count > 1 ? i / (count - 1) : 0.5;
        angles.push((t - 0.5) * maxAngle * 2);
      }
      break;

    // ── Outside-to-Center ──
    case 'otc':
      for (let i = 0; i < count; i++) {
        const t = count > 1 ? i / (count - 1) : 0.5;
        angles.push((0.5 - t) * maxAngle * 2);
      }
      break;

    // ── W-Shape (3 groups) ──
    case 'tri': case 'trx': case 'trs': case 'w-shape': {
      const third = Math.floor(count / 3);
      for (let i = 0; i < count; i++) {
        if (i < third) {
          const t = third > 1 ? i / (third - 1) : 0.5;
          angles.push((t - 0.5) * maxAngle * -1.5);
        } else if (i < third * 2) {
          const t = third > 1 ? (i - third) / (third - 1) : 0.5;
          angles.push(0);
        } else {
          const t = (count - third * 2) > 1 ? (i - third * 2) / (count - third * 2 - 1) : 0.5;
          angles.push((t - 0.5) * maxAngle * 1.5);
        }
      }
      break;
    }

    // ── V-Shape ──
    case 'vst': case 'vss': case 'v-shape': {
      const half = Math.floor(count / 2);
      for (let i = 0; i < count; i++) {
        if (i < half) {
          const t = half > 0 ? i / half : 0;
          angles.push(-maxAngle * (1 - t));
        } else {
          const t = (count - half) > 0 ? (i - half) / (count - half) : 0;
          angles.push(maxAngle * t);
        }
      }
      break;
    }

    // ── Z-Shape (alternating FNR and FNL per row) ──
    case 'z-shape':
      for (let i = 0; i < count; i++) {
        const t = count > 1 ? i / (count - 1) : 0.5;
        const dir = rowIdx % 2 === 0 ? 1 : -1;
        angles.push((t - 0.5) * maxAngle * 2 * dir);
      }
      break;

    // ── X-Shape (alternating CTO and OTC) ──
    case 'x-shape':
      for (let i = 0; i < count; i++) {
        const t = count > 1 ? i / (count - 1) : 0.5;
        const dir = rowIdx % 2 === 0 ? 1 : -1;
        angles.push((t - 0.5) * maxAngle * 2 * dir);
      }
      break;

    // ── C-Shape (all rows CTO) ──
    case 'c-shape':
      for (let i = 0; i < count; i++) {
        const t = count > 1 ? i / (count - 1) : 0.5;
        angles.push((t - 0.5) * maxAngle * 2);
      }
      break;

    // ── Wipe (all rows FNR) ──
    case 'wipe':
      for (let i = 0; i < count; i++) {
        const t = count > 1 ? i / (count - 1) : 0.5;
        angles.push((t - 0.5) * maxAngle * 2);
      }
      break;

    default:
      for (let i = 0; i < count; i++) angles.push(0);
  }

  return angles;
}

/** Get firing order indices based on pattern */
function getFiringOrder(pattern: FiringPatternKey | string, count: number): number[] {
  const p = pattern.toLowerCase();
  const indices = Array.from({ length: count }, (_, i) => i);

  switch (p) {
    case 'stl': case 'all': case 'fnl': case 'bll': case 'brl':
      return indices.reverse();
    case 'stt': case 'alt': case 'art': case 'fnt': case 'blt': case 'brt': case 'fan':
      return indices; // all at once (handled by delay=0)
    case 'cto': case 'c-shape': {
      const mid = Math.floor(count / 2);
      const result: number[] = [mid];
      for (let d = 1; d <= mid; d++) {
        if (mid - d >= 0) result.push(mid - d);
        if (mid + d < count) result.push(mid + d);
      }
      return result;
    }
    case 'otc': {
      const result: number[] = [];
      let lo = 0, hi = count - 1;
      while (lo <= hi) {
        result.push(lo++);
        if (lo <= hi) result.push(hi--);
      }
      return result;
    }
    default:
      return indices;
  }
}

function isAllAtOnce(pattern: string): boolean {
  const p = pattern.toLowerCase();
  return ['stt', 'alt', 'art', 'fnt', 'blt', 'brt', 'vst', 'fan'].includes(p);
}

// ═══════════════════════════════════════════════════════════════════════
// CakeShot Component
// ═══════════════════════════════════════════════════════════════════════

function CakeShot({
  offset,
  color,
  progress,
  seed,
  angle,
  caliber,
}: {
  offset: [number, number, number];
  color: string;
  progress: number;
  seed: number;
  angle: number;
  caliber: number;
}) {
  const breakH = useMemo(() => getBreakHeight(caliber), [caliber]);
  const v0 = useMemo(() => getMortarVelocity(caliber), [caliber]);
  const starLife = useMemo(() => getStarLifetime(caliber), [caliber]);

  const { velocities, lifetimes } = useMemo(() => {
    const v = new Float32Array(PARTICLES_PER_SHOT * 3);
    const l = new Float32Array(PARTICLES_PER_SHOT);
    const rng = (i: number) => Math.sin(seed * 9999 + i * 7919) * 0.5 + 0.5;
    const breakSpeed = 5 + caliber * 2.5;
    for (let i = 0; i < PARTICLES_PER_SHOT; i++) {
      const theta = rng(i * 2) * Math.PI * 2;
      const phi = Math.acos(2 * rng(i * 2 + 1) - 1);
      const speed = breakSpeed * (0.6 + rng(i * 3) * 0.4);
      v[i * 3] = Math.sin(phi) * Math.cos(theta) * speed;
      v[i * 3 + 1] = Math.sin(phi) * Math.sin(theta) * speed * 0.85 + 1.5;
      v[i * 3 + 2] = Math.cos(phi) * speed;
      l[i] = starLife * (0.6 + rng(i * 4) * 0.4);
    }
    return { velocities: v, lifetimes: l };
  }, [seed, caliber, starLife]);

  const baseColor = useMemo(() => new THREE.Color(color), [color]);

  if (progress <= 0 || progress > 1) return null;

  const liftFraction = 0.25;
  const isLifting = progress < liftFraction;

  if (isLifting) {
    const liftProgress = progress / liftFraction;
    const realY = Math.max(0, liftProgress * breakH * 0.7);
    const screenBlend = getThreeBlending('screen');
    // Trajectory follows angle
    const lateralX = Math.sin(angle) * liftProgress * breakH * 0.7;
    return (
      <group position={offset}>
        <mesh position={[lateralX, realY, Math.cos(angle) * liftProgress * 0.3]}>
          <sphereGeometry args={[0.06 + caliber * 0.01, 6, 6]} />
          <meshBasicMaterial color="#FFFFCC" transparent opacity={0.9} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
        {Array.from({ length: 8 }).map((_, j) => {
          const trailY = realY * (1 - j * 0.1);
          const fade = Math.pow(1 - j / 8, 1.8);
          return (
            <mesh key={j} position={[lateralX * (1 - j * 0.05), trailY, 0]}>
              <sphereGeometry args={[0.03 + caliber * 0.005, 4, 4]} />
              <meshBasicMaterial color="#FFCC66" transparent opacity={0.4 * fade} blending={screenBlend.blending} blendEquation={screenBlend.blendEquation} blendSrc={screenBlend.blendSrc as any} blendDst={screenBlend.blendDst as any} depthWrite={false} />
            </mesh>
          );
        })}
        {progress < 0.04 && (
          <mesh position={[0, 0.15, 0]}>
            <sphereGeometry args={[0.3 + caliber * 0.08, 8, 8]} />
            <meshBasicMaterial color="#FFEEAA" transparent opacity={0.5 * (1 - progress / 0.04)} blending={screenBlend.blending} blendEquation={screenBlend.blendEquation} blendSrc={screenBlend.blendSrc as any} blendDst={screenBlend.blendDst as any} depthWrite={false} />
          </mesh>
        )}
      </group>
    );
  }

  const burstProgress = (progress - liftFraction) / (1 - liftFraction);
  const t = burstProgress * starLife;
  const positions = new Float32Array(PARTICLES_PER_SHOT * 3);
  const colors = new Float32Array(PARTICLES_PER_SHOT * 3);
  const drag = 0.03 + caliber * 0.005;
  // Burst center position accounts for angle
  const burstCenterX = Math.sin(angle) * breakH * 0.7;

  for (let i = 0; i < PARTICLES_PER_SHOT; i++) {
    const vx = velocities[i * 3], vy = velocities[i * 3 + 1], vz = velocities[i * 3 + 2];
    const life = lifetimes[i];
    const age = burstProgress / life;
    const fade = Math.max(0, 1 - age);
    const dragFactor = Math.exp(-drag * t);

    positions[i * 3] = burstCenterX + vx * t * 0.35 * dragFactor;
    positions[i * 3 + 1] = breakH * 0.7 + vy * t * 0.35 * dragFactor + 0.5 * GRAVITY * t * t * 0.12;
    positions[i * 3 + 2] = vz * t * 0.35 * dragFactor;

    const flashPhase = Math.max(0, 1 - burstProgress * 8);
    const sparkle = 0.75 + Math.sin(i * 13 + burstProgress * 25) * 0.25;
    colors[i * 3] = THREE.MathUtils.lerp(baseColor.r, 1.0, flashPhase) * fade * sparkle;
    colors[i * 3 + 1] = THREE.MathUtils.lerp(baseColor.g, 0.95, flashPhase) * fade * sparkle;
    colors[i * 3 + 2] = THREE.MathUtils.lerp(baseColor.b, 0.7, flashPhase) * fade * sparkle;
  }

  return (
    <group position={offset}>
      {burstProgress < 0.08 && (() => {
        const sb = getThreeBlending('screen');
        return (
          <mesh position={[burstCenterX, breakH * 0.7, 0]}>
            <sphereGeometry args={[0.8 + caliber * 0.3, 12, 12]} />
            <meshBasicMaterial color="#FFFFEE" transparent opacity={0.4 * (1 - burstProgress / 0.08)} blending={sb.blending} blendEquation={sb.blendEquation} blendSrc={sb.blendSrc as any} blendDst={sb.blendDst as any} depthWrite={false} />
          </mesh>
        );
      })()}
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
          <bufferAttribute attach="attributes-color" args={[colors, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.12 + caliber * 0.02} vertexColors transparent opacity={0.9} depthWrite={false} blending={THREE.AdditiveBlending} sizeAttenuation />
      </points>
    </group>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Main CakeEffect Component
// ═══════════════════════════════════════════════════════════════════════

/**
 * Cake / Battery Effect: Multi-shot device with Finale 3D firing patterns.
 * Supports all 25 Finale firing pattern keywords + body patterns.
 */
export default function CakeEffect({
  position,
  color,
  progress,
  shotCount = 16,
  pattern = 'regular',
  caliber = 2,
  cakeRows,
  angleOffset = 0,
}: {
  position: [number, number, number];
  color: string;
  progress: number;
  shotCount?: number;
  pattern?: string;
  caliber?: number;
  cakeRows?: number;
  angleOffset?: number;
}) {
  const shots = useMemo(() => {
    const rows = cakeRows || (shotCount <= 12 ? 1 : Math.max(1, Math.round(Math.sqrt(shotCount))));
    const tubesPerRow = Math.ceil(shotCount / rows);
    const angleOffsetRad = (angleOffset * Math.PI) / 180;
    const s: { delay: number; angle: number; seed: number; offset: [number, number, number] }[] = [];

    let shotIdx = 0;
    for (let row = 0; row < rows; row++) {
      const tubesThisRow = Math.min(tubesPerRow, shotCount - shotIdx);
      const patternAngles = getPatternAngles(pattern, tubesThisRow, row);
      const firingOrder = getFiringOrder(pattern, tubesThisRow);
      const allAtOnce = isAllAtOnce(pattern);

      for (let t = 0; t < tubesThisRow; t++) {
        const orderIdx = firingOrder.indexOf(t);
        const globalIdx = shotIdx + t;
        const baseDelay = (row / rows) * 0.7; // row delay
        const tubeDelay = allAtOnce ? 0 : (orderIdx / Math.max(1, tubesThisRow - 1)) * (0.85 / rows);
        const totalDelay = baseDelay + tubeDelay;

        const angle = patternAngles[t] + angleOffsetRad;
        const ox = Math.sin(angle) * 0.15;
        const oz = Math.cos(angle) * 0.05;

        s.push({
          delay: Math.min(0.95, totalDelay),
          angle,
          seed: globalIdx + 1,
          offset: [ox, 0, oz] as [number, number, number],
        });
      }
      shotIdx += tubesThisRow;
    }

    return s;
  }, [shotCount, pattern, cakeRows, angleOffset]);

  return (
    <group position={position}>
      {shots.map((shot, i) => {
        const shotDuration = 1 / shotCount * 2.5;
        const shotProgress = (progress - shot.delay) / shotDuration;
        return (
          <CakeShot
            key={i}
            offset={shot.offset}
            color={color}
            progress={Math.max(0, Math.min(1, shotProgress))}
            seed={shot.seed}
            angle={shot.angle}
            caliber={caliber}
          />
        );
      })}
    </group>
  );
}
