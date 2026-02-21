import * as THREE from 'three';
import { useMemo } from 'react';
import { DEFAULT_GEOFENCE } from '@/lib/safetyEngine';

/** Renders a wireframe box in the 3D viewport showing the geofence boundaries */
export default function GeofenceVisual({ geofence = DEFAULT_GEOFENCE }: { geofence?: typeof DEFAULT_GEOFENCE }) {
  if (!geofence.enabled) return null;

  const { minX, maxX, minY, maxY, minZ, maxZ } = geofence;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const cz = (minZ + maxZ) / 2;
  const sx = maxX - minX;
  const sy = maxY - minY;
  const sz = maxZ - minZ;

  return (
    <group position={[cx, cy, cz]}>
      {/* Wireframe boundary */}
      <lineSegments>
        <edgesGeometry args={[new THREE.BoxGeometry(sx, sy, sz)]} />
        <lineBasicMaterial color="#FF4500" transparent opacity={0.25} linewidth={1} />
      </lineSegments>

      {/* Subtle transparent faces */}
      <mesh>
        <boxGeometry args={[sx, sy, sz]} />
        <meshBasicMaterial
          color="#FF4500"
          transparent
          opacity={0.02}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
