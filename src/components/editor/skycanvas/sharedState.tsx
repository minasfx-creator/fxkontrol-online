/**
 * SkyCanvas Shared State — Module-level singletons shared across all SkyCanvas sub-modules.
 * Eliminates prop-drilling and enables centralized per-frame scanning.
 */
import * as THREE from 'three';
import { useProjectStore, EFFECT_LIBRARY } from '@/store/useProjectStore';
import { getCompound, type ChemicalCompound } from '@/render_ultra/fireworks/particleChemistry';
import { getBreakHeight } from '@/lib/pyroPhysics';

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
  const { timelineItems, currentTime } = useProjectStore.getState();
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
    luminance += elapsed < 0.5 ? 3.0 : 0.5;

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

// ═══ EFFECT_LIBRARY indexed Map for O(1) lookups ═══
let _effectLibraryMap: Map<string, (typeof EFFECT_LIBRARY)[number]> | null = null;
export function getEffectById(id: string): (typeof EFFECT_LIBRARY)[number] | undefined {
  if (!_effectLibraryMap || _effectLibraryMap.size !== EFFECT_LIBRARY.length) {
    _effectLibraryMap = new Map(EFFECT_LIBRARY.map(e => [e.id, e]));
  }
  return _effectLibraryMap.get(id);
}

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

// ═══ Wind helper ═══
export function getWindForce(): [number, number, number] {
  const { wind } = useProjectStore.getState();
  if (!wind.enabled) return [0, 0, 0];
  const rad = (wind.direction * Math.PI) / 180;
  const gust = 1 + (Math.sin(performance.now() * 0.001) * 0.5 + 0.5) * wind.gustStrength;
  const s = wind.speed * gust * 0.15;
  return [Math.sin(rad) * s, 0, Math.cos(rad) * s];
}

// ═══ Camera presets ═══
import { Camera, Eye, Video, Plane, Users } from 'lucide-react';

export const CAMERA_PRESETS = [
  { id: 'free', label: 'Free', icon: Eye, position: [0, 1.7, 100] as [number, number, number], target: [0, 50, 0] as [number, number, number] },
  { id: 'satellite', label: 'Top', icon: Plane, position: [0, 6000, 0.1] as [number, number, number], target: [0, 0, 0] as [number, number, number] },
  { id: 'audience', label: 'Plateia', icon: Users, position: [0, 1.7, 2500] as [number, number, number], target: [0, 300, 0] as [number, number, number] },
  { id: 'front', label: 'Front', icon: Users, position: [0, 1.7, 3000] as [number, number, number], target: [0, 400, 0] as [number, number, number] },
  { id: 'side', label: 'Side', icon: Video, position: [3000, 250, 0] as [number, number, number], target: [0, 500, 0] as [number, number, number] },
  { id: 'back', label: 'Back', icon: Video, position: [0, 250, -2000] as [number, number, number], target: [0, 500, 0] as [number, number, number] },
  { id: 'aerial', label: 'Aerial 45°', icon: Plane, position: [0, 3000, 3000] as [number, number, number], target: [0, 300, 0] as [number, number, number] },
  { id: 'closeup', label: 'Close-up', icon: Camera, position: [150, 200, 750] as [number, number, number], target: [0, 500, 0] as [number, number, number] },
  { id: 'cinematic', label: 'Cinema', icon: Video, position: [-750, 2, 2250] as [number, number, number], target: [0, 400, 0] as [number, number, number] },
  { id: 'drone-follow', label: 'Drone POV', icon: Eye, position: [125, 900, 300] as [number, number, number], target: [0, 600, 0] as [number, number, number] },
  { id: 'vip', label: 'VIP Box', icon: Users, position: [500, 1.7, 2000] as [number, number, number], target: [0, 300, 0] as [number, number, number] },
] as const;

// ═══ WebGL Error Boundary ═══
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

export class WebGLErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
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

// Re-export GRAVITY
export const GRAVITY = -9.81;
