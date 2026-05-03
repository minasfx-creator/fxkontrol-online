/**
 * SkyCanvas 2.0 — LightPointsLayer.
 *
 * Renderiza drones/lights como sprites aditivos. Pulsa quando há cue ativa.
 * Usa um único <points> com atributos por instância para minimizar draw calls.
 */
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useActiveDrones } from './useShowSelectors';

const PULSE_HZ = 8;

export function LightPointsLayer() {
  const drones = useActiveDrones();
  const pointsRef = useRef<THREE.Points>(null);
  const matRef = useRef<THREE.PointsMaterial>(null);

  const { positionsAttr, colorsAttr, sizesAttr, count } = useMemo(() => {
    const n = drones.length;
    const positions = new Float32Array(n * 3);
    const colors = new Float32Array(n * 3);
    const sizes = new Float32Array(n);
    const tmp = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const d = drones[i];
      positions[i * 3 + 0] = d.position[0];
      positions[i * 3 + 1] = d.position[1];
      positions[i * 3 + 2] = d.position[2];
      tmp.set(d.color);
      colors[i * 3 + 0] = tmp.r;
      colors[i * 3 + 1] = tmp.g;
      colors[i * 3 + 2] = tmp.b;
      sizes[i] = 1;
    }
    return { positionsAttr: positions, colorsAttr: colors, sizesAttr: sizes, count: n };
  }, [drones]);

  useFrame((state) => {
    const geom = pointsRef.current?.geometry;
    if (!geom || count === 0) return;
    const t = state.clock.getElapsedTime();
    const pulse = 0.5 + 0.5 * Math.sin(t * PULSE_HZ);
    const sizesArr = (geom.attributes.size as THREE.BufferAttribute).array as Float32Array;
    for (let i = 0; i < count; i++) {
      sizesArr[i] = drones[i].active ? 3.5 + 1.5 * pulse : 1.6;
    }
    (geom.attributes.size as THREE.BufferAttribute).needsUpdate = true;
  });

  if (count === 0) return null;

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positionsAttr}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          count={count}
          array={colorsAttr}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-size"
          count={count}
          array={sizesAttr}
          itemSize={1}
        />
      </bufferGeometry>
      <pointsMaterial
        ref={matRef}
        vertexColors
        size={2}
        sizeAttenuation
        transparent
        opacity={0.9}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}
