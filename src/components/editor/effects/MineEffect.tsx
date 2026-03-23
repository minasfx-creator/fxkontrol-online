import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { attackReleaseEnvelope, temporalFlicker, combustionFlicker, hash01, thermalColorRamp } from '@/lib/pyroNoise';
import { getThreeBlending } from '@/lib/niagaraBlenderRules';
import { useProjectStore } from '@/store/useProjectStore';
import { readDensityAt, injectDensity, injectVelocity, type FluidGrid } from '@/render_ultra/fireworks/niagaraFluids';
import { getChemistryForRendering, autoMatchFormulation } from '@/render_ultra/fireworks/particleChemistry';

/**
 * Mine Effect — Multi-phase ground burst (PyroJam 2026 reference)
 * Phase 1: Column jet (narrow 5-15° cone, white-hot, fast)
 * Phase 2: Spray stars (wide 30-80° hemisphere, colored, jittered lifetime)
 * Phase 3: Drip sparks (low velocity, fall back, charcoal/titanium)
 * + Ground smoke plume expanding radially
 */

// Particle class boundaries (index ranges)
const COLUMN_FRAC = 0.20;
const SPRAY_FRAC = 0.65; // 20-85%
const DRIP_FRAC = 0.15;  // 85-100%

const SMOKE_COUNT = 40;

export default function MineEffect({
  position,
  color,
  progress,
  caliber = 3,
  angleOffset = 0,
  heightMeters,
  formulationId,
}: {
  position: [number, number, number];
  color: string;
  progress: number;
  caliber?: number;
  angleOffset?: number;
  heightMeters?: number;
  formulationId?: string;
}) {
  const count = useMemo(() => Math.min(600, Math.round(200 + caliber * caliber * 14)), [caliber]);
  const pointsRef = useRef<THREE.Points>(null);
  const smokePointsRef = useRef<THREE.Points>(null);
  const posRef = useMemo(() => new Float32Array(count * 3), [count]);
  const colRef = useMemo(() => new Float32Array(count * 3), [count]);
  const sizeRef = useMemo(() => new Float32Array(count), [count]);
  const injectedRef = useRef(false);

  // Smoke buffers (zero-GC)
  const smokePosRef = useMemo(() => new Float32Array(SMOKE_COUNT * 3), []);
  const smokeColRef = useMemo(() => new Float32Array(SMOKE_COUNT * 3), []);
  const smokeSizeRef = useMemo(() => new Float32Array(SMOKE_COUNT), []);

  // Chemistry-enhanced color: use formulation if available, else auto-match by color+type
  const chemistry = useMemo(() => {
    const fId = formulationId || autoMatchFormulation(color, 'mine', caliber);
    return fId ? getChemistryForRendering(fId) : null;
  }, [formulationId, color, caliber]);

  const baseColor = useMemo(() => {
    if (chemistry?.resultColor) return chemistry.resultColor.clone();
    return new THREE.Color(color);
  }, [color, chemistry]);
  const emberColor = useMemo(() => new THREE.Color().setHSL(0.05, 0.8, 0.12), []);
  const charcoalColor = useMemo(() => new THREE.Color(0.15, 0.08, 0.03), []);

  // Particle class indices
  const columnEnd = useMemo(() => Math.floor(count * COLUMN_FRAC), [count]);
  const sprayEnd = useMemo(() => Math.floor(count * (COLUMN_FRAC + SPRAY_FRAC)), [count]);

  const { velocities, lifetimes, sparkleSeeds, particleSizes, smokeSeeds } = useMemo(() => {
    const v = new Float32Array(count * 3);
    const l = new Float32Array(count);
    const s = new Float32Array(count);
    const ps = new Float32Array(count);
    const ss = new Float32Array(SMOKE_COUNT);

    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;

      if (i < Math.floor(count * COLUMN_FRAC)) {
        // Column particles: narrow cone (5-15°), high velocity
        const upAngle = 0.05 + Math.random() * 0.17; // ~3-10° from vertical
        const speed = (15 + Math.random() * 22 + caliber * 5) * 1.5;
        v[i * 3] = Math.cos(theta) * Math.sin(upAngle) * speed;
        v[i * 3 + 1] = Math.cos(upAngle) * speed + 3;
        v[i * 3 + 2] = Math.sin(theta) * Math.sin(upAngle) * speed;
        l[i] = 0.3 + Math.random() * 0.3; // short lifetime
        ps[i] = 0.6; // smaller size
      } else if (i < Math.floor(count * (COLUMN_FRAC + SPRAY_FRAC))) {
        // Spray particles: wide hemisphere (30-80°), jittered lifetime
        const upAngle = 0.35 + Math.random() * 0.85;
        const speed = 10 + Math.random() * 18 + caliber * 4;
        v[i * 3] = Math.cos(theta) * Math.sin(upAngle) * speed;
        v[i * 3 + 1] = Math.cos(upAngle) * speed + 2;
        v[i * 3 + 2] = Math.sin(theta) * Math.sin(upAngle) * speed;
        l[i] = (0.4 + Math.random() * 1.0) * (0.6 + Math.random() * 0.8); // ±40% jitter
        ps[i] = 0.8 + Math.random() * 1.0; // 0.8-1.8x variation
      } else {
        // Drip particles: low velocity, high drag, fall back
        const upAngle = 0.1 + Math.random() * 0.5;
        const speed = 3 + Math.random() * 3; // 3-6 m/s
        v[i * 3] = Math.cos(theta) * Math.sin(upAngle) * speed;
        v[i * 3 + 1] = Math.cos(upAngle) * speed + 1;
        v[i * 3 + 2] = Math.sin(theta) * Math.sin(upAngle) * speed;
        l[i] = 0.8 + Math.random() * 1.5; // persist longer
        ps[i] = 1.2; // ember glow size
      }

      s[i] = Math.random() * 999 + i;
    }

    // Smoke seeds
    for (let i = 0; i < SMOKE_COUNT; i++) {
      ss[i] = Math.random() * 999 + i;
    }

    return { velocities: v, lifetimes: l, sparkleSeeds: s, particleSizes: ps, smokeSeeds: ss };
  }, [count, caliber, columnEnd, sprayEnd]);

  // Smoke initial velocities (radial expansion)
  const smokeVelocities = useMemo(() => {
    const sv = new Float32Array(SMOKE_COUNT * 3);
    for (let i = 0; i < SMOKE_COUNT; i++) {
      const theta = Math.random() * Math.PI * 2;
      const speed = 0.5 + Math.random() * 1.5;
      sv[i * 3] = Math.cos(theta) * speed;
      sv[i * 3 + 1] = 0.1 + Math.random() * 0.3;
      sv[i * 3 + 2] = Math.sin(theta) * speed;
    }
    return sv;
  }, []);

  useFrame(({ clock }) => {
    if (!pointsRef.current) return;

    const geo = pointsRef.current.geometry;
    const posArr = posRef;
    const colArr = colRef;
    const sizeArr = sizeRef;
    const t = progress * 2.5;
    const GRAV = -9.81;
    const time = clock.getElapsedTime();
    const envelope = attackReleaseEnvelope(progress, 0.02, 0.85, 2.5);

    // Wind integration
    const { wind } = useProjectStore.getState();
    const windRad = (wind.direction * Math.PI) / 180;
    const windX = wind.enabled ? Math.sin(windRad) * wind.speed * 0.08 : 0;
    const windZ = wind.enabled ? Math.cos(windRad) * wind.speed * 0.08 : 0;

    // Inject density into fluid grid on burst (once)
    const fluidGrid = (window as any).__niagaraFluidGrid as FluidGrid | undefined;
    if (fluidGrid && progress > 0.01 && progress < 0.1 && !injectedRef.current) {
      injectDensity(fluidGrid, position[0], position[2], 3.0 * caliber, caliber * 2);
      injectVelocity(fluidGrid, position[0], position[2], 0, -2, caliber * 2);
      injectedRef.current = true;
    }
    if (progress <= 0) injectedRef.current = false;

    const fluidDensity = fluidGrid ? readDensityAt(fluidGrid, position[0], position[2]) : 0;
    const smokeBoost = 1 + fluidDensity * 0.3;

    const basePointSize = 0.22 + caliber * 0.05;

    for (let i = 0; i < count; i++) {
      const vx = velocities[i * 3];
      const vy = velocities[i * 3 + 1];
      const vz = velocities[i * 3 + 2];
      const lt = lifetimes[i];
      const age = progress / lt;
      const fade = Math.max(0, 1 - age);
      const fadeSq = fade * fade;

      const isColumn = i < columnEnd;
      const isDrip = i >= sprayEnd;

      // Column: visible in first 15% of progress; spray/drip have staggered entry
      if (isColumn && progress > 0.15) {
        // Column particles fade fast after initial jet
        const columnFade = Math.max(0, 1 - (progress - 0.05) / 0.15);
        if (columnFade <= 0) {
          colArr[i * 3] = 0;
          colArr[i * 3 + 1] = 0;
          colArr[i * 3 + 2] = 0;
          sizeArr[i] = 0;
          continue;
        }
      }

      // Drips have higher drag
      const dragCoeff = isDrip ? 0.08 : (isColumn ? 0.02 : 0.04);
      const dragH = Math.exp(-dragCoeff * t);
      const dragV = Math.exp(-(dragCoeff * 0.75) * t);

      const rawY = vy * t * dragV + 0.5 * GRAV * t * t;
      const bounced = rawY < 0;
      const restitution = isDrip ? 0.05 : 0.2;

      posArr[i * 3] = vx * t * dragH + windX * t * t * 0.5;
      posArr[i * 3 + 1] = bounced ? Math.abs(rawY) * restitution : rawY;
      posArr[i * 3 + 2] = vz * t * dragH + windZ * t * t * 0.5;

      // Combustion flicker for column particles, temporal for spray/drips
      const twinkle = isColumn
        ? combustionFlicker(sparkleSeeds[i], time, 1.2)
        : temporalFlicker(sparkleSeeds[i], time, 0.6, 0.34, 0.36);

      const flashIntensity = Math.max(0, 1 - progress * 15);
      const emberPhase = Math.max(0, (progress - 0.35) / 0.65);

      let r: number, g: number, b: number;

      if (isColumn) {
        // Column: white-hot → base using thermal ramp (very early life)
        const colLife = Math.min(1, progress * 8);
        const thermal = thermalColorRamp(baseColor.r, baseColor.g, baseColor.b, colLife * 0.3, 2.0);
        r = thermal.r;
        g = thermal.g;
        b = thermal.b;
      } else if (isDrip) {
        // Drip: thermal ramp with ember bias
        const dripLife = Math.min(1, age * 1.5);
        const thermal = thermalColorRamp(0.9, 0.35, 0.08, dripLife * 0.6 + 0.4, 0.8);
        r = thermal.r;
        g = thermal.g;
        b = thermal.b;
      } else {
        // Spray: standard thermal color ramp
        const sprayLife = Math.min(1, age * 0.8);
        const thermal = thermalColorRamp(baseColor.r, baseColor.g, baseColor.b, sprayLife, 1.5);
        r = thermal.r;
        g = thermal.g;
        b = thermal.b;
      }

      const hdrBoost = isColumn ? (1.5 + flashIntensity * 3.0) : (1.0 + flashIntensity * 2.0);
      colArr[i * 3] = r * fadeSq * twinkle * hdrBoost * envelope * smokeBoost;
      colArr[i * 3 + 1] = g * fadeSq * twinkle * hdrBoost * envelope * smokeBoost;
      colArr[i * 3 + 2] = b * fadeSq * twinkle * hdrBoost * envelope * smokeBoost;

      // Per-particle size
      sizeArr[i] = basePointSize * particleSizes[i];
    }

    const posAttr = geo.getAttribute('position') as THREE.BufferAttribute;
    const colAttr = geo.getAttribute('color') as THREE.BufferAttribute;
    const szAttr = geo.getAttribute('size') as THREE.BufferAttribute;
    if (posAttr) posAttr.needsUpdate = true;
    if (colAttr) colAttr.needsUpdate = true;
    if (szAttr) szAttr.needsUpdate = true;

    // ── Ground smoke plume ──
    if (smokePointsRef.current && progress > 0.03 && progress < 0.7) {
      const smokePosArr = smokePosRef.current;
      const smokeColArr = smokeColRef.current;
      const smokeSizeArr = smokeSizeRef.current;
      const smokeAge = (progress - 0.03) / 0.67;

      for (let i = 0; i < SMOKE_COUNT; i++) {
        const svx = smokeVelocities[i * 3];
        const svy = smokeVelocities[i * 3 + 1];
        const svz = smokeVelocities[i * 3 + 2];
        const seed = smokeSeeds[i];

        // Turbulence drift
        const turbX = Math.sin(time * 0.3 + seed * 7.1) * 0.15;
        const turbZ = Math.cos(time * 0.25 + seed * 5.3) * 0.12;

        const st = smokeAge * 3;
        smokePosArr[i * 3] = svx * st + turbX + windX * st * st * 0.3;
        smokePosArr[i * 3 + 1] = svy * st * 0.5;
        smokePosArr[i * 3 + 2] = svz * st + turbZ + windZ * st * st * 0.3;

        // Warm gray smoke, fading with age
        const smokeFade = Math.max(0, 1 - smokeAge * 1.2) * 0.06;
        smokeColArr[i * 3] = 0.35 * smokeFade;
        smokeColArr[i * 3 + 1] = 0.3 * smokeFade;
        smokeColArr[i * 3 + 2] = 0.25 * smokeFade;

        // Expanding size
        smokeSizeArr[i] = (1.5 + hash01(seed) * 2.5) * (1 + smokeAge * 2);
      }

      const smokeGeo = smokePointsRef.current.geometry;
      smokeGeo.setAttribute('position', new THREE.BufferAttribute(smokePosArr, 3));
      smokeGeo.setAttribute('color', new THREE.BufferAttribute(smokeColArr, 3));
      smokeGeo.attributes.position.needsUpdate = true;
      smokeGeo.attributes.color.needsUpdate = true;
    }
  });

  const screenBlend = useMemo(() => getThreeBlending('screen'), []);
  const angleOffsetRad = (angleOffset * Math.PI) / 180;

  // Combustion-modulated muzzle flash
  const muzzleFlashOpacity = useMemo(() => 0.7, []);

  // Per-particle size shader
  const sizeVertexShader = `
    attribute float size;
    attribute vec3 color;
    varying vec3 vColor;
    void main() {
      vColor = color;
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      gl_PointSize = size * (300.0 / -mvPosition.z);
      gl_PointSize = clamp(gl_PointSize, 1.0, 48.0);
      gl_Position = projectionMatrix * mvPosition;
    }
  `;

  const sizeFragmentShader = `
    varying vec3 vColor;
    void main() {
      float dist = length(gl_PointCoord - vec2(0.5));
      if (dist > 0.5) discard;
      float alpha = smoothstep(0.5, 0.15, dist);
      gl_FragColor = vec4(vColor, alpha * 0.95);
    }
  `;

  return (
    <group position={position} rotation={[0, 0, angleOffsetRad]}>
      {/* Combustion muzzle flash with flicker */}
      {progress < 0.08 && (
        <mesh position={[0, 0.3, 0]}>
          <sphereGeometry args={[1.2 + caliber * 0.5 + progress * 20, 16, 16]} />
          <meshBasicMaterial
            color="#FFFFF0"
            transparent
            opacity={muzzleFlashOpacity * (1 - progress / 0.08)}
            blending={screenBlend.blending}
            blendEquation={screenBlend.blendEquation}
            blendSrc={screenBlend.blendSrc as any}
            blendDst={screenBlend.blendDst as any}
            depthWrite={false}
          />
        </mesh>
      )}

      {/* Ground ring flash */}
      {progress < 0.2 && (
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1, 3 + progress * 30 + caliber * 2, 32]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.12 * (1 - progress / 0.2)}
            blending={screenBlend.blending}
            blendEquation={screenBlend.blendEquation}
            blendSrc={screenBlend.blendSrc as any}
            blendDst={screenBlend.blendDst as any}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {/* Rising smoke cloud */}
      {progress > 0.02 && progress < 0.6 && (
        <mesh position={[0, progress * 4, 0]}>
          <sphereGeometry args={[0.6 + progress * 6, 8, 8]} />
          <meshBasicMaterial color="#887766" transparent opacity={0.06 * (1 - progress / 0.6)} />
        </mesh>
      )}

      {/* Main particles with per-particle size shader */}
      <points ref={pointsRef} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[new Float32Array(count * 3), 3]} />
          <bufferAttribute attach="attributes-color" args={[new Float32Array(count * 3), 3]} />
          <bufferAttribute attach="attributes-size" args={[new Float32Array(count), 1]} />
        </bufferGeometry>
        <shaderMaterial
          vertexShader={sizeVertexShader}
          fragmentShader={sizeFragmentShader}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>

      {/* Ground smoke plume */}
      {progress > 0.03 && progress < 0.7 && (
        <points ref={smokePointsRef} frustumCulled={false}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[new Float32Array(SMOKE_COUNT * 3), 3]} />
            <bufferAttribute attach="attributes-color" args={[new Float32Array(SMOKE_COUNT * 3), 3]} />
          </bufferGeometry>
          <shaderMaterial
            vertexShader={sizeVertexShader.replace('size *', '3.0 *')}
            fragmentShader={`
              varying vec3 vColor;
              void main() {
                float dist = length(gl_PointCoord - vec2(0.5));
                if (dist > 0.5) discard;
                float alpha = smoothstep(0.5, 0.2, dist) * 0.08;
                gl_FragColor = vec4(vColor, alpha);
              }
            `}
            transparent
            depthWrite={false}
          />
        </points>
      )}
    </group>
  );
}
