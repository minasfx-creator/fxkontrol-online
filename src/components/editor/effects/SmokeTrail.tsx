/**
 * SmokeTrail — InstancedMesh smoke (1 draw call instead of 80-120)
 * 
 * Uses THREE.InstancedMesh with shared sphereGeometry for GPU-efficient
 * post-burst smoke rendering. Per-instance transform via instanceMatrix.
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

// Shared geometry — created once
let _sharedSphereGeo: THREE.SphereGeometry | null = null;
function getSharedSphereGeo(): THREE.SphereGeometry {
  if (!_sharedSphereGeo) {
    _sharedSphereGeo = new THREE.SphereGeometry(1, 6, 6);
  }
  return _sharedSphereGeo;
}

// Shared material
let _sharedSmokeMat: THREE.MeshBasicMaterial | null = null;
function getSharedSmokeMat(): THREE.MeshBasicMaterial {
  if (!_sharedSmokeMat) {
    _sharedSmokeMat = new THREE.MeshBasicMaterial({
      color: '#888888',
      transparent: true,
      opacity: 0.06,
      depthWrite: false,
      depthTest: false,
    });
  }
  return _sharedSmokeMat;
}

// Pre-allocated dummy for matrix updates
const _dummy = new THREE.Object3D();
const _color = new THREE.Color();
const _colorTemp = new THREE.Color();

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

  const instancedRef = useRef<THREE.InstancedMesh>(null);
  const niagaraRef = useRef<NiagaraSystem | null>(null);

  const fadeOutPower = liftChargeType === 'black_powder' ? 1.5 : 2.0;
  const baseOpacity = liftChargeType === 'black_powder' ? 0.08 : 0.05;

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
        gravityScale: -0.05,
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

  useFrame((_, delta) => {
    if (!niagaraRef.current || !instancedRef.current) return;
    const dt = Math.min(delta, 0.05);
    const sys = niagaraRef.current;
    const mesh = instancedRef.current;

    for (const emitter of sys.emitters) {
      emitter.enabled = progress > 0 && progress < 0.95;
    }

    if (progress > 0) {
      tickSystem(sys, dt);
    }

    const emitter = sys.emitters[0];
    if (!emitter) return;

    let visIdx = 0;
    _color.set(smokeColor);

    for (const p of emitter.particles) {
      if (!p.alive || visIdx >= SMOKE_COUNT) continue;

      const t = p.age / p.lifetime;
      _dummy.position.set(p.position.x, p.position.y, p.position.z);
      _dummy.scale.setScalar(p.size);
      _dummy.updateMatrix();
      mesh.setMatrixAt(visIdx, _dummy.matrix);

      // Per-instance color with fade baked into color brightness
      const fadeIn = Math.min(1, p.age * 8);
      const fadeOut = Math.max(0, 1 - Math.pow(t, fadeOutPower));
      const opacityFactor = Math.max(0, baseOpacity * intensity * fadeIn * fadeOut * smokeDensityMult);
      mesh.setColorAt(visIdx, _color.clone().multiplyScalar(opacityFactor * 10)); // Scale for visibility

      visIdx++;
    }

    // Hide remaining instances by scaling to 0
    for (let i = visIdx; i < SMOKE_COUNT; i++) {
      _dummy.position.set(0, -1000, 0);
      _dummy.scale.setScalar(0);
      _dummy.updateMatrix();
      mesh.setMatrixAt(i, _dummy.matrix);
    }

    mesh.count = visIdx;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  if (progress <= 0) return null;

  return (
    <group position={position}>
      <instancedMesh
        ref={instancedRef}
        args={[getSharedSphereGeo(), getSharedSmokeMat(), SMOKE_COUNT]}
        frustumCulled={false}
      />
    </group>
  );
}

export default SmokeTrailInner;
