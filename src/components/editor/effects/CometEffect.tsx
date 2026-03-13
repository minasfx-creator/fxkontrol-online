import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const TRAIL_POINTS = 80;

/**
 * Comet effect: a bright head rising/falling with a long luminous trail.
 * Uses a line strip for the trail and a point light for the head glow.
 */
export default function CometEffect({
  position,
  color,
  progress,
  direction = 'up',
}: {
  position: [number, number, number];
  color: string;
  progress: number;
  direction?: 'up' | 'down';
}) {
  const lineRef = useRef<THREE.Line>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const baseColor = useMemo(() => new THREE.Color(color), [color]);

  const posArr = useRef(new Float32Array(TRAIL_POINTS * 3));
  const colArr = useRef(new Float32Array(TRAIL_POINTS * 3));

  useFrame(() => {
    if (!lineRef.current) return;

    const p = posArr.current;
    const c = colArr.current;
    const dir = direction === 'up' ? 1 : -1;

    // Head position moves along Y
    const headY = dir * progress * 18;
    const headX = Math.sin(progress * Math.PI * 2) * 0.8;

    for (let i = 0; i < TRAIL_POINTS; i++) {
      const t = i / TRAIL_POINTS; // 0 = head, 1 = tail
      const trailProgress = Math.max(0, progress - t * 0.3);
      const fade = Math.pow(1 - t, 2.5) * Math.max(0, 1 - progress * 0.8);

      p[i * 3] = headX * (1 - t * 0.6) + Math.sin(t * 6 + progress * 10) * 0.15 * t;
      p[i * 3 + 1] = headY - dir * t * 8 * progress;
      p[i * 3 + 2] = Math.cos(t * 4 + progress * 8) * 0.1 * t;

      // Color shifts from white-hot head to colored tail
      const r = THREE.MathUtils.lerp(1.0, baseColor.r, t * 0.7) * fade;
      const g = THREE.MathUtils.lerp(0.95, baseColor.g, t * 0.8) * fade;
      const b = THREE.MathUtils.lerp(0.8, baseColor.b, t * 0.9) * fade;
      c[i * 3] = r;
      c[i * 3 + 1] = g;
      c[i * 3 + 2] = b;
    }

    const geo = lineRef.current.geometry;
    geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;

    // Move glow sphere to head
    if (glowRef.current) {
      glowRef.current.position.set(headX, headY, 0);
      glowRef.current.scale.setScalar(0.3 + (1 - progress) * 0.5);
    }
  });

  const headFade = Math.max(0, 1 - progress * 0.7);

  return (
    <group position={position}>
      {/* Trail line */}
      <line ref={lineRef as any}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[new Float32Array(TRAIL_POINTS * 3), 3]} />
          <bufferAttribute attach="attributes-color" args={[new Float32Array(TRAIL_POINTS * 3), 3]} />
        </bufferGeometry>
        <lineBasicMaterial
          vertexColors
          transparent
          opacity={0.9}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </line>

      {/* Head glow */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[0.4, 12, 12]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.6 * headFade}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Glow handled by bloom — no pointLight to avoid uniform overflow */}
    </group>
  );
}
