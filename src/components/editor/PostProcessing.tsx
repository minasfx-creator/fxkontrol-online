import { EffectComposer, Bloom, ToneMapping } from '@react-three/postprocessing';
import { KernelSize, ToneMappingMode } from 'postprocessing';

/**
 * Finale 3D style — clean, functional post-processing.
 * Just subtle bloom for pyro/LED glow + neutral tone mapping.
 */
export default function PostProcessing() {
  return (
    <EffectComposer multisampling={4}>
      <Bloom
        intensity={1.0}
        luminanceThreshold={0.3}
        luminanceSmoothing={0.4}
        kernelSize={KernelSize.MEDIUM}
        mipmapBlur
      />
      <ToneMapping mode={ToneMappingMode.AGX} />
    </EffectComposer>
  );
}
