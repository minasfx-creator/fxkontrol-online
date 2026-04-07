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
 *  - Mini-burst at apex with radial fragmentation particles
 *  - Wobble axis precession for realistic imperfect spin
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
const MAX_SPARKS = 500;
const MAX_BURST_PARTICLES = 80;

export default function TourbillonEffect({
  position,
  progress,
  color = '#FFD700',
  height = 15,
  spiralRadius = 1.5,
  rotationSpeed = 8,
  trailLength = 120,
  nozzleCount = 3,
}: TourbillonEffectProps) {
  const trailRef = useRef<THREE.Points>(null);
  const sparkRef = useRef<THREE.Points>(null);
  const burstRef = useRef<THREE.Points>(null);
  const headRef = useRef<THREE.Mesh>(null);

  const trailBuffer = useMemo(() => new Float32Array(MAX_TRAIL * 3), []);
  const trailColors = useMemo(() => new Float32Array(MAX_TRAIL * 3), []);
  const trailSizes = useMemo(() => new Float32Array(MAX_TRAIL), []);
  const sparkBuffer = useMemo(() => new Float32Array(MAX_SPARKS * 3), []);
  const sparkColors = useMemo(() => new Float32Array(MAX_SPARKS * 3), []);
  const burstBuffer = useMemo(() => new Float32Array(MAX_BURST_PARTICLES * 3), []);
  const burstColors = useMemo(() => new Float32Array(MAX_BURST_PARTICLES * 3), []);
  const baseColor = useMemo(() => new THREE.Color(color), [color]);

  // Wobble seed — each tourbillon has a unique precession axis
  const wobbleSeed = useMemo(() => ({
    freqX: 2.5 + Math.random() * 2,
    freqZ: 3.0 + Math.random() * 2,
    ampX: 0.08 + Math.random() * 0.06,
    ampZ: 0.06 + Math.random() * 0.05,
    phaseX: Math.random() * Math.PI * 2,
    phaseZ: Math.random() * Math.PI * 2,
  }), []);

  // Burst particle seeds
  const burstSeeds = useMemo(() => {
    const s = [];
    for (let i = 0; i < MAX_BURST_PARTICLES; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      s.push({
        vx: Math.sin(phi) * Math.cos(theta) * (3 + Math.random() * 4),
        vy: Math.sin(phi) * Math.sin(theta) * (3 + Math.random() * 4) + 1,
        vz: Math.cos(phi) * (3 + Math.random() * 4),
        life: 0.4 + Math.random() * 0.6,
        hueShift: (Math.random() - 0.5) * 0.15,
      });
    }
    return s;
  }, []);

  const headPosRef = useRef(new THREE.Vector3());

  // Exponential spin-up: ω(t) = ωmax * (1 - e^(-k*t)), k=4
  const getOmega = (t: number) => rotationSpeed * (1 - Math.exp(-4 * t));

  // Integrated angle: ∫ω dt = ωmax * [t + (1/k)*e^(-kt) - 1/k]
  const getAngle = (t: number) => {
    const k = 4;
    return rotationSpeed * (t + (1 / k) * Math.exp(-k * t) - 1 / k) * Math.PI * 2;
  };

  // Radius: centrifugal growth vs drag decay + wobble
  const getRadius = (t: number, time: number) => {
    const centrifugalGrowth = 1 + t * 0.18;
    const dragDecay = Math.exp(-t * 0.7);
    const wobbleX = Math.sin(time * wobbleSeed.freqX + wobbleSeed.phaseX) * wobbleSeed.ampX * t;
    return spiralRadius * centrifugalGrowth * dragDecay + wobbleX;
  };

  // Vertical thrust: solid propellant grain regression model
  const getHeight = (t: number) => {
    // Progressive burn: initial surge, then steady, then taper
    const burn = t < 0.3 ? t / 0.3 * 1.2 : t < 0.8 ? 1.0 : (1 - t) / 0.2 * 0.6;
    const integral = t < 0.3 ? (t * t / 0.3 * 1.2 / 2) :
      (0.3 * 1.2 / 2 + (t - 0.3) * 1.0) ;
    return height * (1 - Math.exp(-3 * t)) * (0.8 + burn * 0.2);
  };

  // Wobble offset on Z axis
  const getWobbleZ = (t: number, time: number) => {
    return Math.sin(time * wobbleSeed.freqZ + wobbleSeed.phaseZ) * wobbleSeed.ampZ * t;
  };

  useFrame(({ clock }) => {
    if (progress <= 0 || progress > 1.15) return;

    const { wind } = useProjectStore.getState();
    const windRad = (wind.direction * Math.PI) / 180;
    const wX = wind.enabled ? Math.sin(windRad) * wind.speed * 0.025 : 0;
    const wZ = wind.enabled ? Math.cos(windRad) * wind.speed * 0.025 : 0;
    const time = clock.getElapsedTime();

    // ── Update head position ──
    const headPos = headPosRef.current;
    const clampedP = Math.min(progress, 1.0);
    const angle = getAngle(clampedP);
    const r = getRadius(clampedP, time);
    const wZ_off = getWobbleZ(clampedP, time);
    headPos.set(
      Math.cos(angle) * r + wX * clampedP * 5,
      getHeight(clampedP),
      Math.sin(angle) * r + wZ_off + wZ * clampedP * 5
    );

    // ── Trail: reconstruct past helical positions with size taper ──
    if (trailRef.current) {
      const count = Math.min(MAX_TRAIL, Math.floor(trailLength * clampedP));
      for (let i = 0; i < count; i++) {
        const t = clampedP - (i / trailLength) * clampedP;
        const a = getAngle(t);
        const rad = getRadius(t, time - (i / trailLength) * 0.5);
        const h = getHeight(t);
        const wobZ = getWobbleZ(t, time - (i / trailLength) * 0.3);
        const fade = Math.pow(1 - i / count, 1.8);
        const windDrift = h * 0.06;

        trailBuffer[i * 3] = Math.cos(a) * rad + (Math.random() - 0.5) * 0.06 + wX * windDrift;
        trailBuffer[i * 3 + 1] = h;
        trailBuffer[i * 3 + 2] = Math.sin(a) * rad + wobZ + (Math.random() - 0.5) * 0.06 + wZ * windDrift;

        // Core-to-ember with nozzle color variation
        const emberT = Math.pow(i / count, 0.5);
        trailColors[i * 3] = THREE.MathUtils.lerp(1.2, baseColor.r * 0.3, emberT) * fade;
        trailColors[i * 3 + 1] = THREE.MathUtils.lerp(0.95, baseColor.g * 0.15, emberT) * fade;
        trailColors[i * 3 + 2] = THREE.MathUtils.lerp(0.5, baseColor.b * 0.08, emberT) * fade;

        // Size taper: thick at head, thin at tail
        trailSizes[i] = THREE.MathUtils.lerp(0.28, 0.06, i / count) * fade;
      }

      const geo = trailRef.current.geometry;
      geo.setDrawRange(0, count);
      (geo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
      (geo.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;
    }

    // ── Nozzle sparks: tangential + centrifugal emission ──
    if (sparkRef.current && clampedP < 1.0) {
      const omega = getOmega(clampedP);
      const sparkCount = Math.min(MAX_SPARKS, Math.floor(MAX_SPARKS * clampedP * 0.85));

      for (let i = 0; i < sparkCount; i++) {
        const sparkAge = (i / sparkCount) * 0.35;
        const spawnT = Math.max(0, clampedP - sparkAge * 0.5);
        const nozzle = i % nozzleCount;
        const nozzleOffset = (nozzle / nozzleCount) * Math.PI * 2;

        const a = getAngle(spawnT) + nozzleOffset;
        const rad = getRadius(spawnT, time - sparkAge);
        const h = getHeight(spawnT);
        const wobZ = getWobbleZ(spawnT, time - sparkAge);

        // Tangential velocity from rotation
        const tangentialSpeed = omega * rad * 0.35;
        const tangentX = -Math.sin(a) * tangentialSpeed * sparkAge;
        const tangentZ = Math.cos(a) * tangentialSpeed * sparkAge;

        // Centrifugal throw
        const centrifugalX = Math.cos(a) * omega * 0.06 * sparkAge;
        const centrifugalZ = Math.sin(a) * omega * 0.06 * sparkAge;

        // Gravity + drag on sparks
        const sparkGravity = -4.9 * sparkAge * sparkAge;
        const sparkDrag = Math.exp(-2 * sparkAge);

        const jX = (Math.random() - 0.5) * 0.12;
        const jZ = (Math.random() - 0.5) * 0.12;

        sparkBuffer[i * 3] = Math.cos(a) * rad + (tangentX + centrifugalX) * sparkDrag + jX + wX * sparkAge * h * 0.08;
        sparkBuffer[i * 3 + 1] = h + sparkGravity + (Math.random() - 0.5) * 0.08;
        sparkBuffer[i * 3 + 2] = Math.sin(a) * rad + wobZ + (tangentZ + centrifugalZ) * sparkDrag + jZ + wZ * sparkAge * h * 0.08;

        const sparkFade = Math.max(0, 1 - sparkAge / 0.35);
        // Per-nozzle slight hue shift
        const hueShift = nozzle * 0.03;
        sparkColors[i * 3] = THREE.MathUtils.lerp(baseColor.r + hueShift, 1.0, sparkFade * 0.3) * sparkFade;
        sparkColors[i * 3 + 1] = THREE.MathUtils.lerp(baseColor.g, 0.8, sparkFade * 0.2) * sparkFade;
        sparkColors[i * 3 + 2] = THREE.MathUtils.lerp(baseColor.b, 0.3, sparkFade * 0.1) * sparkFade;
      }

      // Hide unused
      for (let i = sparkCount; i < MAX_SPARKS; i++) {
        sparkBuffer[i * 3 + 1] = -200;
        sparkColors[i * 3] = 0; sparkColors[i * 3 + 1] = 0; sparkColors[i * 3 + 2] = 0;
      }

      const sGeo = sparkRef.current.geometry;
      sGeo.setDrawRange(0, sparkCount);
      (sGeo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
      (sGeo.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;
    }

    // ── Apex mini-burst: radial fragmentation particles ──
    if (burstRef.current && progress > 0.88) {
      const burstT = Math.min(1, (progress - 0.88) / 0.12);
      const apexPos = headPosRef.current;

      for (let i = 0; i < MAX_BURST_PARTICLES; i++) {
        const seed = burstSeeds[i];
        const age = burstT * seed.life;
        const grav = -9.81 * age * age * 0.5;
        const drag = Math.exp(-1.5 * age);

        burstBuffer[i * 3] = apexPos.x + seed.vx * age * drag + wX * age;
        burstBuffer[i * 3 + 1] = apexPos.y + seed.vy * age * drag + grav;
        burstBuffer[i * 3 + 2] = apexPos.z + seed.vz * age * drag + wZ * age;

        const fade = Math.max(0, 1 - burstT) * Math.max(0, 1 - age / seed.life);
        burstColors[i * 3] = (baseColor.r + seed.hueShift) * fade * 1.3;
        burstColors[i * 3 + 1] = baseColor.g * fade * 1.1;
        burstColors[i * 3 + 2] = baseColor.b * fade * 0.8;
      }

      (burstRef.current.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
      (burstRef.current.geometry.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;
    }
  });

  if (progress <= 0 || progress > 1.15) return null;

  const showBurst = progress > 0.88;
  const headPos = headPosRef.current;

  return (
    <group position={position} renderOrder={50}>
      {/* Nozzle sparks */}
      <points ref={sparkRef} frustumCulled={false} renderOrder={50}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[sparkBuffer, 3]} />
          <bufferAttribute attach="attributes-color" args={[sparkColors, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.16} vertexColors transparent opacity={0.9} depthWrite={false} depthTest={false} blending={THREE.AdditiveBlending} sizeAttenuation />
      </points>

      {/* Helical trail with taper */}
      <points ref={trailRef} frustumCulled={false} renderOrder={50}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[trailBuffer, 3]} />
          <bufferAttribute attach="attributes-color" args={[trailColors, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.22} vertexColors transparent opacity={0.85} depthWrite={false} depthTest={false} blending={THREE.AdditiveBlending} sizeAttenuation />
      </points>

      {/* Glowing head with pulsing */}
      {!showBurst && (
        <mesh ref={headRef} position={[headPos.x, headPos.y, headPos.z]} renderOrder={51}>
          <sphereGeometry args={[0.3, 8, 8]} />
          <meshBasicMaterial color={color} transparent opacity={0.95} blending={THREE.AdditiveBlending} depthWrite={false} depthTest={false} />
        </mesh>
      )}

      {/* Apex burst particles */}
      {showBurst && (
        <points ref={burstRef} frustumCulled={false} renderOrder={52}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[burstBuffer, 3]} />
            <bufferAttribute attach="attributes-color" args={[burstColors, 3]} />
          </bufferGeometry>
          <pointsMaterial size={0.2} vertexColors transparent opacity={0.9} depthWrite={false} depthTest={false} blending={THREE.AdditiveBlending} sizeAttenuation />
        </points>
      )}

      <pointLight color={color} position={[headPos.x, headPos.y, headPos.z]} intensity={3.0 * Math.max(0, 1 - progress)} distance={15} decay={2} />
    </group>
  );
}
