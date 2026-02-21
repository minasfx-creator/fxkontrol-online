import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const RING_SEGMENTS = 64;
const RING_LAYERS = 3;

/**
 * Shockwave effect: an expanding ring of particles/light with a central flash.
 * Multiple concentric rings expand at different speeds.
 */
export default function ShockwaveEffect({
  position,
  color,
  progress,
}: {
  position: [number, number, number];
  color: string;
  progress: number;
}) {
  const ringsRef = useRef<(THREE.Points | null)[]>([]);
  const baseColor = useMemo(() => new THREE.Color(color), [color]);

  useFrame(() => {
    for (let layer = 0; layer < RING_LAYERS; layer++) {
      const pts = ringsRef.current[layer];
      if (!pts) continue;

      const speed = 1 + layer * 0.3;
      const delay = layer * 0.08;
      const p = Math.max(0, progress - delay) * speed;
      const radius = p * 12;
      const fade = Math.max(0, 1 - (progress - delay) / (1 - delay)) * (1 - layer * 0.2);
      const yOffset = layer * 0.3 - 0.3;

      const posAttr = pts.geometry.getAttribute('position') as THREE.BufferAttribute;
      const colAttr = pts.geometry.getAttribute('color') as THREE.BufferAttribute;
      const posArr = posAttr.array as Float32Array;
      const colArr = colAttr.array as Float32Array;

      for (let i = 0; i < RING_SEGMENTS; i++) {
        const angle = (i / RING_SEGMENTS) * Math.PI * 2;
        const wobble = 1 + Math.sin(angle * 6 + progress * 20) * 0.08 * p;

        posArr[i * 3] = Math.cos(angle) * radius * wobble;
        posArr[i * 3 + 1] = yOffset + Math.sin(angle * 3 + progress * 15) * 0.2 * p;
        posArr[i * 3 + 2] = Math.sin(angle) * radius * wobble;

        // Inner ring is brighter, outer dimmer
        const brightness = fade * (1 - (i % 3) * 0.1);
        colArr[i * 3] = baseColor.r * brightness;
        colArr[i * 3 + 1] = baseColor.g * brightness;
        colArr[i * 3 + 2] = baseColor.b * brightness;
      }

      posAttr.needsUpdate = true;
      colAttr.needsUpdate = true;
    }
  });

  return (
    <group position={position}>
      {/* Central flash */}
      {progress < 0.2 && (
        <>
          <pointLight
            color={color}
            intensity={15 * (1 - progress / 0.2)}
            distance={25}
            decay={2}
          />
          <mesh>
            <sphereGeometry args={[0.5 + progress * 4, 16, 16]} />
            <meshBasicMaterial
              color={color}
              transparent
              opacity={0.3 * (1 - progress / 0.2)}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
        </>
      )}

      {/* Expanding rings */}
      {Array.from({ length: RING_LAYERS }).map((_, layer) => (
        <points
          key={layer}
          ref={(el) => { ringsRef.current[layer] = el; }}
        >
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[new Float32Array(RING_SEGMENTS * 3), 3]}
            />
            <bufferAttribute
              attach="attributes-color"
              args={[new Float32Array(RING_SEGMENTS * 3), 3]}
            />
          </bufferGeometry>
          <pointsMaterial
            size={0.25 - layer * 0.05}
            vertexColors
            transparent
            opacity={0.9}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            sizeAttenuation
          />
        </points>
      ))}

      {/* Flat disc shockwave */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[progress * 10, progress * 12 + 0.5, 32]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.12 * Math.max(0, 1 - progress)}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}
