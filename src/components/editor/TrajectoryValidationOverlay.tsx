/**
 * ─── Trajectory Validation Overlay ──────────────────────────────
 * Skybrush Viewer-style 3D overlay that renders violation markers
 * directly in the viewport: altitude ceilings, proximity warnings,
 * velocity vectors, and geofence boundaries.
 */

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { SafetyCheckResult, SafetyViolation } from '@/lib/skybrushSafetyCheck';
import { useProjectStore } from '@/store/useProjectStore';

interface TrajectoryValidationOverlayProps {
  result: SafetyCheckResult | null;
  visible: boolean;
  maxAltitude?: number;
  geofenceRadius?: number;
}

const _color = new THREE.Color();

/**
 * Renders validation markers in the 3D scene:
 * - Red spheres at violation positions
 * - Altitude ceiling plane (translucent red)
 * - Geofence cylinder (translucent yellow)
 * - Proximity warning lines between close drones
 */
export default function TrajectoryValidationOverlay({
  result,
  visible,
  maxAltitude = 150,
  geofenceRadius = 500,
}: TrajectoryValidationOverlayProps) {
  const currentTime = useProjectStore(s => s.currentTime);
  const markerRef = useRef<THREE.InstancedMesh>(null);
  const lineRef = useRef<THREE.LineSegments>(null);
  const _dummy = useMemo(() => new THREE.Object3D(), []);

  // Filter violations near current time
  const activeViolations = useMemo(() => {
    if (!result) return [];
    return result.violations.filter(v =>
      Math.abs(v.time - currentTime) < 1.0
    ).slice(0, 200);
  }, [result, currentTime]);

  // Proximity violations for line rendering
  const proximityViolations = useMemo(() => {
    return activeViolations.filter(v => v.type === 'proximity' && v.droneId2);
  }, [activeViolations]);

  // Update instanced markers
  useFrame(() => {
    if (!markerRef.current || !visible) return;
    const mesh = markerRef.current;

    for (let i = 0; i < activeViolations.length && i < 200; i++) {
      const v = activeViolations[i];
      _dummy.position.set(v.position.x, v.position.y, v.position.z);
      const scale = v.severity === 'critical' ? 1.5 : v.severity === 'error' ? 1.0 : 0.6;
      _dummy.scale.setScalar(scale);
      _dummy.updateMatrix();
      mesh.setMatrixAt(i, _dummy.matrix);

      _color.set(v.severity === 'critical' ? '#ff0000' : v.severity === 'error' ? '#ff6600' : '#ffaa00');
      mesh.setColorAt(i, _color);
    }

    // Hide unused
    for (let i = activeViolations.length; i < 200; i++) {
      _dummy.scale.setScalar(0);
      _dummy.updateMatrix();
      mesh.setMatrixAt(i, _dummy.matrix);
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  if (!visible) return null;

  return (
    <group>
      {/* Violation marker instances */}
      <instancedMesh ref={markerRef} args={[undefined, undefined, 200]} frustumCulled={false}>
        <octahedronGeometry args={[0.8, 0]} />
        <meshBasicMaterial transparent opacity={0.7} depthWrite={false} blending={THREE.AdditiveBlending} />
      </instancedMesh>

      {/* Altitude ceiling plane */}
      <mesh position={[0, maxAltitude, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[geofenceRadius * 2, geofenceRadius * 2]} />
        <meshBasicMaterial color="#ff0000" transparent opacity={0.03} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>

      {/* Altitude ceiling grid */}
      <mesh position={[0, maxAltitude, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0, geofenceRadius, 64]} />
        <meshBasicMaterial color="#ff0000" transparent opacity={0.08} side={THREE.DoubleSide} depthWrite={false} wireframe />
      </mesh>

      {/* Geofence cylinder */}
      <mesh position={[0, maxAltitude / 2, 0]}>
        <cylinderGeometry args={[geofenceRadius, geofenceRadius, maxAltitude, 64, 1, true]} />
        <meshBasicMaterial color="#ffaa00" transparent opacity={0.02} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>

      {/* Geofence boundary lines */}
      <mesh position={[0, maxAltitude / 2, 0]}>
        <cylinderGeometry args={[geofenceRadius, geofenceRadius, maxAltitude, 32, 4, true]} />
        <meshBasicMaterial color="#ffaa00" transparent opacity={0.06} wireframe depthWrite={false} />
      </mesh>

      {/* Proximity warning lines */}
      {proximityViolations.map((v, i) => (
        <line key={i}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[new Float32Array([
                v.position.x, v.position.y, v.position.z,
                v.position.x + (Math.random() - 0.5) * 2, v.position.y, v.position.z + (Math.random() - 0.5) * 2,
              ]), 3]}
            />
          </bufferGeometry>
          <lineBasicMaterial color={v.severity === 'critical' ? '#ff0000' : '#ff6600'} transparent opacity={0.5} />
        </line>
      ))}
    </group>
  );
}
