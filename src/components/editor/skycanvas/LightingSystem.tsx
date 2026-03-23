/**
 * LightingSystem — Adaptive exposure, GI, lens flares, ground reflections,
 * contact shadows, and debug feed. Extracted from SkyCanvas.
 */
import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import { useProjectStore, EFFECT_LIBRARY } from '@/store/useProjectStore';
import { useSceneStore } from '@/store/useSceneStore';
import { createExposureController, updateExposure, flashEvent } from '@/render_ultra/postprocessing/exposure';
import { GlobalIlluminationSystem } from '@/render_ultra/lighting/globalIllumination';
import { createLensFlareSprite, flashLensFlare, decayLensFlare } from '@/render_ultra/postprocessing/lensFlare';
import { getBreakHeight } from '@/lib/pyroPhysics';
import { setAdaptivePipelineState } from '@/lib/niagaraBlenderRules';
import { updateAdaptiveLOD } from '@/hooks/useLOD';
import {
  hexToCompound,
  getActiveBurstScan,
  getSkyScatterUniforms,
  setAdaptiveExposureValue,
} from './sharedState';

// These setters are imported from SkyCanvas's RenderDebugOverlay
import { setDebugExposure, setDebugBurstLoad, setDebugLOD, setDebugRendererInfo } from '../RenderDebugOverlay';

// ═══════════════════════════════════════════════════════════════════════
// AdaptiveExposureController
// ═══════════════════════════════════════════════════════════════════════
export const AdaptiveExposureController = React.forwardRef<THREE.Group, {}>(function AdaptiveExposureController(_props, _ref) {
  const exposureRef = useRef(createExposureController());
  const _scatterAccum = useMemo(() => new THREE.Color(), []);
  const _tmpColor = useMemo(() => new THREE.Color(), []);

  useFrame(({ gl }, delta) => {
    const state = exposureRef.current;
    const { timelineItems, currentTime } = useProjectStore.getState();
    let luminance = 0;
    let activeBursts = 0;
    _scatterAccum.setRGB(0, 0, 0);
    let scatterMax = 0;

    for (let i = 0; i < timelineItems.length; i++) {
      const item = timelineItems[i];
      const elapsed = currentTime - item.startTime;
      if (elapsed < 0 || elapsed > 2.0) continue;

      activeBursts++;
      luminance += elapsed < 0.5 ? 3.0 : 0.5;

      if (elapsed < 0.3) {
        const effect = EFFECT_LIBRARY.find(e => e.id === item.effectId);
        if (effect && effect.type === 'firework') {
          const intensity = 0.4 * (1 - elapsed / 0.3);
          _scatterAccum.add(_tmpColor.set(effect.color).multiplyScalar(Math.min(intensity * 0.3, 0.15)));
          scatterMax = Math.max(scatterMax, intensity);
        }
      }
    }

    const burstLoad = THREE.MathUtils.clamp(activeBursts / 6, 0, 1);
    luminance = Math.min(luminance * (1 + burstLoad * 0.2), 15);

    if (luminance > 2 && delta < 0.1) {
      flashEvent(state, Math.min(luminance * 0.15, 0.8));
    }

    const exposure = THREE.MathUtils.clamp(updateExposure(state, luminance, delta), 0.35, 1.8);
    setAdaptiveExposureValue(exposure);
    setAdaptivePipelineState(exposure, burstLoad);
    setDebugExposure(exposure);
    setDebugBurstLoad(burstLoad);

    const userEV = useSceneStore.getState().settings.exposureCompensation || 0;
    gl.toneMappingExposure = exposure * Math.pow(2, userEV);

    const skyScatter = getSkyScatterUniforms();
    if (skyScatter) {
      if (scatterMax > 0.05) {
        skyScatter.uExplosionScatter.value.copy(_scatterAccum);
        skyScatter.uScatterIntensity.value = scatterMax;
      } else {
        skyScatter.uScatterIntensity.value *= Math.max(0, 1 - delta * 3);
      }
    }
  });

  return null;
});

// ═══════════════════════════════════════════════════════════════════════
// ContactShadowsLayer
// ═══════════════════════════════════════════════════════════════════════
export function ContactShadowsLayer() {
  const s = useSceneStore(st => st.settings);
  if (!s.contactShadowsEnabled) return null;
  return (
    <ContactShadows
      position={[0, 0.01, 0]}
      opacity={s.contactShadowsOpacity}
      scale={200}
      blur={s.contactShadowsBlur}
      far={50}
      resolution={512}
      color="#000000"
    />
  );
}

// ═══════════════════════════════════════════════════════════════════════
// DebugFeed — FPS counter, draw calls, adaptive LOD
// ═══════════════════════════════════════════════════════════════════════
export const DebugFeed = React.forwardRef<THREE.Group, {}>(function DebugFeed(_props, _ref) {
  const { gl, camera } = useThree();
  const frameCount = useRef(0);
  const lastTime = useRef(performance.now());
  const _origin = useMemo(() => new THREE.Vector3(0, 100, 0), []);

  useFrame(() => {
    frameCount.current++;
    const now = performance.now();
    if (now - lastTime.current >= 250) {
      const fps = Math.round((frameCount.current * 1000) / (now - lastTime.current));
      frameCount.current = 0;
      lastTime.current = now;
      const info = gl.info.render;
      setDebugRendererInfo(fps, info.calls, info.triangles);
      const dist = Math.round(camera.position.distanceTo(_origin));
      const adaptiveTier = updateAdaptiveLOD(fps);
      setDebugLOD(adaptiveTier, dist);
    }
  });
  return null;
});

// ═══════════════════════════════════════════════════════════════════════
// GlobalIlluminationController — explosion-driven GI probes
// ═══════════════════════════════════════════════════════════════════════
export const GlobalIlluminationController = React.forwardRef<THREE.Group, {}>(function GlobalIlluminationController(_props, _ref) {
  const giRef = useRef<GlobalIlluminationSystem | null>(null);
  const { scene } = useThree();
  const _probePos = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    giRef.current = new GlobalIlluminationSystem(scene);
    (window as any).__giSystem = giRef.current;
    return () => {
      delete (window as any).__giSystem;
      giRef.current = null;
    };
  }, [scene]);

  useFrame((_, delta) => {
    if (!giRef.current) return;
    const gi = giRef.current;
    const scan = getActiveBurstScan();
    if (scan) {
      for (const burst of scan.freshBursts) {
        const compound = hexToCompound(burst.color);
        _probePos.set(burst.x, burst.y, burst.z);
        gi.addExplosionProbe(
          _probePos,
          compound.color.clone(),
          compound.emissionIntensity * 0.6
        );
      }
    }
    gi.update(delta);
  });

  return null;
});

// ═══════════════════════════════════════════════════════════════════════
// LensFlareController — cinematic optics on bright bursts
// ═══════════════════════════════════════════════════════════════════════
export const LensFlareController = React.forwardRef<THREE.Group, {}>(function LensFlareController(_props, _ref) {
  const spritesRef = useRef<THREE.Sprite[]>([]);
  const poolIdx = useRef(0);
  const { scene } = useThree();

  useEffect(() => {
    const pool: THREE.Sprite[] = [];
    for (let i = 0; i < 10; i++) {
      const sprite = createLensFlareSprite(new THREE.Color(1, 0.9, 0.7), 25);
      scene.add(sprite);
      pool.push(sprite);
    }
    spritesRef.current = pool;
    return () => {
      pool.forEach(s => scene.remove(s));
      spritesRef.current = [];
    };
  }, [scene]);

  useFrame((_, delta) => {
    const sprites = spritesRef.current;
    if (sprites.length === 0) return;

    for (const sprite of sprites) {
      decayLensFlare(sprite, delta, 3);
    }

    const { timelineItems, currentTime } = useProjectStore.getState();
    for (const item of timelineItems) {
      const elapsed = currentTime - item.startTime;
      if (elapsed >= 0 && elapsed < 0.03) {
        const effect = EFFECT_LIBRARY.find(e => e.id === item.effectId);
        if (effect && effect.type === 'firework') {
          const caliber = effect.caliber || 4;
          const breakH = getBreakHeight(caliber);
          const pos = new THREE.Vector3(item.position.x, item.position.y + breakH, item.position.z);
          const caliberScale = caliber / 6;
          const sprite = sprites[poolIdx.current % sprites.length];
          flashLensFlare(sprite, pos, Math.min(1, 0.5 * caliberScale), new THREE.Color(effect.color));
          poolIdx.current++;
        }
      }
    }
  });

  return null;
});

// ═══════════════════════════════════════════════════════════════════════
// GroundReflections — wet-floor reflections from explosions
// ═══════════════════════════════════════════════════════════════════════
export const GroundReflections = React.forwardRef<THREE.Mesh, {}>(function GroundReflections(_props, _ref) {
  const meshRef = useRef<THREE.Mesh>(null);
  const uniformsRef = useRef({
    uWetness: { value: 0.3 },
    uTime: { value: 0 },
    uReflectionColor: { value: new THREE.Color(0.1, 0.15, 0.2) },
    uReflectionIntensity: { value: 0.5 },
  });

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const u = uniformsRef.current;
    u.uTime.value = clock.getElapsedTime();

    const { timelineItems, currentTime } = useProjectStore.getState();
    let flashIntensity = 0;
    const _reusableColor = u.uReflectionColor.value;

    for (const item of timelineItems) {
      const elapsed = currentTime - item.startTime;
      if (elapsed >= 0 && elapsed < 0.3) {
        const effect = EFFECT_LIBRARY.find(e => e.id === item.effectId);
        if (effect && effect.type === 'firework') {
          _reusableColor.set(effect.color);
          flashIntensity = Math.max(flashIntensity, 1.0 * (1 - elapsed / 0.3));
        }
      }
    }

    if (flashIntensity > 0.1) {
      u.uReflectionIntensity.value = flashIntensity;
    } else {
      u.uReflectionIntensity.value = Math.max(0.5, u.uReflectionIntensity.value * 0.95);
    }
  });

  return (
    <mesh ref={meshRef} position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[100000, 100000]} />
      <shaderMaterial
        transparent
        depthWrite={false}
        blending={THREE.NormalBlending}
        uniforms={uniformsRef.current}
        vertexShader={`
          varying vec2 vUv;
          varying vec3 vWorldPos;
          void main() {
            vUv = uv;
            vec4 wp = modelMatrix * vec4(position, 1.0);
            vWorldPos = wp.xyz;
            gl_Position = projectionMatrix * viewMatrix * wp;
          }
        `}
        fragmentShader={`
          uniform float uWetness;
          uniform float uTime;
          uniform vec3 uReflectionColor;
          uniform float uReflectionIntensity;
          varying vec2 vUv;
          varying vec3 vWorldPos;

          float hash(vec2 p) {
            return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
          }
          float noise(vec2 p) {
            vec2 i = floor(p);
            vec2 f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            return mix(
              mix(hash(i), hash(i + vec2(1,0)), f.x),
              mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x),
              f.y
            );
          }

          void main() {
            float dist = length(vWorldPos.xz) / 50000.0;
            float distFade = 1.0 - smoothstep(0.0, 1.0, dist);
            float puddle = noise(vWorldPos.xz * 0.01 + uTime * 0.01);
            puddle = smoothstep(0.3, 0.7, puddle) * uWetness;
            float refl = puddle * distFade * uReflectionIntensity;
            gl_FragColor = vec4(uReflectionColor * refl, refl * 0.15);
          }
        `}
      />
    </mesh>
  );
});
