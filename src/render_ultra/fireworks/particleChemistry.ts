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
  /** Friction sensitivity (kg) — Manual: SR < 5kg = high sensitivity, faster burn */
  frictionSensitivity?: number;
  /** Sulfur content (0-1) — affects smoke color (yellow-gray residue from pólvora negra) */
  sulfurContent?: number;
  /** Charcoal type — Manual: 'red' = low-temp easy ignite, 'black' = high-temp hard ignite */
  charcoalType?: 'red' | 'black';
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

// ── Real FFIC-Validated Compound Formulations ─────────────────────
// Derived from FFIC test reports (PIROEX / SkyKing shells, cakes, single shots)

export interface RealFormulation {
  name: string;
  productType: 'shell' | 'cake' | 'single_shot' | 'mine';
  caliber: string;
  compounds: { element: string; percentage: number }[];
  resultColor: THREE.Color;
  temperature: number;
  emissionIntensity: number;
  burnRate: number;
  sparkSize: number;
  smokeColor: THREE.Color;
  trailDecay: number;
  crackle: boolean;
}

export const REAL_FORMULATIONS: Record<string, RealFormulation> = {
  'purple_peony_2.5': {
    name: 'Purple Peony 2.5" Shell',
    productType: 'shell',
    caliber: '2.5"',
    compounds: [
      { element: 'CuO', percentage: 22 },
      { element: 'KClO4', percentage: 16 },
      { element: 'Sr(NO3)2', percentage: 12 },
      { element: 'Al', percentage: 8 },
      { element: 'Shellac', percentage: 6 },
    ],
    resultColor: new THREE.Color(0.6, 0.1, 0.85),
    temperature: 1900,
    emissionIntensity: 3.8,
    burnRate: 2.4,
    sparkSize: 1.0,
    smokeColor: new THREE.Color(0.12, 0.08, 0.14),
    trailDecay: 0.91,
    crackle: false,
  },
  'blue_peony_2.5': {
    name: 'Blue Peony 2.5" Shell',
    productType: 'shell',
    caliber: '2.5"',
    compounds: [
      { element: 'LAC', percentage: 50 },
      { element: 'PVC', percentage: 8 },
      { element: 'CuO', percentage: 15 },
      { element: 'KClO4', percentage: 12 },
    ],
    resultColor: new THREE.Color(0.08, 0.3, 1.0),
    temperature: 1600,
    emissionIntensity: 3.4,
    burnRate: 2.3,
    sparkSize: 0.9,
    smokeColor: new THREE.Color(0.06, 0.07, 0.12),
    trailDecay: 0.89,
    crackle: false,
  },
  'crackling_willow_30mm': {
    name: 'Ti Crackling Willow 30mm Single Shot',
    productType: 'single_shot',
    caliber: '30mm',
    compounds: [
      { element: 'Ti', percentage: 10 },
      { element: 'Al/Mg', percentage: 5 },
      { element: 'Bi2O3', percentage: 18 },
      { element: 'KClO4', percentage: 14 },
      { element: 'Cu(NO3)2', percentage: 8 },
    ],
    resultColor: new THREE.Color(1.0, 0.95, 0.7),
    temperature: 3100,
    emissionIntensity: 7.5,
    burnRate: 1.5,
    sparkSize: 1.8,
    smokeColor: new THREE.Color(0.2, 0.18, 0.15),
    trailDecay: 0.95,
    crackle: true,
  },
  'red_mine_30mm': {
    name: 'Red Mine 30mm Single Shot',
    productType: 'single_shot',
    caliber: '30mm',
    compounds: [
      { element: 'SrCO3', percentage: 25 },
      { element: 'KClO4', percentage: 18 },
      { element: 'Mg/Al', percentage: 6 },
      { element: 'Shellac', percentage: 5 },
    ],
    resultColor: new THREE.Color(1.0, 0.12, 0.04),
    temperature: 2300,
    emissionIntensity: 4.5,
    burnRate: 2.6,
    sparkSize: 1.3,
    smokeColor: new THREE.Color(0.14, 0.06, 0.04),
    trailDecay: 0.92,
    crackle: false,
  },
  'gold_willow_2.5': {
    name: 'Gold Willow 2.5" Shell',
    productType: 'shell',
    caliber: '2.5"',
    compounds: [
      { element: 'Fe', percentage: 15 },
      { element: 'C', percentage: 12 },
      { element: 'KNO3', percentage: 20 },
      { element: 'S', percentage: 8 },
    ],
    resultColor: new THREE.Color(1.0, 0.75, 0.15),
    temperature: 2000,
    emissionIntensity: 3.0,
    burnRate: 3.8,
    sparkSize: 1.6,
    smokeColor: new THREE.Color(0.12, 0.10, 0.06),
    trailDecay: 0.82,
    crackle: false,
  },
  'brocade_crown_2.5': {
    name: 'Brocade Crown 2.5" Shell',
    productType: 'shell',
    caliber: '2.5"',
    compounds: [
      { element: 'Bi', percentage: 20 },
      { element: 'KClO4', percentage: 15 },
      { element: 'Sb2S3', percentage: 10 },
      { element: 'Dextrin', percentage: 5 },
    ],
    resultColor: new THREE.Color(1.0, 0.88, 0.6),
    temperature: 1700,
    emissionIntensity: 2.8,
    burnRate: 3.2,
    sparkSize: 1.3,
    smokeColor: new THREE.Color(0.1, 0.09, 0.07),
    trailDecay: 0.84,
    crackle: true,
  },
  'cake_300_20mm': {
    name: 'Cake 20mm 300-Shot Multicolor',
    productType: 'cake',
    caliber: '20mm',
    compounds: [
      { element: 'Mixed', percentage: 100 },
    ],
    resultColor: new THREE.Color(0.9, 0.5, 0.2),
    temperature: 2000,
    emissionIntensity: 3.5,
    burnRate: 2.0,
    sparkSize: 0.8,
    smokeColor: new THREE.Color(0.1, 0.1, 0.08),
    trailDecay: 0.88,
    crackle: false,
  },
};

/** Get a real formulation as a ChemicalCompound for the render engine */
export function formulationToCompound(formulation: RealFormulation): ChemicalCompound {
  return {
    name: formulation.name,
    element: formulation.compounds.map(c => c.element).join('+'),
    color: formulation.resultColor.clone(),
    temperature: formulation.temperature,
    emissionIntensity: formulation.emissionIntensity,
    burnRate: formulation.burnRate,
    sparkSize: formulation.sparkSize,
    smokeColor: formulation.smokeColor.clone(),
    trailDecay: formulation.trailDecay,
  };
}

export function getRealFormulation(id: string): RealFormulation | undefined {
  return REAL_FORMULATIONS[id];
}

export function getAllFormulations(): Record<string, RealFormulation> {
  return { ...REAL_FORMULATIONS };
}

// ── Emission Spectrum Engine ────────────────────────────────────────
// Maps chemical elements to dominant emission wavelengths (nm)

interface EmissionLine {
  wavelength: number; // nm
  intensity: number;  // 0-1 relative
}

const ELEMENT_EMISSION: Record<string, EmissionLine[]> = {
  'Sr': [{ wavelength: 606, intensity: 1.0 }, { wavelength: 650, intensity: 0.6 }],
  'SrCO3': [{ wavelength: 606, intensity: 1.0 }, { wavelength: 650, intensity: 0.6 }],
  'Sr(NO3)2': [{ wavelength: 606, intensity: 0.9 }, { wavelength: 640, intensity: 0.5 }],
  'Ba': [{ wavelength: 524, intensity: 1.0 }, { wavelength: 553, intensity: 0.7 }],
  'Cu': [{ wavelength: 510, intensity: 0.8 }, { wavelength: 470, intensity: 1.0 }],
  'CuO': [{ wavelength: 510, intensity: 0.7 }, { wavelength: 470, intensity: 1.0 }],
  'Cu(NO3)2': [{ wavelength: 505, intensity: 0.8 }, { wavelength: 475, intensity: 0.9 }],
  'Na': [{ wavelength: 589, intensity: 1.0 }],
  'Fe': [{ wavelength: 580, intensity: 0.6 }, { wavelength: 620, intensity: 0.8 }],
  'Ti': [{ wavelength: 400, intensity: 0.3 }, { wavelength: 500, intensity: 0.5 }, { wavelength: 600, intensity: 0.5 }, { wavelength: 700, intensity: 0.3 }], // broadband
  'Mg/Al': [{ wavelength: 500, intensity: 0.9 }, { wavelength: 520, intensity: 1.0 }],
  'Al': [{ wavelength: 490, intensity: 0.8 }, { wavelength: 520, intensity: 0.6 }],
  'Al/Mg': [{ wavelength: 500, intensity: 0.9 }, { wavelength: 520, intensity: 1.0 }],
  'Bi': [{ wavelength: 560, intensity: 0.6 }, { wavelength: 600, intensity: 0.5 }],
  'Bi2O3': [{ wavelength: 560, intensity: 0.6 }, { wavelength: 590, intensity: 0.5 }],
  'C': [{ wavelength: 590, intensity: 0.7 }, { wavelength: 620, intensity: 0.9 }],
  'S': [{ wavelength: 580, intensity: 0.5 }],
  'KClO4': [], // oxidizer, no visible emission
  'KNO3': [],
  'LAC': [{ wavelength: 470, intensity: 0.9 }], // blue copper compound
  'PVC': [],  // chlorine donor, no visible emission
  'Shellac': [],
  'Dextrin': [],
  'Sb2S3': [{ wavelength: 560, intensity: 0.4 }],
  'Mixed': [{ wavelength: 520, intensity: 0.5 }, { wavelength: 580, intensity: 0.6 }, { wavelength: 620, intensity: 0.5 }],
};

/** Get emission spectrum for a real formulation */
export function getEmissionSpectrum(formulationId: string): EmissionLine[] {
  const form = REAL_FORMULATIONS[formulationId];
  if (!form) return [];

  const lines: EmissionLine[] = [];
  for (const compound of form.compounds) {
    const emissions = ELEMENT_EMISSION[compound.element] || [];
    for (const line of emissions) {
      lines.push({
        wavelength: line.wavelength,
        intensity: line.intensity * (compound.percentage / 100),
      });
    }
  }
  return lines;
}

/** Wavelength (nm) to sRGB via CIE approximation */
function wavelengthToRGB(nm: number): THREE.Color {
  let r = 0, g = 0, b = 0;
  if (nm >= 380 && nm < 440) {
    r = -(nm - 440) / 60; b = 1;
  } else if (nm < 490) {
    g = (nm - 440) / 50; b = 1;
  } else if (nm < 510) {
    g = 1; b = -(nm - 510) / 20;
  } else if (nm < 580) {
    r = (nm - 510) / 70; g = 1;
  } else if (nm < 645) {
    r = 1; g = -(nm - 645) / 65;
  } else if (nm <= 780) {
    r = 1;
  }
  return new THREE.Color(r, g, b);
}

/** Blend formulation colors from emission spectrum instead of static preset */
export function blendFormulationColors(formulationId: string): THREE.Color {
  const spectrum = getEmissionSpectrum(formulationId);
  if (spectrum.length === 0) {
    const form = REAL_FORMULATIONS[formulationId];
    return form ? form.resultColor.clone() : new THREE.Color(1, 1, 1);
  }

  const result = new THREE.Color(0, 0, 0);
  let totalWeight = 0;

  for (const line of spectrum) {
    if (line.intensity < 0.01) continue;
    const rgb = wavelengthToRGB(line.wavelength);
    result.r += rgb.r * line.intensity;
    result.g += rgb.g * line.intensity;
    result.b += rgb.b * line.intensity;
    totalWeight += line.intensity;
  }

  if (totalWeight > 0) {
    result.r /= totalWeight;
    result.g /= totalWeight;
    result.b /= totalWeight;
  }

  return result;
}
