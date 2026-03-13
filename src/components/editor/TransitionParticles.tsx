import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useProjectStore, type DroneFormation } from '@/store/useProjectStore';

const SPARKS_PER_DRONE = 4;
const TRAIL_SEGMENTS = 6;
const MAX_DRONES_FOR_FX = 300; // cap for performance

/**
 * TransitionParticles — emits spark trails from each drone during formation transitions.
 * Sparks shoot outward with gravity, fade, and inherit the drone's LED color.
 */
export default function TransitionParticles() {
  const { droneFormations, currentTime } = useProjectStore();
  const pointsRef = useRef<THREE.Points>(null);

  // Determine if we're in a transition phase
  const transitionInfo = useMemo(() => {
    if (droneFormations.length === 0) return null;

    for (let i = 0; i < droneFormations.length; i++) {
      const f = droneFormations[i];
      const transEnd = f.startTime + f.transitionDuration;
      if (currentTime >= f.startTime && currentTime < transEnd) {
        const t = (currentTime - f.startTime) / f.transitionDuration;
        return { formationIndex: i, t, formation: f };
      }
    }
    return null;
  }, [droneFormations, currentTime]);

  const droneCount = droneFormations.length > 0
    ? Math.min(droneFormations[0].droneCount, MAX_DRONES_FOR_FX)
    : 0;

  const totalParticles = droneCount * SPARKS_PER_DRONE * TRAIL_SEGMENTS;

  // Pre-allocate buffers
  const { positions, colors, sizes, velocities, lifetimes } = useMemo(() => {
    const maxP = Math.max(totalParticles, 1);
    return {
      positions: new Float32Array(maxP * 3),
      colors: new Float32Array(maxP * 3),
      sizes: new Float32Array(maxP),
      velocities: new Float32Array(maxP * 3),
      lifetimes: new Float32Array(maxP),
    };
  }, [totalParticles]);

  // Seed random velocities once
  const seedVelocities = useMemo(() => {
    const v = new Float32Array(droneCount * SPARKS_PER_DRONE * 3);
    for (let i = 0; i < v.length; i += 3) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI * 0.6;
      const speed = 0.8 + Math.random() * 2.5;
      v[i] = Math.sin(phi) * Math.cos(theta) * speed;
      v[i + 1] = Math.cos(phi) * speed * 0.5 + Math.random() * 1.5;
      v[i + 2] = Math.sin(phi) * Math.sin(theta) * speed;
    }
    return v;
  }, [droneCount]);

  useFrame(() => {
    if (!pointsRef.current || !transitionInfo || droneCount === 0) {
      if (pointsRef.current) pointsRef.current.visible = false;
      return;
    }

    pointsRef.current.visible = true;
    const { t, formation, formationIndex } = transitionInfo;

    // Only emit sparks during transition ramp (mid-transition has most sparks)
    const intensity = Math.sin(t * Math.PI); // peaks at 50%
    if (intensity < 0.05) {
      pointsRef.current.visible = false;
      return;
    }

    const formations = droneFormations;
    const prevFormation = formationIndex > 0 ? formations[formationIndex - 1] : null;
    const color = new THREE.Color();
    const GRAVITY = -3.0;

    let pIdx = 0;
    for (let d = 0; d < droneCount; d++) {
      const pt = formation.points[d];
      if (!pt) continue;

      // Current interpolated drone position
      const prevPt = prevFormation
        ? (prevFormation.points[d] || { x: 0, z: 0 })
        : { x: pt.x, z: pt.z };
      const prevY = prevFormation ? prevFormation.height : 0.1;

      const smoothT = t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2;
      const dx = prevPt.x + (pt.x - prevPt.x) * smoothT;
      const dy = prevY + (formation.height - prevY) * smoothT;
      const dz = prevPt.z + (pt.z - prevPt.z) * smoothT;

      color.set(formation.color);

      for (let s = 0; s < SPARKS_PER_DRONE; s++) {
        const sparkBase = (d * SPARKS_PER_DRONE + s) * 3;
        const vx = seedVelocities[sparkBase] * intensity;
        const vy = seedVelocities[sparkBase + 1] * intensity;
        const vz = seedVelocities[sparkBase + 2] * intensity;

        for (let seg = 0; seg < TRAIL_SEGMENTS; seg++) {
          const age = seg / TRAIL_SEGMENTS * 0.4; // seconds back
          const life = 1.0 - (seg / TRAIL_SEGMENTS);

          positions[pIdx * 3] = dx + vx * age;
          positions[pIdx * 3 + 1] = dy + vy * age + 0.5 * GRAVITY * age * age;
          positions[pIdx * 3 + 2] = dz + vz * age;

          // Color fades from white-hot → drone color → dim
          const hotness = life * life;
          colors[pIdx * 3] = color.r * (1 - hotness * 0.3) + hotness * 0.3;
          colors[pIdx * 3 + 1] = color.g * (1 - hotness * 0.2) + hotness * 0.15;
          colors[pIdx * 3 + 2] = color.b * (1 - hotness * 0.1) + hotness * 0.1;

          sizes[pIdx] = (0.04 + life * 0.12) * intensity;
          pIdx++;
        }
      }
    }

    const geom = pointsRef.current.geometry;
    const posAttr = geom.getAttribute('position') as THREE.BufferAttribute;
    const colAttr = geom.getAttribute('color') as THREE.BufferAttribute;
    const sizeAttr = geom.getAttribute('size') as THREE.BufferAttribute;
    if (posAttr) { (posAttr.array as Float32Array).set(positions); posAttr.needsUpdate = true; }
    if (colAttr) { (colAttr.array as Float32Array).set(colors); colAttr.needsUpdate = true; }
    if (sizeAttr) { (sizeAttr.array as Float32Array).set(sizes); sizeAttr.needsUpdate = true; }
  });

  if (totalParticles === 0) return null;

  return (
    <points ref={pointsRef} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
        <bufferAttribute attach="attributes-size" args={[sizes, 1]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.1}
        vertexColors
        transparent
        opacity={0.85}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        sizeAttenuation
        toneMapped={false}
      />
    </points>
  );
}
