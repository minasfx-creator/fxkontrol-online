import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Stars, Grid, PerspectiveCamera } from '@react-three/drei';
import { useProjectStore, EFFECT_LIBRARY } from '@/store/useProjectStore';
import { useRef, useMemo, useEffect, useState, useCallback, Component, ErrorInfo, ReactNode } from 'react';
import { PerfCollector, PerformanceHUD, type PerfStats } from './PerformanceHUD';
import ViewportTerminal, { pushLog } from './ViewportTerminal';
import * as THREE from 'three';
import PositionPins from './PositionPins';
import PostProcessing from './PostProcessing';
import CameraAnimator, { CameraPathPreview } from './CameraAnimator';
import TrajectoryPaths from './TrajectoryPaths';
import DroneChoreography from './DroneChoreography';
import BoidsVisualizer from './BoidsVisualizer';
import QuadcopterModel from './QuadcopterModel';
import GeofenceVisual from './GeofenceVisual';
import { Camera, Eye, Video, Plane, Users, Maximize, Minimize, AlertTriangle, Globe, Download } from 'lucide-react';
import SelectionStatusBar from './SelectionStatusBar';
import { cn } from '@/lib/utils';
import { CometEffect, ShockwaveEffect, MultiBurstEffect, FanEffect, MineEffect, RomanCandleEffect, WaterfallEffect, GerbEffect, FlameEffect, CryoJetEffect, LaserEffect, CakeEffect, ConfettiEffect, MovingHeadEffect, PrefireShell } from './effects';
import { getLiftTime, getBreakHeight } from '@/lib/pyroPhysics';
import MiniMap from './MiniMap';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// SkyCanvas v2 — force chunk rebuild
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
  { id: 'satellite', label: 'Top', icon: Plane, position: [0, 250, 0.1] as [number, number, number], target: [0, 0, 0] as [number, number, number] },
  { id: 'audience', label: 'Plateia', icon: Users, position: [0, 4, 60] as [number, number, number], target: [0, 12, 0] as [number, number, number] },
  { id: 'front', label: 'Front', icon: Users, position: [0, 15, 80] as [number, number, number], target: [0, 15, 0] as [number, number, number] },
  { id: 'side', label: 'Side', icon: Video, position: [80, 15, 0] as [number, number, number], target: [0, 15, 0] as [number, number, number] },
  { id: 'back', label: 'Back', icon: Video, position: [0, 15, -80] as [number, number, number], target: [0, 15, 0] as [number, number, number] },
  { id: 'aerial', label: 'Aerial 45°', icon: Plane, position: [0, 120, 120] as [number, number, number], target: [0, 0, 0] as [number, number, number] },
  { id: 'closeup', label: 'Close-up', icon: Camera, position: [8, 8, 14] as [number, number, number], target: [0, 10, 0] as [number, number, number] },
  { id: 'cinematic', label: 'Cinema', icon: Video, position: [-25, 6, 50] as [number, number, number], target: [0, 15, 0] as [number, number, number] },
  { id: 'drone-follow', label: 'Drone POV', icon: Eye, position: [5, 25, 5] as [number, number, number], target: [0, 25, 0] as [number, number, number] },
  { id: 'vip', label: 'VIP Box', icon: Users, position: [30, 8, 45] as [number, number, number], target: [0, 12, 0] as [number, number, number] },
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
  const { timelineItems, currentTime, positions } = useProjectStore();
  const activeEffects = useMemo(() => {
    return timelineItems.map((item) => {
      const effect = EFFECT_LIBRARY.find((e) => e.id === item.effectId);
      if (!effect) return null;

      // ── Resolve position from linked pyropoint ──
      let resolvedPos = item.position;
      if (item.positionId) {
        const linkedPos = positions.find(p => p.id === item.positionId);
        if (linkedPos) resolvedPos = { x: linkedPos.x, y: linkedPos.y, z: linkedPos.z };
      }

      // ── Prefire-aware timing for shells ──
      // Shell effects have a prefire (lift) phase before the burst duration
      const caliber = effect.caliber || 4;
      const isShellType = effect.partType === 'shell' || effect.partType === 'single_shot' || effect.type === 'firework';
      const prefireDuration = isShellType ? (effect.prefire || getLiftTime(caliber)) : 0;
      const totalDuration = prefireDuration + effect.duration;

      if (currentTime < item.startTime || currentTime > item.startTime + totalDuration) return null;
      const elapsed = currentTime - item.startTime;

      // Are we in prefire (lift) phase or burst phase?
      const inPrefire = isShellType && elapsed < prefireDuration;
      const prefireProgress = prefireDuration > 0 ? Math.min(1, elapsed / prefireDuration) : 0;
      const burstProgress = prefireDuration > 0
        ? Math.max(0, (elapsed - prefireDuration) / effect.duration)
        : elapsed / effect.duration;

      return { item, effect, progress: burstProgress, inPrefire, prefireProgress, caliber, prefireDuration, resolvedPos };
    }).filter(Boolean) as {
      item: typeof timelineItems[0];
      effect: typeof EFFECT_LIBRARY[0];
      progress: number;
      inPrefire: boolean;
      prefireProgress: number;
      caliber: number;
      prefireDuration: number;
      resolvedPos: { x: number; y: number; z: number };
    }[];
  }, [timelineItems, currentTime, positions]);

  return (
    <>
      {activeEffects.map(({ item, effect, progress, inPrefire, prefireProgress, caliber, resolvedPos }) => {
        const pos: [number, number, number] = [resolvedPos.x, resolvedPos.y, resolvedPos.z];
        const eid = effect.id;
        const pt = effect.partType;

        // ── PREFIRE PHASE: show comet trail rising from mortar ──
        if (inPrefire) {
          return (
            <PrefireShell
              key={`prefire-${item.id}`}
              position={pos}
              color={effect.color}
              progress={prefireProgress}
              caliber={caliber}
            />
          );
        }

        // ── Specialized renderers by partType (Finale 3D logic) ──
        // For shells: position burst at break height
        const isShell = pt === 'shell' || pt === 'single_shot';
        const burstPos: [number, number, number] = isShell
          ? [pos[0], pos[1] + getBreakHeight(caliber), pos[2]]
          : pos;

        if (pt === 'mine') return <MineEffect key={item.id} position={pos} color={effect.color} progress={progress} />;
        if (pt === 'candle') return <RomanCandleEffect key={item.id} position={pos} color={effect.color} progress={progress} shotCount={effect.shotCount || 8} />;
        if (pt === 'waterfall') return <WaterfallEffect key={item.id} position={pos} color={effect.color} progress={progress} width={effect.heightMeters || 5} />;
        if (pt === 'gerb') return <GerbEffect key={item.id} position={pos} color={effect.color} progress={progress} height={effect.heightMeters || 4} />;
        if (pt === 'flame') return <FlameEffect key={item.id} position={pos} color={effect.color} progress={progress} height={effect.heightMeters || 8} />;
        if (pt === 'cake') return <CakeEffect key={item.id} position={pos} color={effect.color} progress={progress} shotCount={effect.shotCount || 25} />;
        if (pt === 'laser') return <LaserEffect key={item.id} position={pos} color={effect.color} progress={progress} pattern={effect.laserPattern || 'fan'} />;
        if (pt === 'light' && effect.beamType) return <MovingHeadEffect key={item.id} position={pos} color={effect.color} progress={progress} beamType={effect.beamType} />;

        // ── SFX special routing ──
        if (eid === 'sfx-01') return <CryoJetEffect key={item.id} position={pos} progress={progress} height={6} />;
        if (eid === 'sfx-02') return <CryoJetEffect key={item.id} position={pos} progress={progress} height={8} horizontal />;
        if (eid === 'sfx-06' || eid === 'sfx-07') return <ConfettiEffect key={item.id} position={pos} color={effect.color} progress={progress} />;

        // ── Legacy effect ID routing ──
        if (eid.startsWith('comet-')) return <CometEffect key={item.id} position={pos} color={effect.color} progress={progress} direction={eid === 'comet-02' ? 'down' : 'up'} />;
        if (eid.startsWith('shock-')) return <ShockwaveEffect key={item.id} position={burstPos} color={effect.color} progress={progress} />;
        if (eid.startsWith('mburst-')) return <MultiBurstEffect key={item.id} position={burstPos} color={effect.color} progress={progress} burstCount={eid === 'mburst-02' ? 5 : 3} />;
        if (eid.startsWith('fan-')) return <FanEffect key={item.id} position={pos} color={effect.color} progress={progress} spreadAngle={eid === 'fan-02' ? 180 : 90} />;

        // ── Default: firework burst at break height ──
        if (effect.type === 'firework') return <FireworkBurst key={item.id} position={burstPos} color={effect.color} progress={progress} />;
        return <LightPoint key={item.id} position={pos} color={effect.color} />;
      })}
    </>
  );
}

// ========================================================================
// GOOGLE EARTH-STYLE — Atmospheric sky with realistic horizon
// ========================================================================
function SkyGradient() {
  return (
    <mesh>
      <sphereGeometry args={[500, 64, 64]} />
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
          
          float hash21(vec2 p) {
            p = fract(p * vec2(123.34, 456.21));
            p += dot(p, p + 45.32);
            return fract(p.x * p.y);
          }
          
          float starField(vec3 dir) {
            vec2 uv = vec2(atan(dir.x, dir.z) * 3.183, asin(clamp(dir.y, -1.0, 1.0)) * 6.366);
            vec2 id = floor(uv * 140.0);
            float h = hash21(id);
            if (h > 0.982) {
              vec2 offset = fract(uv * 140.0) - 0.5;
              float brightness = smoothstep(0.1, 0.0, length(offset)) * (0.5 + h * 3.5);
              float twinkle = sin(h * 6283.0 + h * 200.0) * 0.3 + 0.7;
              return brightness * twinkle * smoothstep(0.08, 0.35, dir.y);
            }
            return 0.0;
          }
          
          void main() {
            vec3 dir = normalize(vWorldPosition);
            float h = dir.y;
            
            // Google Earth-style atmosphere: rich blue sky fading to warm horizon
            vec3 space     = vec3(0.005, 0.008, 0.025);
            vec3 zenith    = vec3(0.01, 0.015, 0.055);
            vec3 upperSky  = vec3(0.02, 0.035, 0.12);
            vec3 midSky    = vec3(0.04, 0.06, 0.18);
            vec3 lowSky    = vec3(0.06, 0.09, 0.22);
            vec3 horizon   = vec3(0.14, 0.16, 0.24);
            vec3 haze      = vec3(0.18, 0.17, 0.20);
            vec3 ground    = vec3(0.01, 0.015, 0.025);
            
            vec3 color;
            if (h > 0.7) {
              color = mix(upperSky, space, smoothstep(0.7, 1.0, h));
            } else if (h > 0.4) {
              color = mix(midSky, upperSky, smoothstep(0.4, 0.7, h));
            } else if (h > 0.15) {
              color = mix(lowSky, midSky, smoothstep(0.15, 0.4, h));
            } else if (h > 0.02) {
              color = mix(horizon, lowSky, smoothstep(0.02, 0.15, h));
            } else if (h > -0.02) {
              color = mix(haze, horizon, smoothstep(-0.02, 0.02, h));
            } else {
              color = mix(ground, haze, smoothstep(-0.15, -0.02, h));
            }
            
            // Atmospheric glow band — Google Earth warm horizon
            float horizonGlow = exp(-h * h * 80.0);
            color += vec3(0.18, 0.14, 0.08) * horizonGlow * 0.35;
            
            // Blue atmospheric scatter ring
            float blueRing = exp(-(h - 0.03) * (h - 0.03) * 60.0);
            color += vec3(0.04, 0.06, 0.12) * blueRing * 0.3;
            
            // Milky Way
            float milkyAngle = dir.x * 0.6 + dir.z * 0.8;
            float milkyBand = exp(-pow(milkyAngle - dir.y * 0.5, 2.0) * 8.0);
            float milkyDetail = hash21(dir.xz * 40.0) * 0.3 + 0.7;
            color += vec3(0.015, 0.02, 0.035) * milkyBand * milkyDetail * smoothstep(0.15, 0.5, h) * 0.5;
            
            // Stars
            float stars = starField(dir);
            vec3 starColor = mix(vec3(0.8, 0.85, 1.0), vec3(1.0, 0.9, 0.7), hash21(dir.xz * 50.0));
            color += starColor * stars * 0.7;
            
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

// --- Satellite texture ground overlay (real Google Maps imagery) ---
function SatelliteOverlay({ textureUrl }: { textureUrl: string | null }) {
  const texture = useMemo(() => {
    if (!textureUrl) return null;
    const loader = new THREE.TextureLoader();
    const tex = loader.load(textureUrl);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, [textureUrl]);

  if (!texture) return null;

  return (
    <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[300, 300]} />
      <meshBasicMaterial map={texture} transparent={false} />
    </mesh>
  );
}

// --- Google Earth-style satellite terrain ground ---
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

  const terrainVertexShader = `
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

  const terrainFragmentShader = `
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
    float voronoi(vec2 p) {
      vec2 n = floor(p); vec2 f = fract(p);
      float md = 8.0;
      for (int j = -1; j <= 1; j++) {
        for (int i = -1; i <= 1; i++) {
          vec2 g = vec2(float(i), float(j));
          vec2 o = vec2(hash(n + g), hash(n + g + 42.0));
          vec2 r = g + o - f;
          md = min(md, dot(r, r));
        }
      }
      return sqrt(md);
    }

    void main() {
      vec2 worldUV = vWorldPos.xz;
      
      // Multi-scale terrain
      float large = fbm(worldUV * 0.008);
      float medium = fbm(worldUV * 0.03 + 50.0);
      float fine = fbm(worldUV * 0.15 + 100.0);
      float micro = noise(worldUV * 1.5);
      float roads = voronoi(worldUV * 0.015);
      float parcels = voronoi(worldUV * 0.04);
      
      // Google Earth satellite palette
      vec3 darkForest  = vec3(0.04, 0.09, 0.03);
      vec3 forest      = vec3(0.06, 0.14, 0.04);
      vec3 farmGreen   = vec3(0.10, 0.20, 0.06);
      vec3 fieldGreen  = vec3(0.14, 0.25, 0.08);
      vec3 dryField    = vec3(0.18, 0.17, 0.08);
      vec3 brownEarth  = vec3(0.14, 0.10, 0.05);
      vec3 roadGrey    = vec3(0.12, 0.11, 0.10);
      vec3 urbanGrey   = vec3(0.10, 0.09, 0.08);
      
      // Base terrain blending — agricultural patchwork
      vec3 color = mix(darkForest, forest, smoothstep(0.3, 0.6, large));
      color = mix(color, farmGreen, smoothstep(0.4, 0.65, medium) * 0.7);
      color = mix(color, fieldGreen, smoothstep(0.5, 0.75, fine) * 0.5);
      
      // Agricultural parcels (rectangular patches)
      float parcelEdge = smoothstep(0.05, 0.08, parcels);
      vec3 parcelColor = mix(dryField, farmGreen, step(0.5, hash(floor(worldUV * 0.04))));
      parcelColor = mix(parcelColor, fieldGreen, step(0.7, hash(floor(worldUV * 0.04) + 10.0)));
      color = mix(brownEarth * 0.8, mix(color, parcelColor, 0.4), parcelEdge);
      
      // Roads — thin dark lines along Voronoi edges
      float roadMask = smoothstep(0.02, 0.04, roads);
      color = mix(roadGrey, color, roadMask);
      
      // Sparse built-up areas
      float urbanMask = smoothstep(0.7, 0.85, fbm(worldUV * 0.02 + 300.0));
      color = mix(color, urbanGrey, urbanMask * 0.3);
      
      // Wind ripples on vegetation
      float windWave = sin(worldUV.x * 0.3 + time * 0.4) * cos(worldUV.y * 0.2 + time * 0.3);
      color += vec3(0.008, 0.015, 0.004) * windWave * 0.3;

      // Moonlight lighting
      float NdotL = max(dot(vNormal, moonDir), 0.0);
      float subsurface = max(dot(-vNormal, moonDir), 0.0) * 0.06;
      float ambient = 0.22;
      color *= (NdotL * 0.5 + subsurface + ambient);

      // Specular — wet areas
      vec3 halfDir = normalize(moonDir + vViewDir);
      float spec = pow(max(dot(vNormal, halfDir), 0.0), 28.0);
      float wetness = smoothstep(0.6, 0.8, fine) * (1.0 - urbanMask);
      color += vec3(0.03, 0.05, 0.08) * spec * wetness * 0.3;

      // Distance atmosphere — Google Earth blue haze
      float dist = length(worldUV) * 0.0015;
      float fogFactor = smoothstep(0.0, 1.0, dist);
      vec3 atmosphereColor = vec3(0.08, 0.10, 0.18);
      color = mix(color, atmosphereColor, fogFactor * 0.7);
      color *= 1.0 - fogFactor * 0.25;

      gl_FragColor = vec4(color, 1.0);
    }
  `;

  // Near-field terrain (performance area) with detailed grass
  const nearFieldFragment = `
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

      vec3 grassA = vec3(0.06, 0.16, 0.04);
      vec3 grassB = vec3(0.10, 0.22, 0.06);
      vec3 color = mix(grassA, grassB, smoothstep(0.3, 0.7, large));
      color += vec3(0.01, 0.025, 0.005) * fine * 0.2;

      // Diamond mowing pattern
      float stripes = sin(worldUV.x * 1.5) * 0.5 + 0.5;
      float crossStripes = sin(worldUV.y * 1.5 + 0.785) * 0.5 + 0.5;
      color = mix(color, color * 1.1, stripes * crossStripes * 0.12);

      float NdotL = max(dot(vNormal, moonDir), 0.0);
      color *= (NdotL * 0.55 + 0.25);

      vec3 halfDir = normalize(moonDir + vViewDir);
      float spec = pow(max(dot(vNormal, halfDir), 0.0), 24.0);
      color += vec3(0.03, 0.05, 0.08) * spec * 0.3;

      float edgeDist = length(vWorldPos.xz) / 80.0;
      float edgeFade = smoothstep(0.8, 1.0, edgeDist);
      color = mix(color, vec3(0.05, 0.12, 0.03), edgeFade);

      gl_FragColor = vec4(color, 1.0);
    }
  `;

  return (
    <>
      {/* Far terrain — Google Earth satellite style */}
      <mesh position={[0, -0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[4000, 4000, 4, 4]} />
        <shaderMaterial
          uniforms={uniforms}
          vertexShader={terrainVertexShader}
          fragmentShader={terrainFragmentShader}
        />
      </mesh>
      {/* Near-stage grass with mowing pattern */}
      <mesh position={[0, -0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[120, 64]} />
        <shaderMaterial
          uniforms={uniforms}
          vertexShader={terrainVertexShader}
          fragmentShader={nearFieldFragment}
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
      pos[i * 3] = (Math.random() - 0.5) * 300;
      pos[i * 3 + 1] = Math.random() * 50 + 1;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 300;
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

function StageGround({ satelliteTexture }: { satelliteTexture: string | null }) {
  return (
    <group>
      <GrassGround />
      {satelliteTexture && <SatelliteOverlay textureUrl={satelliteTexture} />}
      <GroundFog />

      {/* Operational grid — subtle professional */}
      <Grid
        position={[0, 0.01, 0]}
        args={[1000, 1000]}
        cellSize={2}
        cellThickness={0.15}
        cellColor="#1a3a1a"
        sectionSize={10}
        sectionThickness={0.4}
        sectionColor="#2a4a2a"
        fadeDistance={350}
        infiniteGrid
      />
      {/* 50m major grid */}
      <Grid
        position={[0, 0.015, 0]}
        args={[1000, 1000]}
        cellSize={50}
        cellThickness={0.6}
        cellColor="#2a4a2a"
        sectionSize={100}
        sectionThickness={0.8}
        sectionColor="#3a5a3a"
        fadeDistance={600}
        infiniteGrid
      />

      {/* Subtle center cross — origin marker (no red squares) */}
      <mesh position={[0, 0.018, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.15, 6]} />
        <meshBasicMaterial color="#5a8a5a" transparent opacity={0.3} />
      </mesh>
      <mesh position={[0, 0.018, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[6, 0.15]} />
        <meshBasicMaterial color="#5a8a5a" transparent opacity={0.3} />
      </mesh>

      {/* Scale reference poles — wider spread */}
      {[-60, -30, 0, 30, 60].map((x) => (
        <group key={`pole-${x}`} position={[x, 0, -45]}>
          <mesh position={[0, 5, 0]} castShadow>
            <cylinderGeometry args={[0.04, 0.05, 10, 8]} />
            <meshStandardMaterial color="#555555" metalness={0.7} roughness={0.25} />
          </mesh>
          {[2, 4, 6, 8, 10].map((h) => (
            <mesh key={h} position={[0, h, 0]}>
              <boxGeometry args={[0.15, 0.02, 0.15]} />
              <meshBasicMaterial color="#888888" transparent opacity={0.4} />
            </mesh>
          ))}
          <mesh position={[0, 10.15, 0]}>
            <sphereGeometry args={[0.06, 8, 8]} />
            <meshBasicMaterial color="#ffffff" />
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
    // 5 depth layers — Google Earth-scale world
    for (let layer = 0; layer < 5; layer++) {
      const count = 100 - layer * 15;
      const baseDist = 200 + layer * 80;
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + layer * 0.05;
        const dist = baseDist + Math.random() * 40;
        result.push({
          x: Math.cos(angle) * dist,
          z: Math.sin(angle) * dist,
          h: 5 + Math.random() * 18 + layer * 4,
          w: 4 + Math.random() * 8,
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
  // Realistic mortar rack layout — multiple calibers
  const racks = useMemo(() => {
    const r: { pos: [number, number, number]; caliber: number; tubes: number; label: string }[] = [];
    // 3" rack — left section
    for (let i = 0; i < 6; i++) r.push({ pos: [-18 + i * 1.2, 0, -2], caliber: 3, tubes: 6, label: `R${i + 1}` });
    // 4" rack — center-left
    for (let i = 0; i < 5; i++) r.push({ pos: [-6 + i * 1.5, 0, 0], caliber: 4, tubes: 4, label: `M${i + 1}` });
    // 5" rack — center
    for (let i = 0; i < 3; i++) r.push({ pos: [2 + i * 2, 0, 2], caliber: 5, tubes: 3, label: `L${i + 1}` });
    // 6" singles — right
    for (let i = 0; i < 3; i++) r.push({ pos: [10 + i * 2.5, 0, 0], caliber: 6, tubes: 1, label: `S${i + 1}` });
    // 8" singles — far right
    r.push({ pos: [18, 0, 1], caliber: 8, tubes: 1, label: 'H1' });
    r.push({ pos: [21, 0, 1], caliber: 8, tubes: 1, label: 'H2' });
    return r;
  }, []);

  return (
    <>
      {racks.map((rack, ri) => {
        const tubeRadius = rack.caliber * 0.0254 / 2; // inches to meters
        const tubeHeight = rack.caliber * 0.08 + 0.3;
        const rackWidth = (rack.tubes - 1) * (tubeRadius * 2.5 + 0.02);
        return (
          <group key={ri} position={rack.pos}>
            {/* Rack base plate */}
            <mesh position={[0, 0.02, 0]} receiveShadow>
              <boxGeometry args={[rackWidth + 0.3, 0.04, tubeRadius * 4 + 0.2]} />
              <meshStandardMaterial color="#3a3a3a" metalness={0.7} roughness={0.3} />
            </mesh>
            {/* Mortar tubes */}
            {Array.from({ length: rack.tubes }).map((_, ti) => {
              const tx = (ti - (rack.tubes - 1) / 2) * (tubeRadius * 2.5 + 0.02);
              return (
                <group key={ti} position={[tx, 0, 0]}>
                  {/* Outer tube (HDPE) */}
                  <mesh position={[0, tubeHeight / 2 + 0.04, 0]} castShadow>
                    <cylinderGeometry args={[tubeRadius + 0.01, tubeRadius + 0.015, tubeHeight, 12]} />
                    <meshStandardMaterial color="#2a2a2a" metalness={0.4} roughness={0.6} />
                  </mesh>
                  {/* Inner bore (darker) */}
                  <mesh position={[0, tubeHeight + 0.04, 0]}>
                    <cylinderGeometry args={[tubeRadius * 0.85, tubeRadius * 0.85, 0.02, 12]} />
                    <meshBasicMaterial color="#111111" />
                  </mesh>
                  {/* Fuse wire */}
                  <mesh position={[tubeRadius + 0.015, tubeHeight * 0.3, 0]} castShadow>
                    <cylinderGeometry args={[0.003, 0.003, tubeHeight * 0.7, 4]} />
                    <meshStandardMaterial color="#cc6600" roughness={0.8} />
                  </mesh>
                </group>
              );
            })}
            {/* Safety perimeter ring */}
            <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[rackWidth * 0.8 + 0.5, rackWidth * 0.8 + 0.55, 24]} />
              <meshBasicMaterial color="#cc3030" transparent opacity={0.2} />
            </mesh>
            {/* E-match connector box */}
            <mesh position={[rackWidth / 2 + 0.2, 0.08, 0]} castShadow>
              <boxGeometry args={[0.08, 0.06, 0.05]} />
              <meshStandardMaterial color="#444444" metalness={0.6} roughness={0.4} />
            </mesh>
            {/* Status LED */}
            <mesh position={[rackWidth / 2 + 0.2, 0.12, 0]}>
              <sphereGeometry args={[0.015, 6, 6]} />
              <meshBasicMaterial color="#00ff44" toneMapped={false} />
            </mesh>
            <mesh position={[rackWidth / 2 + 0.2, 0.12, 0]}>
              <sphereGeometry args={[0.04, 6, 6]} />
              <meshBasicMaterial color="#00ff44" transparent opacity={0.08} blending={THREE.AdditiveBlending} />
            </mesh>
          </group>
        );
      })}
      {/* Firing control cable run */}
      <mesh position={[0, 0.005, -4]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[45, 0.03]} />
        <meshBasicMaterial color="#444444" />
      </mesh>
      {/* Control station */}
      <group position={[0, 0, -8]}>
        <mesh position={[0, 0.25, 0]} castShadow>
          <boxGeometry args={[1.2, 0.5, 0.8]} />
          <meshStandardMaterial color="#333333" metalness={0.5} roughness={0.4} />
        </mesh>
        <mesh position={[0, 0.52, -0.1]}>
          <boxGeometry args={[0.6, 0.02, 0.4]} />
          <meshBasicMaterial color="#112233" />
        </mesh>
        {/* Screen glow */}
        <mesh position={[0, 0.55, -0.1]}>
          <planeGeometry args={[0.5, 0.25]} />
          <meshBasicMaterial color="#1a3a5a" transparent opacity={0.4} blending={THREE.AdditiveBlending} />
        </mesh>
      </group>
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
    // Smooth cinematic interpolation
    camera.position.lerp(targetPos.current, 0.04);
    controlsRef.current.target.lerp(targetLook.current, 0.04);
    controlsRef.current.update();
    if (camera.position.distanceTo(targetPos.current) < 0.05) animating.current = false;
  });

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={0.6}
      panSpeed={0.8}
      zoomSpeed={1.2}
      maxPolarAngle={Math.PI * 0.48}
      minDistance={2}
      maxDistance={1200}
      enablePan
    />
  );
}

export default function SkyCanvas() {
  const editorMode = useProjectStore((s) => s.editorMode);
  const droneFormations = useProjectStore((s) => s.droneFormations);
  const gpsOrigin = useProjectStore((s) => s.gpsOrigin);
  const cursorStyle = editorMode !== 'select' ? 'crosshair' : 'default';
  const [activePreset, setActivePreset] = useState('free');
  const preset = CAMERA_PRESETS.find((p) => p.id === activePreset) || CAMERA_PRESETS[0];
  const perfStatsRef = useRef<PerfStats>({ fps: 0, drawCalls: 0, triangles: 0, geometries: 0, textures: 0 });
  const droneCount = droneFormations.length > 0 ? droneFormations[0].droneCount : 0;
  const [satelliteTexture, setSatelliteTexture] = useState<string | null>(null);
  const [downloadingScenery, setDownloadingScenery] = useState(false);

  const handleDownloadScenery = useCallback(async () => {
    setDownloadingScenery(true);
    pushLog('Downloading satellite imagery...', 'info');
    try {
      // Get the API key from the edge function
      const { data: keyData, error: keyError } = await supabase.functions.invoke('get-maps-key');
      const apiKey = keyData?.key;
      if (keyError || !apiKey) {
        pushLog('Failed to get Google Maps API key', 'error');
        toast.error('Falha ao obter chave do Google Maps');
        return;
      }

      // Fetch satellite tile directly from client (avoids server-side 403 restrictions)
      const url = `https://maps.googleapis.com/maps/api/staticmap?center=${gpsOrigin.lat},${gpsOrigin.lng}&zoom=18&size=640x640&maptype=satellite&key=${apiKey}`;
      const res = await fetch(url);
      if (!res.ok) {
        pushLog(`Google Static Maps error: ${res.status}`, 'error');
        toast.error(`Erro Google Maps: ${res.status}. Verifique se a Maps Static API está habilitada.`);
        return;
      }

      const blob = await res.blob();
      const imageUrl = URL.createObjectURL(blob);
      setSatelliteTexture(imageUrl);
      pushLog(`Satellite scenery loaded: ${gpsOrigin.lat.toFixed(4)}°, ${gpsOrigin.lng.toFixed(4)}°`, 'success');
      toast.success('Cenário satélite carregado!');
    } catch (err) {
      pushLog('Satellite download error', 'error');
      toast.error('Erro ao baixar cenário');
    } finally {
      setDownloadingScenery(false);
    }
  }, [gpsOrigin.lat, gpsOrigin.lng]);

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
        <PerspectiveCamera makeDefault position={preset.position} fov={55} near={0.2} far={2500} />
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
          shadow-camera-far={400}
          shadow-camera-left={-100}
          shadow-camera-right={100}
          shadow-camera-top={100}
          shadow-camera-bottom={-100}
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
        <Stars radius={450} depth={200} count={8000} factor={4.5} saturation={0.15} fade speed={0.04} />
        <AtmosphericParticles />
        <fog attach="fog" args={['#0a1020', 300, 1500]} />

        <StageGround satelliteTexture={satelliteTexture} />
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
        {/* Download satellite scenery */}
        <button
          onClick={handleDownloadScenery}
          disabled={downloadingScenery}
          className={cn(
            "flex items-center gap-1 px-2 py-1 rounded-sm text-[10px] font-mono-code transition-all border",
            satelliteTexture
              ? "bg-success/20 text-success border-success/40"
              : "bg-surface-1/80 text-muted-foreground border-border/50 hover:text-foreground hover:bg-surface-2/80"
          )}
          title="Download real satellite scenery from Google Maps"
        >
          {downloadingScenery ? (
            <div className="w-3 h-3 border border-primary border-t-transparent rounded-full animate-spin" />
          ) : (
            <Globe className="w-3 h-3" />
          )}
          <span className="hidden sm:inline">{satelliteTexture ? 'Satélite ✓' : 'Cenário Real'}</span>
        </button>
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
      <ViewportTerminal />
      <MiniMap />
      <SelectionStatusBar />

      <div className="absolute bottom-3 right-3 text-xs font-mono-code text-muted-foreground bg-surface-1/80 px-2 py-1 rounded-sm border border-border/50 space-y-0.5">
        <div>Orbit: LMB · Pan: MMB · Zoom: Scroll</div>
        <div className="text-[9px]">Grid: 2m · Snap: 10m · Scale poles: 10m</div>
      </div>
    </div>
  );
}
