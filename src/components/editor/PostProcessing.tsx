import { EffectComposer, Bloom, Vignette, ChromaticAberration, ToneMapping, DepthOfField, Noise, HueSaturation, BrightnessContrast } from '@react-three/postprocessing';
import { KernelSize, BlendFunction, ToneMappingMode } from 'postprocessing';
import * as THREE from 'three';

export default function PostProcessing() {
  return (
    <EffectComposer multisampling={8}>
      {/* Primary bloom: ultra-wide cinematic glow — UE5 exponential fog style */}
      <Bloom
        intensity={3.2}
        luminanceThreshold={0.04}
        luminanceSmoothing={0.95}
        kernelSize={KernelSize.HUGE}
        mipmapBlur
      />
      {/* Secondary bloom: tighter highlights for LED and pyro punch */}
      <Bloom
        intensity={1.2}
        luminanceThreshold={0.25}
        luminanceSmoothing={0.6}
        kernelSize={KernelSize.LARGE}
        mipmapBlur
      />
      {/* Tertiary subtle bloom: atmospheric light wrap */}
      <Bloom
        intensity={0.35}
        luminanceThreshold={0.5}
        luminanceSmoothing={0.3}
        kernelSize={KernelSize.MEDIUM}
        mipmapBlur
      />
      {/* Cinematic depth of field — shallow focus */}
      <DepthOfField
        focusDistance={0.015}
        focalLength={0.05}
        bokehScale={4}
      />
      {/* Chromatic aberration — subtle lens imperfection */}
      <ChromaticAberration
        offset={new THREE.Vector2(0.0008, 0.0008)}
        radialModulation={true}
        modulationOffset={0.35}
      />
      {/* Film grain — 35mm cinematic texture */}
      <Noise
        premultiply
        blendFunction={BlendFunction.SOFT_LIGHT}
      />
      {/* Color grading: push shadows cool, highlights warm */}
      <HueSaturation
        saturation={0.2}
        hue={-0.02}
      />
      {/* Slight contrast boost for cinematic punch */}
      <BrightnessContrast
        brightness={-0.03}
        contrast={0.12}
      />
      {/* Heavy cinematic vignette */}
      <Vignette
        offset={0.2}
        darkness={0.82}
        blendFunction={BlendFunction.NORMAL}
      />
      <ToneMapping mode={ToneMappingMode.AGX} />
    </EffectComposer>
  );
}
