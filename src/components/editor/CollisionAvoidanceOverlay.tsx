import { useRef, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import { applyCollisionAvoidance, DEFAULT_AVOIDANCE, type AvoidanceConfig } from '@/lib/collisionAvoidance';
import { useProjectStore } from '@/store/useProjectStore';
import * as THREE from 'three';

/**
 * Real-time collision avoidance visual overlay.
 * Shows warning lines between drones that are too close.
 */
export default function CollisionAvoidanceOverlay({ config }: { config: AvoidanceConfig }) {
  const linesRef = useRef<THREE.LineSegments>(null);
  const positionsRef = useRef(new Float32Array(0));
  const colorsRef = useRef(new Float32Array(0));

  useFrame(() => {
    if (!linesRef.current || !config.enabled) {
      if (linesRef.current) linesRef.current.visible = false;
      return;
    }

    const { droneFormations, currentTime, showFormations } = useProjectStore.getState();
    if (!showFormations || droneFormations.length === 0) {
      linesRef.current.visible = false;
      return;
    }

    // Get current drone positions from the choreography
    const droneCount = droneFormations[0].droneCount;
    const currentPositions: { x: number; y: number; z: number }[] = [];

    // Find active formation
    for (const f of droneFormations) {
      const holdEnd = f.startTime + f.transitionDuration + f.holdDuration;
      if (currentTime >= f.startTime && currentTime <= holdEnd) {
        for (let d = 0; d < droneCount; d++) {
          const pt = f.points[d];
          if (pt) currentPositions.push({ x: pt.x, y: f.height, z: pt.z });
        }
        break;
      }
    }

    if (currentPositions.length < 2) {
      linesRef.current.visible = false;
      return;
    }

    // Find close pairs
    const pairs: { i: number; j: number; dist: number }[] = [];
    const cellSize = config.detectionRadius;
    const grid = new Map<string, number[]>();

    for (let i = 0; i < currentPositions.length; i++) {
      const p = currentPositions[i];
      const cx = Math.floor(p.x / cellSize);
      const cy = Math.floor(p.y / cellSize);
      const cz = Math.floor(p.z / cellSize);
      const key = `${cx},${cy},${cz}`;
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key)!.push(i);
    }

    for (let i = 0; i < currentPositions.length; i++) {
      const pi = currentPositions[i];
      const cx = Math.floor(pi.x / cellSize);
      const cy = Math.floor(pi.y / cellSize);
      const cz = Math.floor(pi.z / cellSize);

      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          for (let dz = -1; dz <= 1; dz++) {
            const cell = grid.get(`${cx + dx},${cy + dy},${cz + dz}`);
            if (!cell) continue;
            for (const j of cell) {
              if (j <= i) continue;
              const pj = currentPositions[j];
              const ddx = pi.x - pj.x, ddy = pi.y - pj.y, ddz = pi.z - pj.z;
              const dist = Math.sqrt(ddx * ddx + ddy * ddy + ddz * ddz);
              if (dist < config.detectionRadius) {
                pairs.push({ i, j, dist });
              }
            }
          }
        }
      }
    }

    // Update line geometry
    const maxLines = 500;
    const visiblePairs = pairs.slice(0, maxLines);
    const needed = visiblePairs.length * 6;

    if (positionsRef.current.length < needed) {
      positionsRef.current = new Float32Array(needed);
      colorsRef.current = new Float32Array(needed);
    }

    for (let k = 0; k < visiblePairs.length; k++) {
      const { i, j, dist } = visiblePairs[k];
      const pi = currentPositions[i];
      const pj = currentPositions[j];

      positionsRef.current[k * 6] = pi.x;
      positionsRef.current[k * 6 + 1] = pi.y;
      positionsRef.current[k * 6 + 2] = pi.z;
      positionsRef.current[k * 6 + 3] = pj.x;
      positionsRef.current[k * 6 + 4] = pj.y;
      positionsRef.current[k * 6 + 5] = pj.z;

      // Color: red for critical, yellow for warning
      const severity = 1.0 - Math.min(1, dist / config.detectionRadius);
      const r = severity > 0.5 ? 1 : severity * 2;
      const g = severity > 0.5 ? 1 - (severity - 0.5) * 2 : 1;
      colorsRef.current[k * 6] = r;
      colorsRef.current[k * 6 + 1] = g;
      colorsRef.current[k * 6 + 2] = 0;
      colorsRef.current[k * 6 + 3] = r;
      colorsRef.current[k * 6 + 4] = g;
      colorsRef.current[k * 6 + 5] = 0;
    }

    linesRef.current.visible = visiblePairs.length > 0;
    const geom = linesRef.current.geometry;
    geom.setDrawRange(0, visiblePairs.length * 2);

    const posAttr = geom.getAttribute('position') as THREE.BufferAttribute;
    const colAttr = geom.getAttribute('color') as THREE.BufferAttribute;
    if (posAttr) {
      (posAttr.array as Float32Array).set(positionsRef.current.subarray(0, needed));
      posAttr.needsUpdate = true;
    }
    if (colAttr) {
      (colAttr.array as Float32Array).set(colorsRef.current.subarray(0, needed));
      colAttr.needsUpdate = true;
    }
  });

  const maxVerts = 1000;
  const initPos = new Float32Array(maxVerts * 3);
  const initCol = new Float32Array(maxVerts * 3);

  return (
    <lineSegments ref={linesRef} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[initPos, 3]} />
        <bufferAttribute attach="attributes-color" args={[initCol, 3]} />
      </bufferGeometry>
      <lineBasicMaterial vertexColors transparent opacity={0.7} depthWrite={false} />
    </lineSegments>
  );
}
