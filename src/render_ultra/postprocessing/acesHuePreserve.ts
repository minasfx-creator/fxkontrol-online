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

const ACES_HUE_PRESERVE_FRAGMENT = `
uniform float exposure;
uniform float huePreserveStrength;
uniform float highlightThreshold;
uniform float fwsimContrast;
uniform float fwsimHdrMax;

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

  // r_fwsim_tonemapping: HdrMax clamp (FWsim caps energy before curve)
  if (fwsimHdrMax > 0.0) {
    color = min(color, vec3(fwsimHdrMax));
  }

  // r_fwsim_tonemapping: per-channel power curve around mid-gray (0.18).
  // This is the FWsim "Contrast" knob (graphics.xml TonemappingConfig.Contrast).
  // It is a CONTRAST/gamma operation per channel — it lifts shadows and steepens
  // highlights. Hue/saturation drift slightly (the highlight-preservation pass
  // below compensates the worst of it on bright emissives). Neutral at 1.0.
  if (abs(fwsimContrast - 1.0) > 0.001) {
    vec3 mid = vec3(0.18);
    color = mid * pow(max(color / mid, vec3(0.0)), vec3(fwsimContrast));
  }

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
  constructor({
    exposure = 1.0,
    huePreserveStrength = 0.7,
    highlightThreshold = 1.5,
    fwsimContrast = 1.0,
    fwsimHdrMax = 0.0,
  }: {
    exposure?: number;
    huePreserveStrength?: number;
    highlightThreshold?: number;
    /** FWsim TonemappingConfig.Contrast (1.7 canonical). 1.0 = neutral/disabled. */
    fwsimContrast?: number;
    /** FWsim TonemappingConfig.HdrMax (16 canonical). <=0 = disabled. */
    fwsimHdrMax?: number;
  } = {}) {
    super('ACESHuePreserveEffect', ACES_HUE_PRESERVE_FRAGMENT, {
      uniforms: new Map([
        ['exposure', new Uniform(exposure)],
        ['huePreserveStrength', new Uniform(huePreserveStrength)],
        ['highlightThreshold', new Uniform(highlightThreshold)],
        ['fwsimContrast', new Uniform(fwsimContrast)],
        ['fwsimHdrMax', new Uniform(fwsimHdrMax)],
      ]),
    });
  }

  set exposure(v: number) { (this.uniforms.get('exposure') as Uniform).value = v; }
  set huePreserveStrength(v: number) { (this.uniforms.get('huePreserveStrength') as Uniform).value = v; }
  set highlightThreshold(v: number) { (this.uniforms.get('highlightThreshold') as Uniform).value = v; }
  set fwsimContrast(v: number) { (this.uniforms.get('fwsimContrast') as Uniform).value = v; }
  set fwsimHdrMax(v: number) { (this.uniforms.get('fwsimHdrMax') as Uniform).value = v; }
}

