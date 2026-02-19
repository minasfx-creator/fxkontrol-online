import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { KernelSize } from 'postprocessing';

export default function PostProcessing() {
  return (
    <EffectComposer>
      <Bloom
        intensity={1.2}
        luminanceThreshold={0.2}
        luminanceSmoothing={0.9}
        kernelSize={KernelSize.LARGE}
        mipmapBlur
      />
    </EffectComposer>
  );
}
