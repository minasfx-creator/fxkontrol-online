/**
 * applyColorPhases — bridge from Effect.colorPhases → time-sampled color.
 *
 * Pure helper. Given normalized progress t∈[0,1], returns the interpolated
 * hex color across the effect's declared color phases. If the effect has no
 * colorPhases, returns the base color unchanged.
 */
import type { Effect } from '@/data/effectLibrary';

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [255, 210, 122];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

function rgbToHex(r: number, g: number, b: number): string {
  const c = (x: number) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** Sample the effect's color at normalized time t (0..1). */
export function sampleEffectColor(effect: Pick<Effect, 'color' | 'colorPhases'>, t: number): string {
  const phases = effect.colorPhases;
  if (!phases || phases.length === 0) return effect.color;
  if (phases.length === 1) return phases[0].hex;
  const tt = Math.max(0, Math.min(1, t));
  // Find bracketing phases
  let i = 0;
  while (i < phases.length - 1 && phases[i + 1].at <= tt) i++;
  const a = phases[i];
  const b = phases[Math.min(i + 1, phases.length - 1)];
  if (a === b || b.at <= a.at) return a.hex;
  const span = b.at - a.at;
  const local = (tt - a.at) / span;
  const [ar, ag, ab] = hexToRgb(a.hex);
  const [br, bg, bb] = hexToRgb(b.hex);
  return rgbToHex(ar + (br - ar) * local, ag + (bg - ag) * local, ab + (bb - ab) * local);
}

/** Returns the dominant modifier active at time t (if any). */
export function sampleEffectModifier(
  effect: Pick<Effect, 'colorPhases'>,
  t: number,
): 'strobe' | 'crackle' | 'glitter' | 'charcoal' | undefined {
  const phases = effect.colorPhases;
  if (!phases || phases.length === 0) return undefined;
  const tt = Math.max(0, Math.min(1, t));
  let active = phases[0];
  for (const p of phases) {
    if (p.at <= tt) active = p;
  }
  return active.modifier;
}
