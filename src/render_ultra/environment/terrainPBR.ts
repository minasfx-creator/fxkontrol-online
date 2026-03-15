/**
 * FX KONTROL · Terrain PBR Material
 * Physically-based ground material with specular reflections.
 */

import * as THREE from 'three';

export interface TerrainConfig {
  color: THREE.Color;
  roughness: number;
  metalness: number;
  wetness: number;          // 0-1, affects specular reflections
  normalScale: number;
}

const TERRAIN_PRESETS: Record<string, TerrainConfig> = {
  'grass-field': {
    color: new THREE.Color(0.04, 0.08, 0.03),
    roughness: 0.85,
    metalness: 0.0,
    wetness: 0.2,
    normalScale: 0.8,
  },
  'concrete': {
    color: new THREE.Color(0.12, 0.12, 0.11),
    roughness: 0.7,
    metalness: 0.05,
    wetness: 0.0,
    normalScale: 1.0,
  },
  'wet-asphalt': {
    color: new THREE.Color(0.05, 0.05, 0.06),
    roughness: 0.2,
    metalness: 0.15,
    wetness: 0.9,
    normalScale: 0.5,
  },
  'dirt': {
    color: new THREE.Color(0.08, 0.06, 0.04),
    roughness: 0.9,
    metalness: 0.0,
    wetness: 0.1,
    normalScale: 1.2,
  },
};

/**
 * Create a PBR terrain material with optional wetness-based specular.
 */
export function createTerrainMaterial(preset: string = 'grass-field'): THREE.MeshStandardMaterial {
  const cfg = TERRAIN_PRESETS[preset] || TERRAIN_PRESETS['grass-field'];
  
  const material = new THREE.MeshStandardMaterial({
    color: cfg.color,
    roughness: cfg.roughness * (1 - cfg.wetness * 0.6),
    metalness: cfg.metalness + cfg.wetness * 0.1,
    envMapIntensity: 0.3 + cfg.wetness * 1.5,
  });

  return material;
}

/**
 * Create a ground plane with PBR material.
 */
export function createTerrainPlane(size = 500, preset = 'grass-field') {
  const geometry = new THREE.PlaneGeometry(size, size, 64, 64);
  const material = createTerrainMaterial(preset);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.receiveShadow = true;

  return { mesh, material };
}

export function getTerrainPresets() {
  return Object.keys(TERRAIN_PRESETS);
}
