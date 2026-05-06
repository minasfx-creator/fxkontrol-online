/**
 * SkyCanvas3D — Clean React Three Fiber viewport bound to ShowPlan state.
 *
 * Plano: Show Plane (presentation only). NÃO toca CommandBus, FieldBus,
 * SafetyStateMachine ou workMode. NÃO arma, NÃO dispara.
 *
 * Render contract
 * ───────────────
 *  - Night sky:           <Stars/> + fundo Vantablack canônico (--field-bg)
 *  - Ground plane:        plano Y=0 + grid de 200m, colorido por --field-cyan
 *  - Camera:              PerspectiveCamera, OrbitControls 360° (sem polar lock)
 *  - Light Points (drones): para cada Position type='drone-pad', um sprite
 *    aditivo que pulsa quando há cue ativa de drone naquela posição.
 *  - Particle Explosions (pyro): para cada TimelineItem com Effect type='firework'
 *    cuja janela [startTime, startTime+duration] contém currentTime, spawna
 *    explosão Points (gravity + drag) com cor do effect.
 *
 * Estado: lê apenas useProjectStore (positions, timelineItems, currentTime,
 * isPlaying). Quando isPlaying=false, explosões congeladas no frame do scrub.
 */
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars, Grid, PerspectiveCamera } from '@react-three/drei';
import { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useProjectStore } from '@/store/useProjectStore';
import { type Effect } from '@/data/effectLibrary';
import {
  resolveEffectLedAccurate,
  ledAccurateColor,
} from '@/data/effectsLibraries/resolveEffect';

// ──────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────

// Unified lookup: legacy EFFECT_LIBRARY ∪ Finale-imported parts (527),
// with Effect.color already passed through the VDL render-accurate pipeline.
function getEffect(id: string): Effect | undefined {
  return resolveEffectLedAccurate(id);
}

// ──────────────────────────────────────────────────────────────────────────
// Ground + Sky
// ──────────────────────────────────────────────────────────────────────────

function NightSky() {
  return (
    <>
      <color attach="background" args={['#050810']} />
      <fog attach="fog" args={['#050810', 120, 900]} />
      <Stars
        radius={400}
        depth={80}
        count={6000}
        factor={4}
        saturation={0}
        fade
        speed={0.4}
      />
      <ambientLight intensity={0.12} />
      <directionalLight position={[40, 80, 40]} intensity={0.18} color="#9ec6ff" />
    </>
  );
}

function GroundPlane() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[1000, 1000]} />
        <meshStandardMaterial color="#0a0f1a" roughness={1} metalness={0} />
      </mesh>
      <Grid
        args={[200, 200]}
        cellSize={5}
        cellThickness={0.5}
        cellColor="#1a3550"
        sectionSize={25}
        sectionThickness={1}
        sectionColor="#2dd4ff"
        fadeDistance={250}
        fadeStrength={1.2}
        infiniteGrid={false}
        position={[0, 0.01, 0]}
      />
    </group>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Light Points (drones)
// ──────────────────────────────────────────────────────────────────────────

interface LightPointProps {
  position: [number, number, number];
  color: string;
  active: boolean;
}

function LightPoint({ position, color, active }: LightPointProps) {
  const ref = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);

  useFrame(() => {
    if (!matRef.current || !ref.current) return;
    // Deterministic clock: tied to timeline so pulses freeze on pause/scrub.
    const t = useProjectStore.getState().currentTime;
    const pulse = active ? 0.6 + 0.4 * Math.sin(t * 8) : 0.18;
    matRef.current.opacity = pulse;
    const scale = active ? 1 + 0.25 * Math.sin(t * 8) : 0.7;
    ref.current.scale.setScalar(scale);
  });

  return (
    <mesh ref={ref} position={position}>
      <sphereGeometry args={[0.45, 16, 16]} />
      <meshBasicMaterial
        ref={matRef}
        color={color}
        transparent
        opacity={0.4}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  );
}

function LightPointsLayer() {
  const positions = useProjectStore((s) => s.positions);
  const timelineItems = useProjectStore((s) => s.timelineItems);
  const currentTime = useProjectStore((s) => s.currentTime);

  const dronePads = useMemo(
    () => positions.filter((p) => p.type === 'drone-pad' || p.type === 'light'),
    [positions],
  );

  // Active set: positions with a drone/light cue covering currentTime
  const activeIds = useMemo(() => {
    const set = new Set<string>();
    for (const item of timelineItems) {
      const eff = getEffect(item.effectId);
      if (!eff) continue;
      if (eff.type !== 'drone' && eff.type !== 'light') continue;
      const dur = item.durationOverride ?? eff.duration ?? 1;
      if (currentTime >= item.startTime && currentTime <= item.startTime + dur) {
        if (item.positionId) set.add(item.positionId);
        if (item.positionIds) item.positionIds.forEach((id) => set.add(id));
      }
    }
    return set;
  }, [timelineItems, currentTime]);

  return (
    <group>
      {dronePads.map((p) => (
        <LightPoint
          key={p.id}
          position={[p.x, Math.max(p.y, 1), p.z]}
          color={ledAccurateColor(p.color, '#2dd4ff')}
          active={activeIds.has(p.id)}
        />
      ))}
    </group>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Particle Explosions (pyro)
// ──────────────────────────────────────────────────────────────────────────

interface ExplosionProps {
  origin: [number, number, number];
  color: string;
  /** Seconds since the explosion's startTime (already in burst phase). */
  age: number;
  /** Total burst duration (s). */
  life: number;
  /** Apex height (m), defines spread. */
  height: number;
}

function ParticleExplosion({ origin, color, age, life, height }: ExplosionProps) {
  const COUNT = 96;
  const ref = useRef<THREE.Points>(null);
  const matRef = useRef<THREE.PointsMaterial>(null);

  // Random unit vectors per-instance (stable across frames)
  const directions = useMemo(() => {
    const arr = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const speed = 0.7 + Math.random() * 0.6;
      arr[i * 3 + 0] = Math.sin(phi) * Math.cos(theta) * speed;
      arr[i * 3 + 1] = Math.cos(phi) * speed;
      arr[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * speed;
    }
    return arr;
  }, []);

  const positions = useMemo(() => new Float32Array(COUNT * 3), []);

  useEffect(() => {
    // Initialize geometry with origin so first frame is valid
    for (let i = 0; i < COUNT; i++) {
      positions[i * 3 + 0] = origin[0];
      positions[i * 3 + 1] = origin[1];
      positions[i * 3 + 2] = origin[2];
    }
    if (ref.current) {
      ref.current.geometry.attributes.position.needsUpdate = true;
    }
  }, [origin, positions]);

  useFrame(() => {
    if (!ref.current || !matRef.current) return;
    const t = Math.max(0, age);
    const drag = Math.exp(-1.3 * t);
    const radius = height * 0.18; // peak spread (m)
    const lifeRatio = Math.min(1, t / life);

    for (let i = 0; i < COUNT; i++) {
      const dx = directions[i * 3 + 0];
      const dy = directions[i * 3 + 1];
      const dz = directions[i * 3 + 2];
      // Outward expansion with drag, gravity pulls Y down quadratically
      positions[i * 3 + 0] = origin[0] + dx * radius * (1 - drag);
      positions[i * 3 + 1] =
        origin[1] + dy * radius * (1 - drag) - 9.8 * 0.06 * t * t;
      positions[i * 3 + 2] = origin[2] + dz * radius * (1 - drag);
    }
    ref.current.geometry.attributes.position.needsUpdate = true;
    matRef.current.opacity = Math.max(0, 1 - lifeRatio) * 0.95;
    matRef.current.size = 1.4 + 1.6 * (1 - lifeRatio);
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={COUNT}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        ref={matRef}
        color={color}
        size={2.2}
        sizeAttenuation
        transparent
        opacity={1}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}

interface ActiveExplosion {
  key: string;
  origin: [number, number, number];
  color: string;
  age: number;
  life: number;
  height: number;
}

function ParticleExplosionsLayer() {
  const positions = useProjectStore((s) => s.positions);
  const timelineItems = useProjectStore((s) => s.timelineItems);
  const currentTime = useProjectStore((s) => s.currentTime);

  const positionMap = useMemo(() => {
    const m = new Map<string, { x: number; y: number; z: number }>();
    for (const p of positions) m.set(p.id, { x: p.x, y: p.y, z: p.z });
    return m;
  }, [positions]);

  const explosions = useMemo<ActiveExplosion[]>(() => {
    const list: ActiveExplosion[] = [];
    for (const item of timelineItems) {
      const eff = getEffect(item.effectId);
      if (!eff || eff.type !== 'firework') continue;
      const prefire = (eff.prefire ?? 0);
      const burstStart = item.startTime + prefire;
      const life = (item.durationOverride ?? eff.duration ?? 2.5);
      const burstEnd = burstStart + life;
      if (currentTime < burstStart || currentTime > burstEnd) continue;

      const pos = item.positionId
        ? positionMap.get(item.positionId)
        : undefined;
      const origin: [number, number, number] = [
        pos?.x ?? item.position?.x ?? 0,
        (pos?.y ?? item.position?.y ?? 0) + (eff.heightMeters ?? 60),
        pos?.z ?? item.position?.z ?? 0,
      ];

      list.push({
        key: item.id,
        origin,
        color: item.colorOverride || eff.color || '#FFD700',
        age: currentTime - burstStart,
        life,
        height: eff.heightMeters ?? 60,
      });
    }
    return list;
  }, [timelineItems, currentTime, positionMap]);

  return (
    <group>
      {explosions.map((e) => (
        <ParticleExplosion
          key={e.key}
          origin={e.origin}
          color={e.color}
          age={e.age}
          life={e.life}
          height={e.height}
        />
      ))}
    </group>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Pyro launch positions (small ground markers)
// ──────────────────────────────────────────────────────────────────────────

function PyroPadsLayer() {
  const positions = useProjectStore((s) => s.positions);
  const pads = useMemo(() => positions.filter((p) => p.type === 'pyro'), [positions]);
  return (
    <group>
      {pads.map((p) => (
        <mesh key={p.id} position={[p.x, 0.05, p.z]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.6, 0.9, 24]} />
          <meshBasicMaterial color="#ff7700" transparent opacity={0.8} />
        </mesh>
      ))}
    </group>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Public component
// ──────────────────────────────────────────────────────────────────────────

export interface SkyCanvas3DProps {
  /** Canvas DPR clamp. Default [1, 1.75]. */
  dpr?: [number, number];
  /** Force a fixed camera target (defaults to origin). */
  target?: [number, number, number];
  /** Initial camera position. Default [60, 35, 60]. */
  cameraPosition?: [number, number, number];
  className?: string;
}

export default function SkyCanvas3D({
  dpr = [1, 1.75],
  target = [0, 10, 0],
  cameraPosition = [60, 35, 60],
  className,
}: SkyCanvas3DProps) {
  return (
    <div className={className} style={{ position: 'absolute', inset: 0 }}>
      <Canvas
        dpr={dpr}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        shadows={false}
      >
        <PerspectiveCamera makeDefault position={cameraPosition} fov={55} near={0.5} far={2000} />
        <OrbitControls
          target={target}
          enableDamping
          dampingFactor={0.08}
          maxPolarAngle={Math.PI * 0.495}
          minDistance={5}
          maxDistance={500}
          // 360° azimuth (no min/max polar lock beyond ground)
        />
        <NightSky />
        <GroundPlane />
        <PyroPadsLayer />
        <LightPointsLayer />
        <ParticleExplosionsLayer />
      </Canvas>
    </div>
  );
}
