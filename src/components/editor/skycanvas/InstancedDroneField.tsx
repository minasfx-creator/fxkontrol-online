/**
 * InstancedDroneField — single instancedMesh for ALL drones in the show playback.
 *
 * Replaces the per-drone <LightPoint> map in TimelineEffects (1 draw call vs N).
 * Tier-aware: cinema/balanced → instanced quad-glow billboard; eco → Points.
 *
 * Inputs are stable per-frame (memoized upstream); we update matrices and
 * per-instance colors only when the items array changes, then drive a 4 Hz
 * brightness pulse in useFrame without realloc.
 */
import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useRenderQualityTier } from '@/render_ultra/stability/useRenderQualityTier';
// r_instanced_drones flag — local default ON. Override via localStorage.fxk.flag.r_instanced_drones=0
function isInstancedDronesEnabled(): boolean {
  try {
    if (typeof window === 'undefined') return true;
    const v = window.localStorage.getItem('fxk.flag.r_instanced_drones');
    return v !== '0' && v !== 'false';
  } catch { return true; }
}

export interface DroneFieldItem {
  id: string;
  position: [number, number, number];
  color: string;
}

interface Props {
  items: DroneFieldItem[];
  /** Hard cap; defaults to 10 000. */
  maxInstances?: number;
}

const _dummy = new THREE.Object3D();
const _color = new THREE.Color();

export default function InstancedDroneField({ items, maxInstances = 10_000 }: Props) {
  // Feature flag — default ON. Caller can disable via `r_instanced_drones`.
  const enabled = isInstancedDronesEnabled();
  const tier = useRenderQualityTier();

  if (!enabled || items.length === 0) return null;
  if (tier === 'eco') return <DronePointsCloud items={items} />;
  return <DroneInstancedMesh items={items} maxInstances={maxInstances} />;
}

function DroneInstancedMesh({ items, maxInstances }: { items: DroneFieldItem[]; maxInstances: number }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const count = Math.min(items.length, maxInstances);

  // Update matrices + per-instance color when items change (NOT per frame).
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    for (let i = 0; i < count; i++) {
      const it = items[i];
      _dummy.position.set(it.position[0], it.position[1], it.position[2]);
      _dummy.rotation.set(0, 0, 0);
      _dummy.scale.setScalar(1);
      _dummy.updateMatrix();
      mesh.setMatrixAt(i, _dummy.matrix);
      _color.set(it.color);
      mesh.setColorAt(i, _color);
    }
    // Compact unused trailing slots
    _dummy.scale.setScalar(0);
    _dummy.updateMatrix();
    for (let i = count; i < maxInstances; i++) {
      mesh.setMatrixAt(i, _dummy.matrix);
    }
    mesh.count = maxInstances; // keep allocation stable, scale=0 hides extras
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [items, count, maxInstances]);

  // 4 Hz brightness pulse via material uniform (single uniform = zero per-frame alloc).
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  useFrame((state) => {
    if (!matRef.current) return;
    const t = state.clock.elapsedTime;
    // 0.65–1.0 sinusoidal pulse @ 4 Hz
    const pulse = 0.65 + 0.35 * (0.5 + 0.5 * Math.sin(t * Math.PI * 2 * 4));
    matRef.current.opacity = pulse;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, maxInstances]} frustumCulled={false}>
      <sphereGeometry args={[0.18, 6, 6]} />
      <meshBasicMaterial
        ref={matRef}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </instancedMesh>
  );
}

function DronePointsCloud({ items }: { items: DroneFieldItem[] }) {
  const geomRef = useRef<THREE.BufferGeometry>(null);
  const positions = useMemo(() => {
    const arr = new Float32Array(items.length * 3);
    for (let i = 0; i < items.length; i++) {
      arr[i * 3 + 0] = items[i].position[0];
      arr[i * 3 + 1] = items[i].position[1];
      arr[i * 3 + 2] = items[i].position[2];
    }
    return arr;
  }, [items]);
  const colors = useMemo(() => {
    const arr = new Float32Array(items.length * 3);
    const c = new THREE.Color();
    for (let i = 0; i < items.length; i++) {
      c.set(items[i].color);
      arr[i * 3 + 0] = c.r;
      arr[i * 3 + 1] = c.g;
      arr[i * 3 + 2] = c.b;
    }
    return arr;
  }, [items]);

  return (
    <points>
      <bufferGeometry ref={geomRef}>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={2.5}
        sizeAttenuation
        vertexColors
        transparent
        opacity={0.95}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </points>
  );
}
