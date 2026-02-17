import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars, Grid, PerspectiveCamera } from '@react-three/drei';
import { useProjectStore, EFFECT_LIBRARY } from '@/store/useProjectStore';
import { useRef, useMemo, useEffect } from 'react';
import * as THREE from 'three';

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
const GRAVITY = -4;

function createParticleGeometry() {
  const positions = new Float32Array(PARTICLE_COUNT * 3);
  const velocities = new Float32Array(PARTICLE_COUNT * 3);
  const lifetimes = new Float32Array(PARTICLE_COUNT);

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    // random direction on a sphere
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const speed = 2 + Math.random() * 5;
    velocities[i * 3] = Math.sin(phi) * Math.cos(theta) * speed;
    velocities[i * 3 + 1] = Math.sin(phi) * Math.sin(theta) * speed * 0.8 + 1;
    velocities[i * 3 + 2] = Math.cos(phi) * speed;
    lifetimes[i] = 0.5 + Math.random() * 0.5; // 0.5-1.0 normalized lifetime offset
  }
  return { positions, velocities, lifetimes };
}

// --- Single firework burst ---
function FireworkBurst({
  position,
  color,
  progress,
}: {
  position: [number, number, number];
  color: string;
  progress: number; // 0..1 within the effect's duration
}) {
  const pointsRef = useRef<THREE.Points>(null);
  const { velocities, lifetimes } = useMemo(() => createParticleGeometry(), []);
  const positionsRef = useRef(new Float32Array(PARTICLE_COUNT * 3));
  const sizesRef = useRef(new Float32Array(PARTICLE_COUNT));
  const colorsRef = useRef(new Float32Array(PARTICLE_COUNT * 3));

  const baseColor = useMemo(() => new THREE.Color(color), [color]);

  useFrame(() => {
    if (!pointsRef.current) return;
    const geo = pointsRef.current.geometry;
    const pos = positionsRef.current;
    const sizes = sizesRef.current;
    const cols = colorsRef.current;

    // Map progress to a time in seconds for physics (max ~2s burst visual)
    const t = progress * 2.5;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const vx = velocities[i * 3];
      const vy = velocities[i * 3 + 1];
      const vz = velocities[i * 3 + 2];
      const lt = lifetimes[i];

      pos[i * 3] = vx * t * 0.5;
      pos[i * 3 + 1] = vy * t * 0.5 + 0.5 * GRAVITY * t * t * 0.25;
      pos[i * 3 + 2] = vz * t * 0.5;

      // Fade out over lifetime
      const fade = Math.max(0, 1 - progress / lt);
      sizes[i] = fade * (0.15 + Math.random() * 0.05);

      // Color fades toward dim orange/red
      const r = THREE.MathUtils.lerp(baseColor.r, 0.8, progress * 0.6);
      const g = THREE.MathUtils.lerp(baseColor.g, 0.2, progress * 0.8);
      const b = THREE.MathUtils.lerp(baseColor.b, 0.05, progress * 0.9);
      cols[i * 3] = r * fade;
      cols[i * 3 + 1] = g * fade;
      cols[i * 3 + 2] = b * fade;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    geo.attributes.position.needsUpdate = true;
    geo.attributes.size.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
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
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[new Float32Array(PARTICLE_COUNT * 3), 3]}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.15}
          vertexColors
          transparent
          opacity={0.9}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          sizeAttenuation
        />
      </points>
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
    <group position={position}>
      <mesh>
        <sphereGeometry args={[0.15, 16, 16]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <pointLight color={color} intensity={2} distance={8} decay={2} />
      <mesh>
        <sphereGeometry args={[0.4, 16, 16]} />
        <meshBasicMaterial color={color} transparent opacity={0.15} />
      </mesh>
    </group>
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
  return (
    <div className="w-full h-full relative">
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
        <TimelineEffects />
        <PlaybackClock />
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
