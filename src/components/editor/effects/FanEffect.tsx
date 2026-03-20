import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const RAYS = 9;
const PARTICLES_PER_RAY = 30;
const TOTAL_PARTICLES = RAYS * PARTICLES_PER_RAY;

/**
 * Fan effect: Multiple rays of particles spreading in an arc pattern.
 * Simulates angled mortar spreads (90° or 180°).
 */
export default function FanEffect({
  position,
  color,
  progress,
  spreadAngle = 90,
  caliber = 3,
}: {
  position: [number, number, number];
  color: string;
  progress: number;
  spreadAngle?: number;
  caliber?: number;
}) {
  // Scale ray height and particle count based on caliber
  const caliberScale = 0.7 + caliber * 0.12;
  const pointsRef = useRef<THREE.Points>(null);
  const linesRef = useRef<THREE.LineSegments>(null);
  const baseColor = useMemo(() => new THREE.Color(color), [color]);

  const posArr = useRef(new Float32Array(TOTAL_PARTICLES * 3));
  const colArr = useRef(new Float32Array(TOTAL_PARTICLES * 3));
  const linePos = useRef(new Float32Array(RAYS * 2 * 3)); // one line per ray
  const lineCol = useRef(new Float32Array(RAYS * 2 * 3));

  useFrame(() => {
    if (!pointsRef.current || !linesRef.current) return;

    const p = posArr.current;
    const c = colArr.current;
    const lp = linePos.current;
    const lc = lineCol.current;
    const halfSpread = (spreadAngle * Math.PI) / 360;
    const t = progress * 2;

    for (let ray = 0; ray < RAYS; ray++) {
      // Angle for this ray within the fan spread
      const rayAngle = -halfSpread + (ray / (RAYS - 1)) * halfSpread * 2;
      const speed = 4 + Math.sin(ray * 1.5) * 1.5;

      const dirX = Math.sin(rayAngle);
      const dirY = Math.cos(rayAngle) * 0.8 + 0.5; // upward bias
      const dirZ = 0;

      // Ray line (origin to tip)
      const tipDist = speed * t * 0.8;
      const rayFade = Math.max(0, 1 - progress * 0.7);
      lp[ray * 6] = 0;
      lp[ray * 6 + 1] = 0;
      lp[ray * 6 + 2] = 0;
      lp[ray * 6 + 3] = dirX * tipDist;
      lp[ray * 6 + 4] = dirY * tipDist;
      lp[ray * 6 + 5] = dirZ * tipDist;

      lc[ray * 6] = baseColor.r * rayFade * 0.4;
      lc[ray * 6 + 1] = baseColor.g * rayFade * 0.4;
      lc[ray * 6 + 2] = baseColor.b * rayFade * 0.4;
      lc[ray * 6 + 3] = baseColor.r * rayFade * 0.1;
      lc[ray * 6 + 4] = baseColor.g * rayFade * 0.1;
      lc[ray * 6 + 5] = baseColor.b * rayFade * 0.1;

      // Particles along this ray
      for (let j = 0; j < PARTICLES_PER_RAY; j++) {
        const idx = ray * PARTICLES_PER_RAY + j;
        const pct = j / PARTICLES_PER_RAY;
        const dist = pct * speed * t;
        const gravity = -2 * pct * pct * t;
        const scatter = Math.sin(j * 13.7 + ray * 5.1) * 0.3 * pct;

        p[idx * 3] = dirX * dist + scatter;
        p[idx * 3 + 1] = dirY * dist + gravity;
        p[idx * 3 + 2] = dirZ * dist + Math.cos(j * 7.3 + ray * 3.3) * 0.2 * pct;

        const fade = Math.max(0, 1 - pct * 0.6) * Math.max(0, 1 - progress * 0.8);
        const sparkle = 0.7 + Math.sin(j * 17 + progress * 30) * 0.3;
        c[idx * 3] = THREE.MathUtils.lerp(1, baseColor.r, pct * 0.8) * fade * sparkle;
        c[idx * 3 + 1] = THREE.MathUtils.lerp(0.9, baseColor.g, pct * 0.9) * fade * sparkle;
        c[idx * 3 + 2] = THREE.MathUtils.lerp(0.6, baseColor.b, pct) * fade * sparkle;
      }
    }

    // Update points
    const pGeo = pointsRef.current.geometry;
    pGeo.setAttribute('position', new THREE.BufferAttribute(p, 3));
    pGeo.setAttribute('color', new THREE.BufferAttribute(c, 3));
    pGeo.attributes.position.needsUpdate = true;
    pGeo.attributes.color.needsUpdate = true;

    // Update lines
    const lGeo = linesRef.current.geometry;
    lGeo.setAttribute('position', new THREE.BufferAttribute(lp, 3));
    lGeo.setAttribute('color', new THREE.BufferAttribute(lc, 3));
    lGeo.attributes.position.needsUpdate = true;
    lGeo.attributes.color.needsUpdate = true;
  });

  return (
    <group position={position}>
      {/* Launch flash */}
      {progress < 0.1 && (
        <pointLight
          color={color}
          intensity={10 * (1 - progress / 0.1)}
          distance={15}
          decay={2}
        />
      )}

      {/* Ray lines */}
      <lineSegments ref={linesRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[new Float32Array(RAYS * 2 * 3), 3]} />
          <bufferAttribute attach="attributes-color" args={[new Float32Array(RAYS * 2 * 3), 3]} />
        </bufferGeometry>
        <lineBasicMaterial
          vertexColors
          transparent
          opacity={0.6}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </lineSegments>

      {/* Particles */}
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[new Float32Array(TOTAL_PARTICLES * 3), 3]} />
          <bufferAttribute attach="attributes-color" args={[new Float32Array(TOTAL_PARTICLES * 3), 3]} />
        </bufferGeometry>
        <pointsMaterial
          size={0.14}
          vertexColors
          transparent
          opacity={0.95}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          sizeAttenuation
        />
      </points>

      {/* Base glow */}
      {progress < 0.3 && (
        <mesh>
          <sphereGeometry args={[0.4 + progress * 2, 12, 12]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.1 * (1 - progress / 0.3)}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      )}
    </group>
  );
}
