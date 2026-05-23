/**
 * FWsim canonical smoke sprite — shared singleton.
 *
 * Wraps `src/assets/textures/fwsim/smoke_with_alpha.png` (FWsim 3.4.x).
 * Returns a memoized THREE.Texture configured for additive/billboard smoke.
 *
 * Renderers opt-in via feature flag `r_fwsim_smoke_texture`. When the flag is
 * OFF, callers should fall back to procedural alpha (legacy behaviour).
 */
import * as THREE from 'three';
import smokeUrl from '@/assets/textures/fwsim/smoke_with_alpha.png';

let _tex: THREE.Texture | null = null;
let _loader: THREE.TextureLoader | null = null;

/** Lazily-loaded shared smoke sprite. Idempotent. */
export function getFwsimSmokeTexture(): THREE.Texture {
  if (_tex) return _tex;
  if (!_loader) _loader = new THREE.TextureLoader();
  _tex = _loader.load(smokeUrl, (loaded) => {
    // Force GPU re-upload once the image actually arrives.
    loaded.needsUpdate = true;
  });
  // Sprite is consumed by an additive shader (gl_FragColor = vec4(vColor * tex.rgb, tex.a * k)).
  // Tagging the texture as sRGB would force three.js to apply an sRGB→linear
  // decode that crushes the FWsim smoke into a grey/dim plume. Keep linear so
  // the alpha curve baked by the FWsim artists hits the framebuffer 1:1.
  _tex.colorSpace = THREE.LinearSRGBColorSpace;
  _tex.wrapS = THREE.ClampToEdgeWrapping;
  _tex.wrapT = THREE.ClampToEdgeWrapping;
  _tex.minFilter = THREE.LinearFilter;
  _tex.magFilter = THREE.LinearFilter;
  _tex.generateMipmaps = false;
  return _tex;
}

/** Dispose the cached texture. Test/teardown only. */
export function disposeFwsimSmokeTexture(): void {
  if (_tex) {
    _tex.dispose();
    _tex = null;
  }
  _loader = null;
}

/** Asset URL (for tests / Storybook). */
export const FWSIM_SMOKE_URL: string = smokeUrl;
