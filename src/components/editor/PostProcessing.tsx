import { EffectComposer, Bloom, Vignette, ChromaticAberration, SMAA, Noise } from '@react-three/postprocessing';
import { KernelSize, BlendFunction } from 'postprocessing';
import { Vector2 } from 'three';
import { useSceneStore } from '@/store/useSceneStore';

/**
 * Cinematic post-processing pipeline v4 — Blender Glare Node inspired.
 * 
 * Key changes from v3:
 * - High luminance thresholds (0.75+) so bloom ONLY catches HDR pyro
 * - Drone LEDs (emissiveIntensity 2.5, toneMapped) stay crisp without bloom wash
 * - 3-layer architecture: core catch, star halos, atmospheric
 * - Blender Glare reference: threshold 0.8-1.0, quality medium-high
 */
export default function PostProcessing() {
  const s = useSceneStore(st => st.settings);
  const str = s.bloomStrength;

  return (
    <EffectComposer multisampling={0}>
      <SMAA />

      {/* Layer 1: Core catch — only extreme HDR pyro (threshold 1.5) */}
      <Bloom
        intensity={str * 0.096}
        luminanceThreshold={2.5}
        luminanceSmoothing={0.05}
        kernelSize={KernelSize.MEDIUM}
        mipmapBlur
      />

      {/* Layer 2: Star halos — only pyro flashes */}
      <Bloom
        intensity={str * 0.048}
        luminanceThreshold={2.5}
        luminanceSmoothing={0.2}
        kernelSize={KernelSize.LARGE}
        mipmapBlur
      />

      {/* Layer 3: Atmospheric — ultra-bright only */}
      <Bloom
        intensity={str * 0.016}
        luminanceThreshold={6.0}
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

      {/* ACES Filmic now handled at renderer level — no duplicate tone mapping */}
    </EffectComposer>
  );
}
