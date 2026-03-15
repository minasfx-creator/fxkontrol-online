/**
 * FX KONTROL · Particle Chemistry Engine
 * Chemical-based color simulation for realistic fireworks.
 * Reproduces real pyrotechnic compound emission spectra.
 */

import * as THREE from 'three';

export interface ChemicalCompound {
  name: string;
  element: string;
  color: THREE.Color;
  temperature: number;       // Kelvin
  emissionIntensity: number; // HDR multiplier
  burnRate: number;          // seconds
  sparkSize: number;         // base particle size
  smokeColor: THREE.Color;
  trailDecay: number;        // 0-1, how fast trail fades
}

const COMPOUNDS: Record<string, ChemicalCompound> = {
  strontium: {
    name: 'Strontium Carbonate',
    element: 'Sr',
    color: new THREE.Color(1.0, 0.15, 0.05),
    temperature: 2200,
    emissionIntensity: 4.0,
    burnRate: 2.8,
    sparkSize: 1.2,
    smokeColor: new THREE.Color(0.15, 0.08, 0.06),
    trailDecay: 0.92,
  },
  barium: {
    name: 'Barium Chlorate',
    element: 'Ba',
    color: new THREE.Color(0.1, 1.0, 0.3),
    temperature: 1800,
    emissionIntensity: 3.5,
    burnRate: 2.5,
    sparkSize: 1.0,
    smokeColor: new THREE.Color(0.08, 0.12, 0.06),
    trailDecay: 0.90,
  },
  copper: {
    name: 'Copper Acetoarsenite',
    element: 'Cu',
    color: new THREE.Color(0.05, 0.45, 1.0),
    temperature: 1500,
    emissionIntensity: 3.2,
    burnRate: 2.2,
    sparkSize: 0.9,
    smokeColor: new THREE.Color(0.06, 0.08, 0.12),
    trailDecay: 0.88,
  },
  sodium: {
    name: 'Sodium Oxalate',
    element: 'Na',
    color: new THREE.Color(1.0, 0.85, 0.1),
    temperature: 2100,
    emissionIntensity: 5.0,
    burnRate: 2.0,
    sparkSize: 1.1,
    smokeColor: new THREE.Color(0.12, 0.10, 0.06),
    trailDecay: 0.94,
  },
  magnesium: {
    name: 'Magnalium',
    element: 'Mg/Al',
    color: new THREE.Color(1.0, 1.0, 0.95),
    temperature: 3200,
    emissionIntensity: 8.0,
    burnRate: 1.2,
    sparkSize: 1.5,
    smokeColor: new THREE.Color(0.2, 0.2, 0.2),
    trailDecay: 0.96,
  },
  titanium: {
    name: 'Titanium Sponge',
    element: 'Ti',
    color: new THREE.Color(1.0, 1.0, 1.0),
    temperature: 3500,
    emissionIntensity: 10.0,
    burnRate: 0.8,
    sparkSize: 2.0,
    smokeColor: new THREE.Color(0.25, 0.25, 0.25),
    trailDecay: 0.98,
  },
  iron: {
    name: 'Cast Iron Filings',
    element: 'Fe',
    color: new THREE.Color(1.0, 0.65, 0.15),
    temperature: 2800,
    emissionIntensity: 3.0,
    burnRate: 3.5,
    sparkSize: 1.8,
    smokeColor: new THREE.Color(0.15, 0.10, 0.05),
    trailDecay: 0.85,
  },
  charcoal: {
    name: 'Charcoal Streamer',
    element: 'C',
    color: new THREE.Color(1.0, 0.55, 0.08),
    temperature: 1800,
    emissionIntensity: 2.5,
    burnRate: 4.0,
    sparkSize: 1.4,
    smokeColor: new THREE.Color(0.1, 0.08, 0.04),
    trailDecay: 0.80,
  },
};

/**
 * Thermal color transition: white-hot → compound color → ember → dark
 */
export function thermalColor(compound: ChemicalCompound, lifeRatio: number, hdrMult: number): THREE.Color {
  const c = compound.color.clone();
  
  if (lifeRatio > 0.85) {
    // White-hot ignition core
    c.lerp(new THREE.Color(1, 1, 0.95), (lifeRatio - 0.85) / 0.15);
    c.multiplyScalar(hdrMult * compound.emissionIntensity);
  } else if (lifeRatio > 0.3) {
    // Peak compound color
    c.multiplyScalar(hdrMult * compound.emissionIntensity * lifeRatio);
  } else if (lifeRatio > 0.1) {
    // Ember fade — shift toward orange-red
    const ember = new THREE.Color(0.8, 0.25, 0.02);
    c.lerp(ember, 1 - lifeRatio / 0.3);
    c.multiplyScalar(hdrMult * lifeRatio * 2);
  } else {
    // Final dark ember
    c.set(0.15, 0.05, 0.01).multiplyScalar(hdrMult * lifeRatio * 5);
  }
  
  return c;
}

export function getCompound(name: string): ChemicalCompound {
  return COMPOUNDS[name] || COMPOUNDS.magnesium;
}

export function getAllCompounds(): Record<string, ChemicalCompound> {
  return { ...COMPOUNDS };
}

export type { ChemicalCompound as Compound };
