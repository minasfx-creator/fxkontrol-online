import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * SetPieceEffect — Static lance grid forming text/images.
 * Each lance lights sequentially with timing jitter.
 * Uses InstancedMesh for performance.
 */

interface SetPieceEffectProps {
  position: [number, number, number];
  progress: number; // 0 = start ignition, 1 = all burned out
  points: [number, number][]; // 2D coordinates for lance positions
  color?: string;
  secondaryColor?: string;
  scale?: number;
  ignitionSpeed?: number; // 0-1: how fast lances light up sequentially
}

const DEFAULT_POINTS: [number, number][] = (() => {
  // Default: star shape
  const pts: [number, number][] = [];
  for (let i = 0; i < 5; i++) {
    const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
    const nextAngle = ((i + 1) * 4 * Math.PI) / 5 - Math.PI / 2;
    pts.push([Math.cos(angle) * 2, Math.sin(angle) * 2]);
    // Interpolate between star points
    for (let j = 1; j < 4; j++) {
      const t = j / 4;
      pts.push([
        Math.cos(angle) * 2 * (1 - t) + Math.cos(nextAngle) * 2 * t,
        Math.sin(angle) * 2 * (1 - t) + Math.sin(nextAngle) * 2 * t,
      ]);
    }
  }
  return pts;
})();

const DUMMY = new THREE.Object3D();
const _tmpColor = new THREE.Color();

export default function SetPieceEffect({
  position,
  progress,
  points = DEFAULT_POINTS,
  color = '#FFD700',
  secondaryColor,
  scale = 1,
  ignitionSpeed = 0.3,
}: SetPieceEffectProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const count = points.length;

  // Pre-compute ignition order and jitter
  const ignitionData = useMemo(() => {
    return points.map((_, i) => ({
      order: i / count, // sequential order
      jitter: (Math.random() - 0.5) * 0.05, // ±5% timing jitter
    }));
  }, [points, count]);

  const baseColor = useMemo(() => new THREE.Color(color), [color]);
  const altColor = useMemo(
    () => (secondaryColor ? new THREE.Color(secondaryColor) : null),
    [secondaryColor]
  );

  useFrame(() => {
    if (!meshRef.current || progress <= 0 || progress > 1) return;

    const ignitionWindow = ignitionSpeed;
    const burnDuration = 1 - ignitionWindow;

    for (let i = 0; i < count; i++) {
      const { order, jitter } = ignitionData[i];
      const igniteAt = order * ignitionWindow + jitter;
      const localProgress = (progress - igniteAt) / burnDuration;

      const pt = points[i];
      DUMMY.position.set(pt[0] * scale, pt[1] * scale, 0);

      if (localProgress <= 0 || localProgress > 1) {
        DUMMY.scale.setScalar(0.001);
      } else {
        // Rapid ignition, slow burnout
        const intensity = localProgress < 0.1
          ? localProgress / 0.1
          : Math.max(0, 1 - (localProgress - 0.1) / 0.9);
        DUMMY.scale.setScalar(0.15 + intensity * 0.15);

        // Color: alternate between primary and secondary
        const c = altColor && i % 2 === 1 ? altColor : baseColor;
        const emissiveBoost = localProgress < 0.15 ? 2 : 1;
        _tmpColor.copy(c).multiplyScalar(emissiveBoost);
        meshRef.current.setColorAt(i, _tmpColor);
      }

      DUMMY.updateMatrix();
      meshRef.current.setMatrixAt(i, DUMMY.matrix);
    }

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  });

  if (progress <= 0 || progress > 1) return null;

  return (
    <group position={position}>
      <instancedMesh ref={meshRef} args={[undefined, undefined, count]} frustumCulled={false}>
        <sphereGeometry args={[0.15, 6, 6]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.95}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </instancedMesh>
    </group>
  );
}
