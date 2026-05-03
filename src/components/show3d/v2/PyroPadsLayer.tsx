/**
 * SkyCanvas 2.0 — PyroPadsLayer.
 *
 * Anéis laranja no chão indicando posições de lançamento. Visual only.
 *
 * Otimização: usa um único `InstancedMesh` em vez de N `<mesh/>` —
 * 1 draw call independente do número de pads. Geometria/material são
 * descartados no unmount (M5 disposal pattern).
 */
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { usePyroPads } from './useShowSelectors';

const PAD_COLOR = '#ff7700';
const RING_INNER = 0.6;
const RING_OUTER = 0.9;
const RING_SEGMENTS = 24;

export function PyroPadsLayer() {
  const pads = usePyroPads();
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const geometry = useMemo(() => new THREE.RingGeometry(RING_INNER, RING_OUTER, RING_SEGMENTS), []);
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: PAD_COLOR,
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide,
      }),
    [],
  );

  // Push pad positions into instance matrices when the list changes.
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
    const s = new THREE.Vector3(1, 1, 1);
    const v = new THREE.Vector3();
    for (let i = 0; i < pads.length; i++) {
      const p = pads[i];
      v.set(p.position[0], p.position[1], p.position[2]);
      m.compose(v, q, s);
      mesh.setMatrixAt(i, m);
    }
    mesh.count = pads.length;
    mesh.instanceMatrix.needsUpdate = true;
  }, [pads]);

  // Dispose deterministically when the layer unmounts.
  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  if (pads.length === 0) return null;

  // `args` for instancedMesh: [geometry, material, count]. We size for at
  // least the current pad count; React-Three-Fiber respects mesh.count.
  const capacity = Math.max(pads.length, 32);
  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, capacity]}
      frustumCulled={false}
    />
  );
}
