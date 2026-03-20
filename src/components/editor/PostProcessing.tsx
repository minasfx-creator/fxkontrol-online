import { EffectComposer, Bloom, Vignette, ChromaticAberration, SMAA, Noise, ToneMapping, SSAO, DepthOfField, BrightnessContrast, HueSaturation, SSR } from '@react-three/postprocessing';
import { KernelSize, BlendFunction, ToneMappingMode, Effect } from 'postprocessing';
import { Vector2, Uniform } from 'three';
import { useSceneStore } from '@/store/useSceneStore';
import type { ViewTransform } from '@/lib/niagaraBlenderRules';
import { forwardRef, useMemo } from 'react';

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

/**
 * Custom Sharpening Effect — Unsharp Mask (UE5 r.Tonemapper.Sharpen equivalent)
 */
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

/**
 * Wrapper component for SharpenEffect
 */
const Sharpen = forwardRef<SharpenEffect, { strength?: number }>(function Sharpen({ strength = 0.1 }, ref) {
  const effect = useMemo(() => new SharpenEffect({ strength }), []);
  
  // Update strength dynamically
  useMemo(() => {
    effect.strength = strength;
  }, [effect, strength]);

  return <primitive ref={ref} object={effect} />;
});

/**
 * Cinematic post-processing pipeline v9 — AAA effects suite + UE5 DMXPrevis tech.
 * 
 * Includes: SSR, SSAO, Depth of Field, Sharpening, Color Grading, God Rays (via bright bloom),
 * plus existing Bloom, Vignette, ChromaticAberration, FilmGrain, ToneMapping.
 */
export default function PostProcessing({ activeBurstCount = 0 }: { activeBurstCount?: number }) {
  const s = useSceneStore(st => st.settings);
  const str = s.bloomStrength;
  const vt = s.viewTransform || 'aces-filmic';
  const bloomMul = BLOOM_SCALE[vt];

  const hasBursts = activeBurstCount > 0;
  const hasHeavyBursts = activeBurstCount > 3;

  return (
    <EffectComposer multisampling={0}>
      <SMAA />

      {/* ═══ Screen Space Reflections (UE5 r.SSR.Temporal) ═══ */}
      {s.ssrEnabled && (
        <SSR
          temporalResolve
          temporalResolveMix={0.9}
          temporalResolveCorrectionMix={0.4}
          maxSamples={0}
          ENABLE_BLUR
          blurMix={0.5}
          blurSharpness={10}
          blurKernelSize={1}
          rayStep={0.1}
          intensity={s.ssrIntensity}
          maxRoughness={0.1}
          ENABLE_JITTERING
          jitter={0.75}
          jitterSpread={0.45}
          jitterRough={0.1}
          MAX_STEPS={16}
          NUM_BINARY_SEARCH_STEPS={4}
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

      {/* ═══ SSAO — Screen Space Ambient Occlusion ═══ */}
      {s.ssaoEnabled && (
        <SSAO
          intensity={s.ssaoIntensity * 30}
          radius={0.15}
          luminanceInfluence={0.6}
          bias={0.025}
          samples={16}
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

      {/* Layer 1: Core catch — always active (low cost) */}
      <Bloom
        intensity={str * 0.048 * bloomMul}
        luminanceThreshold={3.5}
        luminanceSmoothing={0.05}
        kernelSize={KernelSize.MEDIUM}
        mipmapBlur
      />

      {/* Layer 2: Star halos — only during pyro activity */}
      {hasBursts && (
        <Bloom
          intensity={str * 0.024 * bloomMul}
          luminanceThreshold={4.0}
          luminanceSmoothing={0.2}
          kernelSize={KernelSize.LARGE}
          mipmapBlur
        />
      )}

      {/* Layer 3: Atmospheric / God Rays — heavy bursts or godRays enabled */}
      {(hasHeavyBursts || (s.godRaysEnabled && hasBursts)) && (
        <Bloom
          intensity={str * (s.godRaysEnabled ? 0.014 : 0.008) * bloomMul}
          luminanceThreshold={6.0}
          luminanceSmoothing={0.5}
          kernelSize={KernelSize.HUGE}
          mipmapBlur
        />
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

      {/* Film grain — skip when no activity */}
      {s.filmGrain > 0.01 && hasBursts && (
        <Noise
          blendFunction={BlendFunction.SOFT_LIGHT}
          opacity={s.filmGrain * 0.6}
        />
      )}

      {/* ═══ Sharpening — UE5 r.Tonemapper.Sharpen equivalent ═══ */}
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

      {/* Dynamic tone mapping */}
      <ToneMapping mode={TONE_MAP[vt]} />
    </EffectComposer>
  );
}
