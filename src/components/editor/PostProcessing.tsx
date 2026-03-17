import { useEffect } from 'react';
import { EffectComposer, Bloom, Vignette, ChromaticAberration, SMAA, Noise, ToneMapping } from '@react-three/postprocessing';
import { KernelSize, BlendFunction, ToneMappingMode } from 'postprocessing';
import { Vector2 } from 'three';
import { useThree } from '@react-three/fiber';
import { useSceneStore } from '@/store/useSceneStore';
import type { ViewTransform } from '@/lib/niagaraBlenderRules';

const TONE_MAP: Record<ViewTransform, ToneMappingMode> = {
  'aces-filmic': ToneMappingMode.ACES_FILMIC,
  'agx': ToneMappingMode.AGX,
  'standard': ToneMappingMode.LINEAR,
};

// AgX is softer highlights → reduce bloom; Standard is linear → no compression
const BLOOM_SCALE: Record<ViewTransform, number> = {
  'aces-filmic': 1.0,
  'agx': 0.7,
  'standard': 1.3,
};

/**
 * Cinematic post-processing pipeline v5 — V-Ray/Blender View Transform aware.
 * 
 * Key changes from v4:
 * - Dynamic ToneMapping mode from store (ACES Filmic / AgX / Standard)
 * - Bloom intensity adapts per view transform
 * - High luminance thresholds (2.5+) so bloom ONLY catches HDR pyro
 */
export default function PostProcessing() {
  const s = useSceneStore(st => st.settings);
  const str = s.bloomStrength;
  const vt = s.viewTransform || 'aces-filmic';
  const bloomMul = BLOOM_SCALE[vt];
  const gl = useThree(state => state.gl);
  
  // Apply exposure compensation via renderer toneMappingExposure
  useEffect(() => {
    gl.toneMappingExposure = Math.pow(2, s.exposureCompensation || 0);
  }, [gl, s.exposureCompensation]);

  return (
    <EffectComposer multisampling={0}>
      <SMAA />

      {/* Layer 1: Core catch — only extreme HDR pyro (threshold 3.5) */}
      <Bloom
        intensity={str * 0.048 * bloomMul}
        luminanceThreshold={3.5}
        luminanceSmoothing={0.05}
        kernelSize={KernelSize.MEDIUM}
        mipmapBlur
      />

      {/* Layer 2: Star halos — only pyro flashes */}
      <Bloom
        intensity={str * 0.024 * bloomMul}
        luminanceThreshold={4.0}
        luminanceSmoothing={0.2}
        kernelSize={KernelSize.LARGE}
        mipmapBlur
      />

      {/* Layer 3: Atmospheric — ultra-bright only */}
      <Bloom
        intensity={str * 0.008 * bloomMul}
        luminanceThreshold={8.0}
        luminanceSmoothing={0.4}
        kernelSize={KernelSize.HUGE}
        mipmapBlur
      />

      {/* Cinematic vignette — tighter for drama */}
      {s.vignetteEnabled && (
        <Vignette
          offset={0.2}
          darkness={s.vignetteIntensity * 2.8}
          blendFunction={BlendFunction.NORMAL}
        />
      )}

      {/* Chromatic aberration — lens realism */}
      {s.chromaticAberration && (
        <ChromaticAberration
          offset={new Vector2(0.0008, 0.0008)}
          radialModulation
          modulationOffset={0.25}
        />
      )}

      {/* Film grain */}
      {s.filmGrain > 0.01 && (
        <Noise
          blendFunction={BlendFunction.SOFT_LIGHT}
          opacity={s.filmGrain * 0.6}
        />
      )}

      {/* Dynamic tone mapping with exposure compensation */}
      <ToneMapping mode={TONE_MAP[vt]} exposure={exposureMul} />
    </EffectComposer>
  );
}
