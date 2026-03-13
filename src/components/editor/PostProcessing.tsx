import { EffectComposer, Bloom, ToneMapping, Vignette, ChromaticAberration, SMAA, Noise } from '@react-three/postprocessing';
import { KernelSize, ToneMappingMode, BlendFunction } from 'postprocessing';
import { Vector2 } from 'three';
import { useSceneStore } from '@/store/useSceneStore';

/**
 * Scene-driven cinematic post-processing pipeline.
 * Triple-bloom architecture for pyrotechnic realism.
 */
export default function PostProcessing() {
  const s = useSceneStore(st => st.settings);

  return (
    <EffectComposer multisampling={0}>
      <SMAA />
      {/* Primary bloom — catches HDR emissive LEDs, pyro flashes */}
      <Bloom
        intensity={s.bloomStrength * 1.2}
        luminanceThreshold={0.15}
        luminanceSmoothing={0.4}
        kernelSize={KernelSize.LARGE}
        mipmapBlur
      />
      {/* Secondary bloom — medium glow halos around bright sources */}
      <Bloom
        intensity={s.bloomStrength * 0.35}
        luminanceThreshold={0.5}
        luminanceSmoothing={0.8}
        kernelSize={KernelSize.HUGE}
        mipmapBlur
      />
      {/* Tertiary bloom — ultra-wide atmospheric scatter from firework bursts */}
      <Bloom
        intensity={s.bloomStrength * 0.08}
        luminanceThreshold={0.8}
        luminanceSmoothing={0.95}
        kernelSize={KernelSize.HUGE}
        mipmapBlur
      />
      {/* Cinematic vignette — enhanced */}
      {s.vignetteEnabled && (
        <Vignette
          offset={0.3}
          darkness={s.vignetteIntensity * 2.0}
          blendFunction={BlendFunction.NORMAL}
        />
      )}
      {/* Chromatic aberration — lens realism */}
      {s.chromaticAberration && (
        <ChromaticAberration
          offset={new Vector2(0.0008, 0.0008)}
          radialModulation
          modulationOffset={0.35}
        />
      )}
      {/* Film grain — cinematic texture */}
      {s.filmGrain > 0.01 && (
        <Noise
          blendFunction={BlendFunction.SOFT_LIGHT}
          opacity={s.filmGrain * 0.6}
        />
      )}
      <ToneMapping mode={ToneMappingMode.AGX} />
    </EffectComposer>
  );
}
