/**
 * FX KONTROL · Drone LED Light System
 * Realistic LED emission with HDR bloom halos and distance falloff.
 */

import * as THREE from 'three';

export interface DroneLightConfig {
  color: THREE.Color;
  intensity: number;      // HDR multiplier
  radius: number;         // falloff distance
  pulseFreq: number;      // Hz, 0 = static
  haloSize: number;       // volumetric halo scale
}

const NAV_LIGHTS = {
  front: { color: new THREE.Color(0, 1, 0), intensity: 2.0, radius: 30 },
  rear: { color: new THREE.Color(1, 0, 0), intensity: 1.5, radius: 25 },
  strobe: { color: new THREE.Color(1, 1, 1), intensity: 8.0, radius: 50 },
};

/**
 * LED halo sprite material — gaussian glow with HDR emission.
 */
export function createLEDHaloMaterial(color: THREE.Color, intensity: number): THREE.SpriteMaterial {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  // Multi-layer gaussian glow
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, `rgba(${Math.round(color.r * 255)}, ${Math.round(color.g * 255)}, ${Math.round(color.b * 255)}, 1.0)`);
  gradient.addColorStop(0.15, `rgba(${Math.round(color.r * 255)}, ${Math.round(color.g * 255)}, ${Math.round(color.b * 255)}, 0.6)`);
  gradient.addColorStop(0.4, `rgba(${Math.round(color.r * 255)}, ${Math.round(color.g * 255)}, ${Math.round(color.b * 255)}, 0.15)`);
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);

  const tex = new THREE.CanvasTexture(canvas);
  return new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    opacity: Math.min(intensity / 5, 1),
  });
}

/**
 * Create a complete drone light rig (main LED + nav lights).
 */
export function createDroneLightRig(mainColor: THREE.Color, hdrMult = 3.5) {
  const group = new THREE.Group();

  // Main LED — bottom-center
  const mainHalo = new THREE.Sprite(createLEDHaloMaterial(mainColor, hdrMult));
  mainHalo.scale.set(4, 4, 1);
  mainHalo.position.set(0, -0.3, 0);
  group.add(mainHalo);

  // Navigation lights
  const frontSprite = new THREE.Sprite(createLEDHaloMaterial(NAV_LIGHTS.front.color, NAV_LIGHTS.front.intensity));
  frontSprite.scale.set(1.2, 1.2, 1);
  frontSprite.position.set(0, 0, 0.5);
  group.add(frontSprite);

  const rearSprite = new THREE.Sprite(createLEDHaloMaterial(NAV_LIGHTS.rear.color, NAV_LIGHTS.rear.intensity));
  rearSprite.scale.set(1.0, 1.0, 1);
  rearSprite.position.set(0, 0, -0.5);
  group.add(rearSprite);

  return {
    group,
    updateColor(color: THREE.Color) {
      (mainHalo.material as THREE.SpriteMaterial).dispose();
      mainHalo.material = createLEDHaloMaterial(color, hdrMult);
    },
  };
}

export function getNavLights() {
  return NAV_LIGHTS;
}
