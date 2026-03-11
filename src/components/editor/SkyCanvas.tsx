import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Stars, Grid, PerspectiveCamera, MeshReflectorMaterial } from '@react-three/drei';
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

// ========================================================================
// UE5-QUALITY SKY — Rayleigh/Mie scattering + procedural clouds + milky way
// ========================================================================
function SkyGradient() {
  const meshRef = useRef<THREE.Mesh>(null);
  const uniforms = useMemo(() => ({
    topColor: { value: new THREE.Color('#010206') },
    midColor: { value: new THREE.Color('#040a1e') },
    bottomColor: { value: new THREE.Color('#0a1020') },
    horizonColor: { value: new THREE.Color('#14203a') },
    horizonGlow: { value: new THREE.Color('#1e3058') },
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
          varying vec3 vNormal;
          void main() {
            vec4 worldPosition = modelMatrix * vec4(position, 1.0);
            vWorldPosition = worldPosition.xyz;
            vUv = uv;
            vNormal = normalize(normalMatrix * normal);
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
          varying vec3 vNormal;

          // Improved noise functions
          float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
          float hash3(vec3 p) { return fract(sin(dot(p, vec3(127.1,311.7,74.7))) * 43758.5453); }
          
          float noise(vec2 p) {
            vec2 i = floor(p); vec2 f = fract(p);
            f = f*f*f*(f*(f*6.0-15.0)+10.0); // quintic interpolation
            return mix(mix(hash(i), hash(i+vec2(1,0)), f.x),
                       mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y);
          }
          
          float fbm(vec2 p, int octaves) {
            float value = 0.0;
            float amplitude = 0.5;
            float frequency = 1.0;
            for (int i = 0; i < 6; i++) {
              if (i >= octaves) break;
              value += amplitude * noise(p * frequency);
              amplitude *= 0.5;
              frequency *= 2.0;
            }
            return value;
          }

          // Rayleigh-like scattering approximation
          vec3 rayleighScatter(float cosTheta, float height) {
            vec3 betaR = vec3(5.8e-3, 13.5e-3, 33.1e-3); // Rayleigh coefficients (RGB)
            float phase = 0.75 * (1.0 + cosTheta * cosTheta);
            float density = exp(-height * 4.0);
            return betaR * phase * density;
          }

          // Mie-like scattering for horizon glow
          float miePhase(float cosTheta, float g) {
            float g2 = g * g;
            return (1.0 - g2) / (4.0 * 3.14159 * pow(1.0 + g2 - 2.0 * g * cosTheta, 1.5));
          }

          void main() {
            vec3 dir = normalize(vWorldPosition);
            float h = dir.y;
            
            // Sun/moon direction for scattering
            vec3 sunDir = normalize(vec3(0.6, 0.08, -0.8));
            float cosTheta = dot(dir, sunDir);
            
            // === Base gradient with smooth bands ===
            vec3 color;
            if (h > 0.5) {
              color = mix(midColor, topColor, smoothstep(0.5, 1.0, h));
            } else if (h > 0.08) {
              color = mix(horizonGlow, midColor, smoothstep(0.08, 0.5, h));
            } else if (h > -0.02) {
              float band = 1.0 - abs(h - 0.03) * 15.0;
              band = clamp(band, 0.0, 1.0);
              color = mix(horizonColor, horizonGlow, band * 0.7);
              // Warm atmospheric glow at horizon
              color += vec3(0.12, 0.06, 0.02) * band * 0.4;
            } else {
              color = mix(bottomColor, horizonColor, smoothstep(-0.3, -0.02, h));
            }
            
            // === Rayleigh scattering — blue tint in upper atmosphere ===
            vec3 scatter = rayleighScatter(cosTheta, max(h, 0.0));
            color += scatter * 0.3;
            
            // === Mie scattering — golden horizon glow near moon ===
            float mie = miePhase(cosTheta, 0.76);
            vec3 mieColor = vec3(0.15, 0.10, 0.06) * mie * exp(-abs(h) * 6.0);
            color += mieColor * 0.5;
            
            // === Procedural volumetric clouds ===
            float cloudHeight = smoothstep(-0.05, 0.15, h) * smoothstep(0.6, 0.2, h);
            if (cloudHeight > 0.01) {
              vec2 cloudUV = dir.xz / (abs(h) + 0.1) * 0.8;
              float cloud1 = fbm(cloudUV * 2.0 + time * 0.008, 5);
              float cloud2 = fbm(cloudUV * 4.0 - time * 0.004, 4);
              float cloud3 = fbm(cloudUV * 1.2 + vec2(time * 0.003, -time * 0.006), 6);
              
              // Wispy cirrus clouds
              float cirrus = smoothstep(0.42, 0.65, cloud1) * cloudHeight * 0.3;
              // Thicker stratus
              float stratus = smoothstep(0.48, 0.7, cloud2 * cloud3) * cloudHeight * 0.15;
              
              // Cloud color: slightly lit by moon
              vec3 cloudColor = vec3(0.06, 0.07, 0.10);
              // Silver lining from moonlight
              float moonLit = max(0.0, dot(dir, normalize(vec3(0.6, 0.6, -0.8))));
              cloudColor += vec3(0.04, 0.05, 0.07) * moonLit;
              
              color = mix(color, cloudColor, cirrus + stratus);
            }
            
            // === Milky Way band ===
            float milkyAngle = atan(dir.z, dir.x) * 0.5 + dir.y * 0.3;
            float milkyBand = exp(-pow((milkyAngle - 0.3) * 3.0, 2.0));
            if (h > 0.1 && milkyBand > 0.05) {
              vec2 milkyUV = vec2(atan(dir.z, dir.x) * 2.0, h * 8.0);
              float milkyNoise = fbm(milkyUV * 12.0, 6);
              float milkyDust = fbm(milkyUV * 24.0 + 42.0, 5);
              float milky = milkyNoise * milkyBand * smoothstep(0.1, 0.4, h) * smoothstep(0.95, 0.5, h);
              
              // Milky way colors: pale blue-white with warm dust lanes
              vec3 milkyColor = vec3(0.08, 0.09, 0.14) * milky;
              milkyColor += vec3(0.04, 0.02, 0.01) * milkyDust * milkyBand * 0.3;
              color += milkyColor * 0.6;
            }
            
            // === Aurora borealis hint ===
            float auroraZone = smoothstep(0.25, 0.55, h) * smoothstep(0.75, 0.5, h);
            if (auroraZone > 0.01) {
              float auroraWave = sin(dir.x * 3.0 + time * 0.15) * 0.5 + 0.5;
              auroraWave *= sin(dir.x * 7.0 - time * 0.08) * 0.5 + 0.5;
              float auroraNoise = noise(vec2(dir.x * 5.0 + time * 0.05, h * 10.0));
              float aurora = auroraWave * auroraNoise * auroraZone;
              
              vec3 auroraColor = mix(
                vec3(0.0, 0.12, 0.08), // green
                vec3(0.05, 0.02, 0.15), // purple
                sin(dir.x * 2.0 + time * 0.1) * 0.5 + 0.5
              );
              color += auroraColor * aurora * 0.15;
            }
            
            // === Enhanced star field with twinkling ===
            if (h > 0.05) {
              vec2 starUV = dir.xz / (h + 0.01) * 40.0;
              float starHash = hash(floor(starUV));
              float starBright = step(0.992, starHash);
              float twinkle = sin(time * (2.0 + starHash * 5.0) + starHash * 100.0) * 0.5 + 0.5;
              float starFade = smoothstep(0.05, 0.25, h);
              
              // Star color variation
              vec3 starColor = mix(
                vec3(0.8, 0.85, 1.0), // blue-white
                vec3(1.0, 0.9, 0.7),  // warm yellow
                step(0.5, fract(starHash * 7.0))
              );
              color += starColor * starBright * twinkle * starFade * 0.4;
              
              // Fainter star layer
              vec2 starUV2 = dir.xz / (h + 0.01) * 120.0;
              float starHash2 = hash(floor(starUV2));
              float starBright2 = step(0.988, starHash2);
              color += vec3(0.5, 0.55, 0.7) * starBright2 * smoothstep(0.1, 0.3, h) * 0.15;
            }
            
            // === Atmospheric extinction (distance fog blending) ===
            float extinction = exp(-abs(h) * 5.0) * 0.2;
            color += vec3(0.03, 0.04, 0.08) * extinction;
            
            gl_FragColor = vec4(color, 1.0);
          }
        `}
      />
    </mesh>
  );
}

// --- Volumetric Moon with surface detail ---
function Moon() {
  const ref = useRef<THREE.Group>(null);
  const uniforms = useMemo(() => ({
    time: { value: 0 },
  }), []);

  useFrame(({ clock }) => {
    uniforms.time.value = clock.getElapsedTime();
  });

  return (
    <group ref={ref} position={[60, 65, -80]}>
      {/* Moon surface with craters */}
      <mesh>
        <sphereGeometry args={[4, 64, 64]} />
        <shaderMaterial
          uniforms={uniforms}
          vertexShader={`
            varying vec2 vUv;
            varying vec3 vNormal;
            varying vec3 vPosition;
            void main() {
              vUv = uv;
              vNormal = normalize(normalMatrix * normal);
              vPosition = position;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `}
          fragmentShader={`
            varying vec2 vUv;
            varying vec3 vNormal;
            varying vec3 vPosition;
            
            float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
            float noise(vec2 p) {
              vec2 i = floor(p); vec2 f = fract(p);
              f = f*f*(3.0-2.0*f);
              return mix(mix(hash(i), hash(i+vec2(1,0)), f.x),
                         mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y);
            }
            
            void main() {
              // Crater-like surface noise
              vec2 surfUV = vUv * 20.0;
              float crater1 = noise(surfUV);
              float crater2 = noise(surfUV * 3.0 + 5.0);
              float surface = crater1 * 0.6 + crater2 * 0.4;
              
              // Mare (dark regions)
              float mare = smoothstep(0.45, 0.55, noise(vUv * 4.0));
              
              // Lighting from directional (simulated sun)
              vec3 lightDir = normalize(vec3(-1.0, 0.3, 0.5));
              float diffuse = max(dot(vNormal, lightDir), 0.0);
              float ambient = 0.08;
              
              vec3 baseColor = mix(vec3(0.75, 0.73, 0.7), vec3(0.5, 0.48, 0.45), mare);
              baseColor *= (0.85 + surface * 0.3);
              
              vec3 color = baseColor * (diffuse * 0.8 + ambient);
              
              // Limb darkening
              float limb = pow(max(dot(vNormal, vec3(0.0, 0.0, 1.0)), 0.0), 0.6);
              color *= limb * 0.7 + 0.3;
              
              gl_FragColor = vec4(color, 1.0);
            }
          `}
        />
      </mesh>
      {/* Multi-layer atmospheric glow */}
      <mesh>
        <sphereGeometry args={[5.5, 32, 32]} />
        <meshBasicMaterial color="#8898c0" transparent opacity={0.06} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh>
        <sphereGeometry args={[8, 32, 32]} />
        <meshBasicMaterial color="#506090" transparent opacity={0.03} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh>
        <sphereGeometry args={[14, 32, 32]} />
        <meshBasicMaterial color="#304060" transparent opacity={0.015} blending={THREE.AdditiveBlending} />
      </mesh>
      {/* God rays from moon */}
      <pointLight color="#8899cc" intensity={0.4} distance={250} decay={1} />
      <spotLight 
        color="#667799" 
        intensity={0.15} 
        distance={300} 
        angle={0.4} 
        penumbra={1} 
        position={[0, 0, 0]}
        target-position={[0, -65, 80]}
        decay={1.5}
      />
    </group>
  );
}

// --- UE5-Quality Ground with PBR ---
function StageGround() {
  return (
    <group>
      {/* Main reflective ground — higher quality reflections */}
      <mesh position={[0, -0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[500, 500, 1, 1]} />
        <MeshReflectorMaterial
          mirror={0.4}
          resolution={1024}
          mixBlur={10}
          mixStrength={0.7}
          roughness={0.82}
          depthScale={1.5}
          minDepthThreshold={0.3}
          maxDepthThreshold={1.6}
          color="#060a04"
          metalness={0.12}
          blur={[400, 150]}
        />
      </mesh>

      {/* Operational grid — subtle */}
      <Grid
        position={[0, 0.01, 0]}
        args={[200, 200]}
        cellSize={2}
        cellThickness={0.2}
        cellColor="#0a1218"
        sectionSize={10}
        sectionThickness={0.6}
        sectionColor="#121d35"
        fadeDistance={100}
        infiniteGrid
      />

      {/* Central stage platform — high-res reflector */}
      <mesh position={[0, -0.005, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[26, 128]} />
        <MeshReflectorMaterial
          mirror={0.55}
          resolution={1024}
          mixBlur={5}
          mixStrength={0.9}
          roughness={0.6}
          depthScale={1.2}
          minDepthThreshold={0.2}
          maxDepthThreshold={1.4}
          color="#0c0e16"
          metalness={0.35}
          blur={[250, 100]}
        />
      </mesh>

      {/* Stage safety rim — golden */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[24.5, 25, 128]} />
        <meshBasicMaterial color="#c8a020" transparent opacity={0.25} />
      </mesh>
      {/* Rim glow */}
      <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[24, 25.5, 128]} />
        <meshBasicMaterial color="#c8a020" transparent opacity={0.04} blending={THREE.AdditiveBlending} />
      </mesh>

      {/* Volumetric ground fog — multiple layers for depth */}
      <GroundFog />

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

// --- Volumetric ground fog with animated shader ---
function GroundFog() {
  const fogRef = useRef<THREE.Group>(null);
  const uniforms = useMemo(() => ({
    time: { value: 0 },
    fogColor: { value: new THREE.Color('#060e1c') },
    fogColor2: { value: new THREE.Color('#0a0614') },
  }), []);
  
  const fogLayers = useMemo(() => {
    const layers: { y: number; scale: number; opacity: number; speed: number }[] = [];
    for (let i = 0; i < 12; i++) {
      layers.push({
        y: 0.05 + i * 0.18,
        scale: 90 + i * 12,
        opacity: 0.032 - i * 0.002,
        speed: 0.0015 + Math.random() * 0.004,
      });
    }
    return layers;
  }, []);

  useFrame(({ clock }) => {
    uniforms.time.value = clock.getElapsedTime();
    if (!fogRef.current) return;
    const t = clock.getElapsedTime();
    fogRef.current.children.forEach((child, i) => {
      const layer = fogLayers[i];
      if (layer) {
        const mesh = child as THREE.Mesh;
        mesh.position.x = Math.sin(t * layer.speed + i * 0.7) * 8;
        mesh.position.z = Math.cos(t * layer.speed * 0.6 + i * 1.2) * 5;
        // Subtle vertical breathing
        mesh.position.y = layer.y + Math.sin(t * 0.3 + i * 0.5) * 0.08;
      }
    });
  });

  return (
    <group ref={fogRef}>
      {fogLayers.map((layer, i) => (
        <mesh key={i} position={[0, layer.y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[layer.scale, layer.scale]} />
          <shaderMaterial
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            side={THREE.DoubleSide}
            uniforms={{
              ...uniforms,
              layerOpacity: { value: layer.opacity },
              layerIndex: { value: i },
            }}
            vertexShader={`
              varying vec2 vUv;
              void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
              }
            `}
            fragmentShader={`
              uniform float time;
              uniform vec3 fogColor;
              uniform vec3 fogColor2;
              uniform float layerOpacity;
              uniform float layerIndex;
              varying vec2 vUv;
              
              float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
              float noise(vec2 p) {
                vec2 i = floor(p); vec2 f = fract(p);
                f = f*f*(3.0-2.0*f);
                return mix(mix(hash(i), hash(i+vec2(1,0)), f.x),
                           mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y);
              }
              float fbm(vec2 p) {
                float v = 0.0; float a = 0.5;
                for(int i = 0; i < 5; i++) {
                  v += a * noise(p); p *= 2.0; a *= 0.5;
                }
                return v;
              }
              
              void main() {
                vec2 uv = vUv - 0.5;
                float dist = length(uv) * 2.0;
                
                // Animated wisps
                float n = fbm(uv * 3.0 + time * 0.02 + layerIndex * 1.5);
                float n2 = fbm(uv * 6.0 - time * 0.015 + layerIndex * 2.3);
                float wisps = smoothstep(0.35, 0.7, n) * 0.7 + smoothstep(0.4, 0.75, n2) * 0.3;
                
                // Radial falloff
                float falloff = 1.0 - smoothstep(0.3, 0.5, dist);
                
                vec3 color = mix(fogColor, fogColor2, n * 0.6);
                float alpha = wisps * falloff * layerOpacity;
                
                gl_FragColor = vec4(color, alpha);
              }
            `}
          />
        </mesh>
      ))}
    </group>
  );
}

// --- Dense tree silhouettes with varied shapes ---
function TreelineSilhouette() {
  const trees = useMemo(() => {
    const result: { x: number; z: number; h: number; w: number; type: number }[] = [];
    // Dense treeline with multiple rows
    for (let row = 0; row < 3; row++) {
      const count = 60 + row * 20;
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        const dist = 80 + row * 12 + Math.random() * 8;
        result.push({
          x: Math.cos(angle) * dist,
          z: Math.sin(angle) * dist,
          h: 3 + Math.random() * 8 + row * 2,
          w: 1.2 + Math.random() * 2.5,
          type: Math.floor(Math.random() * 3),
        });
      }
    }
    return result;
  }, []);

  return (
    <group>
      {trees.map((t, i) => (
        <mesh key={i} position={[t.x, t.h * 0.5, t.z]}
          rotation={[0, Math.atan2(t.x, t.z), 0]}>
          <planeGeometry args={[t.w, t.h]} />
          <meshBasicMaterial 
            color={t.type === 0 ? '#020408' : t.type === 1 ? '#030609' : '#040508'} 
            transparent 
            opacity={0.9} 
            side={THREE.DoubleSide} 
          />
        </mesh>
      ))}
    </group>
  );
}

// --- Enhanced distant city with varied lights ---
function DistantCityLights() {
  const lights = useMemo(() => {
    const result: { x: number; z: number; y: number; color: string; op: number; size: number }[] = [];
    const colors = ['#ff8844', '#ffaa33', '#ffcc66', '#88aaff', '#ffffff', '#ff6633', '#aaccff'];
    
    // More lights, varied clusters
    for (let cluster = 0; cluster < 6; cluster++) {
      const clusterAngle = Math.PI * 0.4 + (cluster / 6) * Math.PI * 0.8;
      const clusterDist = 115 + Math.random() * 25;
      const clusterSize = 5 + Math.random() * 15;
      const lightCount = 8 + Math.floor(Math.random() * 12);
      
      for (let i = 0; i < lightCount; i++) {
        const angle = clusterAngle + (Math.random() - 0.5) * 0.15;
        const dist = clusterDist + (Math.random() - 0.5) * clusterSize;
        result.push({
          x: Math.cos(angle) * dist,
          z: Math.sin(angle) * dist,
          y: 0.3 + Math.random() * 3,
          color: colors[Math.floor(Math.random() * colors.length)],
          op: 0.015 + Math.random() * 0.05,
          size: 0.1 + Math.random() * 0.25,
        });
      }
    }
    return result;
  }, []);

  // Animate twinkling
  const groupRef = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const t = clock.getElapsedTime();
    groupRef.current.children.forEach((child, i) => {
      const mesh = child as THREE.Mesh;
      const mat = mesh.material as THREE.MeshBasicMaterial;
      const baseOp = lights[i]?.op || 0.03;
      mat.opacity = baseOp * (0.6 + Math.sin(t * (1 + i * 0.3) + i * 7) * 0.4);
    });
  });

  return (
    <group ref={groupRef}>
      {lights.map((l, i) => (
        <mesh key={i} position={[l.x, l.y, l.z]}>
          <sphereGeometry args={[l.size, 4, 4]} />
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

// --- Enhanced atmosphere particles: dust, fireflies, and volumetric haze ---
function AtmosphereParticles() {
  const dustRef = useRef<THREE.Points>(null);
  const fogRef = useRef<THREE.Points>(null);
  const fireflyRef = useRef<THREE.Points>(null);
  const dustCount = 500;
  const fogCount = 150;
  const fireflyCount = 60;

  const dustPositions = useMemo(() => {
    const arr = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 150;
      arr[i * 3 + 1] = Math.random() * 60;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 150;
    }
    return arr;
  }, []);

  const fogPositions = useMemo(() => {
    const arr = new Float32Array(fogCount * 3);
    for (let i = 0; i < fogCount; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 120;
      arr[i * 3 + 1] = 0.2 + Math.random() * 3;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 120;
    }
    return arr;
  }, []);

  const fireflyPositions = useMemo(() => {
    const arr = new Float32Array(fireflyCount * 3);
    for (let i = 0; i < fireflyCount; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 60;
      arr[i * 3 + 1] = 0.5 + Math.random() * 4;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 60;
    }
    return arr;
  }, []);

  const fireflyColors = useMemo(() => {
    const arr = new Float32Array(fireflyCount * 3);
    const colors = [
      [0.2, 1.0, 0.3],  // green
      [1.0, 0.8, 0.2],  // warm yellow
      [0.3, 0.8, 1.0],  // cyan
    ];
    for (let i = 0; i < fireflyCount; i++) {
      const c = colors[Math.floor(Math.random() * colors.length)];
      arr[i * 3] = c[0];
      arr[i * 3 + 1] = c[1];
      arr[i * 3 + 2] = c[2];
    }
    return arr;
  }, []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    
    if (dustRef.current) {
      const pos = dustRef.current.geometry.attributes.position;
      for (let i = 0; i < dustCount; i++) {
        const ix = i * 3;
        (pos.array as Float32Array)[ix] += Math.sin(t * 0.02 + i * 0.15) * 0.004;
        (pos.array as Float32Array)[ix + 1] += Math.cos(t * 0.015 + i * 0.1) * 0.0015;
        (pos.array as Float32Array)[ix + 2] += Math.sin(t * 0.018 + i * 0.25) * 0.003;
      }
      pos.needsUpdate = true;
    }
    
    if (fogRef.current) {
      const fp = fogRef.current.geometry.attributes.position;
      for (let i = 0; i < fogCount; i++) {
        const ix = i * 3;
        (fp.array as Float32Array)[ix] += Math.sin(t * 0.008 + i * 0.5) * 0.01;
        (fp.array as Float32Array)[ix + 2] += Math.cos(t * 0.006 + i * 0.4) * 0.008;
      }
      fp.needsUpdate = true;
    }

    if (fireflyRef.current) {
      const fp = fireflyRef.current.geometry.attributes.position;
      const mat = fireflyRef.current.material as THREE.PointsMaterial;
      for (let i = 0; i < fireflyCount; i++) {
        const ix = i * 3;
        (fp.array as Float32Array)[ix] += Math.sin(t * 0.3 + i * 2.0) * 0.008;
        (fp.array as Float32Array)[ix + 1] += Math.cos(t * 0.4 + i * 1.5) * 0.005;
        (fp.array as Float32Array)[ix + 2] += Math.sin(t * 0.25 + i * 1.8) * 0.007;
      }
      fp.needsUpdate = true;
      // Pulse opacity
      mat.opacity = 0.3 + Math.sin(t * 2) * 0.15;
    }
  });

  return (
    <group>
      {/* Atmospheric dust */}
      <points ref={dustRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[dustPositions, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.05} color="#2040a0" transparent opacity={0.1} depthWrite={false} blending={THREE.AdditiveBlending} sizeAttenuation />
      </points>
      {/* Low fog particles */}
      <points ref={fogRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[fogPositions, 3]} />
        </bufferGeometry>
        <pointsMaterial size={2.5} color="#0c1828" transparent opacity={0.05} depthWrite={false} blending={THREE.AdditiveBlending} sizeAttenuation />
      </points>
      {/* Fireflies */}
      <points ref={fireflyRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[fireflyPositions, 3]} />
          <bufferAttribute attach="attributes-color" args={[fireflyColors, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.12} vertexColors transparent opacity={0.3} depthWrite={false} blending={THREE.AdditiveBlending} sizeAttenuation />
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
    <div className="w-full h-full relative bg-[#020208]" data-sky-canvas style={{ cursor: cursorStyle }}>
      <WebGLErrorBoundary>
      <Canvas 
        shadows="soft" 
        gl={{ 
          antialias: true, 
          toneMapping: THREE.ACESFilmicToneMapping, 
          toneMappingExposure: 0.55,
          powerPreference: 'high-performance',
          alpha: false,
          stencil: false,
        }}
        dpr={[1, 2]}
      >
        <PerspectiveCamera makeDefault position={preset.position} fov={50} near={0.3} far={600} />
        <CameraController targetPosition={[...preset.position]} targetLookAt={[...preset.target]} />
        
        {/* UE5-style night lighting setup */}
        <ambientLight intensity={0.015} color="#0a1225" />
        <directionalLight 
          position={[60, 65, -80]} 
          intensity={0.08} 
          color="#8899bb" 
          castShadow 
          shadow-mapSize={[2048, 2048]} 
          shadow-camera-far={250}
          shadow-camera-left={-50}
          shadow-camera-right={50}
          shadow-camera-top={50}
          shadow-camera-bottom={-50}
          shadow-bias={-0.0001}
        />
        <hemisphereLight args={['#080e28', '#020406', 0.03]} />
        {/* Subtle rim light from behind */}
        <directionalLight position={[-30, 20, -40]} intensity={0.02} color="#334466" />
        {/* Cool fill light */}
        <pointLight position={[0, 15, 30]} color="#0a1530" intensity={0.03} distance={80} />
        
        <SkyGradient />
        <Moon />
        <Stars radius={190} depth={100} count={8000} factor={4.5} saturation={0.2} fade speed={0.15} />
        <AtmosphereParticles />
        <fog attach="fog" args={['#040810', 50, 200]} />
        
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
