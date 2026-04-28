import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Stars, Grid, PerspectiveCamera, ContactShadows, Sky } from '@react-three/drei';
import { useProjectStore } from '@/store/useProjectStore';
import { EFFECT_LIBRARY } from '@/data/effectLibrary';
import { useSceneStore } from '@/store/useSceneStore';
import React, { useRef, useMemo, useEffect, useState, useCallback, Component, ErrorInfo, ReactNode, lazy, Suspense } from 'react';
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
import { SwarmPlaybackEngine } from './SwarmPlaybackEngine';
import Rack3DView from './Rack3DView';
import BoidsVisualizer from './BoidsVisualizer';
import CollisionAvoidanceOverlay from './CollisionAvoidanceOverlay';
import PyroSafetyZones from './skycanvas/PyroSafetyZones';
import GoogleTilesFallback from './skycanvas/GoogleTilesFallback';
import AudioSpectrumVisualizer from './AudioSpectrumVisualizer';
import LaserPreviewBeams from './LaserPreviewBeams';
import { DEFAULT_AVOIDANCE } from '@/lib/collisionAvoidance';
import QuadcopterModel from './QuadcopterModel';
// GeofenceVisual removed — green squares issue
import SiteModelRenderer from './SiteModelRenderer';
import StageFixtures from './StageFixtures';
import { Camera, Eye, Video, Plane, Users, Maximize, Minimize, AlertTriangle, Globe, Download, ScanEye, Cog, Paintbrush, MapPinned, Film, ChevronDown, Plus, Lock, Ruler, Bookmark, Trash2, Navigation } from 'lucide-react';
import TacticalDock from './TacticalDock';
import ViewportConfigMenu from './ViewportConfigMenu';
import JoiStatusMonitor from './JoiStatusMonitor';
import SelectionStatusBar from './SelectionStatusBar';
import AICoPilotOverlay from './AICoPilotOverlay';
import TelemetryBar from './TelemetryBar';
import GoogleTilesLoadingOverlay from './GoogleTilesLoadingOverlay';
import HUDCrosshairs from './HUDCrosshairs';
import PlacingModeOverlay from './PlacingModeOverlay';
import ARCompassHUD from './ARCompassHUD';
import ARScanEffect from './ARScanEffect';
import ViewportBar from './ViewportBar';
import { useViewportStore } from '@/store/useViewportStore';

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
import TerrainCacheMetricsPanel from './TerrainCacheMetricsPanel';
import SkyCanvasDiagnosticsPanel from './SkyCanvasDiagnosticsPanel';
import GpuRendererDiagnosticsPanel from './GpuRendererDiagnosticsPanel';
import { setActiveRenderer } from '@/lib/activeRendererRegistry';
import { logWebglEvent } from '@/lib/webglEventLog';
import { captureSkyCanvasError } from '@/lib/skyCanvasDiagnostics';
import SimplifiedSkyFallback, { detectWebGLCapability } from './SimplifiedSkyFallback';
import { clampNiagaraHDR, getNiagaraBudgets, setAdaptivePipelineState } from '@/lib/niagaraBlenderRules';
// ═══ Hardening Engine ═══
import {
  reportCrash, resetCrashRecord, getCrashRecord, isInCooldown, recordContextLoss,
  watchdogTick, pushFrameMetrics, startMetricsReporting, stopMetricsReporting,
  scanSceneTransforms, checkFrameBudget, checkSceneHealth, deepDispose, disposeAllTracked,
  getDegradationLevel, onDegradationChange,
} from '@/lib/hardening';
// ═══ FXK Ultra Refinement — Adaptive Quality + Render Stability ═══
import { useFXKUltraRefinement } from '@/hooks/useFXKUltraRefinement';
import { getDeviceProfile } from '@/lib/deviceCapability';
// ═══ QA Validation Engine — Camada 6 ═══
import { qaEngine } from '@/core/pyrosim/QAValidationEngine';
import type { FrameMetrics as QAFrameMetrics } from '@/core/pyrosim/QAValidationEngine';
// ═══ Shared state (lightweight, no components) ═══
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
} from './skycanvas/sharedState';

// ═══ Lazy-loaded subsystem chunks ═══
const lzc = (loader: () => Promise<{ default: React.ComponentType<any> }>) => lazy(loader);
const lzn = <T extends React.ComponentType<any>>(loader: () => Promise<{ [key: string]: any }>, name: string) =>
  lazy(() => loader().then(m => ({ default: m[name] as T })));

// GroundSystem chunk
const Moon = lzn(() => import('./skycanvas/GroundSystem'), 'Moon');
const AtmosphericParticles = lzn(() => import('./skycanvas/GroundSystem'), 'AtmosphericParticles');
const StageGround = lzn(() => import('./skycanvas/GroundSystem'), 'StageGround');

// FireworkRenderer chunk
const TimelineEffects = lzn(() => import('./skycanvas/FireworkRenderer'), 'TimelineEffects');
const LiveSFXEffects = lzn(() => import('./skycanvas/FireworkRenderer'), 'LiveSFXEffects');

// LightingSystem chunk
const AdaptiveExposureController = lzn(() => import('./skycanvas/LightingSystem'), 'AdaptiveExposureController');
const ContactShadowsLayer = lzn(() => import('./skycanvas/LightingSystem'), 'ContactShadowsLayer');
const DebugFeed = lzn(() => import('./skycanvas/LightingSystem'), 'DebugFeed');
const GlobalIlluminationController = lzn(() => import('./skycanvas/LightingSystem'), 'GlobalIlluminationController');
const LensFlareController = lzn(() => import('./skycanvas/LightingSystem'), 'LensFlareController');
const GroundReflections = lzn(() => import('./skycanvas/LightingSystem'), 'GroundReflections');

// estimateFireworkStarCost is a function, import eagerly from barrel (tiny)
import { estimateFireworkStarCost } from './skycanvas/FireworkRenderer';

// Re-export for external consumers
export function getActiveBurstCount() { return _getActiveBurstCount(); }

// Module-level refs shared between SkyGradient / AdaptiveExposure / fireworks
const _skyScatterUniforms_local: { uExplosionScatter: { value: THREE.Color }; uScatterIntensity: { value: number } } | null = null;
const _adaptiveExposure_local = 1.2;
const _activeBurstScan_local: ActiveBurstScanResult | null = null;

// lumaTonemapScale REMOVED — PostProcessing ACES Filmic is the single tonemap pass

// --- DroneRendererSwitch: conditional PBR vs Tactical engine ---
function DroneRendererSwitch() {
  const mode = useSceneStore(s => s.environment.droneRendererMode);
    const droneFormations = useProjectStore(s => s.droneFormations);
  const currentTime = useProjectStore(s => s.currentTime);

  // Bridge formations → SwarmAgent format (always computed to respect hooks rules)
  const agents = React.useMemo(() => {
    if (!droneFormations.length) return [];
    const count = droneFormations[0].droneCount;
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      path: droneFormations.flatMap(f => {
        const p = f.points[i];
        if (!p) return [];
        return [{ x: p.x, y: f.height - p.z, z: 0, time: f.startTime + f.transitionDuration }];
      }),
      colors: droneFormations.map(f => {
        const hex = f.color || '#ffffff';
        const r = parseInt(hex.slice(1, 3), 16) / 255;
        const g = parseInt(hex.slice(3, 5), 16) / 255;
        const b = parseInt(hex.slice(5, 7), 16) / 255;
        return { r, g, b, time: f.startTime, duration: f.transitionDuration + f.holdDuration };
      }),
      duration: droneFormations[droneFormations.length - 1].startTime + droneFormations[droneFormations.length - 1].transitionDuration + droneFormations[droneFormations.length - 1].holdDuration,
    }));
  }, [droneFormations]);

  if (mode === 'swarm') {
    if (!agents.length) return null;
    return <SwarmPlaybackEngine agents={agents} manualTime={currentTime} isPlaying={false} />;
  }
  return <DroneChoreography />;
}

// --- Playback clock (wired through DeterministicClock → LockstepEngine → ExecutionBridge) ---
import { deterministicClock } from '@/core/time/deterministicClock';
import { lockstep } from '@/core/reliability/lockstepEngine';
import { executionBridge } from '@/core/execution/executionBridge';
import { frameSyncEngine } from '@/core/sync/frameSyncEngine';
import { useTimelineClockHealthCheck } from '@/hooks/useTimelineClockHealthCheck';

/** Invisible component that watches `timelineClock.time` for stalls and forces
 *  the lockstep playback fallback if the clock freezes while `isPlaying`. */
const TimelineClockWatchdog = () => {
  useTimelineClockHealthCheck();
  return null;
};

const PlaybackClock = React.forwardRef<any>(function PlaybackClock(_props, _ref) {
    const isPlaying = useProjectStore(s => s.isPlaying);
  const currentTime = useProjectStore(s => s.currentTime);
  const duration = useProjectStore(s => s.duration);
  const setCurrentTime = useProjectStore(s => s.setCurrentTime);
  const setPlaying = useProjectStore(s => s.setPlaying);
  const playbackSpeed = useProjectStore(s => s.playbackSpeed);
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

    // NOTE: `executionBridge` is registered exclusively by `EngineProvider`
    // (priority 150). Do NOT re-register it here — duplicate registrations
    // log a [Lockstep] warning and silently no-op the second one.

    // Start the deterministic clock and lockstep
    deterministicClock.start();
    lockstep.start();

    // Wire clock → frameSyncEngine → lockstep: frame-aligned time feeds lockstep
    deterministicClock.onTick((_time: number, delta: number) => {
      // Pass delta directly — deterministic clock already applies drift correction.
      // Previous double-call to getSyncedTimeSec corrupted internal correction state.
      lockstep.tick(delta);
    });

    return () => {
      lockstep.unregister('playback');
      // executionBridge unregister handled by EngineProvider (sole owner).
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
  const { gl, scene } = useThree();
  const frameRef = useRef(0);
  const overBudgetStreakRef = useRef(0);

  // Start metrics console reporting on mount
  useEffect(() => {
    startMetricsReporting(60); // Log every 60s
    return () => stopMetricsReporting();
  }, []);

  // Connect hardening degradation to quality system
  useEffect(() => {
    const unsub = onDegradationChange((level) => {
      if (level === 'severe' || level === 'critical') {
        const store = useSceneStore.getState();
        if (!store.environment.lowQualityMode) {
          store.updateEnvironment({ lowQualityMode: true });
          pushLog(`[Hardening] Degradation ${level} → forcing low quality mode`, 'warn');
        }
      }
    });
    return unsub;
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

    // ── QA Validation: feed per-frame metrics ──
    const scan = getActiveBurstScan();
    const qaMetrics: QAFrameMetrics = {
      meanLuminance: scan ? Math.min(scan.luminance / 5.0, 1.0) : 0,
      peakLuminance: scan ? Math.min(scan.luminance, 10.0) : 0,
      meanVelocity: 0, // populated by sim core if available
      particleCount: scan ? scan.activeBursts * 200 : 0,
      frameTimeMs,
      gcCollections: 0,
      smokePuffCount: scan ? scan.activeBursts : 0,
      meanSmokeOpacity: scan ? Math.min(scan.scatterMax, 1.0) : 0,
    };
    qaEngine.recordFrame(qaMetrics);

    // ── Scene transform integrity scan (throttled internally to every 60 frames)
    scanSceneTransforms(scene);

    // ── Frame budget check
    const budgetCheck = checkFrameBudget(frameTimeMs, info.calls, info.triangles);
    if (!budgetCheck.withinBudget) {
      overBudgetStreakRef.current++;
      if (overBudgetStreakRef.current >= 3) {
        pushLog(`[Hardening] Over budget: frame=${frameTimeMs.toFixed(1)}ms draws=${info.calls} tris=${info.triangles}`, 'warn');
        overBudgetStreakRef.current = 0;
      }
    } else {
      overBudgetStreakRef.current = 0;
    }

    // ── Scene health check (every ~5s = 300 frames)
    if (frameRef.current % 300 === 0) {
      const health = checkSceneHealth(gl);
      if (health.warnings.length > 0) {
        health.warnings.forEach(w => pushLog(`[GPU Health] ${w}`, 'warn'));
      }
    }
  });

  // ── QA Report hotkey: Ctrl+Shift+Q ──
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'Q') {
        e.preventDefault();
        const report = qaEngine.generateReport('continuous');
        console.group(`%c[QA Report] Grade: ${report.overallGrade} (${(report.overallScore * 100).toFixed(1)}%)`, 'color: #0ff; font-weight: bold; font-size: 14px');
        console.log(`Mode: ${report.mode} | Pass: ${report.passCount}/${report.passCount + report.failCount}`);
        console.table(report.criteria.map(c => ({
          Criterion: c.criterion.name,
          Score: (c.score * 100).toFixed(1) + '%',
          Grade: c.grade,
          Pass: c.pass ? '✅' : '❌',
          Notes: c.notes,
        })));
        if (report.temporal) {
          console.log(`Temporal: meanΔ=${report.temporal.meanBrightnessDelta.toFixed(4)} maxFlicker=${report.temporal.maxFlicker.toFixed(4)} score=${report.temporal.score.toFixed(3)}`);
        }
        if (report.recommendations.length > 0) {
          console.log('%cRecommendations:', 'color: #ff0; font-weight: bold');
          report.recommendations.forEach(r => console.log(`  → ${r}`));
        }
        console.groupEnd();
        pushLog(`[QA] Report: ${report.overallGrade} (${(report.overallScore * 100).toFixed(1)}%) — ${report.passCount}/${report.passCount + report.failCount} pass`, 'info');
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

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
 * ContextLossGuard — handles WebGL context loss/restore with proper cleanup
 * and automatic, progressive recovery (backoff + per-attempt degradation).
 *
 * Recovery strategy
 * ─────────────────
 *  attempt 1 → wait 250ms → remount Canvas, keep current quality
 *  attempt 2 → wait 1000ms → force lowQualityMode + halve bloomStrength
 *  attempt 3 → wait 4000ms → also drop GPGPU/heavy shaders
 *  ≥4         → enter cooldown, schedule auto-retry when cooldown expires
 *
 * Each step also disposes scene resources (deepDispose + disposeAllTracked +
 * resetPools) to release GPU memory before requesting a fresh context.
 *
 * If `webglcontextrestored` fires natively we treat that as the authoritative
 * "recovered" signal; otherwise the new <Canvas> instance's onCreated clears
 * `recoveringRef`. A toast informs the operator throughout.
 */
function ContextLossGuard({ recoveringRef, onRemount, onUnrecoverable, onRecovered }: {
  recoveringRef: React.MutableRefObject<boolean>;
  onRemount: () => void;
  onUnrecoverable?: (reason: string) => void;
  onRecovered?: () => void;
}) {
  const { gl, scene } = useThree();
  // Per-mount attempt counter — pruned to a 60s window so isolated incidents
  // don't permanently degrade the renderer.
  const attemptTimestampsRef = useRef<number[]>([]);
  const scheduledTimerRef = useRef<number | null>(null);
  // Tracks whether this guard (and therefore the parent <Canvas>) is still mounted.
  // Prevents scheduled remounts from firing into a torn-down React tree (e.g. when
  // the user navigates away from /studio during the recovery backoff window).
  const mountedRef = useRef(true);
  // Hard re-entry guard for `onLost`. Some drivers fire `webglcontextlost`
  // multiple times in rapid succession while disposing GPGPU FBOs — without
  // this gate each event would schedule its own remount, producing a storm of
  // competing Canvas instances all trying to acquire a fresh GL context.
  const recoveryInFlightRef = useRef(false);

  useEffect(() => {
    const canvas = gl.domElement;
    mountedRef.current = true;

    const RECOVERY_WINDOW_MS = 60_000;
    // Backoff per attempt (ms). Index = attempt number - 1.
    const BACKOFF_LADDER = [250, 1000, 4000];

    const clearScheduledTimer = () => {
      if (scheduledTimerRef.current !== null) {
        window.clearTimeout(scheduledTimerRef.current);
        scheduledTimerRef.current = null;
      }
    };

    const performRecovery = (attemptInWindow: number) => {
      // Telemetry — every attempt is captured with attempt number.
      captureSkyCanvasError(
        'WebGLContextLoss',
        new Error(`WebGL context lost (auto-recovery attempt #${attemptInWindow})`),
      );
      logWebglEvent('remount-attempt', `attempt #${attemptInWindow}`);

      // Per-attempt degradation: turn the visual budget down progressively.
      try {
        const store = useSceneStore.getState();
        if (attemptInWindow >= 2 && !store.environment.lowQualityMode) {
          store.updateEnvironment({ lowQualityMode: true });
          pushLog('[FXK Recovery] Forced lowQualityMode after 2nd context loss', 'warn');
        }
        if (attemptInWindow >= 2) {
          const cur = store.settings.bloomStrength ?? 1.0;
          if (cur > 0.25) store.updateSettings({ bloomStrength: Math.max(0.2, cur * 0.5) });
        }
        if (attemptInWindow >= 3) {
          // Final-stage degradation: kill heavy effects entirely.
          store.updateSettings({ bloomStrength: 0 });
        }
      } catch (storeErr) {
        console.warn('[FXK Recovery] Could not apply degradation:', storeErr);
      }

      // Deep dispose scene resources before remount to release GPU memory.
      try {
        deepDispose(scene);
        disposeAllTracked();
        pushLog(`[FXK Recovery] Deep disposed scene before attempt #${attemptInWindow}`, 'warn');
      } catch (disposeErr) {
        console.warn('[FXK Recovery] Error during deep dispose:', disposeErr);
      }
      try { resetPools(); } catch { /* ignore */ }

      const delayMs = BACKOFF_LADDER[Math.min(attemptInWindow - 1, BACKOFF_LADDER.length - 1)];
      console.warn(`[FXK Recovery] Remounting WebGL renderer in ${delayMs}ms (attempt #${attemptInWindow})`);
      toast.message('Recuperando viewport 3D…', {
        description: `Recriando renderer (tentativa ${attemptInWindow})`,
        duration: Math.max(delayMs + 1500, 2500),
        id: 'fxk-webgl-recovery',
      });

      // Always cancel any previously-scheduled remount before queuing a new one.
      // Without this, a cooldown-path schedule followed by a direct path schedule
      // (or vice versa) would fire two `onRemount()` calls back-to-back, each
      // mounting a fresh <Canvas> while the previous one is still releasing GPU
      // memory — the exact "competing instances" failure mode.
      clearScheduledTimer();
      scheduledTimerRef.current = window.setTimeout(() => {
        scheduledTimerRef.current = null;
        if (!mountedRef.current) {
          // Parent route (e.g. /studio) unmounted while we were waiting — do
          // nothing. The next visit will start fresh.
          recoveryInFlightRef.current = false;
          return;
        }
        recoveringRef.current = true;
        onRemount();
      }, delayMs);
    };

    const onLost = (e: Event) => {
      e.preventDefault();
      // Two layers of re-entry protection:
      //  1. `recoveringRef` — set after a remount has been triggered.
      //  2. `recoveryInFlightRef` — set the moment we *accept* a loss event,
      //     so duplicate `webglcontextlost` events fired during disposal
      //     (common on Mesa/ANGLE drivers) cannot queue parallel recoveries.
      if (recoveringRef.current || recoveryInFlightRef.current) return;
      recoveryInFlightRef.current = true;

      recordContextLoss();
      logWebglEvent('lost');

      // Prune old attempts outside the rolling window.
      const now = Date.now();
      attemptTimestampsRef.current = attemptTimestampsRef.current.filter(
        (t) => now - t < RECOVERY_WINDOW_MS,
      );
      attemptTimestampsRef.current.push(now);
      const attemptInWindow = attemptTimestampsRef.current.length;

      const shouldRecover = reportCrash();
      if (!shouldRecover || isInCooldown()) {
        const cooldownUntil = getCrashRecord().cooldownUntil;
        const waitMs = Math.max(0, cooldownUntil - now);
        console.error(
          `[FXK Recovery] In cooldown — auto-retry scheduled in ${(waitMs / 1000).toFixed(1)}s`,
        );
        toast.warning('Viewport 3D em cooldown', {
          description: `Tentativa automática em ${Math.ceil(waitMs / 1000)}s`,
          duration: Math.max(waitMs + 500, 3000),
          id: 'fxk-webgl-recovery',
        });
        onUnrecoverable?.(
          `WebGL context loss storm — automatic retry in ${Math.ceil(waitMs / 1000)}s. ` +
          `You can also click Retry to recover immediately.`
        );
        clearScheduledTimer();
        scheduledTimerRef.current = window.setTimeout(() => {
          scheduledTimerRef.current = null;
          if (!mountedRef.current) {
            recoveryInFlightRef.current = false;
            return;
          }
          // Reset the cooldown record so the next attempt isn't immediately
          // re-classified as "in cooldown". We keep our local attemptInWindow
          // counter so degradation still escalates.
          resetCrashRecord();
          performRecovery(attemptInWindow);
        }, waitMs + 250);
        return;
      }

      performRecovery(attemptInWindow);
    };

    const onRestored = () => {
      console.log('[FXK Recovery] WebGL context restored');
      recoveringRef.current = false;
      recoveryInFlightRef.current = false;
      logWebglEvent('restored');
      toast.success('Viewport 3D recuperado', {
        id: 'fxk-webgl-recovery',
        duration: 2500,
      });
      onRecovered?.();
    };

    canvas.addEventListener('webglcontextlost', onLost as EventListener);
    canvas.addEventListener('webglcontextrestored', onRestored as EventListener);
    return () => {
      mountedRef.current = false;
      canvas.removeEventListener('webglcontextlost', onLost as EventListener);
      canvas.removeEventListener('webglcontextrestored', onRestored as EventListener);
      clearScheduledTimer();
      // If the guard tears down mid-recovery, release the in-flight latch so a
      // future mount can accept loss events again.
      recoveryInFlightRef.current = false;
    };
  }, [gl, scene, recoveringRef, onRemount, onUnrecoverable, onRecovered]);

  return null;
}

/**
 * SubsystemBoundary — isolates heavy R3F subsystems so one crash doesn't take down the viewport.
 */
class SubsystemBoundary extends Component<{ name: string; children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[FXK SubsystemBoundary:${this.props.name}]`, error, info.componentStack);
    pushLog(`[SubsystemBoundary] ${this.props.name} crashed: ${error.message}`, 'error');
    captureSkyCanvasError(`SubsystemBoundary:${this.props.name}`, error, info.componentStack ?? undefined);
  }
  render() {
    if (this.state.hasError) return null; // Silently remove crashed subsystem from scene
    return this.props.children;
  }
}

// Module-level refs — local aliases for backward compat within this file
const _skyScatterUniforms: { uExplosionScatter: { value: THREE.Color }; uScatterIntensity: { value: number } } | null = null;
const _adaptiveExposure = 1.2;
const _activeBurstScan: ActiveBurstScanResult | null = null;
const _activeBurstCount = 0;

// FireworkBurst, LightPoint, estimateFireworkStarCost, TimelineEffects, LiveSFXEffects
// → Extracted to skycanvas/FireworkRenderer.tsx

// ════════════════════════════════════════════════════════════════════════
// SkyEnvironment chunk (lazy)
const EnvironmentV2SwitcherClean = lzn(() => import('./skycanvas/SkyEnvironment'), 'EnvironmentV2Switcher');
const SceneFogClean = lzn(() => import('./skycanvas/SkyEnvironment'), 'SceneFog');
const SceneStarsWiredClean = lzn(() => import('./skycanvas/SkyEnvironment'), 'SceneStarsWired');
import { evaluateTimeOfDay } from '@/render_ultra/environment/timeOfDay';

// SkyGradient fallback for EnvironmentV2Switcher — no synthetic sky in Google Earth mode
function SkyGradientFallback() {
  return null;
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
  const updateSettings = useSceneStore(s => s.updateSettings);
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

// WeatherSystem chunk (lazy)
const WeatherEffects = lzn(() => import('./skycanvas/WeatherSystem'), 'WeatherEffects');

// Delayed mount wrapper — lets base renderer stabilize before heavy VFX
/**
 * DelayedMount — defers heavy subsystems until the browser is idle
 * (or after `delay` ms as a fallback). Lets first paint happen with
 * the bare scene, then progressively mounts FX in idle slices.
 */
function DelayedMount({ delay = 2000, children }: { delay?: number; children: ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    let idleId: number | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number }).requestIdleCallback;
    const cic = (window as unknown as { cancelIdleCallback?: (id: number) => void }).cancelIdleCallback;
    if (typeof ric === 'function') {
      idleId = ric(() => { if (!cancelled) setReady(true); }, { timeout: Math.max(delay, 500) });
    } else {
      timeoutId = setTimeout(() => { if (!cancelled) setReady(true); }, delay);
    }
    return () => {
      cancelled = true;
      if (idleId !== null && typeof cic === 'function') cic(idleId);
      if (timeoutId !== null) clearTimeout(timeoutId);
    };
  }, [delay]);
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

/** GroundControls — WASD walk mode with altitude locked to terrain + 1.7m */
function GroundControls({ onSpeedChange }: { onSpeedChange?: (speed: number) => void }) {
  const { camera, gl, scene } = useThree();
  const keys = useRef<Record<string, boolean>>({});
  const euler = useRef(new THREE.Euler(0, 0, 0, 'YXZ'));
  const speed = useRef(5);
  const locked = useRef(false);
  const lastTerrainY = useRef<number | null>(null);
  const raycastFn = useRef<typeof import('@/core/geo/terrainQuery').raycastTerrainLocal | null>(null);
  const SENSITIVITY = 0.002;
  const EYE_HEIGHT = 1.7;
  const PITCH_LIMIT = Math.PI * 0.44; // ±80°

  useEffect(() => {
    import('@/core/geo/terrainQuery').then(mod => {
      raycastFn.current = mod.raycastTerrainLocal;
    });
  }, []);

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
      euler.current.x = THREE.MathUtils.clamp(euler.current.x, -PITCH_LIMIT, PITCH_LIMIT);
      camera.quaternion.setFromEuler(euler.current);
    };
    const onKeyDown = (e: KeyboardEvent) => { keys.current[e.code] = true; };
    const onKeyUp = (e: KeyboardEvent) => { keys.current[e.code] = false; };
    const onWheel = (e: WheelEvent) => {
      if (!locked.current) return;
      e.preventDefault();
      speed.current = THREE.MathUtils.clamp(speed.current * (e.deltaY > 0 ? 0.85 : 1.18), 0.5, 50);
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
  const flatDir = useRef(new THREE.Vector3());

  useFrame((_, delta) => {
    if (!locked.current) return;
    const k = keys.current;
    const sprint = k['ShiftLeft'] || k['ShiftRight'] ? 2.5 : 1;
    const move = speed.current * sprint * delta;

    // Get camera forward projected onto XZ plane (no vertical movement)
    camera.getWorldDirection(dir.current);
    flatDir.current.set(dir.current.x, 0, dir.current.z).normalize();
    right.current.crossVectors(flatDir.current, camera.up).normalize();

    if (k['KeyW'] || k['ArrowUp']) camera.position.addScaledVector(flatDir.current, move);
    if (k['KeyS'] || k['ArrowDown']) camera.position.addScaledVector(flatDir.current, -move);
    if (k['KeyA'] || k['ArrowLeft']) camera.position.addScaledVector(right.current, -move);
    if (k['KeyD'] || k['ArrowRight']) camera.position.addScaledVector(right.current, move);

    // Raycast terrain and lock altitude
    if (raycastFn.current) {
      const terrainY = raycastFn.current(camera.position.x, camera.position.z, scene);
      if (terrainY !== null) {
        lastTerrainY.current = terrainY;
        camera.position.y = THREE.MathUtils.lerp(camera.position.y, terrainY + EYE_HEIGHT, 0.15);
      } else if (lastTerrainY.current !== null) {
        camera.position.y = THREE.MathUtils.lerp(camera.position.y, lastTerrainY.current + EYE_HEIGHT, 0.15);
      } else {
        camera.position.y = Math.max(5, camera.position.y);
      }
    } else {
      camera.position.y = Math.max(5, camera.position.y);
    }
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
  const userInteracted = useRef(__cameraIntroPlayed);

  const WORLD_HALF_EXTENT = 250000;
  const CAMERA_MIN_Y = 5;
  const CAMERA_MAX_Y = 40000;
  const _lastValidY = useRef(-1);
  const _wasClampedLastFrame = useRef(false);
  const _wasDropClampedLastFrame = useRef(false);

  const clampToWorldBounds = useCallback(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    if (isFlyingTo()) return;

    const tx = THREE.MathUtils.clamp(controls.target.x, -WORLD_HALF_EXTENT, WORLD_HALF_EXTENT);
    const ty = THREE.MathUtils.clamp(controls.target.y, 0, 50000);
    const tz = THREE.MathUtils.clamp(controls.target.z, -WORLD_HALF_EXTENT, WORLD_HALF_EXTENT);

    const cy = THREE.MathUtils.clamp(camera.position.y, CAMERA_MIN_Y, CAMERA_MAX_Y);
    _lastValidY.current = cy;

    const cx = THREE.MathUtils.clamp(camera.position.x, -WORLD_HALF_EXTENT, WORLD_HALF_EXTENT);
    const cz = THREE.MathUtils.clamp(camera.position.z, -WORLD_HALF_EXTENT, WORLD_HALF_EXTENT);

    const targetChanged = tx !== controls.target.x || ty !== controls.target.y || tz !== controls.target.z;
    const cameraChanged = cx !== camera.position.x || cy !== camera.position.y || cz !== camera.position.z;

    if (targetChanged) controls.target.set(tx, ty, tz);
    if (cameraChanged) camera.position.set(cx, cy, cz);
    // Do NOT call controls.update() here — it creates artificial momentum.
    // OrbitControls already updates itself internally each frame.
  }, [camera]);

  // ── Zero-GC: Pre-allocated vectors for intro animation ──
  const introStartPos = useRef(new THREE.Vector3(-80, 140, 320));
  const introStartLook = useRef(new THREE.Vector3(0, 5, 0));
  const introDuration = useRef({ hold: 1.8, sweep: 3.0 });
  const _sweepDefaultPos = useRef(new THREE.Vector3());
  const _sweepDefaultLook = useRef(new THREE.Vector3());
  const _sweepStartPos = useRef(new THREE.Vector3(60, 100, 220));
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

  // Cancel intro on first manual mouse interaction
  useEffect(() => {
    const cancelIntro = () => {
      if (userInteracted.current) return;
      userInteracted.current = true;
      if (introPhase.current !== 'done') {
        introPhase.current = 'done';
        __cameraIntroPlayed = true;
        // Snap to default position immediately
        camera.position.set(...targetPosition);
        if (controlsRef.current) {
          controlsRef.current.target.set(...targetLookAt);
          controlsRef.current.update();
        }
        animating.current = false;
      }
    };
    const canvas = document.querySelector('[data-sky-canvas] canvas');
    if (canvas) {
      canvas.addEventListener('pointerdown', cancelIntro, { once: true });
      canvas.addEventListener('wheel', cancelIntro, { once: true });
    }
    return () => {
      if (canvas) {
        canvas.removeEventListener('pointerdown', cancelIntro);
        canvas.removeEventListener('wheel', cancelIntro);
      }
    };
  }, [camera, targetPosition, targetLookAt]);

  // ── Gizmo dragging: disable/enable OrbitControls + zero residual velocity ──
  useEffect(() => {
    const handler = (e: Event) => {
      const isDragging = (e as CustomEvent).detail;
      if (controlsRef.current) {
        controlsRef.current.enabled = !isDragging;
        if (!isDragging) {
          // Zero any residual damping velocity by calling update with reset
          controlsRef.current.update();
        }
      }
    };
    window.addEventListener('gizmo-dragging', handler as any);
    return () => window.removeEventListener('gizmo-dragging', handler as any);
  }, []);

  // ── View preset handler ──
  useEffect(() => {
    const handler = (e: Event) => {
      const { position, target } = (e as CustomEvent).detail as { position: [number, number, number]; target: [number, number, number] };
      targetPos.current.set(position[0], position[1], position[2]);
      targetLook.current.set(target[0], target[1], target[2]);
      animating.current = true;
    };
    window.addEventListener('viewport-set-view', handler as any);
    return () => window.removeEventListener('viewport-set-view', handler as any);
  }, []);

  // ── Cancel animation handler ──
  useEffect(() => {
    const handler = () => {
      animating.current = false;
      focusAnimating.current = false;
    };
    window.addEventListener('viewport-cancel-animation', handler);
    return () => window.removeEventListener('viewport-cancel-animation', handler);
  }, []);

  // ── Frame selection handler ──
  useEffect(() => {
    const handler = () => {
      // If there's a selected position, focus on it
      const { selectedPositionId, positions } = useProjectStore.getState();
      if (selectedPositionId) {
        const pos = positions.find(p => p.id === selectedPositionId);
        if (pos) {
          window.dispatchEvent(new CustomEvent('focus-camera-on-point', { detail: { x: pos.x, y: pos.y || 0, z: pos.z } }));
        }
      }
    };
    window.addEventListener('viewport-frame-selection', handler);
    return () => window.removeEventListener('viewport-frame-selection', handler);
  }, []);

  // ── Frame all handler ──
  useEffect(() => {
    const handler = () => {
      const { positions } = useProjectStore.getState();
      if (positions.length === 0) {
        // Reset to default
        targetPos.current.set(...targetPosition);
        targetLook.current.set(...targetLookAt);
        animating.current = true;
        return;
      }
      // Compute bounding box center
      let cx = 0, cy = 0, cz = 0;
      for (const p of positions) {
        cx += p.x; cy += (p.y || 0); cz += p.z;
      }
      cx /= positions.length; cy /= positions.length; cz /= positions.length;
      window.dispatchEvent(new CustomEvent('focus-camera-on-point', { detail: { x: cx, y: cy, z: cz } }));
    };
    window.addEventListener('viewport-frame-all', handler);
    return () => window.removeEventListener('viewport-frame-all', handler);
  }, [targetPosition, targetLookAt]);

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
        const orbitRadius = 300;
        const orbitSpeed = 0.12;
        // Cinematic orbit with altitude variation — descending from 140m to 80m
        const altBase = 140 - eased * 60;
        const altWave = Math.sin(introTimer.current * 0.5) * 8;
        camera.position.set(
          Math.sin(introTimer.current * orbitSpeed) * orbitRadius,
          altBase + altWave,
          Math.cos(introTimer.current * orbitSpeed) * orbitRadius
        );
        camera.lookAt(0, 5, 0);
        if (controlsRef.current) {
          controlsRef.current.target.set(0, 5, 0);
          controlsRef.current.update();
        }
        if (introTimer.current >= introDuration.current.hold) {
          introPhase.current = 'sweep';
          introTimer.current = 0;
          // Capture current position as sweep start
          _sweepStartPos.current.copy(camera.position);
        }
      } else if (introPhase.current === 'sweep') {
        const sweepT = Math.min(1, introTimer.current / introDuration.current.sweep);
        const eased = easeInOutCubic(sweepT);
        
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

    // Normal preset animation
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

  const sensitivityScale = 0.7;

  // Broadcast OrbitControls ref to GeoCameraController. Mutable ref intentionally
  // omitted from deps — broadcasts once on mount when the ref is populated.
  useEffect(() => {
    if (controlsRef.current) {
      window.dispatchEvent(new CustomEvent('r3f-controls-ready', { detail: { controls: controlsRef.current } }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Disable OrbitControls while box-select is active
  useEffect(() => {
    const handler = (e: CustomEvent) => {
      if (controlsRef.current) {
        controlsRef.current.enabled = !e.detail;
        if (e.detail) {
          useViewportStore.getState().setInteractionState('boxSelecting');
        } else {
          useViewportStore.getState().setInteractionState('idle');
        }
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

  // Standard mapping: Middle=Orbit, Right=Pan in ALL modes
  // In select mode: Left is disabled (for box-select). Otherwise Left=Orbit.
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
        MIDDLE: THREE.MOUSE.ROTATE,
        RIGHT: THREE.MOUSE.PAN,
      };
    }
  }, [isSelectMode]);


  if (flyMode) return null;

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping={false}
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
    const isPlaying = useProjectStore(s => s.isPlaying);
  const setPlaying = useProjectStore(s => s.setPlaying);
  const currentTime = useProjectStore(s => s.currentTime);
  const setCurrentTime = useProjectStore(s => s.setCurrentTime);
  const duration = useProjectStore(s => s.duration);
  const playbackSpeed = useProjectStore(s => s.playbackSpeed);

  const formatTime = (t: number) => {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    const f = Math.floor((t % 1) * 30);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}:${String(f).padStart(2, '0')}`;
  };

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1.5 opacity-60 hover:opacity-100 transition-opacity">
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
    const isPlaying = useProjectStore(s => s.isPlaying);
  const setPlaying = useProjectStore(s => s.setPlaying);
  const currentTime = useProjectStore(s => s.currentTime);
  const setCurrentTime = useProjectStore(s => s.setCurrentTime);
  const duration = useProjectStore(s => s.duration);
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
  // ── Memoized Zustand selectors (avoid inline getState in JSX) ──
  const lockPositions = useSceneStore((s) => s.environment.lockPositions);
  const showRulers = useSceneStore((s) => s.environment.showRulers);
  const updateEnvironment = useSceneStore((s) => s.updateEnvironment);
  const updateSettings = useSceneStore((s) => s.updateSettings);
  const droneFormations = useProjectStore((s) => s.droneFormations);
  const gpsOrigin = useProjectStore((s) => s.gpsOrigin);
  // cursorStyle moved below geoTool declaration
  const [activePreset, setActivePreset] = useState('free');
  const [freeLook, setFreeLook] = useState(false);
  const [flyMode, setFlyMode] = useState(false);
  const [groundMode, setGroundMode] = useState(false);
  const [flySpeed, setFlySpeed] = useState(15);
  const flySpeedCb = useCallback((s: number) => setFlySpeed(Math.round(s)), []);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [cameraMenuOpen, setCameraMenuOpen] = useState(false);
  const preset = CAMERA_PRESETS.find((p) => p.id === activePreset) || CAMERA_PRESETS[0];
  const perfStatsRef = useRef<PerfStats>({ fps: 0, drawCalls: 0, triangles: 0, geometries: 0, textures: 0, memory: 0, frameTime: 16.7, workerLatency: 0, isScaledDown: false });
  const droneCount = droneFormations.length > 0 ? droneFormations[0].droneCount : 0;
  const [satelliteTexture, setSatelliteTexture] = useState<string | null>(null);
  const [downloadingScenery, setDownloadingScenery] = useState(false);
  const [canvasInstanceKey, setCanvasInstanceKey] = useState(0);
  const recoveringContextRef = useRef(false);
  const handleContextRemount = useCallback(() => setCanvasInstanceKey(prev => prev + 1), []);
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;  
  const deviceProfile = useMemo(() => getDeviceProfile(), []);
  const isLowTierMobile = isMobile && deviceProfile.tier === 'low';
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
  // ResizeObserver removed — R3F Canvas resize={{ debounce: 50 }} handles this natively

  const [canvasReady, setCanvasReady] = useState(false);
  const [webglRetryKey, setWebglRetryKey] = useState(0);
  // Silent-failure guard: in some Chrome builds (e.g. SwiftShader deprecated, GPU disabled) R3F
  // mounts without throwing yet produces no <canvas> child. Without this check the user sees a
  // pure-black viewport with no fallback. We poll the container shortly after mount and trip
  // the fallback if no real canvas attached.
  const [silentCanvasFailure, setSilentCanvasFailure] = useState<string | null>(null);
  // Ref to the live R3F WebGLRenderer so we can probe `isContextLost()`
  // (set in <Canvas onCreated>). Used both by the silent-failure probe and
  // by the manual retry button.
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  useEffect(() => {
    if (silentCanvasFailure) return;
    const probeAt = [600, 1500, 3000];
    const timers = probeAt.map((delay) =>
      window.setTimeout(() => {
        const node = containerRef.current;
        if (!node) return;
        const c = node.querySelector('canvas');
        const empty = !c || (c.clientWidth === 0 && c.clientHeight === 0);
        // Also catch the "canvas exists with size but GL context is lost"
        // case — without this the user sees a black viewport with no fallback.
        const ctxLost = !!rendererRef.current?.getContext()?.isContextLost?.();
        if ((empty || ctxLost) && delay === 3000) {
          setSilentCanvasFailure(
            ctxLost
              ? 'WebGL context was lost during startup (likely GPU pressure). Click Retry to recover.'
              : 'WebGL canvas could not be created (likely GPU/driver blocked).',
          );
        }
      }, delay),
    );
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [silentCanvasFailure, webglRetryKey]);

  // Proactive WebGL capability probe — render simplified fallback if unsupported.
  // `webglRetryKey` is a forced-recompute signal driven by the retry button.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const webglIssue = useMemo(() => detectWebGLCapability(), [webglRetryKey]);
  const fallbackReason = webglIssue || silentCanvasFailure;

  const handleFallbackRetry = useCallback(() => {
    // Reset the crash-loop cooldown so the user can manually attempt recovery
    // after a context-loss storm without a full page reload.
    try { resetCrashRecord(); } catch { /* ignore */ }
    recoveringContextRef.current = false;
    setSilentCanvasFailure(null);
    setWebglRetryKey((k) => k + 1);
    // Force the Canvas itself to remount so a fresh GL context is acquired.
    setCanvasInstanceKey((k) => k + 1);
  }, []);

  if (fallbackReason) {
    return (
      <div ref={containerRef} className="w-full h-full relative bg-[#050810]" data-sky-canvas>
        <SimplifiedSkyFallback
          reason={fallbackReason}
          onRetry={handleFallbackRetry}
        />
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full h-full relative bg-[#050810] transition-opacity duration-300 ease-out" data-sky-canvas style={{ cursor: cursorStyle, opacity: 1 }}>
      <WebGLErrorBoundary>
      <Canvas
        key={canvasInstanceKey}
        resize={{ debounce: 50, scroll: false }}
        // Use BasicShadowMap on boot — PCF/PCFSoft allocate large depth FBOs
        // and stalled the GPU during /studio cold-start. Quality controllers
        // can promote to PCFSoftShadowMap later via gl.shadowMap.type once
        // the warm-up window clears.
        shadows={isLowTierMobile ? false : { type: THREE.BasicShadowMap, enabled: true }}
        gl={{
          antialias: !isLowTierMobile,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.2,
          powerPreference: isLowTierMobile ? 'default' : 'high-performance',
          alpha: false,
          stencil: false,
          // logarithmicDepthBuffer forces a secondary depth pipeline on many
          // Intel/AMD drivers and was a major contributor to GPU pressure on
          // cold-start. Disabled — far plane reduced to 200km below to keep
          // depth precision acceptable without it.
          logarithmicDepthBuffer: false,
          outputColorSpace: THREE.SRGBColorSpace,
          // Don't refuse the context on integrated/marginal GPUs — we'd rather
          // start in a degraded state than fall back to the static placeholder.
          failIfMajorPerformanceCaveat: false,
        }}
        // DPR cap: high-DPI desktops were rendering ~2.6 megapixels which —
        // combined with bloom/SSR/GPGPU render targets — was exhausting the
        // WebGL context on /studio boot. Cap at 1.5 on desktop, lower on mobile.
        dpr={
          isLowTierMobile
            ? [1, 1]
            : isMobile
              ? [1, 1.25]
              : [1, Math.min((typeof window !== 'undefined' ? window.devicePixelRatio : 1) || 1, 1.5)]
        }
        performance={{ min: isLowTierMobile ? 0.35 : 0.5 }}
        onCreated={(state) => {
          recoveringContextRef.current = false;
          rendererRef.current = state.gl;
          // Publish to module-level registry so dev diagnostics panels (which
          // live outside the R3F tree) can poll renderer.info / read GPU info.
          setActiveRenderer(state.gl);
          // Reveal immediately — GL context ready and bg color is already painted.
          setCanvasReady(true);
        }}>
        <PerspectiveCamera makeDefault position={preset.position} fov={60} near={0.1} far={200000} />
        <CameraController targetPosition={[...preset.position]} targetLookAt={[...preset.target]} freeLook={freeLook || flyMode || groundMode} flyMode={flyMode || groundMode} />
        {flyMode && !groundMode && <FlyControls onSpeedChange={flySpeedCb} />}
        {groundMode && <GroundControls onSpeedChange={flySpeedCb} />}

        <ContextLossGuard
          recoveringRef={recoveringContextRef}
          onRemount={handleContextRemount}
          onUnrecoverable={(reason) => setSilentCanvasFailure(reason)}
          onRecovered={() => {
            // Clear any lingering "in cooldown" fallback once the native
            // webglcontextrestored event confirms the context is back.
            setSilentCanvasFailure(null);
          }}
        />
        <HardeningWatchdog />
        <FXKQualityController />
        <SceneLighting />
        <GeoTimeOfDaySync />
        <Suspense fallback={null}>
          <AdaptiveExposureController />
          {!google3DTilesEnabled && <GroundReflections />}
          <DebugFeed />
        </Suspense>
        {/* Heavy lighting effects deferred until idle for faster first paint.
            Staggered across 1.5s–3s so each heavy FBO allocation (GI shadow
            cascade, lens-flare RT, contact-shadow depth pass, Niagara CPU
            warm-up) lands on its own frame instead of all stacking onto the
            GPGPU/bloom warm-up — primary cause of cold-start context loss. */}
        <DelayedMount delay={2200}>
          <Suspense fallback={null}>
            {!environment.disableLighting && <GlobalIlluminationController />}
          </Suspense>
        </DelayedMount>
        <DelayedMount delay={2600}>
          <Suspense fallback={null}>
            {!environment.disableLighting && <LensFlareController />}
          </Suspense>
        </DelayedMount>
        <DelayedMount delay={1800}>
          <Suspense fallback={null}>
            <ContactShadowsLayer />
          </Suspense>
        </DelayedMount>
        <DelayedMount delay={3000}>
          <NiagaraVFXController />
        </DelayedMount>

        {/* ═══ Synthetic sky/atmosphere — suppressed in Digital Twin mode ═══ */}
        <Suspense fallback={null}>
          {!google3DTilesEnabled && <EnvironmentV2SwitcherClean SkyGradientComponent={SkyGradientFallback} />}
          {!google3DTilesEnabled && <SceneStarsWiredClean />}
          {!google3DTilesEnabled && <SceneFogClean />}
        </Suspense>

        <Suspense fallback={null}>
          {!google3DTilesEnabled && <Moon />}
          {!google3DTilesEnabled && !isLowTierMobile && !environment.lowQualityMode && (
            <DelayedMount delay={2800}><AtmosphericParticles /></DelayedMount>
          )}
          {!google3DTilesEnabled && !isLowTierMobile && <DelayedMount delay={3500}><WeatherEffects /></DelayedMount>}
        </Suspense>

        {/* ═══ Ground / Terrain ═══ */}
        <Suspense fallback={null}>
          {!google3DTilesEnabled && <StageGround satelliteTexture={satelliteTexture} />}
        </Suspense>
        <SubsystemBoundary name="GoogleTiles">
          {google3DTilesEnabled && <GoogleTilesLayer />}
          {google3DTilesEnabled && <GeoCameraController />}
          {google3DTilesEnabled && <GoogleTilesFallback />}
          <GoogleEarthLighting />
        </SubsystemBoundary>
        {!google3DTilesEnabled && showDebugOverlay && <FinaleAxesHelper />}
        <DoubleClickFocus />
        <SiteModelRenderer />
        <PositionPins />
        <PyroLaunchAngles />
        <PositionTransformGizmo />
        {!isMobile && <Rack3DView />}
        <TrajectoryPaths />
        {!google3DTilesEnabled && !isLowTierMobile && <PyroSafetyZones />}
        <SubsystemBoundary name="DroneSwarm">
          <DroneRendererSwitch />
        </SubsystemBoundary>
        {!isMobile && <BoidsVisualizer />}
        {!isMobile && <CollisionAvoidanceOverlay config={DEFAULT_AVOIDANCE} />}
        <SubsystemBoundary name="Pyrotechnics">
          <Suspense fallback={null}>
            <TimelineEffects />
            <LiveSFXEffects />
          </Suspense>
        </SubsystemBoundary>
        <LaserPreviewBeams />
        {!google3DTilesEnabled && !isLowTierMobile && <StageFixtures />}
        {!google3DTilesEnabled && !isMobile && !isLowTierMobile && <DelayedMount delay={3000}><AudioSpectrumVisualizer /></DelayedMount>}
        <PlaybackClock />
        <TimelineClockWatchdog />
        {!isMobile && <CameraAnimator />}
        {!isMobile && <CameraPathPreview />}
        {!google3DTilesEnabled && <ViewportRulers />}
        <CameraBookmarkSaver />
        <SubsystemBoundary name="PostProcessing">
          {!isLowTierMobile && (
            // Bumped 600ms → 1200ms — PostProcessing allocates the largest
            // single FBO (HDR + bloom mip chain). Holding it back until after
            // the first idle frames dramatically reduces boot context loss.
            <DelayedMount delay={1200}>
              <PostProcessing activeBurstCount={isMobile ? Math.min(_activeBurstCount, 8) : _activeBurstCount} />
            </DelayedMount>
          )}
        </SubsystemBoundary>
        {!isLowTierMobile && <DelayedMount delay={3200}><StressTestFireworks /></DelayedMount>}

        {!isLowTierMobile && <DelayedMount delay={2500}><PostExplosionSmokeManager /></DelayedMount>}
        <BoxSelectR3F />
        <PerfCollector statsRef={perfStatsRef} />

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

      {/* ═══ VIEWPORT BAR — Fixed top bar with view presets & actions ═══ */}
      <ViewportBar />

      <TelemetryBar />
      <GoogleTilesLoadingOverlay />
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

      {/* ═══ VIEWPORT CONFIG — Unified menu (desktop only) ═══ */}
      {!isMobile && (
        <ViewportConfigMenu
          activePreset={activePreset}
          freeLook={freeLook}
          flyMode={flyMode}
          groundMode={groundMode}
          onPresetChange={(id) => { setActivePreset(id); setFreeLook(false); }}
          onFreeLookToggle={() => { setFreeLook(!freeLook); if (flyMode) setFlyMode(false); if (groundMode) setGroundMode(false); }}
          onFlyModeToggle={() => { setFlyMode(!flyMode); if (!flyMode) { setFreeLook(false); setGroundMode(false); } }}
          onGroundModeToggle={() => { setGroundMode(!groundMode); if (!groundMode) { setFlyMode(false); setFreeLook(false); } }}
        />
      )}

      {/* ═══ TACTICAL DOCK — Editing tools ═══ */}
      {!isMobile && <TacticalDock />}

      {/* ═══ JOI STATUS MONITOR — HUD ═══ */}
      {!isMobile && <JoiStatusMonitor />}

      {/* ═══ Mini-Dock — utility tools (top-right glassmorphism cluster) ═══ */}
      {!isMobile && (
        <div className="absolute right-3 top-3 flex flex-col gap-1 bg-card/40 backdrop-blur-sm border border-border/10 rounded-xl p-1 z-20">
          {/* Render Debug */}
          <RenderDebugToggle show={showDebugOverlay} onToggle={() => setShowDebugOverlay(v => !v)} />

          {/* Lock Positions */}
          <button
            onClick={() => updateEnvironment({ lockPositions: !lockPositions })}
            className={cn(
              "w-7 h-7 rounded-md flex items-center justify-center transition-all border",
              lockPositions
                ? "bg-warning/20 border-warning/40 text-warning"
                : "bg-surface-1/80 border-border/30 text-muted-foreground hover:text-foreground hover:border-border/60"
            )}
            title="Lock/Unlock Positions"
          >
            <Lock className="h-3.5 w-3.5" />
          </button>

          {/* Rulers */}
          <button
            onClick={() => updateEnvironment({ showRulers: !showRulers })}
            className={cn(
              "w-7 h-7 rounded-md flex items-center justify-center transition-all border",
              showRulers
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
            onClick={() => updateSettings({ presentationMode: true })}
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
              if (document.fullscreenElement) {
                void document.exitFullscreen();
              } else {
                void el.requestFullscreen();
              }
            }}
            className="w-7 h-7 rounded-md flex items-center justify-center transition-all border bg-surface-1/80 border-border/30 text-muted-foreground hover:text-foreground hover:border-border/60"
          >
            {isFullscreen ? <Minimize className="h-3.5 w-3.5" /> : <Maximize className="h-3.5 w-3.5" />}
          </button>
        </div>
      )}

      {/* Camera Bookmarks bar */}
      {!isMobile && <CameraBookmarksBar setActivePreset={setActivePreset} setFreeLook={setFreeLook} />}

      {/* Site Model Transform Toolbar */}
      <SiteModelTransformToolbar />

      {/* Debug overlay toggle + panel */}
      {!isMobile && showDebugOverlay && <RenderDebugPanel />}
      {!isMobile && showDebugOverlay && <SkyCanvasDiagnosticsPanel />}
      {!isMobile && <TerrainCacheMetricsPanel />}

      {/* Fullscreen floating edit menu */}
      {isFullscreen && <FullscreenEditMenu />}

      {/* AI CoPilot Overlay */}
      <AICoPilotOverlay />

      {/* HUD Crosshairs AR Overlay */}
      <HUDCrosshairs />

      {/* Placing Mode Crosshair Overlay */}
      <PlacingModeOverlay />

      {/* ═══ Debug tools — hidden by default, toggle with Ctrl+Shift+D ═══ */}
      {!isMobile && showDebugOverlay && <PerformanceHUD statsRef={perfStatsRef} droneCount={droneCount} />}
      {!isMobile && showDebugOverlay && <ViewportTerminal />}
      {!isMobile && <SelectionStatusBar />}
      {!isMobile && <AlignmentTools />}

      {/* FinaleToolbar replaced by TacticalDock */}
      {!isMobile && showDebugOverlay && (
        <div className="absolute bottom-20 left-3 z-40">
          <StressTestButton />
        </div>
      )}

      {/* ViewportPlaybackControls removed — redundant with Timeline playback */}

      {/* Fly mode HUD (desktop only — mobile uses MobileHUD) */}
      {!isMobile && flyMode && !groundMode && (
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

      {/* Ground operator HUD (desktop only) */}
      {!isMobile && groundMode && (
        <div className="absolute bottom-28 left-1/2 -translate-x-1/2 z-40 bg-card/85 backdrop-blur-xl border border-border/25 rounded-xl px-4 py-2 font-mono text-[10px] text-muted-foreground space-y-0.5 select-none pointer-events-none">
          <div className="text-center text-[9px] font-semibold uppercase tracking-wider text-primary mb-1">🥾 Ground Op</div>
          <div className="flex gap-4">
            <span>WASD Walk</span>
            <span>Shift Run</span>
            <span>Scroll Speed</span>
            <span>Alt Lock: 1.7m</span>
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
        onExit={() => updateSettings({ presentationMode: false })}
      />

      {/* AR Overlays */}
      <ARCompassHUD />
      <ARScanEffect />

      {/* MissionSetupOverlay removed — scene loads immediately */}
    </div>
  );
}
