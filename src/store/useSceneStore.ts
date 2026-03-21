import { create } from 'zustand';
import type { ViewTransform } from '@/lib/niagaraBlenderRules';
import type { TerrainData, TerrainConfig } from '@/lib/heightmapToTerrain';

export type GroundStyle = 'finale-dark' | 'google-earth' | 'flat-black' | 'concrete' | 'sfx-stage' | 'custom';
export type SkyPreset = 'night-clear' | 'night-cloudy' | 'dusk' | 'overcast' | 'foggy' | 'custom';
export type WeatherCondition = 'clear' | 'light-rain' | 'heavy-rain' | 'snow' | 'fog' | 'haze' | 'wind-only';
export type QualityPreset = 'realistic' | 'show' | 'performance';
export type { ViewTransform };
export const QUALITY_PRESETS: Record<QualityPreset, { name: string; description: string; settings: Partial<SceneSettings> }> = {
  realistic: {
    name: 'Realista',
    description: 'Máxima fidelidade — partículas densas, fumaça volumétrica espessa, bloom HDR multicamada',
    settings: {
      particleDensity: 2.0,
      smokeOpacity: 0.85,
      bloomStrength: 1.6,
      trailLength: 1.8,
      effectBrightness: 1.1,
      shadowsEnabled: true,
      shadowQuality: 'ultra',
      vignetteEnabled: true,
      vignetteIntensity: 0.3,
      chromaticAberration: true,
      filmGrain: 0.035,
      groundFogIntensity: 0.7,
      ssaoEnabled: true,
      ssaoIntensity: 0.7,
      dofEnabled: true,
      dofFocusDistance: 150,
      dofBokehScale: 3.0,
      godRaysEnabled: true,
      colorBrightness: 0,
      colorContrast: 0.05,
      colorSaturation: 0.05,
      ssrEnabled: true,
      ssrIntensity: 0.6,
      ssrThickness: 10,
      sharpenEnabled: true,
      sharpenStrength: 0.1,
      contactShadowsEnabled: true,
      contactShadowsOpacity: 0.6,
      contactShadowsBlur: 2.5,
      heatDistortionEnabled: true,
      smokeRenderQuality: 'high' as const,
      ribbonTrails: true,
    },
  },
  show: {
    name: 'Show',
    description: 'Balanceado para apresentação — visual impactante com boa performance',
    settings: {
      particleDensity: 1.0,
      smokeOpacity: 0.5,
      bloomStrength: 1.1,
      trailLength: 1.0,
      effectBrightness: 1.0,
      shadowsEnabled: true,
      shadowQuality: 'high',
      vignetteEnabled: true,
      vignetteIntensity: 0.2,
      chromaticAberration: true,
      filmGrain: 0.02,
      groundFogIntensity: 0.5,
      ssaoEnabled: true,
      ssaoIntensity: 0.35,
      dofEnabled: false,
      godRaysEnabled: true,
      colorBrightness: 0,
      colorContrast: 0,
      colorSaturation: 0,
      ssrEnabled: false,
      ssrIntensity: 0.4,
      ssrThickness: 10,
      sharpenEnabled: true,
      sharpenStrength: 0.05,
      contactShadowsEnabled: true,
      contactShadowsOpacity: 0.4,
      contactShadowsBlur: 2.0,
      heatDistortionEnabled: true,
      smokeRenderQuality: 'low' as const,
      ribbonTrails: true,
    },
  },
  performance: {
    name: 'Performance',
    description: 'Máximo FPS — partículas reduzidas, sem fumaça, bloom leve, sem pós-processamento',
    settings: {
      particleDensity: 0.5,
      smokeOpacity: 0.1,
      bloomStrength: 0.5,
      trailLength: 0.5,
      effectBrightness: 1.2,
      shadowsEnabled: false,
      shadowQuality: 'low',
      vignetteEnabled: false,
      vignetteIntensity: 0,
      chromaticAberration: false,
      filmGrain: 0,
      groundFogIntensity: 0.1,
      ssaoEnabled: false,
      ssaoIntensity: 0,
      dofEnabled: false,
      godRaysEnabled: false,
      colorBrightness: 0,
      colorContrast: 0,
      colorSaturation: 0,
      ssrEnabled: false,
      ssrIntensity: 0,
      ssrThickness: 10,
      sharpenEnabled: false,
      sharpenStrength: 0,
      contactShadowsEnabled: false,
      contactShadowsOpacity: 0,
      contactShadowsBlur: 1.0,
      heatDistortionEnabled: false,
      smokeRenderQuality: 'off' as const,
      ribbonTrails: false,
    },
  },
};

export interface SceneSettings {
  // Sky & Atmosphere
  skyPreset: SkyPreset;
  ambientIntensity: number;      // 0-1
  moonIntensity: number;         // 0-2
  moonColor: string;             // hex
  skyBrightness: number;         // 0-2 multiplier
  starDensity: number;           // 0-2 multiplier
  fogDensity: number;            // 0-1
  fogColor: string;
  fogNear: number;
  fogFar: number;
  horizonGlow: number;           // 0-1

  // Ground
  groundStyle: GroundStyle;
  groundBrightness: number;      // 0-2
  gridOpacity: number;           // 0-1
  gridColor: string;
  showGrid: boolean;
  showOriginMarker: boolean;
  showScalePoles: boolean;
  showTreeline: boolean;
  groundFogIntensity: number;    // 0-1

  // Weather
  weather: WeatherCondition;
  rainIntensity: number;         // 0-1
  windEffect: number;            // 0-1 (visual wind on particles/fog)
  humidity: number;              // 0-1 (affects effect visibility)
  temperature: number;           // Celsius (affects smoke behavior)
  visibility: number;            // 0-1 (1 = clear, 0 = heavy fog)

  // Effects rendering
  effectScale: number;           // 0-2 (scale break heights)
  effectBrightness: number;      // 0-2
  trailLength: number;           // 0-2
  particleDensity: number;       // 0.5-2 
  smokeOpacity: number;          // 0-1
  bloomStrength: number;         // 0-2

  // Pyro rendering (GPU shell burst)
  hdrMultiplier: number;         // 1-8 HDR core brightness
  starDrag: number;              // 0.01-0.3 aerodynamic drag on stars
  windSpeed: number;             // 0-5 m/s wind force on particles
  windDirection: number;         // 0-360 degrees
  afterglowDuration: number;     // 0.5-8 seconds afterglow persists
  afterglowIntensity: number;    // 0-1 afterglow opacity
  burstFlashIntensity: number;   // 0-2 detonation flash brightness
  thermalTransitionSpeed: number; // 0.5-3 how fast color cools

  // Lighting
  shadowsEnabled: boolean;
  shadowQuality: 'low' | 'medium' | 'high' | 'ultra';
  rimLightIntensity: number;     // 0-1
  fillLightIntensity: number;    // 0-1

  // Post-processing
  vignetteEnabled: boolean;
  vignetteIntensity: number;
  chromaticAberration: boolean;
  filmGrain: number;
  viewTransform: ViewTransform;
  exposureCompensation: number;   // -2 to +2 EV (default 0)

  // Advanced Post-Processing (AAA)
  ssaoEnabled: boolean;
  ssaoIntensity: number;         // 0-1
  dofEnabled: boolean;
  dofFocusDistance: number;      // meters
  dofBokehScale: number;        // 0-5
  godRaysEnabled: boolean;
  colorBrightness: number;      // -1 to 1
  colorContrast: number;        // -1 to 1
  colorSaturation: number;      // -1 to 1

  // UE5 DMXPrevis-inspired effects
  ssrEnabled: boolean;           // Screen Space Reflections
  ssrIntensity: number;          // 0-1
  ssrThickness: number;          // ray thickness (1-50)
  sharpenEnabled: boolean;       // Tonemapper.Sharpen
  sharpenStrength: number;       // 0-1
  contactShadowsEnabled: boolean;
  contactShadowsOpacity: number; // 0-1
  contactShadowsBlur: number;    // 0-5

  // Niagara-grade rendering settings
  heatDistortionEnabled: boolean;
  smokeRenderQuality: 'off' | 'low' | 'high';
  ribbonTrails: boolean;
}

const DEFAULT_SETTINGS: SceneSettings = {
  skyPreset: 'night-clear',
  ambientIntensity: 0.05,
  moonIntensity: 0.45,
  moonColor: '#8899cc',
  skyBrightness: 1.0,
  starDensity: 1.0,
  fogDensity: 0.4,
  fogColor: '#080e1a',
  fogNear: 25000,
  fogFar: 300000,
  horizonGlow: 0.5,

  groundStyle: 'finale-dark',
  groundBrightness: 1.0,
  gridOpacity: 0.6,
  gridColor: '#1a1a2e',
  showGrid: true,
  showOriginMarker: true,
  showScalePoles: false,
  showTreeline: false,
  groundFogIntensity: 0.4,

  weather: 'clear',
  rainIntensity: 0,
  windEffect: 0,
  humidity: 0.4,
  temperature: 22,
  visibility: 1.0,

  effectScale: 1.0,
  effectBrightness: 1.2,
  trailLength: 1.2,
  particleDensity: 1.0,
  smokeOpacity: 0.6,
  bloomStrength: 1.1,

  hdrMultiplier: 1.5,
  starDrag: 0.08,
  windSpeed: 0.3,
  windDirection: 90,
  afterglowDuration: 3.0,
  afterglowIntensity: 0.15,
  burstFlashIntensity: 0.15,
  thermalTransitionSpeed: 1.0,

  shadowsEnabled: true,
  shadowQuality: 'high',
  rimLightIntensity: 0.55,
  fillLightIntensity: 0.35,

  vignetteEnabled: true,
  vignetteIntensity: 0.25,
  chromaticAberration: true,
  filmGrain: 0.025,
  viewTransform: 'aces-filmic' as ViewTransform,
  exposureCompensation: 0,

  ssaoEnabled: false,
  ssaoIntensity: 0.5,
  dofEnabled: false,
  dofFocusDistance: 100,
  dofBokehScale: 2.0,
  godRaysEnabled: false,
  colorBrightness: 0,
  colorContrast: 0,
  colorSaturation: 0,

  ssrEnabled: false,
  ssrIntensity: 0.45,
  ssrThickness: 10,
  sharpenEnabled: false,
  sharpenStrength: 0.1,
  contactShadowsEnabled: false,
  contactShadowsOpacity: 0.5,
  contactShadowsBlur: 2.0,

  heatDistortionEnabled: false,
  smokeRenderQuality: 'low',
  ribbonTrails: false,
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
  cameraBookmarks: CameraBookmark[];
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
  cameraBookmarks: [],
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
}));
