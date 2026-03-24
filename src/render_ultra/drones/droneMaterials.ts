/**
 * FX KONTROL · Drone PBR Materials
 * Physically-based materials for carbon fiber body, metal arms, and glass canopy.
 */

import * as THREE from 'three';

export interface DroneMaterialSet {
  body: THREE.MeshStandardMaterial;
  arms: THREE.MeshStandardMaterial;
  canopy: THREE.MeshPhysicalMaterial;
  motors: THREE.MeshStandardMaterial;
}

/**
 * Create a complete PBR material set for a drone.
 */
export function createDroneMaterials(): DroneMaterialSet {
  // Carbon fiber body — dark, slightly rough
  const body = new THREE.MeshStandardMaterial({
    color: 0x1a1a1a,
    metalness: 0.3,
    roughness: 0.6,
    envMapIntensity: 0.8,
  });

  // Aluminum arms
  const arms = new THREE.MeshStandardMaterial({
    color: 0x333333,
    metalness: 0.9,
    roughness: 0.25,
    envMapIntensity: 1.2,
  });

  // Glass canopy — clear-coat with transmission
  const canopy = new THREE.MeshPhysicalMaterial({
    color: 0x111111,
    metalness: 0.0,
    roughness: 0.1,
    transmission: 0.6,
    thickness: 0.5,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
    envMapIntensity: 2.0,
  });

  // Motor housings
  const motors = new THREE.MeshStandardMaterial({
    color: 0x222222,
    metalness: 0.95,
    roughness: 0.15,
    envMapIntensity: 1.0,
  });

  return { body, arms, canopy, motors };
}

/**
 * Apply environment map to all drone materials.
 */
export function applyEnvMap(materials: DroneMaterialSet, envMap: THREE.Texture) {
  materials.body.envMap = envMap;
  materials.arms.envMap = envMap;
  materials.canopy.envMap = envMap;
  materials.motors.envMap = envMap;
}
