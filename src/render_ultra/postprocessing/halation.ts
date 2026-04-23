/**
 * ─── Halation Effect ────────────────────────────────────────────────
 * Simulates film halation: reddish halos around extreme highlights
 * caused by light bouncing off the film base/anti-halation layer.
 * 
 * Only triggers on very bright emissive sources (luminance > threshold).
 * The halo is warm-shifted (red channel boosted) and spatially diffused.
 * 
 * Controlled by feature flag: hdr_bloom_physical
 */

import { Effect } from 'postprocessing';
import { Uniform } from 'three';

type EffectUniformMap = Map<string, Uniform>;

const HALATION_FRAGMENT = `
uniform float intensity;
uniform float threshold;
uniform float radius;

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec2 texelSize = 1.0 / resolution;
  
  // Extract only extreme highlights
  float lum = dot(inputColor.rgb, vec3(0.2126, 0.7152, 0.0722));
  float brightMask = smoothstep(threshold, threshold + 2.0, lum);
  
  if (brightMask < 0.001) {
    outputColor = inputColor;
    return;
  }
  
  // Wide gaussian-like sampling for diffuse halo
  vec4 haloAccum = vec4(0.0);
  float totalWeight = 0.0;
  
  float r = radius;
  
  // 13-tap cross + diagonal sampling pattern (cheap wide blur)
  vec2 offsets[13];
  offsets[0]  = vec2(0.0, 0.0);
  offsets[1]  = vec2(r, 0.0);
  offsets[2]  = vec2(-r, 0.0);
  offsets[3]  = vec2(0.0, r);
  offsets[4]  = vec2(0.0, -r);
  offsets[5]  = vec2(r * 0.707, r * 0.707);
  offsets[6]  = vec2(-r * 0.707, r * 0.707);
  offsets[7]  = vec2(r * 0.707, -r * 0.707);
  offsets[8]  = vec2(-r * 0.707, -r * 0.707);
  offsets[9]  = vec2(r * 2.0, 0.0);
  offsets[10] = vec2(-r * 2.0, 0.0);
  offsets[11] = vec2(0.0, r * 2.0);
  offsets[12] = vec2(0.0, -r * 2.0);
  
  float weights[13];
  weights[0]  = 1.0;
  weights[1]  = 0.7;  weights[2]  = 0.7;
  weights[3]  = 0.7;  weights[4]  = 0.7;
  weights[5]  = 0.5;  weights[6]  = 0.5;
  weights[7]  = 0.5;  weights[8]  = 0.5;
  weights[9]  = 0.25; weights[10] = 0.25;
  weights[11] = 0.25; weights[12] = 0.25;
  
  for (int i = 0; i < 13; i++) {
    vec2 sampleUV = uv + offsets[i] * texelSize;
    vec4 s = texture2D(inputBuffer, clamp(sampleUV, 0.0, 1.0));
    float sLum = dot(s.rgb, vec3(0.2126, 0.7152, 0.0722));
    float sBright = smoothstep(threshold, threshold + 2.0, sLum);
    haloAccum += s * weights[i] * sBright;
    totalWeight += weights[i] * sBright;
  }
  
  if (totalWeight > 0.001) {
    haloAccum /= totalWeight;
  }
  
  // Warm-shift the halo: boost red, slight orange tint
  // This simulates the anti-halation layer absorption in film
  vec3 haloColor = haloAccum.rgb;
  haloColor.r *= 1.4;
  haloColor.g *= 0.85;
  haloColor.b *= 0.6;
  
  // Soft additive blend, gated by highlight mask
  outputColor = vec4(
    inputColor.rgb + haloColor * intensity * brightMask,
    inputColor.a
  );
}
`;

export class HalationEffect extends Effect {
  private get effectUniforms(): EffectUniformMap {
    return (this as unknown as { uniforms: EffectUniformMap }).uniforms;
  }

  constructor({
    intensity = 0.15,
    threshold = 5.0,
    radius = 6.0,
  }: {
    intensity?: number;
    threshold?: number;
    radius?: number;
  } = {}) {
    super('HalationEffect', HALATION_FRAGMENT, {
      uniforms: new Map([
        ['intensity', new Uniform(intensity)],
        ['threshold', new Uniform(threshold)],
        ['radius', new Uniform(radius)],
      ]),
    });
  }

  set intensity(value: number) {
    (this.effectUniforms.get('intensity') as Uniform).value = value;
  }

  set threshold(value: number) {
    (this.effectUniforms.get('threshold') as Uniform).value = value;
  }

  set radius(value: number) {
    (this.effectUniforms.get('radius') as Uniform).value = value;
  }
}
