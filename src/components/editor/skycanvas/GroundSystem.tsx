/**
 * GroundSystem — All ground/terrain components extracted from SkyCanvas.
 * Moon, SatelliteOverlay, GrassGround, AtmosphericParticles, FloorLogo,
 * GroundFog, FinaleDarkGround, ConcreteGround, SFXStageEnvironment,
 * InstancedTrussBars, InstancedMovingHeadBodies, InstancedSFXMarkers,
 * StageGround, TreelineSilhouette.
 */
import { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Grid } from '@react-three/drei';
import * as THREE from 'three';
import { useSceneStore } from '@/store/useSceneStore';
import { createVolumetricFogPlane } from '@/render_ultra/environment/volumetricFog';
import CrowdSystem from './CrowdSystem';
import StageFlameJets from './StageFlameJets';

// ═══════════════════════════════════════════════════════════════════════
// Moon
// ═══════════════════════════════════════════════════════════════════════
export function Moon() {
  return (
    <group position={[7500, 14000, -12500]}>
      <mesh>
        <sphereGeometry args={[450, 32, 32]} />
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
              
              vec3 moonBase = vec3(0.85, 0.82, 0.75);
              
              float craters = noise(vPosition.xy * 0.9) * 0.3 + 
                              noise(vPosition.xz * 1.5) * 0.2 +
                              noise(vPosition.yz * 2.4) * 0.1;
              
              float maria = smoothstep(0.4, 0.6, noise(vPosition.xz * 0.45 + 10.0));
              moonBase = mix(moonBase, vec3(0.55, 0.52, 0.48), maria * 0.3);
              
              float diffuse = max(dot(n, lightDir), 0.0) * 0.6 + 0.4;
              float rim = pow(1.0 - max(dot(n, vec3(0, 0, 1)), 0.0), 3.0);
              
              vec3 color = moonBase * (1.0 - craters * 0.2) * diffuse;
              color += vec3(0.15, 0.18, 0.25) * rim * 0.3;
              
              gl_FragColor = vec4(color, 1.0);
            }
          `}
        />
      </mesh>
      <mesh>
        <sphereGeometry args={[800, 16, 16]} />
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
              gl_FragColor = vec4(color, intensity * 0.12);
            }
          `}
        />
      </mesh>
      <pointLight color="#8899bb" intensity={0.15} distance={30000} decay={1} />
    </group>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// SatelliteOverlay
// ═══════════════════════════════════════════════════════════════════════
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

// ═══════════════════════════════════════════════════════════════════════
// GrassGround — Google Earth-style satellite terrain
// ═══════════════════════════════════════════════════════════════════════
const TERRAIN_VERTEX = `
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

const UNIFIED_TERRAIN_FRAGMENT = `
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
  float voronoi(vec2 p) {
    vec2 n = floor(p); vec2 f = fract(p);
    float md = 1.0;
    for (int j = -1; j <= 1; j++)
      for (int i = -1; i <= 1; i++) {
        vec2 g = vec2(float(i), float(j));
        vec2 o = vec2(hash(n + g), hash(n + g + 37.0));
        vec2 r = g + o - f;
        md = min(md, dot(r, r));
      }
    return sqrt(md);
  }

  void main() {
    vec2 worldUV = vWorldPos.xz;
    float distFromCenter = length(worldUV);
    
    float lodBlend = smoothstep(10000.0, 30000.0, distFromCenter);
    
    // === NEAR FIELD ===
    float largN = fbm(worldUV * 0.03);
    float fineN = noise(worldUV * 5.0);
    vec3 grassA = vec3(0.06, 0.16, 0.04);
    vec3 grassB = vec3(0.10, 0.22, 0.06);
    vec3 nearColor = mix(grassA, grassB, smoothstep(0.3, 0.7, largN));
    nearColor += vec3(0.01, 0.025, 0.005) * fineN * 0.2;
    float stripes = sin(worldUV.x * 1.5) * 0.5 + 0.5;
    float crossStripes = sin(worldUV.y * 1.5 + 0.785) * 0.5 + 0.5;
    nearColor = mix(nearColor, nearColor * 1.1, stripes * crossStripes * 0.12);
    
    // === FAR FIELD ===
    float large = fbm(worldUV * 0.005);
    float medium = fbm(worldUV * 0.015 + 100.0);
    float fine = noise(worldUV * 0.08);
    float parcels = voronoi(worldUV * 0.008);
    float roads = voronoi(worldUV * 0.003);
    
    vec3 darkForest  = vec3(0.04, 0.07, 0.02);
    vec3 forest      = vec3(0.06, 0.11, 0.04);
    vec3 farmGreen   = vec3(0.08, 0.14, 0.05);
    vec3 fieldGreen  = vec3(0.12, 0.18, 0.06);
    vec3 dryField    = vec3(0.18, 0.17, 0.08);
    vec3 brownEarth  = vec3(0.14, 0.10, 0.05);
    vec3 roadGrey    = vec3(0.12, 0.11, 0.10);
    vec3 urbanGrey   = vec3(0.10, 0.09, 0.08);
    
    vec3 farColor = mix(darkForest, forest, smoothstep(0.3, 0.6, large));
    farColor = mix(farColor, farmGreen, smoothstep(0.4, 0.65, medium) * 0.7);
    farColor = mix(farColor, fieldGreen, smoothstep(0.5, 0.75, fine) * 0.5);
    float parcelEdge = smoothstep(0.05, 0.08, parcels);
    vec3 parcelColor = mix(dryField, farmGreen, step(0.5, hash(floor(worldUV * 0.04))));
    parcelColor = mix(parcelColor, fieldGreen, step(0.7, hash(floor(worldUV * 0.04) + 10.0)));
    farColor = mix(brownEarth * 0.8, mix(farColor, parcelColor, 0.4), parcelEdge);
    float roadMask = smoothstep(0.02, 0.04, roads);
    farColor = mix(roadGrey, farColor, roadMask);
    float urbanMask = smoothstep(0.7, 0.85, fbm(worldUV * 0.02 + 300.0));
    farColor = mix(farColor, urbanGrey, urbanMask * 0.3);
    float windWave = sin(worldUV.x * 0.3 + time * 0.4) * cos(worldUV.y * 0.2 + time * 0.3);
    farColor += vec3(0.008, 0.015, 0.004) * windWave * 0.3 * (1.0 - urbanMask);
    
    // === BLEND ===
    vec3 color = mix(nearColor, farColor, lodBlend);
    
    float NdotL = max(dot(vNormal, moonDir), 0.0);
    float subsurface = max(dot(-vNormal, moonDir), 0.0) * 0.04;
    color *= (NdotL * 0.55 + subsurface + 0.22);
    
    vec3 halfDir = normalize(moonDir + vViewDir);
    float spec = pow(max(dot(vNormal, halfDir), 0.0), 26.0);
    float wetness = smoothstep(0.6, 0.8, fineN) * (1.0 - lodBlend);
    color += vec3(0.03, 0.05, 0.08) * spec * (0.3 + wetness * 0.2);
    
    float dist = distFromCenter * 0.00006;
    float fogFactor = smoothstep(0.0, 1.0, dist);
    vec3 atmosphereColor = vec3(0.003, 0.004, 0.008);
    color = mix(color, atmosphereColor, fogFactor);
    color *= 1.0 - fogFactor * 0.5;
    
    gl_FragColor = vec4(color, 1.0);
  }
`;

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

  return (
    <mesh position={[0, -0.05, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[10000, 10000, 1, 1]} />
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={TERRAIN_VERTEX}
        fragmentShader={UNIFIED_TERRAIN_FRAGMENT}
        polygonOffset
        polygonOffsetFactor={1}
        polygonOffsetUnits={1}
      />
    </mesh>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// AtmosphericParticles
// ═══════════════════════════════════════════════════════════════════════
export function AtmosphericParticles() {
  const pointsRef = useRef<THREE.Points>(null);
  const count = 100;
  
  const { positions: posData, sizes, velocities: velData } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const sz = new Float32Array(count);
    const vel = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 20000;
      pos[i * 3 + 1] = Math.random() * 60 + 0.5;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 20000;
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
      const dx = arr[i * 3] - camX, dz = arr[i * 3 + 2] - camZ;
      if (dx * dx + dz * dz > 100000000) {
        arr[i * 3] = camX + (Math.random() - 0.5) * 20000;
        arr[i * 3 + 2] = camZ + (Math.random() - 0.5) * 20000;
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
        opacity={0.08}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        sizeAttenuation
      />
    </points>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// FloorLogo
// ═══════════════════════════════════════════════════════════════════════
function FloorLogo() {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, 2048, 512);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 180px "Outfit", Arial, sans-serif';
    ctx.fillStyle = 'rgba(180, 195, 210, 0.12)';
    ctx.fillText('MINAS', 800, 190);

    ctx.font = 'bold 180px "Outfit", Arial, sans-serif';
    ctx.fillStyle = 'rgba(0, 229, 255, 0.15)';
    ctx.fillText('FX', 1550, 190);

    ctx.font = '500 45px "Outfit", Arial, sans-serif';
    ctx.fillStyle = 'rgba(0, 229, 255, 0.08)';
    ctx.fillText('SPECIAL FX SOLUTIONS', 1024, 340);

    ctx.strokeStyle = 'rgba(255, 107, 0, 0.10)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(200, 400);
    ctx.quadraticCurveTo(1024, 370, 1848, 400);
    ctx.stroke();

    const tex = new THREE.CanvasTexture(canvas);
    tex.generateMipmaps = false;
    tex.minFilter = THREE.LinearFilter;
    return tex;
  }, []);

  return (
    <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[1000, 250]} />
      <meshBasicMaterial
        map={texture}
        transparent
        opacity={0.15}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// GroundFog — render_ultra volumetric FBM 4-octave noise
// ═══════════════════════════════════════════════════════════════════════
function GroundFog() {
  const fogRef = useRef<THREE.Group>(null);
  const fogIntensity = useSceneStore(st => st.settings.groundFogIntensity);

  const fogSystem = useMemo(() => {
    const sys = createVolumetricFogPlane(
      10000,
      new THREE.Color(0.03, 0.04, 0.08),
      0.4
    );
    return sys;
  }, []);

  useEffect(() => {
    fogSystem.setIntensity(fogIntensity);
  }, [fogIntensity, fogSystem]);

  useFrame(({ clock }) => {
    fogSystem.update(clock.getElapsedTime());
  });

  return (
    <group ref={fogRef}>
      <primitive object={fogSystem.mesh} />
    </group>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// FinaleDarkGround
// ═══════════════════════════════════════════════════════════════════════
function FinaleDarkGround({ brightness }: { brightness: number }) {
  const b = brightness * 0.4;
  const uniforms = useMemo(() => ({
    time: { value: 0 },
    camPos: { value: new THREE.Vector3() },
  }), []);

  useFrame(({ clock, camera }) => {
    uniforms.time.value = clock.getElapsedTime();
    uniforms.camPos.value.copy(camera.position);
  });

  return (
    <mesh position={[0, -0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[10000, 10000, 1, 1]} />
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={`
          varying vec2 vUv;
          varying vec3 vWorldPos;
          varying vec3 vViewDir;
          uniform vec3 camPos;
          void main() {
            vUv = uv;
            vec4 wp = modelMatrix * vec4(position, 1.0);
            vWorldPos = wp.xyz;
            vViewDir = normalize(camPos - wp.xyz);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          uniform float time;
          varying vec2 vUv;
          varying vec3 vWorldPos;
          varying vec3 vViewDir;
          
          float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
          float noise(vec2 p) {
            vec2 i = floor(p); vec2 f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            return mix(mix(hash(i), hash(i+vec2(1,0)), f.x),
                       mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y);
          }
          float fbm(vec2 p) {
            float v = 0.0; float a = 0.5;
            for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.1; a *= 0.5; }
            return v;
          }
          
          void main() {
            vec2 wuv = vWorldPos.xz;
            float distFromCenter = length(wuv);
            
            float n1 = noise(wuv * 0.02) * 0.5 + noise(wuv * 0.08) * 0.3 + noise(wuv * 0.4) * 0.2;
            float micro = noise(wuv * 2.0) * 0.1;
            float largeFbm = fbm(wuv * 0.003);
            
            float b = ${b.toFixed(3)};
            vec3 darkBase = vec3(0.015 * b, 0.025 * b, 0.015 * b);
            vec3 lighter = vec3(0.035 * b, 0.055 * b, 0.03 * b);
            vec3 color = mix(darkBase, lighter, n1);
            color += micro * vec3(0.01, 0.015, 0.008);
            
            vec3 darkPatch = vec3(0.008 * b, 0.012 * b, 0.008 * b);
            color = mix(color, darkPatch, smoothstep(0.3, 0.7, largeFbm) * 0.4);
            
            float fresnel = pow(1.0 - max(vViewDir.y, 0.0), 4.0);
            color += vec3(0.008, 0.012, 0.02) * fresnel * 0.5;
            
            float nearBlend = 1.0 - smoothstep(0.0, 400.0, distFromCenter);
            float viewAngle = pow(1.0 - max(vViewDir.y, 0.0), 6.0);
            color += vec3(0.015, 0.02, 0.035) * viewAngle * nearBlend * 0.8;
            
            float dist = distFromCenter * 0.00006;
            float fogFactor = smoothstep(0.5, 1.5, dist);
            vec3 atmosphereColor = vec3(0.003 * b, 0.004 * b, 0.008 * b);
            color = mix(color, atmosphereColor, fogFactor);
            color *= 1.0 - fogFactor * 0.5;
            
            gl_FragColor = vec4(color, 1.0);
          }
        `}
      />
    </mesh>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// SyntheticGrassGround — vivid artificial turf
// ═══════════════════════════════════════════════════════════════════════
const SYNTHETIC_GRASS_VERTEX = `
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

const SYNTHETIC_GRASS_FRAGMENT = `
  uniform float time;
  uniform float brightness;
  uniform vec3 camPos;
  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying vec3 vViewDir;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i+vec2(1,0)), f.x),
               mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y);
  }

  float fbm(vec2 p) {
    float v = 0.0; float a = 0.5;
    for (int i = 0; i < 5; i++) {
      v += a * noise(p);
      p = p * 2.03 + vec2(1.7, 3.1);
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec2 wuv = vWorldPos.xz;
    float distFromCenter = length(wuv);

    // Military camo palette
    vec3 darkOlive  = vec3(0.176, 0.227, 0.118);  // #2d3a1e
    vec3 mossGreen  = vec3(0.231, 0.290, 0.165);  // #3b4a2a
    vec3 earthBrown = vec3(0.290, 0.235, 0.157);  // #4a3c28
    vec3 darkKhaki  = vec3(0.353, 0.329, 0.204);  // #5a5434
    vec3 deepGreen  = vec3(0.118, 0.165, 0.082);  // #1e2a15

    // Layered noise for organic camo blotches
    float n1 = fbm(wuv * 0.08);
    float n2 = fbm(wuv * 0.15 + vec2(42.0, 17.0));
    float n3 = fbm(wuv * 0.35 + vec2(-13.0, 88.0));
    float n4 = noise(wuv * 0.5 + vec2(7.0, -23.0));

    // Blend camo layers with irregular transitions
    vec3 color = deepGreen;
    color = mix(color, darkOlive,  smoothstep(0.35, 0.55, n1));
    color = mix(color, mossGreen,  smoothstep(0.40, 0.60, n2));
    color = mix(color, earthBrown, smoothstep(0.50, 0.65, n3));
    color = mix(color, darkKhaki,  smoothstep(0.55, 0.70, n4) * 0.5);

    // Fiber micro-noise for ground texture realism
    float micro = noise(wuv * 60.0) * 0.4 + noise(wuv * 120.0) * 0.3 + noise(wuv * 200.0) * 0.2;
    color += vec3(0.008, 0.012, 0.005) * (micro - 0.4);

    // Apply brightness
    color *= brightness;

    // Simple directional lighting (military matte)
    vec3 lightDir = normalize(vec3(0.3, 0.8, 0.5));
    float NdotL = max(dot(vNormal, lightDir), 0.0);
    color *= (NdotL * 0.4 + 0.6);

    // Muted specular (matte finish, not shiny)
    vec3 halfDir = normalize(lightDir + vViewDir);
    float spec = pow(max(dot(vNormal, halfDir), 0.0), 40.0);
    color += vec3(0.008, 0.012, 0.006) * spec;

    // Distance fade to horizon
    float dist = distFromCenter * 0.00004;
    float fogFactor = smoothstep(0.0, 1.0, dist);
    vec3 horizonColor = vec3(0.04, 0.05, 0.03);
    color = mix(color, horizonColor, fogFactor);

    gl_FragColor = vec4(color, 1.0);
  }
`;

function SyntheticGrassGround({ brightness }: { brightness: number }) {
  const uniforms = useMemo(() => ({
    time: { value: 0 },
    brightness: { value: brightness },
    camPos: { value: new THREE.Vector3() },
  }), []);

  useEffect(() => {
    uniforms.brightness.value = brightness;
  }, [brightness]);

  useFrame(({ clock, camera }) => {
    uniforms.time.value = clock.getElapsedTime();
    uniforms.camPos.value.copy(camera.position);
  });

  return (
    <mesh position={[0, -0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[10000, 10000, 1, 1]} />
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={SYNTHETIC_GRASS_VERTEX}
        fragmentShader={SYNTHETIC_GRASS_FRAGMENT}
      />
    </mesh>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// ConcreteGround
// ═══════════════════════════════════════════════════════════════════════
function ConcreteGround({ brightness }: { brightness: number }) {
  const b = brightness * 0.5;
  const groundColor = useMemo(() => new THREE.Color(0.07 * b, 0.07 * b, 0.075 * b), [b]);
  return (
    <mesh position={[0, -0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[10000, 10000]} />
      <meshStandardMaterial
        color={groundColor}
        roughness={0.92}
        metalness={0.12}
      />
    </mesh>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Instanced SFX Stage helpers
// ═══════════════════════════════════════════════════════════════════════
function InstancedTrussBars({ trussColor }: { trussColor: string }) {
  const stageW = 40, stageD = 20, stageHeight = 1.2, trussH = 12;
  const riggingY = stageHeight + trussH;

  const barData = useMemo(() => {
    const bars: { pos: [number, number, number]; scale: [number, number, number]; rot?: [number, number, number] }[] = [];
    bars.push({ pos: [0, riggingY, -stageD / 2 + 2], scale: [stageW - 2, 0.3, 0.3] });
    bars.push({ pos: [0, riggingY, stageD / 2 - 2], scale: [stageW - 2, 0.3, 0.3] });
    bars.push({ pos: [0, riggingY, 0], scale: [stageW - 2, 0.25, 0.25] });
    bars.push({ pos: [-(stageW / 2 - 2), riggingY, 0], scale: [0.3, 0.3, stageD - 2] });
    bars.push({ pos: [stageW / 2 - 2, riggingY, 0], scale: [0.3, 0.3, stageD - 2] });
    for (const i of [-3, -1, 1, 3]) {
      bars.push({ pos: [i * 5, riggingY, -stageD / 2 + 2], scale: [0.1, 1, 0.1], rot: [0, 0, Math.PI / 4] });
      bars.push({ pos: [i * 5, riggingY, stageD / 2 - 2], scale: [0.1, 1, 0.1], rot: [0, 0, -Math.PI / 4] });
    }
    for (const [sx, sz] of [[-1, -1], [-1, 1], [1, -1], [1, 1], [0, -1], [0, 1]]) {
      bars.push({ pos: [sx * (stageW / 2 - 2), stageHeight + trussH / 2, sz * (stageD / 2 - 2)], scale: [0.2, trussH, 0.2] });
    }
    bars.push({ pos: [0, stageHeight + trussH * 0.6, -stageD / 2 - 1.5], scale: [stageW + 2, 0.15, 1.5] });
    bars.push({ pos: [0, stageHeight + trussH * 0.6 + 0.5, -stageD / 2 - 2.2], scale: [stageW + 2, 0.06, 0.06] });
    return bars;
  }, []);

  const instancedRef = useRef<THREE.InstancedMesh>(null);
  const count = barData.length;

  useEffect(() => {
    if (!instancedRef.current) return;
    const dummy = new THREE.Object3D();
    barData.forEach((b, i) => {
      dummy.position.set(...b.pos);
      dummy.scale.set(...b.scale);
      if (b.rot) dummy.rotation.set(...b.rot);
      else dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      instancedRef.current!.setMatrixAt(i, dummy.matrix);
    });
    instancedRef.current.instanceMatrix.needsUpdate = true;
  }, [barData]);

  return (
    <instancedMesh ref={instancedRef} args={[undefined, undefined, count]} frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color={trussColor} metalness={0.8} roughness={0.3} />
    </instancedMesh>
  );
}

function InstancedMovingHeadBodies({ positions }: { positions: [number, number, number][] }) {
  const bodyRef = useRef<THREE.InstancedMesh>(null);
  const yokeRef = useRef<THREE.InstancedMesh>(null);

  useEffect(() => {
    const dummy = new THREE.Object3D();
    positions.forEach((pos, i) => {
      dummy.position.set(...pos);
      dummy.scale.set(1, 1, 1);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      bodyRef.current?.setMatrixAt(i, dummy.matrix);
      dummy.position.set(pos[0], pos[1] + 0.25, pos[2]);
      dummy.updateMatrix();
      yokeRef.current?.setMatrixAt(i, dummy.matrix);
    });
    if (bodyRef.current) bodyRef.current.instanceMatrix.needsUpdate = true;
    if (yokeRef.current) yokeRef.current.instanceMatrix.needsUpdate = true;
  }, [positions]);

  const count = positions.length;
  return (
    <>
      <instancedMesh ref={bodyRef} args={[undefined, undefined, count]} frustumCulled={false}>
        <cylinderGeometry args={[0.2, 0.15, 0.4, 8]} />
        <meshStandardMaterial color="#111111" metalness={0.9} roughness={0.2} />
      </instancedMesh>
      <instancedMesh ref={yokeRef} args={[undefined, undefined, count]} frustumCulled={false}>
        <boxGeometry args={[0.35, 0.08, 0.08]} />
        <meshStandardMaterial color="#0f0f0f" metalness={0.8} roughness={0.3} />
      </instancedMesh>
    </>
  );
}

function InstancedSFXMarkers({ stageW, stageD, stageHeight }: { stageW: number; stageD: number; stageHeight: number }) {
  const ringRef = useRef<THREE.InstancedMesh>(null);

  const markerPositions = useMemo(() => {
    const markers: [number, number, number][] = [];
    for (const x of [-4, -2, 0, 2, 4]) markers.push([x * 3, stageHeight + 0.01, -stageD / 2 + 1]);
    for (const side of [-1, 1]) for (const idx of [0, 1]) markers.push([side * (stageW / 2 - 2), stageHeight + 0.01, -3 + idx * 6]);
    for (const x of [-1, 0, 1]) markers.push([x * 8, stageHeight + 0.01, stageD / 2 - 1.5]);
    return markers;
  }, [stageW, stageD, stageHeight]);

  useEffect(() => {
    if (!ringRef.current) return;
    const dummy = new THREE.Object3D();
    markerPositions.forEach((pos, i) => {
      dummy.position.set(...pos);
      dummy.rotation.set(-Math.PI / 2, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      ringRef.current!.setMatrixAt(i, dummy.matrix);
    });
    ringRef.current.instanceMatrix.needsUpdate = true;
  }, [markerPositions]);

  return (
    <instancedMesh ref={ringRef} args={[undefined, undefined, markerPositions.length]} frustumCulled={false}>
      <ringGeometry args={[0.3, 0.5, 16]} />
      <meshBasicMaterial color="#ff6600" transparent opacity={0.4} side={THREE.DoubleSide} />
    </instancedMesh>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// SFXStageEnvironment
// ═══════════════════════════════════════════════════════════════════════
function SFXStageEnvironment() {
  const timeRef = useRef(0);
  const lightsRef = useRef<THREE.Group>(null);
  const ledWallRef = useRef<THREE.Mesh>(null);
  const ledSideRefs = useRef<(THREE.Mesh | null)[]>([]);
  const orbRefs = useRef<(THREE.Group | null)[]>([]);
  const dmxPointLightRefs = useRef<(THREE.PointLight | null)[]>([]);

  const orbBaseY = 1.2 + 4;

  useFrame((_, delta) => {
    timeRef.current += delta;
    const t = timeRef.current;
    if (lightsRef.current) {
      lightsRef.current.children.forEach((child, i) => {
        if (child.userData.isMovingHead) {
          const phase = t * 0.3 + i * 1.2;
          child.rotation.x = Math.sin(phase) * 0.4 - 0.6;
          child.rotation.z = Math.cos(phase * 0.7 + i) * 0.3;
        }
      });
    }
    if (ledWallRef.current) {
      const mat = ledWallRef.current.material as THREE.MeshBasicMaterial;
      const hue = (t * 0.02) % 1;
      mat.color.setHSL(hue, 0.8, 0.08);
    }
    ledSideRefs.current.forEach((mesh, i) => {
      if (mesh) {
        const mat = mesh.material as THREE.MeshBasicMaterial;
        const hue = ((t * 0.02) + 0.3 + i * 0.15) % 1;
        mat.color.setHSL(hue, 0.7, 0.06);
      }
    });
    orbRefs.current.forEach((orb, i) => {
      if (orb) orb.position.y = orbBaseY + Math.sin(t * 0.8 + i * 2.1) * 0.5;
    });
    // DMX Point Lights removed — no longer animated
  });

  const trussColor = '#1a1a1a';
  const stageHeight = 1.2;
  const stageW = 40;
  const stageD = 20;
  const trussH = 12;
  const riggingY = stageHeight + trussH;

  const mhPositions = useMemo(() => {
    const positions: [number, number, number][] = [];
    for (let i = -4; i <= 4; i++) positions.push([i * 4, riggingY - 0.3, -stageD / 2 + 2]);
    for (let i = 0; i < 3; i++) {
      positions.push([stageW / 2 - 1, riggingY - 0.3, -stageD / 2 + 4 + i * 5]);
      positions.push([-stageW / 2 + 1, riggingY - 0.3, -stageD / 2 + 4 + i * 5]);
    }
    for (let i = -2; i <= 2; i++) positions.push([i * 5, riggingY - 0.3, stageD / 2 - 2]);
    return positions;
  }, [riggingY]);

  const beamColors = useMemo(() => [
    '#8800ff', '#cc00ff', '#4400cc', '#ff00aa', '#6600ff',
    '#aa00ff', '#5500dd', '#dd00cc', '#7700ee',
    '#9900ff', '#bb00dd', '#5500cc', '#dd00aa', '#6600ee', '#aa00cc',
    '#7700ff', '#ee00bb', '#5500aa', '#cc00dd', '#8800ee',
  ], []);

  return (
    <group>
      <mesh position={[0, stageHeight / 2, 0]} receiveShadow>
        <boxGeometry args={[stageW, stageHeight, stageD]} />
        <meshStandardMaterial color="#0a0a0f" roughness={0.15} metalness={0.6} />
      </mesh>
      <mesh position={[0, stageHeight + 0.01, -stageD / 2 + 0.15]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[stageW - 2, 0.12]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.15} />
      </mesh>

      <mesh position={[0, -0.02, stageD / 2 + 25]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[80, 50]} />
        <meshStandardMaterial color="#060608" roughness={0.8} metalness={0.1} />
      </mesh>

      <mesh ref={ledWallRef} position={[0, trussH / 2 + stageHeight, -stageD / 2 - 0.3]}>
        <boxGeometry args={[stageW - 2, trussH, 0.3]} />
        <meshStandardMaterial color="#110022" emissive="#110022" emissiveIntensity={0.4} />
      </mesh>
      <mesh position={[0, trussH / 2 + stageHeight, -stageD / 2 - 0.5]}>
        <boxGeometry args={[stageW + 2, trussH + 1.5, 0.15]} />
        <meshStandardMaterial color="#080808" metalness={0.9} roughness={0.2} />
      </mesh>

      {[-1, 1].map((side, idx) => (
        <group key={`led-side-${side}`}>
          <mesh
            ref={el => { ledSideRefs.current[idx] = el; }}
            position={[side * (stageW / 2 + 0.3), trussH / 2 + stageHeight, -2]}
            rotation={[0, side * -Math.PI / 2, 0]}
          >
            <boxGeometry args={[stageD - 6, trussH - 2, 0.2]} />
            <meshBasicMaterial color="#0a0018" />
          </mesh>
          <mesh position={[side * (stageW / 2 + 0.5), trussH / 2 + stageHeight, 0]}>
            <boxGeometry args={[0.6, trussH + 2, stageD + 10]} />
            <meshStandardMaterial color="#050508" roughness={0.9} metalness={0.05} />
          </mesh>
        </group>
      ))}

      <mesh position={[0, riggingY + 2, 0]}>
        <boxGeometry args={[stageW + 6, 0.5, stageD + 14]} />
        <meshStandardMaterial color="#040406" roughness={0.95} metalness={0.05} />
      </mesh>

      <InstancedTrussBars trussColor={trussColor} />
      <InstancedMovingHeadBodies positions={mhPositions} />

      {[-2, 0, 2].map((x, i) => (
        <group key={`laser-mount-${i}`} position={[x * 6, riggingY - 0.5, 0]}>
          <mesh>
            <boxGeometry args={[0.4, 0.4, 0.4]} />
            <meshStandardMaterial color="#222222" metalness={0.9} roughness={0.15} />
          </mesh>
          <mesh position={[0, -0.25, 0]}>
            <sphereGeometry args={[0.06, 8, 8]} />
            <meshBasicMaterial color="#00ff44" />
          </mesh>
          {/* Removed pointLight — emissive glow is sufficient */}
        </group>
      ))}

      {[-1, 1].map((side, i) => (
        <group key={`fog-${i}`} position={[side * (stageW / 2 - 3), stageHeight + 0.3, stageD / 2 - 3]}>
          <mesh>
            <boxGeometry args={[0.8, 0.5, 0.5]} />
            <meshStandardMaterial color="#1a1a1a" metalness={0.6} roughness={0.4} />
          </mesh>
          <mesh position={[0, 0.3, -0.15]}>
            <cylinderGeometry args={[0.08, 0.12, 0.15, 8]} />
            <meshStandardMaterial color="#333333" metalness={0.8} roughness={0.2} />
          </mesh>
          <mesh position={[0.25, 0.1, 0.26]}>
            <sphereGeometry args={[0.04, 6, 6]} />
            <meshBasicMaterial color="#00aaff" />
          </mesh>
        </group>
      ))}

      <group ref={lightsRef}>
        {mhPositions.map((pos, i) => {
          const beamColor = beamColors[i % beamColors.length];
          return (
            <group key={`mh-beam-${i}`} position={pos} userData={{ isMovingHead: true }}>
              {/* Lens glow sphere */}
              <mesh position={[0, -0.18, 0]}>
                <sphereGeometry args={[0.1, 12, 12]} />
                <meshBasicMaterial color={beamColor} transparent opacity={0.95} />
              </mesh>
              <mesh position={[0, -0.22, 0]}>
                <circleGeometry args={[0.14, 16]} />
                <meshBasicMaterial color={beamColor} transparent opacity={0.9} />
              </mesh>
              {/* Outer beam cone — volumetric spread */}
              <mesh position={[0, -5, 0]}>
                <coneGeometry args={[3.0, 10, 16, 1, true]} />
                <meshBasicMaterial color={beamColor} transparent opacity={0.06} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} />
              </mesh>
              {/* Inner beam core — tight hot center */}
              <mesh position={[0, -4.5, 0]}>
                <coneGeometry args={[0.8, 9, 12, 1, true]} />
                <meshBasicMaterial color={beamColor} transparent opacity={0.12} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} />
              </mesh>
              {/* Removed per-beam pointLight — emissive cones provide visual effect without GPU cost */}
            </group>
          );
        })}
      </group>

      <InstancedSFXMarkers stageW={stageW} stageD={stageD} stageHeight={stageHeight} />

      {/* ═══ Floating Orb Props — BP_Sphere/M_Orb reference ═══ */}
      {[-8, 0, 8].map((x, i) => (
        <group key={`orb-${i}`} ref={el => { orbRefs.current[i] = el; }} position={[x, stageHeight + 4 + Math.sin(i * 1.5) * 0.3, 2]}>
          <mesh>
            <sphereGeometry args={[0.8, 24, 24]} />
            <meshStandardMaterial
              color="#110033"
              emissive="#4400ff"
              emissiveIntensity={1.5}
              metalness={0.95}
              roughness={0.05}
            />
          </mesh>
          <mesh>
            <sphereGeometry args={[1.2, 16, 16]} />
            <meshBasicMaterial color="#4400ff" transparent opacity={0.08} blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>
          {/* Removed orb pointLight — emissive material provides visual glow */}
        </group>
      ))}

      {/* ═══ Pyro Pot Fixtures — BP_Pyro_v4 reference ═══ */}
      {[-16, -8, 0, 8, 16].map((x, i) => (
        <group key={`pyro-pot-${i}`} position={[x, stageHeight + 0.1, stageD / 2 - 0.5]}>
          <mesh>
            <cylinderGeometry args={[0.15, 0.2, 0.35, 8]} />
            <meshStandardMaterial color="#1a1a1a" metalness={0.85} roughness={0.2} />
          </mesh>
          <mesh position={[0.08, 0.12, 0.08]}>
            <sphereGeometry args={[0.03, 6, 6]} />
            <meshBasicMaterial color="#ff2200" />
          </mesh>
          <mesh position={[0, 0.2, 0]}>
            <cylinderGeometry args={[0.04, 0.06, 0.08, 6]} />
            <meshStandardMaterial color="#333333" metalness={0.9} roughness={0.15} />
          </mesh>
        </group>
      ))}

      {/* ═══ DMX Control Rack — DMXSetter reference ═══ */}
      <group position={[stageW / 2 - 4, stageHeight + 0.9, -stageD / 2 - 2]}>
        <mesh>
          <boxGeometry args={[0.6, 1.8, 0.5]} />
          <meshStandardMaterial color="#0a0a0a" metalness={0.9} roughness={0.15} />
        </mesh>
        {[0.5, 0.2, -0.1, -0.4].map((y, i) => (
          <mesh key={`dmx-led-${i}`} position={[0.31, y, 0]}>
            <sphereGeometry args={[0.02, 6, 6]} />
            <meshBasicMaterial color={i === 0 ? '#00ff44' : '#00cc33'} />
          </mesh>
        ))}
        <mesh>
          <boxGeometry args={[0.65, 1.85, 0.55]} />
          <meshBasicMaterial color="#0044aa" transparent opacity={0.04} wireframe />
        </mesh>
      </group>

      {/* ═══ DMX Fixtures — emissive only, no pointLights ═══ */}
      {[
        [-(stageW / 2 - 2), riggingY - 0.5, -(stageD / 2 - 2)],
        [stageW / 2 - 2, riggingY - 0.5, -(stageD / 2 - 2)],
        [-(stageW / 2 - 2), riggingY - 0.5, stageD / 2 - 2],
        [stageW / 2 - 2, riggingY - 0.5, stageD / 2 - 2],
      ].map((pos, i) => (
        <group key={`dmx-pl-${i}`} position={pos as [number, number, number]}>
          <mesh>
            <sphereGeometry args={[0.12, 12, 12]} />
            <meshStandardMaterial
              color="#222222"
              emissive="#ffffff"
              emissiveIntensity={0.6}
              metalness={0.9}
              roughness={Math.max(0.02, 0.1)}
            />
          </mesh>
        </group>
      ))}

      {/* Atmospheric haze volume — makes beams visible like UE5 */}
      <mesh position={[0, riggingY / 2 + stageHeight, 0]}>
        <boxGeometry args={[stageW + 10, riggingY + 4, stageD + 20]} />
        <meshBasicMaterial color="#220033" transparent opacity={0.015} side={THREE.BackSide} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>

      {/* Capped lighting: 1 ambient + 1 directional + 3 key pointLights = 5 total */}
      <ambientLight color="#1a0028" intensity={0.25} />
      <directionalLight position={[0, 10, 15]} color="#220044" intensity={0.5} />
      <pointLight position={[0, riggingY, 0]} color="#4400aa" intensity={3.0} distance={60} decay={2} />
      <pointLight position={[-stageW / 3, 6, 0]} color="#220044" intensity={1.2} distance={40} decay={2} />
      <pointLight position={[stageW / 3, 6, 0]} color="#220044" intensity={1.2} distance={40} decay={2} />

      <mesh position={[0, -0.03, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[10000, 10000]} />
        <meshStandardMaterial color="#030305" roughness={0.95} metalness={0} />
      </mesh>

      {/* Procedural audience — FOH area */}
      <CrowdSystem />

      {/* Stylized flame jets — BP_FountainLight / NS_Stylized_Fire reference */}
      <StageFlameJets />
    </group>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// TreelineSilhouette
// ═══════════════════════════════════════════════════════════════════════
function TreelineSilhouette() {
  const instancedRef = useRef<THREE.InstancedMesh>(null);
  
  const { treeData, totalCount } = useMemo(() => {
    const result: { x: number; z: number; h: number; w: number; layer: number }[] = [];
    for (let layer = 0; layer < 6; layer++) {
      const count = 120 - layer * 15;
      const baseDist = 4000 + layer * 1500;
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + layer * 0.05;
        const dist = baseDist + Math.random() * 300;
        result.push({
          x: Math.cos(angle) * dist,
          z: Math.sin(angle) * dist,
          h: 30 + Math.random() * 110 + layer * 25,
          w: 25 + Math.random() * 50,
          layer,
        });
      }
    }
    return { treeData: result, totalCount: result.length };
  }, []);

  useEffect(() => {
    if (!instancedRef.current) return;
    const mesh = instancedRef.current;
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    
    for (let i = 0; i < totalCount; i++) {
      const t = treeData[i];
      dummy.position.set(t.x, t.h * 0.5, t.z);
      dummy.rotation.set(0, Math.atan2(t.x, t.z), 0);
      dummy.scale.set(t.w, t.h, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      
      const brightness = 0.03 + t.layer * 0.015;
      color.setRGB(brightness, brightness + 0.02, brightness);
      mesh.setColorAt(i, color);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [treeData, totalCount]);

  return (
    <instancedMesh ref={instancedRef} args={[undefined, undefined, totalCount]} frustumCulled={false}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial transparent opacity={0.75} side={THREE.DoubleSide} vertexColors />
    </instancedMesh>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// StageGround — main ground switcher component
// ═══════════════════════════════════════════════════════════════════════
export function StageGround({ satelliteTexture }: { satelliteTexture: string | null }) {
  const sc = useSceneStore(st => st.settings);

  const renderGround = () => {
    switch (sc.groundStyle) {
      case 'flat-black':
        return (
      <mesh position={[0, -0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[100000, 100000]} />
            <meshStandardMaterial color="#050505" roughness={0.95} metalness={0} />
          </mesh>
        );
      case 'concrete':
        return <ConcreteGround brightness={sc.groundBrightness} />;
      case 'finale-dark':
        return <FinaleDarkGround brightness={sc.groundBrightness} />;
      case 'sfx-stage':
        return <SFXStageEnvironment />;
      case 'synthetic-grass':
        return <SyntheticGrassGround brightness={sc.groundBrightness} />;
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

      {sc.showGrid && (() => {
        const snap = useSceneStore.getState().environment.gridSnapResolution;
        const cellSize = snap;
        const sectionSize = snap * 10;
        return (
          <>
            <Grid
              position={[0, 0.02, 0]}
              args={[1000, 1000]}
              cellSize={cellSize}
              cellThickness={0.3}
              cellColor="#1a2a12"
              sectionSize={sectionSize}
              sectionThickness={0.6}
              sectionColor="#2a3a1e"
              fadeDistance={3000}
              infiniteGrid
            />
            <Grid
              position={[0, 0.025, 0]}
              args={[10000, 10000]}
              cellSize={sectionSize * 5}
              cellThickness={0.5}
              cellColor="#2a3a1e"
              sectionSize={sectionSize * 10}
              sectionThickness={0.7}
              sectionColor="#3a4a2e"
              fadeDistance={5000}
              infiniteGrid
            />
          </>
        );
      })()}

      <FloorLogo />

      {sc.showOriginMarker && (
        <>
          <mesh position={[0, 0.018, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.15, 6]} />
            <meshBasicMaterial color="#4a5a8a" transparent opacity={0.25} />
          </mesh>
          <mesh position={[0, 0.018, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[6, 0.15]} />
            <meshBasicMaterial color="#8a4a5a" transparent opacity={0.25} />
          </mesh>
        </>
      )}

      {sc.showScalePoles && [-80, -40, 0, 40, 80].map((x) => (
        <group key={`pole-${x}`} position={[x, 0, -60]}>
          <mesh position={[0, 50, 0]} castShadow>
            <cylinderGeometry args={[0.08, 0.1, 100, 8]} />
            <meshStandardMaterial color="#555555" metalness={0.7} roughness={0.25} />
          </mesh>
          {[25, 50, 75, 100].map((h) => (
            <group key={h}>
              <mesh position={[0, h, 0]}>
                <boxGeometry args={[0.5, 0.05, 0.5]} />
                <meshBasicMaterial color={h === 50 ? '#ffaa00' : h === 100 ? '#ff4444' : '#888888'} transparent opacity={0.5} />
              </mesh>
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

      {sc.showTreeline && <TreelineSilhouette />}
    </group>
  );
}
