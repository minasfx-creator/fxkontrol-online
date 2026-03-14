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

      {/* Layer 1: Ultra-tight core — catches individual star HDR points */}
      <Bloom
        intensity={str * 2.2}
        luminanceThreshold={0.05}
        luminanceSmoothing={0.15}
        kernelSize={KernelSize.MEDIUM}
        mipmapBlur
      />

      {/* Layer 2: Primary glow — star halos and burst flash */}
      <Bloom
        intensity={str * 1.1}
        luminanceThreshold={0.15}
        luminanceSmoothing={0.4}
        kernelSize={KernelSize.LARGE}
        mipmapBlur
      />

      {/* Layer 3: Medium scatter — cluster glow, sky coloring */}
      <Bloom
        intensity={str * 0.5}
        luminanceThreshold={0.3}
        luminanceSmoothing={0.65}
        kernelSize={KernelSize.HUGE}
        mipmapBlur
      />

      {/* Layer 4: Wide atmospheric — fills sky around large bursts */}
      <Bloom
        intensity={str * 0.2}
        luminanceThreshold={0.5}
        luminanceSmoothing={0.85}
        kernelSize={KernelSize.HUGE}
        mipmapBlur
      />

      {/* Layer 5: Ultra-wide ambient — subtle light pollution / sky wash */}
      <Bloom
        intensity={str * 0.08}
        luminanceThreshold={0.7}
        luminanceSmoothing={0.95}
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
