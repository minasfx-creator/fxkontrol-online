/**
 * Color Interpolation Engine
 * Provides synchronized LED color transitions between drone formations.
 */

/** Parse hex color to RGB [0-1] */
function hexToRgb(hex: string): [number, number, number] {
  const c = hex.replace('#', '');
  const r = parseInt(c.substring(0, 2), 16) / 255;
  const g = parseInt(c.substring(2, 4), 16) / 255;
  const b = parseInt(c.substring(4, 6), 16) / 255;
  return [r, g, b];
}

/** RGB [0-1] to hex */
function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (v: number) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/** Convert RGB to HSL */
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h, s, l];
}

/** Convert HSL to RGB */
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) return [l, l, l];
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [hue2rgb(p, q, h + 1/3), hue2rgb(p, q, h), hue2rgb(p, q, h - 1/3)];
}

export type ColorTransitionMode = 'instant' | 'linear' | 'pulse' | 'rainbow' | 'wave' | 'rgb_cycle' | 'cascade' | 'sparkle';

/**
 * Interpolate color for a specific drone during a formation transition.
 * @param fromColor - Starting hex color
 * @param toColor - Target hex color
 * @param t - Transition progress [0-1]
 * @param mode - Transition type
 * @param droneIndex - Index of the drone (used for wave/stagger effects)
 * @param totalDrones - Total number of drones
 */
export function interpolateColor(
  fromColor: string,
  toColor: string,
  t: number,
  mode: ColorTransitionMode,
  droneIndex: number = 0,
  totalDrones: number = 1,
): string {
  if (mode === 'instant') {
    return t < 0.5 ? fromColor : toColor;
  }

  const [r1, g1, b1] = hexToRgb(fromColor);
  const [r2, g2, b2] = hexToRgb(toColor);

  if (mode === 'linear') {
    return rgbToHex(
      r1 + (r2 - r1) * t,
      g1 + (g2 - g1) * t,
      b1 + (b2 - b1) * t,
    );
  }

  if (mode === 'pulse') {
    // Pulse: color oscillates through brightness during transition
    const pulseFreq = 3;
    const pulse = Math.sin(t * Math.PI * pulseFreq) * 0.5 + 0.5;
    const [h1, s1, l1] = rgbToHsl(r1, g1, b1);
    const [h2, s2, l2] = rgbToHsl(r2, g2, b2);
    const h = h1 + (h2 - h1) * t;
    const s = s1 + (s2 - s1) * t;
    const baseL = l1 + (l2 - l1) * t;
    const l = baseL + pulse * 0.3; // brighten on pulse peaks
    const [r, g, b] = hslToRgb(h, s, Math.min(l, 1));
    return rgbToHex(r, g, b);
  }

  if (mode === 'rainbow') {
    // Each drone gets a rainbow offset based on its index
    const offset = droneIndex / Math.max(totalDrones, 1);
    const hue = (t + offset) % 1;
    const [r, g, b] = hslToRgb(hue, 0.9, 0.55);
    // Blend toward target color as t approaches 1
    const blend = t * t; // ease-in to final color
    const [rt, gt, bt] = hexToRgb(toColor);
    return rgbToHex(
      r * (1 - blend) + rt * blend,
      g * (1 - blend) + gt * blend,
      b * (1 - blend) + bt * blend,
    );
  }

  if (mode === 'wave') {
    // Sequential wave: each drone transitions with a stagger delay
    const stagger = 0.4; // 40% of transition time for full wave spread
    const dronePhase = (droneIndex / Math.max(totalDrones - 1, 1)) * stagger;
    const localT = Math.max(0, Math.min(1, (t - dronePhase) / (1 - stagger)));
    // Smooth ease
    const eased = localT * localT * (3 - 2 * localT);
    return rgbToHex(
      r1 + (r2 - r1) * eased,
      g1 + (g2 - g1) * eased,
      b1 + (b2 - b1) * eased,
    );
  }

  // Fallback: linear
  return rgbToHex(
    r1 + (r2 - r1) * t,
    g1 + (g2 - g1) * t,
    b1 + (b2 - b1) * t,
  );
}
