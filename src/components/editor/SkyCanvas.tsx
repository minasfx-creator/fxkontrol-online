import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Stars, Grid, PerspectiveCamera, useTexture, Instances, Instance, MeshReflectorMaterial } from '@react-three/drei';
import { useProjectStore, EFFECT_LIBRARY } from '@/store/useProjectStore';
import { useRef, useMemo, useEffect, useState, Component, ErrorInfo, ReactNode } from 'react';
import * as THREE from 'three';
import PositionPins from './PositionPins';
import PostProcessing from './PostProcessing';
import CameraAnimator, { CameraPathPreview } from './CameraAnimator';
import TrajectoryPaths from './TrajectoryPaths';
import DroneChoreography from './DroneChoreography';
import QuadcopterModel from './QuadcopterModel';
import GeofenceVisual from './GeofenceVisual';
import { Camera, Eye, Video, Plane, Users, Maximize, Minimize, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CometEffect, ShockwaveEffect, MultiBurstEffect, FanEffect } from './effects';

class WebGLErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn('WebGL unavailable:', error.message);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-surface-0 gap-3 p-8 text-center">
          <AlertTriangle className="w-10 h-10 text-yellow-500" />
          <h3 className="text-sm font-semibold text-foreground">3D Engine Unavailable</h3>
          <p className="text-xs text-muted-foreground max-w-md">
            WebGL could not be initialized. Try enabling hardware acceleration or use a different browser.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

const CAMERA_PRESETS = [
  { id: 'free', label: 'Free', icon: Eye, position: [0, 8, 25] as [number, number, number], target: [0, 5, 0] as [number, number, number] },
  { id: 'audience', label: 'Plateia', icon: Users, position: [0, 3, 35] as [number, number, number], target: [0, 8, 0] as [number, number, number] },
  { id: 'aerial', label: 'Aéreo', icon: Plane, position: [0, 40, 5] as [number, number, number], target: [0, 0, 0] as [number, number, number] },
  { id: 'side', label: 'Lateral', icon: Video, position: [35, 8, 0] as [number, number, number], target: [0, 8, 0] as [number, number, number] },
  { id: 'closeup', label: 'Close-up', icon: Camera, position: [5, 6, 8] as [number, number, number], target: [0, 8, 0] as [number, number, number] },
] as const;

// --- Playback clock ---
function PlaybackClock() {
  const { isPlaying, currentTime, duration, setCurrentTime, setPlaying, playbackSpeed } = useProjectStore();
  const prevTime = useRef(performance.now());

  useFrame(() => {
    const now = performance.now();
    if (isPlaying) {
      const delta = ((now - prevTime.current) / 1000) * playbackSpeed;
      const next = currentTime + delta;
      if (next >= duration) { setCurrentTime(duration); setPlaying(false); } else { setCurrentTime(next); }
    }
    prevTime.current = now;
  });
  return null;
}

// --- Particle system ---
const PARTICLE_COUNT = 120;
const TRAIL_LENGTH = 6;
const GRAVITY = -4;

function getWindForce(): [number, number, number] {
  const { wind } = useProjectStore.getState();
  if (!wind.enabled) return [0, 0, 0];
  const rad = (wind.direction * Math.PI) / 180;
  const gust = 1 + (Math.sin(performance.now() * 0.001) * 0.5 + 0.5) * wind.gustStrength;
  const s = wind.speed * gust * 0.15;
  return [Math.sin(rad) * s, 0, Math.cos(rad) * s];
}

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

function particlePos(vx: number, vy: number, vz: number, t: number, wind: [number, number, number]): [number, number, number] {
  return [
    vx * t * 0.5 + wind[0] * t * t * 0.5,
    vy * t * 0.5 + 0.5 * GRAVITY * t * t * 0.25,
    vz * t * 0.5 + wind[2] * t * t * 0.5,
  ];
}

function FireworkBurst({ position, color, progress }: { position: [number, number, number]; color: string; progress: number }) {
  const pointsRef = useRef<THREE.Points>(null);
  const trailRef = useRef<THREE.LineSegments>(null);
  const { velocities, lifetimes } = useMemo(() => createParticleGeometry(), []);
  const positionsRef = useRef(new Float32Array(PARTICLE_COUNT * 3));
  const colorsRef = useRef(new Float32Array(PARTICLE_COUNT * 3));
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
    const trailDt = 0.06;
    const w = getWindForce();

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const vx = velocities[i * 3], vy = velocities[i * 3 + 1], vz = velocities[i * 3 + 2];
      const lt = lifetimes[i];
      const fade = Math.max(0, 1 - progress / lt);
      const [hx, hy, hz] = particlePos(vx, vy, vz, t, w);
      pos[i * 3] = hx; pos[i * 3 + 1] = hy; pos[i * 3 + 2] = hz;

      const r = THREE.MathUtils.lerp(baseColor.r, 0.8, progress * 0.6) * fade;
      const g = THREE.MathUtils.lerp(baseColor.g, 0.2, progress * 0.8) * fade;
      const b = THREE.MathUtils.lerp(baseColor.b, 0.05, progress * 0.9) * fade;
      cols[i * 3] = r; cols[i * 3 + 1] = g; cols[i * 3 + 2] = b;

      for (let s = 0; s < TRAIL_LENGTH; s++) {
        const t0 = Math.max(0, t - s * trailDt);
        const t1 = Math.max(0, t - (s + 1) * trailDt);
        const [x0, y0, z0] = particlePos(vx, vy, vz, t0, w);
        const [x1, y1, z1] = particlePos(vx, vy, vz, t1, w);
        const base = (i * TRAIL_LENGTH + s) * 6;
        tPos[base] = x0; tPos[base + 1] = y0; tPos[base + 2] = z0;
        tPos[base + 3] = x1; tPos[base + 4] = y1; tPos[base + 5] = z1;
        const segFade = fade * (1 - s / TRAIL_LENGTH) * 0.6;
        tCol[base] = r * segFade; tCol[base + 1] = g * segFade; tCol[base + 2] = b * segFade;
        const endFade = fade * (1 - (s + 1) / TRAIL_LENGTH) * 0.6;
        tCol[base + 3] = r * endFade; tCol[base + 4] = g * endFade; tCol[base + 5] = b * endFade;
      }
    }

    const pGeo = pointsRef.current.geometry;
    pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    pGeo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    pGeo.attributes.position.needsUpdate = true;
    pGeo.attributes.color.needsUpdate = true;

    const lGeo = trailRef.current.geometry;
    lGeo.setAttribute('position', new THREE.BufferAttribute(tPos, 3));
    lGeo.setAttribute('color', new THREE.BufferAttribute(tCol, 3));
    lGeo.attributes.position.needsUpdate = true;
    lGeo.attributes.color.needsUpdate = true;
  });

  return (
    <group position={position}>
      {progress < 0.15 && <pointLight color={color} intensity={8 * (1 - progress / 0.15)} distance={15} decay={2} />}
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[new Float32Array(PARTICLE_COUNT * 3), 3]} />
          <bufferAttribute attach="attributes-color" args={[new Float32Array(PARTICLE_COUNT * 3), 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.18} vertexColors transparent opacity={0.95} depthWrite={false} blending={THREE.AdditiveBlending} sizeAttenuation />
      </points>
      <lineSegments ref={trailRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[new Float32Array(trailVertCount * 3), 3]} />
          <bufferAttribute attach="attributes-color" args={[new Float32Array(trailVertCount * 3), 3]} />
        </bufferGeometry>
        <lineBasicMaterial vertexColors transparent opacity={0.7} depthWrite={false} blending={THREE.AdditiveBlending} />
      </lineSegments>
      {progress < 0.4 && (
        <mesh>
          <sphereGeometry args={[0.6 + progress * 3, 16, 16]} />
          <meshBasicMaterial color={color} transparent opacity={0.08 * (1 - progress / 0.4)} blending={THREE.AdditiveBlending} />
        </mesh>
      )}
    </group>
  );
}

function LightPoint({ position, color }: { position: [number, number, number]; color: string }) {
  return <QuadcopterModel position={position} color={color} />;
}

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
        const eid = effect.id;
        if (eid.startsWith('comet-')) return <CometEffect key={item.id} position={pos} color={effect.color} progress={progress} direction={eid === 'comet-02' ? 'down' : 'up'} />;
        if (eid.startsWith('shock-')) return <ShockwaveEffect key={item.id} position={pos} color={effect.color} progress={progress} />;
        if (eid.startsWith('mburst-')) return <MultiBurstEffect key={item.id} position={pos} color={effect.color} progress={progress} burstCount={eid === 'mburst-02' ? 5 : 3} />;
        if (eid.startsWith('fan-')) return <FanEffect key={item.id} position={pos} color={effect.color} progress={progress} spreadAngle={eid === 'fan-02' ? 180 : 90} />;
        if (effect.type === 'firework') return <FireworkBurst key={item.id} position={pos} color={effect.color} progress={progress} />;
        return <LightPoint key={item.id} position={pos} color={effect.color} />;
      })}
    </>
  );
}

// --- Enhanced atmosphere ---
function SkyGradient() {
  const meshRef = useRef<THREE.Mesh>(null);
  const uniforms = useMemo(() => ({
    topColor: { value: new THREE.Color('#020208') },
    midColor: { value: new THREE.Color('#060c22') },
    bottomColor: { value: new THREE.Color('#0e1428') },
    horizonColor: { value: new THREE.Color('#1a2545') },
    horizonGlow: { value: new THREE.Color('#2a3868') },
    time: { value: 0 },
  }), []);

  useFrame(({ clock }) => {
    uniforms.time.value = clock.getElapsedTime();
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[200, 64, 64]} />
      <shaderMaterial
        side={THREE.BackSide}
        uniforms={uniforms}
        vertexShader={`
          varying vec3 vWorldPosition;
          varying vec2 vUv;
          void main() {
            vec4 worldPosition = modelMatrix * vec4(position, 1.0);
            vWorldPosition = worldPosition.xyz;
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          uniform vec3 topColor;
          uniform vec3 midColor;
          uniform vec3 bottomColor;
          uniform vec3 horizonColor;
          uniform vec3 horizonGlow;
          uniform float time;
          varying vec3 vWorldPosition;
          varying vec2 vUv;

          // Simple noise
          float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
          float noise(vec2 p) {
            vec2 i = floor(p); vec2 f = fract(p);
            f = f*f*(3.0-2.0*f);
            return mix(mix(hash(i), hash(i+vec2(1,0)), f.x),
                       mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y);
          }

          void main() {
            float h = normalize(vWorldPosition).y;
            vec3 color;

            // Multi-band sky gradient
            if (h > 0.5) {
              color = mix(midColor, topColor, smoothstep(0.5, 1.0, h));
            } else if (h > 0.1) {
              color = mix(horizonGlow, midColor, smoothstep(0.1, 0.5, h));
            } else if (h > -0.02) {
              // Horizon band with atmospheric glow
              float band = 1.0 - abs(h - 0.04) * 12.0;
              band = max(band, 0.0);
              color = mix(horizonColor, horizonGlow, band * 0.6);
              // Add warm horizon glow
              color += vec3(0.08, 0.04, 0.02) * band * 0.5;
            } else {
              color = mix(bottomColor, horizonColor, smoothstep(-0.3, -0.02, h));
            }

            // Subtle cloud wisps
            float cloudNoise = noise(vUv * 8.0 + time * 0.01);
            cloudNoise *= noise(vUv * 16.0 - time * 0.005);
            float cloudMask = smoothstep(0.35, 0.55, cloudNoise) * smoothstep(-0.1, 0.3, h) * smoothstep(0.8, 0.3, h);
            color += vec3(0.03, 0.04, 0.06) * cloudMask * 0.4;

            // Atmospheric scattering at horizon
            float scatter = exp(-abs(h) * 8.0) * 0.15;
            color += vec3(0.05, 0.06, 0.12) * scatter;

            gl_FragColor = vec4(color, 1.0);
          }
        `}
      />
    </mesh>
  );
}

// --- Moon ---
function Moon() {
  const ref = useRef<THREE.Group>(null);
  return (
    <group ref={ref} position={[60, 65, -80]}>
      <mesh>
        <sphereGeometry args={[4, 32, 32]} />
        <meshBasicMaterial color="#c8c8d0" />
      </mesh>
      {/* Moon glow */}
      <mesh>
        <sphereGeometry args={[6, 32, 32]} />
        <meshBasicMaterial color="#8090b0" transparent opacity={0.08} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh>
        <sphereGeometry args={[10, 32, 32]} />
        <meshBasicMaterial color="#405070" transparent opacity={0.03} blending={THREE.AdditiveBlending} />
      </mesh>
      <pointLight color="#8899bb" intensity={0.3} distance={200} decay={1} />
    </group>
  );
}

// --- Stage & Ground ---
function StageGround() {
  return (
    <group>
      {/* Reflective ground plane — captures firework & drone LED reflections */}
      <mesh position={[0, -0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[400, 400, 1, 1]} />
        <MeshReflectorMaterial
          mirror={0.35}
          resolution={512}
          mixBlur={8}
          mixStrength={0.6}
          roughness={0.85}
          depthScale={1.2}
          minDepthThreshold={0.4}
          maxDepthThreshold={1.4}
          color="#0a0f08"
          metalness={0.15}
          blur={[300, 100]}
        />
      </mesh>

      {/* Main operational grid */}
      <Grid
        position={[0, 0.01, 0]}
        args={[200, 200]}
        cellSize={2}
        cellThickness={0.3}
        cellColor="#0d1520"
        sectionSize={10}
        sectionThickness={0.8}
        sectionColor="#152040"
        fadeDistance={120}
        infiniteGrid
      />

      {/* Reflective central stage platform */}
      <mesh position={[0, -0.005, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[26, 128]} />
        <MeshReflectorMaterial
          mirror={0.5}
          resolution={512}
          mixBlur={6}
          mixStrength={0.8}
          roughness={0.7}
          depthScale={1}
          minDepthThreshold={0.3}
          maxDepthThreshold={1.2}
          color="#0e1018"
          metalness={0.3}
          blur={[200, 80]}
        />
      </mesh>

      {/* Stage safety rim */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[24.5, 25, 128]} />
        <meshBasicMaterial color="#c8a020" transparent opacity={0.25} />
      </mesh>

      {/* Ground fog layer */}
      <mesh position={[0, 0.3, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[120, 120]} />
        <meshBasicMaterial color="#101828" transparent opacity={0.04} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>

      {/* Audience rows */}
      {[30, 34, 38, 42, 46].map((z, i) => (
        <group key={`aud-${i}`}>
          <mesh position={[0, 0.01, z]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[50 + i * 6, 0.3]} />
            <meshBasicMaterial color="#121828" transparent opacity={0.4} />
          </mesh>
        </group>
      ))}

      {/* Scale reference poles */}
      {[-20, -15, -10, -5, 0, 5, 10, 15, 20].map((x) => (
        <group key={`pole-${x}`} position={[x, 0, -22]}>
          <mesh position={[0, 3, 0]}>
            <cylinderGeometry args={[0.025, 0.03, 6, 8]} />
            <meshStandardMaterial color="#1a2040" metalness={0.6} roughness={0.4} />
          </mesh>
          {[2, 4, 6].map((h) => (
            <mesh key={h} position={[0, h, 0]}>
              <boxGeometry args={[0.08, 0.01, 0.08]} />
              <meshBasicMaterial color="#304080" transparent opacity={0.3} />
            </mesh>
          ))}
          <mesh position={[0, 6.1, 0]}>
            <sphereGeometry args={[0.06, 8, 8]} />
            <meshBasicMaterial color="#3050a0" transparent opacity={0.4} />
          </mesh>
        </group>
      ))}

      <TreelineSilhouette />
      <DistantCityLights />
    </group>
  );
}

function TreelineSilhouette() {
  const trees = useMemo(() => {
    const result: { x: number; z: number; h: number; w: number }[] = [];
    for (let i = 0; i < 80; i++) {
      const angle = (i / 80) * Math.PI * 2;
      const dist = 85 + Math.random() * 15;
      result.push({
        x: Math.cos(angle) * dist,
        z: Math.sin(angle) * dist,
        h: 3 + Math.random() * 6,
        w: 1.5 + Math.random() * 2,
      });
    }
    return result;
  }, []);

  return (
    <group>
      {trees.map((t, i) => (
        <mesh key={i} position={[t.x, t.h * 0.5, t.z]}
          rotation={[0, Math.atan2(t.x, t.z), 0]}>
          <planeGeometry args={[t.w, t.h]} />
          <meshBasicMaterial color="#040608" transparent opacity={0.85} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}

function DistantCityLights() {
  const lights = useMemo(() => {
    const result: { x: number; z: number; y: number; color: string; op: number }[] = [];
    const colors = ['#ff8844', '#ffaa33', '#ffcc66', '#88aaff', '#ffffff'];
    for (let i = 0; i < 40; i++) {
      const angle = (i / 40) * Math.PI + Math.PI * 0.6 + (Math.random() - 0.5) * 0.3;
      const dist = 110 + Math.random() * 30;
      result.push({
        x: Math.cos(angle) * dist,
        z: Math.sin(angle) * dist,
        y: 0.5 + Math.random() * 2,
        color: colors[Math.floor(Math.random() * colors.length)],
        op: 0.02 + Math.random() * 0.04,
      });
    }
    return result;
  }, []);

  return (
    <group>
      {lights.map((l, i) => (
        <mesh key={i} position={[l.x, l.y, l.z]}>
          <sphereGeometry args={[0.15, 4, 4]} />
          <meshBasicMaterial color={l.color} transparent opacity={l.op} blending={THREE.AdditiveBlending} />
        </mesh>
      ))}
    </group>
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
          <mesh receiveShadow>
            <boxGeometry args={[0.7, 0.12, 0.7]} />
            <meshStandardMaterial color="#1a1a2e" metalness={0.7} roughness={0.3} />
          </mesh>
          <mesh position={[0, 0.2, 0]}>
            <cylinderGeometry args={[0.06, 0.08, 0.35, 12]} />
            <meshStandardMaterial color="#2a2a40" metalness={0.85} roughness={0.2} />
          </mesh>
          <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.8, 0.85, 16]} />
            <meshBasicMaterial color="#c83030" transparent opacity={0.15} />
          </mesh>
          <mesh position={[0.3, 0.08, 0.3]}>
            <sphereGeometry args={[0.02, 6, 6]} />
            <meshBasicMaterial color="#00ff44" />
          </mesh>
          <pointLight color="#ff4500" intensity={0.15} distance={1.2} decay={2} position={[0, 0.25, 0]} />
        </group>
      ))}
    </>
  );
}

// --- Enhanced atmosphere particles ---
function AtmosphereParticles() {
  const dustRef = useRef<THREE.Points>(null);
  const fogRef = useRef<THREE.Points>(null);
  const dustCount = 300;
  const fogCount = 80;

  const dustPositions = useMemo(() => {
    const arr = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 120;
      arr[i * 3 + 1] = Math.random() * 50;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 120;
    }
    return arr;
  }, []);

  const fogPositions = useMemo(() => {
    const arr = new Float32Array(fogCount * 3);
    for (let i = 0; i < fogCount; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 100;
      arr[i * 3 + 1] = 0.3 + Math.random() * 2;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 100;
    }
    return arr;
  }, []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (dustRef.current) {
      const pos = dustRef.current.geometry.attributes.position;
      for (let i = 0; i < dustCount; i++) {
        const ix = i * 3;
        (pos.array as Float32Array)[ix] += Math.sin(t * 0.03 + i * 0.2) * 0.003;
        (pos.array as Float32Array)[ix + 1] += Math.cos(t * 0.02 + i * 0.15) * 0.001;
        (pos.array as Float32Array)[ix + 2] += Math.sin(t * 0.025 + i * 0.3) * 0.002;
      }
      pos.needsUpdate = true;
    }
    if (fogRef.current) {
      const fp = fogRef.current.geometry.attributes.position;
      for (let i = 0; i < fogCount; i++) {
        const ix = i * 3;
        (fp.array as Float32Array)[ix] += Math.sin(t * 0.01 + i) * 0.008;
        (fp.array as Float32Array)[ix + 2] += Math.cos(t * 0.008 + i) * 0.006;
      }
      fp.needsUpdate = true;
    }
  });

  return (
    <group>
      <points ref={dustRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[dustPositions, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.06} color="#3050a0" transparent opacity={0.12} depthWrite={false} blending={THREE.AdditiveBlending} sizeAttenuation />
      </points>
      <points ref={fogRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[fogPositions, 3]} />
        </bufferGeometry>
        <pointsMaterial size={1.5} color="#101830" transparent opacity={0.06} depthWrite={false} blending={THREE.AdditiveBlending} sizeAttenuation />
      </points>
    </group>
  );
}

function CameraController({ targetPosition, targetLookAt }: { targetPosition: [number, number, number]; targetLookAt: [number, number, number] }) {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);
  const targetPos = useRef(new THREE.Vector3(...targetPosition));
  const targetLook = useRef(new THREE.Vector3(...targetLookAt));
  const animating = useRef(false);

  useEffect(() => {
    targetPos.current.set(...targetPosition);
    targetLook.current.set(...targetLookAt);
    animating.current = true;
  }, [targetPosition, targetLookAt]);

  useFrame(() => {
    if (!animating.current || !controlsRef.current) return;
    camera.position.lerp(targetPos.current, 0.06);
    controlsRef.current.target.lerp(targetLook.current, 0.06);
    controlsRef.current.update();
    if (camera.position.distanceTo(targetPos.current) < 0.05) animating.current = false;
  });

  return (
    <OrbitControls ref={controlsRef} enableDamping dampingFactor={0.05} maxPolarAngle={Math.PI * 0.48} minDistance={3} maxDistance={150} />
  );
}

export default function SkyCanvas() {
  const editorMode = useProjectStore((s) => s.editorMode);
  const cursorStyle = editorMode !== 'select' ? 'crosshair' : 'default';
  const [activePreset, setActivePreset] = useState('free');
  const preset = CAMERA_PRESETS.find((p) => p.id === activePreset) || CAMERA_PRESETS[0];

  return (
    <div className="w-full h-full relative bg-[#050510]" data-sky-canvas style={{ cursor: cursorStyle }}>
      <WebGLErrorBoundary>
      <Canvas shadows="soft" gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 0.65, powerPreference: 'high-performance' }}>
        <PerspectiveCamera makeDefault position={preset.position} fov={55} near={0.5} far={500} />
        <CameraController targetPosition={[...preset.position]} targetLookAt={[...preset.target]} />
        
        {/* Realistic night lighting */}
        <ambientLight intensity={0.02} color="#0e1530" />
        <directionalLight position={[60, 65, -80]} intensity={0.06} color="#8899bb" castShadow shadow-mapSize={[1024, 1024]} shadow-camera-far={200} />
        <hemisphereLight args={['#0a0e2a', '#030508', 0.04]} />
        {/* Subtle ground bounce light */}
        <pointLight position={[0, -1, 0]} color="#0a1020" intensity={0.02} distance={60} />
        
        <SkyGradient />
        <Moon />
        <Stars radius={180} depth={80} count={6000} factor={4} saturation={0.15} fade speed={0.2} />
        <AtmosphereParticles />
        <fog attach="fog" args={['#060a14', 60, 180]} />
        
        <StageGround />
        <LaunchSites />
        <PositionPins />
        <TrajectoryPaths />
        <DroneChoreography />
        <TimelineEffects />
        <GeofenceVisual />
        <PlaybackClock />
        <CameraAnimator />
        <CameraPathPreview />
        <PostProcessing />
      </Canvas>
      </WebGLErrorBoundary>
      
      {/* Camera presets */}
      <div className="absolute top-3 left-3 flex items-center gap-1">
        {CAMERA_PRESETS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActivePreset(id)}
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded-sm text-[10px] font-mono-code transition-all border",
              activePreset === id
                ? "bg-primary/20 text-primary border-primary/40 glow-electric"
                : "bg-surface-1/80 text-muted-foreground border-border/50 hover:text-foreground hover:bg-surface-2/80"
            )}
          >
            <Icon className="w-3 h-3" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
        <button
          onClick={() => {
            const el = document.querySelector('[data-sky-canvas]') as HTMLElement;
            if (!el) return;
            document.fullscreenElement ? document.exitFullscreen() : el.requestFullscreen();
          }}
          className="bg-surface-1/80 text-muted-foreground border border-border/50 hover:text-foreground hover:bg-surface-2/80 px-2 py-1 rounded-sm transition-all"
        >
          {document.fullscreenElement ? <Minimize className="w-3.5 h-3.5" /> : <Maximize className="w-3.5 h-3.5" />}
        </button>
      </div>

      <div className="absolute bottom-3 right-3 text-xs font-mono-code text-muted-foreground bg-surface-1/80 px-2 py-1 rounded-sm border border-border/50">
        Orbit: LMB · Pan: MMB · Zoom: Scroll
      </div>
    </div>
  );
}
