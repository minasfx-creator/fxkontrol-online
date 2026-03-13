import * as THREE from 'three';

/** Renders a subtle wireframe box showing geofence boundaries — non-intrusive */
export default function GeofenceVisual({ geofence }: { geofence?: { enabled: boolean; minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number } }) {
  if (!geofence?.enabled) return null;

  const { minX, maxX, minY, maxY, minZ, maxZ } = geofence;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const cz = (minZ + maxZ) / 2;
  const sx = maxX - minX;
  const sy = maxY - minY;
  const sz = maxZ - minZ;

  return (
    <group position={[cx, cy, cz]}>
      {/* Wireframe boundary — subtle green instead of aggressive red */}
      <lineSegments>
        <edgesGeometry args={[new THREE.BoxGeometry(sx, sy, sz)]} />
        <lineBasicMaterial color="#44aa66" transparent opacity={0.2} linewidth={1} />
      </lineSegments>

      {/* Very subtle transparent faces */}
      <mesh>
        <boxGeometry args={[sx, sy, sz]} />
        <meshBasicMaterial
          color="#44aa66"
          transparent
          opacity={0.01}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
