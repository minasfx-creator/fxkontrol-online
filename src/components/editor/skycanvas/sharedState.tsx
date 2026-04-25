/**
 * SkyCanvas Shared State — Module-level singletons shared across all SkyCanvas sub-modules.
 * Eliminates prop-drilling and enables centralized per-frame scanning.
 */
import * as THREE from 'three';
import { useProjectStore } from '@/store/useProjectStore';
import { EFFECT_LIBRARY } from '@/data/effectLibrary';
import { getEffectById as getEffectByIdFromMap } from '@/data/effectLibraryMap';
import { getCompound, type ChemicalCompound } from '@/render_ultra/fireworks/particleChemistry';
import { getBreakHeight } from '@/lib/pyroPhysics';
import { timelineClock } from '@/core/timeline/TimelineClock';

// ═══ Module-level active burst counter for conditional PostProcessing ═══
let _activeBurstCount = 0;
export function getActiveBurstCount() { return _activeBurstCount; }

// ═══ ActiveBurstScanner — centralized per-frame timeline scan ═══
export interface ActiveBurstScanResult {
  freshBursts: { x: number; y: number; z: number; color: string; caliber: number; effectId: string }[];
  activeBursts: number;
  luminance: number;
  scatterColors: { color: string; intensity: number }[];
  scatterMax: number;
}

let _activeBurstScan: ActiveBurstScanResult | null = null;
export function getActiveBurstScan() { return _activeBurstScan; }

export function runActiveBurstScan(): ActiveBurstScanResult {
  const { timelineItems } = useProjectStore.getState();
  // Authoritative time from the timeline clock (RAF pump in EngineProvider).
  // Falls back to the store mirror if the clock hasn't been initialised.
  const currentTime = timelineClock.getTime();
  const freshBursts: ActiveBurstScanResult['freshBursts'] = [];
  const scatterColors: ActiveBurstScanResult['scatterColors'] = [];
  let activeBursts = 0;
  let luminance = 0;
  let scatterMax = 0;

  for (let i = 0; i < timelineItems.length; i++) {
    const item = timelineItems[i];
    const elapsed = currentTime - item.startTime;
    if (elapsed < 0 || elapsed > 2.0) continue;

    activeBursts++;
    luminance += elapsed < 0.5 ? 1.5 : 0.3;

    if (elapsed < 0.05) {
      const effect = getEffectById(item.effectId);
      if (effect && effect.type === 'firework') {
        freshBursts.push({
          x: item.position.x,
          y: item.position.y,
          z: item.position.z,
          color: effect.color,
          caliber: effect.caliber || 4,
          effectId: effect.id,
        });
      }
    }

    if (elapsed < 0.3) {
      const effect = getEffectById(item.effectId);
      if (effect && effect.type === 'firework') {
        const intensity = 0.4 * (1 - elapsed / 0.3);
        scatterColors.push({ color: effect.color, intensity });
        scatterMax = Math.max(scatterMax, intensity);
      }
    }
  }

  _activeBurstScan = { freshBursts, activeBursts, luminance, scatterColors, scatterMax };
  _activeBurstCount = activeBursts;
  return _activeBurstScan;
}

// ═══ PyroChem: map hex colors → real chemical compounds (cached) ═══
const _hexToCompoundCache = new Map<string, ChemicalCompound>();
const _hexTempColor = new THREE.Color();
const _hexTempHSL = { h: 0, s: 0, l: 0 };

export function hexToCompound(hexColor: string): ChemicalCompound {
  const cached = _hexToCompoundCache.get(hexColor);
  if (cached) return cached;

  _hexTempColor.set(hexColor);
  _hexTempColor.getHSL(_hexTempHSL);
  const h = _hexTempHSL.h * 360;

  let result: ChemicalCompound;
  if (_hexTempHSL.l > 0.85) result = getCompound('magnesium');
  else if (_hexTempHSL.l > 0.7 && _hexTempHSL.s < 0.2) result = getCompound('titanium');
  else if (h >= 0 && h < 30) result = getCompound('strontium');
  else if (h >= 30 && h < 55) result = getCompound('iron');
  else if (h >= 55 && h < 75) result = getCompound('sodium');
  else if (h >= 75 && h < 170) result = getCompound('barium');
  else if (h >= 170 && h < 260) result = getCompound('copper');
  else if (h >= 260 && h < 310) result = getCompound('strontium');
  else if (h >= 310 && h < 345) result = getCompound('strontium');
  else result = getCompound('charcoal');

  _hexToCompoundCache.set(hexColor, result);
  return result;
}

// ═══ EFFECT_LIBRARY indexed Map — delegated to src/data/effectLibraryMap ═══
export const getEffectById = getEffectByIdFromMap;

// ═══ Pre-allocated math objects for quaternion composition ═══
export const _posQuat = new THREE.Quaternion();
export const _effQuat = new THREE.Quaternion();
export const _pitchQuat = new THREE.Quaternion();
export const _posEuler = new THREE.Euler();
export const _effEuler = new THREE.Euler();
export const _launchDir = new THREE.Vector3();
export const _pitchAxis = new THREE.Vector3();

// ═══ Shared state refs for cross-module communication ═══
export let _skyScatterUniforms: { uExplosionScatter: { value: THREE.Color }; uScatterIntensity: { value: number } } | null = null;
export function setSkyScatterUniforms(u: typeof _skyScatterUniforms) { _skyScatterUniforms = u; }
export function getSkyScatterUniforms() { return _skyScatterUniforms; }

export let _adaptiveExposure = 1.2;
export function setAdaptiveExposureValue(v: number) { _adaptiveExposure = v; }
export function getAdaptiveExposure() { return _adaptiveExposure; }

// ═══ Wind helper (turbulent wind field) ═══
import { windField, type WindParticleType } from '@/core/engine/windField';

export function getWindForce(particleType: WindParticleType = 'ember', posY = 50): [number, number, number] {
  const { wind } = useProjectStore.getState();
  if (!wind.enabled) return [0, 0, 0];

  // Sync wind field config from project store
  windField.setConfig({
    baseSpeed: wind.speed,
    directionDeg: wind.direction,
    gustMax: wind.gustStrength * 3,
    turbulenceIntensity: 0.3,
  });

  return windField.sample(0, posY, 0, particleType);
}

/**
 * Sample wind at a specific world position (for trail curvature).
 */
export function getWindAtPosition(x: number, y: number, z: number, particleType: WindParticleType = 'ember'): [number, number, number] {
  const { wind } = useProjectStore.getState();
  if (!wind.enabled) return [0, 0, 0];

  windField.setConfig({
    baseSpeed: wind.speed,
    directionDeg: wind.direction,
    gustMax: wind.gustStrength * 3,
    turbulenceIntensity: 0.3,
  });

  return windField.sample(x, y, z, particleType);
}

// ═══ Camera presets ═══
import { Camera, Eye, Video, Plane, Users, Crosshair, UserRound, Grid3x3, Car } from 'lucide-react';

export const CAMERA_PRESETS = [
  { id: 'free', label: 'Free', icon: Eye, position: [0, 15, 150] as [number, number, number], target: [0, 5, 0] as [number, number, number] },
  // ── UE5-inspired modes ──
  { id: 'first-person', label: '1st Person', icon: Crosshair, position: [0, 1.7, 200] as [number, number, number], target: [0, 30, 0] as [number, number, number] },
  { id: 'third-person', label: '3rd Person', icon: UserRound, position: [0, 8, 1200] as [number, number, number], target: [0, 6, 1190] as [number, number, number] },
  { id: 'top-down', label: 'Top Down', icon: Grid3x3, position: [0, 4000, 0.1] as [number, number, number], target: [0, 0, 0] as [number, number, number] },
  { id: 'vehicle', label: 'Flythrough', icon: Car, position: [-2000, 50, 3000] as [number, number, number], target: [0, 200, 0] as [number, number, number] },
  // ── Classic presets ──
  { id: 'satellite', label: 'Satellite', icon: Plane, position: [0, 6000, 0.1] as [number, number, number], target: [0, 0, 0] as [number, number, number] },
  { id: 'audience', label: 'Plateia', icon: Users, position: [0, 6, 2500] as [number, number, number], target: [0, 300, 0] as [number, number, number] },
  { id: 'front', label: 'Front', icon: Users, position: [0, 6, 3000] as [number, number, number], target: [0, 400, 0] as [number, number, number] },
  { id: 'side', label: 'Side', icon: Video, position: [3000, 250, 0] as [number, number, number], target: [0, 500, 0] as [number, number, number] },
  { id: 'back', label: 'Back', icon: Video, position: [0, 250, -2000] as [number, number, number], target: [0, 500, 0] as [number, number, number] },
  { id: 'aerial', label: 'Aerial 45°', icon: Plane, position: [0, 3000, 3000] as [number, number, number], target: [0, 300, 0] as [number, number, number] },
  { id: 'closeup', label: 'Close-up', icon: Camera, position: [150, 200, 750] as [number, number, number], target: [0, 500, 0] as [number, number, number] },
  { id: 'cinematic', label: 'Cinema', icon: Video, position: [-750, 8, 2250] as [number, number, number], target: [0, 400, 0] as [number, number, number] },
  { id: 'drone-follow', label: 'Drone POV', icon: Eye, position: [125, 900, 300] as [number, number, number], target: [0, 600, 0] as [number, number, number] },
  { id: 'vip', label: 'VIP Box', icon: Users, position: [500, 6, 2000] as [number, number, number], target: [0, 300, 0] as [number, number, number] },
] as const;

// ═══ WebGL Error Boundary ═══
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { captureSkyCanvasError } from '@/lib/skyCanvasDiagnostics';

export class WebGLErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; retryKey: number }> {
  state = { hasError: false, retryKey: 0 };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn('WebGL unavailable:', error.message);
    captureSkyCanvasError('WebGLErrorBoundary', error, info.componentStack ?? undefined);
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
          <button
            onClick={() => this.setState(s => ({ hasError: false, retryKey: s.retryKey + 1 }))}
            className="mt-2 px-4 py-2 rounded-lg text-xs font-mono uppercase tracking-wider bg-card/80 backdrop-blur-md border border-border/30 text-muted-foreground hover:text-foreground hover:bg-card/90 transition-all"
          >
            ↻ Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Re-export GRAVITY
export const GRAVITY = -9.81;
