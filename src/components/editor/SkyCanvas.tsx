import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars, Grid, PerspectiveCamera } from '@react-three/drei';
import { useProjectStore, EFFECT_LIBRARY } from '@/store/useProjectStore';
import { useRef, useMemo, useEffect } from 'react';
import * as THREE from 'three';
import PositionPins from './PositionPins';
import PostProcessing from './PostProcessing';
import TrajectoryPaths from './TrajectoryPaths';
import QuadcopterModel from './QuadcopterModel';

// --- Playback clock: advances currentTime each frame when playing ---
function PlaybackClock() {
  const { isPlaying, currentTime, duration, setCurrentTime, setPlaying } = useProjectStore();
  const prevTime = useRef(performance.now());

  useFrame(() => {
    const now = performance.now();
    if (isPlaying) {
      const delta = (now - prevTime.current) / 1000;
      const next = currentTime + delta;
      if (next >= duration) {
        setCurrentTime(duration);
        setPlaying(false);
      } else {
        setCurrentTime(next);
      }
    }
    prevTime.current = now;
  });

  return null;
}

// --- Particle system constants ---
const PARTICLE_COUNT = 120;
const TRAIL_LENGTH = 6; // number of past positions per particle
const GRAVITY = -4;

function createParticleGeometry() {
  const velocities = new Float32Array(PARTICLE_COUNT * 3);
  const lifetimes = new Float32Array(PARTICLE_COUNT);

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const speed = 2 + Math.random() * 5;
    velocities[i * 3] = Math.sin(phi) * Math.cos(theta) * speed;
    velocities[i * 3 + 1] = Math.sin(phi) * Math.sin(theta) * speed * 0.8 + 1;
    velocities[i * 3 + 2] = Math.cos(phi) * speed;
    lifetimes[i] = 0.5 + Math.random() * 0.5;
  }
  return { velocities, lifetimes };
}

/** Compute particle position at a given physics time */
function particlePos(vx: number, vy: number, vz: number, t: number): [number, number, number] {
  return [
    vx * t * 0.5,
    vy * t * 0.5 + 0.5 * GRAVITY * t * t * 0.25,
    vz * t * 0.5,
  ];
}

// --- Single firework burst with trails ---
function FireworkBurst({
  position,
  color,
  progress,
}: {
  position: [number, number, number];
  color: string;
  progress: number;
}) {
  const pointsRef = useRef<THREE.Points>(null);
  const trailRef = useRef<THREE.LineSegments>(null);
  const { velocities, lifetimes } = useMemo(() => createParticleGeometry(), []);
  const positionsRef = useRef(new Float32Array(PARTICLE_COUNT * 3));
  const colorsRef = useRef(new Float32Array(PARTICLE_COUNT * 3));
  // Trail: each particle has TRAIL_LENGTH segments → TRAIL_LENGTH * 2 vertices per particle
  const trailVertCount = PARTICLE_COUNT * TRAIL_LENGTH * 2;
  const trailPosRef = useRef(new Float32Array(trailVertCount * 3));
  const trailColRef = useRef(new Float32Array(trailVertCount * 3));

  const baseColor = useMemo(() => new THREE.Color(color), [color]);

  useFrame(() => {
    if (!pointsRef.current || !trailRef.current) return;

    const pos = positionsRef.current;
    const cols = colorsRef.current;
    const tPos = trailPosRef.current;
    const tCol = trailColRef.current;

    const t = progress * 2.5;
    const trailDt = 0.06; // time step between trail samples

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const vx = velocities[i * 3];
      const vy = velocities[i * 3 + 1];
      const vz = velocities[i * 3 + 2];
      const lt = lifetimes[i];
      const fade = Math.max(0, 1 - progress / lt);

      // Head position
      const [hx, hy, hz] = particlePos(vx, vy, vz, t);
      pos[i * 3] = hx;
      pos[i * 3 + 1] = hy;
      pos[i * 3 + 2] = hz;

      // Head color
      const r = THREE.MathUtils.lerp(baseColor.r, 0.8, progress * 0.6) * fade;
      const g = THREE.MathUtils.lerp(baseColor.g, 0.2, progress * 0.8) * fade;
      const b = THREE.MathUtils.lerp(baseColor.b, 0.05, progress * 0.9) * fade;
      cols[i * 3] = r;
      cols[i * 3 + 1] = g;
      cols[i * 3 + 2] = b;

      // Trail segments (line pairs going back in time)
      for (let s = 0; s < TRAIL_LENGTH; s++) {
        const t0 = Math.max(0, t - s * trailDt);
        const t1 = Math.max(0, t - (s + 1) * trailDt);
        const [x0, y0, z0] = particlePos(vx, vy, vz, t0);
        const [x1, y1, z1] = particlePos(vx, vy, vz, t1);
        const base = (i * TRAIL_LENGTH + s) * 6; // 2 verts * 3 components
        tPos[base] = x0; tPos[base + 1] = y0; tPos[base + 2] = z0;
        tPos[base + 3] = x1; tPos[base + 4] = y1; tPos[base + 5] = z1;

        // Trail fades along its length
        const segFade = fade * (1 - s / TRAIL_LENGTH) * 0.6;
        tCol[base] = r * segFade; tCol[base + 1] = g * segFade; tCol[base + 2] = b * segFade;
        const endFade = fade * (1 - (s + 1) / TRAIL_LENGTH) * 0.6;
        tCol[base + 3] = r * endFade; tCol[base + 4] = g * endFade; tCol[base + 5] = b * endFade;
      }
    }

    // Update head points
    const pGeo = pointsRef.current.geometry;
    pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    pGeo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    pGeo.attributes.position.needsUpdate = true;
    pGeo.attributes.color.needsUpdate = true;

    // Update trail lines
    const lGeo = trailRef.current.geometry;
    lGeo.setAttribute('position', new THREE.BufferAttribute(tPos, 3));
    lGeo.setAttribute('color', new THREE.BufferAttribute(tCol, 3));
    lGeo.attributes.position.needsUpdate = true;
    lGeo.attributes.color.needsUpdate = true;
  });

  return (
    <group position={position}>
      {/* Central flash at start */}
      {progress < 0.15 && (
        <pointLight
          color={color}
          intensity={8 * (1 - progress / 0.15)}
          distance={15}
          decay={2}
        />
      )}
      {/* Particle heads */}
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[new Float32Array(PARTICLE_COUNT * 3), 3]} />
          <bufferAttribute attach="attributes-color" args={[new Float32Array(PARTICLE_COUNT * 3), 3]} />
        </bufferGeometry>
        <pointsMaterial
          size={0.18}
          vertexColors
          transparent
          opacity={0.95}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          sizeAttenuation
        />
      </points>
      {/* Trailing streaks */}
      <lineSegments ref={trailRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[new Float32Array(trailVertCount * 3), 3]} />
          <bufferAttribute attach="attributes-color" args={[new Float32Array(trailVertCount * 3), 3]} />
        </bufferGeometry>
        <lineBasicMaterial
          vertexColors
          transparent
          opacity={0.7}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </lineSegments>
      {/* Glow sphere */}
      {progress < 0.4 && (
        <mesh>
          <sphereGeometry args={[0.6 + progress * 3, 16, 16]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.08 * (1 - progress / 0.4)}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      )}
    </group>
  );
}

// --- Drone light point (unchanged) ---
function LightPoint({ position, color }: { position: [number, number, number]; color: string }) {
  return (
    <QuadcopterModel position={position} color={color} />
  );
}

// --- Render active timeline effects ---
function TimelineEffects() {
  const { timelineItems, currentTime } = useProjectStore();

  const activeEffects = useMemo(() => {
    return timelineItems.map((item) => {
      const effect = EFFECT_LIBRARY.find((e) => e.id === item.effectId);
      if (!effect) return null;
      if (currentTime < item.startTime || currentTime > item.startTime + effect.duration) return null;
      const progress = (currentTime - item.startTime) / effect.duration;
      return { item, effect, progress };
    }).filter(Boolean) as { item: typeof timelineItems[0]; effect: typeof EFFECT_LIBRARY[0]; progress: number }[];
  }, [timelineItems, currentTime]);

  return (
    <>
      {activeEffects.map(({ item, effect, progress }) => {
        const pos: [number, number, number] = [item.position.x, item.position.y, item.position.z];
        if (effect.type === 'firework') {
          return (
            <FireworkBurst
              key={item.id}
              position={pos}
              color={effect.color}
              progress={progress}
            />
          );
        }
        return <LightPoint key={item.id} position={pos} color={effect.color} />;
      })}
    </>
  );
}

function GroundPlane() {
  return (
    <Grid
      position={[0, 0, 0]}
      args={[100, 100]}
      cellSize={2}
      cellThickness={0.5}
      cellColor="#1a2a3a"
      sectionSize={10}
      sectionThickness={1}
      sectionColor="#2a4a6a"
      fadeDistance={80}
      infiniteGrid
    />
  );
}

function LaunchSites() {
  const positions: [number, number, number][] = [
    [-8, 0.05, 0], [-4, 0.05, 0], [0, 0.05, 0], [4, 0.05, 0], [8, 0.05, 0],
  ];
  return (
    <>
      {positions.map((pos, i) => (
        <group key={i} position={pos}>
          <mesh>
            <boxGeometry args={[0.6, 0.1, 0.6]} />
            <meshStandardMaterial color="#3a3a3a" />
          </mesh>
          <mesh position={[0, 0.08, 0]}>
            <cylinderGeometry args={[0.08, 0.1, 0.3, 8]} />
            <meshStandardMaterial color="#555" metalness={0.8} roughness={0.3} />
          </mesh>
        </group>
      ))}
    </>
  );
}

export default function SkyCanvas() {
  const editorMode = useProjectStore((s) => s.editorMode);
  const cursorStyle = editorMode !== 'select' ? 'crosshair' : 'default';

  return (
    <div className="w-full h-full relative" style={{ cursor: cursorStyle }}>
      <Canvas shadows>
        <PerspectiveCamera makeDefault position={[0, 8, 25]} fov={60} />
        <OrbitControls
          enableDamping
          dampingFactor={0.05}
          maxPolarAngle={Math.PI / 2}
          minDistance={5}
          maxDistance={80}
        />
        
        <ambientLight intensity={0.05} />
        <directionalLight position={[10, 10, 5]} intensity={0.1} />
        
        <Stars radius={100} depth={50} count={3000} factor={3} saturation={0} fade speed={0.5} />
        <color attach="background" args={['#0a0a12']} />
        <fog attach="fog" args={['#0a0a12', 40, 100]} />
        
        <GroundPlane />
        <LaunchSites />
        <PositionPins />
        <TrajectoryPaths />
        <TimelineEffects />
        <PlaybackClock />
        <PostProcessing />
      </Canvas>
      
      <div className="absolute top-3 left-3 flex items-center gap-2">
        <span className="text-xs font-mono-code text-muted-foreground bg-surface-1/80 px-2 py-1 rounded-sm border border-border/50">
          3D VIEWPORT
        </span>
        <span className="text-xs font-mono-code text-electric bg-surface-1/80 px-2 py-1 rounded-sm border border-border/50">
          PERSPECTIVE
        </span>
      </div>
      <div className="absolute bottom-3 right-3 text-xs font-mono-code text-muted-foreground bg-surface-1/80 px-2 py-1 rounded-sm border border-border/50">
        Orbit: LMB · Pan: MMB · Zoom: Scroll
      </div>
    </div>
  );
}
