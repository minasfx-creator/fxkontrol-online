import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Stars, Grid, PerspectiveCamera } from '@react-three/drei';
import { useProjectStore, EFFECT_LIBRARY } from '@/store/useProjectStore';
import { useRef, useMemo, useEffect, useState, Component, ErrorInfo, ReactNode } from 'react';
import * as THREE from 'three';
import PositionPins from './PositionPins';
import PostProcessing from './PostProcessing';
import CameraAnimator, { CameraPathPreview } from './CameraAnimator';
import TrajectoryPaths from './TrajectoryPaths';
import DroneChoreography from './DroneChoreography';
import BoidsVisualizer from './BoidsVisualizer';
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
      {/* Glow handled by bloom — no pointLight to avoid uniform overflow */}
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

// ========================================================================
// FINALE 3D STYLE — Clean gradient night sky
// ========================================================================
function SkyGradient() {
  return (
    <mesh>
      <sphereGeometry args={[200, 32, 32]} />
      <shaderMaterial
        side={THREE.BackSide}
        vertexShader={`
          varying vec3 vWorldPosition;
          void main() {
            vec4 worldPosition = modelMatrix * vec4(position, 1.0);
            vWorldPosition = worldPosition.xyz;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          varying vec3 vWorldPosition;
          
          void main() {
            vec3 dir = normalize(vWorldPosition);
            float h = dir.y;
            
            // Clean night sky gradient — Finale 3D style
            vec3 zenith = vec3(0.02, 0.02, 0.06);       // dark blue-black top
            vec3 mid = vec3(0.04, 0.06, 0.14);           // deep navy
            vec3 horizon = vec3(0.08, 0.10, 0.18);       // lighter blue-grey horizon
            vec3 ground = vec3(0.02, 0.03, 0.05);        // below horizon
            
            vec3 color;
            if (h > 0.3) {
              color = mix(mid, zenith, smoothstep(0.3, 0.9, h));
            } else if (h > 0.0) {
              color = mix(horizon, mid, smoothstep(0.0, 0.3, h));
            } else {
              color = mix(ground, horizon, smoothstep(-0.15, 0.0, h));
            }
            
            // Subtle warm glow at horizon
            float horizonBand = exp(-h * h * 80.0);
            color += vec3(0.06, 0.04, 0.02) * horizonBand * 0.3;
            
            gl_FragColor = vec4(color, 1.0);
          }
        `}
      />
    </mesh>
  );
}

// --- Simple moon ---
function Moon() {
  return (
    <group position={[60, 55, -80]}>
      <mesh>
        <sphereGeometry args={[3, 32, 32]} />
        <meshBasicMaterial color="#c8c0b0" />
      </mesh>
      {/* Soft glow */}
      <mesh>
        <sphereGeometry args={[5, 16, 16]} />
        <meshBasicMaterial color="#8090a0" transparent opacity={0.08} blending={THREE.AdditiveBlending} />
      </mesh>
      <pointLight color="#8899bb" intensity={0.3} distance={300} decay={1} />
    </group>
  );
}

// --- Procedural grass shader ground ---
function GrassGround() {
  const uniforms = useMemo(() => ({
    time: { value: 0 },
    moonDir: { value: new THREE.Vector3(0.5, 0.7, -0.5).normalize() },
  }), []);

  useFrame(({ clock }) => {
    uniforms.time.value = clock.getElapsedTime();
  });

  const grassVertexShader = `
    varying vec2 vUv;
    varying vec3 vWorldPos;
    varying vec3 vNormal;
    void main() {
      vUv = uv;
      vNormal = normalize(normalMatrix * normal);
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vWorldPos = wp.xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const grassFragmentShader = `
    uniform float time;
    uniform vec3 moonDir;
    varying vec2 vUv;
    varying vec3 vWorldPos;
    varying vec3 vNormal;

    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float noise(vec2 p) {
      vec2 i = floor(p); vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1,0)), f.x),
                 mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y);
    }
    float fbm(vec2 p) {
      float v = 0.0; float a = 0.5;
      for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.1; a *= 0.5; }
      return v;
    }

    void main() {
      vec2 worldUV = vWorldPos.xz;

      // Multi-scale grass color variation
      float large = fbm(worldUV * 0.02);
      float medium = fbm(worldUV * 0.08 + 50.0);
      float fine = fbm(worldUV * 0.5 + 100.0);
      float micro = noise(worldUV * 4.0);

      // Base grass palette — dark greens with brown patches
      vec3 grassDark  = vec3(0.06, 0.14, 0.04);
      vec3 grassMid   = vec3(0.10, 0.22, 0.06);
      vec3 grassLight = vec3(0.14, 0.30, 0.08);
      vec3 grassDry   = vec3(0.16, 0.18, 0.06);
      vec3 dirt        = vec3(0.10, 0.08, 0.04);

      // Blend grass types
      vec3 color = mix(grassDark, grassMid, smoothstep(0.3, 0.6, large));
      color = mix(color, grassLight, smoothstep(0.5, 0.8, medium) * 0.5);
      color = mix(color, grassDry, smoothstep(0.65, 0.85, large * medium) * 0.4);

      // Dirt patches
      float dirtMask = smoothstep(0.7, 0.82, fbm(worldUV * 0.15 + 200.0));
      color = mix(color, dirt, dirtMask * 0.6);

      // Fine grass blade texture
      float blades = smoothstep(0.35, 0.65, micro) * 0.15;
      color += vec3(0.02, 0.04, 0.01) * blades;

      // Wind-driven color shift (subtle)
      float wind = sin(worldUV.x * 0.3 + time * 0.4) * cos(worldUV.y * 0.2 + time * 0.3);
      color += vec3(0.01, 0.02, 0.005) * wind * 0.3;

      // Moonlight diffuse
      float diffuse = max(dot(vNormal, moonDir), 0.0);
      float ambient = 0.25;
      color *= (diffuse * 0.6 + ambient);

      // Distance fade to darker
      float dist = length(worldUV) * 0.005;
      color *= 1.0 - smoothstep(0.0, 1.0, dist) * 0.4;

      // Subtle dew/moisture specular
      float dew = pow(max(dot(reflect(-moonDir, vNormal), normalize(vec3(0,1,0))), 0.0), 16.0);
      float dewMask = smoothstep(0.4, 0.7, fine);
      color += vec3(0.05, 0.08, 0.12) * dew * dewMask * 0.3;

      gl_FragColor = vec4(color, 1.0);
    }
  `;

  return (
    <>
      <mesh position={[0, -0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[500, 500, 1, 1]} />
        <shaderMaterial
          uniforms={uniforms}
          vertexShader={grassVertexShader}
          fragmentShader={grassFragmentShader}
        />
      </mesh>
      {/* Slightly brighter near-stage grass overlay */}
      <mesh position={[0, -0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[50, 64]} />
        <shaderMaterial
          uniforms={uniforms}
          vertexShader={grassVertexShader}
          fragmentShader={`
            uniform float time;
            uniform vec3 moonDir;
            varying vec2 vUv;
            varying vec3 vWorldPos;
            varying vec3 vNormal;

            float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
            float noise(vec2 p) {
              vec2 i = floor(p); vec2 f = fract(p);
              f = f * f * (3.0 - 2.0 * f);
              return mix(mix(hash(i), hash(i + vec2(1,0)), f.x),
                         mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y);
            }
            float fbm(vec2 p) {
              float v = 0.0; float a = 0.5;
              for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.1; a *= 0.5; }
              return v;
            }

            void main() {
              vec2 worldUV = vWorldPos.xz;
              float large = fbm(worldUV * 0.03);
              float fine = noise(worldUV * 5.0);

              // Well-maintained grass near stage
              vec3 grassA = vec3(0.08, 0.20, 0.05);
              vec3 grassB = vec3(0.12, 0.28, 0.07);
              vec3 color = mix(grassA, grassB, smoothstep(0.3, 0.7, large));
              color += vec3(0.01, 0.03, 0.005) * fine * 0.2;

              // Mowing pattern (stripes)
              float stripes = sin(worldUV.x * 1.5) * 0.5 + 0.5;
              color = mix(color, color * 1.08, stripes * 0.15);

              float diffuse = max(dot(vNormal, moonDir), 0.0);
              color *= (diffuse * 0.6 + 0.3);

              // Edge fade
              float edgeDist = length(vWorldPos.xz) / 50.0;
              float edgeFade = smoothstep(0.85, 1.0, edgeDist);
              color = mix(color, vec3(0.06, 0.14, 0.04), edgeFade);

              gl_FragColor = vec4(color, 1.0);
            }
          `}
          transparent={false}
        />
      </mesh>
    </>
  );
}

function StageGround() {
  return (
    <group>
      <GrassGround />

      {/* Operational grid */}
      <Grid
        position={[0, 0.01, 0]}
        args={[200, 200]}
        cellSize={2}
        cellThickness={0.3}
        cellColor="#2a4a2a"
        sectionSize={10}
        sectionThickness={0.8}
        sectionColor="#3a5a3a"
        fadeDistance={100}
        infiniteGrid
      />

      {/* Central firing area marker */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[24, 24.3, 64]} />
        <meshBasicMaterial color="#ff4444" transparent opacity={0.5} />
      </mesh>
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[49, 49.3, 64]} />
        <meshBasicMaterial color="#ffaa00" transparent opacity={0.3} />
      </mesh>

      {/* Scale reference poles */}
      {[-20, -10, 0, 10, 20].map((x) => (
        <group key={`pole-${x}`} position={[x, 0, -20]}>
          <mesh position={[0, 3, 0]} castShadow>
            <cylinderGeometry args={[0.03, 0.04, 6, 8]} />
            <meshStandardMaterial color="#666666" metalness={0.5} roughness={0.4} />
          </mesh>
          {[2, 4, 6].map((h) => (
            <mesh key={h} position={[0, h, 0]}>
              <boxGeometry args={[0.12, 0.02, 0.12]} />
              <meshBasicMaterial color="#888888" transparent opacity={0.5} />
            </mesh>
          ))}
          <mesh position={[0, 6.1, 0]}>
            <sphereGeometry args={[0.06, 8, 8]} />
            <meshBasicMaterial color="#ff0000" />
          </mesh>
        </group>
      ))}

      {/* Horizon treeline */}
      <TreelineSilhouette />
    </group>
  );
}

// --- Simple dark tree silhouettes at horizon ---
function TreelineSilhouette() {
  const trees = useMemo(() => {
    const result: { x: number; z: number; h: number; w: number }[] = [];
    for (let i = 0; i < 80; i++) {
      const angle = (i / 80) * Math.PI * 2;
      const dist = 90 + Math.random() * 15;
      result.push({
        x: Math.cos(angle) * dist,
        z: Math.sin(angle) * dist,
        h: 4 + Math.random() * 8,
        w: 2 + Math.random() * 3,
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
          <meshBasicMaterial color="#0a1a0a" transparent opacity={0.85} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}

// --- Launch sites ---
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
            <meshStandardMaterial color="#444444" metalness={0.5} roughness={0.4} />
          </mesh>
          <mesh position={[0, 0.2, 0]}>
            <cylinderGeometry args={[0.06, 0.08, 0.35, 12]} />
            <meshStandardMaterial color="#555555" metalness={0.6} roughness={0.3} />
          </mesh>
          <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.8, 0.85, 16]} />
            <meshBasicMaterial color="#cc3030" transparent opacity={0.25} />
          </mesh>
          <mesh position={[0.3, 0.08, 0.3]}>
            <sphereGeometry args={[0.02, 6, 6]} />
            <meshBasicMaterial color="#00ff44" />
          </mesh>
        </group>
      ))}
    </>
  );
}

// --- Camera controller ---
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
      <Canvas
        shadows
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.2,
          powerPreference: 'high-performance',
          alpha: false,
          stencil: false,
        }}
        dpr={[1, 2]}
      >
        <PerspectiveCamera makeDefault position={preset.position} fov={55} near={0.2} far={500} />
        <CameraController targetPosition={[...preset.position]} targetLookAt={[...preset.target]} />

        {/* Clean functional lighting — Finale 3D style */}
        <ambientLight intensity={0.15} color="#8090b0" />
        
        {/* Moonlight */}
        <directionalLight
          position={[60, 55, -80]}
          intensity={0.35}
          color="#8899cc"
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-far={200}
          shadow-camera-left={-50}
          shadow-camera-right={50}
          shadow-camera-top={50}
          shadow-camera-bottom={-50}
          shadow-bias={-0.0001}
        />
        
        {/* Sky fill */}
        <hemisphereLight args={['#1a2040', '#0a1808', 0.12]} />
        
        {/* Ground fill removed — minimal contribution, saves uniform slots */}

        <SkyGradient />
        <Moon />
        <Stars radius={180} depth={80} count={6000} factor={4} saturation={0.1} fade speed={0.1} />
        <fog attach="fog" args={['#0a0e18', 80, 250]} />

        <StageGround />
        <LaunchSites />
        <PositionPins />
        <TrajectoryPaths />
        <DroneChoreography />
        <BoidsVisualizer />
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
