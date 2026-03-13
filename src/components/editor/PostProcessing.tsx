import { EffectComposer, Bloom, ToneMapping, Vignette, ChromaticAberration, SMAA, Noise } from '@react-three/postprocessing';
import { KernelSize, ToneMappingMode, BlendFunction } from 'postprocessing';
import { Vector2 } from 'three';
import { useSceneStore } from '@/store/useSceneStore';

/**
 * Scene-driven cinematic post-processing pipeline.
 * All values driven by useSceneStore settings.
 */
export default function PostProcessing() {
  const s = useSceneStore(st => st.settings);

  return (
    <EffectComposer multisampling={0}>
      <SMAA />
      {/* Primary bloom — catches HDR emissive LEDs and pyro */}
      <Bloom
        intensity={s.bloomStrength * 1.0}
        luminanceThreshold={0.2}
        luminanceSmoothing={0.5}
        kernelSize={KernelSize.LARGE}
        mipmapBlur
      />
      {/* Secondary wide bloom — atmospheric haze glow */}
      <Bloom
        intensity={s.bloomStrength * 0.2}
        luminanceThreshold={0.6}
        luminanceSmoothing={0.9}
        kernelSize={KernelSize.HUGE}
        mipmapBlur
      />
      {/* Cinematic vignette */}
      {s.vignetteEnabled && (
        <Vignette
          offset={0.35}
          darkness={s.vignetteIntensity * 1.8}
          blendFunction={BlendFunction.NORMAL}
        />
      )}
      {/* Chromatic aberration — lens realism */}
      {s.chromaticAberration && (
        <ChromaticAberration
          offset={new Vector2(0.0006, 0.0006)}
          radialModulation
          modulationOffset={0.4}
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
