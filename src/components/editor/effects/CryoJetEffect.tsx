import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { attackReleaseEnvelope } from '@/lib/pyroNoise';

const PARTICLE_COUNT = 180;

/**
 * CO2 Cryo refinado:
 * - envelope de potência estável
 * - buffers reutilizados
 * - tint dinâmico baseado na cor do efeito
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
  const cloudRefs = useRef<(THREE.Mesh | null)[]>([]);
  const CLOUD_COUNT = 12;

  const posRef = useRef(new Float32Array(PARTICLE_COUNT * 3));
  const colRef = useRef(new Float32Array(PARTICLE_COUNT * 3));
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
    const posArr = posRef.current;
    const colArr = colRef.current;
    const time = clock.getElapsedTime();
    const intensity = attackReleaseEnvelope(progress, 0.05, 0.75, 1.6);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const seed = seeds[i];
      const cycleTime = ((time * 2.5 + seed.phase) % seed.lt) / seed.lt;

      if (cycleTime > intensity) {
        posArr[i * 3] = 0;
        posArr[i * 3 + 1] = -100;
        posArr[i * 3 + 2] = 0;
        colArr[i * 3] = 0;
        colArr[i * 3 + 1] = 0;
        colArr[i * 3 + 2] = 0;
        continue;
      }

      const t = cycleTime * seed.lt;
      const expansion = 1 + cycleTime * 3.5;
      const turbX = Math.sin(time * 3 + i * 1.3) * 0.2 * t;
      const turbZ = Math.cos(time * 2.5 + i * 0.9) * 0.15 * t;

      if (horizontal) {
        posArr[i * 3] = seed.speed * t;
        posArr[i * 3 + 1] = Math.cos(seed.angle) * seed.spread * t * expansion + turbX;
        posArr[i * 3 + 2] = Math.sin(seed.angle) * seed.spread * t * expansion + turbZ;
      } else {
        posArr[i * 3] = Math.cos(seed.angle) * seed.spread * t * expansion + turbX;
        posArr[i * 3 + 1] = seed.speed * t - 2 * t * t;
        posArr[i * 3 + 2] = Math.sin(seed.angle) * seed.spread * t * expansion + turbZ;
      }

      const fade = Math.max(0, 1 - cycleTime * 0.65) * intensity;
      const core = 1 - cycleTime;

      const r = THREE.MathUtils.lerp(baseColor.r, 1.0, core * 0.45);
      const g = THREE.MathUtils.lerp(baseColor.g, 1.0, core * 0.5);
      const b = THREE.MathUtils.lerp(baseColor.b, 1.0, core * 0.65);

      colArr[i * 3] = r * fade;
      colArr[i * 3 + 1] = g * fade;
      colArr[i * 3 + 2] = b * fade;
    }

    const geo = pointsRef.current.geometry;
    geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colArr, 3));
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;

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
        mesh.position.set(cloud.speed * t2, Math.cos(cloud.angle) * cloud.spread * t2, Math.sin(cloud.angle) * cloud.spread * t2);
      } else {
        mesh.position.set(Math.cos(cloud.angle) * cloud.spread * t2, cloud.speed * t2 * 0.7, Math.sin(cloud.angle) * cloud.spread * t2);
      }
      mesh.scale.setScalar(expand);
      const mat = mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0, 0.08 * intensity * (1 - age * 2));
      mat.color.copy(baseColor).lerp(new THREE.Color('#e8f0ff'), 0.45);
    });
  });

  return (
    <group position={position}>
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[new Float32Array(PARTICLE_COUNT * 3), 3]} />
          <bufferAttribute attach="attributes-color" args={[new Float32Array(PARTICLE_COUNT * 3), 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.3} vertexColors transparent opacity={0.55} depthWrite={false} blending={THREE.AdditiveBlending} sizeAttenuation />
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
          <meshBasicMaterial color={color} transparent opacity={0.3} blending={THREE.AdditiveBlending} />
        </mesh>
      )}
    </group>
  );
}
