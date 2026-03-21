/**
 * CometEffect — Niagara-grade comet with ribbon trail
 * Uses RibbonTrail from ribbonTrailRenderer for the comet tail,
 * and NiagaraSystem for spark/drip particles with cone spawn shape.
 */

import { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { getMortarVelocity, GRAVITY } from '@/lib/pyroPhysics';
import { getThreeBlending } from '@/lib/niagaraBlenderRules';
import { RibbonTrail } from '@/render_ultra/fireworks/ribbonTrailRenderer';

/**
 * Comet effect with Niagara ribbon trail and physics-based trajectory.
 */
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
  const baseColor = useMemo(() => new THREE.Color(color), [color]);
  const v0 = useMemo(() => getMortarVelocity(caliber), [caliber]);

  // Niagara ribbon trail for the comet tail
  const ribbonRef = useRef<RibbonTrail | null>(null);

  useEffect(() => {
    const ribbon = new RibbonTrail({
      maxPoints: 64,
      lifetime: 1.8,
      baseWidth: 0.3 + caliber * 0.15,
      blendMode: 'additive',
      widthCurve: [
        { t: 0, value: 1.0 },
        { t: 0.3, value: 0.7 },
        { t: 0.7, value: 0.3 },
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

  // Wobble path for lateral movement
  const wobbleSeeds = useMemo(() => ({
    freqX: 8 + Math.random() * 6,
    freqZ: 7 + Math.random() * 5,
    ampX: 0.08 + Math.random() * 0.15,
    ampZ: 0.06 + Math.random() * 0.12,
    phaseX: Math.random() * Math.PI * 2,
    phaseZ: Math.random() * Math.PI * 2,
  }), []);

  // Spark seeds for detaching sparks
  const sparkSeeds = useMemo(() => {
    const s: { spreadX: number; spreadZ: number; detachT: number; drag: number; size: number }[] = [];
    for (let i = 0; i < 30; i++) {
      const angle = Math.random() * Math.PI * 2;
      s.push({
        spreadX: Math.cos(angle) * (0.3 + Math.random() * 1.2),
        spreadZ: Math.sin(angle) * (0.3 + Math.random() * 1.2),
        detachT: 0.05 + Math.random() * 0.75,
        drag: 0.92 + Math.random() * 0.06,
        size: 0.015 + Math.random() * 0.025,
      });
    }
    return s;
  }, []);

  const lastProgressRef = useRef(0);

  useFrame((_, delta) => {
    const dir = direction === 'up' ? 1 : -1;
    const maxT = v0 / Math.abs(GRAVITY) * 1.5;
    const t = progress * maxT * 0.5;

    const headY = dir * Math.max(0, v0 * t * 0.25 + 0.5 * GRAVITY * t * t * 0.06);
    const headX = Math.sin(progress * wobbleSeeds.freqX + wobbleSeeds.phaseX) * wobbleSeeds.ampX;
    const headZ = Math.cos(progress * wobbleSeeds.freqZ + wobbleSeeds.phaseZ) * wobbleSeeds.ampZ;

    // Add point to ribbon trail every frame
    if (ribbonRef.current && progress > 0.01 && progress < 0.95) {
      const worldPos = new THREE.Vector3(
        position[0] + headX,
        position[1] + headY,
        position[2] + headZ
      );

      // Color: white-hot at head → base color → ember
      const headHeat = Math.max(0, 1 - progress * 0.5);
      const ribbonColor = new THREE.Color(
        THREE.MathUtils.lerp(baseColor.r, 1.0, headHeat * 0.5),
        THREE.MathUtils.lerp(baseColor.g, 0.95, headHeat * 0.4),
        THREE.MathUtils.lerp(baseColor.b, 0.7, headHeat * 0.3),
      );

      ribbonRef.current.addPoint(worldPos, ribbonColor, headHeat);
      const camPos = camera instanceof THREE.PerspectiveCamera ? camera.position : undefined;
      ribbonRef.current.update(delta, camPos);
    }

    // Update glow head
    if (glowRef.current) {
      glowRef.current.position.set(headX, headY, headZ);
      const pulse = 1 + Math.sin(progress * 40) * 0.15;
      glowRef.current.scale.setScalar((0.2 + (1 - progress) * 0.35) * pulse);
    }

    lastProgressRef.current = progress;
  });

  const headFade = Math.max(0, 1 - progress * 0.5);
  const dir = direction === 'up' ? 1 : -1;
  const maxT = v0 / Math.abs(GRAVITY) * 1.5;
  const t = progress * maxT * 0.5;
  const headY = dir * Math.max(0, v0 * t * 0.25 + 0.5 * GRAVITY * t * t * 0.06);
  const headX = Math.sin(progress * wobbleSeeds.freqX + wobbleSeeds.phaseX) * wobbleSeeds.ampX;
  const headZ = Math.cos(progress * wobbleSeeds.freqZ + wobbleSeeds.phaseZ) * wobbleSeeds.ampZ;
  const screenBlend = useMemo(() => getThreeBlending('screen'), []);
  const angleOffsetRad = (angleOffset * Math.PI) / 180;

  const getSparkDetachY = (detachT: number) => {
    const sparkBaseT = detachT * maxT * 0.5;
    return dir * Math.max(0, v0 * sparkBaseT * 0.25 + 0.5 * GRAVITY * sparkBaseT * sparkBaseT * 0.06);
  };

  return (
    <group position={position} rotation={[0, 0, angleOffsetRad]}>
      {/* Muzzle flash */}
      {progress < 0.05 && (
        <mesh position={[0, 0.1, 0]}>
          <sphereGeometry args={[0.25 + progress * 6, 8, 8]} />
          <meshBasicMaterial
            color="#FFEEAA"
            transparent
            opacity={0.6 * (1 - progress / 0.05)}
            blending={screenBlend.blending}
            blendEquation={screenBlend.blendEquation}
            blendSrc={screenBlend.blendSrc as any}
            blendDst={screenBlend.blendDst as any}
            depthWrite={false}
          />
        </mesh>
      )}

      {/* Detaching sparks */}
      {sparkSeeds.map((spark, i) => {
        if (progress < spark.detachT) return null;
        const elapsed = (progress - spark.detachT) * 2.5;
        const dragFactor = Math.pow(spark.drag, elapsed * 60);
        const baseY = getSparkDetachY(spark.detachT);
        const sparkY = baseY + GRAVITY * elapsed * elapsed * 0.4;
        if (sparkY < -0.5) return null;
        const sparkFade = Math.max(0, 1 - elapsed * 1.2);
        const lateralX = spark.spreadX * elapsed * dragFactor;
        const lateralZ = spark.spreadZ * elapsed * dragFactor;
        const emberT = Math.min(1, elapsed * 2);
        const sr = THREE.MathUtils.lerp(1.0, 0.8, emberT);
        const sg = THREE.MathUtils.lerp(0.75, 0.25, emberT);
        const sb = THREE.MathUtils.lerp(0.2, 0.05, emberT);

        return (
          <mesh key={`s${i}`} position={[lateralX, sparkY, lateralZ]}>
            <sphereGeometry args={[spark.size, 4, 4]} />
            <meshBasicMaterial
              color={new THREE.Color(sr, sg, sb)}
              transparent
              opacity={0.7 * sparkFade}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
        );
      })}

      {/* Head glow */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[0.25, 12, 12]} />
        <meshBasicMaterial
          color="#FFFFDD"
          transparent
          opacity={0.75 * headFade}
          blending={screenBlend.blending}
          blendEquation={screenBlend.blendEquation}
          blendSrc={screenBlend.blendSrc as any}
          blendDst={screenBlend.blendDst as any}
          depthWrite={false}
        />
      </mesh>

      {/* Secondary halo */}
      {headFade > 0.2 && (
        <mesh position={[headX, headY, headZ]}>
          <sphereGeometry args={[0.5, 8, 8]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.15 * headFade}
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
