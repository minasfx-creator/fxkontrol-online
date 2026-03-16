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
// Aligned with pyroPhysics.ts real-world ballistic tables:
//   breakSpeed = BREAK_SPEED table, starCount = STAR_COUNT table,
//   heightM = BREAK_HEIGHT table, prefireSec = getLiftTime()
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

// ── Cobra Firing Systems — US market, slightly higher performance ──
const COBRA_CALIBERS: Record<number, CaliberData> = {
  1:    { heightM: 22,  spreadDeg: 24, prefireSec: 0.45, starCount: 22,  breakSpeed: 11, safetyM: 40,  costFactor: 0.4 },
  1.5:  { heightM: 30,  spreadDeg: 30, prefireSec: 0.65, starCount: 38,  breakSpeed: 13, safetyM: 40,  costFactor: 0.6 },
  2:    { heightM: 38,  spreadDeg: 35, prefireSec: 0.85, starCount: 55,  breakSpeed: 14, safetyM: 40,  costFactor: 1.2 },
  2.5:  { heightM: 48,  spreadDeg: 40, prefireSec: 1.05, starCount: 75,  breakSpeed: 15, safetyM: 70,  costFactor: 2.5 },
  3:    { heightM: 60,  spreadDeg: 48, prefireSec: 1.25, starCount: 110, breakSpeed: 17, safetyM: 70,  costFactor: 4.0 },
  4:    { heightM: 85,  spreadDeg: 58, prefireSec: 1.7,  starCount: 180, breakSpeed: 19, safetyM: 100, costFactor: 9.0 },
  5:    { heightM: 115, spreadDeg: 68, prefireSec: 2.2,  starCount: 260, breakSpeed: 21, safetyM: 140, costFactor: 17.0 },
  6:    { heightM: 148, spreadDeg: 80, prefireSec: 2.7,  starCount: 370, breakSpeed: 23, safetyM: 175, costFactor: 28.0 },
  8:    { heightM: 200, spreadDeg: 95, prefireSec: 3.4,  starCount: 550, breakSpeed: 25, safetyM: 210, costFactor: 55.0 },
  10:   { heightM: 250, spreadDeg: 110, prefireSec: 4.0, starCount: 750, breakSpeed: 27, safetyM: 280, costFactor: 100.0 },
  12:   { heightM: 290, spreadDeg: 125, prefireSec: 4.8, starCount: 950, breakSpeed: 29, safetyM: 300, costFactor: 165.0 },
};

// ── Pyrodigital — European precision, tighter prefire, consistent spread ──
const PYRODIGITAL_CALIBERS: Record<number, CaliberData> = {
  1:    { heightM: 18,  spreadDeg: 20, prefireSec: 0.55, starCount: 18,  breakSpeed: 9,  safetyM: 40,  costFactor: 0.35 },
  1.5:  { heightM: 26,  spreadDeg: 26, prefireSec: 0.75, starCount: 32,  breakSpeed: 11, safetyM: 40,  costFactor: 0.55 },
  2:    { heightM: 33,  spreadDeg: 30, prefireSec: 0.95, starCount: 48,  breakSpeed: 12, safetyM: 40,  costFactor: 1.0 },
  2.5:  { heightM: 43,  spreadDeg: 36, prefireSec: 1.15, starCount: 65,  breakSpeed: 13, safetyM: 70,  costFactor: 1.8 },
  3:    { heightM: 52,  spreadDeg: 42, prefireSec: 1.35, starCount: 95,  breakSpeed: 15, safetyM: 70,  costFactor: 3.2 },
  4:    { heightM: 76,  spreadDeg: 52, prefireSec: 1.85, starCount: 150, breakSpeed: 17, safetyM: 100, costFactor: 7.5 },
  5:    { heightM: 105, spreadDeg: 62, prefireSec: 2.35, starCount: 220, breakSpeed: 19, safetyM: 140, costFactor: 14.0 },
  6:    { heightM: 135, spreadDeg: 72, prefireSec: 2.85, starCount: 320, breakSpeed: 21, safetyM: 175, costFactor: 23.0 },
  8:    { heightM: 185, spreadDeg: 88, prefireSec: 3.6,  starCount: 480, breakSpeed: 23, safetyM: 210, costFactor: 48.0 },
  10:   { heightM: 235, spreadDeg: 100, prefireSec: 4.3, starCount: 680, breakSpeed: 25, safetyM: 280, costFactor: 85.0 },
  12:   { heightM: 275, spreadDeg: 115, prefireSec: 5.1, starCount: 880, breakSpeed: 27, safetyM: 300, costFactor: 140.0 },
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
