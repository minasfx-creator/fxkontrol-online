/**
 * CometEffect — PyroJam 2026 grade comet with:
 * - GPU point cloud spark trail (120 particles, zero-GC)
 * - Ribbon trail with wider profile and core glow
 * - Smoke wake secondary cloud
 * - Combustion-flickering head with colored halo
 * - Ignition flare at launch
 */

import { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { getMortarVelocity, GRAVITY } from '@/lib/pyroPhysics';
import { getThreeBlending } from '@/lib/niagaraBlenderRules';
import { combustionFlicker, hash01, thermalColorRamp } from '@/lib/pyroNoise';
import { RibbonTrail } from '@/render_ultra/fireworks/ribbonTrailRenderer';
import { useProjectStore } from '@/store/useProjectStore';

const SPARK_COUNT = 120;
const SMOKE_WAKE_COUNT = 50;

export default function CometEffect({
  position,
  color,
  progress,
  direction = 'up',
  caliber = 3,
  angleOffset = 0,
}: {
  position: [number, number, number];
  color: string;
  progress: number;
  direction?: 'up' | 'down';
  caliber?: number;
  angleOffset?: number;
}) {
  const { scene, camera } = useThree();
  const glowRef = useRef<THREE.Mesh>(null);
  const haloRef = useRef<THREE.Mesh>(null);
  const sparkPointsRef = useRef<THREE.Points>(null);
  const smokePointsRef = useRef<THREE.Points>(null);
  const baseColor = useMemo(() => new THREE.Color(color), [color]);
  const v0 = useMemo(() => getMortarVelocity(caliber), [caliber]);

  // Ribbon trail
  const ribbonRef = useRef<RibbonTrail | null>(null);

  useEffect(() => {
    const ribbon = new RibbonTrail({
      maxPoints: 96,
      lifetime: 2.2,
      baseWidth: (0.3 + caliber * 0.15) * 1.5,
      blendMode: 'additive',
      widthCurve: [
        { t: 0, value: 1.0 },
        { t: 0.15, value: 0.85 },
        { t: 0.5, value: 0.5 },
        { t: 0.8, value: 0.2 },
        { t: 1, value: 0 },
      ],
    });
    scene.add(ribbon.mesh);
    ribbonRef.current = ribbon;

    return () => {
      scene.remove(ribbon.mesh);
      ribbon.dispose();
      ribbonRef.current = null;
    };
  }, [scene, caliber]);

  // Wobble path
  const wobbleSeeds = useMemo(() => ({
    freqX: 8 + Math.random() * 6,
    freqZ: 7 + Math.random() * 5,
    ampX: 0.08 + Math.random() * 0.15,
    ampZ: 0.06 + Math.random() * 0.12,
    phaseX: Math.random() * Math.PI * 2,
    phaseZ: Math.random() * Math.PI * 2,
  }), []);

  // GPU spark seeds (pre-allocated, zero-GC)
  const sparkSeeds = useMemo(() => {
    const seeds = new Float32Array(SPARK_COUNT * 6); // detachT, spreadAngle, drag, sizeBase, seed, turbAmp
    for (let i = 0; i < SPARK_COUNT; i++) {
      const angle = Math.random() * Math.PI * 2;
      seeds[i * 6] = 0.03 + Math.random() * 0.8; // detachT
      seeds[i * 6 + 1] = angle; // spread angle
      seeds[i * 6 + 2] = 0.90 + Math.random() * 0.08; // drag
      seeds[i * 6 + 3] = 0.04 + hash01(i * 3.7) * 0.10; // size variation (0.04–0.14)
      seeds[i * 6 + 4] = Math.random() * 999 + i; // seed
      seeds[i * 6 + 5] = 0.02 + Math.random() * 0.04; // turbulence amplitude
    }
    return seeds;
  }, []);

  // Spark GPU buffers
  const sparkPosBuffer = useMemo(() => new Float32Array(SPARK_COUNT * 3), []);
  const sparkColBuffer = useMemo(() => new Float32Array(SPARK_COUNT * 3), []);
  const sparkSizeBuffer = useMemo(() => new Float32Array(SPARK_COUNT), []);

  // Smoke wake seeds
  const smokeWakeSeeds = useMemo(() => {
    const s = new Float32Array(SMOKE_WAKE_COUNT * 3); // spawnProgress, seed, turbAmp
    for (let i = 0; i < SMOKE_WAKE_COUNT; i++) {
      s[i * 3] = (i / SMOKE_WAKE_COUNT) * 0.9 + 0.03;
      s[i * 3 + 1] = Math.random() * 999 + i;
      s[i * 3 + 2] = 0.04 + Math.random() * 0.08; // per-particle turbulence amplitude
    }
    return s;
  }, []);

  const smokePosBuffer = useMemo(() => new Float32Array(SMOKE_WAKE_COUNT * 3), []);
  const smokeColBuffer = useMemo(() => new Float32Array(SMOKE_WAKE_COUNT * 3), []);

  const lastProgressRef = useRef(0);

  // Compute head position (shared logic)
  const getHeadPos = (prog: number) => {
    const dir = direction === 'up' ? 1 : -1;
    const maxT = v0 / Math.abs(GRAVITY) * 1.5;
    const t = prog * maxT * 0.5;
    const headY = dir * Math.max(0, v0 * t * 0.25 + 0.5 * GRAVITY * t * t * 0.06);
    const headX = Math.sin(prog * wobbleSeeds.freqX + wobbleSeeds.phaseX) * wobbleSeeds.ampX;
    const headZ = Math.cos(prog * wobbleSeeds.freqZ + wobbleSeeds.phaseZ) * wobbleSeeds.ampZ;
    return { headX, headY, headZ, maxT };
  };

  useFrame((_, delta) => {
    const { headX, headY, headZ, maxT } = getHeadPos(progress);
    const time = performance.now() / 1000;

    // Wind
    const { wind } = useProjectStore.getState();
    const windRad = (wind.direction * Math.PI) / 180;
    const windX = wind.enabled ? Math.sin(windRad) * wind.speed * 0.06 : 0;
    const windZ = wind.enabled ? Math.cos(windRad) * wind.speed * 0.06 : 0;

    // ── Ribbon trail ──
    if (ribbonRef.current && progress > 0.01 && progress < 0.95) {
      const worldPos = new THREE.Vector3(
        position[0] + headX,
        position[1] + headY,
        position[2] + headZ
      );

      const headHeat = Math.max(0, 1 - progress * 0.5);
      // Inner core glow: brighter white-hot at center
      const coreBoost = 1.0 + headHeat * 0.8;
      const ribbonColor = new THREE.Color(
        THREE.MathUtils.lerp(baseColor.r, 1.0, headHeat * 0.6) * coreBoost,
        THREE.MathUtils.lerp(baseColor.g, 0.95, headHeat * 0.5) * coreBoost,
        THREE.MathUtils.lerp(baseColor.b, 0.7, headHeat * 0.35) * coreBoost,
      );

      ribbonRef.current.addPoint(worldPos, ribbonColor, headHeat);
      const camPos = camera instanceof THREE.PerspectiveCamera ? camera.position : undefined;
      ribbonRef.current.update(delta, camPos);
    }

    // ── Combustion head glow ──
    if (glowRef.current) {
      glowRef.current.position.set(headX, headY, headZ);
      const combFlicker = combustionFlicker(42.7, time, 1.3);
      const pulse = combFlicker;
      glowRef.current.scale.setScalar((0.2 + (1 - progress) * 0.4) * pulse);
    }

    // ── Colored halo ──
    if (haloRef.current) {
      haloRef.current.position.set(headX, headY, headZ);
      haloRef.current.scale.setScalar((0.5 + (1 - progress) * 0.6));
    }

    // ── GPU spark cloud ──
    if (sparkPointsRef.current) {
      const posArr = sparkPosBuffer;
      const colArr = sparkColBuffer;
      const sizeArr = sparkSizeBuffer;

      for (let i = 0; i < SPARK_COUNT; i++) {
        const detachT = sparkSeeds[i * 6];
        const spreadAngle = sparkSeeds[i * 6 + 1];
        const drag = sparkSeeds[i * 6 + 2];
        const sizeBase = sparkSeeds[i * 6 + 3];
        const seed = sparkSeeds[i * 6 + 4];

        if (progress < detachT) {
          posArr[i * 3] = 0;
          posArr[i * 3 + 1] = -1000;
          posArr[i * 3 + 2] = 0;
          colArr[i * 3] = colArr[i * 3 + 1] = colArr[i * 3 + 2] = 0;
          sizeArr[i] = 0;
          continue;
        }

        const elapsed = (progress - detachT) * 2.8;
        const dragFactor = Math.pow(drag, elapsed * 60);

        const detachPos = getHeadPos(detachT);
        const spreadSpeed = 0.3 + hash01(seed) * 1.2;

        const sparkX = detachPos.headX + Math.cos(spreadAngle) * spreadSpeed * elapsed * dragFactor + windX * elapsed * elapsed * 0.3;
        const sparkY = detachPos.headY + GRAVITY * elapsed * elapsed * 0.4;
        const sparkZ = detachPos.headZ + Math.sin(spreadAngle) * spreadSpeed * elapsed * dragFactor + windZ * elapsed * elapsed * 0.3;

        if (sparkY < -0.5) {
          posArr[i * 3 + 1] = -1000;
          colArr[i * 3] = colArr[i * 3 + 1] = colArr[i * 3 + 2] = 0;
          sizeArr[i] = 0;
          continue;
        }

        posArr[i * 3] = sparkX;
        posArr[i * 3 + 1] = sparkY;
        posArr[i * 3 + 2] = sparkZ;

        // Thermal color ramp: orange → red → charcoal
        const sparkLife = Math.min(1, elapsed * 1.0);
        const thermal = thermalColorRamp(1.0, 0.5, 0.1, sparkLife * 0.7 + 0.15, 1.0);
        const sparkFade = Math.max(0, 1 - sparkLife);

        colArr[i * 3] = thermal.r * sparkFade;
        colArr[i * 3 + 1] = thermal.g * sparkFade;
        colArr[i * 3 + 2] = thermal.b * sparkFade;
        
        // Per-particle size
        sizeArr[i] = sizeBase * (1 - sparkLife * 0.5);
      }

      const sparkGeo = sparkPointsRef.current.geometry;
      sparkGeo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
      sparkGeo.setAttribute('color', new THREE.BufferAttribute(colArr, 3));
      sparkGeo.setAttribute('size', new THREE.BufferAttribute(sizeArr, 1));
      sparkGeo.attributes.position.needsUpdate = true;
      sparkGeo.attributes.color.needsUpdate = true;
      sparkGeo.attributes.size.needsUpdate = true;
    }

    // ── Smoke wake ──
    if (smokePointsRef.current && progress > 0.05) {
      const sPos = smokePosBuffer;
      const sCol = smokeColBuffer;

      for (let i = 0; i < SMOKE_WAKE_COUNT; i++) {
        const spawnProg = smokeWakeSeeds[i * 3];
        const seed = smokeWakeSeeds[i * 3 + 1];
        const turbAmp = smokeWakeSeeds[i * 3 + 2];

        if (progress < spawnProg) {
          sPos[i * 3 + 1] = -1000;
          sCol[i * 3] = sCol[i * 3 + 1] = sCol[i * 3 + 2] = 0;
          continue;
        }

        const smokeAge = (progress - spawnProg) * 3;
        if (smokeAge > 1.5) {
          sPos[i * 3 + 1] = -1000;
          sCol[i * 3] = sCol[i * 3 + 1] = sCol[i * 3 + 2] = 0;
          continue;
        }

        const spawnPos = getHeadPos(spawnProg);
        const turbX = Math.sin(time * 0.2 + seed * 3.7) * turbAmp;
        const turbZ = Math.cos(time * 0.15 + seed * 5.1) * turbAmp * 0.8;

        sPos[i * 3] = spawnPos.headX + turbX + windX * smokeAge * 0.5;
        sPos[i * 3 + 1] = spawnPos.headY + smokeAge * 0.15;
        sPos[i * 3 + 2] = spawnPos.headZ + turbZ + windZ * smokeAge * 0.5;

        const smokeFade = Math.max(0, 1 - smokeAge / 1.5) * 0.09;
        sCol[i * 3] = 0.3 * smokeFade;
        sCol[i * 3 + 1] = 0.25 * smokeFade;
        sCol[i * 3 + 2] = 0.2 * smokeFade;
      }

      const smokeGeo = smokePointsRef.current.geometry;
      smokeGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
      smokeGeo.setAttribute('color', new THREE.BufferAttribute(sCol, 3));
      smokeGeo.attributes.position.needsUpdate = true;
      smokeGeo.attributes.color.needsUpdate = true;
    }

    lastProgressRef.current = progress;
  });

  const headFade = Math.max(0, 1 - progress * 0.5);
  const { headX, headY, headZ } = getHeadPos(progress);
  const screenBlend = useMemo(() => getThreeBlending('screen'), []);
  const angleOffsetRad = (angleOffset * Math.PI) / 180;

  return (
    <group position={position} rotation={[0, 0, angleOffsetRad]}>
      {/* Ignition flare — aggressive first 3% */}
      {progress < 0.03 && (
        <mesh position={[0, 0.1, 0]}>
          <sphereGeometry args={[0.4 + progress * 60, 12, 12]} />
          <meshBasicMaterial
            color="#FFEECC"
            transparent
            opacity={0.8 * (1 - progress / 0.03)}
            blending={screenBlend.blending}
            blendEquation={screenBlend.blendEquation}
            blendSrc={screenBlend.blendSrc as any}
            blendDst={screenBlend.blendDst as any}
            depthWrite={false}
          />
        </mesh>
      )}

      {/* GPU spark cloud */}
      <points ref={sparkPointsRef} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[new Float32Array(SPARK_COUNT * 3), 3]} />
          <bufferAttribute attach="attributes-color" args={[new Float32Array(SPARK_COUNT * 3), 3]} />
        </bufferGeometry>
        <pointsMaterial
          size={0.08 + caliber * 0.02}
          vertexColors
          transparent
          opacity={0.85}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          sizeAttenuation
        />
      </points>

      {/* Smoke wake cloud */}
      <points ref={smokePointsRef} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[new Float32Array(SMOKE_WAKE_COUNT * 3), 3]} />
          <bufferAttribute attach="attributes-color" args={[new Float32Array(SMOKE_WAKE_COUNT * 3), 3]} />
        </bufferGeometry>
        <pointsMaterial
          size={1.2 + caliber * 0.3}
          vertexColors
          transparent
          opacity={0.06}
          depthWrite={false}
          sizeAttenuation
        />
      </points>

      {/* Combustion head glow — flickering white core */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[0.25, 12, 12]} />
        <meshBasicMaterial
          color="#FFFFDD"
          transparent
          opacity={0.8 * headFade}
          blending={screenBlend.blending}
          blendEquation={screenBlend.blendEquation}
          blendSrc={screenBlend.blendSrc as any}
          blendDst={screenBlend.blendDst as any}
          depthWrite={false}
        />
      </mesh>

      {/* Colored halo ring around head */}
      {headFade > 0.15 && (
        <mesh ref={haloRef} position={[headX, headY, headZ]}>
          <sphereGeometry args={[0.55, 10, 10]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.12 * headFade}
            blending={screenBlend.blending}
            blendEquation={screenBlend.blendEquation}
            blendSrc={screenBlend.blendSrc as any}
            blendDst={screenBlend.blendDst as any}
            depthWrite={false}
          />
        </mesh>
      )}
    </group>
  );
}
