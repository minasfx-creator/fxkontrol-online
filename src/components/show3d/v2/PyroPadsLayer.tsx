/**
 * SkyCanvas 2.0 — PyroPadsLayer.
 *
 * Anéis laranja no chão indicando posições de lançamento. Visual only.
 */
import { useMemo } from 'react';
import * as THREE from 'three';
import { usePyroPads } from './useShowSelectors';

const PAD_COLOR = '#ff7700';

export function PyroPadsLayer() {
  const pads = usePyroPads();

  const geometry = useMemo(() => new THREE.RingGeometry(0.6, 0.9, 24), []);
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

  if (pads.length === 0) return null;

  return (
    <group>
      {pads.map((p) => (
        <mesh
          key={p.id}
          geometry={geometry}
          material={material}
          position={p.position}
          rotation={[-Math.PI / 2, 0, 0]}
        />
      ))}
    </group>
  );
}
