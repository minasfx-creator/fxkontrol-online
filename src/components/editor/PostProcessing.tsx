import { EffectComposer, Bloom, ToneMapping, Vignette, ChromaticAberration, SMAA, Noise } from '@react-three/postprocessing';
import { KernelSize, ToneMappingMode, BlendFunction } from 'postprocessing';
import { Vector2 } from 'three';
import { useSceneStore } from '@/store/useSceneStore';

/**
 * Cinematic post-processing pipeline v3 — FWsim/Finale-grade rendering.
 * 
 * Key changes from v2:
 * - Much lower luminance thresholds to catch more star light
 * - Higher bloom intensities with wider kernels
 * - AGX tone mapping replaced with ACES for punchier HDR
 * - 5-layer bloom architecture for ultra-realistic light scatter
 * - Stronger vignette for cinematic framing
 */
export default function PostProcessing() {
  const s = useSceneStore(st => st.settings);
  const str = s.bloomStrength;

  return (
    <EffectComposer multisampling={0}>
      <SMAA />

      {/* Layer 1: Ultra-tight core — catches individual star HDR points + laser cores */}
      <Bloom
        intensity={str * 2.8}
        luminanceThreshold={0.03}
        luminanceSmoothing={0.1}
        kernelSize={KernelSize.MEDIUM}
        mipmapBlur
      />

      {/* Layer 2: Primary glow — star halos, burst flash, laser beam glow */}
      <Bloom
        intensity={str * 1.4}
        luminanceThreshold={0.1}
        luminanceSmoothing={0.35}
        kernelSize={KernelSize.LARGE}
        mipmapBlur
      />

      {/* Layer 3: Medium scatter — cluster glow, sky coloring, laser scatter */}
      <Bloom
        intensity={str * 0.65}
        luminanceThreshold={0.25}
        luminanceSmoothing={0.6}
        kernelSize={KernelSize.HUGE}
        mipmapBlur
      />

      {/* Layer 4: Wide atmospheric — fills sky around large bursts */}
      <Bloom
        intensity={str * 0.25}
        luminanceThreshold={0.45}
        luminanceSmoothing={0.8}
        kernelSize={KernelSize.HUGE}
        mipmapBlur
      />

      {/* Layer 5: Ultra-wide ambient — sky wash, volumetric laser atmosphere */}
      <Bloom
        intensity={str * 0.1}
        luminanceThreshold={0.65}
        luminanceSmoothing={0.92}
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

      {/* ACES Filmic — punchier HDR with rich highlight rolloff */}
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  );
}
