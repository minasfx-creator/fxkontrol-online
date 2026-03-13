/**
 * Auto-cue numbering engine — Finale 3D style
 * Generates cue numbers with module/rack prefix and sequential numbering
 */

export type CueNumberingScheme = 'simple' | 'module-pin' | 'rack-slat-pin';

export interface CueNumberOptions {
  scheme: CueNumberingScheme;
  startNumber: number;
  prefix: string;
  pinsPerModule: number;
  separator: string; // e.g. '-' or '.'
}

const DEFAULTS: CueNumberOptions = {
  scheme: 'module-pin',
  startNumber: 1,
  prefix: '',
  pinsPerModule: 20,
  separator: '-',
};

/**
 * Generate a cue number for a given sequential index.
 * - simple: "001", "002", ...
 * - module-pin: "A-01", "A-02", ... "B-01", ...
 * - rack-slat-pin: "1-A-01", "1-A-02", ... "1-B-01", ...
 */
export function generateCueNumber(index: number, opts: Partial<CueNumberOptions> = {}): string {
  const o = { ...DEFAULTS, ...opts };
  const num = o.startNumber + index;

  switch (o.scheme) {
    case 'simple':
      return `${o.prefix}${num.toString().padStart(3, '0')}`;

    case 'module-pin': {
      const module = Math.floor(index / o.pinsPerModule);
      const pin = (index % o.pinsPerModule) + 1;
      const moduleLabel = String.fromCharCode(65 + (module % 26));
      return `${o.prefix}${moduleLabel}${o.separator}${pin.toString().padStart(2, '0')}`;
    }

    case 'rack-slat-pin': {
      const slatsPerRack = 4;
      const totalSlat = Math.floor(index / o.pinsPerModule);
      const rack = Math.floor(totalSlat / slatsPerRack) + 1;
      const slat = String.fromCharCode(65 + (totalSlat % slatsPerRack));
      const pin = (index % o.pinsPerModule) + 1;
      return `${o.prefix}${rack}${o.separator}${slat}${o.separator}${pin.toString().padStart(2, '0')}`;
    }

    default:
      return `${num}`;
  }
}

/**
 * Batch-generate cue numbers for N items, sorted by time.
 */
export function batchNumberCues(
  count: number,
  opts: Partial<CueNumberOptions> = {}
): string[] {
  return Array.from({ length: count }, (_, i) => generateCueNumber(i, opts));
}

/**
 * Format a time value as Finale 3D timecode: HH:MM:SS.FF (30fps)
 */
export function formatTimecode(seconds: number, fps = 30): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const f = Math.floor((seconds % 1) * fps);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${f.toString().padStart(2, '0')}`;
}

/**
 * Parse a timecode string back to seconds
 */
export function parseTimecode(tc: string, fps = 30): number {
  const parts = tc.split(/[:.]/).map(Number);
  if (parts.length === 4) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2] + parts[3] / fps;
  }
  if (parts.length === 3) {
    return parts[0] * 60 + parts[1] + parts[2] / fps;
  }
  return parts[0] || 0;
}
