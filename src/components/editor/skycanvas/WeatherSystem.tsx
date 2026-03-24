/**
 * WeatherSystem — Rain, Snow, and atmospheric weather effects.
 * Extracted from SkyCanvas for modularity.
 */
import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useSceneStore } from '@/store/useSceneStore';

export function WeatherEffects() {
  const weather = useSceneStore(st => st.settings.weather);
  const rainIntensity = useSceneStore(st => st.settings.rainIntensity);
  const pointsRef = useRef<THREE.Points>(null);

  const rainData = useMemo(() => {
    if (weather !== 'light-rain' && weather !== 'heavy-rain' && weather !== 'snow') return null;
    const count = weather === 'heavy-rain' ? 3000 : weather === 'snow' ? 1500 : 1000;
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 4000;
      positions[i * 3 + 1] = Math.random() * 200;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 4000;
      velocities[i] = weather === 'snow' ? 1 + Math.random() * 2 : 15 + Math.random() * 25;
    }
    return { count, positions, velocities };
  }, [weather]);

  useFrame(() => {
    if (!pointsRef.current || !rainData) return;
    const posAttr = pointsRef.current.geometry.getAttribute('position') as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;
    for (let i = 0; i < rainData.count; i++) {
      arr[i * 3 + 1] -= rainData.velocities[i] * 0.016 * rainIntensity;
      if (arr[i * 3 + 1] < 0) {
        arr[i * 3 + 1] = 160 + Math.random() * 40;
        arr[i * 3] = (Math.random() - 0.5) * 4000;
        arr[i * 3 + 2] = (Math.random() - 0.5) * 4000;
      }
    }
    posAttr.needsUpdate = true;
  });

  if (!rainData) return null;

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[rainData.positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={weather === 'snow' ? 0.15 : 0.04}
        color={weather === 'snow' ? '#e8e8ff' : '#aabbcc'}
        transparent
        opacity={rainIntensity * 0.6}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  );
}
