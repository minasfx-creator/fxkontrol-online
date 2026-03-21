import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const MAX_REPORTS = 50;

/**
 * FirecrackerStringEffect — Traca: rapid sequential small reports 
 * connected by quick-match (1 metro por segundo propagation).
 * Each report: small white flash + tiny smoke puff + ground debris.
 */
export default function FirecrackerStringEffect({
  position,
  progress,
  reportCount = 30,
  length = 6,
}: {
  position: [number, number, number];
  progress: number;
  reportCount?: number;
  length?: number;
}) {
  const flashRefs = useRef<(THREE.Mesh | null)[]>([]);
  const smokeRef = useRef<THREE.Points>(null);

  const count = Math.min(reportCount, MAX_REPORTS);
  const smokePos = useMemo(() => new Float32Array(count * 3), [count]);
  const smokeCol = useMemo(() => new Float32Array(count * 3), [count]);

  const reportPositions = useMemo(() => {
    const p: [number, number, number][] = [];
    for (let i = 0; i < count; i++) {
      const t = i / Math.max(1, count - 1);
      // Line layout along X axis
      p.push([
        (t - 0.5) * length,
        0.02 + Math.random() * 0.03,
        (Math.random() - 0.5) * 0.3,
      ]);
    }
    return p;
  }, [count, length]);

  useFrame(({ clock }) => {
    const time = clock.getElapsedTime();

    for (let i = 0; i < count; i++) {
      const reportTime = i / count; // sequential timing
      const reportProgress = (progress - reportTime) * count;
      const flash = flashRefs.current[i];

      if (flash) {
        if (reportProgress > 0 && reportProgress < 0.8) {
          flash.visible = true;
          const flashIntensity = Math.max(0, 1 - reportProgress * 3);
          const scale = 0.15 + flashIntensity * 0.2;
          flash.scale.setScalar(scale);
          const mat = flash.material as THREE.MeshBasicMaterial;
          mat.opacity = flashIntensity * 0.9;
        } else {
          flash.visible = false;
        }
      }

      // Smoke residue
      if (smokeRef.current) {
        const pos = reportPositions[i];
        const smokeAge = Math.max(0, progress - reportTime) * 3;
        if (smokeAge > 0 && smokeAge < 2) {
          smokePos[i * 3] = pos[0] + Math.sin(time + i) * 0.05 * smokeAge;
          smokePos[i * 3 + 1] = pos[1] + smokeAge * 0.3;
          smokePos[i * 3 + 2] = pos[2] + Math.cos(time * 0.8 + i) * 0.04 * smokeAge;
          const fade = Math.max(0, 1 - smokeAge * 0.5) * 0.25;
          smokeCol[i * 3] = 0.35 * fade;
          smokeCol[i * 3 + 1] = 0.33 * fade;
          smokeCol[i * 3 + 2] = 0.3 * fade;
        } else {
          smokePos[i * 3 + 1] = -100;
          smokeCol[i * 3] = 0; smokeCol[i * 3 + 1] = 0; smokeCol[i * 3 + 2] = 0;
        }
      }
    }

    if (smokeRef.current) {
      const geo = smokeRef.current.geometry;
      (geo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
      (geo.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;
    }
  });

  if (progress <= 0 || progress > 1) return null;

  return (
    <group position={position}>
      {/* Individual flash spheres */}
      {reportPositions.map((pos, i) => (
        <mesh
          key={i}
          ref={el => { flashRefs.current[i] = el; }}
          position={pos}
          visible={false}
        >
          <sphereGeometry args={[1, 6, 6]} />
          <meshBasicMaterial color="#FFFFEE" transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      ))}

      {/* Smoke residue */}
      <points ref={smokeRef} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[smokePos, 3]} />
          <bufferAttribute attach="attributes-color" args={[smokeCol, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.2} vertexColors transparent opacity={0.4} depthWrite={false} sizeAttenuation />
      </points>
    </group>
  );
}
