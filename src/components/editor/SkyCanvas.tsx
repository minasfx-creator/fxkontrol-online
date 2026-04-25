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
import { useIsMobile } from '@/hooks/use-mobile';
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
import { clampNiagaraHDR, getNiagaraBudgets, setAdaptivePipelineState } from '@/lib/niagaraBlenderRules';
// ═══ Hardening Engine ═══
import {
  reportCrash, isInCooldown, recordContextLoss,
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
  getActiveBurstCount,
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
let _skyScatterUniforms_local: { uExplosionScatter: { value: THREE.Color }; uScatterIntensity: { value: number } } | null = null;
let _adaptiveExposure_local = 1.2;
let _activeBurstScan_local: ActiveBurstScanResult | null = null;

// lumaTonemapScale REMOVED — PostProcessing ACES Filmic is the single tonemap pass

// ──────────────────────────────────────────────────────────────────────
// Internals extracted (Phase 3 split — behavior preserved 1:1):
//   skycanvas/watchdogs.tsx          — HardeningWatchdog, FXKQualityController,
//                                      ContextLossGuard, SubsystemBoundary, PlaybackClock
//   skycanvas/sceneLighting.tsx      — SceneLighting, GeoTimeOfDaySync,
//                                      GoogleEarthLighting, SkyGradientFallback
//   skycanvas/cameraControllers.tsx  — FlyControls, GroundControls, CameraController
//   skycanvas/viewportToolbars.tsx   — ViewportPlaybackControls, FullscreenEditMenu,
//                                      SiteModelTransformToolbar, CameraBookmarksBar,
//                                      CameraBookmarkSaver
//   skycanvas/droneRendererSwitch.tsx — DroneRendererSwitch (PBR vs Tactical)
// ──────────────────────────────────────────────────────────────────────
import {
  HardeningWatchdog,
  FXKQualityController,
  ContextLossGuard,
  SubsystemBoundary,
  PlaybackClock,
} from './skycanvas/watchdogs';
import {
  SceneLighting,
  GeoTimeOfDaySync,
  GoogleEarthLighting,
  SkyGradientFallback,
} from './skycanvas/sceneLighting';
import {
  FlyControls,
  GroundControls,
  CameraController,
} from './skycanvas/cameraControllers';
import {
  // ViewportPlaybackControls and FullscreenEditMenu are used by SkyCanvas below.
  FullscreenEditMenu,
  SiteModelTransformToolbar,
  CameraBookmarksBar,
  CameraBookmarkSaver,
} from './skycanvas/viewportToolbars';
import DroneRendererSwitch from './skycanvas/droneRendererSwitch';

// SkyEnvironment chunk (lazy)
const EnvironmentV2SwitcherClean = lzn(() => import('./skycanvas/SkyEnvironment'), 'EnvironmentV2Switcher');
const SceneFogClean = lzn(() => import('./skycanvas/SkyEnvironment'), 'SceneFog');
const SceneStarsWiredClean = lzn(() => import('./skycanvas/SkyEnvironment'), 'SceneStarsWired');

// WeatherSystem chunk (lazy)
const WeatherEffects = lzn(() => import('./skycanvas/WeatherSystem'), 'WeatherEffects');

// Delayed mount wrapper — lets base renderer stabilize before heavy VFX
function DelayedMount({ delay = 2000, children }: { delay?: number; children: ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => { const t = setTimeout(() => setReady(true), delay); return () => clearTimeout(t); }, [delay]);
  return ready ? <>{children}</> : null;
}

// NOTE: `_activeBurstCount` lives in skycanvas/sharedState.tsx and is updated by
// runActiveBurstScan() each frame. Read via getActiveBurstCount(). Do NOT
// re-declare a local copy here — that previously shadowed the live counter
// and caused PostProcessing bloom to never react to bursts.


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
  // Reactive viewport detection — updates on resize/orientation change via matchMedia.
  // Avoids the boot-time stale value (e.g. desktop preview rendered as mobile when window
  // briefly reports < 768px during initial layout, or vice-versa on rotation).
  const isMobile = useIsMobile();
  const deviceProfile = useMemo(() => getDeviceProfile(), []);
  const isLowTierMobile = isMobile && deviceProfile.tier === 'low';
  const environment = useSceneStore(st => st.environment);
  const google3DTilesEnabled = useSceneStore(st => st.settings.google3DTilesEnabled);
  const [showDebugOverlay, setShowDebugOverlay] = useState(false);
  const presentationMode = useSceneStore(st => st.settings.presentationMode);
  // MissionSetupOverlay removed — scene loads immediately

  // ── Pointer-lock sync ────────────────────────────────────────────────
  // Esc (or any browser-initiated unlock) must clear *all* free-look camera
  // modes, not just `flyMode`. Previously only flyMode was reset, leaving
  // the user trapped in groundMode/freeLook with no visible cursor and the
  // controllers still mounted — the "ghost fly" bug.
  //
  // We register the listener once (no `flyMode` dep) and read the latest
  // state from refs to avoid the stale-closure race when the user double-
  // taps Esc faster than React commits.
  const flyModeRef = useRef(flyMode);
  const groundModeRef = useRef(groundMode);
  const freeLookRef = useRef(freeLook);
  useEffect(() => { flyModeRef.current = flyMode; }, [flyMode]);
  useEffect(() => { groundModeRef.current = groundMode; }, [groundMode]);
  useEffect(() => { freeLookRef.current = freeLook; }, [freeLook]);

  useEffect(() => {
    const onLockChange = () => {
      if (document.pointerLockElement) return; // entered lock — nothing to do
      // Lock released (Esc, tab-switch, alert, etc.) — drop every immersive mode.
      if (flyModeRef.current) setFlyMode(false);
      if (groundModeRef.current) setGroundMode(false);
      if (freeLookRef.current) setFreeLook(false);
    };
    const onLockError = () => {
      // Browser refused the lock request — make sure UI doesn't show a phantom mode.
      if (flyModeRef.current) setFlyMode(false);
      if (groundModeRef.current) setGroundMode(false);
    };
    document.addEventListener('pointerlockchange', onLockChange);
    document.addEventListener('pointerlockerror', onLockError);
    return () => {
      document.removeEventListener('pointerlockchange', onLockChange);
      document.removeEventListener('pointerlockerror', onLockError);
    };
  }, []);

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

  return (
    <div ref={containerRef} className="w-full h-full relative bg-[#050810] transition-opacity duration-700 ease-out" data-sky-canvas style={{ cursor: cursorStyle, opacity: canvasReady ? 1 : 0 }}>
      <WebGLErrorBoundary>
      <Canvas
        key={canvasInstanceKey}
        resize={{ debounce: 50, scroll: false }}
        shadows
        gl={{
          antialias: !isLowTierMobile,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.2,
          powerPreference: isLowTierMobile ? 'default' : 'high-performance',
          alpha: false,
          stencil: false,
          logarithmicDepthBuffer: !isLowTierMobile,
          outputColorSpace: THREE.SRGBColorSpace,
        }}
        dpr={isLowTierMobile ? [1, 1] : isMobile ? [1, 1.25] : [1.5, 2]}
        performance={{ min: isLowTierMobile ? 0.35 : 0.5 }}
        onCreated={() => {
          recoveringContextRef.current = false;
          setTimeout(() => setCanvasReady(true), 100);
        }}>
        <PerspectiveCamera makeDefault position={preset.position} fov={60} near={0.1} far={500000} />
        <CameraController targetPosition={[...preset.position]} targetLookAt={[...preset.target]} freeLook={freeLook || flyMode || groundMode} flyMode={flyMode || groundMode} />
        {flyMode && !groundMode && <FlyControls onSpeedChange={flySpeedCb} />}
        {groundMode && <GroundControls onSpeedChange={flySpeedCb} />}

        <ContextLossGuard recoveringRef={recoveringContextRef} onRemount={handleContextRemount} />
        <HardeningWatchdog />
        <FXKQualityController />
        <SceneLighting />
        <GeoTimeOfDaySync />
        <Suspense fallback={null}>
          <AdaptiveExposureController />
          {!environment.disableLighting && <GlobalIlluminationController />}
          {!google3DTilesEnabled && <GroundReflections />}
          {!environment.disableLighting && <LensFlareController />}
          <ContactShadowsLayer />
          <DebugFeed />
        </Suspense>
        <DelayedMount delay={2000}>
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
          {!google3DTilesEnabled && !isLowTierMobile && !environment.lowQualityMode && <AtmosphericParticles />}
          {!google3DTilesEnabled && !isLowTierMobile && <DelayedMount delay={2500}><WeatherEffects /></DelayedMount>}
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
        {!isMobile && <CameraAnimator />}
        {!isMobile && <CameraPathPreview />}
        {!google3DTilesEnabled && <ViewportRulers />}
        <CameraBookmarkSaver />
        <SubsystemBoundary name="PostProcessing">
          {!isLowTierMobile && <PostProcessing activeBurstCount={isMobile ? Math.min(_activeBurstCount, 8) : _activeBurstCount} />}
        </SubsystemBoundary>
        {!isLowTierMobile && <StressTestFireworks />}
        
        {!isLowTierMobile && <PostExplosionSmokeManager />}
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
              document.fullscreenElement ? document.exitFullscreen() : el.requestFullscreen();
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
