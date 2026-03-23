import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * WheelEffect — Rotating Catherine wheel with radial gerb emissions.
 * Enhanced with ribbon-style trails per arm for trailing spark arcs.
 */

interface WheelEffectProps {
  position: [number, number, number];
  progress: number;
  color?: string;
  secondaryColor?: string;
  armCount?: number;
  radius?: number;
  rotationSpeed?: number;
}

const MAX_PARTICLES = 600;
const RIBBON_PER_ARM = 16;

export default function WheelEffect({
  position,
  progress,
  color = '#FFD700',
  secondaryColor = '#FF4500',
  armCount = 4,
  radius = 2,
  rotationSpeed = 2,
}: WheelEffectProps) {
  const trailRef = useRef<THREE.Points>(null);
  const ribbonRef = useRef<THREE.LineSegments>(null);
  const posBuffer = useMemo(() => new Float32Array(MAX_PARTICLES * 3), []);
  const colBuffer = useMemo(() => new Float32Array(MAX_PARTICLES * 3), []);
  const ribbonPos = useMemo(() => new Float32Array(armCount * RIBBON_PER_ARM * 2 * 3), [armCount]);
  const ribbonCol = useMemo(() => new Float32Array(armCount * RIBBON_PER_ARM * 2 * 3), [armCount]);
  const baseColor = useMemo(() => new THREE.Color(color), [color]);
  const altColor = useMemo(() => new THREE.Color(secondaryColor), [secondaryColor]);

  const sparkHistory = useRef<{ x: number; y: number; z: number; age: number; armIdx: number }[]>([]);

  useFrame((_, delta) => {
    if (!trailRef.current || progress <= 0 || progress > 1) return;

    const dt = Math.min(delta, 0.05);
    const rotation = progress * rotationSpeed * Math.PI * 2;
    const intensity = progress < 0.05 ? progress / 0.05 : progress > 0.9 ? (1 - progress) / 0.1 : 1;

    if (intensity > 0.1) {
      for (let arm = 0; arm < armCount; arm++) {
        const armAngle = rotation + (arm / armCount) * Math.PI * 2;
        const tipX = Math.cos(armAngle) * radius;
        const tipY = Math.sin(armAngle) * radius;

        const emitCount = 2 + Math.floor(Math.random() * 2);
        for (let e = 0; e < emitCount; e++) {
          sparkHistory.current.push({
            x: tipX + Math.cos(armAngle) * 1.5 * 0.02 + (Math.random() - 0.5) * 0.1,
            y: tipY + Math.sin(armAngle) * 1.5 * 0.02 + (Math.random() - 0.5) * 0.1,
            z: (Math.random() - 0.5) * 0.3,
            age: 0,
            armIdx: arm,
          });
        }
      }
    }

    // Mutate in-place to avoid GC pressure from .map() spread
    const hist = sparkHistory.current;
    let writeIdx = 0;
    for (let h = 0; h < hist.length; h++) {
      const s = hist[h];
      s.age += dt;
      s.y -= 2 * dt * (s.age - dt); // use pre-update age
      if (s.age < 0.6) {
        hist[writeIdx++] = s;
      }
    }
    hist.length = Math.min(writeIdx, MAX_PARTICLES);
    sparkHistory.current = hist;

    const count = Math.min(sparkHistory.current.length, MAX_PARTICLES);
    for (let i = 0; i < count; i++) {
      const s = sparkHistory.current[i];
      const fade = Math.max(0, 1 - s.age / 0.6);
      posBuffer[i * 3] = s.x;
      posBuffer[i * 3 + 1] = s.y;
      posBuffer[i * 3 + 2] = s.z;

      const c = s.armIdx % 2 === 0 ? baseColor : altColor;
      colBuffer[i * 3] = c.r * fade;
      colBuffer[i * 3 + 1] = c.g * fade * 0.9;
      colBuffer[i * 3 + 2] = c.b * fade * 0.7;
    }

    const geo = trailRef.current.geometry;
    geo.setDrawRange(0, count);
    const posAttr = geo.getAttribute('position') as THREE.BufferAttribute;
    const colAttr = geo.getAttribute('color') as THREE.BufferAttribute;
    if (posAttr) posAttr.needsUpdate = true;
    if (colAttr) colAttr.needsUpdate = true;

    // Ribbon trails per arm — arc segments trailing behind each arm tip
    if (ribbonRef.current) {
      let rIdx = 0;
      for (let arm = 0; arm < armCount; arm++) {
        const armColor = arm % 2 === 0 ? baseColor : altColor;
        for (let seg = 0; seg < RIBBON_PER_ARM; seg++) {
          const t1 = progress - (seg / RIBBON_PER_ARM) * 0.15;
          const t2 = progress - ((seg + 1) / RIBBON_PER_ARM) * 0.15;
          if (t1 < 0 || t2 < 0) {
            ribbonPos[rIdx * 3 + 1] = -100;
            ribbonPos[(rIdx + 1) * 3 + 1] = -100;
            ribbonCol[rIdx * 3] = 0; ribbonCol[rIdx * 3 + 1] = 0; ribbonCol[rIdx * 3 + 2] = 0;
            ribbonCol[(rIdx + 1) * 3] = 0; ribbonCol[(rIdx + 1) * 3 + 1] = 0; ribbonCol[(rIdx + 1) * 3 + 2] = 0;
            rIdx += 2;
            continue;
          }

          const a1 = t1 * rotationSpeed * Math.PI * 2 + (arm / armCount) * Math.PI * 2;
          const a2 = t2 * rotationSpeed * Math.PI * 2 + (arm / armCount) * Math.PI * 2;
          const ribbonFade = Math.max(0, 1 - seg / RIBBON_PER_ARM) * intensity * 0.4;

          ribbonPos[rIdx * 3] = Math.cos(a1) * radius;
          ribbonPos[rIdx * 3 + 1] = Math.sin(a1) * radius;
          ribbonPos[rIdx * 3 + 2] = 0;
          ribbonPos[(rIdx + 1) * 3] = Math.cos(a2) * radius;
          ribbonPos[(rIdx + 1) * 3 + 1] = Math.sin(a2) * radius;
          ribbonPos[(rIdx + 1) * 3 + 2] = 0;

          ribbonCol[rIdx * 3] = armColor.r * ribbonFade;
          ribbonCol[rIdx * 3 + 1] = armColor.g * ribbonFade * 0.8;
          ribbonCol[rIdx * 3 + 2] = armColor.b * ribbonFade * 0.5;
          ribbonCol[(rIdx + 1) * 3] = armColor.r * ribbonFade * 0.5;
          ribbonCol[(rIdx + 1) * 3 + 1] = armColor.g * ribbonFade * 0.3;
          ribbonCol[(rIdx + 1) * 3 + 2] = armColor.b * ribbonFade * 0.2;

          rIdx += 2;
        }
      }

      const rGeo = ribbonRef.current.geometry;
      const rPos = rGeo.getAttribute('position') as THREE.BufferAttribute;
      const rCol = rGeo.getAttribute('color') as THREE.BufferAttribute;
      if (rPos) rPos.needsUpdate = true;
      if (rCol) rCol.needsUpdate = true;
    }
  });

  if (progress <= 0 || progress > 1) return null;

  const rotation = progress * rotationSpeed * Math.PI * 2;

  return (
    <group position={position}>
      {Array.from({ length: armCount }).map((_, arm) => {
        const angle = rotation + (arm / armCount) * Math.PI * 2;
        return (
          <mesh key={arm} rotation={[0, 0, angle]}>
            <boxGeometry args={[radius * 2, 0.04, 0.04]} />
            <meshBasicMaterial color="#333" transparent opacity={0.3} />
          </mesh>
        );
      })}

      {/* Ribbon trails per arm */}
      <lineSegments ref={ribbonRef} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[ribbonPos, 3]} />
          <bufferAttribute attach="attributes-color" args={[ribbonCol, 3]} />
        </bufferGeometry>
        <lineBasicMaterial vertexColors transparent opacity={0.5} depthWrite={false} blending={THREE.AdditiveBlending} />
      </lineSegments>

      <points ref={trailRef} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[posBuffer, 3]} />
          <bufferAttribute attach="attributes-color" args={[colBuffer, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.12} vertexColors transparent opacity={0.9} depthWrite={false} blending={THREE.AdditiveBlending} sizeAttenuation />
      </points>

      <mesh>
        <cylinderGeometry args={[0.15, 0.15, 0.1, 12]} />
        <meshBasicMaterial color="#555" />
      </mesh>
    </group>
  );
}
