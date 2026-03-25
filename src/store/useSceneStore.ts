import { create } from 'zustand';
import type { ViewTransform } from '@/lib/niagaraBlenderRules';
import type { TerrainData, TerrainConfig } from '@/lib/heightmapToTerrain';

export type GroundStyle = 'finale-dark' | 'google-earth' | 'flat-black' | 'concrete' | 'sfx-stage' | 'synthetic-grass' | 'custom';
export type SkyPreset = 'night-clear' | 'night-cloudy' | 'dusk' | 'overcast' | 'foggy' | 'custom';
export type WeatherCondition = 'clear' | 'light-rain' | 'heavy-rain' | 'snow' | 'fog' | 'haze' | 'wind-only';
export type QualityPreset = 'realistic' | 'show' | 'performance';
export type GoogleTilesQuality = 'low' | 'medium' | 'high';
export type { ViewTransform };
...
  google3DTilesEnabled: boolean;    // Google Photorealistic 3D Tiles digital twin
  sceneImportRadius: number;        // 1000-20000 meters (1-20 km) tile loading radius
  googleTilesQuality: GoogleTilesQuality; // runtime quality target for Google 3D Tiles
  presentationMode: boolean;        // Client presentation fullscreen mode
...
  google3DTilesEnabled: true,
  sceneImportRadius: 5000,
  googleTilesQuality: 'low',
  presentationMode: false,

  // Ultra-Smooth Rendering defaults
  adaptiveQualityEnabled: true,
  smoothFramePacing: true,
  gpuParticlePhysics: true,
  frustumCullingBursts: true,
  ssrHalfRes: true,
};

export const SCENE_PRESETS: Record<string, { name: string; description: string; settings: Partial<SceneSettings> }> = {
  'finale-night': {
    name: 'Finale 3D Night',
    description: 'Professional Finale 3D environment — dark blue-black sky, minimal ambient, high-contrast effects',
    settings: {
      skyPreset: 'night-clear',
      groundStyle: 'finale-dark',
      ambientIntensity: 0.02,
      moonIntensity: 0.15,
      moonColor: '#667799',
      skyBrightness: 0.4,
      starDensity: 0.6,
      groundBrightness: 0.35,
      gridOpacity: 0.5,
      gridColor: '#0a0a1a',
      fogDensity: 0.15,
      fogColor: '#050810',
      fogNear: 40000,
      fogFar: 200000,
      horizonGlow: 0.08,
      showTreeline: false,
      showScalePoles: true,
      groundFogIntensity: 0.2,
      effectBrightness: 1.4,
      effectScale: 1.0,
      bloomStrength: 1.5,
      particleDensity: 1.2,
      smokeOpacity: 0.55,
      trailLength: 1.2,
      hdrMultiplier: 4.0,
      burstFlashIntensity: 1.2,
      afterglowDuration: 3.0,
      afterglowIntensity: 0.18,
      thermalTransitionSpeed: 1.0,
      shadowsEnabled: true,
      shadowQuality: 'high',
      rimLightIntensity: 0.4,
      fillLightIntensity: 0.15,
      vignetteEnabled: true,
      vignetteIntensity: 0.2,
      chromaticAberration: false,
      filmGrain: 0.01,
      viewTransform: 'aces-filmic' as ViewTransform,
    },
  },
  'realistic-night': {
    name: 'Realistic Night',
    description: 'Photorealistic outdoor night scene',
    settings: {
      skyPreset: 'night-clear',
      groundStyle: 'google-earth',
      ambientIntensity: 0.06,
      moonIntensity: 0.45,
      skyBrightness: 1.0,
      groundBrightness: 1.0,
      fogDensity: 0.5,
      showTreeline: false,
      effectBrightness: 1.0,
      bloomStrength: 1.0,
    },
  },
  'overcast': {
    name: 'Overcast Night',
    description: 'Cloudy sky with diffused light',
    settings: {
      skyPreset: 'overcast',
      ambientIntensity: 0.12,
      moonIntensity: 0.1,
      skyBrightness: 0.5,
      starDensity: 0.1,
      fogDensity: 0.7,
      fogFar: 40000,
      visibility: 0.6,
      horizonGlow: 0.5,
      humidity: 0.8,
    },
  },
  'foggy': {
    name: 'Foggy Night',
    description: 'Dense fog reducing visibility',
    settings: {
      skyPreset: 'foggy',
      ambientIntensity: 0.08,
      moonIntensity: 0.15,
      fogDensity: 1.0,
      fogFar: 20000,
      visibility: 0.3,
      groundFogIntensity: 1.0,
      starDensity: 0.05,
      humidity: 0.95,
      smokeOpacity: 0.8,
    },
  },
  'dusk': {
    name: 'Dusk / Golden Hour',
    description: 'Late sunset atmosphere',
    settings: {
      skyPreset: 'dusk',
      ambientIntensity: 0.15,
      moonIntensity: 0.2,
      moonColor: '#ffaa66',
      skyBrightness: 1.5,
      starDensity: 0.2,
      horizonGlow: 0.8,
      fogColor: '#1a1208',
      groundBrightness: 1.4,
    },
  },
  'studio-black': {
    name: 'Studio Blackout',
    description: 'Pitch black for maximum effect contrast',
    settings: {
      skyPreset: 'custom',
      groundStyle: 'flat-black',
      ambientIntensity: 0.01,
      moonIntensity: 0.0,
      skyBrightness: 0.1,
      starDensity: 0.0,
      fogDensity: 0.0,
      groundBrightness: 0.2,
      horizonGlow: 0.0,
      showTreeline: false,
      showScalePoles: false,
      effectBrightness: 1.5,
      bloomStrength: 1.5,
    },
  },
  'rainy': {
    name: 'Rainy Night',
    description: 'Light rain with reduced visibility',
    settings: {
      weather: 'light-rain',
      rainIntensity: 0.6,
      humidity: 0.9,
      visibility: 0.5,
      fogDensity: 0.6,
      fogFar: 3000,
      moonIntensity: 0.1,
      starDensity: 0.0,
      smokeOpacity: 0.3,
      groundFogIntensity: 0.2,
    },
  },
  // ═══ Professional Software Reference Presets ═══
  'skybrush': {
    name: 'Skybrush',
    description: 'Verge Aero / Skybrush drone show — clean dark sky, sharp LED visibility, minimal bloom',
    settings: {
      skyPreset: 'night-clear',
      groundStyle: 'flat-black',
      ambientIntensity: 0.015,
      moonIntensity: 0.08,
      moonColor: '#556688',
      skyBrightness: 0.25,
      starDensity: 0.3,
      groundBrightness: 0.15,
      gridOpacity: 0.35,
      gridColor: '#0a0a18',
      fogDensity: 0.05,
      fogColor: '#020408',
      fogNear: 60000,
      fogFar: 400000,
      horizonGlow: 0.03,
      showTreeline: false,
      showScalePoles: false,
      groundFogIntensity: 0.05,
      effectBrightness: 0.9,
      effectScale: 1.0,
      bloomStrength: 0.4,
      particleDensity: 0.8,
      smokeOpacity: 0.1,
      trailLength: 0.6,
      hdrMultiplier: 2.0,
      burstFlashIntensity: 0.3,
      afterglowDuration: 1.0,
      afterglowIntensity: 0.05,
      thermalTransitionSpeed: 1.2,
      shadowsEnabled: false,
      shadowQuality: 'low',
      rimLightIntensity: 0.15,
      fillLightIntensity: 0.08,
      vignetteEnabled: false,
      vignetteIntensity: 0.0,
      chromaticAberration: false,
      filmGrain: 0.0,
      viewTransform: 'agx' as ViewTransform,
    },
  },
  'finale-cinema': {
    name: 'Finale 3D Cinema',
    description: 'Finale 3D cinematic rendering — rich HDR pyro, deep bloom, volumetric smoke, film grain',
    settings: {
      skyPreset: 'night-clear',
      groundStyle: 'finale-dark',
      ambientIntensity: 0.03,
      moonIntensity: 0.25,
      moonColor: '#7788aa',
      skyBrightness: 0.55,
      starDensity: 0.8,
      groundBrightness: 0.45,
      gridOpacity: 0.4,
      gridColor: '#0c0c20',
      fogDensity: 0.3,
      fogColor: '#060a14',
      fogNear: 30000,
      fogFar: 175000,
      horizonGlow: 0.15,
      showTreeline: false,
      showScalePoles: true,
      groundFogIntensity: 0.45,
      effectBrightness: 1.6,
      effectScale: 1.0,
      bloomStrength: 1.8,
      particleDensity: 1.5,
      smokeOpacity: 0.75,
      trailLength: 1.5,
      hdrMultiplier: 5.5,
      burstFlashIntensity: 1.5,
      afterglowDuration: 4.0,
      afterglowIntensity: 0.25,
      thermalTransitionSpeed: 0.8,
      shadowsEnabled: true,
      shadowQuality: 'ultra',
      rimLightIntensity: 0.55,
      fillLightIntensity: 0.2,
      vignetteEnabled: true,
      vignetteIntensity: 0.35,
      chromaticAberration: true,
      filmGrain: 0.035,
      viewTransform: 'aces-filmic' as ViewTransform,
    },
  },
  'depence-stage': {
    name: 'Depence Stage',
    description: 'Depence R3-style stage lighting — warm ambience, strong laser/beam visibility, atmospheric haze',
    settings: {
      skyPreset: 'night-clear',
      groundStyle: 'concrete',
      ambientIntensity: 0.04,
      moonIntensity: 0.0,
      moonColor: '#445566',
      skyBrightness: 0.15,
      starDensity: 0.1,
      groundBrightness: 0.3,
      gridOpacity: 0.25,
      fogDensity: 0.55,
      fogColor: '#0a0810',
      fogNear: 10000,
      fogFar: 100000,
      horizonGlow: 0.04,
      showTreeline: false,
      showScalePoles: false,
      groundFogIntensity: 0.8,
      effectBrightness: 1.3,
      effectScale: 1.0,
      bloomStrength: 1.2,
      particleDensity: 1.0,
      smokeOpacity: 0.65,
      trailLength: 1.0,
      hdrMultiplier: 3.0,
      burstFlashIntensity: 0.8,
      afterglowDuration: 2.5,
      afterglowIntensity: 0.12,
      thermalTransitionSpeed: 1.0,
      weather: 'haze',
      humidity: 0.6,
      shadowsEnabled: true,
      shadowQuality: 'high',
      rimLightIntensity: 0.65,
      fillLightIntensity: 0.4,
      vignetteEnabled: true,
      vignetteIntensity: 0.2,
      chromaticAberration: true,
      filmGrain: 0.015,
      viewTransform: 'standard' as ViewTransform,
    },
  },
  'sfx-stage': {
    name: 'SFX Stage (DMXPrevis)',
    description: 'Indoor venue with truss rigging, moving heads, haze — optimized for Showven SFX preview',
    settings: {
      skyPreset: 'custom',
      groundStyle: 'sfx-stage',
      ambientIntensity: 0.015,
      moonIntensity: 0.0,
      moonColor: '#220033',
      skyBrightness: 0.05,
      starDensity: 0.0,
      groundBrightness: 0.25,
      gridOpacity: 0.2,
      gridColor: '#0a0a12',
      fogDensity: 0.65,
      fogColor: '#08060e',
      fogNear: 5000,
      fogFar: 50000,
      horizonGlow: 0.0,
      showTreeline: false,
      showScalePoles: false,
      groundFogIntensity: 0.9,
      effectBrightness: 1.4,
      effectScale: 1.0,
      bloomStrength: 1.6,
      particleDensity: 1.3,
      smokeOpacity: 0.8,
      trailLength: 1.0,
      hdrMultiplier: 3.5,
      burstFlashIntensity: 0.6,
      afterglowDuration: 2.0,
      afterglowIntensity: 0.15,
      thermalTransitionSpeed: 1.0,
      weather: 'haze',
      humidity: 0.5,
      shadowsEnabled: true,
      shadowQuality: 'high',
      rimLightIntensity: 0.7,
      fillLightIntensity: 0.3,
      vignetteEnabled: true,
      vignetteIntensity: 0.4,
      chromaticAberration: true,
      filmGrain: 0.02,
      viewTransform: 'standard' as ViewTransform,
    },
  },
};

// ═══ Environment & Quality toggles (ShowSim + Finale 3D) ═══
export interface EnvironmentState {
  skyRotation: number;           // 0-360 degrees — rotate skybox panorama
  lockPositions: boolean;        // Finale 3D: lock/unlock positions from accidental movement
  lowQualityMode: boolean;       // ShowSim: reduce particles, disable smoke/trails
  disableSmoke: boolean;         // ShowSim: completely remove smoke trails
  disableLighting: boolean;      // ShowSim: disable dynamic lights from explosions
  smokeIntensity: number;        // 0-1 ShowSim smoke intensity slider
  groundColorOverride: string | null; // ShowSim custom ground color (null = use preset)
  showRulers: boolean;           // ShowSim: vertical/horizontal rulers toggle
  showPositionLabels: boolean;   // Toggle position name labels in viewport
  cameraBookmarks: CameraBookmark[];
  // ═══ Finale 3D Viewport Tools ═══
  showAxesHelper: boolean;       // XYZ color-coded axes at origin
  positionTransformMode: 'translate' | 'rotate' | 'scale';  // Gizmo mode for position pins
  gridSnapResolution: number;    // Snap grid cell size in meters (0.1 – 10)
}

export interface CameraBookmark {
  id: string;
  name: string;
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
}

export type CameraInterpMode = 'linear' | 'accelerated' | 'decelerated' | 'acc-dec';

export interface SiteModel {
  id: string;
  name: string;
  url: string; // blob URL
  position: [number, number, number];
  rotation: [number, number, number];
  scale: number;
  visible: boolean;
  source: string;
}

export type SiteModelTransformMode = 'translate' | 'rotate' | 'scale';

export interface TransformSnapSettings {
  enabled: boolean;
  translateSnap: number;
  rotateSnap: number;
  scaleSnap: number;
}

interface SceneSettingsState {
  settings: SceneSettings;
  qualityPreset: QualityPreset;
  environment: EnvironmentState;
  siteModels: SiteModel[];
  selectedSiteModelId: string | null;
  siteModelTransformMode: SiteModelTransformMode;
  transformSnap: TransformSnapSettings;
  terrain: TerrainData | null;
  terrainPreset: string;
  updateSettings: (updates: Partial<SceneSettings>) => void;
  applyPreset: (presetId: string) => void;
  applyQualityPreset: (preset: QualityPreset) => void;
  resetToDefault: () => void;
  updateEnvironment: (updates: Partial<EnvironmentState>) => void;
  addCameraBookmark: (bookmark: CameraBookmark) => void;
  removeCameraBookmark: (id: string) => void;
  addSiteModel: (model: SiteModel) => void;
  updateSiteModel: (id: string, updates: Partial<SiteModel>) => void;
  removeSiteModel: (id: string) => void;
  selectSiteModel: (id: string | null) => void;
  setSiteModelTransformMode: (mode: SiteModelTransformMode) => void;
  setTransformSnap: (updates: Partial<TransformSnapSettings>) => void;
  setTerrain: (data: TerrainData | null) => void;
  updateTerrainConfig: (updates: Partial<TerrainConfig>) => void;
  clearTerrain: () => void;
  setTerrainPreset: (preset: string) => void;
}

const DEFAULT_ENVIRONMENT: EnvironmentState = {
  skyRotation: 0,
  lockPositions: false,
  lowQualityMode: false,
  disableSmoke: true,
  disableLighting: false,
  smokeIntensity: 0.45,
  groundColorOverride: null,
  showRulers: false,
  showPositionLabels: true,
  cameraBookmarks: [],
  showAxesHelper: true,
  positionTransformMode: 'translate',
  gridSnapResolution: 1,
};

export const useSceneStore = create<SceneSettingsState>((set) => ({
  settings: { ...DEFAULT_SETTINGS },
  qualityPreset: 'show',
  environment: { ...DEFAULT_ENVIRONMENT },
  siteModels: [],
  selectedSiteModelId: null,
  siteModelTransformMode: 'translate',
  transformSnap: { enabled: true, translateSnap: 1, rotateSnap: 15, scaleSnap: 0.1 },
  terrain: null,
  terrainPreset: 'grass-field',
  updateSettings: (updates) => set(s => {
    const next = { ...s.settings, ...updates };
    if (updates.weather && !updates.rainIntensity) {
      if (updates.weather === 'light-rain') { next.rainIntensity = Math.max(next.rainIntensity, 0.5); next.humidity = Math.max(next.humidity, 0.7); }
      else if (updates.weather === 'heavy-rain') { next.rainIntensity = Math.max(next.rainIntensity, 0.8); next.humidity = Math.max(next.humidity, 0.9); }
      else if (updates.weather === 'snow') { next.rainIntensity = Math.max(next.rainIntensity, 0.4); next.humidity = Math.max(next.humidity, 0.6); }
      else if (updates.weather === 'fog') { next.humidity = Math.max(next.humidity, 0.85); next.fogDensity = Math.max(next.fogDensity, 0.7); }
      else if (updates.weather === 'clear') { next.rainIntensity = 0; }
    }
    return { settings: next };
  }),
  applyPreset: (presetId) => {
    const preset = SCENE_PRESETS[presetId];
    if (preset) set(s => ({ settings: { ...DEFAULT_SETTINGS, ...preset.settings } }));
  },
  applyQualityPreset: (preset) => {
    const qp = QUALITY_PRESETS[preset];
    if (qp) set(s => ({ qualityPreset: preset, settings: { ...s.settings, ...qp.settings } }));
  },
  resetToDefault: () => set({ settings: { ...DEFAULT_SETTINGS }, qualityPreset: 'show', environment: { ...DEFAULT_ENVIRONMENT } }),
  updateEnvironment: (updates) => set(s => ({ environment: { ...s.environment, ...updates } })),
  addCameraBookmark: (bookmark) => set(s => ({ environment: { ...s.environment, cameraBookmarks: [...s.environment.cameraBookmarks, bookmark] } })),
  removeCameraBookmark: (id) => set(s => ({ environment: { ...s.environment, cameraBookmarks: s.environment.cameraBookmarks.filter(b => b.id !== id) } })),
  addSiteModel: (model) => set(s => ({ siteModels: [...s.siteModels, model] })),
  updateSiteModel: (id, updates) => set(s => ({
    siteModels: s.siteModels.map(m => m.id === id ? { ...m, ...updates } : m),
  })),
  removeSiteModel: (id) => set(s => {
    const model = s.siteModels.find(m => m.id === id);
    if (model?.url.startsWith('blob:')) URL.revokeObjectURL(model.url);
    return { siteModels: s.siteModels.filter(m => m.id !== id), selectedSiteModelId: s.selectedSiteModelId === id ? null : s.selectedSiteModelId };
  }),
  selectSiteModel: (id) => set({ selectedSiteModelId: id }),
  setSiteModelTransformMode: (mode) => set({ siteModelTransformMode: mode }),
  setTransformSnap: (updates) => set((s) => ({ transformSnap: { ...s.transformSnap, ...updates } })),
  setTerrain: (data) => set({ terrain: data }),
  updateTerrainConfig: (updates) => set((s) => s.terrain ? { terrain: { ...s.terrain, config: { ...s.terrain.config, ...updates } } } : {}),
  clearTerrain: () => set({ terrain: null }),
  setTerrainPreset: (preset) => set({ terrainPreset: preset }),
}));
