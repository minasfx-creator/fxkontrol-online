import { useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface PlacementVFXProps {
  position: [number, number, number];
  onComplete: () => void;
}

const PARTICLE_COUNT = 24;

export default function PlacementVFX({ position, onComplete }: PlacementVFXProps) {
  const groupRef = useRef<THREE.Group>(null);
  const flashRef = useRef<THREE.PointLight>(null);
  const particlesRef = useRef<THREE.Points>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const elapsed = useRef(0);
  const duration = 1.2;

  // Pre-compute particle velocities
  const [velocities] = useState(() => {
    const v: THREE.Vector3[] = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const theta = (i / PARTICLE_COUNT) * Math.PI * 2 + Math.random() * 0.3;
      const phi = Math.random() * Math.PI * 0.5;
      const speed = 1.5 + Math.random() * 3;
      v.push(new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta) * speed,
        Math.cos(phi) * speed * 0.8 + Math.random() * 2,
        Math.sin(phi) * Math.sin(theta) * speed
      ));
    }
    return v;
  });

  const [positionsArr] = useState(() => new Float32Array(PARTICLE_COUNT * 3));
  const [colorsArr] = useState(() => {
    const c = new Float32Array(PARTICLE_COUNT * 3);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const warm = Math.random() > 0.5;
      c[i * 3] = warm ? 1 : 0.3 + Math.random() * 0.4;
      c[i * 3 + 1] = warm ? 0.6 + Math.random() * 0.4 : 1;
      c[i * 3 + 2] = warm ? 0.1 : 0.3 + Math.random() * 0.5;
    }
    return c;
  });
  const [sizesArr] = useState(() => {
    const s = new Float32Array(PARTICLE_COUNT);
    for (let i = 0; i < PARTICLE_COUNT; i++) s[i] = 0.06 + Math.random() * 0.08;
    return s;
  });

  useFrame((_, delta) => {
    elapsed.current += delta;
    const t = elapsed.current / duration;

    if (t >= 1) {
      onComplete();
      return;
    }

    // Flash light — bright then fade
    if (flashRef.current) {
      flashRef.current.intensity = t < 0.15 ? 30 * (1 - t / 0.15) : 0;
    }

    // Ring expand + fade
    if (ringRef.current) {
      const scale = 0.3 + t * 2.5;
      ringRef.current.scale.set(scale, scale, scale);
      (ringRef.current.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - t * 1.5);
    }

    // Particles fly outward with gravity
    if (particlesRef.current) {
      const posAttr = particlesRef.current.geometry.getAttribute('position') as THREE.BufferAttribute;
      const sizeAttr = particlesRef.current.geometry.getAttribute('size') as THREE.BufferAttribute;
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const age = elapsed.current;
        const v = velocities[i];
        posAttr.array[i * 3] = v.x * age * 0.5;
        posAttr.array[i * 3 + 1] = v.y * age * 0.5 - 2.5 * age * age;
        posAttr.array[i * 3 + 2] = v.z * age * 0.5;
        sizeAttr.array[i] = sizesArr[i] * Math.max(0, 1 - t);
      }
      posAttr.needsUpdate = true;
      sizeAttr.needsUpdate = true;
    }
  });

  return (
    <group ref={groupRef} position={position}>
      {/* Flash light */}
      <pointLight ref={flashRef} color="#44ff88" intensity={0} distance={8} />

      {/* Expanding ring */}
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.8, 1, 32]} />
        <meshBasicMaterial color="#44ff88" transparent opacity={1} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>

      {/* Spark particles */}
      <points ref={particlesRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positionsArr, 3]} />
          <bufferAttribute attach="attributes-color" args={[colorsArr, 3]} />
          <bufferAttribute attach="attributes-size" args={[sizesArr, 1]} />
        </bufferGeometry>
        <pointsMaterial
          size={0.1}
          vertexColors
          transparent
          opacity={0.9}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          sizeAttenuation
          toneMapped={false}
        />
      </points>
    </group>
  );
}
