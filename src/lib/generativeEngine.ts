/**
 * Generative Effects Engine (Lightjams-inspired)
 * Pipeline: Generators → Layers → Blend → Output colors per pixel/fixture.
 */

export type GeneratorType = 'colorCycle' | 'strobe' | 'chase' | 'rainbow' | 'pulse' | 'sparkle' | 'wave' | 'gradient';
export type BlendMode = 'add' | 'multiply' | 'screen' | 'overlay';
export type AudioBand = 'bass' | 'mid' | 'high' | 'none';

export interface GeneratorParams {
  speed: number;      // 0-10
  intensity: number;  // 0-1
  spread: number;     // 0-1
  offset: number;     // 0-1
  color1: string;     // hex
  color2: string;     // hex
}

export interface GenerativeLayer {
  id: string;
  name: string;
  generator: GeneratorType;
  params: GeneratorParams;
  blendMode: BlendMode;
  opacity: number;        // 0-1
  audioModulation: AudioBand;
  enabled: boolean;
}

export interface GenerativePreset {
  id: string;
  name: string;
  layers: GenerativeLayer[];
}

export interface RGBColor {
  r: number; g: number; b: number; // 0-1
}

// ── Hex ↔ RGB helpers ──

export function hexToRGB(hex: string): RGBColor {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.substring(0, 2), 16) / 255,
    g: parseInt(h.substring(2, 4), 16) / 255,
    b: parseInt(h.substring(4, 6), 16) / 255,
  };
}

export function rgbToHex(c: RGBColor): string {
  const clamp = (v: number) => Math.max(0, Math.min(1, v));
  const toHex = (v: number) => Math.round(clamp(v) * 255).toString(16).padStart(2, '0');
  return `#${toHex(c.r)}${toHex(c.g)}${toHex(c.b)}`;
}

function lerpColor(a: RGBColor, b: RGBColor, t: number): RGBColor {
  return { r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t };
}

function hslToRGB(h: number, s: number, l: number): RGBColor {
  if (s === 0) return { r: l, g: l, b: l };
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return { r: hue2rgb(p, q, h + 1/3), g: hue2rgb(p, q, h), b: hue2rgb(p, q, h - 1/3) };
}

// ── Generators ──

function evalGenerator(type: GeneratorType, params: GeneratorParams, pixelIndex: number, totalPixels: number, time: number): RGBColor {
  const { speed, intensity, spread, offset, color1, color2 } = params;
  const c1 = hexToRGB(color1);
  const c2 = hexToRGB(color2);
  const norm = totalPixels > 1 ? pixelIndex / (totalPixels - 1) : 0;
  const t = time * speed;

  switch (type) {
    case 'colorCycle': {
      const phase = (t * 0.5 + norm * spread + offset) % 1;
      return lerpColor(c1, c2, (Math.sin(phase * Math.PI * 2) + 1) / 2);
    }
    case 'strobe': {
      const on = Math.sin(t * Math.PI * 2) > (1 - intensity * 2);
      return on ? c1 : { r: 0, g: 0, b: 0 };
    }
    case 'chase': {
      const pos = (t * 0.3 + offset) % 1;
      const dist = Math.abs(norm - pos);
      const w = Math.max(0, 1 - dist / Math.max(0.01, spread));
      return lerpColor({ r: 0, g: 0, b: 0 }, c1, w * intensity);
    }
    case 'rainbow': {
      const hue = (norm * spread + t * 0.2 + offset) % 1;
      const rgb = hslToRGB(hue, 1, 0.5);
      return { r: rgb.r * intensity, g: rgb.g * intensity, b: rgb.b * intensity };
    }
    case 'pulse': {
      const v = (Math.sin(t * 2 + offset * Math.PI * 2) + 1) / 2 * intensity;
      return lerpColor({ r: 0, g: 0, b: 0 }, c1, v);
    }
    case 'sparkle': {
      const hash = Math.sin(pixelIndex * 127.1 + Math.floor(t * 8) * 311.7) * 43758.5453;
      const spark = (hash - Math.floor(hash)) > (1 - spread * 0.3) ? intensity : 0;
      return { r: c1.r * spark, g: c1.g * spark, b: c1.b * spark };
    }
    case 'wave': {
      const wave = (Math.sin(norm * Math.PI * 2 * spread * 3 - t * 2 + offset * Math.PI * 2) + 1) / 2;
      return lerpColor(c1, c2, wave * intensity);
    }
    case 'gradient': {
      const g = Math.max(0, Math.min(1, norm * spread + offset));
      return lerpColor(c1, c2, g);
    }
    default:
      return { r: 0, g: 0, b: 0 };
  }
}

// ── Blending ──

function blendColors(base: RGBColor, layer: RGBColor, mode: BlendMode, opacity: number): RGBColor {
  let result: RGBColor;
  switch (mode) {
    case 'add':
      result = { r: base.r + layer.r, g: base.g + layer.g, b: base.b + layer.b };
      break;
    case 'multiply':
      result = { r: base.r * layer.r, g: base.g * layer.g, b: base.b * layer.b };
      break;
    case 'screen':
      result = { r: 1 - (1 - base.r) * (1 - layer.r), g: 1 - (1 - base.g) * (1 - layer.g), b: 1 - (1 - base.b) * (1 - layer.b) };
      break;
    case 'overlay':
      result = {
        r: base.r < 0.5 ? 2 * base.r * layer.r : 1 - 2 * (1 - base.r) * (1 - layer.r),
        g: base.g < 0.5 ? 2 * base.g * layer.g : 1 - 2 * (1 - base.g) * (1 - layer.g),
        b: base.b < 0.5 ? 2 * base.b * layer.b : 1 - 2 * (1 - base.b) * (1 - layer.b),
      };
      break;
    default:
      result = layer;
  }
  return {
    r: base.r + (result.r - base.r) * opacity,
    g: base.g + (result.g - base.g) * opacity,
    b: base.b + (result.b - base.b) * opacity,
  };
}

// ── Audio modulation ──

export interface AudioModulationData {
  bass: number;   // 0-1
  mid: number;    // 0-1
  high: number;   // 0-1
}

function getModFactor(band: AudioBand, audio: AudioModulationData): number {
  if (band === 'none') return 1;
  return audio[band];
}

// ── Main render function ──

export function renderGenerativeFrame(
  layers: GenerativeLayer[],
  pixelCount: number,
  time: number,
  audio: AudioModulationData = { bass: 0.5, mid: 0.5, high: 0.5 }
): RGBColor[] {
  const output: RGBColor[] = new Array(pixelCount);
  for (let i = 0; i < pixelCount; i++) output[i] = { r: 0, g: 0, b: 0 };

  for (const layer of layers) {
    if (!layer.enabled) continue;
    const modFactor = getModFactor(layer.audioModulation, audio);
    const effectiveOpacity = layer.opacity * modFactor;

    for (let px = 0; px < pixelCount; px++) {
      const color = evalGenerator(layer.generator, layer.params, px, pixelCount, time);
      output[px] = blendColors(output[px], color, layer.blendMode, effectiveOpacity);
    }
  }

  // Clamp
  for (let i = 0; i < pixelCount; i++) {
    output[i].r = Math.max(0, Math.min(1, output[i].r));
    output[i].g = Math.max(0, Math.min(1, output[i].g));
    output[i].b = Math.max(0, Math.min(1, output[i].b));
  }

  return output;
}

// ── Default layer factory ──

let layerCounter = 0;
export function createDefaultLayer(generator: GeneratorType = 'rainbow'): GenerativeLayer {
  layerCounter++;
  return {
    id: `layer-${Date.now()}-${layerCounter}`,
    name: `Layer ${layerCounter}`,
    generator,
    params: {
      speed: 1,
      intensity: 0.8,
      spread: 0.5,
      offset: 0,
      color1: '#ff4400',
      color2: '#4488ff',
    },
    blendMode: 'add',
    opacity: 1,
    audioModulation: 'none',
    enabled: true,
  };
}

// ── Built-in Presets ──

export const GENERATIVE_PRESETS: GenerativePreset[] = [
  {
    id: 'concert',
    name: 'Concert',
    layers: [
      { ...createDefaultLayer('chase'), name: 'Chase Beam', params: { speed: 3, intensity: 1, spread: 0.15, offset: 0, color1: '#ff2266', color2: '#000000' }, blendMode: 'add', audioModulation: 'bass' },
      { ...createDefaultLayer('strobe'), name: 'Strobe Flash', params: { speed: 8, intensity: 1, spread: 0.5, offset: 0, color1: '#ffffff', color2: '#000000' }, blendMode: 'add', opacity: 0.4, audioModulation: 'high' },
    ],
  },
  {
    id: 'festival',
    name: 'Festival',
    layers: [
      { ...createDefaultLayer('rainbow'), name: 'Rainbow Sweep', params: { speed: 1.5, intensity: 0.9, spread: 1, offset: 0, color1: '#ff0000', color2: '#0000ff' }, blendMode: 'add', audioModulation: 'mid' },
      { ...createDefaultLayer('sparkle'), name: 'Sparkle Overlay', params: { speed: 6, intensity: 0.7, spread: 0.4, offset: 0, color1: '#ffdd00', color2: '#000000' }, blendMode: 'screen', opacity: 0.6, audioModulation: 'high' },
    ],
  },
  {
    id: 'gala',
    name: 'Gala',
    layers: [
      { ...createDefaultLayer('gradient'), name: 'Gold Wash', params: { speed: 0.3, intensity: 0.8, spread: 1, offset: 0, color1: '#ffd700', color2: '#8b4513' }, blendMode: 'add', audioModulation: 'none' },
      { ...createDefaultLayer('pulse'), name: 'Warm Pulse', params: { speed: 0.5, intensity: 0.6, spread: 0.5, offset: 0, color1: '#ff8844', color2: '#000000' }, blendMode: 'screen', opacity: 0.5, audioModulation: 'bass' },
    ],
  },
  {
    id: 'club',
    name: 'Club',
    layers: [
      { ...createDefaultLayer('strobe'), name: 'Hard Strobe', params: { speed: 12, intensity: 1, spread: 0.5, offset: 0, color1: '#ffffff', color2: '#000000' }, blendMode: 'add', audioModulation: 'bass' },
      { ...createDefaultLayer('chase'), name: 'Neon Chase', params: { speed: 5, intensity: 1, spread: 0.1, offset: 0, color1: '#00ffff', color2: '#000000' }, blendMode: 'add', audioModulation: 'mid' },
      { ...createDefaultLayer('colorCycle'), name: 'UV Cycle', params: { speed: 2, intensity: 0.7, spread: 0.8, offset: 0, color1: '#8800ff', color2: '#ff0088' }, blendMode: 'screen', opacity: 0.5, audioModulation: 'high' },
    ],
  },
  {
    id: 'theater',
    name: 'Theater',
    layers: [
      { ...createDefaultLayer('gradient'), name: 'Stage Wash', params: { speed: 0.2, intensity: 0.6, spread: 0.8, offset: 0.1, color1: '#2244aa', color2: '#aa2244' }, blendMode: 'add', audioModulation: 'none' },
      { ...createDefaultLayer('wave'), name: 'Gentle Wave', params: { speed: 0.4, intensity: 0.5, spread: 0.3, offset: 0, color1: '#4466cc', color2: '#cc6644' }, blendMode: 'screen', opacity: 0.4, audioModulation: 'mid' },
    ],
  },
  {
    id: 'custom',
    name: 'Custom',
    layers: [createDefaultLayer('rainbow')],
  },
];

export const GENERATOR_LABELS: Record<GeneratorType, string> = {
  colorCycle: 'Color Cycle',
  strobe: 'Strobe',
  chase: 'Chase',
  rainbow: 'Rainbow',
  pulse: 'Pulse',
  sparkle: 'Sparkle',
  wave: 'Wave',
  gradient: 'Gradient',
};

export const BLEND_MODE_LABELS: Record<BlendMode, string> = {
  add: 'Add',
  multiply: 'Multiply',
  screen: 'Screen',
  overlay: 'Overlay',
};
