import { EffectComposer, Bloom, Vignette, ChromaticAberration, ToneMapping } from '@react-three/postprocessing';
import { KernelSize, BlendFunction, ToneMappingMode } from 'postprocessing';
import * as THREE from 'three';

export default function PostProcessing() {
  return (
    <EffectComposer multisampling={4}>
      <Bloom
        intensity={1.8}
        luminanceThreshold={0.15}
        luminanceSmoothing={0.7}
        kernelSize={KernelSize.HUGE}
        mipmapBlur
      />
      <Vignette
        offset={0.35}
        darkness={0.55}
        blendFunction={BlendFunction.NORMAL}
      />
      <ChromaticAberration
        offset={new THREE.Vector2(0.0004, 0.0004)}
        radialModulation={true}
        modulationOffset={0.5}
      />
      <ToneMapping mode={ToneMappingMode.AGX} />
    </EffectComposer>
  );
}
