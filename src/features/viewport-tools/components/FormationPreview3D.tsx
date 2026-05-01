/**
 * FormationPreview3D — small Three.js canvas that renders a point cloud
 * for the current Drone Formation generator parameters.
 *
 * Lightweight & defensive: orbit controls + axis grid + drone instances.
 * No store coupling — pure props in.
 */

import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
import * as THREE from 'three';
import {
  generateDroneFormationDetailed,
  type FormationParams,
} from '../generators/droneFormationGenerator';

interface Props {
  params: FormationParams;
}

function DroneSwarm({ params }: Props) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const { points, color, count, ok } = useMemo(() => {
    const result = generateDroneFormationDetailed(params);
    const pts = result.formation.points.map((p, i) => ({
      x: p.x,
      z: p.z,
      y: params.height + ((result.formation as { pointsY?: number[] }).pointsY?.[i] ?? 0),
    }));
    return {
      points: pts,
      color: result.collision.ok ? '#00e5ff' : '#ff5577',
      count: result.formation.droneCount,
      ok: result.collision.ok,
    };
  }, [params]);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    for (let i = 0; i < points.length; i++) {
      dummy.position.set(points[i].x, points[i].y, points[i].z);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.count = points.length;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, Math.max(1, count)]}>
      <sphereGeometry args={[0.3, 8, 8]} />
      <meshBasicMaterial color={color} toneMapped={false} />
    </instancedMesh>
  );
}

export default function FormationPreview3D({ params }: Props) {
  return (
    <div className="relative h-56 w-full rounded border border-cyan-500/20 bg-[#02040a] overflow-hidden">
      <Canvas
        camera={{ position: [params.radius * 1.8, params.height + params.radius * 1.2, params.radius * 1.8], fov: 50 }}
        dpr={[1, 1.5]}
      >
        <ambientLight intensity={0.5} />
        <Grid
          args={[200, 200]}
          cellSize={2}
          cellColor="#0a3a55"
          sectionColor="#155a7d"
          sectionSize={10}
          fadeDistance={120}
          infiniteGrid
        />
        <DroneSwarm params={params} />
        <OrbitControls enablePan enableZoom enableRotate makeDefault />
      </Canvas>
      <div className="absolute top-1 left-2 text-[10px] text-cyan-300/70 font-mono">
        PREVIEW · drag to orbit
      </div>
    </div>
  );
}
