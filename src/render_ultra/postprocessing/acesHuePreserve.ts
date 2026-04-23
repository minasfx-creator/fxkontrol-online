/**
 * ─── ACES Hue-Preserving Tone Mapping ───────────────────────────────
 * Custom ACES filmic curve with highlight fix that prevents the
 * blue→magenta shift artifact on high-intensity emissive sources.
 *
 * Standard ACES RRT+ODT compresses channels non-proportionally at
 * extreme luminance, causing hue rotation (particularly blue→magenta
 * on copper/strontium pyro). This shader:
 *
 * 1. Applies the ACES filmic curve (Narkowicz approximation)
 * 2. Before tone mapping, extracts hue from the linear input
 * 3. After tone mapping, re-injects the original hue ratio
 *    in highlights above a threshold, preventing chromatic drift
 * 4. Highlights converge gracefully to white (not false colors)
 *
 * This replaces the default ToneMapping effect when Studio Mode
 * cinematic post is active.
 */

import { Effect } from 'postprocessing';
import { Uniform } from 'three';

type EffectUniformMap = Map<string, Uniform>;

const ACES_HUE_PRESERVE_FRAGMENT = `
uniform float exposure;
uniform float huePreserveStrength;
uniform float highlightThreshold;

// ACES Filmic Tone Mapping (Narkowicz 2015)
vec3 acesFilmic(vec3 x) {
  float a = 2.51;
  float b = 0.03;
  float c = 2.43;
  float d = 0.59;
  float e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}

// Extract hue as normalized channel ratios
vec3 extractHue(vec3 color) {
  float maxC = max(color.r, max(color.g, color.b));
  if (maxC < 0.001) return vec3(0.333);
  return color / maxC;
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 color = inputColor.rgb * exposure;
  
  float lum = dot(color, vec3(0.2126, 0.7152, 0.0722));
  
  // Extract hue ratios BEFORE tone mapping
  vec3 hueRatio = extractHue(color);
  
  // Apply ACES filmic
  vec3 mapped = acesFilmic(color);
  
  // Hue preservation for highlights:
  // Above threshold, blend the tone-mapped result back toward
  // the original hue ratios to prevent chromatic drift
  float highlightMask = smoothstep(highlightThreshold, highlightThreshold + 1.5, lum);
  
  if (highlightMask > 0.001 && huePreserveStrength > 0.0) {
    // Re-derive the mapped luminance
    float mappedLum = dot(mapped, vec3(0.2126, 0.7152, 0.0722));
    
    // Reconstruct color using original hue ratios + mapped luminance
    vec3 huePreserved = hueRatio * mappedLum;
    
    // Graceful convergence to white at extreme luminance
    float whiteConverge = smoothstep(highlightThreshold + 1.0, highlightThreshold + 4.0, lum);
    huePreserved = mix(huePreserved, vec3(mappedLum), whiteConverge);
    
    // Blend based on highlight mask and strength
    mapped = mix(mapped, huePreserved, highlightMask * huePreserveStrength);
  }
  
  outputColor = vec4(mapped, inputColor.a);
}
`;

export class ACESHuePreserveEffect extends Effect {
  private get effectUniforms(): EffectUniformMap {
    return (this as unknown as { uniforms: EffectUniformMap }).uniforms;
  }

  constructor({
    exposure = 1.0,
    huePreserveStrength = 0.7,
    highlightThreshold = 1.5,
  }: {
    exposure?: number;
    huePreserveStrength?: number;
    highlightThreshold?: number;
  } = {}) {
    super('ACESHuePreserveEffect', ACES_HUE_PRESERVE_FRAGMENT, {
      uniforms: new Map([
        ['exposure', new Uniform(exposure)],
        ['huePreserveStrength', new Uniform(huePreserveStrength)],
        ['highlightThreshold', new Uniform(highlightThreshold)],
      ]),
    });
  }

  set exposure(v: number) { (this.effectUniforms.get('exposure') as Uniform).value = v; }
  set huePreserveStrength(v: number) { (this.effectUniforms.get('huePreserveStrength') as Uniform).value = v; }
  set highlightThreshold(v: number) { (this.effectUniforms.get('highlightThreshold') as Uniform).value = v; }
}
