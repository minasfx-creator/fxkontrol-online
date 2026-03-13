import { create } from 'zustand';

export type GroundStyle = 'finale-dark' | 'google-earth' | 'flat-black' | 'concrete' | 'custom';
export type SkyPreset = 'night-clear' | 'night-cloudy' | 'dusk' | 'overcast' | 'foggy' | 'custom';
export type WeatherCondition = 'clear' | 'light-rain' | 'heavy-rain' | 'snow' | 'fog' | 'haze' | 'wind-only';

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
  ambientIntensity: 0.06,
  moonIntensity: 0.45,
  moonColor: '#8899cc',
  skyBrightness: 1.0,
  starDensity: 1.0,
  fogDensity: 0.5,
  fogColor: '#080e1a',
  fogNear: 200,
  fogFar: 1800,
  horizonGlow: 0.35,

  groundStyle: 'finale-dark',
  groundBrightness: 1.0,
  gridOpacity: 0.6,
  gridColor: '#1a3a1a',
  showGrid: true,
  showOriginMarker: true,
  showScalePoles: true,
  showTreeline: true,
  groundFogIntensity: 0.5,

  weather: 'clear',
  rainIntensity: 0,
  windEffect: 0,
  humidity: 0.4,
  temperature: 22,
  visibility: 1.0,

  effectScale: 1.0,
  effectBrightness: 1.0,
  trailLength: 1.0,
  particleDensity: 1.0,
  smokeOpacity: 0.5,
  bloomStrength: 1.0,

  shadowsEnabled: true,
  shadowQuality: 'high',
  rimLightIntensity: 0.5,
  fillLightIntensity: 0.3,

  vignetteEnabled: false,
  vignetteIntensity: 0.3,
  chromaticAberration: false,
  filmGrain: 0,
};

export const SCENE_PRESETS: Record<string, { name: string; description: string; settings: Partial<SceneSettings> }> = {
  'finale-night': {
    name: 'Finale 3D Night',
    description: 'Dark professional environment like Finale 3D',
    settings: {
      skyPreset: 'night-clear',
      groundStyle: 'finale-dark',
      ambientIntensity: 0.04,
      moonIntensity: 0.3,
      skyBrightness: 0.7,
      groundBrightness: 0.6,
      fogDensity: 0.3,
      fogFar: 2000,
      horizonGlow: 0.2,
      showTreeline: false,
      effectBrightness: 1.2,
      bloomStrength: 1.3,
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
      showTreeline: true,
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
  updateSettings: (updates: Partial<SceneSettings>) => void;
  applyPreset: (presetId: string) => void;
  resetToDefault: () => void;
}

export const useSceneStore = create<SceneSettingsState>((set) => ({
  settings: { ...DEFAULT_SETTINGS },
  updateSettings: (updates) => set(s => ({ settings: { ...s.settings, ...updates } })),
  applyPreset: (presetId) => {
    const preset = SCENE_PRESETS[presetId];
    if (preset) set(s => ({ settings: { ...DEFAULT_SETTINGS, ...preset.settings } }));
  },
  resetToDefault: () => set({ settings: { ...DEFAULT_SETTINGS } }),
}));
