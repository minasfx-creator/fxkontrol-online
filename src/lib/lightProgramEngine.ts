/**
 * ─── Skybrush Light Program Engine ───────────────────────────────
 * Port of Skybrush Studio's LightProgram model to TypeScript.
 * Provides keyframe-based LED color programming with:
 *   - Linear interpolation & instant snap modes
 *   - Path simplification (Ramer-Douglas-Peucker on color space)
 *   - Per-drone light programs with effects (pulse, strobe, rainbow, chase)
 *   - Export to Skybrush .skyc light segment format
 */

export interface Color4D {
  t: number;       // time in seconds
  r: number;       // 0-255
  g: number;
  b: number;
  w?: number;      // white channel (RGBW drones)
  isFade: boolean; // true = linear interpolate from previous; false = instant snap
}

export interface LightEffect {
  id: string;
  name: string;
  type: 'solid' | 'pulse' | 'strobe' | 'rainbow' | 'chase' | 'breathe' | 'sparkle' | 'gradient' | 'custom';
  startTime: number;
  duration: number;
  color: string;       // primary hex color
  endColor?: string;   // for gradients
  speed: number;       // effect speed multiplier (0.1-10)
  intensity: number;   // 0-1
  params: Record<string, number>; // effect-specific params
}

export interface DroneLightProgram {
  droneId: string;
  keyframes: Color4D[];
  effects: LightEffect[];
}

// ── Color Utilities ──────────────────────────────────────────────

export function hexToColor4D(hex: string, t: number, fade: boolean = true): Color4D {
  const clean = hex.replace('#', '');
  return {
    t,
    r: parseInt(clean.substring(0, 2), 16),
    g: parseInt(clean.substring(2, 4), 16),
    b: parseInt(clean.substring(4, 6), 16),
    isFade: fade,
  };
}

export function color4DToHex(c: Color4D): string {
  const r = Math.round(Math.max(0, Math.min(255, c.r)));
  const g = Math.round(Math.max(0, Math.min(255, c.g)));
  const b = Math.round(Math.max(0, Math.min(255, c.b)));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

export function interpolateColor4D(a: Color4D, b: Color4D, t: number): Color4D {
  if (!b.isFade) return { ...a, t };
  const ratio = b.t > a.t ? (t - a.t) / (b.t - a.t) : 0.5;
  const clampedRatio = Math.max(0, Math.min(1, ratio));
  return {
    t,
    r: a.r + (b.r - a.r) * clampedRatio,
    g: a.g + (b.g - a.g) * clampedRatio,
    b: a.b + (b.b - a.b) * clampedRatio,
    w: a.w !== undefined && b.w !== undefined ? a.w + (b.w - a.w) * clampedRatio : undefined,
    isFade: true,
  };
}

// ── Light Program Evaluation ────────────────────────────────────

export function evaluateLightProgram(program: DroneLightProgram, time: number, droneIndex: number = 0, totalDrones: number = 1): Color4D {
  // First check effects (higher priority)
  for (const effect of program.effects) {
    if (time >= effect.startTime && time < effect.startTime + effect.duration) {
      return evaluateEffect(effect, time, droneIndex, totalDrones);
    }
  }

  // Fall back to keyframe interpolation
  return evaluateKeyframes(program.keyframes, time);
}

function evaluateKeyframes(keyframes: Color4D[], time: number): Color4D {
  if (keyframes.length === 0) return { t: time, r: 0, g: 0, b: 0, isFade: false };
  if (time <= keyframes[0].t) return { ...keyframes[0], t: time };
  if (time >= keyframes[keyframes.length - 1].t) return { ...keyframes[keyframes.length - 1], t: time };

  for (let i = 0; i < keyframes.length - 1; i++) {
    if (time >= keyframes[i].t && time < keyframes[i + 1].t) {
      if (!keyframes[i + 1].isFade) return { ...keyframes[i], t: time };
      return interpolateColor4D(keyframes[i], keyframes[i + 1], time);
    }
  }
  return { ...keyframes[keyframes.length - 1], t: time };
}

// ── Effect Evaluators (Skybrush Studio compatible) ──────────────

function evaluateEffect(effect: LightEffect, time: number, droneIndex: number, totalDrones: number): Color4D {
  const elapsed = time - effect.startTime;
  const progress = elapsed / effect.duration;
  const phase = elapsed * effect.speed;
  const hex = effect.color;
  const r0 = parseInt(hex.slice(1, 3), 16);
  const g0 = parseInt(hex.slice(3, 5), 16);
  const b0 = parseInt(hex.slice(5, 7), 16);

  switch (effect.type) {
    case 'solid':
      return { t: time, r: r0, g: g0, b: b0, isFade: false };

    case 'pulse': {
      const pulse = (Math.sin(phase * Math.PI * 2) * 0.5 + 0.5) * effect.intensity;
      return { t: time, r: r0 * pulse, g: g0 * pulse, b: b0 * pulse, isFade: true };
    }

    case 'strobe': {
      const strobeFreq = effect.params.frequency ?? 10;
      const on = Math.sin(phase * strobeFreq * Math.PI * 2) > 0 ? effect.intensity : 0;
      return { t: time, r: r0 * on, g: g0 * on, b: b0 * on, isFade: false };
    }

    case 'rainbow': {
      const hue = (phase * 0.5 + droneIndex / totalDrones) % 1;
      const [rr, gg, bb] = hslToRgb(hue, 1.0, 0.5 * effect.intensity);
      return { t: time, r: rr, g: gg, b: bb, isFade: true };
    }

    case 'chase': {
      const wavePos = (phase * 0.3) % 1;
      const dronePhase = droneIndex / totalDrones;
      const dist = Math.abs(dronePhase - wavePos);
      const bright = Math.max(0, 1 - dist * totalDrones * 0.15) * effect.intensity;
      return { t: time, r: r0 * bright, g: g0 * bright, b: b0 * bright, isFade: true };
    }

    case 'breathe': {
      const breathe = (Math.sin(phase * Math.PI - Math.PI / 2) * 0.5 + 0.5) * effect.intensity;
      return { t: time, r: r0 * breathe, g: g0 * breathe, b: b0 * breathe, isFade: true };
    }

    case 'sparkle': {
      const seed = droneIndex * 7919 + Math.floor(phase * 15);
      const hash = ((seed * 2654435761) >>> 0) / 4294967296;
      const sparkle = hash > 0.85 ? effect.intensity : effect.intensity * 0.05;
      return { t: time, r: r0 * sparkle, g: g0 * sparkle, b: b0 * sparkle, isFade: false };
    }

    case 'gradient': {
      if (!effect.endColor) return { t: time, r: r0, g: g0, b: b0, isFade: true };
      const r1 = parseInt(effect.endColor.slice(1, 3), 16);
      const g1 = parseInt(effect.endColor.slice(3, 5), 16);
      const b1 = parseInt(effect.endColor.slice(5, 7), 16);
      const gradientPos = droneIndex / Math.max(1, totalDrones - 1);
      return {
        t: time,
        r: r0 + (r1 - r0) * gradientPos,
        g: g0 + (g1 - g0) * gradientPos,
        b: b0 + (b1 - b0) * gradientPos,
        isFade: true,
      };
    }

    default:
      return { t: time, r: r0, g: g0, b: b0, isFade: false };
  }
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h * 6) % 2 - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 1/6) { r = c; g = x; }
  else if (h < 2/6) { r = x; g = c; }
  else if (h < 3/6) { g = c; b = x; }
  else if (h < 4/6) { g = x; b = c; }
  else if (h < 5/6) { r = x; b = c; }
  else { r = c; b = x; }
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

// ── Path Simplification (Ramer-Douglas-Peucker on color space) ──

export function simplifyLightProgram(keyframes: Color4D[], tolerance: number = 2): Color4D[] {
  if (keyframes.length <= 2) return [...keyframes];

  const distFunc = (point: Color4D, start: Color4D, end: Color4D): number => {
    const timespan = end.t - start.t;
    const ratio = timespan > 0 ? (point.t - start.t) / timespan : 0.5;
    const interpR = start.r + ratio * (end.r - start.r);
    const interpG = start.g + ratio * (end.g - start.g);
    const interpB = start.b + ratio * (end.b - start.b);
    return Math.max(Math.abs(interpR - point.r), Math.abs(interpG - point.g), Math.abs(interpB - point.b));
  };

  function rdp(points: Color4D[], start: number, end: number): Color4D[] {
    if (end - start < 2) return [points[start], points[end]];

    let maxDist = 0;
    let maxIdx = start;
    for (let i = start + 1; i < end; i++) {
      const d = distFunc(points[i], points[start], points[end]);
      if (d > maxDist) { maxDist = d; maxIdx = i; }
    }

    if (maxDist <= tolerance) return [points[start], points[end]];

    const left = rdp(points, start, maxIdx);
    const right = rdp(points, maxIdx, end);
    return [...left.slice(0, -1), ...right];
  }

  return rdp(keyframes, 0, keyframes.length - 1);
}

// ── Generate light program from formation sequence ──────────────

export function generateFormationLightProgram(
  formations: { startTime: number; transitionDuration: number; holdDuration: number; color: string; endColor?: string }[],
  droneIndex: number,
  totalDrones: number,
): Color4D[] {
  const keyframes: Color4D[] = [];
  keyframes.push({ t: 0, r: 0, g: 0, b: 0, isFade: false });

  for (const f of formations) {
    const c = hexToColor4D(f.color, f.startTime, true);
    keyframes.push(c);

    if (f.endColor) {
      const ec = hexToColor4D(f.endColor, f.startTime + f.transitionDuration, true);
      keyframes.push(ec);
    }

    const holdEnd = f.startTime + f.transitionDuration + f.holdDuration;
    const currentColor = f.endColor || f.color;
    keyframes.push(hexToColor4D(currentColor, holdEnd - 0.1, true));
    keyframes.push({ t: holdEnd, r: 0, g: 0, b: 0, isFade: true });
  }

  return keyframes;
}

// ── Export to Skybrush .skyc format ──────────────────────────────

export function lightProgramToSkyc(keyframes: Color4D[]): { t: number; r: number; g: number; b: number; w?: number; fade: 'instant' | 'linear' | 'ease' }[] {
  return keyframes.map(kf => ({
    t: kf.t,
    r: Math.round(kf.r),
    g: Math.round(kf.g),
    b: Math.round(kf.b),
    w: kf.w !== undefined ? Math.round(kf.w) : undefined,
    fade: kf.isFade ? 'linear' : 'instant',
  }));
}
