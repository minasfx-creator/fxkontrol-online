import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Stars, Grid, PerspectiveCamera } from '@react-three/drei';
import { useProjectStore, EFFECT_LIBRARY } from '@/store/useProjectStore';
import { useSceneStore } from '@/store/useSceneStore';
import { useRef, useMemo, useEffect, useState, useCallback, Component, ErrorInfo, ReactNode } from 'react';
import { PerfCollector, PerformanceHUD, type PerfStats } from './PerformanceHUD';
import ViewportTerminal, { pushLog } from './ViewportTerminal';
import * as THREE from 'three';
import PositionPins from './PositionPins';
import PyroLaunchAngles from './PyroLaunchAngle';
import PostProcessing from './PostProcessing';
import { BoxSelectR3F } from './BoxSelectOverlay';
import AlignmentTools from './AlignmentTools';
import CameraAnimator, { CameraPathPreview } from './CameraAnimator';
import TrajectoryPaths from './TrajectoryPaths';
import DroneChoreography from './DroneChoreography';
import Rack3DView from './Rack3DView';
import BoidsVisualizer from './BoidsVisualizer';
import CollisionAvoidanceOverlay from './CollisionAvoidanceOverlay';
import AudioSpectrumVisualizer from './AudioSpectrumVisualizer';
import { DEFAULT_AVOIDANCE } from '@/lib/collisionAvoidance';
import QuadcopterModel from './QuadcopterModel';
import GeofenceVisual from './GeofenceVisual';
import { Camera, Eye, Video, Plane, Users, Maximize, Minimize, AlertTriangle, Globe, Download, ScanEye, Cog, Paintbrush, MapPinned, Film } from 'lucide-react';
import SelectionStatusBar from './SelectionStatusBar';
import { cn } from '@/lib/utils';
import {
  CometEffect,
  ShockwaveEffect,
  MultiBurstEffect,
  FanEffect,
  MineEffect,
  RomanCandleEffect,
  WaterfallEffect,
  GerbEffect,
  FlameEffect,
  CryoJetEffect,
  LaserEffect,
  CakeEffect,
  ConfettiEffect,
  MovingHeadEffect,
  PrefireShell,
  SmokeTrail,
  EmberParticles,
  SparkShower,
  FogMachineEffect,
  HazeMachineEffect,
  SnowMachineEffect,
  BubbleMachineEffect,
} from './effects';
import { getLiftTime, getBreakHeight, getBreakSpeed } from '@/lib/pyroPhysics';
import { parseVDL, vdlToEffect } from '@/lib/vdlParser';
import { temporalFlicker } from '@/lib/pyroNoise';
// MiniMap removed per user request
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useLiveSfxStore } from '@/store/useLiveSfxStore';

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

// Camera presets calibrated for real-world firework heights (55m-300m break heights)
// Audience distance: typically 100-300m from launch site (NFPA 1123)
const CAMERA_PRESETS = [
  { id: 'free', label: 'Free', icon: Eye, position: [0, 15, 200] as [number, number, number], target: [0, 80, 0] as [number, number, number] },
  { id: 'satellite', label: 'Top', icon: Plane, position: [0, 500, 0.1] as [number, number, number], target: [0, 0, 0] as [number, number, number] },
  { id: 'audience', label: 'Plateia', icon: Users, position: [0, 2, 250] as [number, number, number], target: [0, 80, 0] as [number, number, number] },
  { id: 'front', label: 'Front', icon: Users, position: [0, 5, 300] as [number, number, number], target: [0, 100, 0] as [number, number, number] },
  { id: 'side', label: 'Side', icon: Video, position: [300, 30, 0] as [number, number, number], target: [0, 80, 0] as [number, number, number] },
  { id: 'back', label: 'Back', icon: Video, position: [0, 30, -200] as [number, number, number], target: [0, 80, 0] as [number, number, number] },
  { id: 'aerial', label: 'Aerial 45°', icon: Plane, position: [0, 300, 300] as [number, number, number], target: [0, 50, 0] as [number, number, number] },
  { id: 'closeup', label: 'Close-up', icon: Camera, position: [20, 30, 80] as [number, number, number], target: [0, 80, 0] as [number, number, number] },
  { id: 'cinematic', label: 'Cinema', icon: Video, position: [-80, 8, 220] as [number, number, number], target: [0, 100, 0] as [number, number, number] },
  { id: 'drone-follow', label: 'Drone POV', icon: Eye, position: [15, 120, 40] as [number, number, number], target: [0, 100, 0] as [number, number, number] },
  { id: 'vip', label: 'VIP Box', icon: Users, position: [60, 5, 200] as [number, number, number], target: [0, 80, 0] as [number, number, number] },
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
const GRAVITY = -9.81; // Real-world gravity for accurate ballistics

function getWindForce(): [number, number, number] {
  const { wind } = useProjectStore.getState();
  if (!wind.enabled) return [0, 0, 0];
  const rad = (wind.direction * Math.PI) / 180;
  const gust = 1 + (Math.sin(performance.now() * 0.001) * 0.5 + 0.5) * wind.gustStrength;
  const s = wind.speed * gust * 0.15;
  return [Math.sin(rad) * s, 0, Math.cos(rad) * s];
}

// ═══════════════════════════════════════════════════════════════════════
// Finale 3D-grade star sprite vertex/fragment shaders
// Renders each star as a soft gaussian glow disc with HDR bloom trigger,
// exactly matching Finale's GPU particle rendering pipeline.
// ═══════════════════════════════════════════════════════════════════════
const STAR_VERTEX_SHADER = `
  attribute float aSize;
  attribute float aLife;
  varying vec3 vColor;
  varying float vLife;
  varying float vSize;
  void main() {
    vColor = color;
    vLife = aLife;
    vSize = aSize;
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    // Increased multiplier for real-world scale (stars at 50-300m distance from camera)
    gl_PointSize = aSize * (1800.0 / -mvPos.z);
    gl_PointSize = clamp(gl_PointSize, 1.5, 200.0);
    gl_Position = projectionMatrix * mvPos;
  }
`;

const STAR_FRAGMENT_SHADER = `
  varying vec3 vColor;
  varying float vLife;
  varying float vSize;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float dist = length(uv);
    
    // Multi-layer glow architecture for maximum HDR bloom catch
    float core = smoothstep(0.06, 0.0, dist);   // ultra-bright white-hot center
    float inner = exp(-dist * dist * 28.0);       // tight inner glow
    float glow = exp(-dist * dist * 10.0);        // medium gaussian halo
    float bloom = exp(-dist * dist * 3.0);        // wide soft bloom trigger
    float scatter = exp(-dist * dist * 1.2);      // ultra-wide atmospheric scatter
    
    float alpha = core * 2.0 + inner * 1.0 + glow * 0.6 + bloom * 0.2 + scatter * 0.05;
    
    // HDR color pipeline — core pushes well above 1.0 for bloom
    vec3 whiteHot = vec3(1.6, 1.5, 1.2);
    vec3 col = vColor * (inner * 1.8 + glow * 1.2) + whiteHot * core * 3.5;
    col += vColor * bloom * 0.5;
    col += vColor * scatter * 0.15;
    
    // Extra HDR boost for young stars (low life = just born)
    float youth = max(0.0, 1.0 - vLife * 3.0);
    col += whiteHot * youth * 2.0;
    
    gl_FragColor = vec4(col, alpha * (1.0 - smoothstep(0.46, 0.5, dist)));
  }
`;

// ═══════════════════════════════════════════════════════════════════════
// Finale-grade FireworkBurst with:
// - Custom star sprite shader (gaussian glow discs)
// - Euler integration with quadratic drag (not simplified formula)
// - HDR color pipeline: white-hot → saturated → ember → charcoal
// - Falling charcoal debris after star burnout
// - Persistent smoke volume at burst location
// - Caliber-proportional everything
// ═══════════════════════════════════════════════════════════════════════
function FireworkBurst({ 
  position, color, progress, caliber = 4, pattern = 'peony' 
}: { 
  position: [number, number, number]; color: string; progress: number; 
  caliber?: number; pattern?: string;
}) {
  const pointsRef = useRef<THREE.Points>(null);
  const trailRef = useRef<THREE.LineSegments>(null);
  const debrisRef = useRef<THREE.Points>(null);
  
  // Finale caliber scaling: star count proportional to shell volume
  const STAR_COUNT = useMemo(() => Math.min(2500, Math.round(120 + caliber * caliber * 28)), [caliber]);
  const TRAIL_LENGTH = useMemo(() => Math.min(28, 14 + Math.floor(caliber * 1.8)), [caliber]);
  const DEBRIS_COUNT = useMemo(() => Math.min(600, Math.round(STAR_COUNT * 0.4)), [STAR_COUNT]);
  
  // Real break speed from pyroPhysics — caliber proportional (m/s)
  const breakSpeed = useMemo(() => getBreakSpeed(caliber), [caliber]);
  
  // Star lifetime per Finale — depends on pattern and caliber
  const starLife = useMemo(() => {
    const base = 1.0 + caliber * 0.38;
    if (pattern === 'willow' || pattern === 'kamuro') return base * 3.0;
    if (pattern === 'palm' || pattern === 'brocade') return base * 2.0;
    if (pattern === 'chrysanthemum') return base * 1.4;
    if (pattern === 'dahlia') return base * 0.55;
    return base;
  }, [caliber, pattern]);
  
  const baseColor = useMemo(() => new THREE.Color(color), [color]);
  const emberColor = useMemo(() => {
    const c = new THREE.Color(color);
    return new THREE.Color().setHSL(
      Math.min(c.getHSL({ h: 0, s: 0, l: 0 }).h, 0.06),
      0.85,
      0.12
    );
  }, [color]);
  
  const { velocities, lifetimes, twinklePhases, debrisVelocities, sparkleSeeds, debrisSparkleSeeds } = useMemo(() => {
    const v = new Float32Array(STAR_COUNT * 3);
    const l = new Float32Array(STAR_COUNT);
    const tp = new Float32Array(STAR_COUNT);
    const sparkle = new Float32Array(STAR_COUNT);
    const dv = new Float32Array(DEBRIS_COUNT * 3);
    const debrisSparkle = new Float32Array(DEBRIS_COUNT);

    for (let i = 0; i < STAR_COUNT; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      let vx: number, vy: number, vz: number;
      let life = starLife * (0.6 + Math.random() * 0.4);
      const speedVar = 0.55 + Math.random() * 0.45;
      tp[i] = Math.random() * Math.PI * 2;
      sparkle[i] = Math.random() * 999 + i;

      switch (pattern) {
        case 'willow':
          vx = Math.sin(phi) * Math.cos(theta) * breakSpeed * 0.42 * speedVar;
          vy = Math.sin(phi) * Math.sin(theta) * breakSpeed * 0.42 * speedVar;
          vz = Math.cos(phi) * breakSpeed * 0.42 * speedVar;
          life = starLife * (1.3 + Math.random() * 1.4);
          break;
        case 'palm':
          vx = Math.sin(phi) * Math.cos(theta) * breakSpeed * 0.52 * speedVar;
          vy = Math.abs(Math.sin(phi) * Math.sin(theta)) * breakSpeed * 0.85 + breakSpeed * 0.45;
          vz = Math.cos(phi) * breakSpeed * 0.52 * speedVar;
          life = starLife * (1.1 + Math.random() * 0.6);
          break;
        case 'chrysanthemum':
          vx = Math.sin(phi) * Math.cos(theta) * breakSpeed * speedVar;
          vy = Math.sin(phi) * Math.sin(theta) * breakSpeed * 0.93 * speedVar;
          vz = Math.cos(phi) * breakSpeed * speedVar;
          life = starLife * (0.85 + Math.random() * 0.3);
          break;
        case 'kamuro':
          vx = Math.sin(phi) * Math.cos(theta) * breakSpeed * 0.35 * speedVar;
          vy = Math.sin(phi) * Math.sin(theta) * breakSpeed * 0.35 * speedVar + 1.2;
          vz = Math.cos(phi) * breakSpeed * 0.35 * speedVar;
          life = starLife * (1.8 + Math.random() * 1.8);
          break;
        case 'ring':
          vx = Math.cos(theta) * breakSpeed * speedVar;
          vy = (Math.random() - 0.5) * breakSpeed * 0.08;
          vz = Math.sin(theta) * breakSpeed * speedVar;
          break;
        case 'dahlia':
          vx = Math.sin(phi) * Math.cos(theta) * breakSpeed * 1.25 * speedVar;
          vy = Math.sin(phi) * Math.sin(theta) * breakSpeed * 1.18 * speedVar;
          vz = Math.cos(phi) * breakSpeed * 1.25 * speedVar;
          life = starLife * (0.35 + Math.random() * 0.25);
          break;
        case 'brocade':
          vx = Math.sin(phi) * Math.cos(theta) * breakSpeed * 0.58 * speedVar;
          vy = Math.sin(phi) * Math.sin(theta) * breakSpeed * 0.58 * speedVar;
          vz = Math.cos(phi) * breakSpeed * 0.58 * speedVar;
          life = starLife * (1.3 + Math.random() * 1.0);
          break;
        case 'crossette': {
          const arm = i % 6;
          const armTheta = (arm / 6) * Math.PI * 2;
          const armPhi = Math.PI * 0.45;
          const jitter = 0.12;
          vx = Math.sin(armPhi) * Math.cos(armTheta + (Math.random() - 0.5) * jitter) * breakSpeed * 0.82;
          vy = Math.sin(armPhi) * Math.sin(armTheta + (Math.random() - 0.5) * jitter) * breakSpeed * 0.82;
          vz = Math.cos(armPhi + (Math.random() - 0.5) * jitter) * breakSpeed * 0.82;
          break;
        }
        default:
          vx = Math.sin(phi) * Math.cos(theta) * breakSpeed * speedVar;
          vy = Math.sin(phi) * Math.sin(theta) * breakSpeed * speedVar * 0.9 + 0.6;
          vz = Math.cos(phi) * breakSpeed * speedVar;
          break;
      }

      v[i * 3] = vx;
      v[i * 3 + 1] = vy;
      v[i * 3 + 2] = vz;
      l[i] = life;
    }

    for (let i = 0; i < DEBRIS_COUNT; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const spd = breakSpeed * (0.15 + Math.random() * 0.35);
      dv[i * 3] = Math.sin(phi) * Math.cos(theta) * spd;
      dv[i * 3 + 1] = Math.sin(phi) * Math.sin(theta) * spd * 0.5 - 1;
      dv[i * 3 + 2] = Math.cos(phi) * spd;
      debrisSparkle[i] = Math.random() * 999 + i * 7;
    }

    return {
      velocities: v,
      lifetimes: l,
      twinklePhases: tp,
      debrisVelocities: dv,
      sparkleSeeds: sparkle,
      debrisSparkleSeeds: debrisSparkle,
    };
  }, [STAR_COUNT, DEBRIS_COUNT, breakSpeed, starLife, pattern]);

  // Pre-allocate typed arrays for per-frame updates
  const positionsRef = useRef(new Float32Array(STAR_COUNT * 3));
  const colorsRef = useRef(new Float32Array(STAR_COUNT * 3));
  const sizesRef = useRef(new Float32Array(STAR_COUNT));
  const livesRef = useRef(new Float32Array(STAR_COUNT));
  const trailVertCount = STAR_COUNT * TRAIL_LENGTH * 2;
  const trailPosRef = useRef(new Float32Array(trailVertCount * 3));
  const trailColRef = useRef(new Float32Array(trailVertCount * 3));
  const debrisPosRef = useRef(new Float32Array(DEBRIS_COUNT * 3));
  const debrisColRef = useRef(new Float32Array(DEBRIS_COUNT * 3));

  // Custom shader material for star sprites
  const starMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: STAR_VERTEX_SHADER,
      fragmentShader: STAR_FRAGMENT_SHADER,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  }, []);

  useFrame(({ clock }) => {
    if (!pointsRef.current || !trailRef.current) return;
    const pos = positionsRef.current;
    const cols = colorsRef.current;
    const sizes = sizesRef.current;
    const lives = livesRef.current;
    const tPos = trailPosRef.current;
    const tCol = trailColRef.current;
    const t = progress * (starLife * 0.88);
    const trailDt = 0.035;
    const w = getWindForce();
    const time = clock.getElapsedTime();
    
    // Finale drag model: exponential decay, heavier for denser patterns
    const dragCoeff = 0.04 + caliber * 0.005;
    const isTrailingPattern = pattern === 'willow' || pattern === 'kamuro' || pattern === 'brocade' || pattern === 'palm';
    
    // Particle size: proportional to caliber — much larger for real-world scale visibility
    const baseSize = 0.5 + caliber * 0.35;
    
    // Helper: proper analytical position for exponential drag
    // With drag a = -k*v, velocity v(t) = v0 * e^(-k*t)
    // Position x(t) = v0 * (1 - e^(-k*t)) / k
    const dragPos = (v0: number, t: number, k: number) => {
      if (k < 0.001) return v0 * t;
      return v0 * (1 - Math.exp(-k * t)) / k;
    };

    for (let i = 0; i < STAR_COUNT; i++) {
      const vx = velocities[i * 3], vy = velocities[i * 3 + 1], vz = velocities[i * 3 + 2];
      const lt = lifetimes[i];
      // Age each star individually: star dies when t >= lt
      const starAge = Math.min(1, t / lt);
      const fade = Math.max(0, 1 - starAge);
      const fadeSquared = fade * fade;
      const fadeCubed = fadeSquared * fade;
      // Proper analytical integration with exponential drag + real gravity + wind
      const px = dragPos(vx, t, dragCoeff) + w[0] * t * t * 0.3;
      const py = dragPos(vy, t, dragCoeff) + 0.5 * GRAVITY * t * t;
      const pz = dragPos(vz, t, dragCoeff) + w[2] * t * t * 0.3;
      pos[i * 3] = px; pos[i * 3 + 1] = py; pos[i * 3 + 2] = pz;

      // === Finale HDR Color Pipeline ===
      // Phase 1: White-hot flash (0-3% progress) — Finale's "Contrast 1.5" effect
      const flashIntensity = Math.max(0, 1 - progress * 33);
      // Phase 2: Full saturated color (3-45%)
      // Phase 3: Ember→charcoal (45-100%)
      const emberPhase = Math.max(0, (progress - 0.4) / 0.6);
      
      // Per-star stochastic twinkle — Finale's signature shimmer
      let twinkle: number;
      if (isTrailingPattern) {
        twinkle = 0.75 + Math.sin(twinklePhases[i] + progress * 12) * 0.25;
      } else {
        twinkle = temporalFlicker(sparkleSeeds[i], time, 0.62, 0.34, 0.38);
      }
      
      // White-hot → saturated color
      let r = THREE.MathUtils.lerp(baseColor.r, 1.4, flashIntensity);
      let g = THREE.MathUtils.lerp(baseColor.g, 1.2, flashIntensity);
      let b = THREE.MathUtils.lerp(baseColor.b, 0.9, flashIntensity);
      
      // Ember phase: gradual thermal decay
      if (emberPhase > 0) {
        const ep = emberPhase * emberPhase;
        r = THREE.MathUtils.lerp(r, emberColor.r, ep * 0.75);
        g = THREE.MathUtils.lerp(g, emberColor.g, ep * 0.85);
        b = THREE.MathUtils.lerp(b, emberColor.b, ep * 0.92);
      }
      
      // HDR boost: push well above 1.0 for aggressive bloom catch
      const hdrBoost = 1.8 + flashIntensity * 5.0 + (1 - emberPhase) * 0.8;
      
      cols[i * 3] = r * fadeCubed * twinkle * hdrBoost;
      cols[i * 3 + 1] = g * fadeCubed * twinkle * hdrBoost;
      cols[i * 3 + 2] = b * fadeCubed * twinkle * hdrBoost;
      
      // Dynamic star size: larger when young, shrinks as it dies — with HDR size boost
      sizes[i] = baseSize * (0.6 + fadeSquared * 0.4) * (1 + flashIntensity * 2.5);
      lives[i] = age;

      // Star trails — Finale's thermal gradient: white-hot → colored → dim
      for (let s = 0; s < TRAIL_LENGTH; s++) {
        const t0 = Math.max(0, t - s * trailDt);
        const t1 = Math.max(0, t - (s + 1) * trailDt);
        const base2 = (i * TRAIL_LENGTH + s) * 6;
        tPos[base2] = dragPos(vx, t0, dragCoeff) + w[0] * t0 * t0 * 0.3;
        tPos[base2 + 1] = dragPos(vy, t0, dragCoeff) + 0.5 * GRAVITY * t0 * t0;
        tPos[base2 + 2] = dragPos(vz, t0, dragCoeff) + w[2] * t0 * t0 * 0.3;
        tPos[base2 + 3] = dragPos(vx, t1, dragCoeff) + w[0] * t1 * t1 * 0.3;
        tPos[base2 + 4] = dragPos(vy, t1, dragCoeff) + 0.5 * GRAVITY * t1 * t1;
        tPos[base2 + 5] = dragPos(vz, t1, dragCoeff) + w[2] * t1 * t1 * 0.3;
        
        const segFrac = s / TRAIL_LENGTH;
        const segFade = fadeCubed * Math.pow(1 - segFrac, 2.5) * 0.7;
        const endFade = fadeCubed * Math.pow(1 - (s + 1) / TRAIL_LENGTH, 2.5) * 0.7;
        
        // Finale trail thermal: white center → warm gold → colored → faint
        const trailWarmth = Math.pow(segFrac, 0.4);
        tCol[base2] = THREE.MathUtils.lerp(1.2, r * 0.7, trailWarmth) * segFade;
        tCol[base2 + 1] = THREE.MathUtils.lerp(0.8, g * 0.4, trailWarmth) * segFade;
        tCol[base2 + 2] = THREE.MathUtils.lerp(0.35, b * 0.15, trailWarmth) * segFade;
        tCol[base2 + 3] = THREE.MathUtils.lerp(1.2, r * 0.7, trailWarmth) * endFade;
        tCol[base2 + 4] = THREE.MathUtils.lerp(0.8, g * 0.4, trailWarmth) * endFade;
        tCol[base2 + 5] = THREE.MathUtils.lerp(0.35, b * 0.15, trailWarmth) * endFade;
      }
    }

    // === Update star geometry — reuse existing buffer attributes ===
    const pGeo = pointsRef.current.geometry;
    const posAttr = pGeo.getAttribute('position') as THREE.BufferAttribute;
    const colAttr = pGeo.getAttribute('color') as THREE.BufferAttribute;
    const sizeAttr = pGeo.getAttribute('aSize') as THREE.BufferAttribute;
    const lifeAttr = pGeo.getAttribute('aLife') as THREE.BufferAttribute;
    if (posAttr) { posAttr.array = pos; posAttr.needsUpdate = true; }
    if (colAttr) { colAttr.array = cols; colAttr.needsUpdate = true; }
    if (sizeAttr) { sizeAttr.array = sizes; sizeAttr.needsUpdate = true; }
    if (lifeAttr) { lifeAttr.array = lives; lifeAttr.needsUpdate = true; }

    const lGeo = trailRef.current.geometry;
    const tPosAttr = lGeo.getAttribute('position') as THREE.BufferAttribute;
    const tColAttr = lGeo.getAttribute('color') as THREE.BufferAttribute;
    if (tPosAttr) { tPosAttr.array = tPos; tPosAttr.needsUpdate = true; }
    if (tColAttr) { tColAttr.array = tCol; tColAttr.needsUpdate = true; }
    
    // === Falling charcoal debris — Finale's signature burnt-out embers ===
    if (debrisRef.current && progress > 0.25) {
      const dPos = debrisPosRef.current;
      const dCol = debrisColRef.current;
      const debrisAge = (progress - 0.25) / 0.75;
      
      for (let i = 0; i < DEBRIS_COUNT; i++) {
        const dvx = debrisVelocities[i * 3];
        const dvy = debrisVelocities[i * 3 + 1];
        const dvz = debrisVelocities[i * 3 + 2];
        const dt = debrisAge * starLife * 0.7;
        const dK = 0.02;
        
        dPos[i * 3] = dragPos(dvx, dt, dK) + w[0] * dt * dt * 0.4;
        dPos[i * 3 + 1] = dragPos(dvy, dt, dK) + 0.5 * GRAVITY * dt * dt;
        dPos[i * 3 + 2] = dragPos(dvz, dt, dK) + w[2] * dt * dt * 0.4;
        
        // Dark charcoal com cintilação determinística
        const debrisFade = Math.max(0, 1 - debrisAge * 1.3);
        const flicker = temporalFlicker(debrisSparkleSeeds[i], time, 0.12, 0.18, 0.22);
        dCol[i * 3] = (0.15 + flicker * 0.8) * debrisFade;
        dCol[i * 3 + 1] = (0.06 + flicker * 0.25) * debrisFade;
        dCol[i * 3 + 2] = 0.02 * debrisFade;
      }
      
      const dGeo = debrisRef.current.geometry;
      const dPosAttr = dGeo.getAttribute('position') as THREE.BufferAttribute;
      const dColAttr = dGeo.getAttribute('color') as THREE.BufferAttribute;
      if (dPosAttr) { dPosAttr.array = dPos; dPosAttr.needsUpdate = true; }
      if (dColAttr) { dColAttr.array = dCol; dColAttr.needsUpdate = true; }
    }
  });

  // Break flash: Finale multi-layer flash system
  // Flash size proportional to caliber — real-world scale
  const flashSize = 3 + caliber * 4.0;

  return (
    <group position={position}>
      {/* ═══ Finale Star Sprites — custom shader gaussian glow ═══ */}
      <points ref={pointsRef} material={starMaterial}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[new Float32Array(STAR_COUNT * 3), 3]} />
          <bufferAttribute attach="attributes-color" args={[new Float32Array(STAR_COUNT * 3), 3]} />
          <bufferAttribute attach="attributes-aSize" args={[new Float32Array(STAR_COUNT), 1]} />
          <bufferAttribute attach="attributes-aLife" args={[new Float32Array(STAR_COUNT), 1]} />
        </bufferGeometry>
      </points>
      
      {/* ═══ Star trails — dense thermal gradient lines ═══ */}
      <lineSegments ref={trailRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[new Float32Array(trailVertCount * 3), 3]} />
          <bufferAttribute attach="attributes-color" args={[new Float32Array(trailVertCount * 3), 3]} />
        </bufferGeometry>
        <lineBasicMaterial vertexColors transparent opacity={0.9} depthWrite={false} blending={THREE.AdditiveBlending} linewidth={3} />
      </lineSegments>
      
      {/* ═══ Falling charcoal debris — Finale post-burnout embers ═══ */}
      {progress > 0.25 && (
        <points ref={debrisRef}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[new Float32Array(DEBRIS_COUNT * 3), 3]} />
            <bufferAttribute attach="attributes-color" args={[new Float32Array(DEBRIS_COUNT * 3), 3]} />
          </bufferGeometry>
          <pointsMaterial size={0.15} vertexColors transparent opacity={0.7} depthWrite={false} blending={THREE.AdditiveBlending} sizeAttenuation />
        </points>
      )}
      
      {/* ═══ BREAK FLASH — Finale 4-layer system ═══ */}
      {/* Layer 1: Inner white-hot core — ultra HDR for maximum bloom */}
      {progress < 0.06 && (
        <mesh>
          <sphereGeometry args={[flashSize * 0.4 * (1 + progress * 10), 16, 16]} />
          <meshBasicMaterial color="#FFFFF0" transparent opacity={1.0 * (1 - progress / 0.06)} blending={THREE.AdditiveBlending} />
        </mesh>
      )}
      {/* Layer 2: Hot colored flash — primary bloom source */}
      {progress < 0.15 && (
        <mesh>
          <sphereGeometry args={[flashSize * (1 + progress * 15), 24, 24]} />
          <meshBasicMaterial color={color} transparent opacity={0.7 * Math.pow(1 - progress / 0.15, 2)} blending={THREE.AdditiveBlending} />
        </mesh>
      )}
      {/* Layer 3: Expanding shockwave ring */}
      {progress > 0.003 && progress < 0.15 && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[
            progress * flashSize * 12,
            progress * flashSize * 12 + 0.8 + caliber * 0.18,
            64
          ]} />
          <meshBasicMaterial color={color} transparent opacity={0.15 * Math.pow(1 - progress / 0.15, 1.5)} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} />
        </mesh>
      )}
      {/* Layer 4: Wide atmospheric halo — sky illumination */}
      {progress < 0.7 && progress > 0.003 && (
        <mesh>
          <sphereGeometry args={[caliber * 6 + progress * caliber * 20, 16, 16]} />
          <meshBasicMaterial color={color} transparent opacity={0.05 * (1 - progress / 0.7)} blending={THREE.AdditiveBlending} />
        </mesh>
      )}
      {/* Layer 5: Ground illumination sphere — lights up terrain */}
      {progress < 0.4 && (
        <mesh position={[0, -position[1] * 0.3, 0]}>
          <sphereGeometry args={[caliber * 12 + progress * caliber * 30, 12, 12]} />
          <meshBasicMaterial color={color} transparent opacity={0.015 * (1 - progress / 0.4)} blending={THREE.AdditiveBlending} />
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
  const sceneSettings = useSceneStore(st => st.settings);
  const activeEffects = useMemo(() => {
    const effectScale = sceneSettings.effectScale;
    const weatherDampening = sceneSettings.weather === 'heavy-rain' ? 0.6 :
      sceneSettings.weather === 'light-rain' ? 0.8 :
      sceneSettings.weather === 'fog' ? 0.7 : 1.0;
    const humidityFactor = 1 - sceneSettings.humidity * 0.3; // humidity shortens burn time

    return timelineItems.map((item) => {
      let effect = EFFECT_LIBRARY.find((e) => e.id === item.effectId);

      // Fallback para itens VDL dinâmicos criados no editor/quick add
      if (!effect && item.effectId.startsWith('vdl-')) {
        const vdlText = item.notes?.match(/VDL:\s*([^|]+)/i)?.[1]?.trim();
        if (vdlText) {
          const parsed = parseVDL(vdlText);
          if (parsed.valid) {
            effect = {
              ...vdlToEffect(parsed),
              id: item.effectId,
              icon: '🎆',
              type: 'firework',
              partType: parsed.partType as (typeof EFFECT_LIBRARY)[number]['partType'],
              duration: Math.max(0.8, parsed.duration),
            } as (typeof EFFECT_LIBRARY)[number];
          }
        }
      }

      if (!effect) return null;

      // ── Resolve position from linked pyropoint ──
      let resolvedPos = item.position;
      let launchHeading = 0;
      let launchPitch = 85; // default vertical
      if (item.positionId) {
        const linkedPos = positions.find(p => p.id === item.positionId);
        if (linkedPos) {
          resolvedPos = { x: linkedPos.x, y: linkedPos.y, z: linkedPos.z };
          launchHeading = linkedPos.heading || 0;
          launchPitch = linkedPos.pitch || 85;
        }
      }

      // ── Real physics: caliber-based heights ──
      const caliber = effect.caliber || 4;
      const isShellType = effect.partType === 'shell' || effect.partType === 'single_shot' || effect.type === 'firework';
      const prefireDuration = isShellType ? (effect.prefire || getLiftTime(caliber)) : 0;
      // Weather affects duration: rain shortens, humidity shortens
      const weatherDuration = effect.duration * weatherDampening * humidityFactor;
      const totalDuration = prefireDuration + weatherDuration;

      if (currentTime < item.startTime || currentTime > item.startTime + totalDuration) return null;
      const elapsed = currentTime - item.startTime;

      const inPrefire = isShellType && elapsed < prefireDuration;
      const prefireProgress = prefireDuration > 0 ? Math.min(1, elapsed / prefireDuration) : 0;
      const burstProgress = prefireDuration > 0
        ? Math.max(0, (elapsed - prefireDuration) / weatherDuration)
        : elapsed / weatherDuration;

      return { item, effect, progress: burstProgress, inPrefire, prefireProgress, caliber, prefireDuration, resolvedPos, effectScale, effectBrightness: sceneSettings.effectBrightness, launchHeading, launchPitch };
    }).filter(Boolean) as {
      item: typeof timelineItems[0];
      effect: typeof EFFECT_LIBRARY[0];
      progress: number;
      inPrefire: boolean;
      prefireProgress: number;
      caliber: number;
      prefireDuration: number;
      resolvedPos: { x: number; y: number; z: number };
      effectScale: number;
      effectBrightness: number;
      launchHeading: number;
      launchPitch: number;
    }[];
  }, [timelineItems, currentTime, positions, sceneSettings.effectScale, sceneSettings.weather, sceneSettings.humidity, sceneSettings.effectBrightness]);

  return (
    <>
      {activeEffects.map(({ item, effect, progress, inPrefire, prefireProgress, caliber, resolvedPos, effectScale, effectBrightness, launchHeading, launchPitch }) => {
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
              heading={launchHeading}
              pitch={launchPitch}
            />
          );
        }

        // ── Real break height with angle offset (Finale 3D standard) ──
        const isShell = pt === 'shell' || pt === 'single_shot';
        const realBreakHeight = getBreakHeight(caliber) * effectScale;
        const pitchRad = (launchPitch || 85) * (Math.PI / 180);
        const headingRad = (launchHeading || 0) * (Math.PI / 180);
        // Angled burst position: shell travels along launch angle
        const burstPos: [number, number, number] = isShell
          ? [
              pos[0] + Math.sin(headingRad) * Math.cos(pitchRad) * realBreakHeight,
              pos[1] + Math.sin(pitchRad) * realBreakHeight,
              pos[2] - Math.cos(headingRad) * Math.cos(pitchRad) * realBreakHeight,
            ]
          : pos;

        // Heights from effect library, scaled by scene
        const scaledHeight = (effect.heightMeters || 4) * effectScale;

        if (pt === 'mine') return (
          <group key={item.id}>
            <MineEffect position={pos} color={effect.color} progress={progress} />
            <SmokeTrail position={pos} progress={progress} intensity={0.5} />
          </group>
        );
        if (pt === 'candle') return <RomanCandleEffect key={item.id} position={pos} color={effect.color} progress={progress} shotCount={effect.shotCount || 8} />;
        if (pt === 'waterfall') return <WaterfallEffect key={item.id} position={pos} color={effect.color} progress={progress} width={scaledHeight} />;
        if (pt === 'gerb') return <GerbEffect key={item.id} position={pos} color={effect.color} progress={progress} height={scaledHeight} />;
        if (pt === 'flame') return <FlameEffect key={item.id} position={pos} color={effect.color} progress={progress} height={scaledHeight} />;
        if (pt === 'cake') return <CakeEffect key={item.id} position={pos} color={effect.color} progress={progress} shotCount={effect.shotCount || 25} />;
        if (pt === 'laser') return <LaserEffect key={item.id} position={pos} color={effect.color} progress={progress} pattern={effect.laserPattern || 'fan'} />;
        if (pt === 'light' && effect.beamType) return <MovingHeadEffect key={item.id} position={pos} color={effect.color} progress={progress} beamType={effect.beamType} />;

        // ── SFX special routing ──
        if (eid === 'sfx-01') return <CryoJetEffect key={item.id} position={pos} color={effect.color} progress={progress} height={scaledHeight || 6} />;
        if (eid === 'sfx-02') return <CryoJetEffect key={item.id} position={pos} color={effect.color} progress={progress} height={scaledHeight || 8} horizontal />;
        if (eid === 'sfx-06' || eid === 'sfx-07') return <ConfettiEffect key={item.id} position={pos} color={effect.color} progress={progress} />;
        if (eid === 'sfx-08') return <FogMachineEffect key={item.id} position={pos} color={effect.color} progress={progress} spread={8 + (scaledHeight || 4)} />;
        if (eid === 'sfx-09') return <HazeMachineEffect key={item.id} position={pos} color={effect.color} progress={progress} radius={16 + (scaledHeight || 4)} />;
        if (eid === 'sfx-10') return <SnowMachineEffect key={item.id} position={pos} progress={progress} width={6 + (scaledHeight || 4)} height={Math.max(6, (scaledHeight || 8) * 1.2)} />;
        if (eid === 'sfx-11') return <BubbleMachineEffect key={item.id} position={pos} color={effect.color} progress={progress} spread={6 + (scaledHeight || 3)} />;

        // ── Legacy effect ID routing ──
        if (eid.startsWith('comet-')) return <CometEffect key={item.id} position={pos} color={effect.color} progress={progress} direction={eid === 'comet-02' ? 'down' : 'up'} />;
        if (eid.startsWith('shock-')) return <ShockwaveEffect key={item.id} position={burstPos} color={effect.color} progress={progress} />;
        if (eid.startsWith('mburst-')) return <MultiBurstEffect key={item.id} position={burstPos} color={effect.color} progress={progress} burstCount={eid === 'mburst-02' ? 5 : 3} />;
        if (eid.startsWith('fan-')) return <FanEffect key={item.id} position={pos} color={effect.color} progress={progress} spreadAngle={eid === 'fan-02' ? 180 : 90} />;

        // ── Default: firework burst at break height with smoke + embers ──
        if (effect.type === 'firework') return (
          <group key={item.id}>
            <FireworkBurst 
              position={burstPos} 
              color={effect.color} 
              progress={progress} 
              caliber={caliber}
              pattern={effect.pattern || 'peony'}
            />
            <SmokeTrail position={burstPos} progress={progress} intensity={caliber * 0.4} />
            <EmberParticles position={pos} color={effect.color} progress={progress} spreadRadius={caliber * 3} startHeight={realBreakHeight * 0.8} />
            {caliber >= 4 && <SparkShower position={pos} color={effect.color} progress={progress} height={realBreakHeight * 0.7} spread={caliber * 2} />}
          </group>
        );
        return <LightPoint key={item.id} position={pos} color={effect.color} />;
      })}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Live SFX 3D — renders effects fired from the Live SFX Console
// ═══════════════════════════════════════════════════════════════════════
function LiveSFXEffects() {
  const activeEffects = useLiveSfxStore((s) => s.activeEffects);
  const stopEffect = useLiveSfxStore((s) => s.stopEffect);
  const frameRef = useRef(0);

  useFrame(() => {
    if (activeEffects.length === 0) return;
    frameRef.current++;
    // Clean up expired effects (only check every 10 frames to avoid store churn)
    if (frameRef.current % 10 === 0) {
      const now = performance.now();
      for (const fx of activeEffects) {
        if (now - fx.startedAt > fx.duration) {
          stopEffect(fx.id);
        }
      }
    }
  });

  return (
    <>
      {activeEffects.map((fx) => {
        const elapsed = (performance.now() - fx.startedAt) / fx.duration;
        const progress = Math.min(1, Math.max(0, elapsed));
        if (progress >= 1) return null;

        const pos = fx.position;
        const intensityScale = fx.intensity / 255;

        switch (fx.type) {
          case 'co2':
          case 'cryo':
            return <group key={fx.id}><CryoJetEffect position={pos} color={fx.color} progress={progress} height={6 * intensityScale + 2} /></group>;
          case 'flame':
            return <group key={fx.id}><FlameEffect position={pos} color={fx.color} progress={progress} height={8 * intensityScale + 2} /></group>;
          case 'confetti':
          case 'streamer':
            return <group key={fx.id}><ConfettiEffect position={pos} color={fx.color} progress={progress} /></group>;
          case 'haze':
            return <group key={fx.id}><HazeMachineEffect position={pos} color={fx.color} progress={progress} radius={12} /></group>;
          case 'spark':
            return <group key={fx.id}><SparkShower position={pos} color={fx.color} progress={progress} height={6 * intensityScale + 2} spread={3} /></group>;
          default:
            return <group key={fx.id}><GerbEffect position={pos} color={fx.color} progress={progress} height={4 * intensityScale + 1} /></group>;
        }
      })}
    </>
  );
}

// ========================================================================
// GOOGLE EARTH-STYLE — Atmospheric sky with realistic horizon
// ========================================================================
function SkyGradient() {
  const skyBrightness = useSceneStore(st => st.settings.skyBrightness);
  const horizonGlow = useSceneStore(st => st.settings.horizonGlow);
  const starDensity = useSceneStore(st => st.settings.starDensity);

  const uniforms = useMemo(() => ({
    uSkyBrightness: { value: skyBrightness },
    uHorizonGlow: { value: horizonGlow },
    uStarDensity: { value: starDensity },
    uTime: { value: 0 },
  }), []);

  useEffect(() => {
    uniforms.uSkyBrightness.value = skyBrightness;
    uniforms.uHorizonGlow.value = horizonGlow;
    uniforms.uStarDensity.value = starDensity;
  }, [skyBrightness, horizonGlow, starDensity]);

  useFrame(({ clock }) => {
    uniforms.uTime.value = clock.getElapsedTime();
  });

  return (
    <mesh>
      <sphereGeometry args={[500, 64, 64]} />
      <shaderMaterial
        side={THREE.BackSide}
        uniforms={uniforms}
        vertexShader={`
          varying vec3 vWorldPosition;
          void main() {
            vec4 worldPosition = modelMatrix * vec4(position, 1.0);
            vWorldPosition = worldPosition.xyz;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          uniform float uSkyBrightness;
          uniform float uHorizonGlow;
          uniform float uStarDensity;
          uniform float uTime;
          varying vec3 vWorldPosition;
          
          float hash21(vec2 p) {
            p = fract(p * vec2(123.34, 456.21));
            p += dot(p, p + 45.32);
            return fract(p.x * p.y);
          }
          
          float noise2d(vec2 p) {
            vec2 i = floor(p);
            vec2 f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            return mix(
              mix(hash21(i), hash21(i + vec2(1,0)), f.x),
              mix(hash21(i + vec2(0,1)), hash21(i + vec2(1,1)), f.x), f.y
            );
          }
          
          float fbm3(vec2 p) {
            float v = 0.0, a = 0.5;
            for (int i = 0; i < 4; i++) { v += a * noise2d(p); p *= 2.1; a *= 0.45; }
            return v;
          }
          
          float starField(vec3 dir) {
            vec2 uv = vec2(atan(dir.x, dir.z) * 3.183, asin(clamp(dir.y, -1.0, 1.0)) * 6.366);
            vec2 id = floor(uv * 140.0);
            float h = hash21(id);
            float threshold = mix(0.998, 0.972, clamp(uStarDensity, 0.0, 2.0) / 2.0);
            if (h > threshold) {
              vec2 offset = fract(uv * 140.0) - 0.5;
              float brightness = smoothstep(0.12, 0.0, length(offset)) * (0.5 + h * 4.0);
              float twinkle = sin(h * 6283.0 + uTime * (0.5 + h * 2.0)) * 0.35 + 0.65;
              return brightness * twinkle * smoothstep(0.08, 0.35, dir.y);
            }
            return 0.0;
          }
          
          // Shooting stars
          float shootingStar(vec3 dir) {
            float t = uTime * 0.15;
            float star = 0.0;
            for (int i = 0; i < 3; i++) {
              float fi = float(i);
              float phase = fract(t + fi * 0.37);
              if (phase > 0.95) continue; // most of the time hidden
              float startAngle = hash21(vec2(fi, floor(t + fi * 0.37))) * 6.28;
              float startElev = 0.4 + hash21(vec2(fi + 10.0, floor(t + fi * 0.37))) * 0.4;
              vec3 startDir = normalize(vec3(cos(startAngle), startElev, sin(startAngle)));
              vec3 moveDir = normalize(vec3(-0.3, -0.15, 0.1));
              vec3 pos = startDir + moveDir * phase * 0.5;
              float dist = length(cross(dir - startDir, moveDir)) / length(moveDir);
              float along = dot(dir - startDir, moveDir);
              float trail = smoothstep(0.15, 0.0, along) * smoothstep(-0.01, 0.0, along);
              float bright = smoothstep(0.003, 0.0, dist) * trail * (1.0 - phase) * 3.0;
              star += bright;
            }
            return star * smoothstep(0.15, 0.4, dir.y);
          }
          
          void main() {
            vec3 dir = normalize(vWorldPosition);
            float h = dir.y;
            
            // Enhanced atmosphere with more depth layers
            vec3 space     = vec3(0.003, 0.005, 0.02);
            vec3 zenith    = vec3(0.008, 0.012, 0.05);
            vec3 upperSky  = vec3(0.015, 0.028, 0.10);
            vec3 midSky    = vec3(0.035, 0.055, 0.16);
            vec3 lowSky    = vec3(0.055, 0.08, 0.20);
            vec3 horizon   = vec3(0.12, 0.14, 0.22);
            vec3 haze      = vec3(0.16, 0.15, 0.18);
            vec3 ground    = vec3(0.008, 0.012, 0.02);
            
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
            
            // Atmospheric glow band
            float hGlow = exp(-h * h * 80.0);
            color += vec3(0.18, 0.14, 0.08) * hGlow * uHorizonGlow;
            
            // Blue atmospheric scatter ring
            float blueRing = exp(-(h - 0.03) * (h - 0.03) * 60.0);
            color += vec3(0.04, 0.06, 0.12) * blueRing * 0.35;
            
            // Enhanced Milky Way with structure
            float milkyAngle = dir.x * 0.6 + dir.z * 0.8;
            float milkyBand = exp(-pow(milkyAngle - dir.y * 0.5, 2.0) * 6.0);
            float milkyDetail = fbm3(dir.xz * 30.0) * 0.6 + 0.4;
            float milkyDust = fbm3(dir.xz * 60.0 + 100.0);
            vec3 milkyColor = mix(vec3(0.02, 0.025, 0.05), vec3(0.04, 0.03, 0.05), milkyDust);
            color += milkyColor * milkyBand * milkyDetail * smoothstep(0.15, 0.5, h) * 0.8;
            
            // Dark dust lanes in Milky Way
            float dustLane = smoothstep(0.45, 0.55, fbm3(dir.xz * 20.0 + 50.0));
            color -= vec3(0.01) * milkyBand * dustLane * smoothstep(0.2, 0.5, h);
            
            // Subtle nebula color patches
            float nebula1 = fbm3(dir.xz * 15.0 + vec2(200.0, 0.0));
            float nebula2 = fbm3(dir.xz * 12.0 + vec2(0.0, 300.0));
            color += vec3(0.015, 0.005, 0.02) * smoothstep(0.6, 0.8, nebula1) * milkyBand * 0.5;
            color += vec3(0.005, 0.01, 0.025) * smoothstep(0.55, 0.75, nebula2) * smoothstep(0.3, 0.6, h) * 0.4;
            
            // Procedural cloud wisps near horizon
            float cloudUV1 = fbm3(dir.xz * 4.0 + uTime * 0.01);
            float cloudUV2 = fbm3(dir.xz * 8.0 - uTime * 0.008 + 50.0);
            float cloudMask = smoothstep(0.0, 0.12, h) * smoothstep(0.25, 0.08, h);
            float clouds = smoothstep(0.45, 0.7, cloudUV1 * 0.6 + cloudUV2 * 0.4) * cloudMask;
            color += vec3(0.06, 0.07, 0.10) * clouds * 0.4;
            
            // Stars with color variation
            float stars = starField(dir);
            float starHue = hash21(dir.xz * 50.0);
            vec3 starColor = starHue < 0.3 ? vec3(0.7, 0.8, 1.0) :
                             starHue < 0.6 ? vec3(1.0, 0.95, 0.85) :
                             starHue < 0.85 ? vec3(1.0, 0.85, 0.7) :
                             vec3(1.0, 0.6, 0.5);
            color += starColor * stars * 0.8 * uStarDensity;
            
            // Shooting stars
            float shooting = shootingStar(dir);
            color += vec3(0.9, 0.95, 1.0) * shooting * uStarDensity;
            
            color *= uSkyBrightness;
            color = max(color, vec3(0.0));
            
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
        <meshBasicMaterial color="#d0c8a8" transparent opacity={0.15} blending={THREE.AdditiveBlending} />
      </mesh>
      {/* Inner core glow */}
      <mesh>
        <sphereGeometry args={[3.55, 24, 24]} />
        <meshBasicMaterial color="#ffe8c0" transparent opacity={0.06} blending={THREE.AdditiveBlending} />
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
        <sphereGeometry args={[14, 16, 16]} />
        <meshBasicMaterial color="#506080" transparent opacity={0.02} blending={THREE.AdditiveBlending} />
      </mesh>
      {/* Ultra-wide corona */}
      <mesh>
        <sphereGeometry args={[22, 12, 12]} />
        <meshBasicMaterial color="#405070" transparent opacity={0.008} blending={THREE.AdditiveBlending} />
      </mesh>
      <pointLight color="#8899bb" intensity={0.35} distance={350} decay={1} />
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

      float edgeDist = length(vWorldPos.xz) / 120.0;
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
  const count = 500;
  
  const { positions: posData, sizes, velocities: velData } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const sz = new Float32Array(count);
    const vel = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 400;
      pos[i * 3 + 1] = Math.random() * 60 + 0.5;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 400;
      sz[i] = 0.02 + Math.random() * 0.08;
      vel[i * 3] = (Math.random() - 0.5) * 0.01;
      vel[i * 3 + 1] = (Math.random() - 0.5) * 0.005;
      vel[i * 3 + 2] = (Math.random() - 0.5) * 0.01;
    }
    return { positions: pos, sizes: sz, velocities: vel };
  }, []);

  useFrame(({ clock, camera }) => {
    if (!pointsRef.current) return;
    const t = clock.getElapsedTime();
    const posAttr = pointsRef.current.geometry.getAttribute('position') as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;
    const camX = camera.position.x, camZ = camera.position.z;
    for (let i = 0; i < count; i++) {
      arr[i * 3] += Math.sin(t * 0.08 + i * 0.5) * 0.004 + velData[i * 3];
      arr[i * 3 + 1] += Math.sin(t * 0.12 + i * 0.3) * 0.003 + velData[i * 3 + 1];
      arr[i * 3 + 2] += Math.cos(t * 0.07 + i * 0.7) * 0.004 + velData[i * 3 + 2];
      // Recycle particles that drift too far from camera
      const dx = arr[i * 3] - camX, dz = arr[i * 3 + 2] - camZ;
      if (dx * dx + dz * dz > 40000) {
        arr[i * 3] = camX + (Math.random() - 0.5) * 200;
        arr[i * 3 + 2] = camZ + (Math.random() - 0.5) * 200;
      }
    }
    posAttr.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[posData, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.07}
        color="#8899cc"
        transparent
        opacity={0.18}
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

// --- Finale 3D dark professional ground ---
function FinaleDarkGround({ brightness }: { brightness: number }) {
  const b = brightness * 0.4; // darker base
  return (
    <>
      <mesh position={[0, -0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[4000, 4000]} />
        <meshStandardMaterial
          color={new THREE.Color(0.02 * b, 0.035 * b, 0.02 * b)}
          roughness={0.92}
          metalness={0.05}
        />
      </mesh>
      {/* Near-field slightly lighter for depth */}
      <mesh position={[0, -0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[120, 64]} />
        <meshStandardMaterial
          color={new THREE.Color(0.03 * b, 0.05 * b, 0.03 * b)}
          roughness={0.88}
          metalness={0.08}
        />
      </mesh>
    </>
  );
}

// --- Concrete / urban ground ---
function ConcreteGround({ brightness }: { brightness: number }) {
  const b = brightness * 0.5;
  return (
    <>
      <mesh position={[0, -0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[4000, 4000]} />
        <meshStandardMaterial
          color={new THREE.Color(0.06 * b, 0.06 * b, 0.065 * b)}
          roughness={0.95}
          metalness={0.1}
        />
      </mesh>
      <mesh position={[0, -0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[150, 64]} />
        <meshStandardMaterial
          color={new THREE.Color(0.08 * b, 0.08 * b, 0.085 * b)}
          roughness={0.9}
          metalness={0.15}
        />
      </mesh>
    </>
  );
}

function StageGround({ satelliteTexture }: { satelliteTexture: string | null }) {
  const sc = useSceneStore(st => st.settings);

  const renderGround = () => {
    switch (sc.groundStyle) {
      case 'flat-black':
        return (
          <mesh position={[0, -0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[4000, 4000]} />
            <meshStandardMaterial color="#050505" roughness={0.95} metalness={0} />
          </mesh>
        );
      case 'concrete':
        return <ConcreteGround brightness={sc.groundBrightness} />;
      case 'finale-dark':
        return <FinaleDarkGround brightness={sc.groundBrightness} />;
      case 'google-earth':
      default:
        return <GrassGround />;
    }
  };

  return (
    <group>
      {renderGround()}
      {satelliteTexture && <SatelliteOverlay textureUrl={satelliteTexture} />}
      {sc.groundFogIntensity > 0 && <GroundFog />}

      {/* Operational grid */}
      {sc.showGrid && (
        <>
          <Grid
            position={[0, 0.01, 0]}
            args={[1000, 1000]}
            cellSize={2}
            cellThickness={0.15}
            cellColor={sc.gridColor}
            sectionSize={10}
            sectionThickness={0.4}
            sectionColor="#2a4a2a"
            fadeDistance={350}
            infiniteGrid
          />
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
        </>
      )}

      {/* Origin marker */}
      {sc.showOriginMarker && (
        <>
          <mesh position={[0, 0.018, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.15, 6]} />
            <meshBasicMaterial color="#5a8a5a" transparent opacity={0.3} />
          </mesh>
          <mesh position={[0, 0.018, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[6, 0.15]} />
            <meshBasicMaterial color="#5a8a5a" transparent opacity={0.3} />
          </mesh>
        </>
      )}

      {/* Scale reference poles — real height markers matching firework break heights */}
      {sc.showScalePoles && [-80, -40, 0, 40, 80].map((x) => (
        <group key={`pole-${x}`} position={[x, 0, -60]}>
          {/* Tall reference pole (100m) */}
          <mesh position={[0, 50, 0]} castShadow>
            <cylinderGeometry args={[0.08, 0.1, 100, 8]} />
            <meshStandardMaterial color="#555555" metalness={0.7} roughness={0.25} />
          </mesh>
          {/* Height markers every 25m */}
          {[25, 50, 75, 100].map((h) => (
            <group key={h}>
              <mesh position={[0, h, 0]}>
                <boxGeometry args={[0.5, 0.05, 0.5]} />
                <meshBasicMaterial color={h === 50 ? '#ffaa00' : h === 100 ? '#ff4444' : '#888888'} transparent opacity={0.5} />
              </mesh>
              {/* Height label billboard */}
              <mesh position={[1.2, h, 0]}>
                <planeGeometry args={[2, 0.6]} />
                <meshBasicMaterial color={h === 100 ? '#ff4444' : '#666666'} transparent opacity={0.25} />
              </mesh>
            </group>
          ))}
          <mesh position={[0, 100.3, 0]}>
            <sphereGeometry args={[0.15, 8, 8]} />
            <meshBasicMaterial color="#ff4444" />
          </mesh>
          <mesh position={[0, 0.1, 0]}>
            <cylinderGeometry args={[0.35, 0.45, 0.2, 8]} />
            <meshStandardMaterial color="#444444" metalness={0.6} roughness={0.3} />
          </mesh>
        </group>
      ))}

      {/* Horizon treeline */}
      {sc.showTreeline && <TreelineSilhouette />}
    </group>
  );
}

// --- Layered tree silhouettes with depth ---
function TreelineSilhouette() {
  const trees = useMemo(() => {
    const result: { x: number; z: number; h: number; w: number; layer: number }[] = [];
    // 6 depth layers — expanded world
    for (let layer = 0; layer < 6; layer++) {
      const count = 120 - layer * 15;
      const baseDist = 300 + layer * 120;
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + layer * 0.05;
        const dist = baseDist + Math.random() * 60;
        result.push({
          x: Math.cos(angle) * dist,
          z: Math.sin(angle) * dist,
          h: 6 + Math.random() * 22 + layer * 5,
          w: 5 + Math.random() * 10,
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

// LaunchSites removed — positions are now user-created via toolbar

// ─── Scene-Settings-Driven Components ────────────────────────────────

const SHADOW_MAP_SIZES: Record<string, number> = { low: 1024, medium: 2048, high: 4096, ultra: 8192 };

function SceneLighting() {
  const s = useSceneStore(st => st.settings);
  const shadowSize = SHADOW_MAP_SIZES[s.shadowQuality] || 4096;

  return (
    <>
      <ambientLight intensity={s.ambientIntensity} color="#506880" />
      <directionalLight
        position={[60, 55, -80]}
        intensity={s.moonIntensity}
        color={s.moonColor}
        castShadow={s.shadowsEnabled}
        shadow-mapSize={[shadowSize, shadowSize]}
        shadow-camera-far={500}
        shadow-camera-left={-150}
        shadow-camera-right={150}
        shadow-camera-top={150}
        shadow-camera-bottom={-150}
        shadow-bias={-0.00005}
      />
      <hemisphereLight args={['#152050', '#0c1a0a', 0.12]} />
      <directionalLight position={[-40, 20, 60]} intensity={s.rimLightIntensity * 0.2} color="#4466aa" />
      <directionalLight position={[0, -10, 30]} intensity={s.fillLightIntensity * 0.1} color="#1a2a1a" />
    </>
  );
}

function SceneFog() {
  const s = useSceneStore(st => st.settings);
  if (s.fogDensity <= 0) return null;
  return <fog attach="fog" args={[s.fogColor, s.fogNear, s.fogFar / Math.max(s.fogDensity, 0.1)]} />;
}

function SceneStars() {
  const density = useSceneStore(st => st.settings.starDensity);
  if (density <= 0.05) return null;
  return <Stars radius={450} depth={200} count={Math.round(10000 * density)} factor={5} saturation={0.2} fade speed={0.03} />;
}

function WeatherEffects() {
  const weather = useSceneStore(st => st.settings.weather);
  const rainIntensity = useSceneStore(st => st.settings.rainIntensity);
  const pointsRef = useRef<THREE.Points>(null);

  const rainData = useMemo(() => {
    if (weather !== 'light-rain' && weather !== 'heavy-rain' && weather !== 'snow') return null;
    const count = weather === 'heavy-rain' ? 3000 : weather === 'snow' ? 1500 : 1000;
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 300;
      positions[i * 3 + 1] = Math.random() * 100;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 300;
      velocities[i] = weather === 'snow' ? 1 + Math.random() * 2 : 15 + Math.random() * 25;
    }
    return { count, positions, velocities };
  }, [weather]);

  useFrame(() => {
    if (!pointsRef.current || !rainData) return;
    const posAttr = pointsRef.current.geometry.getAttribute('position') as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;
    for (let i = 0; i < rainData.count; i++) {
      arr[i * 3 + 1] -= rainData.velocities[i] * 0.016 * rainIntensity;
      if (arr[i * 3 + 1] < 0) {
        arr[i * 3 + 1] = 80 + Math.random() * 20;
        arr[i * 3] = (Math.random() - 0.5) * 300;
        arr[i * 3 + 2] = (Math.random() - 0.5) * 300;
      }
    }
    posAttr.needsUpdate = true;
  });

  if (!rainData) return null;

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[rainData.positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={weather === 'snow' ? 0.15 : 0.04}
        color={weather === 'snow' ? '#e8e8ff' : '#aabbcc'}
        transparent
        opacity={rainIntensity * 0.6}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  );
}

// --- Camera controller ---
function CameraController({ targetPosition, targetLookAt, freeLook }: { targetPosition: [number, number, number]; targetLookAt: [number, number, number]; freeLook: boolean }) {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);
  const targetPos = useRef(new THREE.Vector3(...targetPosition));
  const targetLook = useRef(new THREE.Vector3(...targetLookAt));
  const animating = useRef(false);

  useEffect(() => {
    if (freeLook) {
      animating.current = false;
      return;
    }
    targetPos.current.set(...targetPosition);
    targetLook.current.set(...targetLookAt);
    animating.current = true;
  }, [targetPosition, targetLookAt, freeLook]);

  useFrame(() => {
    if (!animating.current || !controlsRef.current || freeLook) return;
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
      maxDistance={2000}
      enablePan
    />
  );
}

/** Floating menu for fullscreen mode — gives access to key actions */
function FullscreenEditMenu() {
  const { isPlaying, setPlaying, currentTime, setCurrentTime, duration } = useProjectStore();
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="absolute top-3 right-3 z-50 flex flex-col items-end gap-1">
      <button
        onClick={() => setExpanded(!expanded)}
        className="bg-surface-1/90 backdrop-blur-md text-foreground border border-border/60 px-3 py-1.5 rounded text-[10px] font-mono-code flex items-center gap-1.5 hover:bg-surface-2/90 transition-all shadow-lg"
      >
        <Cog className="w-3.5 h-3.5" />
        Menu
      </button>
      {expanded && (
        <div className="bg-surface-1/95 backdrop-blur-md border border-border/60 rounded-lg shadow-xl p-2 min-w-[160px] space-y-0.5">
          <button
            onClick={() => setPlaying(!isPlaying)}
            className="w-full text-left px-3 py-1.5 text-[10px] font-mono-code text-muted-foreground hover:text-foreground hover:bg-surface-3 rounded flex items-center gap-2"
          >
            {isPlaying ? '⏸ Pause' : '▶ Play'}
          </button>
          <button
            onClick={() => { setCurrentTime(0); setPlaying(false); }}
            className="w-full text-left px-3 py-1.5 text-[10px] font-mono-code text-muted-foreground hover:text-foreground hover:bg-surface-3 rounded flex items-center gap-2"
          >
            ⏮ Rewind
          </button>
          <div className="border-t border-border/30 my-1" />
          <div className="px-3 py-1 text-[9px] font-mono-code text-muted-foreground">
            Time: {currentTime.toFixed(1)}s / {duration.toFixed(1)}s
          </div>
          <div className="border-t border-border/30 my-1" />
          <button
            onClick={() => document.exitFullscreen()}
            className="w-full text-left px-3 py-1.5 text-[10px] font-mono-code text-muted-foreground hover:text-foreground hover:bg-surface-3 rounded flex items-center gap-2"
          >
            <Minimize className="w-3 h-3" /> Sair Fullscreen
          </button>
        </div>
      )}
    </div>
  );
}

export default function SkyCanvas() {
  const editorMode = useProjectStore((s) => s.editorMode);
  const droneFormations = useProjectStore((s) => s.droneFormations);
  const gpsOrigin = useProjectStore((s) => s.gpsOrigin);
  const cursorStyle = editorMode !== 'select' ? 'crosshair' : 'default';
  const [activePreset, setActivePreset] = useState('free');
  const [freeLook, setFreeLook] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const preset = CAMERA_PRESETS.find((p) => p.id === activePreset) || CAMERA_PRESETS[0];
  const perfStatsRef = useRef<PerfStats>({ fps: 0, drawCalls: 0, triangles: 0, geometries: 0, textures: 0 });
  const droneCount = droneFormations.length > 0 ? droneFormations[0].droneCount : 0;
  const [satelliteTexture, setSatelliteTexture] = useState<string | null>(null);
  const [downloadingScenery, setDownloadingScenery] = useState(false);

  // Track fullscreen state
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

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
          antialias: false,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.4,
          powerPreference: 'high-performance',
          alpha: false,
          stencil: false,
          logarithmicDepthBuffer: true,
        }}
        dpr={[1, 2]}
      >
        <PerspectiveCamera makeDefault position={preset.position} fov={55} near={0.5} far={5000} />
        <CameraController targetPosition={[...preset.position]} targetLookAt={[...preset.target]} freeLook={freeLook} />

        <SceneLighting />

        <SkyGradient />
        <Moon />
        <SceneStars />
        <AtmosphericParticles />
        <SceneFog />
        <WeatherEffects />

        <StageGround satelliteTexture={satelliteTexture} />
        {/* LaunchSites removed — user creates positions via toolbar */}
        <PositionPins />
        <PyroLaunchAngles />
        <Rack3DView />
        <TrajectoryPaths />
        <DroneChoreography />
        <BoidsVisualizer />
        <CollisionAvoidanceOverlay config={DEFAULT_AVOIDANCE} />
        <TimelineEffects />
        <LiveSFXEffects />
        <AudioSpectrumVisualizer />
        <GeofenceVisual />
        <PlaybackClock />
        <CameraAnimator />
        <CameraPathPreview />
        <PostProcessing />
        <BoxSelectR3F />
        <PerfCollector statsRef={perfStatsRef} />
      </Canvas>
      </WebGLErrorBoundary>

      {/* Camera presets & controls */}
      <div className="absolute top-3 left-3 flex items-center gap-1 flex-wrap">
        {/* Free look toggle */}
        <button
          onClick={() => setFreeLook(!freeLook)}
          className={cn(
            "flex items-center gap-1 px-2 py-1 rounded-sm text-[10px] font-mono-code transition-all border",
            freeLook
              ? "bg-warning/20 text-warning border-warning/40"
              : "bg-surface-1/80 text-muted-foreground border-border/50 hover:text-foreground hover:bg-surface-2/80"
          )}
          title="Free Look — camera stays where you leave it"
        >
          <ScanEye className="w-3 h-3" />
          <span className="hidden sm:inline">Look</span>
        </button>

        {CAMERA_PRESETS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => { setActivePreset(id); setFreeLook(false); }}
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded-sm text-[10px] font-mono-code transition-all border",
              activePreset === id && !freeLook
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

        {/* Fullscreen toggle */}
        <button
          onClick={() => {
            const el = document.querySelector('[data-sky-canvas]') as HTMLElement;
            if (!el) return;
            document.fullscreenElement ? document.exitFullscreen() : el.requestFullscreen();
          }}
          className="bg-surface-1/80 text-muted-foreground border border-border/50 hover:text-foreground hover:bg-surface-2/80 px-2 py-1 rounded-sm transition-all"
        >
          {isFullscreen ? <Minimize className="w-3.5 h-3.5" /> : <Maximize className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Fullscreen floating edit menu */}
      {isFullscreen && <FullscreenEditMenu />}

      <PerformanceHUD statsRef={perfStatsRef} droneCount={droneCount} />
      <ViewportTerminal />
      <SelectionStatusBar />
      <AlignmentTools />

      <div className="absolute bottom-3 right-3 text-[9px] font-mono-code text-muted-foreground/60 bg-surface-1/60 backdrop-blur-sm px-2 py-1 rounded border border-border/30 space-y-0.5">
        <div>Orbit: LMB · Pan: MMB · Zoom: Scroll</div>
        <div>Box: Alt+Drag · Multi: Shift+Click · Edit: Dbl-Click</div>
        <div>{freeLook ? '🔓 Free Look ON' : '🔒 Preset Lock'}</div>
      </div>
    </div>
  );
}
