import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { attackReleaseEnvelope } from '@/lib/pyroNoise';
import { getThreeBlending } from '@/lib/niagaraBlenderRules';
import { useProjectStore } from '@/store/useProjectStore';

const PARTICLE_COUNT = 300;
const GROUND_FOG_COUNT = 60;
const CONDENSATION_COUNT = 40;

/**
 * CO2 Cryo Jet — Dense volumetric fog with soft-particle-style depth awareness.
 * Wind integration + ground collision module.
 */
export default function CryoJetEffect({
  position,
  color = '#FFFFFF',
  progress,
  height = 6,
  horizontal = false,
}: {
  position: [number, number, number];
  color?: string;
  progress: number;
  height?: number;
  horizontal?: boolean;
}) {
  const pointsRef = useRef<THREE.Points>(null);
  const groundFogRef = useRef<THREE.Points>(null);
  const condensationRef = useRef<THREE.Points>(null);
  const cloudRefs = useRef<(THREE.Mesh | null)[]>([]);
  const CLOUD_COUNT = 12;

  const posRef = useMemo(() => new Float32Array(PARTICLE_COUNT * 3), []);
  const colRef = useMemo(() => new Float32Array(PARTICLE_COUNT * 3), []);
  const groundFogPos = useMemo(() => new Float32Array(GROUND_FOG_COUNT * 3), []);
  const groundFogCol = useMemo(() => new Float32Array(GROUND_FOG_COUNT * 3), []);
  const condensationPos = useMemo(() => new Float32Array(CONDENSATION_COUNT * 3), []);
  const condensationCol = useMemo(() => new Float32Array(CONDENSATION_COUNT * 3), []);

  const baseColor = useMemo(() => new THREE.Color(color), [color]);
  const coolTint = useMemo(() => new THREE.Color('#e8f0ff'), []);

  const seeds = useMemo(() => {
    const s: { angle: number; speed: number; spread: number; lt: number; phase: number }[] = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      s.push({
        angle: Math.random() * Math.PI * 2,
        speed: height * (0.4 + Math.random() * 1.1),
        spread: 0.1 + Math.random() * 0.25,
        lt: 0.25 + Math.random() * 0.5,
        phase: Math.random() * Math.PI * 2,
      });
    }
    return s;
  }, [height]);

  const groundFogSeeds = useMemo(() => {
    const s: { angle: number; speed: number; lt: number; phase: number }[] = [];
    for (let i = 0; i < GROUND_FOG_COUNT; i++) {
      s.push({
        angle: Math.random() * Math.PI * 2,
        speed: 0.3 + Math.random() * 1.2,
        lt: 1.5 + Math.random() * 3.0,
        phase: Math.random() * Math.PI * 2,
      });
    }
    return s;
  }, []);

  const condensationSeeds = useMemo(() => {
    const s: { angle: number; speed: number; phase: number }[] = [];
    for (let i = 0; i < CONDENSATION_COUNT; i++) {
      s.push({
        angle: Math.random() * Math.PI * 2,
        speed: 2 + Math.random() * 5,
        phase: Math.random() * Math.PI * 2,
      });
    }
    return s;
  }, []);

  const cloudSeeds = useMemo(() => {
    return Array.from({ length: CLOUD_COUNT }, (_, i) => ({
      delay: i * 0.06,
      speed: height * (0.3 + Math.random() * 0.5),
      spread: 0.15 + Math.random() * 0.3,
      scale: 0.5 + Math.random() * 1.0,
      angle: Math.random() * Math.PI * 2,
    }));
  }, [height]);

  useFrame(({ clock }) => {
    if (!pointsRef.current) return;
    const posArr = posRef;
    const colArr = colRef;
    const time = clock.getElapsedTime();
    const intensity = attackReleaseEnvelope(progress, 0.05, 0.75, 1.6);

    // Wind integration
    const { wind } = useProjectStore.getState();
    const windRad = (wind.direction * Math.PI) / 180;
    const wX = wind.enabled ? Math.sin(windRad) * wind.speed * 0.06 : 0;
    const wZ = wind.enabled ? Math.cos(windRad) * wind.speed * 0.06 : 0;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const seed = seeds[i];
      const cycleTime = ((time * 2.5 + seed.phase) % seed.lt) / seed.lt;

      if (cycleTime > intensity) {
        posArr[i * 3] = 0; posArr[i * 3 + 1] = -100; posArr[i * 3 + 2] = 0;
        colArr[i * 3] = 0; colArr[i * 3 + 1] = 0; colArr[i * 3 + 2] = 0;
        continue;
      }

      const t = cycleTime * seed.lt;
      const expansion = 1 + cycleTime * 3.5;
      const turbX = Math.sin(time * 3 + i * 1.3) * 0.2 * t;
      const turbZ = Math.cos(time * 2.5 + i * 0.9) * 0.15 * t;

      if (horizontal) {
        posArr[i * 3] = seed.speed * t + wX * t;
        posArr[i * 3 + 1] = Math.cos(seed.angle) * seed.spread * t * expansion + turbX;
        posArr[i * 3 + 2] = Math.sin(seed.angle) * seed.spread * t * expansion + turbZ + wZ * t;
      } else {
        posArr[i * 3] = Math.cos(seed.angle) * seed.spread * t * expansion + turbX + wX * t;
        posArr[i * 3 + 1] = seed.speed * t - 2 * t * t;
        posArr[i * 3 + 2] = Math.sin(seed.angle) * seed.spread * t * expansion + turbZ + wZ * t;
      }

      const fade = Math.max(0, 1 - cycleTime * 0.65) * intensity;
      const core = 1 - cycleTime;

      // Soft-particle-style depth fade approximation
      const depthFade = Math.min(1, posArr[i * 3 + 1] * 2 + 0.5);

      const r = THREE.MathUtils.lerp(baseColor.r, 1.0, core * 0.45);
      const g = THREE.MathUtils.lerp(baseColor.g, 1.0, core * 0.5);
      const b = THREE.MathUtils.lerp(baseColor.b, 1.0, core * 0.65);

      colArr[i * 3] = r * fade * depthFade;
      colArr[i * 3 + 1] = g * fade * depthFade;
      colArr[i * 3 + 2] = b * fade * depthFade;
    }

    const geo = pointsRef.current.geometry;
    const posAttr = geo.getAttribute('position') as THREE.BufferAttribute;
    const colAttr = geo.getAttribute('color') as THREE.BufferAttribute;
    if (posAttr) posAttr.needsUpdate = true;
    if (colAttr) colAttr.needsUpdate = true;

    // Ground fog spread with wind
    if (groundFogRef.current && intensity > 0.2) {
      for (let i = 0; i < GROUND_FOG_COUNT; i++) {
        const seed = groundFogSeeds[i];
        const cycleTime = ((time * 0.4 + seed.phase) % seed.lt) / seed.lt;
        const t2 = cycleTime * seed.lt;
        
        groundFogPos[i * 3] = Math.cos(seed.angle) * seed.speed * t2 + wX * t2 * 2;
        groundFogPos[i * 3 + 1] = 0.05 + Math.sin(time * 0.5 + i) * 0.05;
        groundFogPos[i * 3 + 2] = Math.sin(seed.angle) * seed.speed * t2 + wZ * t2 * 2;

        const fade = Math.max(0, 1 - cycleTime) * intensity * 0.4;
        groundFogCol[i * 3] = 0.9 * fade;
        groundFogCol[i * 3 + 1] = 0.92 * fade;
        groundFogCol[i * 3 + 2] = 0.95 * fade;
      }
      const gGeo = groundFogRef.current.geometry;
      const gPos = gGeo.getAttribute('position') as THREE.BufferAttribute;
      const gCol = gGeo.getAttribute('color') as THREE.BufferAttribute;
      if (gPos) gPos.needsUpdate = true;
      if (gCol) gCol.needsUpdate = true;
    }

    // Condensation droplets
    if (condensationRef.current && intensity > 0.3) {
      for (let i = 0; i < CONDENSATION_COUNT; i++) {
        const seed = condensationSeeds[i];
        const cycleTime = ((time * 8 + seed.phase) % 0.15) / 0.15;
        
        condensationPos[i * 3] = Math.cos(seed.angle) * 0.1 * cycleTime;
        condensationPos[i * 3 + 1] = horizontal ? 0 : 0.3 + cycleTime * 0.5;
        condensationPos[i * 3 + 2] = Math.sin(seed.angle) * 0.1 * cycleTime;

        const fade = Math.max(0, 1 - cycleTime) * intensity * 0.5;
        condensationCol[i * 3] = 0.8 * fade;
        condensationCol[i * 3 + 1] = 0.85 * fade;
        condensationCol[i * 3 + 2] = 1.0 * fade;
      }
      const cGeo = condensationRef.current.geometry;
      const cPos = cGeo.getAttribute('position') as THREE.BufferAttribute;
      const cCol = cGeo.getAttribute('color') as THREE.BufferAttribute;
      if (cPos) cPos.needsUpdate = true;
      if (cCol) cCol.needsUpdate = true;
    }

    // Cloud puffs with wind
    cloudSeeds.forEach((cloud, i) => {
      const mesh = cloudRefs.current[i];
      if (!mesh) return;
      const age = Math.max(0, progress - cloud.delay);
      if (age <= 0 || progress > 0.9) {
        mesh.visible = false;
        return;
      }
      mesh.visible = true;
      const t2 = age * 3;
      const expand = cloud.scale * (0.5 + t2 * 2.5);
      if (horizontal) {
        mesh.position.set(cloud.speed * t2 + wX * t2, Math.cos(cloud.angle) * cloud.spread * t2, Math.sin(cloud.angle) * cloud.spread * t2 + wZ * t2);
      } else {
        mesh.position.set(Math.cos(cloud.angle) * cloud.spread * t2 + wX * t2, cloud.speed * t2 * 0.7, Math.sin(cloud.angle) * cloud.spread * t2 + wZ * t2);
      }
      mesh.scale.setScalar(expand);
      const mat = mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0, 0.08 * intensity * (1 - age * 2));
      mat.color.copy(baseColor).lerp(coolTint, 0.45);
    });
  });

  const normalBlend = useMemo(() => getThreeBlending('normal'), []);
  const screenBlend = useMemo(() => getThreeBlending('screen'), []);

  return (
    <group position={position}>
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[posRef, 3]} />
          <bufferAttribute attach="attributes-color" args={[colRef, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.3} vertexColors transparent opacity={0.55} depthWrite={false} blending={normalBlend.blending} blendEquation={normalBlend.blendEquation} blendSrc={normalBlend.blendSrc as any} blendDst={normalBlend.blendDst as any} sizeAttenuation />
      </points>

      <points ref={groundFogRef} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[groundFogPos, 3]} />
          <bufferAttribute attach="attributes-color" args={[groundFogCol, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.6} vertexColors transparent opacity={0.3} depthWrite={false} blending={normalBlend.blending} blendEquation={normalBlend.blendEquation} blendSrc={normalBlend.blendSrc as any} blendDst={normalBlend.blendDst as any} sizeAttenuation />
      </points>

      <points ref={condensationRef} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[condensationPos, 3]} />
          <bufferAttribute attach="attributes-color" args={[condensationCol, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.03} vertexColors transparent opacity={0.6} depthWrite={false} blending={THREE.AdditiveBlending} sizeAttenuation />
      </points>

      {cloudSeeds.map((_, i) => (
        <mesh key={i} ref={(el) => { cloudRefs.current[i] = el; }} visible={false}>
          <sphereGeometry args={[1, 8, 8]} />
          <meshBasicMaterial color={color} transparent opacity={0} depthWrite={false} />
        </mesh>
      ))}

      {progress > 0.02 && progress < 0.8 && (
        <mesh position={horizontal ? [0.2, 0, 0] : [0, 0.2, 0]}>
          <sphereGeometry args={[0.15, 8, 8]} />
          <meshBasicMaterial color={color} transparent opacity={0.3} blending={screenBlend.blending} blendEquation={screenBlend.blendEquation} blendSrc={screenBlend.blendSrc as any} blendDst={screenBlend.blendDst as any} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}
