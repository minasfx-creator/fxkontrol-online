/**
 * ─── Atmospheric Depth Mapping ──────────────────────────────────────
 * Simulates atmospheric perspective (aerial perspective):
 *
 * - Distant objects fade toward a sky/haze color
 * - Color desaturation with distance
 * - Subtle blue shift (Rayleigh scattering approximation)
 * - Enhances spatial depth perception in large festival layouts
 *
 * Uses depth buffer to estimate distance from camera.
 * Essential for wide-angle pyro views where shows span hundreds
 * of meters — without this, distant bursts look pasted on.
 */

import { Effect } from 'postprocessing';
import { Uniform } from 'three';

type EffectUniformMap = Map<string, Uniform>;

const ATMOSPHERIC_DEPTH_FRAGMENT = `
uniform float intensity;
uniform float nearPlane;
uniform float farPlane;
uniform vec3 fogColor;
uniform float desaturation;
uniform float blueShift;

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  // Read depth (0 = near, 1 = far in typical WebGL)
  float depth = readDepth(uv);
  
  // Linearize depth
  float linearDepth = (nearPlane * farPlane) / (farPlane - depth * (farPlane - nearPlane));
  
  // Normalized distance factor (0 = at camera, 1 = at far plane)
  float distFactor = smoothstep(nearPlane, farPlane * 0.6, linearDepth);
  distFactor *= intensity;
  
  vec3 color = inputColor.rgb;
  
  // Skip atmospheric effects on sky (very far depth)
  if (depth > 0.999) {
    outputColor = inputColor;
    return;
  }
  
  // 1. Desaturation with distance
  float lum = dot(color, vec3(0.2126, 0.7152, 0.0722));
  vec3 desaturated = mix(color, vec3(lum), distFactor * desaturation);
  
  // 2. Blue shift (Rayleigh scattering)
  vec3 shifted = desaturated;
  shifted.b += distFactor * blueShift * 0.05;
  shifted.r -= distFactor * blueShift * 0.02;
  
  // 3. Fog/haze blend toward atmospheric color
  vec3 result = mix(shifted, fogColor, distFactor * 0.4);
  
  outputColor = vec4(result, inputColor.a);
}
`;

export class AtmosphericDepthEffect extends Effect {
  private get effectUniforms(): EffectUniformMap {
    return (this as unknown as { uniforms: EffectUniformMap }).uniforms;
  }

  constructor({
    intensity = 0.3,
    nearPlane = 10,
    farPlane = 2000,
    fogColor = [0.05, 0.06, 0.12], // dark blue night sky
    desaturation = 0.5,
    blueShift = 0.6,
  }: {
    intensity?: number;
    nearPlane?: number;
    farPlane?: number;
    fogColor?: [number, number, number];
    desaturation?: number;
    blueShift?: number;
  } = {}) {
    super('AtmosphericDepthEffect', ATMOSPHERIC_DEPTH_FRAGMENT, {
      uniforms: new Map<string, Uniform>([
        ['intensity', new Uniform(intensity)],
        ['nearPlane', new Uniform(nearPlane)],
        ['farPlane', new Uniform(farPlane)],
        ['fogColor', new Uniform({ x: fogColor[0], y: fogColor[1], z: fogColor[2] })],
        ['desaturation', new Uniform(desaturation)],
        ['blueShift', new Uniform(blueShift)],
      ]),
    });
  }

  set intensity(v: number) { (this.effectUniforms.get('intensity') as Uniform).value = v; }
  set desaturation(v: number) { (this.effectUniforms.get('desaturation') as Uniform).value = v; }
  set blueShift(v: number) { (this.effectUniforms.get('blueShift') as Uniform).value = v; }
}
