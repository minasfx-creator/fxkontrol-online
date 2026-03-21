/**
 * SmokeTrail — Niagara-grade smoke using composable emitter system
 * Uses NiagaraSystem with sphere spawn, curl noise turbulence,
 * negative gravity for rising smoke, and soft-particle rendering config.
 */

import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { LIFT_SMOKE_CONFIG, getBurstSmokeDensity, type LiftChargeType } from '@/lib/pyroPhysics';
import {
  createEmitter, createSystem, tickSystem,
  type NiagaraSystem,
} from '@/render_ultra/fireworks/niagaraEmitterSystem';

const BASE_SMOKE_COUNT = 80;

function SmokeTrailInner({
  position,
  progress,
  intensity = 1,
  color,
  liftChargeType = 'black_powder',
  caliber = 4,
}: {
  position: [number, number, number];
  progress: number;
  intensity?: number;
  color?: string;
  liftChargeType?: LiftChargeType;
  caliber?: number;
}) {
  const smokeConfig = LIFT_SMOKE_CONFIG[liftChargeType];
  const smokeColor = color || smokeConfig.color;
  const smokeDensityMult = getBurstSmokeDensity(caliber);
  const SMOKE_COUNT = Math.min(120, Math.round(BASE_SMOKE_COUNT * smokeDensityMult));

  const meshRefs = useRef<(THREE.Mesh | null)[]>([]);
  const niagaraRef = useRef<NiagaraSystem | null>(null);

  // Create Niagara smoke system
  useEffect(() => {
    const riseSpeed = smokeConfig.riseSpeed;
    const density = smokeConfig.density;
    const spreadMult = liftChargeType === 'black_powder' ? 1.3 : 0.9;

    const emitter = createEmitter({
      id: `smoke-trail-${Date.now()}`,
      name: 'Lift Smoke',
      maxParticles: SMOKE_COUNT * 2,
      spawn: {
        rate: SMOKE_COUNT * 3,
        burstCount: SMOKE_COUNT,
        burstInterval: 0,
        burstDelay: 0,
      },
      init: {
        lifetime: [2, 5],
        size: [0.6 * density, 1.8 * density],
        velocity: {
          min: new THREE.Vector3(-3.5 * spreadMult * 0.5, riseSpeed * 0.3, -3.5 * spreadMult * 0.5),
          max: new THREE.Vector3(3.5 * spreadMult * 0.5, riseSpeed * 1.5, 3.5 * spreadMult * 0.5),
        },
        color: new THREE.Color(smokeColor),
        spawnShape: { type: 'sphere', radius: 1.5 * spreadMult, surfaceOnly: false },
      },
      update: [{
        drag: 1.8,
        gravityScale: -0.05, // Rising smoke
        curlNoiseStrength: 3,
        curlNoiseScale: 0.03,
        colorOverLife: [
          { t: 0, color: new THREE.Color(smokeColor).multiplyScalar(1.2) },
          { t: 0.5, color: new THREE.Color(smokeColor) },
          { t: 1, color: new THREE.Color(smokeColor).multiplyScalar(0.5) },
        ],
        sizeOverLife: [
          { t: 0, value: 0.5 },
          { t: 0.3, value: 1.0 },
          { t: 1, value: liftChargeType === 'black_powder' ? 2.0 : 1.5 },
        ],
        rotationRate: 0.2,
      }],
      render: {
        mode: 'sprite',
        blendMode: 'normal',
        softParticles: true,
        softRange: 1.5,
      },
    });

    const sys = createSystem({
      id: `smoke-trail-sys-${Date.now()}`,
      name: 'Smoke Trail',
      emitters: [emitter],
      maxParticleBudget: SMOKE_COUNT * 2,
      scalabilityGroup: 'high',
    });
    niagaraRef.current = sys;

    return () => { niagaraRef.current = null; };
  }, [SMOKE_COUNT, liftChargeType, smokeConfig, smokeColor]);

  useFrame(({ clock }, delta) => {
    if (!niagaraRef.current) return;
    const time = clock.getElapsedTime();
    const dt = Math.min(delta, 0.05);
    const sys = niagaraRef.current;

    // Only spawn when progressing
    for (const emitter of sys.emitters) {
      emitter.enabled = progress > 0 && progress < 0.95;
    }

    if (progress > 0) {
      tickSystem(sys, dt);
    }

    // Render Niagara particles to the mesh array (visual compatibility)
    const emitter = sys.emitters[0];
    if (!emitter) return;

    let visIdx = 0;
    for (const p of emitter.particles) {
      if (!p.alive || visIdx >= SMOKE_COUNT) continue;
      const mesh = meshRefs.current[visIdx];
      if (!mesh) { visIdx++; continue; }

      const t = p.age / p.lifetime;
      mesh.visible = true;
      mesh.position.set(p.position.x, p.position.y, p.position.z);
      mesh.scale.setScalar(p.size);

      const mat = mesh.material as THREE.MeshBasicMaterial;
      const fadeIn = Math.min(1, p.age * 8);
      const fadeOutPower = liftChargeType === 'black_powder' ? 1.5 : 2.0;
      const fadeOut = Math.max(0, 1 - Math.pow(t, fadeOutPower));
      const baseOpacity = liftChargeType === 'black_powder' ? 0.08 : 0.05;
      mat.opacity = Math.max(0, baseOpacity * intensity * fadeIn * fadeOut * smokeDensityMult);

      visIdx++;
    }

    // Hide remaining meshes
    for (let i = visIdx; i < SMOKE_COUNT; i++) {
      const mesh = meshRefs.current[i];
      if (mesh) mesh.visible = false;
    }
  });

  if (progress <= 0) return null;

  // Generate puff array for rendering (keeps visual compatibility with R3F declarative meshes)
  const puffs = useMemo(() => Array.from({ length: SMOKE_COUNT }, (_, i) => i), [SMOKE_COUNT]);

  return (
    <group position={position}>
      {puffs.map((_, i) => (
        <mesh
          key={i}
          ref={el => { meshRefs.current[i] = el; }}
          visible={false}
        >
          <sphereGeometry args={[1, 8, 8]} />
          <meshBasicMaterial color={smokeColor} transparent opacity={0} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

export default SmokeTrailInner;
