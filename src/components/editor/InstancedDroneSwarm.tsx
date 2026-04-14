/**
 * InstancedDroneSwarm — Instanced mesh rendering for drone swarm visualization
 */
import React, { useRef, useMemo } from 'react';
import * as THREE from 'three';

interface Props {
  positions: { x: number; y: number; z: number }[];
  scale?: number;
}

const _dummy = new THREE.Object3D();
const _color = new THREE.Color();

export default function InstancedDroneSwarm({ positions, scale = 1 }: Props) {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  useMemo(() => {
    if (!meshRef.current) return;
    const mesh = meshRef.current;
    for (let i = 0; i < positions.length; i++) {
      _dummy.position.set(positions[i].x, positions[i].y, positions[i].z);
      _dummy.scale.setScalar(scale);
      _dummy.updateMatrix();
      mesh.setMatrixAt(i, _dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, [positions, scale]);

  if (positions.length === 0) return null;

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, positions.length]}>
      <sphereGeometry args={[0.3, 8, 8]} />
      <meshStandardMaterial color="hsl(190, 100%, 50%)" emissive="hsl(190, 100%, 30%)" emissiveIntensity={0.5} />
    </instancedMesh>
  );
}
