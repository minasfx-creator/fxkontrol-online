import { EffectComposer, Bloom, Vignette, ChromaticAberration, SMAA, Noise, ToneMapping, SSAO, DepthOfField, BrightnessContrast, HueSaturation, SSR } from '@react-three/postprocessing';
import { KernelSize, BlendFunction, ToneMappingMode, Effect } from 'postprocessing';
import { Vector2, Uniform } from 'three';
import { useSceneStore } from '@/store/useSceneStore';
import type { ViewTransform } from '@/lib/niagaraBlenderRules';
import { forwardRef, useMemo } from 'react';
import { isEnabled } from '@/lib/featureFlags';
import { HalationEffect } from '@/render_ultra/postprocessing/halation';
import { HighlightDesaturationEffect } from '@/render_ultra/postprocessing/highlightDesaturation';
import { ACESHuePreserveEffect } from '@/render_ultra/postprocessing/acesHuePreserve';
import { LuminanceFilmGrainEffect } from '@/render_ultra/postprocessing/luminanceFilmGrain';
import { AtmosphericDepthEffect } from '@/render_ultra/postprocessing/atmosphericDepth';

const TONE_MAP: Record<ViewTransform, ToneMappingMode> = {
  'aces-filmic': ToneMappingMode.ACES_FILMIC,
  'agx': ToneMappingMode.AGX,
  'standard': ToneMappingMode.LINEAR,
  'pbr-neutral': ToneMappingMode.AGX,
};

const BLOOM_SCALE: Record<ViewTransform, number> = {
  'aces-filmic': 1.0,
  'agx': 0.7,
  'standard': 1.3,
  'pbr-neutral': 0.85,
};

// ═══════════════════════════════════════════════════════════════════════
// Custom Sharpening Effect — Unsharp Mask (UE5 r.Tonemapper.Sharpen)
// ═══════════════════════════════════════════════════════════════════════

const SHARPEN_FRAGMENT = `
uniform float strength;

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec2 texelSize = 1.0 / resolution;
  
  vec4 center = inputColor;
  vec4 top    = texture2D(inputBuffer, uv + vec2(0.0, texelSize.y));
  vec4 bottom = texture2D(inputBuffer, uv - vec2(0.0, texelSize.y));
  vec4 left   = texture2D(inputBuffer, uv - vec2(texelSize.x, 0.0));
  vec4 right  = texture2D(inputBuffer, uv + vec2(texelSize.x, 0.0));
  
  vec4 sharpen = center * (1.0 + 4.0 * strength) - (top + bottom + left + right) * strength;
  outputColor = clamp(sharpen, 0.0, 1.0);
}
`;

class SharpenEffect extends Effect {
  constructor({ strength = 0.1 }: { strength?: number } = {}) {
    super('SharpenEffect', SHARPEN_FRAGMENT, {
      uniforms: new Map([['strength', new Uniform(strength)]]),
    });
  }

  set strength(value: number) {
    (this.uniforms.get('strength') as Uniform).value = value;
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Heat Distortion Effect — UE5 Niagara Heat Haze
// ═══════════════════════════════════════════════════════════════════════

const HEAT_DISTORTION_FRAGMENT = `
uniform float intensity;
uniform float time;
uniform float scale;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 3; i++) {
    v += a * noise(p);
    p *= 2.0;
    a *= 0.5;
  }
  return v;
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec2 noiseCoord = uv * scale + vec2(0.0, -time * 0.8);
  float n1 = fbm(noiseCoord * 8.0);
  float n2 = fbm(noiseCoord * 12.0 + vec2(100.0));
  
  vec2 displacement = vec2(
    (n1 - 0.5) * intensity * 0.008,
    (n2 - 0.5) * intensity * 0.012
  );
  
  vec2 centerWeight = 1.0 - pow(abs(uv - 0.5) * 2.0, vec2(2.0));
  displacement *= centerWeight.x * centerWeight.y;
  
  vec4 displaced = texture2D(inputBuffer, uv + displacement);
  displaced.r = texture2D(inputBuffer, uv + displacement * 1.1).r;
  displaced.b = texture2D(inputBuffer, uv + displacement * 0.9).b;
  
  outputColor = displaced;
}
`;

class HeatDistortionEffect extends Effect {
  constructor({ intensity = 0.5, scale = 1.0 }: { intensity?: number; scale?: number } = {}) {
    super('HeatDistortionEffect', HEAT_DISTORTION_FRAGMENT, {
      uniforms: new Map([
        ['intensity', new Uniform(intensity)],
        ['time', new Uniform(0)],
        ['scale', new Uniform(scale)],
      ]),
    });
  }

  update(_renderer: any, _inputBuffer: any, deltaTime: number) {
    const timeUniform = this.uniforms.get('time') as Uniform;
    timeUniform.value += deltaTime;
  }

  set intensity(value: number) {
    (this.uniforms.get('intensity') as Uniform).value = value;
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Motion Blur Effect — UE5 MotionBlurAmount (screen-space velocity blur)
// ═══════════════════════════════════════════════════════════════════════

const MOTION_BLUR_FRAGMENT = `
uniform float intensity;

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec2 texelSize = 1.0 / resolution;
  
  // Estimate motion from neighbor color differences (screen-space)
  vec4 left  = texture2D(inputBuffer, uv - vec2(texelSize.x * 2.0, 0.0));
  vec4 right = texture2D(inputBuffer, uv + vec2(texelSize.x * 2.0, 0.0));
  vec4 up    = texture2D(inputBuffer, uv + vec2(0.0, texelSize.y * 2.0));
  vec4 down  = texture2D(inputBuffer, uv - vec2(0.0, texelSize.y * 2.0));
  
  // Luminance-based velocity estimation
  float lC = dot(inputColor.rgb, vec3(0.299, 0.587, 0.114));
  float lL = dot(left.rgb, vec3(0.299, 0.587, 0.114));
  float lR = dot(right.rgb, vec3(0.299, 0.587, 0.114));
  float lU = dot(up.rgb, vec3(0.299, 0.587, 0.114));
  float lD = dot(down.rgb, vec3(0.299, 0.587, 0.114));
  
  vec2 velocity = vec2(lR - lL, lU - lD) * intensity * 8.0;
  velocity = clamp(velocity, -0.02, 0.02);
  
  // Multi-sample blur along velocity direction
  vec4 result = inputColor;
  float totalWeight = 1.0;
  
  for (int i = 1; i <= 4; i++) {
    float t = float(i) / 4.0;
    float weight = 1.0 - t * 0.5;
    result += texture2D(inputBuffer, uv + velocity * t) * weight;
    result += texture2D(inputBuffer, uv - velocity * t) * weight * 0.5;
    totalWeight += weight + weight * 0.5;
  }
  
  outputColor = result / totalWeight;
}
`;

class MotionBlurEffect extends Effect {
  constructor({ intensity = 0.5 }: { intensity?: number } = {}) {
    super('MotionBlurEffect', MOTION_BLUR_FRAGMENT, {
      uniforms: new Map([['intensity', new Uniform(intensity)]]),
    });
  }

  set intensity(value: number) {
    (this.uniforms.get('intensity') as Uniform).value = value;
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Radial God Rays Effect — UE5 Light Shaft (radial blur from source)
// ═══════════════════════════════════════════════════════════════════════

const GOD_RAYS_FRAGMENT = `
uniform float intensity;
uniform vec2 lightPos;

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec2 delta = uv - lightPos;
  float dist = length(delta);
  
  // Only apply to bright areas
  float lum = dot(inputColor.rgb, vec3(0.299, 0.587, 0.114));
  float brightMask = smoothstep(0.6, 1.5, lum);
  
  if (brightMask < 0.01) {
    outputColor = inputColor;
    return;
  }
  
  vec2 rayDir = normalize(delta) * 0.005 * intensity;
  
  vec4 accum = vec4(0.0);
  float decay = 1.0;
  vec2 sampleUV = uv;
  
  for (int i = 0; i < 16; i++) {
    sampleUV -= rayDir;
    vec4 s = texture2D(inputBuffer, clamp(sampleUV, 0.0, 1.0));
    float sLum = dot(s.rgb, vec3(0.299, 0.587, 0.114));
    accum += s * decay * smoothstep(0.4, 1.2, sLum);
    decay *= 0.94;
  }
  
  accum /= 16.0;
  
  // Blend radial light shafts over original
  outputColor = inputColor + accum * brightMask * intensity * 0.6;
}
`;

class GodRaysEffect extends Effect {
  constructor({ intensity = 0.5 }: { intensity?: number } = {}) {
    super('GodRaysEffect', GOD_RAYS_FRAGMENT, {
      uniforms: new Map<string, Uniform<number | Vector2>>([
        ['intensity', new Uniform(intensity)],
        ['lightPos', new Uniform(new Vector2(0.5, 0.8))],
      ]) as Map<string, Uniform>,
    });
  }

  set intensity(value: number) {
    (this.uniforms.get('intensity') as Uniform).value = value;
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Color LUT Effect — Cinematic Color Grading Presets (UE5 Film Stock)
// Expanded with physically calibrated pyro presets for Studio Mode
// ═══════════════════════════════════════════════════════════════════════

export type ColorGradingPreset =
  | 'neutral' | 'day-for-night' | 'golden-hour' | 'cool-blue-night'
  | 'warm-sunset' | 'high-contrast'
  // Studio Mode presets (physically calibrated)
  | 'pyro-night' | 'stadium-flood' | 'moonlit';

const COLOR_LUT_FRAGMENT = `
uniform float preset;
uniform float mix_amount;

vec3 applyNeutral(vec3 c) { return c; }

vec3 applyDayForNight(vec3 c) {
  float lum = dot(c, vec3(0.299, 0.587, 0.114));
  vec3 blue = vec3(0.05, 0.08, 0.18);
  vec3 tinted = mix(blue, c * vec3(0.4, 0.55, 0.9), lum);
  return mix(c, tinted * 0.6, mix_amount);
}

vec3 applyGoldenHour(vec3 c) {
  vec3 warm = c * vec3(1.15, 1.0, 0.75);
  float lum = dot(c, vec3(0.299, 0.587, 0.114));
  warm += vec3(0.08, 0.04, 0.0) * (1.0 - lum);
  return mix(c, warm, mix_amount);
}

vec3 applyCoolBlueNight(vec3 c) {
  float lum = dot(c, vec3(0.299, 0.587, 0.114));
  vec3 cool = c * vec3(0.8, 0.9, 1.2);
  cool += vec3(0.0, 0.02, 0.06) * (1.0 - lum);
  return mix(c, cool, mix_amount);
}

vec3 applyWarmSunset(vec3 c) {
  vec3 warm = c * vec3(1.2, 0.95, 0.7);
  float lum = dot(c, vec3(0.299, 0.587, 0.114));
  warm = mix(warm, warm * vec3(1.1, 0.8, 0.6), 1.0 - lum);
  return mix(c, warm, mix_amount);
}

vec3 applyHighContrast(vec3 c) {
  float lum = dot(c, vec3(0.299, 0.587, 0.114));
  vec3 contrast = (c - 0.5) * 1.4 + 0.5;
  contrast = clamp(contrast, 0.0, 1.0);
  vec3 shadows = vec3(0.0, 0.03, 0.05);
  vec3 highlights = vec3(0.05, 0.02, 0.0);
  contrast += mix(shadows, highlights, lum);
  return mix(c, contrast, mix_amount);
}

// ── Studio Mode: Pyro Night ──
// Calibrated for fireworks against dark sky.
// Preserves emission colors while enriching shadow depth.
// Deep blacks, warm midtones, clean highlight rolloff.
vec3 applyPyroNight(vec3 c) {
  float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
  
  // Crush blacks slightly for deep sky
  vec3 result = c * mix(vec3(0.92, 0.90, 0.95), vec3(1.0), smoothstep(0.0, 0.15, lum));
  
  // Warm midtones (smoke and trails)
  result += vec3(0.015, 0.008, 0.0) * smoothstep(0.05, 0.3, lum) * (1.0 - smoothstep(0.3, 0.8, lum));
  
  // Subtle blue tint in deep shadows (ambient sky)
  result += vec3(0.0, 0.003, 0.01) * (1.0 - smoothstep(0.0, 0.1, lum));
  
  // Gentle highlight compression (prevent clinical white)
  float highlightCompress = smoothstep(0.7, 1.0, lum);
  result = mix(result, result * vec3(1.0, 0.97, 0.94), highlightCompress * 0.3);
  
  return mix(c, result, mix_amount);
}

// ── Studio Mode: Stadium Flood ──
// Calibrated for shows with ambient stadium lighting.
// Warmer overall, accounts for mixed light sources.
vec3 applyStadiumFlood(vec3 c) {
  float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
  
  // Warm base (sodium vapor + LED flood)
  vec3 result = c * vec3(1.06, 1.0, 0.88);
  
  // Orange shadow fill (reflected stadium light)
  result += vec3(0.03, 0.015, 0.0) * (1.0 - smoothstep(0.0, 0.25, lum));
  
  // Slight desaturation in highlights (sensor response to mixed lighting)
  float desat = smoothstep(0.6, 1.0, lum) * 0.15;
  result = mix(result, vec3(lum * 1.02), desat);
  
  return mix(c, result, mix_amount);
}

// ── Studio Mode: Moonlit ──
// Silver-blue palette for moonlit outdoor shows.
// Cool shadows, silver highlights, high dynamic range feel.
vec3 applyMoonlit(vec3 c) {
  float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
  
  // Cool silver shift
  vec3 result = c * vec3(0.88, 0.93, 1.1);
  
  // Deep blue shadows
  result += vec3(0.0, 0.01, 0.03) * (1.0 - smoothstep(0.0, 0.12, lum));
  
  // Silver highlights
  float silver = smoothstep(0.5, 0.9, lum);
  result = mix(result, vec3(lum * 1.05) * vec3(0.95, 0.97, 1.0), silver * 0.2);
  
  return mix(c, result, mix_amount);
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 c = inputColor.rgb;
  
  // preset: 0=neutral, 1=day-for-night, 2=golden-hour, 3=cool-blue,
  //         4=warm-sunset, 5=high-contrast, 6=pyro-night, 7=stadium-flood, 8=moonlit
  if (preset < 0.5) {
    c = applyNeutral(c);
  } else if (preset < 1.5) {
    c = applyDayForNight(c);
  } else if (preset < 2.5) {
    c = applyGoldenHour(c);
  } else if (preset < 3.5) {
    c = applyCoolBlueNight(c);
  } else if (preset < 4.5) {
    c = applyWarmSunset(c);
  } else if (preset < 5.5) {
    c = applyHighContrast(c);
  } else if (preset < 6.5) {
    c = applyPyroNight(c);
  } else if (preset < 7.5) {
    c = applyStadiumFlood(c);
  } else {
    c = applyMoonlit(c);
  }
  
  outputColor = vec4(c, inputColor.a);
}
`;

const PRESET_INDEX: Record<ColorGradingPreset, number> = {
  'neutral': 0,
  'day-for-night': 1,
  'golden-hour': 2,
  'cool-blue-night': 3,
  'warm-sunset': 4,
  'high-contrast': 5,
  'pyro-night': 6,
  'stadium-flood': 7,
  'moonlit': 8,
};

class ColorGradingEffect extends Effect {
  constructor({ preset = 'neutral', mixAmount = 1.0 }: { preset?: ColorGradingPreset; mixAmount?: number } = {}) {
    super('ColorGradingEffect', COLOR_LUT_FRAGMENT, {
      uniforms: new Map([
        ['preset', new Uniform(PRESET_INDEX[preset] ?? 0)],
        ['mix_amount', new Uniform(mixAmount)],
      ]),
    });
  }

  set preset(value: ColorGradingPreset) {
    (this.uniforms.get('preset') as Uniform).value = PRESET_INDEX[value] ?? 0;
  }

  set mixAmount(value: number) {
    (this.uniforms.get('mix_amount') as Uniform).value = value;
  }
}

// ═══════════════════════════════════════════════════════════════════════
// DownSample Blur Effect — BP_DownSampleSceneCapture (optimized glow)
// ═══════════════════════════════════════════════════════════════════════

const DOWNSAMPLE_BLUR_FRAGMENT = `
uniform float intensity;
uniform float radius;

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec2 texelSize = 1.0 / resolution * radius;
  
  vec4 sum = inputColor;
  sum += texture2D(inputBuffer, uv + vec2(-texelSize.x, -texelSize.y));
  sum += texture2D(inputBuffer, uv + vec2( texelSize.x, -texelSize.y));
  sum += texture2D(inputBuffer, uv + vec2(-texelSize.x,  texelSize.y));
  sum += texture2D(inputBuffer, uv + vec2( texelSize.x,  texelSize.y));
  
  vec2 texel2 = texelSize * 2.0;
  sum += texture2D(inputBuffer, uv + vec2(-texel2.x, 0.0)) * 0.5;
  sum += texture2D(inputBuffer, uv + vec2( texel2.x, 0.0)) * 0.5;
  sum += texture2D(inputBuffer, uv + vec2(0.0, -texel2.y)) * 0.5;
  sum += texture2D(inputBuffer, uv + vec2(0.0,  texel2.y)) * 0.5;
  
  vec4 blurred = sum / 7.0;
  outputColor = mix(inputColor, blurred, intensity);
}
`;

class DownSampleBlurEffect extends Effect {
  constructor({ intensity = 0.15, radius = 2.0 }: { intensity?: number; radius?: number } = {}) {
    super('DownSampleBlurEffect', DOWNSAMPLE_BLUR_FRAGMENT, {
      uniforms: new Map([
        ['intensity', new Uniform(intensity)],
        ['radius', new Uniform(radius)],
      ]),
    });
  }
  set intensity(value: number) { (this.uniforms.get('intensity') as Uniform).value = value; }
  set radius(value: number) { (this.uniforms.get('radius') as Uniform).value = value; }
}

// ═══ Wrapper Components ═══

const Sharpen = forwardRef<SharpenEffect, { strength?: number }>(function Sharpen({ strength = 0.1 }, ref) {
  const effect = useMemo(() => new SharpenEffect({ strength }), []);
  useMemo(() => { effect.strength = strength; }, [effect, strength]);
  return <primitive ref={ref} object={effect} />;
});

const HeatDistortion = forwardRef<HeatDistortionEffect, { intensity?: number }>(function HeatDistortion({ intensity = 0.5 }, ref) {
  const effect = useMemo(() => new HeatDistortionEffect({ intensity }), []);
  useMemo(() => { effect.intensity = intensity; }, [effect, intensity]);
  return <primitive ref={ref} object={effect} />;
});

const MotionBlur = forwardRef<MotionBlurEffect, { intensity?: number }>(function MotionBlur({ intensity = 0.5 }, ref) {
  const effect = useMemo(() => new MotionBlurEffect({ intensity }), []);
  useMemo(() => { effect.intensity = intensity; }, [effect, intensity]);
  return <primitive ref={ref} object={effect} />;
});

const GodRays = forwardRef<GodRaysEffect, { intensity?: number }>(function GodRays({ intensity = 0.5 }, ref) {
  const effect = useMemo(() => new GodRaysEffect({ intensity }), []);
  useMemo(() => { effect.intensity = intensity; }, [effect, intensity]);
  return <primitive ref={ref} object={effect} />;
});

const ColorGrading = forwardRef<ColorGradingEffect, { preset?: ColorGradingPreset }>(function ColorGrading({ preset = 'neutral' }, ref) {
  const effect = useMemo(() => new ColorGradingEffect({ preset }), []);
  useMemo(() => { effect.preset = preset; }, [effect, preset]);
  return <primitive ref={ref} object={effect} />;
});

const DownSampleBlur = forwardRef<DownSampleBlurEffect, { intensity?: number }>(function DownSampleBlur({ intensity = 0.15 }, ref) {
  const effect = useMemo(() => new DownSampleBlurEffect({ intensity }), []);
  useMemo(() => { effect.intensity = intensity; }, [effect, intensity]);
  return <primitive ref={ref} object={effect} />;
});

// ═══════════════════════════════════════════════════════════════════════
// Wrapper components for Studio Mode effects
// ═══════════════════════════════════════════════════════════════════════

const Halation = forwardRef<HalationEffect, { intensity?: number; threshold?: number; radius?: number }>(
  function Halation({ intensity = 0.15, threshold = 5.0, radius = 6.0 }, ref) {
    const effect = useMemo(() => new HalationEffect({ intensity, threshold, radius }), []);
    useMemo(() => { effect.intensity = intensity; effect.threshold = threshold; effect.radius = radius; }, [effect, intensity, threshold, radius]);
    return <primitive ref={ref} object={effect} />;
  }
);

const HighlightDesaturation = forwardRef<HighlightDesaturationEffect, { intensity?: number; threshold?: number; compression?: number }>(
  function HighlightDesaturation({ intensity = 0.8, threshold = 2.0, compression = 1.5 }, ref) {
    const effect = useMemo(() => new HighlightDesaturationEffect({ intensity, threshold, compression }), []);
    useMemo(() => { effect.intensity = intensity; effect.threshold = threshold; effect.compression = compression; }, [effect, intensity, threshold, compression]);
    return <primitive ref={ref} object={effect} />;
  }
);

// ═══════════════════════════════════════════════════════════════════════
// Cinematic post-processing pipeline v12 — Studio Mode: Physical Optics
// ═══════════════════════════════════════════════════════════════════════

/**
 * Physical Bloom: intensity scales logarithmically with burst energy.
 * Threshold rises during heavy bursts to prevent constant glow.
 */
function usePhysicalBloom(baseStrength: number, bloomMul: number, activeBurstCount: number) {
  // Energy estimate: each burst contributes ~1 unit, salutes ~3x
  const burstEnergy = Math.max(0, activeBurstCount);

  // Logarithmic intensity: bloom = base * log2(1 + energy)
  // Prevents linear blowout while preserving peak response
  const physicalIntensity = baseStrength * 0.04 * bloomMul * Math.log2(1 + burstEnergy * 0.5 + 0.5);

  // Dynamic threshold: raises during heavy bursts, catches only real flashes
  const dynamicThreshold = 3.0 + Math.min(burstEnergy * 0.3, 2.5);

  // Wide halo intensity: proportional to energy but decays faster
  const haloIntensity = baseStrength * 0.02 * bloomMul * Math.log2(1 + burstEnergy * 0.3);
  const haloThreshold = 4.5 + Math.min(burstEnergy * 0.4, 3.0);

  return { physicalIntensity, dynamicThreshold, haloIntensity, haloThreshold };
}

export default function PostProcessing({ activeBurstCount = 0 }: { activeBurstCount?: number }) {
  const s = useSceneStore(st => st.settings);
  const str = s.bloomStrength;
  const vt = s.viewTransform || 'aces-filmic';
  const bloomMul = BLOOM_SCALE[vt];

  const hasBursts = activeBurstCount > 0;
  const hasHeavyBursts = activeBurstCount > 3;

  // ── Feature flags: Studio Mode optics ──
  const physicalBloomEnabled = isEnabled('hdr_bloom_physical');
  const cameraResponseEnabled = isEnabled('cinematic_camera_response');

  // Physical bloom calculations (only used when flag is on)
  const pb = usePhysicalBloom(str, bloomMul, activeBurstCount);

  // Adaptive: use half-res SSR when enabled for GPU savings
  const ssrResScale = s.ssrHalfRes ? 0.5 : 1.0;

  return (
    <EffectComposer multisampling={0} enableNormalPass={s.ssaoEnabled} resolutionScale={s.ssrHalfRes && s.ssrEnabled ? 1.0 : 1.0}>
      <SMAA />

      {/* ═══ SSR — DISABLED by default for night scenes (heavy GPU cost) ═══ */}
      {s.ssrEnabled && !hasBursts && (
        <SSR
          temporalResolve
          temporalResolveMix={0.9}
          temporalResolveCorrectionMix={0.4}
          maxSamples={0}
          ENABLE_BLUR
          blurMix={s.ssrHalfRes ? 0.7 : 0.5}
          blurSharpness={s.ssrHalfRes ? 6 : 10}
          blurKernelSize={s.ssrHalfRes ? 2 : 1}
          rayStep={s.ssrHalfRes ? 0.2 : 0.1}
          intensity={s.ssrIntensity}
          maxRoughness={0.1}
          ENABLE_JITTERING
          jitter={0.75}
          jitterSpread={0.45}
          jitterRough={0.1}
          MAX_STEPS={s.ssrHalfRes ? 10 : 16}
          NUM_BINARY_SEARCH_STEPS={s.ssrHalfRes ? 3 : 4}
          maxDepthDifference={10}
          maxDepth={1}
          thickness={s.ssrThickness}
          ior={1.45}
          STRETCH_MISSED_RAYS
          USE_MRT
          USE_ROUGHNESSMAP
          USE_NORMALMAP
        />
      )}

      {/* ═══ SSAO — samples reduced from 16 to 8 for GPU savings ═══ */}
      {s.ssaoEnabled && (
        <SSAO
          intensity={s.ssaoIntensity * 30}
          radius={0.15}
          luminanceInfluence={0.6}
          bias={0.025}
          samples={8}
          rings={3}
          worldDistanceThreshold={1.0}
          worldDistanceFalloff={0.5}
          worldProximityThreshold={0.5}
          worldProximityFalloff={0.3}
        />
      )}

      {/* ═══ Depth of Field — Bokeh ═══ */}
      {s.dofEnabled && (
        <DepthOfField
          focusDistance={0}
          focalLength={s.dofFocusDistance * 0.001}
          bokehScale={s.dofBokehScale}
        />
      )}

      {/* ═══ Motion Blur — DISABLED during bursts (fake screen-space, GPU expensive) ═══ */}
      {s.motionBlurEnabled && !hasBursts && (
        <MotionBlur intensity={s.motionBlurIntensity} />
      )}

      {/* ═══════════════════════════════════════════════════════════════
           BLOOM PIPELINE — Physical (Studio Mode) or Legacy
           Pipeline order per spec: Bloom Físico → Halation → Highlight Desat → Tone Map
           ═══════════════════════════════════════════════════════════════ */}

      {physicalBloomEnabled ? (
        <>
          {/* Physical Bloom Layer 1: Core emission catch
              Logarithmic intensity + dynamic threshold scales with burst energy */}
          <Bloom
            intensity={pb.physicalIntensity}
            luminanceThreshold={pb.dynamicThreshold}
            luminanceSmoothing={0.05}
            kernelSize={KernelSize.MEDIUM}
            mipmapBlur
          />

          {/* Physical Bloom Layer 2: Wide energy halo
              Only fires during active bursts — kernel scales with energy */}
          {hasBursts && (
            <Bloom
              intensity={pb.haloIntensity}
              luminanceThreshold={pb.haloThreshold}
              luminanceSmoothing={0.15}
              kernelSize={hasHeavyBursts ? KernelSize.HUGE : KernelSize.LARGE}
              mipmapBlur
            />
          )}

          {/* Halation: reddish film-like halos on extreme highlights */}
          {hasBursts && (
            <Halation
              intensity={0.12 + activeBurstCount * 0.02}
              threshold={5.5}
              radius={8.0}
            />
          )}
        </>
      ) : (
        <>
          {/* Legacy Layer 1: Core catch — threshold raised to 3.5 for real flashes only */}
          <Bloom
            intensity={str * 0.04 * bloomMul}
            luminanceThreshold={3.5}
            luminanceSmoothing={0.05}
            kernelSize={KernelSize.MEDIUM}
            mipmapBlur
          />

          {/* Legacy Layer 2: Star halos — threshold raised to 5.0, intense explosions only */}
          {hasBursts && (
            <Bloom
              intensity={str * 0.025 * bloomMul}
              luminanceThreshold={5.0}
              luminanceSmoothing={0.2}
              kernelSize={KernelSize.LARGE}
              mipmapBlur
            />
          )}
        </>
      )}

      {/* Layer 3: Atmospheric / God Rays — real radial blur when enabled */}
      {s.godRaysEnabled && hasBursts ? (
        <GodRays intensity={0.5 + activeBurstCount * 0.08} />
      ) : (hasHeavyBursts && (
        <Bloom
          intensity={str * 0.008 * bloomMul}
          luminanceThreshold={6.0}
          luminanceSmoothing={0.5}
          kernelSize={KernelSize.HUGE}
          mipmapBlur
        />
      ))}

      {/* ═══ Highlight Desaturation — Studio Mode camera response ═══ */}
      {cameraResponseEnabled && (
        <HighlightDesaturation
          intensity={0.75}
          threshold={2.0}
          compression={1.5}
        />
      )}

      {/* ═══ Heat Distortion — UE5 Niagara Heat Haze ═══ */}
      {s.heatDistortionEnabled && hasBursts && (
        <HeatDistortion intensity={0.3 + activeBurstCount * 0.1} />
      )}

      {/* Cinematic vignette */}
      {s.vignetteEnabled && (
        <Vignette
          offset={0.2}
          darkness={s.vignetteIntensity * 2.8}
          blendFunction={BlendFunction.NORMAL}
        />
      )}

      {/* Chromatic aberration — skip when no bursts for GPU savings */}
      {s.chromaticAberration && hasBursts && (
        <ChromaticAberration
          offset={new Vector2(0.0008, 0.0008)}
          radialModulation
          modulationOffset={0.25}
        />
      )}

      {/* Film grain — always active for cinematic texture */}
      {s.filmGrain > 0.01 && (
        <Noise
          blendFunction={BlendFunction.SOFT_LIGHT}
          opacity={s.filmGrain * 0.4}
        />
      )}

      {/* ═══ Sharpening — UE5 r.Tonemapper.Sharpen ═══ */}
      {s.sharpenEnabled && s.sharpenStrength > 0.01 && (
        <Sharpen strength={s.sharpenStrength} />
      )}

      {/* ═══ Color Grading — Brightness / Contrast / Saturation ═══ */}
      {(s.colorBrightness !== 0 || s.colorContrast !== 0) && (
        <BrightnessContrast
          brightness={s.colorBrightness}
          contrast={s.colorContrast}
        />
      )}

      {s.colorSaturation !== 0 && (
        <HueSaturation
          saturation={s.colorSaturation}
        />
      )}

      {/* ═══ Color LUT — Cinematic Grading Presets ═══ */}
      {s.colorGradingPreset && s.colorGradingPreset !== 'neutral' && (
        <ColorGrading preset={s.colorGradingPreset as ColorGradingPreset} />
      )}

      {/* Dynamic tone mapping */}
      <ToneMapping mode={TONE_MAP[vt]} />
    </EffectComposer>
  );
}
