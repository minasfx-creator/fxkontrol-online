/**
 * EffectPreview3D — Mini 3D preview shown inside the expanded EffectCard
 * for new presets. Renders Light Points + an explosion synced with the
 * project's currentTime (loops over effect duration + prefire).
 *
 * Pure presentation. No safety / fire-bus calls. No store mutation.
 */
import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useProjectStore } from '@/store/useProjectStore';
import type { Effect } from '@/data/effectLibrary';

const PARTICLE_COUNT = 220;

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** Generate initial random unit-velocity directions based on pattern. */
function buildVelocities(pattern: string | undefined, count: number): Float32Array {
  const v = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    let dx: number, dy: number, dz: number;
    if (pattern === 'willow' || pattern === 'falling_leaves') {
      // Mostly downward droop
      const a = Math.random() * Math.PI * 2;
      const r = 0.4 + Math.random() * 0.4;
      dx = Math.cos(a) * r;
      dz = Math.sin(a) * r;
      dy = 0.2 + Math.random() * 0.3;
    } else if (pattern === 'palm' || pattern === 'kamuro') {
      const a = Math.random() * Math.PI * 2;
      const r = 0.3 + Math.random() * 0.3;
      dx = Math.cos(a) * r;
      dz = Math.sin(a) * r;
      dy = 0.6 + Math.random() * 0.4;
    } else if (pattern === 'salute') {
      // Tight bright sphere
      const a = Math.random() * Math.PI * 2;
      const b = Math.acos(2 * Math.random() - 1);
      const r = 0.7 + Math.random() * 0.2;
      dx = Math.sin(b) * Math.cos(a) * r;
      dy = Math.cos(b) * r;
      dz = Math.sin(b) * Math.sin(a) * r;
    } else if (pattern === 'comet' || pattern === 'fan') {
      const a = (Math.random() - 0.5) * 0.8;
      dx = a;
      dy = 0.8 + Math.random() * 0.2;
      dz = (Math.random() - 0.5) * 0.4;
    } else {
      // Default sphere (peony / chrysanthemum)
      const a = Math.random() * Math.PI * 2;
      const b = Math.acos(2 * Math.random() - 1);
      const r = 0.5 + Math.random() * 0.5;
      dx = Math.sin(b) * Math.cos(a) * r;
      dy = Math.cos(b) * r;
      dz = Math.sin(b) * Math.sin(a) * r;
    }
    v[i * 3] = dx;
    v[i * 3 + 1] = dy;
    v[i * 3 + 2] = dz;
  }
  return v;
}

function ExplosionPoints({ effect }: { effect: Effect }) {
  const pointsRef = useRef<THREE.Points>(null);
  const matRef = useRef<THREE.PointsMaterial>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const positions = useMemo(() => new Float32Array(PARTICLE_COUNT * 3), []);
  const colors = useMemo(() => new Float32Array(PARTICLE_COUNT * 3), []);
  const velocities = useMemo(() => buildVelocities(effect.pattern, PARTICLE_COUNT), [effect.pattern]);
  const baseColor = useMemo(() => hexToRgb(effect.color || '#FFB347'), [effect.color]);
  const secColor = useMemo(
    () => (effect.secondaryColor ? hexToRgb(effect.secondaryColor) : baseColor),
    [effect.secondaryColor, baseColor]
  );

  // Loop length: prefire + duration, with small idle gap
  const cycleLen = Math.max(1.2, (effect.prefire || 0) + (effect.duration || 2)) + 0.6;
  const burstAt = Math.max(0.05, effect.prefire || 0.2);

  useFrame(() => {
    const t = useProjectStore.getState().currentTime;
    const phase = ((t % cycleLen) + cycleLen) % cycleLen;
    const burstT = phase - burstAt; // negative = pre-burst trail, positive = explosion age

    const geo = pointsRef.current?.geometry;
    if (!geo) return;
    const posAttr = geo.attributes.position as THREE.BufferAttribute;
    const colAttr = geo.attributes.color as THREE.BufferAttribute;
    const apex: [number, number, number] = [0, 1.0, 0];
    const liveAge = Math.max(0, burstT);
    const lifeMax = Math.max(0.6, effect.duration || 2);
    const lifeRatio = Math.min(1, liveAge / lifeMax);
    const fade = 1 - lifeRatio;
    // Drag + gravity feel
    const drag = Math.exp(-1.0 * liveAge);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const ix = i * 3;
      if (burstT < 0) {
        // Rising trail (single comet from origin to apex)
        const trailRatio = Math.max(0, 1 - Math.abs(burstT) / Math.max(0.1, burstAt));
        // Scatter trail mostly hidden, leave one visible point per index 0
        if (i === 0) {
          posAttr.array[ix] = 0;
          posAttr.array[ix + 1] = trailRatio * apex[1];
          posAttr.array[ix + 2] = 0;
          colAttr.array[ix] = baseColor[0];
          colAttr.array[ix + 1] = baseColor[1] * 0.7;
          colAttr.array[ix + 2] = baseColor[2] * 0.4;
        } else {
          posAttr.array[ix] = 0;
          posAttr.array[ix + 1] = -10; // hide
          posAttr.array[ix + 2] = 0;
          colAttr.array[ix] = 0;
          colAttr.array[ix + 1] = 0;
          colAttr.array[ix + 2] = 0;
        }
      } else {
        const vx = velocities[ix];
        const vy = velocities[ix + 1];
        const vz = velocities[ix + 2];
        const speed = 1.4;
        const x = apex[0] + vx * speed * liveAge * drag;
        const y = apex[1] + vy * speed * liveAge * drag - 0.9 * liveAge * liveAge;
        const z = apex[2] + vz * speed * liveAge * drag;
        posAttr.array[ix] = x;
        posAttr.array[ix + 1] = y;
        posAttr.array[ix + 2] = z;
        // Color: blend base→secondary across life if colorTransition set
        const blend = effect.colorTransition && effect.colorTransition !== 'none'
          ? lifeRatio
          : (i % 2 === 0 ? 0 : (effect.secondaryColor ? 1 : 0));
        const r = baseColor[0] * (1 - blend) + secColor[0] * blend;
        const g = baseColor[1] * (1 - blend) + secColor[1] * blend;
        const b = baseColor[2] * (1 - blend) + secColor[2] * blend;
        const k = fade * (0.4 + 0.6 * Math.exp(-2.0 * lifeRatio));
        colAttr.array[ix] = r * k;
        colAttr.array[ix + 1] = g * k;
        colAttr.array[ix + 2] = b * k;
      }
    }
    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;

    if (matRef.current) {
      matRef.current.size = burstT < 0 ? 0.06 : 0.05 + 0.04 * fade;
      matRef.current.opacity = burstT < 0 ? 0.9 : 0.4 + 0.6 * fade;
    }
    if (lightRef.current) {
      lightRef.current.intensity = burstT < 0 ? 0 : 4 * fade;
      lightRef.current.position.set(apex[0], apex[1], apex[2]);
      lightRef.current.color.setRGB(baseColor[0], baseColor[1], baseColor[2]);
    }
  });

  return (
    <>
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} count={PARTICLE_COUNT} />
          <bufferAttribute attach="attributes-color" args={[colors, 3]} count={PARTICLE_COUNT} />
        </bufferGeometry>
        <pointsMaterial
          ref={matRef}
          vertexColors
          size={0.06}
          sizeAttenuation
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
      <pointLight ref={lightRef} distance={4} decay={1.2} />
    </>
  );
}

/** Static "Light Points" — small spec markers around origin (visual hint of fixtures). */
function LightPoints({ count = 6 }: { count?: number }) {
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      arr[i * 3] = Math.cos(a) * 0.9;
      arr[i * 3 + 1] = -0.05;
      arr[i * 3 + 2] = Math.sin(a) * 0.9;
    }
    return arr;
  }, [count]);
  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} count={count} />
      </bufferGeometry>
      <pointsMaterial size={0.08} color="#7DD3FC" transparent opacity={0.85} sizeAttenuation depthWrite={false} />
    </points>
  );
}

export default function EffectPreview3D({ effect, height = 128 }: { effect: Effect; height?: number }) {
  return (
    <div
      className="w-full rounded-xl overflow-hidden border border-border/15 bg-black/80"
      style={{ height }}
    >
      <Canvas
        dpr={[1, 1.5]}
        camera={{ position: [0, 0.9, 3.2], fov: 42 }}
        gl={{ antialias: true, alpha: false }}
      >
        <color attach="background" args={['#050810']} />
        <ambientLight intensity={0.05} />
        <ExplosionPoints effect={effect} />
        <LightPoints count={effect.numDevices && effect.numDevices > 0 ? Math.min(12, effect.numDevices) : 6} />
        {/* Ground hint */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]}>
          <circleGeometry args={[1.4, 32]} />
          <meshBasicMaterial color="#0b1220" transparent opacity={0.6} />
        </mesh>
      </Canvas>
    </div>
  );
}
