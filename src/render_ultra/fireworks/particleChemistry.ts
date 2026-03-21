/**
 * FX KONTROL · Particle Chemistry Engine
 * Chemical-based color simulation for realistic fireworks.
 * Reproduces real pyrotechnic compound emission spectra.
 * 
 * Enhanced with Manual de Pirotecnia data:
 * - Ignition temperatures from manual (°C)
 * - Electrostatic sensitivity (mJ)
 * - Combustion products
 * - Hygroscopicity data
 * - Safety classification (F/R/C risk levels)
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
  /** Ignition temperature in °C — from manual's chemical data sheets */
  ignitionTemp?: number;
  /** Electrostatic sensitivity in mJ — lower = more sensitive */
  electrostaticSensitivity?: number;
  /** Combustion products — chemical formula strings */
  combustionProducts?: string;
  /** Hygroscopicity — weight gain % at 90% RH */
  hygroscopicity?: number;
  /** Safety risk classification from manual (0-4 scale): F=Fire, R=Reactivity, C=Contact */
  riskClassification?: { fire: number; reactivity: number; contact: number };
  /** Density in g/cc — affects particle weight/fall behavior */
  density?: number;
  /** Melting point °C — affects thermal color transitions */
  meltingPoint?: number;
}

const COMPOUNDS: Record<string, ChemicalCompound> = {
  strontium: {
    name: 'Nitrato de Estroncio',
    element: 'Sr',
    color: new THREE.Color(1.0, 0.15, 0.05),
    temperature: 2200,
    emissionIntensity: 4.0,
    burnRate: 2.8,
    sparkSize: 1.2,
    smokeColor: new THREE.Color(0.15, 0.08, 0.06),
    trailDecay: 0.92,
    ignitionTemp: 570,
    density: 2.986,
    meltingPoint: 570,
    combustionProducts: 'SrO + NO2',
    riskClassification: { fire: 1, reactivity: 0, contact: 3 },
    hygroscopicity: 0.06,
  },
  barium: {
    name: 'Nitrato de Bario',
    element: 'Ba',
    color: new THREE.Color(0.1, 1.0, 0.3),
    temperature: 1800,
    emissionIntensity: 3.5,
    burnRate: 2.5,
    sparkSize: 1.0,
    smokeColor: new THREE.Color(0.08, 0.12, 0.06),
    trailDecay: 0.90,
    density: 3.24,
    combustionProducts: 'NO2 + O2',
    riskClassification: { fire: 3, reactivity: 0, contact: 3 },
    hygroscopicity: 0.1,
  },
  copper: {
    name: 'Óxido de Cobre',
    element: 'Cu',
    color: new THREE.Color(0.05, 0.45, 1.0),
    temperature: 1500,
    emissionIntensity: 3.2,
    burnRate: 2.2,
    sparkSize: 0.9,
    smokeColor: new THREE.Color(0.06, 0.08, 0.12),
    trailDecay: 0.88,
    riskClassification: { fire: 2, reactivity: 0, contact: 0 },
  },
  sodium: {
    name: 'Nitrato de Sodio',
    element: 'Na',
    color: new THREE.Color(1.0, 0.85, 0.1),
    temperature: 2100,
    emissionIntensity: 5.0,
    burnRate: 2.0,
    sparkSize: 1.1,
    smokeColor: new THREE.Color(0.12, 0.10, 0.06),
    trailDecay: 0.94,
    density: 2.261,
    meltingPoint: 307,
    combustionProducts: 'Na2O + NO2',
    hygroscopicity: 5.52, // deliquescent — critical humidity 82.7%
  },
  magnesium: {
    name: 'Magnesio Metálico',
    element: 'Mg/Al',
    color: new THREE.Color(1.0, 1.0, 0.95),
    temperature: 3200,
    emissionIntensity: 8.0,
    burnRate: 1.2,
    sparkSize: 1.5,
    smokeColor: new THREE.Color(0.2, 0.2, 0.2),
    trailDecay: 0.96,
    ignitionTemp: 490, // nube de polvo atomizado
    electrostaticSensitivity: 40, // mJ nube de polvo atomizado
    density: 1.74,
    meltingPoint: 650,
    combustionProducts: 'MgO',
    riskClassification: { fire: 1, reactivity: 3, contact: 2 },
    hygroscopicity: 0.62,
  },
  magnalium: {
    name: 'Magnalium (Al 50% + Mg 50%)',
    element: 'Mg/Al',
    color: new THREE.Color(1.0, 1.0, 0.92),
    temperature: 3400,
    emissionIntensity: 9.0,
    burnRate: 1.0,
    sparkSize: 1.6,
    smokeColor: new THREE.Color(0.22, 0.22, 0.22),
    trailDecay: 0.97,
    ignitionTemp: 535,
    electrostaticSensitivity: 80, // nube de polvo
    density: 2.14,
    meltingPoint: 460,
    combustionProducts: 'MgO + Al2O3',
    riskClassification: { fire: 1, reactivity: 3, contact: 2 },
    hygroscopicity: 6.3, // at ~100% RH after 29 days
  },
  titanium: {
    name: 'Titanio Esponja',
    element: 'Ti',
    color: new THREE.Color(1.0, 1.0, 1.0),
    temperature: 3500,
    emissionIntensity: 10.0,
    burnRate: 0.8,
    sparkSize: 2.0,
    smokeColor: new THREE.Color(0.25, 0.25, 0.25),
    trailDecay: 0.98,
    ignitionTemp: 460, // nube de polvo
    electrostaticSensitivity: 25,
    density: 4.5,
    meltingPoint: 1667,
    combustionProducts: 'TiO2',
    riskClassification: { fire: 1, reactivity: 3, contact: 2 },
  },
  iron: {
    name: 'Limaduras de Hierro',
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
    name: 'Carbón Vegetal',
    element: 'C',
    color: new THREE.Color(1.0, 0.55, 0.08),
    temperature: 1800,
    emissionIntensity: 2.5,
    burnRate: 4.0,
    sparkSize: 1.4,
    smokeColor: new THREE.Color(0.1, 0.08, 0.04),
    trailDecay: 0.80,
    charcoalType: 'red',
    sulfurContent: 0,
  },
  zinc: {
    name: 'Limaduras de Zinc',
    element: 'Zn',
    color: new THREE.Color(0.85, 0.9, 1.0), // "luz blanca ligeramente azulada"
    temperature: 1700,
    emissionIntensity: 3.5,
    burnRate: 2.0,
    sparkSize: 1.0,
    smokeColor: new THREE.Color(0.2, 0.2, 0.22),
    trailDecay: 0.88,
    frictionSensitivity: 8,
    sulfurContent: 0,
    density: 7.14,
    meltingPoint: 419,
    riskClassification: { fire: 1, reactivity: 3, contact: 2 },
  },
  antimony: {
    name: 'Trisulfuro de Antimonio',
    element: 'Sb',
    color: new THREE.Color(0.8, 0.85, 1.0), // "llama blancoazulada"
    temperature: 1600,
    emissionIntensity: 3.0,
    burnRate: 2.5,
    sparkSize: 0.9,
    smokeColor: new THREE.Color(0.18, 0.18, 0.2),
    trailDecay: 0.86,
    frictionSensitivity: 3,
    sulfurContent: 0.3,
    density: 4.64,
    meltingPoint: 546,
    riskClassification: { fire: 3, reactivity: 3, contact: 2 },
  },
  calcium: {
    name: 'Carbonato de Calcio',
    element: 'Ca',
    color: new THREE.Color(1.0, 0.45, 0.25), // "rojo claro" — distinct from Sr carmesí
    temperature: 2000,
    emissionIntensity: 3.2,
    burnRate: 2.6,
    sparkSize: 1.1,
    smokeColor: new THREE.Color(0.14, 0.1, 0.08),
    trailDecay: 0.90,
    frictionSensitivity: 7,
    sulfurContent: 0,
    density: 2.71,
    meltingPoint: 825,
    combustionProducts: 'CaO + CO2',
  },
  black_powder: {
    name: 'Pólvora Negra (KNO3 75 + S 12.5 + C 12.5)',
    element: 'KNO3+C+S',
    color: new THREE.Color(1.0, 0.7, 0.2),
    temperature: 1600,
    emissionIntensity: 2.0,
    burnRate: 1.5,
    sparkSize: 0.8,
    smokeColor: new THREE.Color(0.45, 0.40, 0.30), // sulfurous yellow-gray
    trailDecay: 0.75,
    frictionSensitivity: 6,
    sulfurContent: 0.125,
    charcoalType: 'black',
    combustionProducts: 'K2CO3 + K2SO4 + CO2 + N2',
  },
  // ── New compounds from Manual de Pirotecnia (Manejo de Riesgos) ──
  potassium_perchlorate: {
    name: 'Perclorato de Potasio',
    element: 'KClO4',
    color: new THREE.Color(0.9, 0.8, 1.0), // purple-tinged flame
    temperature: 1400,
    emissionIntensity: 1.5,
    burnRate: 1.0,
    sparkSize: 0.6,
    smokeColor: new THREE.Color(0.15, 0.15, 0.15),
    trailDecay: 0.70,
    ignitionTemp: 610,
    density: 2.52,
    meltingPoint: 610,
    combustionProducts: 'KCl + O2',
    riskClassification: { fire: 1, reactivity: 0, contact: 3 },
    hygroscopicity: 0.01,
  },
  potassium_chlorate: {
    name: 'Clorato de Potasio (PELIGROSO)',
    element: 'KClO3',
    color: new THREE.Color(0.85, 0.75, 0.95),
    temperature: 1500,
    emissionIntensity: 2.0,
    burnRate: 0.6, // faster — more dangerous
    sparkSize: 0.7,
    smokeColor: new THREE.Color(0.12, 0.12, 0.12),
    trailDecay: 0.65,
    ignitionTemp: 356,
    density: 2.32,
    meltingPoint: 356,
    combustionProducts: 'KCl + O2',
    riskClassification: { fire: 1, reactivity: 0, contact: 3 },
    hygroscopicity: 0.3,
  },
  aluminum: {
    name: 'Aluminio Pirotécnico',
    element: 'Al',
    color: new THREE.Color(0.95, 0.95, 1.0),
    temperature: 3100,
    emissionIntensity: 7.0,
    burnRate: 1.3,
    sparkSize: 1.4,
    smokeColor: new THREE.Color(0.2, 0.2, 0.2),
    trailDecay: 0.95,
    ignitionTemp: 590,
    electrostaticSensitivity: 50,
    density: 2.7,
    meltingPoint: 660,
    combustionProducts: 'Al2O3',
    riskClassification: { fire: 1, reactivity: 3, contact: 2 },
  },
  sulfur: {
    name: 'Azufre',
    element: 'S',
    color: new THREE.Color(0.6, 0.55, 0.15), // blue flame with sulfurous yellow
    temperature: 1400,
    emissionIntensity: 1.8,
    burnRate: 2.0,
    sparkSize: 0.5,
    smokeColor: new THREE.Color(0.35, 0.30, 0.15), // SO2 yellowish smoke
    trailDecay: 0.72,
    ignitionTemp: 261,
    density: 2.07,
    meltingPoint: 113,
    combustionProducts: 'SO2',
    sulfurContent: 1.0,
  },
  bismuth_subnitrate: {
    name: 'Subnitrato de Bismuto',
    element: 'Bi',
    color: new THREE.Color(0.95, 0.9, 0.75),
    temperature: 1800,
    emissionIntensity: 2.5,
    burnRate: 2.8,
    sparkSize: 1.2,
    smokeColor: new THREE.Color(0.12, 0.11, 0.09),
    trailDecay: 0.83,
    density: 4.928,
    combustionProducts: 'Bi2O3',
  },
  pvc: {
    name: 'Cloruro de Polivinilo (PVC)',
    element: 'PVC',
    color: new THREE.Color(0.5, 0.7, 1.0), // color intensifier for blues
    temperature: 1200,
    emissionIntensity: 1.0,
    burnRate: 3.0,
    sparkSize: 0.4,
    smokeColor: new THREE.Color(0.1, 0.1, 0.1),
    trailDecay: 0.60,
    density: 1.4,
    combustionProducts: 'HCl + CO + CO2',
    riskClassification: { fire: 2, reactivity: 1, contact: 1 },
  },
  nitrocellulose: {
    name: 'Nitrocelulosa (12.6% N)',
    element: 'NC',
    color: new THREE.Color(1.0, 0.95, 0.7),
    temperature: 2200,
    emissionIntensity: 4.0,
    burnRate: 0.3, // extremely fast — burns instantaneously
    sparkSize: 0.6,
    smokeColor: new THREE.Color(0.1, 0.1, 0.1),
    trailDecay: 0.50,
    ignitionTemp: 170,
    density: 1.66,
    combustionProducts: 'CO + CO2 + H2O + N2',
  },

  // ── Skylighter Chemical Encyclopedia Compounds ──────────────────────

  ammonium_perchlorate: {
    name: 'Ammonium Perchlorate',
    element: 'NH4ClO4',
    color: new THREE.Color(1.0, 0.95, 0.85),
    temperature: 2400,
    emissionIntensity: 3.5,
    burnRate: 1.8,
    sparkSize: 0.6,
    smokeColor: new THREE.Color(0.15, 0.15, 0.15),
    trailDecay: 0.60,
    ignitionTemp: 240,
    density: 1.95,
    combustionProducts: 'HCl + H2O + N2 + O2',
    riskClassification: { fire: 1, reactivity: 3, contact: 2 },
  },
  barium_chlorate: {
    name: 'Barium Chlorate',
    element: 'Ba(ClO3)2',
    color: new THREE.Color(0.15, 0.95, 0.35),
    temperature: 1800,
    emissionIntensity: 4.5,
    burnRate: 2.2,
    sparkSize: 0.9,
    smokeColor: new THREE.Color(0.08, 0.12, 0.06),
    trailDecay: 0.88,
    ignitionTemp: 280,
    density: 3.18,
    combustionProducts: 'BaCl + O2',
    riskClassification: { fire: 3, reactivity: 3, contact: 3 },
  },
  barium_carbonate: {
    name: 'Barium Carbonate',
    element: 'BaCO3',
    color: new THREE.Color(0.12, 0.88, 0.30),
    temperature: 1700,
    emissionIntensity: 3.8,
    burnRate: 2.5,
    sparkSize: 0.8,
    smokeColor: new THREE.Color(0.1, 0.12, 0.08),
    trailDecay: 0.90,
    ignitionTemp: 811,
    density: 3.785,
    hygroscopicity: 0,
    riskClassification: { fire: 1, reactivity: 1, contact: 2 },
  },
  barium_sulfate: {
    name: 'Barium Sulfate',
    element: 'BaSO4',
    color: new THREE.Color(0.10, 0.85, 0.28),
    temperature: 1900,
    emissionIntensity: 3.5,
    burnRate: 3.0,
    sparkSize: 0.7,
    smokeColor: new THREE.Color(0.12, 0.12, 0.10),
    trailDecay: 0.85,
    ignitionTemp: 1580,
    density: 4.49,
    riskClassification: { fire: 1, reactivity: 0, contact: 1 },
  },
  copper_chloride: {
    name: 'Copper(I) Chloride',
    element: 'CuCl',
    color: new THREE.Color(0.05, 0.25, 1.0),
    temperature: 1600,
    emissionIntensity: 5.0,
    burnRate: 2.0,
    sparkSize: 0.7,
    smokeColor: new THREE.Color(0.04, 0.06, 0.12),
    trailDecay: 0.87,
    ignitionTemp: 430,
    density: 4.14,
    hygroscopicity: 2.5,
    combustionProducts: 'CuCl+ (emitter)',
    riskClassification: { fire: 1, reactivity: 1, contact: 2 },
  },
  copper_carbonate: {
    name: 'Copper Carbonate',
    element: 'CuCO3',
    color: new THREE.Color(0.06, 0.28, 0.95),
    temperature: 1550,
    emissionIntensity: 4.2,
    burnRate: 2.3,
    sparkSize: 0.8,
    smokeColor: new THREE.Color(0.05, 0.07, 0.10),
    trailDecay: 0.88,
    ignitionTemp: 290,
    density: 3.6,
    riskClassification: { fire: 1, reactivity: 1, contact: 1 },
  },
  strontium_carbonate: {
    name: 'Strontium Carbonate',
    element: 'SrCO3',
    color: new THREE.Color(1.0, 0.08, 0.03),
    temperature: 1900,
    emissionIntensity: 4.5,
    burnRate: 2.4,
    sparkSize: 1.0,
    smokeColor: new THREE.Color(0.14, 0.06, 0.04),
    trailDecay: 0.91,
    ignitionTemp: 1100,
    density: 3.7,
    riskClassification: { fire: 1, reactivity: 0, contact: 1 },
  },
  lithium_carbonate: {
    name: 'Lithium Carbonate',
    element: 'Li2CO3',
    color: new THREE.Color(0.85, 0.10, 0.08),
    temperature: 1700,
    emissionIntensity: 2.5,
    burnRate: 2.6,
    sparkSize: 0.8,
    smokeColor: new THREE.Color(0.12, 0.06, 0.05),
    trailDecay: 0.88,
    ignitionTemp: 723,
    density: 2.11,
    riskClassification: { fire: 0, reactivity: 0, contact: 1 },
  },
  cryolite: {
    name: 'Cryolite (Greenland Spar)',
    element: 'Na3AlF6',
    color: new THREE.Color(1.0, 0.85, 0.10),
    temperature: 1800,
    emissionIntensity: 4.0,
    burnRate: 2.8,
    sparkSize: 0.9,
    smokeColor: new THREE.Color(0.15, 0.12, 0.06),
    trailDecay: 0.86,
    ignitionTemp: 1012,
    density: 2.97,
    hygroscopicity: 0,
    riskClassification: { fire: 0, reactivity: 0, contact: 1 },
  },
  parlon: {
    name: 'Parlon (Chlorinated Isoprene Rubber)',
    element: 'C5H6Cl4',
    color: new THREE.Color(0.3, 0.3, 0.3),
    temperature: 1200,
    emissionIntensity: 1.0,
    burnRate: 3.5,
    sparkSize: 0.3,
    smokeColor: new THREE.Color(0.2, 0.2, 0.2),
    trailDecay: 0.70,
    combustionProducts: 'HCl + CO2 + CO',
    riskClassification: { fire: 1, reactivity: 0, contact: 0 },
  },
  red_gum: {
    name: 'Red Gum (Accroids Resin)',
    element: 'C-H-O resin',
    color: new THREE.Color(0.85, 0.55, 0.15),
    temperature: 1400,
    emissionIntensity: 2.0,
    burnRate: 3.0,
    sparkSize: 0.5,
    smokeColor: new THREE.Color(0.15, 0.12, 0.08),
    trailDecay: 0.75,
    ignitionTemp: 350,
    riskClassification: { fire: 2, reactivity: 0, contact: 0 },
  },
  lampblack: {
    name: 'Lampblack (Carbon)',
    element: 'C',
    color: new THREE.Color(1.0, 0.75, 0.15),
    temperature: 1800,
    emissionIntensity: 2.5,
    burnRate: 4.0,
    sparkSize: 0.4,
    smokeColor: new THREE.Color(0.05, 0.05, 0.04),
    trailDecay: 0.80,
    ignitionTemp: 400,
    density: 1.77,
    riskClassification: { fire: 2, reactivity: 0, contact: 0 },
  },
  iron_filings: {
    name: 'Iron Filings (Linseed-Coated)',
    element: 'Fe',
    color: new THREE.Color(1.0, 0.82, 0.20),
    temperature: 2200,
    emissionIntensity: 3.0,
    burnRate: 3.5,
    sparkSize: 2.0,
    smokeColor: new THREE.Color(0.12, 0.10, 0.08),
    trailDecay: 0.92,
    ignitionTemp: 560,
    density: 7.87,
    riskClassification: { fire: 1, reactivity: 1, contact: 0 },
  },
  magnalium_alloy: {
    name: 'Magnalium (Mg/Al 50:50)',
    element: 'MgAl',
    color: new THREE.Color(1.0, 1.0, 0.95),
    temperature: 2800,
    emissionIntensity: 6.0,
    burnRate: 1.5,
    sparkSize: 1.2,
    smokeColor: new THREE.Color(0.2, 0.2, 0.2),
    trailDecay: 0.88,
    ignitionTemp: 430,
    density: 2.0,
    riskClassification: { fire: 3, reactivity: 2, contact: 1 },
  },
  dextrin_binder: {
    name: 'Dextrin',
    element: '(C6H10O5)n',
    color: new THREE.Color(0.5, 0.4, 0.2),
    temperature: 1000,
    emissionIntensity: 0.5,
    burnRate: 4.0,
    sparkSize: 0.1,
    smokeColor: new THREE.Color(0.1, 0.1, 0.08),
    trailDecay: 0.60,
    ignitionTemp: 250,
    density: 1.5,
    riskClassification: { fire: 1, reactivity: 0, contact: 0 },
  },
  // ── Historical Compounds (Kurt Saxon / Pyrotechny 1829 / Anderson 1696) ──

  malachite: {
    name: 'Malachite (Copper Carbonate Hydroxide)',
    element: 'Cu2(CO3)(OH)2',
    color: new THREE.Color(0.10, 0.85, 0.35),
    temperature: 1550,
    emissionIntensity: 3.5,
    burnRate: 2.8,
    sparkSize: 0.7,
    smokeColor: new THREE.Color(0.06, 0.10, 0.06),
    trailDecay: 0.88,
    ignitionTemp: 300,
    density: 3.8,
    combustionProducts: 'CuO + CO2 + H2O',
    riskClassification: { fire: 1, reactivity: 1, contact: 1 },
  },
  calomel: {
    name: 'Calomel (HISTORICAL — TOXIC, Obsolete)',
    element: 'Hg2Cl2',
    color: new THREE.Color(0.9, 0.9, 0.95),
    temperature: 1400,
    emissionIntensity: 2.0,
    burnRate: 2.5,
    sparkSize: 0.5,
    smokeColor: new THREE.Color(0.2, 0.2, 0.2),
    trailDecay: 0.70,
    ignitionTemp: 383,
    density: 7.15,
    meltingPoint: 383,
    combustionProducts: 'HgCl + Cl (chlorine donor)',
    riskClassification: { fire: 2, reactivity: 2, contact: 4 },
  },
};

// ── Veline Color Mixing System ──────────────────────────────────────
// Public domain color-blending ratios from Skylighter reference.
// Maps composite display colors to weighted blends of primary flame colors.

export const VELINE_COLOR_MIXING: Record<string, Record<string, number>> = {
  yellow:     { green: 0.55, orange: 0.45 },
  chartreuse: { green: 0.80, orange: 0.20 },
  aqua:       { green: 0.80, blue: 0.20 },
  turquoise:  { green: 0.55, blue: 0.45 },
  magenta:    { red: 0.50, blue: 0.50 },
  purple:     { orange: 0.05, red: 0.15, blue: 0.80 },
  peach:      { orange: 0.60, red: 0.25, blue: 0.15 },
  maroon:     { red: 0.85, blue: 0.15 },
};

const VELINE_PRIMARY_COLORS: Record<string, THREE.Color> = {
  red:    new THREE.Color(1.0, 0.08, 0.03),   // SrCO3
  green:  new THREE.Color(0.12, 0.95, 0.30),   // BaCO3
  blue:   new THREE.Color(0.05, 0.25, 1.0),    // CuCl
  orange: new THREE.Color(1.0, 0.55, 0.05),    // Ca compound
};

/** Blend a Veline composite color from primary flame colors */
export function getVelineCompositeColor(name: string): THREE.Color {
  const mix = VELINE_COLOR_MIXING[name];
  if (!mix) return new THREE.Color(1, 1, 1);
  const result = new THREE.Color(0, 0, 0);
  for (const [primary, weight] of Object.entries(mix)) {
    const pc = VELINE_PRIMARY_COLORS[primary];
    if (pc) {
      result.r += pc.r * weight;
      result.g += pc.g * weight;
      result.b += pc.b * weight;
    }
  }
  return result;
}

// ── Dangerous Combinations (Safety Table) ───────────────────────────

export interface DangerousCombination {
  chemicals: [string, string];
  hazard: string;
  severity: 'critical' | 'high' | 'moderate';
}

export const DANGEROUS_COMBINATIONS: DangerousCombination[] = [
  { chemicals: ['KClO3', 'S'], hazard: 'Spontaneous ignition — sulfuric acid forms ClO2 gas', severity: 'critical' },
  { chemicals: ['KClO3', 'Sb2S3'], hazard: 'Spontaneous ignition — extremely friction-sensitive', severity: 'critical' },
  { chemicals: ['KClO3', 'Al'], hazard: 'Extremely sensitive to friction and shock', severity: 'high' },
  { chemicals: ['KClO3', 'Mg'], hazard: 'Extremely sensitive to friction and shock', severity: 'high' },
  { chemicals: ['NH4NO3', 'KClO3'], hazard: 'Forms ammonium chlorate — explosive, spontaneous ignition', severity: 'critical' },
  { chemicals: ['NH4NO3', 'Al'], hazard: 'Exothermic amide reaction when wet — spontaneous ignition', severity: 'high' },
  { chemicals: ['Ba(ClO3)2', 'S'], hazard: 'Spontaneous ignition — more sensitive than KClO3 mixtures', severity: 'critical' },
  { chemicals: ['Ba(ClO3)2', 'Sb2S3'], hazard: 'Spontaneous ignition', severity: 'critical' },
  { chemicals: ['P_red', 'KClO3'], hazard: 'Explosive on contact — Armstrong mixture', severity: 'critical' },
];

/** Check if two chemicals form a dangerous combination */
export function checkDangerousCombination(chem1: string, chem2: string): DangerousCombination | undefined {
  return DANGEROUS_COMBINATIONS.find(dc =>
    (dc.chemicals[0] === chem1 && dc.chemicals[1] === chem2) ||
    (dc.chemicals[0] === chem2 && dc.chemicals[1] === chem1)
  );
}

// ── Black Powder Grades ─────────────────────────────────────────────

export interface BPGrade {
  name: string;
  grainSizeMm: number;
  burnRateModifier: number;
  use: string;
}

export const BLACK_POWDER_GRADES: Record<string, BPGrade> = {
  cannon:  { name: 'Cannon Grade', grainSizeMm: 4.76, burnRateModifier: 1.0, use: 'Standard lift charge' },
  '4fa':   { name: '4FA',          grainSizeMm: 1.68, burnRateModifier: 1.3, use: 'Fine burst charge' },
  meal_d:  { name: 'Meal D',       grainSizeMm: 0.42, burnRateModifier: 2.0, use: 'Priming, fast ignition' },
  '5fg':   { name: '5FG',          grainSizeMm: 0.149, burnRateModifier: 3.0, use: 'Finest — nearly instantaneous' },
};

/** Get burn rate modifier for a given BP grade */
export function getBPBurnRateModifier(grade: string): number {
  return BLACK_POWDER_GRADES[grade]?.burnRateModifier ?? 1.0;
}

/**
 * Thermal color transition: white-hot → compound color → ember → dark
 * Enhanced with ignition temperature influence from manual data
 */
export function thermalColor(compound: ChemicalCompound, lifeRatio: number, hdrMult: number): THREE.Color {
  const c = compound.color.clone();
  
  // Factor in ignition temperature — higher ignition = longer white-hot phase
  const ignitionFactor = compound.ignitionTemp 
    ? Math.min(1.5, compound.ignitionTemp / 500) 
    : 1.0;
  const whiteHotThreshold = 0.85 + (ignitionFactor - 1) * 0.05;
  
  if (lifeRatio > whiteHotThreshold) {
    // White-hot ignition core — intensity modulated by compound temperature
    c.lerp(new THREE.Color(1, 1, 0.95), (lifeRatio - whiteHotThreshold) / (1 - whiteHotThreshold));
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

/**
 * Get smoke color modulated by sulfur content from manual
 * More sulfur = more yellow-gray smoke (SO2 residue)
 */
export function getSulfurModulatedSmokeColor(compound: ChemicalCompound): THREE.Color {
  const base = compound.smokeColor.clone();
  const sulfur = compound.sulfurContent ?? 0;
  if (sulfur > 0) {
    // Blend toward sulfurous yellow-gray
    const sulfurSmoke = new THREE.Color(0.45, 0.40, 0.25);
    base.lerp(sulfurSmoke, Math.min(1, sulfur * 2));
  }
  return base;
}

/**
 * Get burn rate modifier based on electrostatic sensitivity
 * Lower sensitivity value = more sensitive = faster initial ignition ramp
 */
export function getIgnitionRampSpeed(compound: ChemicalCompound): number {
  if (!compound.electrostaticSensitivity) return 1.0;
  // Lower mJ = faster ignition ramp (more sensitive)
  return Math.max(0.5, Math.min(3.0, 100 / compound.electrostaticSensitivity));
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
  // ── Manual-derived compositions ──
  'trueno_seguro': {
    name: 'Trueno Seguro (KClO4 70% + Al Negro 30%)',
    productType: 'shell',
    caliber: '3"',
    compounds: [
      { element: 'KClO4', percentage: 70 },
      { element: 'Al', percentage: 30 },
    ],
    resultColor: new THREE.Color(1.0, 1.0, 0.95),
    temperature: 3000,
    emissionIntensity: 9.0,
    burnRate: 0.3,
    sparkSize: 0.5,
    smokeColor: new THREE.Color(0.2, 0.2, 0.2),
    trailDecay: 0.50,
    crackle: false,
  },
  'green_star_bano3': {
    name: 'Estrella Verde (Ba(NO3)2 + Mg/Al)',
    productType: 'shell',
    caliber: '3"',
    compounds: [
      { element: 'Ba', percentage: 45 },
      { element: 'KClO4', percentage: 25 },
      { element: 'Mg/Al', percentage: 12 },
      { element: 'PVC', percentage: 8 },
      { element: 'Shellac', percentage: 5 },
    ],
    resultColor: new THREE.Color(0.08, 0.95, 0.25),
    temperature: 1900,
    emissionIntensity: 4.0,
    burnRate: 2.5,
    sparkSize: 1.0,
    smokeColor: new THREE.Color(0.08, 0.1, 0.06),
    trailDecay: 0.90,
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
  'Ti': [{ wavelength: 400, intensity: 0.3 }, { wavelength: 500, intensity: 0.5 }, { wavelength: 600, intensity: 0.5 }, { wavelength: 700, intensity: 0.3 }],
  'Mg/Al': [{ wavelength: 500, intensity: 0.9 }, { wavelength: 520, intensity: 1.0 }],
  'Al': [{ wavelength: 490, intensity: 0.8 }, { wavelength: 520, intensity: 0.6 }],
  'Al/Mg': [{ wavelength: 500, intensity: 0.9 }, { wavelength: 520, intensity: 1.0 }],
  'Bi': [{ wavelength: 560, intensity: 0.6 }, { wavelength: 600, intensity: 0.5 }],
  'Bi2O3': [{ wavelength: 560, intensity: 0.6 }, { wavelength: 590, intensity: 0.5 }],
  'C': [{ wavelength: 590, intensity: 0.7 }, { wavelength: 620, intensity: 0.9 }],
  'S': [{ wavelength: 580, intensity: 0.5 }],
  'Zn': [{ wavelength: 470, intensity: 0.7 }, { wavelength: 510, intensity: 0.5 }],
  'Sb': [{ wavelength: 465, intensity: 0.6 }, { wavelength: 500, intensity: 0.5 }],
  'Ca': [{ wavelength: 622, intensity: 0.9 }, { wavelength: 553, intensity: 0.4 }],
  'KNO3+C+S': [{ wavelength: 590, intensity: 0.6 }, { wavelength: 620, intensity: 0.4 }],
  'KClO4': [],
  'KClO3': [],
  'KNO3': [],
  'LAC': [{ wavelength: 470, intensity: 0.9 }],
  'PVC': [],
  'Shellac': [],
  'Dextrin': [],
  'Sb2S3': [{ wavelength: 560, intensity: 0.4 }],
  'NC': [],
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
