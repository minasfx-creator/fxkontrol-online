import { EffectComposer, Bloom, Vignette, ChromaticAberration, ToneMapping, DepthOfField, Noise, HueSaturation } from '@react-three/postprocessing';
import { KernelSize, BlendFunction, ToneMappingMode } from 'postprocessing';
import * as THREE from 'three';

export default function PostProcessing() {
  return (
    <EffectComposer multisampling={4}>
      {/* UE5-style bloom: multi-layer glow with wide kernel */}
      <Bloom
        intensity={2.4}
        luminanceThreshold={0.08}
        luminanceSmoothing={0.9}
        kernelSize={KernelSize.HUGE}
        mipmapBlur
      />
      {/* Secondary subtle bloom for atmospheric glow */}
      <Bloom
        intensity={0.6}
        luminanceThreshold={0.4}
        luminanceSmoothing={0.5}
        kernelSize={KernelSize.LARGE}
        mipmapBlur
      />
      {/* Depth of field — cinematic bokeh */}
      <DepthOfField
        focusDistance={0.02}
        focalLength={0.06}
        bokehScale={3}
      />
      {/* Chromatic aberration — lens distortion */}
      <ChromaticAberration
        offset={new THREE.Vector2(0.0006, 0.0006)}
        radialModulation={true}
        modulationOffset={0.4}
      />
      {/* Film grain for cinematic feel */}
      <Noise
        premultiply
        blendFunction={BlendFunction.SOFT_LIGHT}
      />
      {/* Slight color grading: deepen blues, warm highlights */}
      <HueSaturation
        saturation={0.15}
        hue={0}
      />
      {/* Cinematic vignette — heavier than before */}
      <Vignette
        offset={0.25}
        darkness={0.7}
        blendFunction={BlendFunction.NORMAL}
      />
      <ToneMapping mode={ToneMappingMode.AGX} />
    </EffectComposer>
  );
}
