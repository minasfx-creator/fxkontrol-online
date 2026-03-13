import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Stars, Grid, PerspectiveCamera, MeshReflectorMaterial } from '@react-three/drei';
import { useProjectStore, EFFECT_LIBRARY } from '@/store/useProjectStore';
import { useRef, useMemo, useEffect, useState, Component, ErrorInfo, ReactNode } from 'react';
import { PerfCollector, PerformanceHUD, type PerfStats } from './PerformanceHUD';
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
  { id: 'free', label: 'Free', icon: Eye, position: [0, 12, 40] as [number, number, number], target: [0, 8, 0] as [number, number, number] },
  { id: 'audience', label: 'Plateia', icon: Users, position: [0, 4, 60] as [number, number, number], target: [0, 12, 0] as [number, number, number] },
  { id: 'aerial', label: 'Aéreo', icon: Plane, position: [0, 80, 10] as [number, number, number], target: [0, 0, 0] as [number, number, number] },
  { id: 'side', label: 'Lateral', icon: Video, position: [60, 12, 0] as [number, number, number], target: [0, 12, 0] as [number, number, number] },
  { id: 'closeup', label: 'Close-up', icon: Camera, position: [8, 8, 14] as [number, number, number], target: [0, 10, 0] as [number, number, number] },
  { id: 'cinematic', label: 'Cinema', icon: Video, position: [-25, 6, 50] as [number, number, number], target: [0, 15, 0] as [number, number, number] },
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
// UE5-STYLE — Atmospheric scattering sky with Rayleigh/Mie
// ========================================================================
function SkyGradient() {
  return (
    <mesh>
      <sphereGeometry args={[200, 64, 64]} />
      <shaderMaterial
        side={THREE.BackSide}
        vertexShader={`
          varying vec3 vWorldPosition;
          varying vec3 vViewDir;
          void main() {
            vec4 worldPosition = modelMatrix * vec4(position, 1.0);
            vWorldPosition = worldPosition.xyz;
            vViewDir = normalize(worldPosition.xyz - cameraPosition);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          varying vec3 vWorldPosition;
          varying vec3 vViewDir;
          
          // Procedural star field
          float hash21(vec2 p) {
            p = fract(p * vec2(123.34, 456.21));
            p += dot(p, p + 45.32);
            return fract(p.x * p.y);
          }
          
          float starField(vec3 dir) {
            // Project direction to 2D grid cells
            vec2 uv = vec2(atan(dir.x, dir.z) * 3.183, asin(clamp(dir.y, -1.0, 1.0)) * 6.366);
            vec2 id = floor(uv * 120.0);
            float h = hash21(id);
            if (h > 0.985) {
              vec2 offset = fract(uv * 120.0) - 0.5;
              float brightness = smoothstep(0.12, 0.0, length(offset)) * (0.4 + h * 3.0);
              // Twinkling
              float twinkle = sin(h * 6283.0 + h * 200.0) * 0.3 + 0.7;
              return brightness * twinkle * smoothstep(0.05, 0.3, dir.y);
            }
            return 0.0;
          }
          
          void main() {
            vec3 dir = normalize(vWorldPosition);
            float h = dir.y;
            
            // UE5-style atmospheric sky
            // Deep space zenith → rich navy mid → warm horizon glow
            vec3 zenith    = vec3(0.008, 0.012, 0.04);      // near-black deep space
            vec3 upperSky  = vec3(0.015, 0.025, 0.08);      // deep indigo
            vec3 midSky    = vec3(0.03, 0.05, 0.14);        // rich navy
            vec3 lowSky    = vec3(0.06, 0.08, 0.18);        // steel blue
            vec3 horizon   = vec3(0.10, 0.10, 0.16);        // warm grey-blue
            vec3 ground    = vec3(0.015, 0.02, 0.035);      // very dark ground
            
            vec3 color;
            if (h > 0.6) {
              color = mix(upperSky, zenith, smoothstep(0.6, 1.0, h));
            } else if (h > 0.3) {
              color = mix(midSky, upperSky, smoothstep(0.3, 0.6, h));
            } else if (h > 0.1) {
              color = mix(lowSky, midSky, smoothstep(0.1, 0.3, h));
            } else if (h > 0.0) {
              color = mix(horizon, lowSky, smoothstep(0.0, 0.1, h));
            } else {
              color = mix(ground, horizon, smoothstep(-0.2, 0.0, h));
            }
            
            // Warm horizon glow band — Rayleigh scattering simulation
            float horizonBand = exp(-h * h * 120.0);
            vec3 horizonGlow = vec3(0.12, 0.08, 0.04); // amber-orange
            color += horizonGlow * horizonBand * 0.25;
            
            // Cool horizon anti-glow (opposite side) — subtle blue
            float antiHorizon = exp(-(h - 0.05) * (h - 0.05) * 40.0);
            color += vec3(0.02, 0.04, 0.08) * antiHorizon * 0.15;
            
            // Milky Way band — diagonal streak across sky
            float milkyAngle = dir.x * 0.6 + dir.z * 0.8;
            float milkyBand = exp(-pow(milkyAngle - dir.y * 0.5, 2.0) * 8.0);
            float milkyDetail = hash21(dir.xz * 40.0) * 0.3 + 0.7;
            color += vec3(0.02, 0.025, 0.04) * milkyBand * milkyDetail * smoothstep(0.1, 0.4, h) * 0.5;
            
            // Procedural stars (supplement drei Stars)
            float stars = starField(dir);
            vec3 starColor = mix(vec3(0.8, 0.85, 1.0), vec3(1.0, 0.9, 0.7), hash21(dir.xz * 50.0));
            color += starColor * stars * 0.6;
            
            // Atmospheric scattering — slight color shift at low angles
            float scatter = pow(max(1.0 - h, 0.0), 4.0);
            color += vec3(0.015, 0.01, 0.025) * scatter;
            
            gl_FragColor = vec4(color, 1.0);
          }
        `}
      />
    </mesh>
  );
}

// --- Volumetric Moon with crater detail ---
function Moon() {
  return (
    <group position={[60, 55, -80]}>
      {/* Moon body with procedural surface */}
      <mesh>
        <sphereGeometry args={[3.5, 64, 64]} />
        <shaderMaterial
          vertexShader={`
            varying vec3 vNormal;
            varying vec3 vPosition;
            varying vec2 vUv;
            void main() {
              vNormal = normalize(normalMatrix * normal);
              vPosition = position;
              vUv = uv;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `}
          fragmentShader={`
            varying vec3 vNormal;
            varying vec3 vPosition;
            varying vec2 vUv;
            
            float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
            float noise(vec2 p) {
              vec2 i = floor(p); vec2 f = fract(p);
              f = f * f * (3.0 - 2.0 * f);
              return mix(mix(hash(i), hash(i+vec2(1,0)), f.x),
                         mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y);
            }
            
            void main() {
              vec3 n = normalize(vNormal);
              vec3 lightDir = normalize(vec3(0.3, 0.2, -1.0));
              
              // Base moon color with warmth
              vec3 moonBase = vec3(0.85, 0.82, 0.75);
              
              // Crater detail using procedural noise
              float craters = noise(vPosition.xy * 3.0) * 0.3 + 
                              noise(vPosition.xz * 5.0) * 0.2 +
                              noise(vPosition.yz * 8.0) * 0.1;
              
              // Maria (dark patches)
              float maria = smoothstep(0.4, 0.6, noise(vPosition.xz * 1.5 + 10.0));
              moonBase = mix(moonBase, vec3(0.55, 0.52, 0.48), maria * 0.3);
              
              // Lighting
              float diffuse = max(dot(n, lightDir), 0.0) * 0.6 + 0.4;
              float rim = pow(1.0 - max(dot(n, vec3(0, 0, 1)), 0.0), 3.0);
              
              vec3 color = moonBase * (1.0 - craters * 0.2) * diffuse;
              color += vec3(0.15, 0.18, 0.25) * rim * 0.3; // Blue rim light
              
              gl_FragColor = vec4(color, 1.0);
            }
          `}
        />
      </mesh>
      {/* Inner glow — HDR for bloom catch */}
      <mesh>
        <sphereGeometry args={[3.7, 32, 32]} />
        <meshBasicMaterial color="#c0b8a0" transparent opacity={0.12} blending={THREE.AdditiveBlending} />
      </mesh>
      {/* Outer volumetric halo */}
      <mesh>
        <sphereGeometry args={[6, 32, 32]} />
        <shaderMaterial
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          vertexShader={`
            varying vec3 vNormal;
            void main() {
              vNormal = normalize(normalMatrix * normal);
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `}
          fragmentShader={`
            varying vec3 vNormal;
            void main() {
              float intensity = pow(0.6 - dot(vNormal, vec3(0, 0, 1.0)), 3.0);
              vec3 color = vec3(0.3, 0.35, 0.5) * intensity;
              gl_FragColor = vec4(color, intensity * 0.15);
            }
          `}
        />
      </mesh>
      {/* Wide atmospheric scatter */}
      <mesh>
        <sphereGeometry args={[12, 16, 16]} />
        <meshBasicMaterial color="#506080" transparent opacity={0.025} blending={THREE.AdditiveBlending} />
      </mesh>
      <pointLight color="#8899bb" intensity={0.3} distance={300} decay={1} />
    </group>
  );
}

// --- UE5-style procedural grass ground with PBR-like shading ---
function GrassGround() {
  const uniforms = useMemo(() => ({
    time: { value: 0 },
    moonDir: { value: new THREE.Vector3(0.5, 0.7, -0.5).normalize() },
    camPos: { value: new THREE.Vector3() },
  }), []);

  useFrame(({ clock, camera }) => {
    uniforms.time.value = clock.getElapsedTime();
    uniforms.camPos.value.copy(camera.position);
  });

  const grassVertexShader = `
    varying vec2 vUv;
    varying vec3 vWorldPos;
    varying vec3 vNormal;
    varying vec3 vViewDir;
    uniform vec3 camPos;
    void main() {
      vUv = uv;
      vNormal = normalize(normalMatrix * normal);
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vWorldPos = wp.xyz;
      vViewDir = normalize(camPos - wp.xyz);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const grassFragmentShader = `
    uniform float time;
    uniform vec3 moonDir;
    uniform vec3 camPos;
    varying vec2 vUv;
    varying vec3 vWorldPos;
    varying vec3 vNormal;
    varying vec3 vViewDir;

    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float noise(vec2 p) {
      vec2 i = floor(p); vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1,0)), f.x),
                 mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y);
    }
    float fbm(vec2 p) {
      float v = 0.0; float a = 0.5;
      for (int i = 0; i < 6; i++) { v += a * noise(p); p *= 2.1; a *= 0.48; }
      return v;
    }
    
    // Voronoi for clump patterns
    float voronoi(vec2 p) {
      vec2 n = floor(p);
      vec2 f = fract(p);
      float md = 8.0;
      for (int j = -1; j <= 1; j++) {
        for (int i = -1; i <= 1; i++) {
          vec2 g = vec2(float(i), float(j));
          vec2 o = vec2(hash(n + g), hash(n + g + 42.0));
          vec2 r = g + o - f;
          float d = dot(r, r);
          md = min(md, d);
        }
      }
      return sqrt(md);
    }

    void main() {
      vec2 worldUV = vWorldPos.xz;

      // Multi-scale grass variation with 6-octave fbm
      float large = fbm(worldUV * 0.015);
      float medium = fbm(worldUV * 0.06 + 50.0);
      float fine = fbm(worldUV * 0.3 + 100.0);
      float micro = noise(worldUV * 3.0);
      float ultra = noise(worldUV * 12.0);
      
      // Voronoi clumps for grass species variety
      float clumps = voronoi(worldUV * 0.08);

      // Rich grass palette — multiple species
      vec3 grassDarkA  = vec3(0.04, 0.10, 0.03);   // deep forest
      vec3 grassDarkB  = vec3(0.06, 0.13, 0.04);   // dark emerald
      vec3 grassMid    = vec3(0.08, 0.19, 0.05);   // healthy green
      vec3 grassLight  = vec3(0.12, 0.26, 0.07);   // bright green
      vec3 grassYellow = vec3(0.16, 0.20, 0.06);   // dry grass
      vec3 grassDry    = vec3(0.14, 0.15, 0.05);   // straw
      vec3 dirt        = vec3(0.08, 0.06, 0.03);   // exposed soil
      vec3 moss        = vec3(0.05, 0.10, 0.04);   // damp moss

      // Blend grass types using multi-scale noise
      vec3 color = mix(grassDarkA, grassDarkB, smoothstep(0.3, 0.7, large));
      color = mix(color, grassMid, smoothstep(0.4, 0.7, medium) * 0.6);
      color = mix(color, grassLight, smoothstep(0.55, 0.8, fine) * 0.4);
      
      // Species variation via voronoi
      color = mix(color, grassYellow, smoothstep(0.3, 0.5, clumps) * smoothstep(0.6, 0.8, large) * 0.35);
      color = mix(color, moss, smoothstep(0.7, 0.9, clumps) * smoothstep(0.3, 0.5, medium) * 0.25);
      
      // Dry patches
      float dryMask = smoothstep(0.68, 0.85, fbm(worldUV * 0.12 + 200.0));
      color = mix(color, grassDry, dryMask * 0.45);

      // Dirt patches (worn areas)
      float dirtMask = smoothstep(0.78, 0.88, fbm(worldUV * 0.1 + 300.0));
      color = mix(color, dirt, dirtMask * 0.5);

      // Fine grass blade texture
      float bladeAngle = noise(worldUV * 8.0 + time * 0.05);
      float blades = smoothstep(0.3, 0.7, micro) * 0.12;
      color += vec3(0.015, 0.03, 0.008) * blades * (0.8 + bladeAngle * 0.4);

      // Wind-driven color ripple (grass bending reveals lighter underside)
      float windWave1 = sin(worldUV.x * 0.4 + time * 0.6) * cos(worldUV.y * 0.3 + time * 0.45);
      float windWave2 = sin(worldUV.x * 1.2 + worldUV.y * 0.8 + time * 1.2) * 0.5;
      float windEffect = (windWave1 * 0.6 + windWave2 * 0.4);
      color += vec3(0.012, 0.025, 0.006) * windEffect * 0.4;

      // Moonlight diffuse — enhanced with subsurface approximation
      float NdotL = max(dot(vNormal, moonDir), 0.0);
      float subsurface = max(dot(-vNormal, moonDir), 0.0) * 0.08; // light through thin blades
      float ambient = 0.2;
      float lighting = NdotL * 0.55 + subsurface + ambient;
      color *= lighting;

      // Specular — wet grass sheen
      vec3 halfDir = normalize(moonDir + vViewDir);
      float spec = pow(max(dot(vNormal, halfDir), 0.0), 32.0);
      float wetness = smoothstep(0.5, 0.75, fine) * (1.0 - dryMask);
      color += vec3(0.04, 0.06, 0.10) * spec * wetness * 0.4;

      // Dew sparkles — individual bright points
      float dewNoise = noise(worldUV * 25.0);
      float dewSparkle = smoothstep(0.92, 0.95, dewNoise) * smoothstep(0.4, 0.7, fine);
      float dewTwinkle = sin(time * 2.0 + dewNoise * 100.0) * 0.3 + 0.7;
      color += vec3(0.08, 0.12, 0.18) * dewSparkle * dewTwinkle * NdotL;

      // Distance fog — atmospheric perspective (expanded world)
      float dist = length(worldUV) * 0.002;
      float fogFactor = smoothstep(0.0, 1.0, dist);
      vec3 fogColor = vec3(0.03, 0.04, 0.07);
      color = mix(color, fogColor, fogFactor * 0.6);

      // Distance darkening for vignette feel
      color *= 1.0 - fogFactor * 0.3;

      gl_FragColor = vec4(color, 1.0);
    }
  `;

  return (
    <>
      <mesh position={[0, -0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[1200, 1200, 4, 4]} />
        <shaderMaterial
          uniforms={uniforms}
          vertexShader={grassVertexShader}
          fragmentShader={grassFragmentShader}
        />
      </mesh>
      {/* Near-stage premium grass with mowing pattern */}
      <mesh position={[0, -0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[80, 64]} />
        <shaderMaterial
          uniforms={uniforms}
          vertexShader={grassVertexShader}
          fragmentShader={`
            uniform float time;
            uniform vec3 moonDir;
            uniform vec3 camPos;
            varying vec2 vUv;
            varying vec3 vWorldPos;
            varying vec3 vNormal;
            varying vec3 vViewDir;

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

              // Well-maintained turf
              vec3 grassA = vec3(0.06, 0.17, 0.04);
              vec3 grassB = vec3(0.10, 0.24, 0.06);
              vec3 color = mix(grassA, grassB, smoothstep(0.3, 0.7, large));
              color += vec3(0.01, 0.03, 0.005) * fine * 0.2;

              // Professional diamond mowing pattern
              float stripes = sin(worldUV.x * 1.5) * 0.5 + 0.5;
              float crossStripes = sin(worldUV.y * 1.5 + 0.785) * 0.5 + 0.5;
              float diamond = stripes * crossStripes;
              color = mix(color, color * 1.1, diamond * 0.12);

              // Subsurface + diffuse
              float NdotL = max(dot(vNormal, moonDir), 0.0);
              float ambient = 0.25;
              color *= (NdotL * 0.55 + ambient);

              // Subtle specular sheen
              vec3 halfDir = normalize(moonDir + vViewDir);
              float spec = pow(max(dot(vNormal, halfDir), 0.0), 24.0);
              color += vec3(0.03, 0.05, 0.08) * spec * 0.3;

              // Edge blend
              float edgeDist = length(vWorldPos.xz) / 80.0;
              float edgeFade = smoothstep(0.8, 1.0, edgeDist);
              color = mix(color, vec3(0.05, 0.12, 0.03), edgeFade);

              gl_FragColor = vec4(color, 1.0);
            }
          `}
          transparent={false}
        />
      </mesh>
    </>
  );
}

// --- Atmospheric dust particles floating in the air ---
function AtmosphericParticles() {
  const pointsRef = useRef<THREE.Points>(null);
  const count = 300;
  
  const { positions, sizes } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const sz = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 120;
      pos[i * 3 + 1] = Math.random() * 30 + 1;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 120;
      sz[i] = 0.02 + Math.random() * 0.06;
    }
    return { positions: pos, sizes: sz };
  }, []);

  useFrame(({ clock }) => {
    if (!pointsRef.current) return;
    const t = clock.getElapsedTime();
    const posAttr = pointsRef.current.geometry.getAttribute('position') as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;
    for (let i = 0; i < count; i++) {
      arr[i * 3] += Math.sin(t * 0.1 + i * 0.5) * 0.003;
      arr[i * 3 + 1] += Math.sin(t * 0.15 + i * 0.3) * 0.002;
      arr[i * 3 + 2] += Math.cos(t * 0.08 + i * 0.7) * 0.003;
    }
    posAttr.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.06}
        color="#8899bb"
        transparent
        opacity={0.15}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        sizeAttenuation
      />
    </points>
  );
}

// --- Ground fog layer ---
function GroundFog() {
  const fogRef = useRef<THREE.Mesh>(null);
  const uniforms = useMemo(() => ({
    time: { value: 0 },
  }), []);

  useFrame(({ clock }) => {
    uniforms.time.value = clock.getElapsedTime();
  });

  return (
    <mesh ref={fogRef} position={[0, 0.3, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[500, 500, 1, 1]} />
      <shaderMaterial
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        uniforms={uniforms}
        vertexShader={`
          varying vec2 vUv;
          varying vec3 vWorldPos;
          void main() {
            vUv = uv;
            vec4 wp = modelMatrix * vec4(position, 1.0);
            vWorldPos = wp.xyz;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          uniform float time;
          varying vec2 vUv;
          varying vec3 vWorldPos;
          
          float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
          float noise(vec2 p) {
            vec2 i = floor(p); vec2 f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            return mix(mix(hash(i), hash(i+vec2(1,0)), f.x),
                       mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y);
          }
          
          void main() {
            vec2 uv = vWorldPos.xz * 0.01;
            float n1 = noise(uv * 3.0 + time * 0.02);
            float n2 = noise(uv * 6.0 - time * 0.015);
            float fog = n1 * 0.6 + n2 * 0.4;
            
            // Fade at edges
            float dist = length(vWorldPos.xz) * 0.01;
            float edgeFade = 1.0 - smoothstep(0.5, 1.0, dist);
            
            float alpha = fog * 0.04 * edgeFade;
            gl_FragColor = vec4(0.15, 0.18, 0.25, alpha);
          }
        `}
      />
    </mesh>
  );
}

function StageGround() {
  return (
    <group>
      <GrassGround />
      <GroundFog />
      
      {/* Reflective wet surface — catches drone LED reflections */}
      <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[100, 64]} />
        <MeshReflectorMaterial
          mirror={0.35}
          blur={[300, 100]}
          resolution={512}
          mixBlur={0.8}
          mixStrength={0.6}
          roughness={0.85}
          depthScale={0.8}
          minDepthThreshold={0.4}
          maxDepthThreshold={1.2}
          color="#0a120a"
          metalness={0.15}
        />
      </mesh>

      {/* Operational grid — expanded */}
      <Grid
        position={[0, 0.01, 0]}
        args={[400, 400]}
        cellSize={5}
        cellThickness={0.3}
        cellColor="#2a4a2a"
        sectionSize={25}
        sectionThickness={0.8}
        sectionColor="#3a5a3a"
        fadeDistance={200}
        infiniteGrid
      />

      {/* Central firing area marker — scaled */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[40, 40.4, 64]} />
        <meshBasicMaterial color="#ff4444" transparent opacity={0.5} />
      </mesh>
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[80, 80.4, 64]} />
        <meshBasicMaterial color="#ffaa00" transparent opacity={0.3} />
      </mesh>

      {/* Scale reference poles — wider spread */}
      {[-40, -20, 0, 20, 40].map((x) => (
        <group key={`pole-${x}`} position={[x, 0, -35]}>
          <mesh position={[0, 5, 0]} castShadow>
            <cylinderGeometry args={[0.04, 0.05, 10, 8]} />
            <meshStandardMaterial color="#555555" metalness={0.7} roughness={0.25} />
          </mesh>
          {[2, 4, 6, 8, 10].map((h) => (
            <mesh key={h} position={[0, h, 0]}>
              <boxGeometry args={[0.15, 0.02, 0.15]} />
              <meshBasicMaterial color="#888888" transparent opacity={0.5} />
            </mesh>
          ))}
          <mesh position={[0, 10.15, 0]}>
            <sphereGeometry args={[0.08, 8, 8]} />
            <meshBasicMaterial color="#ff0000" />
          </mesh>
          <mesh position={[0, 0.05, 0]}>
            <cylinderGeometry args={[0.18, 0.22, 0.1, 8]} />
            <meshStandardMaterial color="#444444" metalness={0.6} roughness={0.3} />
          </mesh>
        </group>
      ))}

      {/* Horizon treeline */}
      <TreelineSilhouette />
    </group>
  );
}

// --- Layered tree silhouettes with depth ---
function TreelineSilhouette() {
  const trees = useMemo(() => {
    const result: { x: number; z: number; h: number; w: number; layer: number }[] = [];
    // 4 depth layers — expanded world
    for (let layer = 0; layer < 4; layer++) {
      const count = 80 - layer * 15;
      const baseDist = 150 + layer * 40;
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + layer * 0.05;
        const dist = baseDist + Math.random() * 20;
        result.push({
          x: Math.cos(angle) * dist,
          z: Math.sin(angle) * dist,
          h: 5 + Math.random() * 15 + layer * 3,
          w: 3 + Math.random() * 6,
          layer,
        });
      }
    }
    return result;
  }, []);

  return (
    <group>
      {trees.map((t, i) => {
        // Darker and more transparent for distant layers
        const brightness = 0.03 + t.layer * 0.015;
        const opacity = 0.9 - t.layer * 0.15;
        return (
          <mesh key={i} position={[t.x, t.h * 0.5, t.z]}
            rotation={[0, Math.atan2(t.x, t.z), 0]}>
            <planeGeometry args={[t.w, t.h]} />
            <meshBasicMaterial
              color={new THREE.Color(brightness, brightness + 0.02, brightness)}
              transparent
              opacity={opacity}
              side={THREE.DoubleSide}
            />
          </mesh>
        );
      })}
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
          {/* Status LED with glow */}
          <mesh position={[0.3, 0.08, 0.3]}>
            <sphereGeometry args={[0.025, 8, 8]} />
            <meshBasicMaterial color="#00ff44" toneMapped={false} />
          </mesh>
          <mesh position={[0.3, 0.08, 0.3]}>
            <sphereGeometry args={[0.06, 8, 8]} />
            <meshBasicMaterial color="#00ff44" transparent opacity={0.1} blending={THREE.AdditiveBlending} />
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
    <OrbitControls ref={controlsRef} enableDamping dampingFactor={0.05} maxPolarAngle={Math.PI * 0.48} minDistance={3} maxDistance={400} />
  );
}

export default function SkyCanvas() {
  const editorMode = useProjectStore((s) => s.editorMode);
  const droneFormations = useProjectStore((s) => s.droneFormations);
  const cursorStyle = editorMode !== 'select' ? 'crosshair' : 'default';
  const [activePreset, setActivePreset] = useState('free');
  const preset = CAMERA_PRESETS.find((p) => p.id === activePreset) || CAMERA_PRESETS[0];
  const perfStatsRef = useRef<PerfStats>({ fps: 0, drawCalls: 0, triangles: 0, geometries: 0, textures: 0 });
  const droneCount = droneFormations.length > 0 ? droneFormations[0].droneCount : 0;

  return (
    <div className="w-full h-full relative bg-[#030308]" data-sky-canvas style={{ cursor: cursorStyle }}>
      <WebGLErrorBoundary>
      <Canvas
        shadows
        gl={{
          antialias: false, // SMAA handles this in post
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.0,
          powerPreference: 'high-performance',
          alpha: false,
          stencil: false,
        }}
        dpr={[1, 1.5]}
      >
        <PerspectiveCamera makeDefault position={preset.position} fov={55} near={0.2} far={1200} />
        <CameraController targetPosition={[...preset.position]} targetLookAt={[...preset.target]} />

        {/* UE5-style cinematic lighting */}
        <ambientLight intensity={0.08} color="#607090" />
        
        {/* Moonlight — key light */}
        <directionalLight
          position={[60, 55, -80]}
          intensity={0.4}
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
        
        {/* Sky hemisphere — blue fill from above, warm from ground */}
        <hemisphereLight args={['#152040', '#0a1808', 0.1]} />
        
        {/* Rim backlight for atmospheric depth */}
        <directionalLight
          position={[-40, 20, 60]}
          intensity={0.08}
          color="#4466aa"
        />

        <SkyGradient />
        <Moon />
        <Stars radius={180} depth={80} count={4000} factor={3.5} saturation={0.15} fade speed={0.05} />
        <AtmosphericParticles />
        <fog attach="fog" args={['#080c16', 60, 220]} />

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
        <PerfCollector statsRef={perfStatsRef} />
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

      <PerformanceHUD statsRef={perfStatsRef} droneCount={droneCount} />

      <div className="absolute bottom-3 right-3 text-xs font-mono-code text-muted-foreground bg-surface-1/80 px-2 py-1 rounded-sm border border-border/50">
        Orbit: LMB · Pan: MMB · Zoom: Scroll
      </div>
    </div>
  );
}
