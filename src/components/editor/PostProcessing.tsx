import { EffectComposer, Bloom, Vignette, ChromaticAberration, SMAA, Noise, ToneMapping, SSAO, DepthOfField, BrightnessContrast, HueSaturation } from '@react-three/postprocessing';
import { KernelSize, BlendFunction, ToneMappingMode } from 'postprocessing';
import { Vector2 } from 'three';
import { useSceneStore } from '@/store/useSceneStore';
import type { ViewTransform } from '@/lib/niagaraBlenderRules';

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
 * Cinematic post-processing pipeline v8 — AAA effects suite.
 * 
 * Includes: SSAO, Depth of Field, Color Grading, God Rays (via bright bloom),
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

      {/* ═══ SSAO — Screen Space Ambient Occlusion ═══ */}
      {s.ssaoEnabled && (
        <SSAO
          intensity={s.ssaoIntensity * 30}
          radius={0.15}
          luminanceInfluence={0.6}
          bias={0.025}
          samples={16}
          rings={3}
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
