import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * TourbillonEffect — Spiraling ascending pyrotechnic device.
 * Helical trajectory with spark trail, optional mini-burst at apex.
 */

interface TourbillonEffectProps {
  position: [number, number, number];
  progress: number; // 0 = launch, 1 = done
  color?: string;
  height?: number;
  spiralRadius?: number;
  rotationSpeed?: number;
  trailLength?: number;
}

const MAX_TRAIL = 200;

export default function TourbillonEffect({
  position,
  progress,
  color = '#FFD700',
  height = 15,
  spiralRadius = 1.5,
  rotationSpeed = 8,
  trailLength = 80,
}: TourbillonEffectProps) {
  const trailRef = useRef<THREE.Points>(null);
  const headRef = useRef<THREE.Mesh>(null);

  const trailBuffer = useMemo(() => new Float32Array(MAX_TRAIL * 3), []);
  const trailColors = useMemo(() => new Float32Array(MAX_TRAIL * 3), []);
  const baseColor = useMemo(() => new THREE.Color(color), [color]);

  // Compute head position on helical path
  const headPos = useMemo(() => {
    const t = progress;
    const angle = t * rotationSpeed * Math.PI * 2;
    const r = spiralRadius * (1 - t * 0.3); // Radius decreases as it rises
    return new THREE.Vector3(
      Math.cos(angle) * r,
      t * height,
      Math.sin(angle) * r,
    );
  }, [progress, rotationSpeed, spiralRadius, height]);

  useFrame(() => {
    if (!trailRef.current || progress <= 0 || progress > 1) return;

    // Build trail from past positions along helix
    const count = Math.min(MAX_TRAIL, Math.floor(trailLength * progress));
    for (let i = 0; i < count; i++) {
      const t = progress - (i / trailLength) * progress;
      const angle = t * rotationSpeed * Math.PI * 2;
      const r = spiralRadius * (1 - t * 0.3);
      const fade = 1 - i / count;

      trailBuffer[i * 3] = Math.cos(angle) * r + (Math.random() - 0.5) * 0.1;
      trailBuffer[i * 3 + 1] = t * height;
      trailBuffer[i * 3 + 2] = Math.sin(angle) * r + (Math.random() - 0.5) * 0.1;

      trailColors[i * 3] = baseColor.r * fade;
      trailColors[i * 3 + 1] = baseColor.g * fade * 0.8;
      trailColors[i * 3 + 2] = baseColor.b * fade * 0.6;
    }

    const geo = trailRef.current.geometry;
    geo.setDrawRange(0, count);
    const posAttr = geo.getAttribute('position') as THREE.BufferAttribute;
    const colAttr = geo.getAttribute('color') as THREE.BufferAttribute;
    if (posAttr) posAttr.needsUpdate = true;
    if (colAttr) colAttr.needsUpdate = true;
  });

  if (progress <= 0 || progress > 1.05) return null;

  const showMiniBurst = progress > 0.9;
  const burstProgress = (progress - 0.9) / 0.1;

  return (
    <group position={position}>
      {/* Spark trail */}
      <points ref={trailRef} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[trailBuffer, 3]} />
          <bufferAttribute attach="attributes-color" args={[trailColors, 3]} />
        </bufferGeometry>
        <pointsMaterial
          size={0.25}
          vertexColors
          transparent
          opacity={0.85}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          sizeAttenuation
        />
      </points>

      {/* Glowing head */}
      {!showMiniBurst && (
        <mesh ref={headRef} position={[headPos.x, headPos.y, headPos.z]}>
          <sphereGeometry args={[0.3, 8, 8]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.9}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      )}

      {/* Mini-burst at apex */}
      {showMiniBurst && (
        <mesh position={[headPos.x, headPos.y, headPos.z]} scale={1 + burstProgress * 3}>
          <sphereGeometry args={[0.5, 12, 12]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={Math.max(0, 0.8 * (1 - burstProgress))}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      )}

      {/* Point light on head */}
      <pointLight
        color={color}
        position={[headPos.x, headPos.y, headPos.z]}
        intensity={2 * (1 - progress)}
        distance={10}
        decay={2}
      />
    </group>
  );
}
