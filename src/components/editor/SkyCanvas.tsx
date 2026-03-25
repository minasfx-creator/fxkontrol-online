import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Stars, Grid, PerspectiveCamera, ContactShadows, Sky } from '@react-three/drei';
import { useProjectStore, EFFECT_LIBRARY } from '@/store/useProjectStore';
import { useSceneStore } from '@/store/useSceneStore';
import React, { useRef, useMemo, useEffect, useState, useCallback, Component, ErrorInfo, ReactNode } from 'react';
import { PerfCollector, PerformanceHUD, type PerfStats } from './PerformanceHUD';
import ViewportTerminal, { pushLog } from './ViewportTerminal';
import * as THREE from 'three';
import PositionPins from './PositionPins';
import PyroLaunchAngles from './PyroLaunchAngle';
import PostProcessing from './PostProcessing';
import { BoxSelectR3F } from './BoxSelectOverlay';
import AlignmentTools from './AlignmentTools';
import CameraAnimator, { CameraPathPreview } from './CameraAnimator';
import { FinaleAxesHelper, DoubleClickFocus, FinaleToolbar } from './FinaleViewportTools';
import { StressTestFireworks, StressTestButton } from './effects/GPUFireworkStressTest';
import PostExplosionSmokeManager from './effects/PostExplosionSmokeManager';
import PositionTransformGizmo from './PositionTransformGizmo';
import KeybindingCheatSheet, { KeybindingTrigger } from './KeybindingCheatSheet';
import { useKeybindings } from '@/hooks/useKeybindings';
import ViewportRulers from './ViewportRulers';
import TrajectoryPaths from './TrajectoryPaths';
import DroneChoreography from './DroneChoreography';
import Rack3DView from './Rack3DView';
import BoidsVisualizer from './BoidsVisualizer';
import CollisionAvoidanceOverlay from './CollisionAvoidanceOverlay';
import PyroSafetyZones from './skycanvas/PyroSafetyZones';
import AudioSpectrumVisualizer from './AudioSpectrumVisualizer';
import LaserPreviewBeams from './LaserPreviewBeams';
import { DEFAULT_AVOIDANCE } from '@/lib/collisionAvoidance';
import QuadcopterModel from './QuadcopterModel';
// GeofenceVisual removed — green squares issue
import SiteModelRenderer from './SiteModelRenderer';
import StageFixtures from './StageFixtures';
import { Camera, Eye, Video, Plane, Users, Maximize, Minimize, AlertTriangle, Globe, Download, ScanEye, Cog, Paintbrush, MapPinned, Film, ChevronDown, Plus, Lock, Ruler, Bookmark, Trash2, Navigation } from 'lucide-react';
import SelectionStatusBar from './SelectionStatusBar';
import AICoPilotOverlay from './AICoPilotOverlay';
import TelemetryBar from './TelemetryBar';
import MissionSetupOverlay from './MissionSetupOverlay';
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
import { getLiftTime, getBreakHeight, getBreakSpeed, getTypedPrefire, getTypedDuration, getStarLifetime, type FinalePartType } from '@/lib/pyroPhysics';
import { parseVDL, vdlToEffect } from '@/lib/vdlParser';
import { temporalFlicker } from '@/lib/pyroNoise';
// MiniMap removed per user request
import NiagaraVFXController from './NiagaraVFXController';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useLiveSfxStore } from '@/store/useLiveSfxStore';
// ═══ render_ultra integrations — Blender/Cycles-grade tech ═══
import { createExposureController, updateExposure, flashEvent } from '@/render_ultra/postprocessing/exposure';
import { getCompound, thermalColor, autoMatchFormulation, type ChemicalCompound } from '@/render_ultra/fireworks/particleChemistry';
import { GlobalIlluminationSystem } from '@/render_ultra/lighting/globalIllumination';
// SmokeSystem removed — handled by NiagaraVFXController
import { createLensFlareSprite, flashLensFlare, decayLensFlare } from '@/render_ultra/postprocessing/lensFlare';
import { getBurstConfig, type BurstPattern } from '@/render_ultra/fireworks/burstSimulation';
// sparkTrailsGPU removed — handled by NiagaraVFXController
import { createHDRLightingRig } from '@/render_ultra/lighting/hdrLighting';
import { createVolumetricFogPlane } from '@/render_ultra/environment/volumetricFog';
import { createReflectionPlane } from '@/render_ultra/environment/reflections';
// ═══ LOD System — distance-based quality scaling + adaptive FPS ═══
import { useLOD, calculateLOD, useSceneLOD, updateAdaptiveLOD, getAdaptiveTier, type LODFactors } from '@/hooks/useLOD';
import VolumetricGodRays from './skycanvas/VolumetricGodRays';
import VolumetricSmoke from './effects/VolumetricSmoke';
// ═══ AAA Engine: Frustum Culling + Object Pooling ═══
import { isInFrustum } from '@/lib/spatialCuller';
import { resetPools } from '@/lib/geometryPool';
import ViewportGeoTools, { type GeoToolMode, type GeoMarker, type GeoRulerPoint, type GeoPath } from './ViewportGeoTools';
import GoogleTilesLayer from '@/core/geo/GoogleTilesEngine';
import GeoCameraController from '@/core/geo/GeoCameraController';
import { isFlyingTo } from '@/core/camera/geoCamera';
import ClientPresentationMode from './ClientPresentationMode';
import { GeoToolsScene, GeoToolClickHandler } from './GeoToolsR3F';
import { RenderDebugToggle, RenderDebugPanel, setDebugExposure, setDebugBurstLoad, setDebugLOD, setDebugRendererInfo } from './RenderDebugOverlay';
import { clampNiagaraHDR, getNiagaraBudgets, setAdaptivePipelineState } from '@/lib/niagaraBlenderRules';
// ═══ Hardening Engine ═══
import {
  reportCrash, isInCooldown, recordContextLoss,
  watchdogTick, pushFrameMetrics, startMetricsReporting, stopMetricsReporting,
} from '@/lib/hardening';
// ═══ FXK Ultra Refinement — Adaptive Quality + Render Stability ═══
import { useFXKUltraRefinement } from '@/hooks/useFXKUltraRefinement';
// ═══ Shared state imported from skycanvas module ═══
import {
  getActiveBurstCount as _getActiveBurstCount,
  runActiveBurstScan,
  getActiveBurstScan,
  hexToCompound,
  getEffectById,
  getWindForce,
  getAdaptiveExposure,
  setAdaptiveExposureValue,
  getSkyScatterUniforms,
  setSkyScatterUniforms,
  CAMERA_PRESETS,
  WebGLErrorBoundary,
  GRAVITY,
  _posQuat, _effQuat, _pitchQuat, _posEuler, _effEuler, _launchDir, _pitchAxis,
  type ActiveBurstScanResult,
  // ═══ Extracted modules ═══
  Moon,
  AtmosphericParticles,
  StageGround,
  FireworkBurst,
  TimelineEffects,
  LiveSFXEffects,
  estimateFireworkStarCost,
  // ═══ LightingSystem ═══
  AdaptiveExposureController,
  ContactShadowsLayer,
  DebugFeed,
  GlobalIlluminationController,
  LensFlareController,
  GroundReflections,
} from './skycanvas';

// Re-export for external consumers
export function getActiveBurstCount() { return _getActiveBurstCount(); }

// Module-level refs shared between SkyGradient / AdaptiveExposure / fireworks
let _skyScatterUniforms_local: { uExplosionScatter: { value: THREE.Color }; uScatterIntensity: { value: number } } | null = null;
let _adaptiveExposure_local = 1.2;
let _activeBurstScan_local: ActiveBurstScanResult | null = null;

// lumaTonemapScale REMOVED — PostProcessing ACES Filmic is the single tonemap pass

// --- Playback clock (wired through DeterministicClock → LockstepEngine → ExecutionBridge) ---
import { deterministicClock } from '@/core/time/deterministicClock';
import { lockstep } from '@/core/reliability/lockstepEngine';
import { executionBridge } from '@/core/execution/executionBridge';
import { frameSyncEngine } from '@/core/sync/frameSyncEngine';

const PlaybackClock = React.forwardRef<any>(function PlaybackClock(_props, _ref) {
  const { isPlaying, currentTime, duration, setCurrentTime, setPlaying, playbackSpeed } = useProjectStore();
  const registeredRef = useRef(false);

  // Pump the deterministic clock every R3F frame
  useFrame(() => {
    deterministicClock.tick();
  });

  // Register playback as a lockstep subsystem (once)
  useEffect(() => {
    if (registeredRef.current) return;
    registeredRef.current = true;

    // Playback advancement — runs at fixed 60Hz via lockstep
    lockstep.register('playback', (_simTime: number, dt: number) => {
      const store = useProjectStore.getState();
      if (!store.isPlaying) return;
      const delta = dt * store.playbackSpeed;
      const next = store.currentTime + delta;
      if (next >= store.duration) {
        store.setCurrentTime(store.duration);
        store.setPlaying(false);
      } else {
        store.setCurrentTime(next);
      }
    }, 10); // High priority — playback clock runs first

    // ExecutionBridge ticks after playback
    lockstep.register('executionBridge', (simTime: number, _dt: number) => {
      executionBridge.tick(simTime);
    }, 50); // Lower priority — fires after playback updates

    // Start the deterministic clock and lockstep
    deterministicClock.start();
    lockstep.start();

    // Wire clock → frameSyncEngine → lockstep: frame-aligned time feeds lockstep
    deterministicClock.onTick((time: number, delta: number) => {
      // Align the accumulated time to frame boundaries before feeding lockstep
      const alignedDelta = frameSyncEngine.getSyncedTimeSec(time + delta) - frameSyncEngine.getSyncedTimeSec(time);
      lockstep.tick(Math.max(0, alignedDelta));
    });

    return () => {
      lockstep.unregister('playback');
      lockstep.unregister('executionBridge');
      deterministicClock.pause();
      lockstep.stop();
      registeredRef.current = false;
    };
  }, []);

  // Sync deterministic clock when user scrubs timeline
  useEffect(() => {
    if (!isPlaying) {
      deterministicClock.setTime(currentTime);
    }
  }, [currentTime, isPlaying]);

  return null;
});
/**
 * HardeningWatchdog — feeds FPS/renderer metrics to the hardening engine each frame.
 * Runs inside the R3F Canvas context.
 */
function HardeningWatchdog() {
  const { gl } = useThree();
  const frameRef = useRef(0);

  // Start metrics console reporting on mount
  useEffect(() => {
    startMetricsReporting(60); // Log every 60s
    return () => stopMetricsReporting();
  }, []);

  useFrame((_state, delta) => {
    frameRef.current++;
    // Sample at ~10Hz (every 6 frames at 60fps)
    if (frameRef.current % 6 !== 0) return;

    const fps = delta > 0 ? 1 / delta : 60;
    const frameTimeMs = delta * 1000;
    const info = gl.info.render;

    pushFrameMetrics(fps, frameTimeMs, info.calls, info.triangles);
    watchdogTick(fps);
  });

  return null;
}

/**
 * FXKQualityController — runs FXK Ultra Refinement adaptive quality + stability
 * inside the R3F Canvas context. Automatically adjusts bloom, SSR, lowQualityMode
 * based on real-time frame metrics.
 */
function FXKQualityController() {
  useFXKUltraRefinement();
  return null;
}

/**
 * ContextLossGuard — handles WebGL context loss/restore with proper cleanup.
 */
function ContextLossGuard({ recoveringRef, onRemount }: {
  recoveringRef: React.MutableRefObject<boolean>;
  onRemount: () => void;
}) {
  const { gl } = useThree();

  useEffect(() => {
    const canvas = gl.domElement;

    const onLost = (e: Event) => {
      e.preventDefault();
      if (recoveringRef.current) return;

      recordContextLoss();
      const shouldRecover = reportCrash();
      if (!shouldRecover || isInCooldown()) {
        console.error('[FXK] WebGL context lost — in cooldown, suppressing remount');
        return;
      }

      recoveringRef.current = true;
      console.warn('[FXK] WebGL context lost — remounting renderer');
      resetPools();
      onRemount();
    };

    const onRestored = () => {
      console.log('[FXK] WebGL context restored');
      recoveringRef.current = false;
    };

    canvas.addEventListener('webglcontextlost', onLost as EventListener);
    canvas.addEventListener('webglcontextrestored', onRestored as EventListener);
    return () => {
      canvas.removeEventListener('webglcontextlost', onLost as EventListener);
      canvas.removeEventListener('webglcontextrestored', onRestored as EventListener);
    };
  }, [gl, recoveringRef, onRemount]);

  return null;
}

// Module-level refs — local aliases for backward compat within this file
let _skyScatterUniforms: { uExplosionScatter: { value: THREE.Color }; uScatterIntensity: { value: number } } | null = null;
let _adaptiveExposure = 1.2;
let _activeBurstScan: ActiveBurstScanResult | null = null;
let _activeBurstCount = 0;

// FireworkBurst, LightPoint, estimateFireworkStarCost, TimelineEffects, LiveSFXEffects
// → Extracted to skycanvas/FireworkRenderer.tsx

// ========================================================================
// ═══ ENVIRONMENT V2 — UE5.7 Virtual Worlds ═══
// Sky Atmosphere V2, Volumetric Clouds, Water, Ground Decals, Time-of-Day
// ========================================================================
import {
  createSkyAtmosphereV2,
  createVolumetricCloudLayer, CLOUD_PRESETS,
  createWaterSystem, WATER_PRESETS,
  evaluateTimeOfDay,
  createDecalSystem, spawnScorchMark, spawnLightSplash, updateDecals, clearDecals,
} from '@/render_ultra';

function SkyAtmosphereV2Layer() {
  const meshRef = useRef<THREE.Mesh | null>(null);
  const skySystemRef = useRef<ReturnType<typeof createSkyAtmosphereV2> | null>(null);
  const { scene } = useThree();
  const timeOfDay = useSceneStore(st => st.settings.timeOfDay);
  const timeOfDayEnabled = useSceneStore(st => st.settings.timeOfDayEnabled);

  useEffect(() => {
    const system = createSkyAtmosphereV2(90000);
    skySystemRef.current = system;
    scene.add(system.mesh);
    return () => {
      scene.remove(system.mesh);
      system.mesh.geometry.dispose();
      (system.mesh.material as THREE.ShaderMaterial).dispose();
    };
  }, [scene]);

  useFrame(({ camera }) => {
    const sys = skySystemRef.current;
    if (!sys) return;
    sys.mesh.position.copy(camera.position);

    if (timeOfDayEnabled) {
      const tod = evaluateTimeOfDay(timeOfDay);
      sys.setSunDirection(tod.sunDirection);
      sys.setSunIntensity(tod.sunIntensity);
      sys.setMoonDirection(tod.moonDirection);
      sys.setStarBrightness(tod.starBrightness);
      sys.setTimeOfDay(tod.skyZenith, tod.skyHorizon, tod.skyNight);
    }
  });

  return null;
}

function VolumetricCloudLayer() {
  const cloudRef = useRef<ReturnType<typeof createVolumetricCloudLayer> | null>(null);
  const { scene } = useThree();
  const cloudCoverage = useSceneStore(st => st.settings.cloudCoverage);
  const cloudDensity = useSceneStore(st => st.settings.cloudDensity);
  const cloudWindSpeed = useSceneStore(st => st.settings.cloudWindSpeed);

  useEffect(() => {
    const cloud = createVolumetricCloudLayer({
      coverage: cloudCoverage,
      density: cloudDensity,
      windSpeed: cloudWindSpeed,
    });
    cloudRef.current = cloud;
    scene.add(cloud.mesh);

    // Expose cloud system globally for NiagaraVFXController explosion flash
    (window as any).__volumetricCloudSystem = cloud;

    return () => {
      scene.remove(cloud.mesh);
      cloud.mesh.geometry.dispose();
      (cloud.mesh.material as THREE.ShaderMaterial).dispose();
      delete (window as any).__volumetricCloudSystem;
    };
  }, [scene]);

  useEffect(() => {
    const c = cloudRef.current;
    if (!c) return;
    c.setCoverage(cloudCoverage);
    c.setDensity(cloudDensity);
    c.setWindSpeed(cloudWindSpeed);
  }, [cloudCoverage, cloudDensity, cloudWindSpeed]);

  useFrame(({ clock }) => {
    cloudRef.current?.update(clock.getElapsedTime());
  });

  return null;
}

function WaterLayer() {
  const waterRef = useRef<ReturnType<typeof createWaterSystem> | null>(null);
  const { scene } = useThree();
  const waterLevel = useSceneStore(st => st.settings.waterLevel);
  const waterPreset = useSceneStore(st => st.settings.waterPreset);

  useEffect(() => {
    const presetCfg = WATER_PRESETS[waterPreset] || {};
    const water = createWaterSystem(presetCfg);
    waterRef.current = water;
    water.mesh.position.y = waterLevel;
    scene.add(water.mesh);
    return () => {
      scene.remove(water.mesh);
      water.mesh.geometry.dispose();
      (water.mesh.material as THREE.ShaderMaterial).dispose();
    };
  }, [scene, waterPreset]);

  useEffect(() => {
    if (waterRef.current) waterRef.current.mesh.position.y = waterLevel;
  }, [waterLevel]);

  useFrame(({ clock }) => {
    waterRef.current?.update(clock.getElapsedTime());
  });

  return null;
}

function GroundDecalManager() {
  const { scene } = useThree();

  useEffect(() => {
    const group = createDecalSystem();
    scene.add(group);
    return () => {
      scene.remove(group);
      clearDecals();
    };
  }, [scene]);

  useFrame(({ clock }) => {
    updateDecals(clock.getDelta());
  });

  return null;
}

/** Switcher: renders sky engine + optional cloud/water/decal/ToD layers based on store settings */
function EnvironmentV2Switcher() {
  const skyEngineV2 = useSceneStore(st => st.settings.skyEngineV2);
  const cloudCoverage = useSceneStore(st => st.settings.cloudCoverage);
  const waterEnabled = useSceneStore(st => st.settings.waterEnabled);
  const decalsEnabled = useSceneStore(st => st.settings.decalsEnabled);
  const timeOfDayEnabled = useSceneStore(st => st.settings.timeOfDayEnabled);

  return (
    <>
      {skyEngineV2 ? <SkyAtmosphereV2Layer /> : <SkyGradient />}
      {cloudCoverage > 0.05 && <VolumetricCloudLayer />}
      {waterEnabled && <WaterLayer />}
      {decalsEnabled && <GroundDecalManager />}
      {timeOfDayEnabled && <TimeOfDayController />}
      {/* Volumetric God Rays — ray marched light scattering */}
      <VolumetricGodRays
        lightPosition={[0, 800, -500]}
        lightColor="#ffeedd"
        intensity={0.8}
        samples={48}
        enabled={true}
      />
    </>
  );
}

function TimeOfDayController() {
  const timeOfDay = useSceneStore(st => st.settings.timeOfDay);
  const { scene } = useThree();

  useFrame(() => {
    const tod = evaluateTimeOfDay(timeOfDay);
    // Update scene ambient/fog based on time-of-day
    if (scene.fog && scene.fog instanceof THREE.FogExp2) {
      scene.fog.color.copy(tod.fogColor);
    }
    // Update ambient lights
    scene.traverse(obj => {
      if (obj instanceof THREE.AmbientLight) {
        obj.color.copy(tod.ambientColor);
        obj.intensity = tod.ambientIntensity * 2;
      }
    });
  });

  return null;
}

// ========================================================================
// GOOGLE EARTH-STYLE — Atmospheric sky with realistic horizon
// ========================================================================
function SkyGradient() {
  const skyBrightness = useSceneStore(st => st.settings.skyBrightness);
  const horizonGlow = useSceneStore(st => st.settings.horizonGlow);
  const starDensity = useSceneStore(st => st.settings.starDensity);
  const groundStyle = useSceneStore(st => st.settings.groundStyle);
  const skyRef = useRef<THREE.Mesh>(null);

  const skyRotation = useSceneStore(st => st.environment.skyRotation);

  // Dynamic ground tint based on groundStyle — eliminates sky/ground seam
  const groundTint = useMemo(() => {
    switch (groundStyle) {
      case 'finale-dark': return new THREE.Vector3(0.003, 0.004, 0.008);
      case 'flat-black':  return new THREE.Vector3(0.001, 0.001, 0.001);
      case 'google-earth': return new THREE.Vector3(0.005, 0.008, 0.004);
      case 'concrete':    return new THREE.Vector3(0.006, 0.006, 0.007);
      case 'sfx-stage':   return new THREE.Vector3(0.002, 0.001, 0.004);
      default:            return new THREE.Vector3(0.005, 0.005, 0.015);
    }
  }, [groundStyle]);

  const uniforms = useMemo(() => ({
    uSkyBrightness: { value: skyBrightness },
    uHorizonGlow: { value: horizonGlow },
    uStarDensity: { value: starDensity },
    uTime: { value: 0 },
    uExplosionScatter: { value: new THREE.Color(0, 0, 0) },
    uScatterIntensity: { value: 0 },
    uSkyRotation: { value: 0 },
    uGroundTint: { value: groundTint },
  }), []);

  useEffect(() => {
    uniforms.uSkyBrightness.value = skyBrightness;
    uniforms.uHorizonGlow.value = horizonGlow;
    uniforms.uStarDensity.value = starDensity;
    uniforms.uSkyRotation.value = skyRotation * Math.PI / 180;
    uniforms.uGroundTint.value = groundTint;
  }, [skyBrightness, horizonGlow, starDensity, skyRotation, groundTint]);

  // Expose scatter uniforms for AdaptiveExposureController
  useEffect(() => {
    _skyScatterUniforms = { uExplosionScatter: uniforms.uExplosionScatter, uScatterIntensity: uniforms.uScatterIntensity };
    return () => { _skyScatterUniforms = null; };
  }, []);

  useFrame(({ clock, camera }) => {
    uniforms.uTime.value = clock.getElapsedTime();
    if (skyRef.current) skyRef.current.position.copy(camera.position);
  });

  return (
    <mesh ref={skyRef} renderOrder={-1000}>
      <sphereGeometry args={[90000, 32, 16]} />
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
          uniform vec3 uExplosionScatter;
          uniform float uScatterIntensity;
          uniform float uSkyRotation;
          uniform vec3 uGroundTint;
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
            vec3 dir = normalize(vWorldPosition - cameraPosition);
            // Apply sky rotation around Y axis
            float cosR = cos(uSkyRotation);
            float sinR = sin(uSkyRotation);
            dir = vec3(dir.x * cosR - dir.z * sinR, dir.y, dir.x * sinR + dir.z * cosR);
            float h = dir.y;
            
            // Deep cinematic space — rich midnight blues to warm horizon
            vec3 space     = vec3(0.001, 0.002, 0.012);
            vec3 zenith    = vec3(0.004, 0.008, 0.04);
            vec3 upperSky  = vec3(0.008, 0.018, 0.07);
            vec3 midSky    = vec3(0.02, 0.035, 0.12);
            vec3 lowSky    = vec3(0.04, 0.05, 0.14);
            vec3 horizon   = vec3(0.08, 0.06, 0.12);
            vec3 haze      = vec3(0.12, 0.08, 0.10);
            vec3 ground    = uGroundTint;
            
            vec3 color;
            if (h > 0.7) {
              color = mix(upperSky, space, smoothstep(0.7, 1.0, h));
            } else if (h > 0.4) {
              color = mix(midSky, upperSky, smoothstep(0.4, 0.7, h));
            } else if (h > 0.15) {
              color = mix(lowSky, midSky, smoothstep(0.15, 0.4, h));
            } else if (h > 0.02) {
              color = mix(horizon, lowSky, smoothstep(0.02, 0.15, h));
            } else if (h > -0.05) {
              color = mix(haze, horizon, smoothstep(-0.05, 0.02, h));
            } else {
              color = mix(ground, haze, smoothstep(-0.35, -0.05, h));
            }
            
            // Warm amber horizon glow — cinematic sunset afterglow
            float hGlow = exp(-h * h * 50.0);
            color += vec3(0.22, 0.10, 0.04) * hGlow * uHorizonGlow;
            
            // Cool cyan counter-glow opposite side
            float cyanGlow = exp(-(h - 0.05) * (h - 0.05) * 80.0);
            color += vec3(0.02, 0.06, 0.10) * cyanGlow * 0.4;
            
            // Aurora borealis band
            float auroraAngle = dir.x * 0.3 + dir.z * 0.95;
            float auroraBand = exp(-pow(auroraAngle - 0.2, 2.0) * 12.0) * smoothstep(0.2, 0.6, h);
            float auroraWave = sin(dir.x * 8.0 + uTime * 0.3) * 0.5 + 0.5;
            float auroraDetail = fbm3(dir.xz * 20.0 + uTime * 0.05);
            vec3 auroraColor = mix(vec3(0.01, 0.08, 0.04), vec3(0.03, 0.04, 0.10), auroraWave);
            color += auroraColor * auroraBand * auroraDetail * 0.35;
            
            // Enhanced Milky Way with deep structure
            float milkyAngle = dir.x * 0.6 + dir.z * 0.8;
            float milkyBand = exp(-pow(milkyAngle - dir.y * 0.5, 2.0) * 6.0);
            float milkyDetail = fbm3(dir.xz * 30.0) * 0.6 + 0.4;
            float milkyDust = fbm3(dir.xz * 60.0 + 100.0);
            vec3 milkyColor = mix(vec3(0.015, 0.02, 0.045), vec3(0.035, 0.025, 0.045), milkyDust);
            color += milkyColor * milkyBand * milkyDetail * smoothstep(0.15, 0.5, h) * 1.0;
            
            // Dark dust lanes
            float dustLane = smoothstep(0.45, 0.55, fbm3(dir.xz * 20.0 + 50.0));
            color -= vec3(0.01) * milkyBand * dustLane * smoothstep(0.2, 0.5, h);
            
            // Nebula patches — purple and teal
            float nebula1 = fbm3(dir.xz * 15.0 + vec2(200.0, 0.0));
            float nebula2 = fbm3(dir.xz * 12.0 + vec2(0.0, 300.0));
            color += vec3(0.025, 0.008, 0.035) * smoothstep(0.6, 0.8, nebula1) * milkyBand * 0.6;
            color += vec3(0.008, 0.018, 0.035) * smoothstep(0.55, 0.75, nebula2) * smoothstep(0.3, 0.6, h) * 0.5;
            
            // Wispy clouds near horizon
            float cloudUV1 = fbm3(dir.xz * 4.0 + uTime * 0.008);
            float cloudUV2 = fbm3(dir.xz * 8.0 - uTime * 0.006 + 50.0);
            float cloudMask = smoothstep(0.0, 0.12, h) * smoothstep(0.25, 0.08, h);
            float clouds = smoothstep(0.45, 0.7, cloudUV1 * 0.6 + cloudUV2 * 0.4) * cloudMask;
            color += vec3(0.04, 0.04, 0.06) * clouds * 0.3;
            
            // Stars with color temperature variation
            float stars = starField(dir);
            float starHue = hash21(dir.xz * 50.0);
            vec3 starColor = starHue < 0.25 ? vec3(0.6, 0.75, 1.0) :
                             starHue < 0.5 ? vec3(1.0, 0.95, 0.85) :
                             starHue < 0.75 ? vec3(1.0, 0.80, 0.65) :
                             vec3(1.0, 0.55, 0.45);
            color += starColor * stars * 0.9 * uStarDensity;
            
            // Shooting stars
            float shooting = shootingStar(dir);
            color += vec3(0.85, 0.92, 1.0) * shooting * uStarDensity;
            
            // ═══ Explosion sky scatter — atmosphere reflects burst colors ═══
            color += uExplosionScatter * uScatterIntensity * exp(-abs(h) * 3.0);
            
            color *= uSkyBrightness;
            color = max(color, vec3(0.0));
            
            gl_FragColor = vec4(color, 1.0);
          }
        `}
      />
    </mesh>
  );
}

// Moon, SatelliteOverlay, GrassGround, AtmosphericParticles, FloorLogo, TreelineSilhouette
// → Extracted to skycanvas/GroundSystem.tsx

// LaunchSites removed — positions are now user-created via toolbar

// ─── Scene-Settings-Driven Components ────────────────────────────────

const SHADOW_MAP_SIZES: Record<string, number> = { low: 1024, medium: 2048, high: 4096, ultra: 8192 };

function SceneLighting() {
  const { scene } = useThree();
  const s = useSceneStore(st => st.settings);
  const shadowSize = SHADOW_MAP_SIZES[s.shadowQuality] || 4096;
  const rigRef = useRef<ReturnType<typeof createHDRLightingRig> | null>(null);

  useEffect(() => {
    const rig = createHDRLightingRig({
      moonIntensity: s.moonIntensity,
      moonColor: new THREE.Color(s.moonColor),
      ambientIntensity: s.ambientIntensity,
      ambientColor: new THREE.Color(0.29, 0.38, 0.5),
      fillIntensity: 0.35,
      rimIntensity: 0.55,
    });
    rigRef.current = rig;

    // Configure shadow map from store settings
    rig.moon.shadow.mapSize.set(shadowSize, shadowSize);
    rig.moon.castShadow = s.shadowsEnabled;
    rig.moon.shadow.bias = -0.00003;
    rig.moon.shadow.normalBias = 0.02;
    rig.moon.shadow.camera.far = 25000;

    scene.add(rig.group);

    // Expose HDR rig globally for NiagaraVFXController burst lights
    (window as any).__hdrLightingRig = rig;

    return () => {
      scene.remove(rig.group);
      delete (window as any).__hdrLightingRig;
    };
  }, [scene]);

  // Reactively sync store settings to rig
  useEffect(() => {
    const rig = rigRef.current;
    if (!rig) return;
    rig.updateMoonIntensity(s.moonIntensity);
    rig.updateAmbient(s.ambientIntensity);
    rig.moon.color.set(s.moonColor);
    rig.moon.castShadow = s.shadowsEnabled;
    rig.moon.shadow.mapSize.set(shadowSize, shadowSize);
  }, [s.moonIntensity, s.ambientIntensity, s.moonColor, s.shadowsEnabled, shadowSize]);

  return (
    <>
      {/* Subtle backfill for depth separation — complements HDR rig */}
      <directionalLight position={[-60, 25, 70]} intensity={s.rimLightIntensity * 0.15} color="#3355aa" />
      <directionalLight position={[0, -8, 40]} intensity={s.fillLightIntensity * 0.08} color="#182218" />
    </>
  );
}

/**
 * GeoTimeOfDaySync — Reads timezone offset from the project store
 * and automatically sets the scene's timeOfDay based on showtime (20:00 default)
 * adjusted by the real timezone, so the sun/sky reflects actual conditions.
 */
function GeoTimeOfDaySync() {
  const timeZoneOffset = useProjectStore(s => s.timeZoneOffset);
  const { updateSettings } = useSceneStore();
  const appliedRef = useRef(false);

  useEffect(() => {
    if (timeZoneOffset == null || appliedRef.current) return;
    appliedRef.current = true;

    // Compute local showtime hour (default: 20:00 local)
    const showHourLocal = 20;
    
    // Enable time-of-day and set it to showtime
    updateSettings({
      timeOfDay: showHourLocal,
      timeOfDayEnabled: true,
    });
    
    console.log(`[GeoSync] TimeOfDay set to ${showHourLocal}h (TZ offset: ${timeZoneOffset}s)`);
  }, [timeZoneOffset, updateSettings]);

  return null;
}

/**
 * GoogleEarthLighting — adds hemisphere + ambient light specifically for
 * illuminating Google 3D Tiles which appear dark under the HDR moonlight rig.
 * Also renders a drei <Sky /> as atmospheric backdrop while tiles load.
 */
function GoogleEarthLighting() {
  const google3DTilesEnabled = useSceneStore(st => st.settings.google3DTilesEnabled);
  const timeOfDay = useSceneStore(st => st.settings.timeOfDay);
  
  // Compute sun position from timeOfDay (0-24h)
  const sunPos = useMemo(() => {
    const angle = ((timeOfDay - 6) / 12) * Math.PI;
    const y = Math.sin(angle) * 100;
    const x = Math.cos(angle) * 100;
    return [x, Math.max(y, -20), 50] as [number, number, number];
  }, [timeOfDay]);
  
  const isNight = timeOfDay >= 20 || timeOfDay <= 5;
  
  if (!google3DTilesEnabled) return null;
  
  return (
    <>
      {/* Night: deep blue sky backdrop + stars */}
      {isNight && <color attach="background" args={['#0a0e1a']} />}
      {isNight && <Stars radius={80000} depth={30000} count={8000} factor={5} saturation={0.15} fade speed={0.02} />}
      {/* Atmospheric sky backdrop — visible while Google Earth tiles load */}
      {!isNight && <Sky sunPosition={sunPos} turbidity={8} rayleigh={2} mieCoefficient={0.005} mieDirectionalG={0.8} />}
      {/* Hemisphere light: sky blue + ground warm — fills Google Earth geometry */}
      <hemisphereLight args={[0x87ceeb, 0x362d1f, isNight ? 0.08 : 0.4]} />
      {/* Ambient fill — prevents completely dark tiles */}
      <ambientLight intensity={isNight ? 0.15 : 0.3} color={isNight ? '#1a2b4c' : '#ffffff'} />
      {/* Directional sunlight matching sky position */}
      {!isNight && (
        <directionalLight 
          position={sunPos} 
          intensity={0.6} 
          color={0xffeedd} 
          castShadow={false}
        />
      )}
      {/* Moonlight for night scenes */}
      {isNight && (
        <directionalLight
          position={[30, 60, -40]}
          intensity={0.08}
          color={0x8899bb}
          castShadow={false}
        />
      )}
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
  return <Stars radius={100000} depth={40000} count={Math.round(15000 * density)} factor={6} saturation={0.2} fade speed={0.03} />;
}

/** SceneStars with lowQualityMode support — reduces count & factor by 50% */
function SceneStarsWired() {
  const density = useSceneStore(st => st.settings.starDensity);
  const lowQ = useSceneStore(st => st.environment.lowQualityMode);
  if (density <= 0.05) return null;
  const mult = lowQ ? 0.5 : 1.0;
  return <Stars radius={100000} depth={40000} count={Math.round(15000 * density * mult)} factor={6 * mult} saturation={0.2} fade speed={0.03} />;
}

// WeatherEffects extracted to skycanvas/WeatherSystem.tsx
import { WeatherEffects } from './skycanvas/WeatherSystem';

// Delayed mount wrapper — lets base renderer stabilize before heavy VFX
function DelayedMount({ delay = 2000, children }: { delay?: number; children: ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => { const t = setTimeout(() => setReady(true), delay); return () => clearTimeout(t); }, [delay]);
  return ready ? <>{children}</> : null;
}

// Session-level flag: intro only plays once per browser session
let __cameraIntroPlayed = false;

// --- Camera controller with persistent state + cinematic intro ---
// Apple-smooth easing: cubic bezier for uniform camera movement
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** FlyControls — WASD + mouse pointer-lock first-person camera */
function FlyControls({ onSpeedChange }: { onSpeedChange?: (speed: number) => void }) {
  const { camera, gl } = useThree();
  const keys = useRef<Record<string, boolean>>({});
  const euler = useRef(new THREE.Euler(0, 0, 0, 'YXZ'));
  const speed = useRef(15);
  const locked = useRef(false);
  const SENSITIVITY = 0.002;

  useEffect(() => {
    const canvas = gl.domElement;

    const onPointerLockChange = () => {
      locked.current = document.pointerLockElement === canvas;
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!locked.current) return;
      euler.current.setFromQuaternion(camera.quaternion);
      euler.current.y -= e.movementX * SENSITIVITY;
      euler.current.x -= e.movementY * SENSITIVITY;
      euler.current.x = THREE.MathUtils.clamp(euler.current.x, -Math.PI * 0.49, Math.PI * 0.49);
      camera.quaternion.setFromEuler(euler.current);
    };
    const onKeyDown = (e: KeyboardEvent) => { keys.current[e.code] = true; };
    const onKeyUp = (e: KeyboardEvent) => { keys.current[e.code] = false; };
    const onWheel = (e: WheelEvent) => {
      if (!locked.current) return;
      e.preventDefault();
      speed.current = THREE.MathUtils.clamp(speed.current * (e.deltaY > 0 ? 0.85 : 1.18), 1, 500);
      onSpeedChange?.(speed.current);
    };

    canvas.requestPointerLock();
    document.addEventListener('pointerlockchange', onPointerLockChange);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      document.removeEventListener('pointerlockchange', onPointerLockChange);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
      canvas.removeEventListener('wheel', onWheel);
      if (document.pointerLockElement === canvas) document.exitPointerLock();
      keys.current = {};
    };
  }, [camera, gl, onSpeedChange]);

  const dir = useRef(new THREE.Vector3());
  const right = useRef(new THREE.Vector3());

  useFrame((_, delta) => {
    if (!locked.current) return;
    const k = keys.current;
    const sprint = k['ShiftLeft'] || k['ShiftRight'] ? 3 : 1;
    const move = speed.current * sprint * delta;

    camera.getWorldDirection(dir.current);
    right.current.crossVectors(dir.current, camera.up).normalize();

    if (k['KeyW'] || k['ArrowUp']) camera.position.addScaledVector(dir.current, move);
    if (k['KeyS'] || k['ArrowDown']) camera.position.addScaledVector(dir.current, -move);
    if (k['KeyA'] || k['ArrowLeft']) camera.position.addScaledVector(right.current, -move);
    if (k['KeyD'] || k['ArrowRight']) camera.position.addScaledVector(right.current, move);
    if (k['KeyE'] || k['Space']) camera.position.y += move;
    if (k['KeyQ']) camera.position.y -= move;

    // Clamp
    camera.position.y = Math.max(5, camera.position.y);
  });

  return null;
}

function CameraController({ targetPosition, targetLookAt, freeLook, flyMode }: { targetPosition: [number, number, number]; targetLookAt: [number, number, number]; freeLook: boolean; flyMode: boolean }) {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);
  const targetPos = useRef(new THREE.Vector3(...targetPosition));
  const targetLook = useRef(new THREE.Vector3(...targetLookAt));
  const animating = useRef(false);
  const focusAnimating = useRef(false);
  const initialized = useRef(false);
  const lastPresetKey = useRef('');
  const introPhase = useRef<'hold' | 'sweep' | 'done'>(__cameraIntroPlayed ? 'done' : 'hold');
  const introTimer = useRef(0);

  const WORLD_HALF_EXTENT = 250000;
  const CAMERA_MIN_Y = 5;
  const CAMERA_MAX_Y = 40000;
  const _lastValidY = useRef(-1); // -1 = uninitialized, will sync on first frame
  const _wasClampedLastFrame = useRef(false);
  const _wasDropClampedLastFrame = useRef(false);

  const clampToWorldBounds = useCallback(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    // Skip clamping during flyTo transitions
    if (isFlyingTo()) return;

    const tx = THREE.MathUtils.clamp(controls.target.x, -WORLD_HALF_EXTENT, WORLD_HALF_EXTENT);
    const ty = THREE.MathUtils.clamp(controls.target.y, 0, 50000);
    const tz = THREE.MathUtils.clamp(controls.target.z, -WORLD_HALF_EXTENT, WORLD_HALF_EXTENT);

    let cy = THREE.MathUtils.clamp(camera.position.y, CAMERA_MIN_Y, CAMERA_MAX_Y);

    // Initialize _lastValidY from actual camera position on first frame
    if (_lastValidY.current < 0) {
      _lastValidY.current = cy;
    }

    // Detect teleport/large transition (preset switch, etc.) — reset baseline
    const absDelta = Math.abs(cy - _lastValidY.current);
    if (absDelta > 500) {
      _lastValidY.current = cy; // accept the teleport
    } else {
      // Prevent sudden altitude drops (max 200m per frame) — manual nav only
      const yDelta = cy - _lastValidY.current;
      if (yDelta < -200) {
        cy = _lastValidY.current - 200;
        if (!_wasDropClampedLastFrame.current) {
          console.warn('[Camera] altitude drop clamped');
          _wasDropClampedLastFrame.current = true;
        }
      } else {
        _wasDropClampedLastFrame.current = false;
      }
      // NOTE: altitude-dependent damping removed — it created a feedback loop near ground
    }

    if (cy < CAMERA_MIN_Y + 1 && !_wasClampedLastFrame.current) {
      console.warn('[Camera] altitude clamped to safe floor');
      _wasClampedLastFrame.current = true;
    } else if (cy > CAMERA_MIN_Y + 1) {
      _wasClampedLastFrame.current = false;
    }

    _lastValidY.current = cy;

    const cx = THREE.MathUtils.clamp(camera.position.x, -WORLD_HALF_EXTENT, WORLD_HALF_EXTENT);
    const cz = THREE.MathUtils.clamp(camera.position.z, -WORLD_HALF_EXTENT, WORLD_HALF_EXTENT);

    const targetChanged = tx !== controls.target.x || ty !== controls.target.y || tz !== controls.target.z;
    const cameraChanged = cx !== camera.position.x || cy !== camera.position.y || cz !== camera.position.z;

    if (targetChanged) controls.target.set(tx, ty, tz);
    if (cameraChanged) camera.position.set(cx, cy, cz);
    if (targetChanged || cameraChanged) controls.update();
  }, [camera]);

  // ── Zero-GC: Pre-allocated vectors for intro animation ──
  const introStartPos = useRef(new THREE.Vector3(0, 300, 100));
  const introStartLook = useRef(new THREE.Vector3(0, 0, 0));
  const introDuration = useRef({ hold: 2.5, sweep: 4.0 });
  const _sweepDefaultPos = useRef(new THREE.Vector3());
  const _sweepDefaultLook = useRef(new THREE.Vector3());
  const _sweepStartPos = useRef(new THREE.Vector3(0, 2300, 3));
  const _sweepCurrentTarget = useRef(new THREE.Vector3());

  useEffect(() => {
    if (__cameraIntroPlayed) {
      camera.position.set(...targetPosition);
      if (controlsRef.current) {
        controlsRef.current.target.set(...targetLookAt);
        controlsRef.current.update();
      }
      introPhase.current = 'done';
      return;
    }
    camera.position.copy(introStartPos.current);
    camera.lookAt(introStartLook.current);
    introPhase.current = 'hold';
    introTimer.current = 0;
  }, []);

  const presetKey = `${targetPosition.join(',')}_${targetLookAt.join(',')}`;
  
  useEffect(() => {
    if (freeLook) { animating.current = false; return; }
    if (!initialized.current) {
      initialized.current = true;
      lastPresetKey.current = presetKey;
      return;
    }
    if (presetKey === lastPresetKey.current) return;
    lastPresetKey.current = presetKey;
    targetPos.current.set(...targetPosition);
    targetLook.current.set(...targetLookAt);
    animating.current = true;
  }, [presetKey, freeLook]);

  useFrame((_, delta) => {
    if (introPhase.current !== 'done') {
      introTimer.current += delta;
      
      if (introPhase.current === 'hold') {
        const holdT = Math.min(1, introTimer.current / introDuration.current.hold);
        const eased = easeInOutCubic(holdT);
        const orbitRadius = 3;
        const orbitSpeed = 0.15;
        camera.position.set(
          Math.sin(introTimer.current * orbitSpeed) * orbitRadius,
          2500 - eased * 200,
          Math.cos(introTimer.current * orbitSpeed) * orbitRadius + 0.01
        );
        camera.lookAt(0, 0, 0);
        if (controlsRef.current) {
          controlsRef.current.target.set(0, 0, 0);
          controlsRef.current.update();
        }
        if (introTimer.current >= introDuration.current.hold) {
          introPhase.current = 'sweep';
          introTimer.current = 0;
        }
      } else if (introPhase.current === 'sweep') {
        const sweepT = Math.min(1, introTimer.current / introDuration.current.sweep);
        const eased = easeInOutCubic(sweepT);
        
        // Zero-GC: reuse pre-allocated vectors instead of creating new ones per frame
        _sweepDefaultPos.current.set(targetPosition[0], targetPosition[1], targetPosition[2]);
        _sweepDefaultLook.current.set(targetLookAt[0], targetLookAt[1], targetLookAt[2]);
        
        camera.position.lerpVectors(_sweepStartPos.current, _sweepDefaultPos.current, eased);
        
        if (controlsRef.current) {
          _sweepCurrentTarget.current.lerpVectors(introStartLook.current, _sweepDefaultLook.current, eased);
          controlsRef.current.target.copy(_sweepCurrentTarget.current);
          controlsRef.current.update();
        }
        
        if (sweepT >= 1) {
          introPhase.current = 'done';
          __cameraIntroPlayed = true;
          camera.position.copy(_sweepDefaultPos.current);
          if (controlsRef.current) {
            controlsRef.current.target.copy(_sweepDefaultLook.current);
            controlsRef.current.update();
          }
          animating.current = false;
        }
      }
      clampToWorldBounds();
      return;
    }

    // Normal preset animation — fix operator precedence bug
    if ((!animating.current && !focusAnimating.current) || !controlsRef.current || freeLook) {
      clampToWorldBounds();
      return;
    }
    camera.position.lerp(targetPos.current, focusAnimating.current ? 0.08 : 0.06);
    controlsRef.current.target.lerp(targetLook.current, focusAnimating.current ? 0.08 : 0.06);
    controlsRef.current.update();
    if (camera.position.distanceTo(targetPos.current) < 0.1) {
      animating.current = false;
      focusAnimating.current = false;
    }
    clampToWorldBounds();
  });

  const sensitivityScale = 0.7; // 30% less sensitivity

  // Broadcast OrbitControls ref to GeoCameraController via custom event
  useEffect(() => {
    if (controlsRef.current) {
      window.dispatchEvent(new CustomEvent('r3f-controls-ready', { detail: { controls: controlsRef.current } }));
    }
  });

  // Disable OrbitControls while box-select is active
  useEffect(() => {
    const handler = (e: CustomEvent) => {
      if (controlsRef.current) {
        controlsRef.current.enabled = !e.detail;
      }
    };
    window.addEventListener('box-select-active' as any, handler as any);
    return () => window.removeEventListener('box-select-active' as any, handler as any);
  }, []);

  // Double-click focus: fly camera to a 3D point
  useEffect(() => {
    const _focusCamDir = new THREE.Vector3();
    const handler = (e: Event) => {
      const { x, y, z } = (e as CustomEvent).detail;
      if (controlsRef.current) {
        targetLook.current.set(x, y, z);
        // Zero-GC: reuse pre-allocated vector
        _focusCamDir.subVectors(camera.position, controlsRef.current.target).normalize();
        const dist = Math.max(20, camera.position.distanceTo(controlsRef.current.target) * 0.5);
        targetPos.current.set(x + _focusCamDir.x * dist, Math.max(y + 5, y + _focusCamDir.y * dist), z + _focusCamDir.z * dist);
        focusAnimating.current = true;
      }
    };
    window.addEventListener('focus-camera-on-point', handler);
    return () => window.removeEventListener('focus-camera-on-point', handler);
  }, [camera]);

  // In select mode: disable left-mouse orbit so box-select works exclusively
  const editorMode = useProjectStore(s => s.editorMode);
  const isSelectMode = editorMode === 'select';

  // Update mouse buttons when mode changes
  useEffect(() => {
    if (!controlsRef.current) return;
    if (isSelectMode) {
      controlsRef.current.mouseButtons = {
        LEFT: -1,
        MIDDLE: THREE.MOUSE.ROTATE,
        RIGHT: THREE.MOUSE.PAN,
      };
    } else {
      controlsRef.current.mouseButtons = {
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN,
      };
    }
  }, [isSelectMode]);


  if (flyMode) return null;

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={0.06}
      rotateSpeed={0.6 * sensitivityScale}
      panSpeed={0.8 * sensitivityScale}
      zoomSpeed={1.2 * sensitivityScale}
      minPolarAngle={Math.PI * 0.05}
      maxPolarAngle={Math.PI * 0.75}
      minDistance={2}
      maxDistance={90000}
      enablePan
    />
  );
}

/** Viewport playback controls — always visible at bottom center of 3D viewport */
function ViewportPlaybackControls() {
  const { isPlaying, setPlaying, currentTime, setCurrentTime, duration, playbackSpeed } = useProjectStore();

  const formatTime = (t: number) => {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    const f = Math.floor((t % 1) * 30);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}:${String(f).padStart(2, '0')}`;
  };

  return (
    <div className="absolute bottom-14 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1.5">
      {/* Rewind */}
      <button
        onClick={() => { setCurrentTime(0); setPlaying(false); }}
        className="bg-card/85 backdrop-blur-xl border border-border/25 text-muted-foreground hover:text-foreground hover:bg-card/95 w-8 h-8 rounded-lg flex items-center justify-center transition-all shadow-lg"
        title="Rewind (Home)"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><path d="M1 1h2v10H1V1zm3 5l6 5V1L4 6z"/></svg>
      </button>

      {/* Play/Pause */}
      <button
        onClick={() => setPlaying(!isPlaying)}
        className={cn(
          "backdrop-blur-xl border w-10 h-10 rounded-xl flex items-center justify-center transition-all shadow-lg",
          isPlaying
            ? "bg-primary/20 text-primary border-primary/30 shadow-primary/15"
            : "bg-card/85 text-foreground border-border/25 hover:bg-card/95"
        )}
        title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
      >
        {isPlaying ? (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><rect x="2" y="1" width="3.5" height="12" rx="0.5"/><rect x="8.5" y="1" width="3.5" height="12" rx="0.5"/></svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><path d="M3 1.5v11l9.5-5.5L3 1.5z"/></svg>
        )}
      </button>

      {/* Stop */}
      <button
        onClick={() => { setCurrentTime(0); setPlaying(false); }}
        className="bg-card/85 backdrop-blur-xl border border-border/25 text-muted-foreground hover:text-destructive hover:bg-card/95 w-8 h-8 rounded-lg flex items-center justify-center transition-all shadow-lg"
        title="Stop"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><rect x="1.5" y="1.5" width="9" height="9" rx="1"/></svg>
      </button>

      {/* Time display */}
      <div className="bg-card/85 backdrop-blur-xl border border-border/25 px-3 h-8 rounded-lg flex items-center gap-2 shadow-lg">
        <span className="text-[10px] font-mono-code text-foreground tracking-wider">{formatTime(currentTime)}</span>
        <span className="text-[9px] text-muted-foreground/60">/</span>
        <span className="text-[10px] font-mono-code text-muted-foreground">{formatTime(duration)}</span>
        {playbackSpeed !== 1 && (
          <span className="text-[8px] font-mono-code text-primary ml-1">{playbackSpeed}×</span>
        )}
      </div>

      {/* Progress mini-bar */}
      <div className="bg-card/85 backdrop-blur-xl border border-border/25 w-24 h-8 rounded-lg flex items-center px-2 shadow-lg cursor-pointer"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const pct = Math.max(0, Math.min(1, (e.clientX - rect.left - 8) / (rect.width - 16)));
          setCurrentTime(pct * duration);
        }}
      >
        <div className="relative w-full h-1 bg-border/30 rounded-full overflow-hidden">
          <div
            className="absolute top-0 left-0 h-full bg-primary rounded-full transition-all"
            style={{ width: `${(currentTime / duration) * 100}%` }}
          />
        </div>
      </div>
    </div>
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

/** Site Model Transform Toolbar — Move/Rotate/Scale gizmo mode switcher */
function SiteModelTransformToolbar() {
  const selectedId = useSceneStore((s) => s.selectedSiteModelId);
  const mode = useSceneStore((s) => s.siteModelTransformMode);
  const setMode = useSceneStore((s) => s.setSiteModelTransformMode);
  const selectModel = useSceneStore((s) => s.selectSiteModel);
  const snap = useSceneStore((s) => s.transformSnap);
  const setSnap = useSceneStore((s) => s.setTransformSnap);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedId) {
        selectModel(null);
      }
      if (selectedId) {
        if (e.key === 'g' || e.key === 'G') setMode('translate');
        if (e.key === 'r' || e.key === 'R') setMode('rotate');
        if (e.key === 's' || e.key === 'S') setMode('scale');
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [selectedId, selectModel, setMode]);

  if (!selectedId) return null;

  const modes = [
    { key: 'translate' as const, label: 'Move', icon: '⊞', shortcut: 'G' },
    { key: 'rotate' as const, label: 'Rotate', icon: '↻', shortcut: 'R' },
    { key: 'scale' as const, label: 'Scale', icon: '⤢', shortcut: 'S' },
  ];

  const snapLabel = mode === 'translate' ? `${snap.translateSnap}m` : mode === 'rotate' ? `${snap.rotateSnap}°` : `${snap.scaleSnap}x`;

  return (
    <div className="absolute top-14 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1 bg-card/90 backdrop-blur-xl border border-border/30 rounded-xl px-2 py-1.5 shadow-lg">
      <span className="text-[9px] text-muted-foreground font-mono mr-1">MODEL</span>
      {modes.map((m) => (
        <button
          key={m.key}
          onClick={() => setMode(m.key)}
          className={cn(
            'px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all',
            mode === m.key
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          )}
          title={`${m.label} (${m.shortcut})`}
        >
          {m.icon} {m.label}
        </button>
      ))}
      <div className="w-px h-4 bg-border/40 mx-1" />
      <button
        onClick={() => setSnap({ enabled: !snap.enabled })}
        className={cn(
          'px-2 py-1 rounded-lg text-[10px] font-medium transition-all flex items-center gap-1',
          snap.enabled
            ? 'bg-accent text-accent-foreground'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
        )}
        title={`Snap: ${snap.enabled ? 'ON' : 'OFF'} (${snapLabel})`}
      >
        ⊡ Snap {snap.enabled && <span className="text-[9px] opacity-70">{snapLabel}</span>}
      </button>
      {snap.enabled && (
        <>
          <input
            type="number"
            className="w-12 bg-muted/60 border border-border/30 rounded px-1 py-0.5 text-[10px] text-foreground text-center"
            value={mode === 'translate' ? snap.translateSnap : mode === 'rotate' ? snap.rotateSnap : snap.scaleSnap}
            min={mode === 'scale' ? 0.01 : 1}
            step={mode === 'translate' ? 0.5 : mode === 'rotate' ? 5 : 0.05}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (isNaN(v) || v <= 0) return;
              if (mode === 'translate') setSnap({ translateSnap: v });
              else if (mode === 'rotate') setSnap({ rotateSnap: v });
              else setSnap({ scaleSnap: v });
            }}
            title={mode === 'translate' ? 'Snap distance (m)' : mode === 'rotate' ? 'Snap angle (°)' : 'Snap scale step'}
          />
        </>
      )}
      <div className="w-px h-4 bg-border/40 mx-1" />
      <button
        onClick={() => selectModel(null)}
        className="px-2 py-1 rounded-lg text-[10px] text-muted-foreground hover:bg-destructive/20 hover:text-destructive transition-all"
        title="Deselect (Esc)"
      >
        ✕
      </button>
    </div>
  );
}

/** Camera Bookmarks bar — Finale 3D custom camera shortcuts */
function CameraBookmarksBar({ setActivePreset, setFreeLook }: { setActivePreset: (id: string) => void; setFreeLook: (v: boolean) => void }) {
  const bookmarks = useSceneStore(st => st.environment.cameraBookmarks);
  const removeCameraBookmark = useSceneStore(st => st.removeCameraBookmark);

  if (bookmarks.length === 0) return null;

  return (
    <div className="absolute top-14 left-3 flex items-center gap-1 flex-wrap max-w-[calc(100%-24px)]">
      {bookmarks.map(bm => (
        <div key={bm.id} className="group relative">
          <button
            onClick={() => {
              // Apply bookmark by dispatching a preset change event
              window.dispatchEvent(new CustomEvent('apply-camera-bookmark', { detail: bm }));
              setFreeLook(true);
            }}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-semibold transition-all border backdrop-blur-md bg-card/80 text-muted-foreground border-border/20 hover:text-foreground hover:bg-card/90"
          >
            <Bookmark className="w-3 h-3 text-primary/60" />
            {bm.name}
          </button>
          <button
            onClick={() => removeCameraBookmark(bm.id)}
            className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Trash2 className="w-2.5 h-2.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

/** Bookmark save handler — listens for save events and grabs camera state */
function CameraBookmarkSaver() {
  const { camera } = useThree();
  const addCameraBookmark = useSceneStore(st => st.addCameraBookmark);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      addCameraBookmark({
        id: detail.id,
        name: detail.name,
        position: [camera.position.x, camera.position.y, camera.position.z],
        target: [0, 0, 0], // Will be captured from OrbitControls target
        fov: (camera as THREE.PerspectiveCamera).fov,
      });
    };
    window.addEventListener('save-camera-bookmark', handler);
    return () => window.removeEventListener('save-camera-bookmark', handler);
  }, [camera, addCameraBookmark]);

  // Apply bookmark handler
  useEffect(() => {
    const handler = (e: Event) => {
      const bm = (e as CustomEvent).detail;
      camera.position.set(bm.position[0], bm.position[1], bm.position[2]);
      if ((camera as THREE.PerspectiveCamera).fov !== bm.fov) {
        (camera as THREE.PerspectiveCamera).fov = bm.fov;
        (camera as THREE.PerspectiveCamera).updateProjectionMatrix();
      }
    };
    window.addEventListener('apply-camera-bookmark', handler);
    return () => window.removeEventListener('apply-camera-bookmark', handler);
  }, [camera]);

  return null;
}

export default function SkyCanvas() {
  // Professional keybindings (Finale 3D)
  useKeybindings();
  const editorMode = useProjectStore((s) => s.editorMode);
  const droneFormations = useProjectStore((s) => s.droneFormations);
  const gpsOrigin = useProjectStore((s) => s.gpsOrigin);
  // cursorStyle moved below geoTool declaration
  const [activePreset, setActivePreset] = useState('free');
  const [freeLook, setFreeLook] = useState(false);
  const [flyMode, setFlyMode] = useState(false);
  const [flySpeed, setFlySpeed] = useState(15);
  const flySpeedCb = useCallback((s: number) => setFlySpeed(Math.round(s)), []);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [cameraMenuOpen, setCameraMenuOpen] = useState(false);
  const preset = CAMERA_PRESETS.find((p) => p.id === activePreset) || CAMERA_PRESETS[0];
  const perfStatsRef = useRef<PerfStats>({ fps: 0, drawCalls: 0, triangles: 0, geometries: 0, textures: 0 });
  const droneCount = droneFormations.length > 0 ? droneFormations[0].droneCount : 0;
  const [satelliteTexture, setSatelliteTexture] = useState<string | null>(null);
  const [downloadingScenery, setDownloadingScenery] = useState(false);
  const [canvasInstanceKey, setCanvasInstanceKey] = useState(0);
  const recoveringContextRef = useRef(false);
  const handleContextRemount = useCallback(() => setCanvasInstanceKey(prev => prev + 1), []);
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const environment = useSceneStore(st => st.environment);
  const google3DTilesEnabled = useSceneStore(st => st.settings.google3DTilesEnabled);
  const [showDebugOverlay, setShowDebugOverlay] = useState(false);
  const presentationMode = useSceneStore(st => st.settings.presentationMode);
  // MissionSetupOverlay removed — scene loads immediately

  // Exit fly mode when pointer lock is lost (ESC)
  useEffect(() => {
    const onLockChange = () => {
      if (!document.pointerLockElement && flyMode) setFlyMode(false);
    };
    document.addEventListener('pointerlockchange', onLockChange);
    return () => document.removeEventListener('pointerlockchange', onLockChange);
  }, [flyMode]);

  // Ctrl+Shift+D — toggle debug overlay
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        setShowDebugOverlay(v => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // ═══ Google Earth-style Geo Tools state ═══
  const [geoTool, setGeoTool] = useState<GeoToolMode>('none');
  const [geoMarkers, setGeoMarkers] = useState<GeoMarker[]>([]);
  const [geoRulers, setGeoRulers] = useState<GeoRulerPoint[]>([]);
  const [geoPaths, setGeoPaths] = useState<GeoPath[]>([]);
  const [activeRulerPoints, setActiveRulerPoints] = useState<[number, number, number][]>([]);
  const [activePathPoints, setActivePathPoints] = useState<[number, number, number][]>([]);
  const geoMarkerColorIdx = useRef(0);
  const geoPathColorIdx = useRef(0);
  const MARKER_COLORS = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#ec4899'];
  const cursorStyle = geoTool !== 'none' ? 'crosshair' : editorMode !== 'select' ? 'crosshair' : 'default';

  const handlePlaceMarker = useCallback((pos: [number, number, number]) => {
    const color = MARKER_COLORS[geoMarkerColorIdx.current % MARKER_COLORS.length];
    geoMarkerColorIdx.current++;
    const marker: GeoMarker = {
      id: `gm-${Date.now()}`,
      name: `Marcador ${geoMarkers.length + 1}`,
      position: pos,
      color,
      visible: true,
    };
    setGeoMarkers(prev => [...prev, marker]);
    setGeoTool('none');
    toast.success(`Marcador adicionado`);
  }, [geoMarkers.length]);

  const handlePlaceRulerPoint = useCallback((pos: [number, number, number]) => {
    setActiveRulerPoints(prev => [...prev, pos]);
  }, []);

  const handleFinishRuler = useCallback(() => {
    if (activeRulerPoints.length < 2) return;
    let total = 0;
    for (let i = 0; i < activeRulerPoints.length - 1; i++) {
      const [x1, y1, z1] = activeRulerPoints[i];
      const [x2, y2, z2] = activeRulerPoints[i + 1];
      total += Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2 + (z2 - z1) ** 2);
    }
    const ruler: GeoRulerPoint = {
      id: `gr-${Date.now()}`,
      points: [...activeRulerPoints],
      totalDistance: total,
      visible: true,
      label: `Medição ${geoRulers.length + 1}`,
    };
    setGeoRulers(prev => [...prev, ruler]);
    setActiveRulerPoints([]);
    setGeoTool('none');
    toast.success(`Medição: ${total.toFixed(1)}m`);
  }, [activeRulerPoints, geoRulers.length]);

  const handlePlacePathPoint = useCallback((pos: [number, number, number]) => {
    setActivePathPoints(prev => [...prev, pos]);
  }, []);

  const handleFinishPath = useCallback(() => {
    if (activePathPoints.length < 2) return;
    const colors = ['#3b82f6', '#22c55e', '#a855f7', '#f59e0b', '#ec4899', '#06b6d4'];
    const color = colors[geoPathColorIdx.current % colors.length];
    geoPathColorIdx.current++;
    const path: GeoPath = {
      id: `gp-${Date.now()}`,
      name: geoTool === 'polygon' ? `Polígono ${geoPaths.length + 1}` : `Caminho ${geoPaths.length + 1}`,
      points: [...activePathPoints],
      color,
      visible: true,
      closed: geoTool === 'polygon',
    };
    setGeoPaths(prev => [...prev, path]);
    setActivePathPoints([]);
    setGeoTool('none');
    toast.success(`${path.closed ? 'Polígono' : 'Caminho'} criado com ${path.points.length} pontos`);
  }, [activePathPoints, geoPaths.length, geoTool]);

  // Build active (in-progress) ruler/path for live preview
  const activeRuler: GeoRulerPoint | null = activeRulerPoints.length >= 2 ? {
    id: 'active-ruler',
    points: activeRulerPoints,
    totalDistance: activeRulerPoints.reduce((sum, p, i, arr) => {
      if (i === 0) return 0;
      const [x1, y1, z1] = arr[i - 1];
      const [x2, y2, z2] = p;
      return sum + Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2 + (z2 - z1) ** 2);
    }, 0),
    visible: true,
    label: 'Medindo...',
  } : null;

  const activePath: GeoPath | null = activePathPoints.length >= 2 ? {
    id: 'active-path',
    name: 'Traçando...',
    points: activePathPoints,
    color: '#ffffff',
    visible: true,
    closed: false,
  } : null;

  // Track fullscreen state
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // ESC cancels geo tool
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && geoTool !== 'none') {
        setGeoTool('none');
        setActiveRulerPoints([]);
        setActivePathPoints([]);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [geoTool]);

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

  // Force R3F to re-measure when resizable panels change size (debounced)
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const ro = new ResizeObserver(() => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
      }, 150);
    });
    ro.observe(el);
    return () => {
      if (timer) clearTimeout(timer);
      ro.disconnect();
    };
  }, []);

  return (
    <div ref={containerRef} className="w-full h-full relative bg-black" data-sky-canvas style={{ cursor: cursorStyle }}>
      <WebGLErrorBoundary>
      <Canvas
        key={canvasInstanceKey}
        resize={{ debounce: 50, scroll: false }}
        shadows
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.5,
          powerPreference: 'high-performance',
          alpha: false,
          stencil: false,
          logarithmicDepthBuffer: true,
          outputColorSpace: THREE.SRGBColorSpace,
        }}
        dpr={isMobile ? [1, 1.5] : [1.5, 2]}
        performance={{ min: 0.5 }}
        onCreated={() => {
          recoveringContextRef.current = false;
        }}>
        <PerspectiveCamera makeDefault position={preset.position} fov={60} near={0.1} far={500000} />
        <CameraController targetPosition={[...preset.position]} targetLookAt={[...preset.target]} freeLook={freeLook || flyMode} flyMode={flyMode} />
        {flyMode && <FlyControls onSpeedChange={flySpeedCb} />}

        <ContextLossGuard recoveringRef={recoveringContextRef} onRemount={handleContextRemount} />
        <HardeningWatchdog />
        <FXKQualityController />
        <SceneLighting />
        <GeoTimeOfDaySync />
        <AdaptiveExposureController />
        {!environment.disableLighting && <GlobalIlluminationController />}
        {!google3DTilesEnabled && <GroundReflections />}
        {!environment.disableLighting && <LensFlareController />}
        <DelayedMount delay={2000}>
          <NiagaraVFXController />
        </DelayedMount>

        {/* ═══ Synthetic sky/atmosphere — suppressed in Digital Twin mode ═══ */}
        {!google3DTilesEnabled && <EnvironmentV2Switcher />}

        {!google3DTilesEnabled && <Moon />}
        {!google3DTilesEnabled && <SceneStarsWired />}
        {!google3DTilesEnabled && !isMobile && !environment.lowQualityMode && <AtmosphericParticles />}
        {!google3DTilesEnabled && <SceneFog />}
        {!google3DTilesEnabled && !isMobile && <DelayedMount delay={2500}><WeatherEffects /></DelayedMount>}

        {/* ═══ Ground / Terrain ═══ */}
        {!google3DTilesEnabled && <StageGround satelliteTexture={satelliteTexture} />}
        {google3DTilesEnabled && <GoogleTilesLayer />}
        {google3DTilesEnabled && <GeoCameraController />}
        <GoogleEarthLighting />
        {!google3DTilesEnabled && <FinaleAxesHelper />}
        <DoubleClickFocus />
        <SiteModelRenderer />
        <PositionPins />
        <PyroLaunchAngles />
        <PositionTransformGizmo />
        {!isMobile && <Rack3DView />}
        <TrajectoryPaths />
        {!google3DTilesEnabled && <PyroSafetyZones />}
        <DroneChoreography />
        {!isMobile && <BoidsVisualizer />}
        {!isMobile && <CollisionAvoidanceOverlay config={DEFAULT_AVOIDANCE} />}
        <TimelineEffects />
        <LiveSFXEffects />
        <LaserPreviewBeams />
        {!google3DTilesEnabled && <StageFixtures />}
        {!google3DTilesEnabled && !isMobile && <DelayedMount delay={3000}><AudioSpectrumVisualizer /></DelayedMount>}
        <PlaybackClock />
        {!isMobile && <CameraAnimator />}
        {!isMobile && <CameraPathPreview />}
        {!google3DTilesEnabled && <ViewportRulers />}
        <CameraBookmarkSaver />
        {!google3DTilesEnabled && <ContactShadowsLayer />}
        <PostProcessing activeBurstCount={_activeBurstCount} />
        <StressTestFireworks />
        <PostExplosionSmokeManager />
        <BoxSelectR3F />
        <PerfCollector statsRef={perfStatsRef} />
        <DebugFeed />

        {/* ═══ Google Earth Geo Tools ═══ */}
        <GeoToolsScene
          markers={geoMarkers}
          rulers={[...geoRulers, ...(activeRuler ? [activeRuler] : [])]}
          paths={[...geoPaths, ...(activePath ? [activePath] : [])]}
        />
        <GeoToolClickHandler
          activeTool={geoTool}
          onPlaceMarker={handlePlaceMarker}
          onPlaceRulerPoint={handlePlaceRulerPoint}
          onPlacePathPoint={handlePlacePathPoint}
          onFinishRuler={handleFinishRuler}
          onFinishPath={handleFinishPath}
        />
      </Canvas>
      </WebGLErrorBoundary>
      <TelemetryBar />
      <KeybindingCheatSheet />

      {/* ═══ Google Earth Geo Tools UI ═══ */}
      {!isMobile && (
        <ViewportGeoTools
          activeTool={geoTool}
          onToolChange={(tool) => {
            setGeoTool(tool);
            if (tool === 'none') {
              // finalize any in-progress drawing
              if (activeRulerPoints.length >= 2) handleFinishRuler();
              if (activePathPoints.length >= 2) handleFinishPath();
              setActiveRulerPoints([]);
              setActivePathPoints([]);
            }
          }}
          markers={geoMarkers}
          rulers={geoRulers}
          paths={geoPaths}
          onClearMarkers={() => setGeoMarkers([])}
          onClearRulers={() => setGeoRulers([])}
          onClearPaths={() => setGeoPaths([])}
          onToggleMarkerVisibility={(id) => setGeoMarkers(prev => prev.map(m => m.id === id ? { ...m, visible: !m.visible } : m))}
          onToggleRulerVisibility={(id) => setGeoRulers(prev => prev.map(r => r.id === id ? { ...r, visible: !r.visible } : r))}
          onTogglePathVisibility={(id) => setGeoPaths(prev => prev.map(p => p.id === id ? { ...p, visible: !p.visible } : p))}
          onDeleteMarker={(id) => setGeoMarkers(prev => prev.filter(m => m.id !== id))}
          onDeleteRuler={(id) => setGeoRulers(prev => prev.filter(r => r.id !== id))}
          onDeletePath={(id) => setGeoPaths(prev => prev.filter(p => p.id !== id))}
          onUpdateMarker={(id, updates) => setGeoMarkers(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m))}
          onUpdateRuler={(id, updates) => setGeoRulers(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r))}
          onUpdatePath={(id, updates) => setGeoPaths(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p))}
        />
      )}

      {/* Camera presets & controls — compact top-left */}
      <div className="absolute top-3 left-3 flex items-center gap-1 z-20">
        {/* Free look toggle */}
        <button
          onClick={() => { setFreeLook(!freeLook); if (flyMode) setFlyMode(false); }}
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[10px] font-semibold transition-all border backdrop-blur-md",
            freeLook && !flyMode
              ? "bg-warning/20 text-warning border-warning/30 shadow-lg shadow-warning/10"
              : "bg-card/80 text-muted-foreground border-border/20 hover:text-foreground hover:bg-card/90"
          )}
          title="Free Look"
        >
          <ScanEye className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Look</span>
        </button>

        {/* Fly mode toggle */}
        <button
          onClick={() => { setFlyMode(!flyMode); if (!flyMode) setFreeLook(false); }}
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[10px] font-semibold transition-all border backdrop-blur-md",
            flyMode
              ? "bg-accent/20 text-accent-foreground border-accent/30 shadow-lg shadow-accent/10"
              : "bg-card/80 text-muted-foreground border-border/20 hover:text-foreground hover:bg-card/90"
          )}
          title="Fly Mode (WASD + Mouse)"
        >
          <Navigation className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Fly</span>
        </button>

        {/* 🎥 Camera Views dropdown — unified for desktop & mobile */}
        <div className="relative">
          <button
            onClick={() => setCameraMenuOpen(!cameraMenuOpen)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[10px] font-semibold transition-all border backdrop-blur-md bg-card/80 text-muted-foreground border-border/20 hover:text-foreground hover:bg-card/90"
          >
            <Camera className="w-3.5 h-3.5" />
            <span>{preset.label}</span>
            <ChevronDown className={cn("w-3 h-3 transition-transform", cameraMenuOpen && "rotate-180")} />
          </button>
          {cameraMenuOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setCameraMenuOpen(false)} />
              <div className="absolute top-full left-0 mt-1 z-40 bg-card/95 backdrop-blur-xl border border-border/20 rounded-xl shadow-2xl shadow-black/60 py-1 min-w-[140px]">
                {CAMERA_PRESETS.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => { setActivePreset(id); setFreeLook(false); setCameraMenuOpen(false); }}
                    className={cn(
                      "w-full text-left px-3 py-2 text-[11px] font-medium flex items-center gap-2 rounded-lg mx-0.5 transition-all",
                      activePreset === id && !freeLook
                        ? "text-primary bg-primary/10"
                        : "text-muted-foreground hover:text-foreground hover:bg-surface-1/60"
                    )}
                    style={{ width: 'calc(100% - 4px)' }}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ═══ Mini-Dock — utility tools (top-right glassmorphism cluster) ═══ */}
      {!isMobile && (
        <div className="absolute right-3 top-3 flex flex-col gap-1 bg-card/40 backdrop-blur-sm border border-border/10 rounded-xl p-1 z-20">
          {/* Render Debug */}
          <RenderDebugToggle show={showDebugOverlay} onToggle={() => setShowDebugOverlay(v => !v)} />

          {/* Lock Positions */}
          <button
            onClick={() => {
              const env = useSceneStore.getState().environment;
              useSceneStore.getState().updateEnvironment({ lockPositions: !env.lockPositions });
            }}
            className={cn(
              "w-7 h-7 rounded-md flex items-center justify-center transition-all border",
              useSceneStore.getState().environment.lockPositions
                ? "bg-warning/20 border-warning/40 text-warning"
                : "bg-surface-1/80 border-border/30 text-muted-foreground hover:text-foreground hover:border-border/60"
            )}
            title="Lock/Unlock Positions"
          >
            <Lock className="h-3.5 w-3.5" />
          </button>

          {/* Rulers */}
          <button
            onClick={() => {
              const env = useSceneStore.getState().environment;
              useSceneStore.getState().updateEnvironment({ showRulers: !env.showRulers });
            }}
            className={cn(
              "w-7 h-7 rounded-md flex items-center justify-center transition-all border",
              useSceneStore.getState().environment.showRulers
                ? "bg-primary/20 border-primary/40 text-primary"
                : "bg-surface-1/80 border-border/30 text-muted-foreground hover:text-foreground hover:border-border/60"
            )}
            title="Show Rulers"
          >
            <Ruler className="h-3.5 w-3.5" />
          </button>

          {/* Bookmark */}
          <button
            onClick={() => {
              const id = `bm-${Date.now()}`;
              const name = `View ${useSceneStore.getState().environment.cameraBookmarks.length + 1}`;
              window.dispatchEvent(new CustomEvent('save-camera-bookmark', { detail: { id, name } }));
            }}
            className="w-7 h-7 rounded-md flex items-center justify-center transition-all border bg-surface-1/80 border-border/30 text-muted-foreground hover:text-foreground hover:border-border/60"
            title="Save Camera Bookmark"
          >
            <Bookmark className="h-3.5 w-3.5" />
          </button>

          {/* Download satellite */}
          <button
            onClick={handleDownloadScenery}
            disabled={downloadingScenery}
            className={cn(
              "w-7 h-7 rounded-md flex items-center justify-center transition-all border",
              satelliteTexture
                ? "bg-success/20 border-success/40 text-success"
                : "bg-surface-1/80 border-border/30 text-muted-foreground hover:text-foreground hover:border-border/60"
            )}
            title="Download satellite scenery"
          >
            {downloadingScenery ? (
              <div className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            ) : (
              <Globe className="h-3.5 w-3.5" />
            )}
          </button>

          {/* Presentation */}
          <button
            onClick={() => useSceneStore.getState().updateSettings({ presentationMode: true })}
            className="w-7 h-7 rounded-md flex items-center justify-center transition-all border bg-surface-1/80 border-border/30 text-muted-foreground hover:text-foreground hover:border-border/60"
            title="Presentation Mode"
          >
            <Film className="h-3.5 w-3.5" />
          </button>

          {/* Fullscreen */}
          <button
            onClick={() => {
              const el = document.querySelector('[data-sky-canvas]') as HTMLElement;
              if (!el) return;
              document.fullscreenElement ? document.exitFullscreen() : el.requestFullscreen();
            }}
            className="w-7 h-7 rounded-md flex items-center justify-center transition-all border bg-surface-1/80 border-border/30 text-muted-foreground hover:text-foreground hover:border-border/60"
          >
            {isFullscreen ? <Minimize className="h-3.5 w-3.5" /> : <Maximize className="h-3.5 w-3.5" />}
          </button>
        </div>
      )}

      {/* Camera Bookmarks bar */}
      <CameraBookmarksBar setActivePreset={setActivePreset} setFreeLook={setFreeLook} />

      {/* Site Model Transform Toolbar */}
      <SiteModelTransformToolbar />

      {/* Debug overlay toggle + panel */}
      {!isMobile && showDebugOverlay && <RenderDebugPanel />}

      {/* Fullscreen floating edit menu */}
      {isFullscreen && <FullscreenEditMenu />}

      {/* AI CoPilot Overlay */}
      <AICoPilotOverlay />

      {/* ═══ Debug tools — hidden by default, toggle with Ctrl+Shift+D ═══ */}
      {!isMobile && showDebugOverlay && <PerformanceHUD statsRef={perfStatsRef} droneCount={droneCount} />}
      {!isMobile && showDebugOverlay && <ViewportTerminal />}
      <SelectionStatusBar />
      {!isMobile && <AlignmentTools />}

      {/* ═══ Finale 3D Viewport Tools ═══ */}
      {!isMobile && <FinaleToolbar />}
      {!isMobile && showDebugOverlay && (
        <div className="absolute bottom-20 left-3 z-40">
          <StressTestButton />
        </div>
      )}

      {/* ═══ Viewport Playback Controls ═══ */}
      <ViewportPlaybackControls />

      {/* Fly mode HUD */}
      {flyMode && (
        <div className="absolute bottom-28 left-1/2 -translate-x-1/2 z-40 bg-card/85 backdrop-blur-xl border border-border/25 rounded-xl px-4 py-2 font-mono text-[10px] text-muted-foreground space-y-0.5 select-none pointer-events-none">
          <div className="text-center text-[9px] font-semibold uppercase tracking-wider text-accent-foreground mb-1">✈ Fly Mode</div>
          <div className="flex gap-4">
            <span>WASD Move</span>
            <span>Q/E Up/Down</span>
            <span>Shift Sprint</span>
            <span>Scroll Speed</span>
          </div>
          <div className="text-center text-foreground font-semibold">{flySpeed} m/s</div>
        </div>
      )}

      {/* Bottom info — only visible in debug mode */}
      {!isMobile && showDebugOverlay && (
        <div className="absolute bottom-3 right-3 text-[9px] font-mono-code text-muted-foreground/60 bg-card/70 backdrop-blur-md px-3 py-2 rounded-xl border border-border/15 space-y-0.5">
          <div className="text-[8px] text-muted-foreground/40 tracking-wider font-display">FX KONTROL v3.2 · Minas FX</div>
          <div>{flyMode ? 'WASD: Move · Mouse: Look · Q/E: Up/Down' : 'Orbit: LMB · Pan: MMB · Zoom: Scroll'}</div>
          <div>Box: Alt+Drag · Multi: Shift+Click · Edit: Dbl-Click</div>
          <div>{flyMode ? '✈ Fly Mode' : freeLook ? '🔓 Free Look ON' : '🔒 Preset Lock'}</div>
        </div>
      )}

      {/* Client Presentation Mode */}
      <ClientPresentationMode
        active={presentationMode}
        onExit={() => useSceneStore.getState().updateSettings({ presentationMode: false })}
      />

      {/* MissionSetupOverlay removed — scene loads immediately */}
    </div>
  );
}
