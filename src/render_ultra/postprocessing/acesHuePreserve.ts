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
 * 4. Highlights converge to white via a tighter 2-stop window
 *    (v2: window was 4 stops — too wide, preserved colors at plasma temps)
 *
 * v2 changes:
 *   - whiteConverge window tightened: +1.0/+4.0 → +0.5/+2.5
 *     (white-out happens faster, matching real lens response to plasma)
 *   - huePreserveStrength default reduced: 0.7 → 0.6
 *     (plasma should go white, not keep tinted hue)
 *   - Added luminanceGain pre-scale to account for HDR×14-16 input range
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
uniform float luminanceGain;
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
  // luminanceGain pre-scales the linear HDR buffer before ACES
  // Use values < 1.0 when scene HDR peaks exceed ×14 (burst shaders)
  vec3 color = inputColor.rgb * exposure * luminanceGain;

  // FWsim HDR clamp before curve (0 disables)
  if (fwsimHdrMax > 0.0) {
    color = min(color, vec3(fwsimHdrMax));
  }

  // FWsim contrast around mid-gray 0.18 (1.0 = neutral)
  if (abs(fwsimContrast - 1.0) > 0.001) {
    float mid = 0.18;
    color = mid * pow(max(color / mid, vec3(0.0001)), vec3(fwsimContrast));
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
    float mappedLum = dot(mapped, vec3(0.2126, 0.7152, 0.0722));

    // Reconstruct color using original hue ratios + mapped luminance
    vec3 huePreserved = hueRatio * mappedLum;

    // v2: tighter 2-stop white convergence window matches real lens response to plasma.
    // Old window (+1/+4) kept copper/strontium tint too long into plasma zone.
    float whiteConverge = smoothstep(highlightThreshold + 0.5, highlightThreshold + 2.5, lum);
    huePreserved = mix(huePreserved, vec3(mappedLum), whiteConverge);

    mapped = mix(mapped, huePreserved, highlightMask * huePreserveStrength);
  }

  outputColor = vec4(mapped, inputColor.a);
}
`;

export class ACESHuePreserveEffect extends Effect {
  constructor({
    exposure = 1.0,
    huePreserveStrength = 0.6,   // v2: reduced from 0.7 — plasma goes white faster
    highlightThreshold = 1.5,
    luminanceGain = 1.0,
    fwsimContrast = 1.0,
    fwsimHdrMax = 0.0,
  }: {
    exposure?: number;
    huePreserveStrength?: number;
    highlightThreshold?: number;
    /** Pre-scale applied to the linear HDR buffer. Set to ~0.07 when burst peaks reach ×14-16. */
    luminanceGain?: number;
    /** FWsim tonemapping contrast around mid-gray 0.18 (1.0 = neutral). */
    fwsimContrast?: number;
    /** FWsim HDR clamp before curve; 0 disables. */
    fwsimHdrMax?: number;
  } = {}) {
    super('ACESHuePreserveEffect', ACES_HUE_PRESERVE_FRAGMENT, {
      uniforms: new Map([
        ['exposure',            new Uniform(exposure)],
        ['huePreserveStrength', new Uniform(huePreserveStrength)],
        ['highlightThreshold',  new Uniform(highlightThreshold)],
        ['luminanceGain',       new Uniform(luminanceGain)],
        ['fwsimContrast',       new Uniform(fwsimContrast)],
        ['fwsimHdrMax',         new Uniform(fwsimHdrMax)],
      ]),
    });
  }

  private _u(name: string): Uniform {
    return (this as unknown as { uniforms: Map<string, Uniform> }).uniforms?.get(name)
      ?? (this.getUniforms?.() as unknown as Map<string, Uniform>)?.get(name)
      ?? new Uniform(0);
  }

  set exposure(v: number)            { this._u('exposure').value = v; }
  set huePreserveStrength(v: number) { this._u('huePreserveStrength').value = v; }
  set highlightThreshold(v: number)  { this._u('highlightThreshold').value = v; }
  set luminanceGain(v: number)       { this._u('luminanceGain').value = v; }
  set fwsimContrast(v: number)       { this._u('fwsimContrast').value = v; }
  set fwsimHdrMax(v: number)         { this._u('fwsimHdrMax').value = v; }
}

