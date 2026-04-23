/**
 * ─── Highlight Desaturation Effect ──────────────────────────────────
 * Simulates real camera sensor response at peak luminance:
 * bright pixels progressively desaturate toward pure white.
 * 
 * Also implements hue-preserving highlight compression to prevent
 * the ACES blue→magenta shift artifact on copper/strontium pyro colors.
 * 
 * Controlled by feature flag: cinematic_camera_response
 */

import { Effect } from 'postprocessing';
import { Uniform } from 'three';

type EffectUniformMap = Map<string, Uniform>;

const HIGHLIGHT_DESAT_FRAGMENT = `
uniform float intensity;
uniform float threshold;
uniform float compression;

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 color = inputColor.rgb;
  float lum = dot(color, vec3(0.2126, 0.7152, 0.0722));
  
  // Highlight desaturation: lerp toward luminance (white) in bright areas
  // This mimics CMOS sensor well saturation / film highlight rolloff
  float desatFactor = smoothstep(threshold, threshold + 3.0, lum) * intensity;
  vec3 desaturated = mix(color, vec3(lum), desatFactor);
  
  // Hue-preserving highlight compression:
  // Prevent ACES blue→magenta shift by maintaining hue ratio
  // at extreme luminance levels
  float maxChannel = max(desaturated.r, max(desaturated.g, desaturated.b));
  
  if (maxChannel > compression && maxChannel > 0.001) {
    // Soft-knee compression: smoothly reduce over-bright channels
    float knee = compression;
    float excess = maxChannel - knee;
    float compressed = knee + excess / (1.0 + excess);
    float scale = compressed / maxChannel;
    
    // Preserve chrominance ratios while compressing luminance
    desaturated *= scale;
    
    // Re-inject slight warmth to prevent clinical-white look
    float warmth = smoothstep(compression, compression + 2.0, lum) * 0.03;
    desaturated.r += warmth;
    desaturated.g += warmth * 0.6;
  }
  
  outputColor = vec4(desaturated, inputColor.a);
}
`;

export class HighlightDesaturationEffect extends Effect {
  private get effectUniforms(): EffectUniformMap {
    return (this as unknown as { uniforms: EffectUniformMap }).uniforms;
  }

  constructor({
    intensity = 0.8,
    threshold = 2.0,
    compression = 1.5,
  }: {
    intensity?: number;
    threshold?: number;
    compression?: number;
  } = {}) {
    super('HighlightDesaturationEffect', HIGHLIGHT_DESAT_FRAGMENT, {
      uniforms: new Map([
        ['intensity', new Uniform(intensity)],
        ['threshold', new Uniform(threshold)],
        ['compression', new Uniform(compression)],
      ]),
    });
  }

  set intensity(value: number) {
    (this.effectUniforms.get('intensity') as Uniform).value = value;
  }

  set threshold(value: number) {
    (this.effectUniforms.get('threshold') as Uniform).value = value;
  }

  set compression(value: number) {
    (this.effectUniforms.get('compression') as Uniform).value = value;
  }
}
