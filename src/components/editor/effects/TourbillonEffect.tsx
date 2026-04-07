import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useProjectStore } from '@/store/useProjectStore';

/**
 * TourbillonEffect — Spiraling ascending pyrotechnic device.
 * Calibrated to Weingart/Browne manuals:
 *  - Helical trajectory with exponential spin-up ω = ωmax(1-e^(-kt))
 *  - Variable radius decay (centrifugal vs drag)
 *  - Multi-nozzle spark emission with tangential + centrifugal components
 *  - Wind integration on spark trails
 *  - Mini-burst at apex with radial fragmentation
 */

interface TourbillonEffectProps {
  position: [number, number, number];
  progress: number;
  color?: string;
  height?: number;
  spiralRadius?: number;
  rotationSpeed?: number;
  trailLength?: number;
  nozzleCount?: number;
}

const MAX_TRAIL = 300;
const MAX_SPARKS = 400;

export default function TourbillonEffect({
  position,
  progress,
  color = '#FFD700',
  height = 15,
  spiralRadius = 1.5,
  rotationSpeed = 8,
  trailLength = 100,
  nozzleCount = 3,
}: TourbillonEffectProps) {
  const trailRef = useRef<THREE.Points>(null);
  const sparkRef = useRef<THREE.Points>(null);
  const headRef = useRef<THREE.Mesh>(null);

  const trailBuffer = useMemo(() => new Float32Array(MAX_TRAIL * 3), []);
  const trailColors = useMemo(() => new Float32Array(MAX_TRAIL * 3), []);
  const sparkBuffer = useMemo(() => new Float32Array(MAX_SPARKS * 3), []);
  const sparkColors = useMemo(() => new Float32Array(MAX_SPARKS * 3), []);
  const baseColor = useMemo(() => new THREE.Color(color), [color]);

  // Pre-allocated vectors
  const headPosRef = useRef(new THREE.Vector3());

  // Exponential spin-up: ω(t) = ωmax * (1 - e^(-k*t)), k=4
  const getOmega = (t: number) => rotationSpeed * (1 - Math.exp(-4 * t));

  // Integrated angle: ∫ω dt = ωmax * [t + (1/k)*e^(-kt) - 1/k]
  const getAngle = (t: number) => {
    const k = 4;
    return rotationSpeed * (t + (1 / k) * Math.exp(-k * t) - 1 / k) * Math.PI * 2;
  };

  // Radius decay: centrifugal force vs air drag
  const getRadius = (t: number) => {
    const centrifugalGrowth = 1 + t * 0.15;
    const dragDecay = Math.exp(-t * 0.8);
    return spiralRadius * centrifugalGrowth * dragDecay;
  };

  // Vertical thrust with diminishing fuel
  const getHeight = (t: number) => {
    // Thrust curve: strong initial, decaying — like solid propellant
    const thrustIntegral = 1 - Math.exp(-3 * t);
    return height * thrustIntegral;
  };

  // Compute head position
  const headPos = headPosRef.current;
  {
    const t = progress;
    const angle = getAngle(t);
    const r = getRadius(t);
    headPos.set(Math.cos(angle) * r, getHeight(t), Math.sin(angle) * r);
  }

  useFrame(({ clock }) => {
    if (progress <= 0 || progress > 1) return;

    const { wind } = useProjectStore.getState();
    const windRad = (wind.direction * Math.PI) / 180;
    const wX = wind.enabled ? Math.sin(windRad) * wind.speed * 0.02 : 0;
    const wZ = wind.enabled ? Math.cos(windRad) * wind.speed * 0.02 : 0;
    const time = clock.getElapsedTime();

    // ── Trail: reconstruct past helical positions ──
    if (trailRef.current) {
      const count = Math.min(MAX_TRAIL, Math.floor(trailLength * progress));
      for (let i = 0; i < count; i++) {
        const t = progress - (i / trailLength) * progress;
        const angle = getAngle(t);
        const r = getRadius(t);
        const h = getHeight(t);
        const fade = Math.pow(1 - i / count, 1.5);
        const windOffset = h * 0.08;

        trailBuffer[i * 3] = Math.cos(angle) * r + (Math.random() - 0.5) * 0.08 + wX * windOffset;
        trailBuffer[i * 3 + 1] = h;
        trailBuffer[i * 3 + 2] = Math.sin(angle) * r + (Math.random() - 0.5) * 0.08 + wZ * windOffset;

        // Core-to-ember color transition
        const emberT = Math.pow(i / count, 0.6);
        trailColors[i * 3] = THREE.MathUtils.lerp(1.1, baseColor.r * 0.4, emberT) * fade;
        trailColors[i * 3 + 1] = THREE.MathUtils.lerp(0.9, baseColor.g * 0.2, emberT) * fade;
        trailColors[i * 3 + 2] = THREE.MathUtils.lerp(0.6, baseColor.b * 0.1, emberT) * fade;
      }

      const geo = trailRef.current.geometry;
      geo.setDrawRange(0, count);
      const posAttr = geo.getAttribute('position') as THREE.BufferAttribute;
      const colAttr = geo.getAttribute('color') as THREE.BufferAttribute;
      if (posAttr) posAttr.needsUpdate = true;
      if (colAttr) colAttr.needsUpdate = true;
    }

    // ── Nozzle sparks: tangential + centrifugal emission ──
    if (sparkRef.current) {
      const omega = getOmega(progress);
      const sparkCount = Math.min(MAX_SPARKS, Math.floor(MAX_SPARKS * progress * 0.8));

      for (let i = 0; i < sparkCount; i++) {
        const sparkAge = (i / sparkCount) * 0.3; // max 0.3s age
        const spawnT = Math.max(0, progress - sparkAge * 0.5);
        const nozzle = i % nozzleCount;
        const nozzleOffset = (nozzle / nozzleCount) * Math.PI * 2;

        const angle = getAngle(spawnT) + nozzleOffset;
        const r = getRadius(spawnT);
        const h = getHeight(spawnT);

        // Tangential velocity from rotation
        const tangentialSpeed = omega * r * 0.3;
        const tangentX = -Math.sin(angle) * tangentialSpeed * sparkAge;
        const tangentZ = Math.cos(angle) * tangentialSpeed * sparkAge;

        // Centrifugal throw
        const centrifugalX = Math.cos(angle) * omega * 0.05 * sparkAge;
        const centrifugalZ = Math.sin(angle) * omega * 0.05 * sparkAge;

        // Gravity on sparks
        const sparkGravity = -4.9 * sparkAge * sparkAge;

        const jitterX = (Math.random() - 0.5) * 0.15;
        const jitterZ = (Math.random() - 0.5) * 0.15;

        sparkBuffer[i * 3] = Math.cos(angle) * r + tangentX + centrifugalX + jitterX + wX * sparkAge * h * 0.1;
        sparkBuffer[i * 3 + 1] = h + sparkGravity + (Math.random() - 0.5) * 0.1;
        sparkBuffer[i * 3 + 2] = Math.sin(angle) * r + tangentZ + centrifugalZ + jitterZ + wZ * sparkAge * h * 0.1;

        const sparkFade = Math.max(0, 1 - sparkAge / 0.3);
        const nozzleHue = nozzle / nozzleCount;
        sparkColors[i * 3] = THREE.MathUtils.lerp(baseColor.r, 1.0, sparkFade * 0.3) * sparkFade;
        sparkColors[i * 3 + 1] = THREE.MathUtils.lerp(baseColor.g, 0.8, sparkFade * 0.2) * sparkFade;
        sparkColors[i * 3 + 2] = THREE.MathUtils.lerp(baseColor.b, 0.3, sparkFade * 0.1) * sparkFade;
      }

      const sGeo = sparkRef.current.geometry;
      sGeo.setDrawRange(0, sparkCount);
      const sPos = sGeo.getAttribute('position') as THREE.BufferAttribute;
      const sCol = sGeo.getAttribute('color') as THREE.BufferAttribute;
      if (sPos) sPos.needsUpdate = true;
      if (sCol) sCol.needsUpdate = true;
    }
  });

  if (progress <= 0 || progress > 1.05) return null;

  const showMiniBurst = progress > 0.9;
  const burstProgress = (progress - 0.9) / 0.1;

  return (
    <group position={position} renderOrder={50}>
      {/* Nozzle sparks — tangential emission */}
      <points ref={sparkRef} frustumCulled={false} renderOrder={50}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[sparkBuffer, 3]} />
          <bufferAttribute attach="attributes-color" args={[sparkColors, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.18} vertexColors transparent opacity={0.9} depthWrite={false} depthTest={false} blending={THREE.AdditiveBlending} sizeAttenuation />
      </points>

      {/* Helical trail */}
      <points ref={trailRef} frustumCulled={false} renderOrder={50}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[trailBuffer, 3]} />
          <bufferAttribute attach="attributes-color" args={[trailColors, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.22} vertexColors transparent opacity={0.85} depthWrite={false} depthTest={false} blending={THREE.AdditiveBlending} sizeAttenuation />
      </points>

      {/* Glowing head */}
      {!showMiniBurst && (
        <mesh ref={headRef} position={[headPos.x, headPos.y, headPos.z]} renderOrder={50}>
          <sphereGeometry args={[0.25, 8, 8]} />
          <meshBasicMaterial color={color} transparent opacity={0.95} blending={THREE.AdditiveBlending} depthWrite={false} depthTest={false} />
        </mesh>
      )}

      {/* Mini-burst at apex — radial fragmentation */}
      {showMiniBurst && (
        <mesh position={[headPos.x, headPos.y, headPos.z]} scale={1 + burstProgress * 4} renderOrder={50}>
          <sphereGeometry args={[0.4, 12, 12]} />
          <meshBasicMaterial color={color} transparent opacity={Math.max(0, 0.9 * (1 - burstProgress))} blending={THREE.AdditiveBlending} depthWrite={false} depthTest={false} />
        </mesh>
      )}

      <pointLight color={color} position={[headPos.x, headPos.y, headPos.z]} intensity={2.5 * (1 - progress)} distance={12} decay={2} />
    </group>
  );
}
