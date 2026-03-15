/**
 * FX KONTROL · HDR Lighting System
 * High Dynamic Range lighting for cinematic firework rendering.
 */

import * as THREE from 'three';

export interface HDRLightingConfig {
  moonIntensity: number;
  moonColor: THREE.Color;
  ambientIntensity: number;
  ambientColor: THREE.Color;
  fillIntensity: number;
  rimIntensity: number;
}

/**
 * Create a complete HDR lighting rig for night scene.
 */
export function createHDRLightingRig(config?: Partial<HDRLightingConfig>) {
  const cfg: HDRLightingConfig = {
    moonIntensity: 0.45,
    moonColor: new THREE.Color(0.53, 0.6, 0.8),
    ambientIntensity: 0.05,
    ambientColor: new THREE.Color(0.2, 0.25, 0.35),
    fillIntensity: 0.35,
    rimIntensity: 0.55,
    ...config,
  };

  const group = new THREE.Group();

  // Moonlight — directional
  const moon = new THREE.DirectionalLight(cfg.moonColor, cfg.moonIntensity);
  moon.position.set(100, 200, 50);
  moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048);
  moon.shadow.camera.near = 0.5;
  moon.shadow.camera.far = 500;
  moon.shadow.camera.left = -200;
  moon.shadow.camera.right = 200;
  moon.shadow.camera.top = 200;
  moon.shadow.camera.bottom = -200;
  moon.shadow.bias = -0.0001;
  group.add(moon);

  // Ambient — very low, night sky fill
  const ambient = new THREE.AmbientLight(cfg.ambientColor, cfg.ambientIntensity);
  group.add(ambient);

  // Fill light — soft underside fill
  const fill = new THREE.HemisphereLight(
    new THREE.Color(0.15, 0.18, 0.25),
    new THREE.Color(0.02, 0.03, 0.02),
    cfg.fillIntensity
  );
  group.add(fill);

  return {
    group,
    moon,
    ambient,
    fill,
    updateMoonIntensity(v: number) { moon.intensity = v; },
    updateAmbient(v: number) { ambient.intensity = v; },
  };
}
