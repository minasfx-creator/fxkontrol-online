/**
 * ExplosionGlowSystem — Pooled PointLight system for dynamic terrain/water illumination.
 * Zero-GC: pre-allocated pool of 8 lights, recycled via LRU.
 * Reads from ActiveBurstScanner (sharedState) each frame.
 */
import { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { getActiveBurstScan } from './sharedState';

const POOL_SIZE = 4;
const DECAY_RATE = 2.0; // intensity per second
const MAX_INTENSITY = 3.0;
const LIGHT_DISTANCE = 500;

interface PooledLight {
  light: THREE.PointLight;
  active: boolean;
  age: number;
  maxAge: number;
}

export function ExplosionGlowSystem() {
  const { scene } = useThree();
  const poolRef = useRef<PooledLight[]>([]);
  const groupRef = useRef<THREE.Group>(new THREE.Group());

  // Initialize pool once
  useEffect(() => {
    const group = groupRef.current;
    group.name = 'ExplosionGlowPool';
    scene.add(group);

    const pool: PooledLight[] = [];
    for (let i = 0; i < POOL_SIZE; i++) {
      const light = new THREE.PointLight(0xffffff, 0, LIGHT_DISTANCE);
      light.visible = false;
      group.add(light);
      pool.push({ light, active: false, age: 0, maxAge: 0.5 });
    }
    poolRef.current = pool;

    return () => {
      scene.remove(group);
      pool.forEach(p => p.light.dispose());
    };
  }, [scene]);

  useFrame((_, delta) => {
    const pool = poolRef.current;
    const scan = getActiveBurstScan();

    // Decay active lights
    for (const slot of pool) {
      if (!slot.active) continue;
      slot.age += delta;
      const t = slot.age / slot.maxAge;
      if (t >= 1) {
        slot.active = false;
        slot.light.visible = false;
        slot.light.intensity = 0;
      } else {
        // Exponential decay
        slot.light.intensity = MAX_INTENSITY * Math.pow(1 - t, 2);
      }
    }

    // Spawn new lights from fresh bursts
    if (scan && scan.freshBursts.length > 0) {
      for (const burst of scan.freshBursts) {
        // Find oldest inactive slot, or oldest active slot (LRU)
        let bestSlot: PooledLight | null = null;
        let bestAge = -1;

        for (const slot of pool) {
          if (!slot.active) {
            bestSlot = slot;
            break;
          }
          if (slot.age > bestAge) {
            bestAge = slot.age;
            bestSlot = slot;
          }
        }

        if (bestSlot) {
          bestSlot.active = true;
          bestSlot.age = 0;
          bestSlot.maxAge = 0.3 + (burst.caliber / 12) * 0.4; // bigger shells glow longer
          bestSlot.light.visible = true;
          bestSlot.light.intensity = MAX_INTENSITY;
          bestSlot.light.position.set(burst.x, burst.y, burst.z);

          // Parse burst color
          const color = new THREE.Color(burst.color || '#ffaa44');
          // Warm shift for realism
          color.lerp(new THREE.Color('#ffcc88'), 0.3);
          bestSlot.light.color.copy(color);
        }
      }
    }
  });

  return null;
}
