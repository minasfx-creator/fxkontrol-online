/**
 * GerbEffect — Niagara-grade Gerb/Fountain using composable emitter system
 * Uses NiagaraSystem with cone spawn, collision module, and wind force.
 */

import { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { getThreeBlending } from '@/lib/niagaraBlenderRules';
import { getGerbParticleCount, getParticleSize } from '@/lib/pyroPhysics';
import {
  createEmitter, createSystem, tickSystem, getSystemParticleCount,
  type NiagaraSystem,
} from '@/render_ultra/fireworks/niagaraEmitterSystem';
import { createCollision, createWind } from '@/render_ultra/fireworks/niagaraForceModules';
import { clampNiagaraHDR } from '@/lib/niagaraBlenderRules';

const MAX_GERB_PARTICLES = 700;

export default function GerbEffect({
  position,
  color,
  progress,
  height = 5,
  caliber = 3,
  coldSpark = false,
}: {
  position: [number, number, number];
  color: string;
  progress: number;
  height?: number;
  caliber?: number;
  coldSpark?: boolean;
}) {
  const { scene } = useThree();
  const scaledHeight = height * (0.6 + caliber * 0.15);
  const SCALED_PARTICLE_COUNT = Math.min(MAX_GERB_PARTICLES, getGerbParticleCount(caliber));
  const particleVisualSize = getParticleSize(caliber) * 0.04;
  const baseColor = useMemo(() => new THREE.Color(color), [color]);
  const pointsRef = useRef<THREE.Points>(null);

  // Pre-allocate buffers
  const posArr = useMemo(() => new Float32Array(SCALED_PARTICLE_COUNT * 3), [SCALED_PARTICLE_COUNT]);
  const colArr = useMemo(() => new Float32Array(SCALED_PARTICLE_COUNT * 3), [SCALED_PARTICLE_COUNT]);

  // Create Niagara system for the gerb
  const niagaraSystemRef = useRef<NiagaraSystem | null>(null);

  useEffect(() => {
    const spraySpeed = scaledHeight * 1.5;
    const emitter = createEmitter({
      id: `gerb-main-${Date.now()}`,
      name: 'Gerb Spray',
      maxParticles: SCALED_PARTICLE_COUNT,
      spawn: {
        rate: SCALED_PARTICLE_COUNT * 2,
        burstCount: 0,
        burstInterval: 0,
        burstDelay: 0,
      },
      init: {
        lifetime: [0.4, 1.1],
        size: [0.3, 1.0],
        velocity: {
          min: new THREE.Vector3(-spraySpeed * 0.06, spraySpeed * 0.65, -spraySpeed * 0.06),
          max: new THREE.Vector3(spraySpeed * 0.06, spraySpeed * 1.0, spraySpeed * 0.06),
        },
        color: baseColor.clone(),
        spawnShape: { type: 'cone', radius: 0.08, angle: 8 },
      },
      update: [{
        drag: 0.08,
        gravityScale: 1.0,
        curlNoiseStrength: 0,
        curlNoiseScale: 0,
        colorOverLife: [
          { t: 0, color: new THREE.Color(1.2, 0.95, 0.35) },
          { t: 0.3, color: baseColor.clone() },
          { t: 0.7, color: baseColor.clone().multiplyScalar(0.4) },
          { t: 1, color: new THREE.Color(0.15, 0.06, 0.02) },
        ],
        sizeOverLife: [
          { t: 0, value: 1.0 },
          { t: 0.5, value: 0.7 },
          { t: 1, value: 0 },
        ],
        rotationRate: 0,
      }],
      render: {
        mode: 'gpu-sprite',
        blendMode: 'additive',
        velocityStretch: true,
        stretchScale: 0.2,
      },
      forceModules: [
        createCollision('ground-bounce', { planeY: 0, restitution: 0.3, friction: 0.5, maxBounces: 2 }),
      ],
    });

    const sys = createSystem({
      id: `gerb-system-${Date.now()}`,
      name: 'Gerb',
      emitters: [emitter],
      maxParticleBudget: SCALED_PARTICLE_COUNT,
      scalabilityGroup: 'high',
    });
    niagaraSystemRef.current = sys;

    return () => {
      niagaraSystemRef.current = null;
    };
  }, [scaledHeight, SCALED_PARTICLE_COUNT, baseColor]);

  useFrame(({ clock }, delta) => {
    if (!pointsRef.current || !niagaraSystemRef.current) return;
    const sys = niagaraSystemRef.current;
    const time = clock.getElapsedTime();
    const dt = Math.min(delta, 0.05);

    // Control spawn rate based on progress
    const intensity = progress < 0.03 ? Math.pow(progress / 0.03, 0.5) :
                      progress > 0.92 ? Math.pow((1 - progress) / 0.08, 2) : 1;

    // Enable/disable spawn based on progress
    for (const emitter of sys.emitters) {
      emitter.enabled = progress > 0.02 && progress < 0.95;
      emitter.spawnModule.rate = SCALED_PARTICLE_COUNT * 2 * intensity;
    }

    tickSystem(sys, dt);

    // Write Niagara particles to buffers
    let idx = 0;
    for (const emitter of sys.emitters) {
      for (const p of emitter.particles) {
        if (!p.alive || idx >= SCALED_PARTICLE_COUNT) continue;
        const t = p.age / p.lifetime;

        posArr[idx * 3] = p.position.x;
        posArr[idx * 3 + 1] = p.position.y;
        posArr[idx * 3 + 2] = p.position.z;

        // Flicker
        const flicker = 0.5
          + Math.sin(idx * 31 + time * 50) * 0.18
          + Math.sin(idx * 7 + time * 85) * 0.15
          + (Math.random() > 0.96 ? 0.4 : 0);

        const fade = Math.max(0, 1 - t) * intensity;
        colArr[idx * 3] = p.color.r * fade * flicker;
        colArr[idx * 3 + 1] = p.color.g * fade * flicker;
        colArr[idx * 3 + 2] = p.color.b * fade * flicker;

        idx++;
      }
    }

    // Zero remaining
    for (let i = idx; i < SCALED_PARTICLE_COUNT; i++) {
      posArr[i * 3 + 1] = -100;
      colArr[i * 3] = 0; colArr[i * 3 + 1] = 0; colArr[i * 3 + 2] = 0;
    }

    const geo = pointsRef.current.geometry;
    const posAttr = geo.getAttribute('position') as THREE.BufferAttribute;
    const colAttr = geo.getAttribute('color') as THREE.BufferAttribute;
    if (posAttr) posAttr.needsUpdate = true;
    if (colAttr) colAttr.needsUpdate = true;
  });

  const isActive = progress > 0.02 && progress < 0.95;
  const screenBlend = useMemo(() => getThreeBlending('screen'), []);

  return (
    <group position={position}>
      {isActive && (
        <>
          <mesh position={[0, 0.06, 0]}>
            <sphereGeometry args={[0.12, 8, 8]} />
            <meshBasicMaterial color="#FFDD55" transparent opacity={0.45} blending={screenBlend.blending} blendEquation={screenBlend.blendEquation} blendSrc={screenBlend.blendSrc as any} blendDst={screenBlend.blendDst as any} depthWrite={false} />
          </mesh>
          <mesh position={[0, 0.08, 0]}>
            <sphereGeometry args={[0.06, 6, 6]} />
            <meshBasicMaterial color="#FFFFF0" transparent opacity={0.6} blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>
          <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.8 + scaledHeight * 0.12, 16]} />
            <meshBasicMaterial color={color} transparent opacity={0.04} blending={screenBlend.blending} blendEquation={screenBlend.blendEquation} blendSrc={screenBlend.blendSrc as any} blendDst={screenBlend.blendDst as any} depthWrite={false} />
          </mesh>
        </>
      )}
      {/* Niagara-driven spark particles */}
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[posArr, 3]} />
          <bufferAttribute attach="attributes-color" args={[colArr, 3]} />
        </bufferGeometry>
        <pointsMaterial size={particleVisualSize} vertexColors transparent opacity={0.95} depthWrite={false} blending={THREE.AdditiveBlending} sizeAttenuation />
      </points>
    </group>
  );
}
