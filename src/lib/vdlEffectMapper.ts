/**
 * ═══════════════════════════════════════════════════════════════════════
 * VDL Effect Mapper — Ponte entre VDL parser e física do PyroSimCore
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Converte um VDLResult numa especificação física pronta para
 * `pyroSimCore.createEvent()`, aplicando overrides de:
 *   - família base (peony/willow/kamuro/etc)
 *   - caliber (escala energia, velocidade, massa)
 *   - modificadores (Strobe, Crackle, Glitter, Tip, No Trail)
 *   - cor RGB (substitui colorR/G/B do spawn)
 *   - ângulo (R/L) → tilt do burst
 *
 * Centraliza a "interpretação realista" do VDL para que tanto o JOI
 * quanto importadores manuais usem a MESMA tradução.
 */

import { parseVDL, type VDLResult } from './vdlParser';
import { rgbToNearestVdl } from './vdlQuantizer';
import type { EffectFamilyProfile } from '@/core/pyrosim/CalibrationLayer';

export interface VDLEffectSpec {
  /** Família base no CalibrationLayer */
  familyName: string;
  /** Cor primária do efeito em RGB normalizado 0-1 */
  color: { r: number; g: number; b: number };
  /** Cor secundária (transição "to" / pistil) — opcional */
  colorSecondary?: { r: number; g: number; b: number };
  /** Caliber em mm (afeta energia/altura) */
  caliberMM: number;
  /** Tilt em radianos relativo à vertical (R = +, L = −) */
  tiltRad: number;
  /** Heading em radianos (rotação no plano horizontal) */
  headingRad: number;
  /** Modificadores ativos */
  modifiers: {
    strobe: boolean;
    crackle: boolean;
    glitter: boolean;
    pistil: boolean;
    noTrail: boolean;
    forceTrail: boolean; // Tip on non-trail color
    twinkle: boolean;
    report: boolean;
    splitStars: boolean;
  };
  /** Overrides físicos calculados (aplicáveis em createEvent overrides) */
  physicsOverrides: Partial<EffectFamilyProfile>;
  /** Trail type derivado */
  trailType: VDLResult['trailType'];
  /** VDL textual original e parsed completo (para debug/JOI explain) */
  raw: string;
  parsed: VDLResult;
}

// Mapeia typeName VDL → familyName CalibrationLayer
const TYPE_TO_FAMILY: Record<string, string> = {
  'peony': 'peony',
  'chrysanthemum': 'chrysanthemum',
  'willow': 'willow',
  'palm': 'willow',          // palm não existe — usa willow (droop alto)
  'coconut palm': 'willow',
  'brocade crown': 'brocade',
  'brocade': 'brocade',
  'kamuro': 'kamuro',
  'horsetail': 'willow',
  'salute': 'salute',
  'crossette': 'peony',
  'ring': 'peony',
  'dahlia': 'peony',
  'ghost shell': 'peony',
  'shell': 'peony',
};

function resolveFamily(typeName: string): string {
  return TYPE_TO_FAMILY[typeName.toLowerCase()] || 'peony';
}

function vdlColorToRgb(name: string): { r: number; g: number; b: number } {
  // Reusa quantizer (faz lookup no palette)
  const m = rgbToNearestVdl(255, 255, 255); // dummy seed
  // melhor: ler palette diretamente
  const lower = name.toLowerCase();
  // simple inline palette mirror (subset comum)
  const palette: Record<string, [number, number, number]> = {
    red: [0.95, 0.10, 0.10],
    blue: [0.30, 0.40, 1.00],
    green: [0.15, 0.70, 0.11],
    gold: [0.80, 0.70, 0.05],
    silver: [0.75, 0.75, 0.85],
    white: [0.95, 0.95, 0.98],
    purple: [0.75, 0.25, 1.00],
    orange: [0.90, 0.40, 0.10],
    yellow: [0.80, 0.70, 0.05],
    pink: [0.85, 0.35, 0.75],
    cyan: [0.32, 0.64, 0.80],
    magenta: [0.80, 0.10, 1.00],
    aqua: [0.20, 0.50, 0.80],
    lime: [0.35, 0.70, 0.11],
    fuchsia: [0.85, 0.35, 0.90],
    indigo: [0.50, 0.25, 1.00],
    lavender: [0.63, 0.25, 1.00],
    lemon: [0.75, 0.60, 0.05],
    ruby: [0.95, 0.10, 0.30],
    plum: [0.70, 0.10, 0.50],
    peach: [0.80, 0.50, 0.10],
    violet: [0.80, 0.40, 1.00],
    turquoise: [0.16, 0.64, 0.80],
    'sea blue': [0.25, 0.50, 1.00],
    'sky blue': [0.20, 0.50, 0.80],
    'grass green': [0.25, 0.70, 0.05],
    charcoal: [0.20, 0.10, 0.05],
    dark: [0.0, 0.0, 0.0],
    gamboge: [1.0, 0.35, 0.05],
  };
  const c = palette[lower] ?? [1.0, 0.95, 0.7];
  void m;
  return { r: c[0], g: c[1], b: c[2] };
}

/**
 * Computa overrides físicos derivados de modificadores e caliber.
 * - caliber escala energy^(2/3) (lei de cubo) e burstVelocity^(1/3)
 * - strobe: aumenta flickerIntensity
 * - crackle: aumenta turbulenceFactor + emberPersistence
 * - glitter: aumenta starCount e emberPersistence
 * - noTrail: trailLength → 0
 * - report: salute-like flash burst adicional (flashIntensity boost)
 */
// Range industrial real de pyro shells (mm). Fora disso, satura.
// Mínimo 25mm = menor cake comercial; 450mm = recorde mundial (Steel Beach 1988).
const CALIBER_MIN_MM = 25;
const CALIBER_MAX_MM = 450;

function clampCaliber(mm: number): number {
  if (!Number.isFinite(mm) || mm <= 0) return CALIBER_MIN_MM;
  return Math.max(CALIBER_MIN_MM, Math.min(CALIBER_MAX_MM, Math.abs(mm)));
}

function computePhysicsOverrides(parsed: VDLResult): Partial<EffectFamilyProfile> {
  const overrides: Partial<EffectFamilyProfile> = {};

  // Caliber scaling — base = 75mm. Saturação garante físicos sem NaN/explosão.
  const safeCaliber = clampCaliber(parsed.caliberMM);
  const caliberRatio = safeCaliber / 75;
  const energyScale = Math.pow(caliberRatio, 2.5); // shells maiores = bem mais energia
  const velocityScale = Math.pow(caliberRatio, 0.4); // velocidade cresce devagar
  const massScale = Math.pow(caliberRatio, 1.2);

  overrides.energyTotal = energyScale;
  overrides.burstVelocity = 45 * velocityScale; // base peony 45 m/s
  overrides.particleMass = 0.003 * massScale;
  // starCount sempre ≥ 24 (mínimo visualmente coerente p/ um shell)
  const baseStars = Number.isFinite(parsed.starCount) && parsed.starCount > 0 ? parsed.starCount : 150;
  overrides.starCount = Math.max(24, Math.round(baseStars * Math.max(0.5, caliberRatio * 0.85)));

  // Modifiers
  const mods = parsed.modifiers.map(m => m.toLowerCase());
  if (mods.includes('strobe') || mods.includes('blink')) {
    overrides.flickerIntensity = 0.85; // forte oscilação
  }
  if (mods.includes('crackle') || mods.includes('crackling')) {
    overrides.turbulenceFactor = 0.45;
    overrides.emberPersistence = 1.8;
    overrides.flickerIntensity = (overrides.flickerIntensity ?? 0.15) + 0.3;
  }
  if (mods.includes('glitter')) {
    overrides.starCount = Math.round((overrides.starCount ?? 200) * 1.4);
    overrides.emberPersistence = 1.5;
    overrides.trailBrightness = 0.85;
  }
  if (parsed.noTrail) {
    overrides.trailLength = 0.0;
    overrides.trailBrightness = 0.0;
  }
  if (mods.includes('report') || parsed.hasReport) {
    overrides.flashIntensity = (overrides.flashIntensity ?? 2.5) + 1.5;
    overrides.smokeYield = (overrides.smokeYield ?? 0.4) + 0.3;
  }
  if (mods.includes('twinkle') || parsed.twinkle) {
    overrides.flickerIntensity = (overrides.flickerIntensity ?? 0.15) + 0.4;
    overrides.emberPersistence = 1.2;
  }
  if (parsed.fallingLeaves || mods.includes('leaves')) {
    overrides.gravityMultiplier = 3.5;
    overrides.dragCoefficient = 0.18; // folhas = muito drag
  }
  if (parsed.splitStars || mods.includes('split')) {
    overrides.starCount = Math.round((overrides.starCount ?? 200) * (parsed.numSplits || 2));
    overrides.releaseDuration = 0.18; // duas detonações
    overrides.releaseCurve = 'hybrid';
  }

  return overrides;
}

/**
 * Converte um VDL string completo numa spec física pronta para createEvent.
 */
export function vdlToEffectSpec(vdlText: string): VDLEffectSpec {
  const parsed = parseVDL(vdlText);
  const familyName = resolveFamily(parsed.typeName);

  const primaryColorName = parsed.colorNames[0] || 'gold';
  const color = vdlColorToRgb(primaryColorName);
  const colorSecondary = parsed.colorNames[1]
    ? vdlColorToRgb(parsed.colorNames[1])
    : undefined;

  const tiltRad = (parsed.angleOffset || 0) * (Math.PI / 180);
  const physicsOverrides = computePhysicsOverrides(parsed);

  return {
    familyName,
    color,
    colorSecondary,
    caliberMM: clampCaliber(parsed.caliberMM),
    tiltRad,
    headingRad: 0,
    modifiers: {
      strobe: parsed.modifiers.includes('strobe') || parsed.modifiers.includes('blink'),
      crackle: parsed.modifiers.includes('crackle') || parsed.modifiers.includes('crackling'),
      glitter: parsed.modifiers.includes('glitter'),
      pistil: parsed.hasPistil,
      noTrail: parsed.noTrail,
      forceTrail: parsed.impliesTrail && !parsed.noTrail,
      twinkle: parsed.twinkle,
      report: parsed.hasReport || parsed.modifiers.includes('report'),
      splitStars: parsed.splitStars,
    },
    physicsOverrides,
    trailType: parsed.trailType,
    raw: vdlText,
    parsed,
  };
}

/**
 * Helper: explica em texto natural (para JOI) o que um VDL string vai fazer.
 */
export function explainVdl(vdlText: string): string {
  const spec = vdlToEffectSpec(vdlText);
  const p = spec.parsed;
  const parts: string[] = [];
  parts.push(`📐 ${p.caliberMM}mm ${p.typeName || 'Shell'}`);
  if (p.colorNames.length > 1) {
    parts.push(`🎨 ${p.colorNames.join(' → ')}`);
  } else if (p.colorNames.length === 1) {
    parts.push(`🎨 ${p.colorNames[0]}`);
  }
  if (spec.modifiers.glitter) parts.push('✨ glitter');
  if (spec.modifiers.strobe) parts.push('💫 strobe');
  if (spec.modifiers.crackle) parts.push('🔊 crackle');
  if (spec.modifiers.pistil) parts.push('🌸 pistil');
  if (spec.modifiers.noTrail) parts.push('— no trail');
  if (spec.modifiers.report) parts.push('💥 report');
  if (p.angleOffset) parts.push(`↗ ${p.angleOffset > 0 ? 'R' : 'L'}${Math.abs(p.angleOffset)}°`);
  parts.push(`⏱ ${p.duration.toFixed(1)}s`);
  parts.push(`💎 ${spec.physicsOverrides.starCount} stars`);
  parts.push(`🚀 ${(spec.physicsOverrides.burstVelocity || 45).toFixed(0)} m/s`);
  return parts.join(' · ');
}
