import { EffectComposer, Bloom, ToneMapping, Vignette, ChromaticAberration, SMAA } from '@react-three/postprocessing';
import { KernelSize, ToneMappingMode, BlendFunction } from 'postprocessing';
import { Vector2 } from 'three';

/**
 * UE5-inspired cinematic post-processing pipeline.
 * Layered bloom (LED glow + atmospheric), vignette, subtle chromatic aberration,
 * AGX tone mapping for color fidelity.
 */
export default function PostProcessing() {
  return (
    <EffectComposer multisampling={0}>
      <SMAA />
      {/* Primary bloom — catches HDR emissive LEDs and pyro */}
      <Bloom
        intensity={1.4}
        luminanceThreshold={0.2}
        luminanceSmoothing={0.5}
        kernelSize={KernelSize.LARGE}
        mipmapBlur
      />
      {/* Secondary wide bloom — atmospheric haze glow */}
      <Bloom
        intensity={0.3}
        luminanceThreshold={0.6}
        luminanceSmoothing={0.9}
        kernelSize={KernelSize.HUGE}
        mipmapBlur
      />
      {/* Cinematic vignette */}
      <Vignette
        offset={0.35}
        darkness={0.55}
        blendFunction={BlendFunction.NORMAL}
      />
      {/* Subtle chromatic aberration — lens realism */}
      <ChromaticAberration
        offset={new Vector2(0.0004, 0.0004)}
        radialModulation
        modulationOffset={0.4}
      />
      <ToneMapping mode={ToneMappingMode.AGX} />
    </EffectComposer>
  );
}
