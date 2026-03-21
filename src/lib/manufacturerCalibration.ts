/**
 * ═══════════════════════════════════════════════════════════════════════
 * Manufacturer Calibration Profiles
 * ═══════════════════════════════════════════════════════════════════════
 * 
 * Per-caliber lookup tables for height, spread, prefire, star count,
 * break speed, and safety distance — calibrated per firing system / 
 * shell manufacturer.
 */

export interface CaliberData {
  heightM: number;       // break height in meters
  spreadDeg: number;     // burst spread angle
  prefireSec: number;    // lift time (seconds)
  starCount: number;     // stars at burst
  breakSpeed: number;    // m/s initial star velocity
  safetyM: number;       // NFPA 1123 safety distance (meters)
  costFactor: number;    // relative cost multiplier
}

export interface ManufacturerProfile {
  id: string;
  name: string;
  country: string;
  description: string;
  icon: string;
  calibers: Record<number, CaliberData>; // key = caliber in inches
}

// ── Finale 3D defaults (reference baseline) ─────────────────────────
// Sub-2" calibers added per Finale manual (30mm single shots, 20mm cakes)
const FINALE_CALIBERS: Record<number, CaliberData> = {
  1:    { heightM: 15,  spreadDeg: 16, prefireSec: 0.35, starCount: 30,  breakSpeed: 10, safetyM: 40,  costFactor: 0.3 },
  1.5:  { heightM: 25,  spreadDeg: 24, prefireSec: 0.55, starCount: 55,  breakSpeed: 14, safetyM: 40,  costFactor: 0.5 },
  2:    { heightM: 35,  spreadDeg: 32, prefireSec: 0.75, starCount: 80,  breakSpeed: 18, safetyM: 40,  costFactor: 1.0 },
  2.5:  { heightM: 45,  spreadDeg: 38, prefireSec: 0.95, starCount: 115, breakSpeed: 23, safetyM: 70,  costFactor: 2.0 },
  3:    { heightM: 55,  spreadDeg: 45, prefireSec: 1.15, starCount: 150, breakSpeed: 28, safetyM: 70,  costFactor: 3.5 },
  4:    { heightM: 80,  spreadDeg: 55, prefireSec: 1.55, starCount: 250, breakSpeed: 38, safetyM: 100, costFactor: 8.0 },
  5:    { heightM: 110, spreadDeg: 65, prefireSec: 1.95, starCount: 350, breakSpeed: 48, safetyM: 140, costFactor: 15.0 },
  6:    { heightM: 140, spreadDeg: 75, prefireSec: 2.40, starCount: 500, breakSpeed: 58, safetyM: 175, costFactor: 25.0 },
  8:    { heightM: 190, spreadDeg: 90, prefireSec: 3.10, starCount: 700, breakSpeed: 72, safetyM: 210, costFactor: 50.0 },
  10:   { heightM: 240, spreadDeg: 105, prefireSec: 3.80, starCount: 900, breakSpeed: 85, safetyM: 280, costFactor: 90.0 },
  12:   { heightM: 280, spreadDeg: 120, prefireSec: 4.50, starCount: 1100, breakSpeed: 95, safetyM: 300, costFactor: 150.0 },
};

// ── Cobra Firing Systems — US market, +5-8% height/speed over Finale ──
const COBRA_CALIBERS: Record<number, CaliberData> = {
  1:    { heightM: 16,  spreadDeg: 18, prefireSec: 0.32, starCount: 34,  breakSpeed: 11, safetyM: 40,  costFactor: 0.4 },
  1.5:  { heightM: 27,  spreadDeg: 26, prefireSec: 0.50, starCount: 60,  breakSpeed: 15, safetyM: 40,  costFactor: 0.6 },
  2:    { heightM: 38,  spreadDeg: 35, prefireSec: 0.70, starCount: 90,  breakSpeed: 20, safetyM: 40,  costFactor: 1.2 },
  2.5:  { heightM: 48,  spreadDeg: 40, prefireSec: 0.90, starCount: 125, breakSpeed: 25, safetyM: 70,  costFactor: 2.5 },
  3:    { heightM: 60,  spreadDeg: 48, prefireSec: 1.10, starCount: 165, breakSpeed: 30, safetyM: 70,  costFactor: 4.0 },
  4:    { heightM: 85,  spreadDeg: 58, prefireSec: 1.50, starCount: 270, breakSpeed: 41, safetyM: 100, costFactor: 9.0 },
  5:    { heightM: 118, spreadDeg: 68, prefireSec: 1.90, starCount: 380, breakSpeed: 52, safetyM: 140, costFactor: 17.0 },
  6:    { heightM: 150, spreadDeg: 80, prefireSec: 2.35, starCount: 540, breakSpeed: 62, safetyM: 175, costFactor: 28.0 },
  8:    { heightM: 205, spreadDeg: 95, prefireSec: 3.05, starCount: 760, breakSpeed: 78, safetyM: 210, costFactor: 55.0 },
  10:   { heightM: 255, spreadDeg: 110, prefireSec: 3.70, starCount: 970, breakSpeed: 90, safetyM: 280, costFactor: 100.0 },
  12:   { heightM: 300, spreadDeg: 125, prefireSec: 4.40, starCount: 1200, breakSpeed: 102, safetyM: 300, costFactor: 165.0 },
};

// ── Pyrodigital — European precision, -5% height, tighter prefire ──
const PYRODIGITAL_CALIBERS: Record<number, CaliberData> = {
  1:    { heightM: 14,  spreadDeg: 15, prefireSec: 0.40, starCount: 28,  breakSpeed: 9,  safetyM: 40,  costFactor: 0.35 },
  1.5:  { heightM: 23,  spreadDeg: 22, prefireSec: 0.60, starCount: 50,  breakSpeed: 13, safetyM: 40,  costFactor: 0.55 },
  2:    { heightM: 33,  spreadDeg: 30, prefireSec: 0.80, starCount: 75,  breakSpeed: 17, safetyM: 40,  costFactor: 1.0 },
  2.5:  { heightM: 42,  spreadDeg: 36, prefireSec: 1.00, starCount: 108, breakSpeed: 22, safetyM: 70,  costFactor: 1.8 },
  3:    { heightM: 52,  spreadDeg: 42, prefireSec: 1.20, starCount: 140, breakSpeed: 26, safetyM: 70,  costFactor: 3.2 },
  4:    { heightM: 76,  spreadDeg: 52, prefireSec: 1.60, starCount: 235, breakSpeed: 36, safetyM: 100, costFactor: 7.5 },
  5:    { heightM: 105, spreadDeg: 62, prefireSec: 2.00, starCount: 330, breakSpeed: 45, safetyM: 140, costFactor: 14.0 },
  6:    { heightM: 132, spreadDeg: 72, prefireSec: 2.45, starCount: 470, breakSpeed: 55, safetyM: 175, costFactor: 23.0 },
  8:    { heightM: 180, spreadDeg: 85, prefireSec: 3.15, starCount: 660, breakSpeed: 68, safetyM: 210, costFactor: 48.0 },
  10:   { heightM: 228, spreadDeg: 100, prefireSec: 3.90, starCount: 850, breakSpeed: 80, safetyM: 280, costFactor: 85.0 },
  12:   { heightM: 265, spreadDeg: 115, prefireSec: 4.60, starCount: 1050, breakSpeed: 90, safetyM: 300, costFactor: 140.0 },
};

// ── FireOne XLII+ — calibrated from FireOne manual and UltraFire specs ──
const FIREONE_CALIBERS: Record<number, CaliberData> = {
  1:    { heightM: 14,  spreadDeg: 15, prefireSec: 0.38, starCount: 28,  breakSpeed: 9,  safetyM: 40,  costFactor: 0.35 },
  1.5:  { heightM: 24,  spreadDeg: 23, prefireSec: 0.58, starCount: 52,  breakSpeed: 13, safetyM: 40,  costFactor: 0.55 },
  2:    { heightM: 34,  spreadDeg: 31, prefireSec: 0.78, starCount: 78,  breakSpeed: 17, safetyM: 40,  costFactor: 1.1 },
  2.5:  { heightM: 44,  spreadDeg: 37, prefireSec: 0.98, starCount: 112, breakSpeed: 22, safetyM: 70,  costFactor: 2.2 },
  3:    { heightM: 54,  spreadDeg: 44, prefireSec: 1.18, starCount: 145, breakSpeed: 27, safetyM: 70,  costFactor: 3.8 },
  4:    { heightM: 78,  spreadDeg: 54, prefireSec: 1.58, starCount: 245, breakSpeed: 37, safetyM: 100, costFactor: 8.5 },
  5:    { heightM: 108, spreadDeg: 64, prefireSec: 1.98, starCount: 340, breakSpeed: 47, safetyM: 140, costFactor: 16.0 },
  6:    { heightM: 138, spreadDeg: 74, prefireSec: 2.42, starCount: 490, breakSpeed: 57, safetyM: 175, costFactor: 26.0 },
  8:    { heightM: 188, spreadDeg: 88, prefireSec: 3.12, starCount: 680, breakSpeed: 70, safetyM: 210, costFactor: 52.0 },
  10:   { heightM: 238, spreadDeg: 103, prefireSec: 3.82, starCount: 880, breakSpeed: 83, safetyM: 280, costFactor: 92.0 },
  12:   { heightM: 275, spreadDeg: 118, prefireSec: 4.52, starCount: 1080, breakSpeed: 93, safetyM: 300, costFactor: 155.0 },
};

// ── All built-in profiles ──
export const MANUFACTURER_PROFILES: ManufacturerProfile[] = [
  {
    id: 'finale',
    name: 'Finale 3D',
    country: 'US',
    description: 'Valores padrão do Finale 3D — referência da indústria para simulação pirotécnica',
    icon: '🎆',
    calibers: FINALE_CALIBERS,
  },
  {
    id: 'cobra',
    name: 'Cobra',
    country: 'US',
    description: 'Cobra Firing Systems — performance ligeiramente superior, prefire rápido, ideal para shows sincronizados',
    icon: '🐍',
    calibers: COBRA_CALIBERS,
  },
  {
    id: 'pyrodigital',
    name: 'Pyrodigital',
    country: 'EU',
    description: 'Pyrodigital — precisão europeia, spread controlado, prefire consistente, excelente para coreografia fina',
    icon: '⚡',
    calibers: PYRODIGITAL_CALIBERS,
  },
  {
    id: 'fireone',
    name: 'FireOne',
    country: 'US',
    description: 'FireOne XLII+ — sistema profissional com suporte SCL e UltraFire, calibrado para precisão de timing',
    icon: '🔥',
    calibers: FIREONE_CALIBERS,
  },
];

/**
 * Interpolate caliber data for non-standard calibers (e.g. 3.5")
 */
export function interpolateCaliberData(profile: ManufacturerProfile, caliberInches: number): CaliberData {
  const keys = Object.keys(profile.calibers).map(Number).sort((a, b) => a - b);
  
  if (caliberInches <= keys[0]) return profile.calibers[keys[0]];
  if (caliberInches >= keys[keys.length - 1]) return profile.calibers[keys[keys.length - 1]];
  
  // Exact match
  if (profile.calibers[caliberInches]) return profile.calibers[caliberInches];
  
  // Interpolate
  for (let i = 0; i < keys.length - 1; i++) {
    if (caliberInches >= keys[i] && caliberInches <= keys[i + 1]) {
      const t = (caliberInches - keys[i]) / (keys[i + 1] - keys[i]);
      const a = profile.calibers[keys[i]];
      const b = profile.calibers[keys[i + 1]];
      return {
        heightM: Math.round(a.heightM * (1 - t) + b.heightM * t),
        spreadDeg: Math.round(a.spreadDeg * (1 - t) + b.spreadDeg * t),
        prefireSec: Math.round((a.prefireSec * (1 - t) + b.prefireSec * t) * 100) / 100,
        starCount: Math.round(a.starCount * (1 - t) + b.starCount * t),
        breakSpeed: Math.round((a.breakSpeed * (1 - t) + b.breakSpeed * t) * 10) / 10,
        safetyM: Math.round(a.safetyM * (1 - t) + b.safetyM * t),
        costFactor: Math.round((a.costFactor * (1 - t) + b.costFactor * t) * 10) / 10,
      };
    }
  }
  return profile.calibers[3]; // fallback
}

/**
 * Custom user profiles stored in-memory (would persist to Supabase in production)
 */
export type CustomProfile = ManufacturerProfile & { isCustom: true };

export function createCustomProfile(name: string, basedOn: string): CustomProfile {
  const base = MANUFACTURER_PROFILES.find(p => p.id === basedOn) || MANUFACTURER_PROFILES[0];
  return {
    id: `custom-${Date.now()}`,
    name,
    country: 'Custom',
    description: `Perfil customizado baseado em ${base.name}`,
    icon: '🔧',
    calibers: JSON.parse(JSON.stringify(base.calibers)),
    isCustom: true as const,
  };
}

/** Standard caliber sizes for display */
export const STANDARD_CALIBERS = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10, 12];

/** Get caliber display label */
export function caliberLabel(cal: number): string {
  return cal < 2 ? `${cal}"` : `${cal}" (${Math.round(cal * 25.4)}mm)`;
}
