import { EffectComposer, Bloom, ToneMapping, Vignette, ChromaticAberration, SMAA, Noise } from '@react-three/postprocessing';
import { KernelSize, ToneMappingMode, BlendFunction } from 'postprocessing';
import { Vector2 } from 'three';
import { useSceneStore } from '@/store/useSceneStore';

/**
 * Cinematic post-processing pipeline optimized for pyrotechnic rendering.
 * 4-layer bloom architecture:
 *   1. Primary — catches HDR star points and emissive surfaces
 *   2. Medium — glow halos around bright clusters  
 *   3. Wide atmospheric — soft sky-filling scatter from large bursts
 *   4. Ultra-wide — subtle ambient light pollution effect
 */
export default function PostProcessing() {
  const s = useSceneStore(st => st.settings);

  return (
    <EffectComposer multisampling={0}>
      <SMAA />
      {/* Layer 1: Primary bloom — tight, bright star points */}
      <Bloom
        intensity={s.bloomStrength * 1.4}
        luminanceThreshold={0.12}
        luminanceSmoothing={0.3}
        kernelSize={KernelSize.LARGE}
        mipmapBlur
      />
      {/* Layer 2: Medium glow — halos around star clusters */}
      <Bloom
        intensity={s.bloomStrength * 0.4}
        luminanceThreshold={0.4}
        luminanceSmoothing={0.7}
        kernelSize={KernelSize.HUGE}
        mipmapBlur
      />
      {/* Layer 3: Atmospheric scatter — wide soft glow from bursts */}
      <Bloom
        intensity={s.bloomStrength * 0.12}
        luminanceThreshold={0.7}
        luminanceSmoothing={0.9}
        kernelSize={KernelSize.HUGE}
        mipmapBlur
      />
      {/* Layer 4: Ultra-wide ambient — subtle sky illumination */}
      <Bloom
        intensity={s.bloomStrength * 0.04}
        luminanceThreshold={0.9}
        luminanceSmoothing={0.98}
        kernelSize={KernelSize.HUGE}
        mipmapBlur
      />
      {/* Cinematic vignette */}
      {s.vignetteEnabled && (
        <Vignette
          offset={0.25}
          darkness={s.vignetteIntensity * 2.2}
          blendFunction={BlendFunction.NORMAL}
        />
      )}
      {/* Chromatic aberration — lens realism */}
      {s.chromaticAberration && (
        <ChromaticAberration
          offset={new Vector2(0.0006, 0.0006)}
          radialModulation
          modulationOffset={0.3}
        />
      )}
      {/* Film grain */}
      {s.filmGrain > 0.01 && (
        <Noise
          blendFunction={BlendFunction.SOFT_LIGHT}
          opacity={s.filmGrain * 0.5}
        />
      )}
      <ToneMapping mode={ToneMappingMode.AGX} />
    </EffectComposer>
  );
}
