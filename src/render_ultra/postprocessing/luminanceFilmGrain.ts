/**
 * ─── Luminance-Coupled Film Grain ───────────────────────────────────
 * Physically-motivated film grain that responds to scene luminance:
 *
 * - Dark regions: more visible grain (higher ISO noise in shadows)
 * - Bright regions: grain suppressed (well-exposed sensor areas)
 * - Grain intensity scales inversely with local luminance
 * - Temporal variation prevents static noise patterns
 *
 * This replaces the flat Noise effect with a cinematically accurate
 * grain pattern that matches real film/sensor behavior.
 */

import { Effect } from 'postprocessing';
import { Uniform } from 'three';

const FILM_GRAIN_FRAGMENT = `
uniform float intensity;
uniform float time;
uniform float luminanceResponse;

// High-quality hash for grain pattern
float grainHash(vec2 p, float t) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33 + t);
  return fract((p3.x + p3.y) * p3.z);
}

// Perceptual grain with temporal jitter
float filmGrain(vec2 uv, float t) {
  // Multi-frequency grain (coarse + fine)
  float coarse = grainHash(uv * resolution * 0.5, floor(t * 24.0)); // 24fps jitter
  float fine = grainHash(uv * resolution, floor(t * 24.0) + 0.5);
  return mix(coarse, fine, 0.6) - 0.5; // centered around 0
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 color = inputColor.rgb;
  float lum = dot(color, vec3(0.2126, 0.7152, 0.0722));
  
  // Grain visibility: stronger in shadows, weaker in highlights
  // Simulates real sensor noise (photon shot noise ∝ 1/√photons)
  float grainVisibility = mix(1.0, 0.15, smoothstep(0.0, 0.5, lum));
  grainVisibility = mix(grainVisibility, 1.0, luminanceResponse);
  
  // Scale intensity by visibility
  float grain = filmGrain(uv, time) * intensity * grainVisibility;
  
  // Apply grain additively in shadows, multiplicatively in midtones
  // This preserves highlight detail while adding texture to darks
  float blendMode = smoothstep(0.0, 0.3, lum);
  vec3 grainedAdditive = color + vec3(grain);
  vec3 grainedMultiply = color * (1.0 + grain);
  
  outputColor = vec4(mix(grainedAdditive, grainedMultiply, blendMode), inputColor.a);
}
`;

export class LuminanceFilmGrainEffect extends Effect {
  constructor({
    intensity = 0.08,
    luminanceResponse = 0.3,
  }: {
    intensity?: number;
    luminanceResponse?: number;
  } = {}) {
    super('LuminanceFilmGrainEffect', FILM_GRAIN_FRAGMENT, {
      uniforms: new Map([
        ['intensity', new Uniform(intensity)],
        ['time', new Uniform(0)],
        ['luminanceResponse', new Uniform(luminanceResponse)],
      ]),
    });
  }

  update(_renderer: any, _inputBuffer: any, deltaTime: number) {
    const t = this.uniforms.get('time') as Uniform;
    t.value += deltaTime;
  }

  set intensity(v: number) { (this.uniforms.get('intensity') as Uniform).value = v; }
  set luminanceResponse(v: number) { (this.uniforms.get('luminanceResponse') as Uniform).value = v; }
}
