import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useProjectStore } from '@/store/useProjectStore';

/**
 * TourbillonEffect — Spiraling ascending pyrotechnic device.
 * Helical trajectory with ribbon-style spark trail, wind integration, mini-burst at apex.
 */

interface TourbillonEffectProps {
  position: [number, number, number];
  progress: number;
  color?: string;
  height?: number;
  spiralRadius?: number;
  rotationSpeed?: number;
  trailLength?: number;
}

const MAX_TRAIL = 200;
const RIBBON_SEGMENTS = 24;

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
  const ribbonRef = useRef<THREE.LineSegments>(null);
  const headRef = useRef<THREE.Mesh>(null);

  const trailBuffer = useMemo(() => new Float32Array(MAX_TRAIL * 3), []);
  const trailColors = useMemo(() => new Float32Array(MAX_TRAIL * 3), []);
  const ribbonPos = useMemo(() => new Float32Array(RIBBON_SEGMENTS * 2 * 3), []);
  const ribbonCol = useMemo(() => new Float32Array(RIBBON_SEGMENTS * 2 * 3), []);
  const baseColor = useMemo(() => new THREE.Color(color), [color]);

  // Pre-allocated vector to avoid per-frame THREE.Vector3 creation
  const headPosRef = useRef(new THREE.Vector3());
  const headPos = headPosRef.current;
  {
    const t = progress;
    const angle = t * rotationSpeed * Math.PI * 2;
    const r = spiralRadius * (1 - t * 0.3);
    headPos.set(Math.cos(angle) * r, t * height, Math.sin(angle) * r);
  }

  useFrame(() => {
    if (!trailRef.current || progress <= 0 || progress > 1) return;

    // Wind integration
    const { wind } = useProjectStore.getState();
    const windRad = (wind.direction * Math.PI) / 180;
    const wX = wind.enabled ? Math.sin(windRad) * wind.speed * 0.02 : 0;
    const wZ = wind.enabled ? Math.cos(windRad) * wind.speed * 0.02 : 0;

    // Build trail from past positions along helix
    const count = Math.min(MAX_TRAIL, Math.floor(trailLength * progress));
    for (let i = 0; i < count; i++) {
      const t = progress - (i / trailLength) * progress;
      const angle = t * rotationSpeed * Math.PI * 2;
      const r = spiralRadius * (1 - t * 0.3);
      const fade = 1 - i / count;

      const windOffset = t * height * 0.1;
      trailBuffer[i * 3] = Math.cos(angle) * r + (Math.random() - 0.5) * 0.1 + wX * windOffset;
      trailBuffer[i * 3 + 1] = t * height;
      trailBuffer[i * 3 + 2] = Math.sin(angle) * r + (Math.random() - 0.5) * 0.1 + wZ * windOffset;

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

    // Ribbon trail — smooth line segments along helix
    if (ribbonRef.current) {
      const rCount = Math.min(RIBBON_SEGMENTS, Math.floor(RIBBON_SEGMENTS * progress));
      for (let i = 0; i < rCount; i++) {
        const t1 = progress - (i / RIBBON_SEGMENTS) * progress;
        const t2 = progress - ((i + 1) / RIBBON_SEGMENTS) * progress;
        const a1 = t1 * rotationSpeed * Math.PI * 2;
        const a2 = t2 * rotationSpeed * Math.PI * 2;
        const r1 = spiralRadius * (1 - t1 * 0.3);
        const r2 = spiralRadius * (1 - t2 * 0.3);
        const ribbonFade = 1 - i / RIBBON_SEGMENTS;
        const wo1 = t1 * height * 0.1;
        const wo2 = t2 * height * 0.1;

        const si = i * 6;
        ribbonPos[si] = Math.cos(a1) * r1 + wX * wo1;
        ribbonPos[si + 1] = t1 * height;
        ribbonPos[si + 2] = Math.sin(a1) * r1 + wZ * wo1;
        ribbonPos[si + 3] = Math.cos(a2) * r2 + wX * wo2;
        ribbonPos[si + 4] = t2 * height;
        ribbonPos[si + 5] = Math.sin(a2) * r2 + wZ * wo2;

        ribbonCol[si] = baseColor.r * ribbonFade * 0.5;
        ribbonCol[si + 1] = baseColor.g * ribbonFade * 0.4;
        ribbonCol[si + 2] = baseColor.b * ribbonFade * 0.3;
        ribbonCol[si + 3] = baseColor.r * ribbonFade * 0.3;
        ribbonCol[si + 4] = baseColor.g * ribbonFade * 0.2;
        ribbonCol[si + 5] = baseColor.b * ribbonFade * 0.15;
      }

      const rGeo = ribbonRef.current.geometry;
      rGeo.setDrawRange(0, rCount * 2);
      const rPos = rGeo.getAttribute('position') as THREE.BufferAttribute;
      const rCol = rGeo.getAttribute('color') as THREE.BufferAttribute;
      if (rPos) rPos.needsUpdate = true;
      if (rCol) rCol.needsUpdate = true;
    }
  });

  if (progress <= 0 || progress > 1.05) return null;

  const showMiniBurst = progress > 0.9;
  const burstProgress = (progress - 0.9) / 0.1;

  return (
    <group position={position}>
      {/* Ribbon trail — smooth helix */}
      <lineSegments ref={ribbonRef} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[ribbonPos, 3]} />
          <bufferAttribute attach="attributes-color" args={[ribbonCol, 3]} />
        </bufferGeometry>
        <lineBasicMaterial vertexColors transparent opacity={0.6} depthWrite={false} blending={THREE.AdditiveBlending} />
      </lineSegments>

      {/* Spark trail */}
      <points ref={trailRef} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[trailBuffer, 3]} />
          <bufferAttribute attach="attributes-color" args={[trailColors, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.25} vertexColors transparent opacity={0.85} depthWrite={false} blending={THREE.AdditiveBlending} sizeAttenuation />
      </points>

      {/* Glowing head */}
      {!showMiniBurst && (
        <mesh ref={headRef} position={[headPos.x, headPos.y, headPos.z]}>
          <sphereGeometry args={[0.3, 8, 8]} />
          <meshBasicMaterial color={color} transparent opacity={0.9} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      )}

      {/* Mini-burst at apex */}
      {showMiniBurst && (
        <mesh position={[headPos.x, headPos.y, headPos.z]} scale={1 + burstProgress * 3}>
          <sphereGeometry args={[0.5, 12, 12]} />
          <meshBasicMaterial color={color} transparent opacity={Math.max(0, 0.8 * (1 - burstProgress))} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      )}

      <pointLight color={color} position={[headPos.x, headPos.y, headPos.z]} intensity={2 * (1 - progress)} distance={10} decay={2} />
    </group>
  );
}
