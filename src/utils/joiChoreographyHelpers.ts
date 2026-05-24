/**
 * Joi Choreography Helpers — funções puras para o gerador de coreografias
 * usar layouts espaciais, paletas coerentes, espelhamento, arco dramático
 * e timing musical. Zero side-effects, 100% testável.
 */

export type LayoutPreset =
  | 'line' | 'arc' | 'V' | 'grid' | 'circle' | 'stage_front' | 'symmetric';

export type PaletteName =
  | 'reveillon' | 'corporativo' | 'casamento' | 'patriotico' | 'neon' | 'classico';

export type DramaticPhase = 'intro' | 'build' | 'climax' | 'finale';

export interface MaterializedPosition {
  index: number;
  name: string;
  x: number;
  y: number;
  z: number;
  heading: number;
  pitch: number;
  type: 'pyro' | 'drone-pad' | 'light';
}

const PALETTES: Record<PaletteName, string[]> = {
  reveillon:   ['#FFD700', '#FFFFFF', '#FF6B35', '#E94560', '#06D6A0', '#118AB2'],
  corporativo: ['#FFFFFF', '#C0C0C0', '#1B98E0', '#0A2540', '#E0B43F'],
  casamento:   ['#FFEFD5', '#FFC0CB', '#F8C8DC', '#FFFFFF', '#FFD700'],
  patriotico:  ['#009C3B', '#FFDF00', '#002776', '#FFFFFF'],
  neon:        ['#FF00FF', '#00FFFF', '#FFFF00', '#FF6EC7', '#39FF14'],
  classico:    ['#FF0000', '#FFFFFF', '#FFD700', '#0066CC', '#00AA00'],
};

/** Resolve palette → array of hex. */
export function resolvePalette(
  name?: PaletteName,
  custom?: string[],
): string[] {
  if (custom && custom.length > 0) return custom;
  if (name && PALETTES[name]) return PALETTES[name];
  return PALETTES.classico;
}

/** Pick a color by index, rotating through palette. */
export function pickPaletteColor(palette: string[], idx: number): string {
  if (palette.length === 0) return '#ffffff';
  return palette[idx % palette.length];
}

/** Materialize N positions into a layout preset, centered at (anchorX, anchorZ). */
export function materializeLayout(
  preset: LayoutPreset,
  count: number,
  opts: {
    anchorX?: number;
    anchorZ?: number;
    spacing?: number;
    radius?: number;
    namePrefix?: string;
    type?: 'pyro' | 'drone-pad' | 'light';
  } = {},
): MaterializedPosition[] {
  const ax = opts.anchorX ?? 0;
  const az = opts.anchorZ ?? 0;
  const spacing = opts.spacing ?? 8;
  const radius = opts.radius ?? Math.max(15, count * spacing * 0.4);
  const prefix = opts.namePrefix ?? 'P';
  const type = opts.type ?? 'pyro';
  const out: MaterializedPosition[] = [];

  for (let i = 0; i < Math.max(1, count); i++) {
    let x = ax, z = az, heading = 0;
    switch (preset) {
      case 'line': {
        x = ax + (i - (count - 1) / 2) * spacing;
        z = az;
        break;
      }
      case 'arc': {
        const span = Math.PI * 0.6;
        const t = count === 1 ? 0.5 : i / (count - 1);
        const angle = -span / 2 + span * t;
        x = ax + Math.sin(angle) * radius;
        z = az - Math.cos(angle) * radius * 0.4;
        heading = (angle * 180) / Math.PI;
        break;
      }
      case 'V': {
        const half = (count - 1) / 2;
        const side = i < half ? -1 : i > half ? 1 : 0;
        const depth = Math.abs(i - half) * spacing;
        x = ax + side * depth;
        z = az - depth * 0.7;
        heading = side * 30;
        break;
      }
      case 'grid': {
        const cols = Math.max(1, Math.ceil(Math.sqrt(count)));
        const row = Math.floor(i / cols);
        const col = i % cols;
        x = ax + (col - (cols - 1) / 2) * spacing;
        z = az + (row - (Math.ceil(count / cols) - 1) / 2) * spacing;
        break;
      }
      case 'circle': {
        const a = (i / count) * Math.PI * 2;
        x = ax + Math.cos(a) * radius;
        z = az + Math.sin(a) * radius;
        heading = (a * 180) / Math.PI;
        break;
      }
      case 'stage_front': {
        // Single row along stage front, all facing audience (+Z)
        x = ax + (i - (count - 1) / 2) * spacing;
        z = az;
        heading = 0;
        break;
      }
      case 'symmetric': {
        // pares espelhados; ímpar central no eixo
        const half = Math.floor(count / 2);
        if (count % 2 === 1 && i === half) {
          x = ax; z = az;
        } else {
          const pair = i < half ? i + 1 : i - half + 1;
          const side = i < half ? -1 : 1;
          x = ax + side * pair * spacing;
          z = az;
        }
        break;
      }
    }
    out.push({
      index: i,
      name: `${prefix}-${i + 1}`,
      x, y: 0, z, heading, pitch: 90,
      type,
    });
  }
  return out;
}

/** Build a list of mirrored counterparts for a list of positions (mirror X axis). */
export function mirrorPositions(
  positions: MaterializedPosition[],
  startIndex: number,
): MaterializedPosition[] {
  return positions.map((p, k) => ({
    index: startIndex + k,
    name: `${p.name}-MIR`,
    x: -p.x,
    y: p.y,
    z: p.z,
    heading: -p.heading,
    pitch: p.pitch,
    type: p.type,
  }));
}

/** Cue density (cues per second) for a dramatic phase. */
export function densityForArc(phase: DramaticPhase): number {
  switch (phase) {
    case 'intro':  return 1 / 3;     // 1 cue a cada 3s
    case 'build':  return 1 / 2;
    case 'climax': return 1 / 0.8;
    case 'finale': return 1 / 0.4;
  }
}

/** Distribute totalDuration across given phases proportionally. */
export function planArcSchedule(
  arc: DramaticPhase[],
  totalDuration: number,
): Array<{ phase: DramaticPhase; start: number; end: number; cueCount: number }> {
  if (arc.length === 0) {
    return [{ phase: 'build', start: 0, end: totalDuration, cueCount: Math.max(1, Math.round(totalDuration / 2)) }];
  }
  // Pesos: intro 1, build 2, climax 2, finale 1.5
  const weights: Record<DramaticPhase, number> = { intro: 1, build: 2, climax: 2, finale: 1.5 };
  const totalWeight = arc.reduce((s, p) => s + weights[p], 0);
  let t = 0;
  return arc.map(phase => {
    const span = (weights[phase] / totalWeight) * totalDuration;
    const start = t;
    const end = t + span;
    t = end;
    const cueCount = Math.max(1, Math.round(span * densityForArc(phase)));
    return { phase, start, end, cueCount };
  });
}

/** Snap a time to the nearest beat grid (1/division of a beat). */
export function snapToBeat(time: number, bpm: number, division: number = 2): number {
  if (!bpm || bpm <= 0) return time;
  const beatDur = 60 / bpm;
  const grid = beatDur / Math.max(1, division);
  return Math.round(time / grid) * grid;
}

/** Build a beat grid: array of cue start times across [0, duration]. */
export function beatGrid(
  bpm: number,
  duration: number,
  division: number = 2,
  offset: number = 0,
): number[] {
  if (!bpm || bpm <= 0 || duration <= 0) return [];
  const beatDur = 60 / bpm;
  const step = beatDur / Math.max(1, division);
  const out: number[] = [];
  for (let t = offset; t < duration; t += step) out.push(+t.toFixed(3));
  return out;
}

/** Reserve a time window for cake/candle that consume duration. */
export function effectWindowDuration(
  partType: string | undefined,
  declaredDuration?: number,
): number {
  if (declaredDuration && declaredDuration > 0) return declaredDuration;
  if (partType === 'cake') return 15;
  if (partType === 'candle') return 8;
  if (partType === 'gerb' || partType === 'waterfall' || partType === 'flame') return 20;
  return 4; // shells, mines, comets, default
}
