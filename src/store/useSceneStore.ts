import { create } from 'zustand';

export type GroundStyle = 'finale-dark' | 'google-earth' | 'flat-black' | 'concrete' | 'custom';
export type SkyPreset = 'night-clear' | 'night-cloudy' | 'dusk' | 'overcast' | 'foggy' | 'custom';
export type WeatherCondition = 'clear' | 'light-rain' | 'heavy-rain' | 'snow' | 'fog' | 'haze' | 'wind-only';
export type QualityPreset = 'realistic' | 'show' | 'performance';

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
}

const DEFAULT_SETTINGS: SceneSettings = {
  skyPreset: 'night-clear',
  ambientIntensity: 0.05,
  moonIntensity: 0.45,
  moonColor: '#8899cc',
  skyBrightness: 1.0,
  starDensity: 1.3,
  fogDensity: 0.4,
  fogColor: '#080e1a',
  fogNear: 500,
  fogFar: 6000,
  horizonGlow: 0.5,

  groundStyle: 'finale-dark',
  groundBrightness: 1.0,
  gridOpacity: 0.6,
  gridColor: '#1a1a2e',
  showGrid: true,
  showOriginMarker: true,
  showScalePoles: false,
  showTreeline: false,
  groundFogIntensity: 0.6,

  weather: 'clear',
  rainIntensity: 0,
  windEffect: 0,
  humidity: 0.4,
  temperature: 22,
  visibility: 1.0,

  effectScale: 1.0,
  effectBrightness: 1.2,
  trailLength: 1.2,
  particleDensity: 1.2,
  smokeOpacity: 0.6,
  bloomStrength: 1.4,

  hdrMultiplier: 3.5,
  starDrag: 0.08,
  windSpeed: 0.3,
  windDirection: 90,
  afterglowDuration: 3.0,
  afterglowIntensity: 0.15,
  burstFlashIntensity: 1.0,
  thermalTransitionSpeed: 1.0,

  shadowsEnabled: true,
  shadowQuality: 'high',
  rimLightIntensity: 0.55,
  fillLightIntensity: 0.35,

  vignetteEnabled: true,
  vignetteIntensity: 0.25,
  chromaticAberration: true,
  filmGrain: 0.025,
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
      fogNear: 800,
      fogFar: 4000,
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
      fogFar: 800,
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
      fogFar: 400,
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
      fogFar: 600,
      moonIntensity: 0.1,
      starDensity: 0.0,
      smokeOpacity: 0.3,
      groundFogIntensity: 0.2,
    },
  },
};

interface SceneSettingsState {
  settings: SceneSettings;
  qualityPreset: QualityPreset;
  updateSettings: (updates: Partial<SceneSettings>) => void;
  applyPreset: (presetId: string) => void;
  applyQualityPreset: (preset: QualityPreset) => void;
  resetToDefault: () => void;
}

export const useSceneStore = create<SceneSettingsState>((set) => ({
  settings: { ...DEFAULT_SETTINGS },
  qualityPreset: 'show',
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
  resetToDefault: () => set({ settings: { ...DEFAULT_SETTINGS }, qualityPreset: 'show' }),
}));
