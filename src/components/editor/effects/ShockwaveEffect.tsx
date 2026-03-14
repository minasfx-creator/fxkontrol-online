import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const RING_SEGMENTS = 96;
const RING_LAYERS = 4;

/**
 * Shockwave effect: expanding concentric rings of particles with a central flash.
 */
function ShockwaveEffectInner({
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

      const speed = 1 + layer * 0.25;
      const delay = layer * 0.06;
      const p = Math.max(0, progress - delay) * speed;
      const radius = p * 15;
      const fade = Math.max(0, 1 - (progress - delay) / (1 - delay)) * (1 - layer * 0.15);
      const yOffset = layer * 0.4 - 0.4;

      const posAttr = pts.geometry.getAttribute('position') as THREE.BufferAttribute;
      const colAttr = pts.geometry.getAttribute('color') as THREE.BufferAttribute;
      const posArr = posAttr.array as Float32Array;
      const colArr = colAttr.array as Float32Array;

      for (let i = 0; i < RING_SEGMENTS; i++) {
        const angle = (i / RING_SEGMENTS) * Math.PI * 2;
        const wobble = 1 + Math.sin(angle * 6 + progress * 20) * 0.08 * p;

        posArr[i * 3] = Math.cos(angle) * radius * wobble;
        posArr[i * 3 + 1] = yOffset + Math.sin(angle * 3 + progress * 15) * 0.3 * p;
        posArr[i * 3 + 2] = Math.sin(angle) * radius * wobble;

        const brightness = fade * (1 - (i % 3) * 0.08);
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
      {progress < 0.15 && (
        <mesh>
          <sphereGeometry args={[0.8 + progress * 6, 16, 16]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.5 * (1 - progress / 0.15)}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      )}

      {Array.from({ length: RING_LAYERS }).map((_, layer) => (
        <points
          key={layer}
          ref={(el) => { ringsRef.current[layer] = el; }}
        >
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[new Float32Array(RING_SEGMENTS * 3), 3]} />
            <bufferAttribute attach="attributes-color" args={[new Float32Array(RING_SEGMENTS * 3), 3]} />
          </bufferGeometry>
          <pointsMaterial
            size={0.3 - layer * 0.04}
            vertexColors
            transparent
            opacity={0.9}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            sizeAttenuation
          />
        </points>
      ))}

      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[progress * 12, progress * 15 + 0.8, 32]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.1 * Math.max(0, 1 - progress)}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

export default ShockwaveEffectInner;
