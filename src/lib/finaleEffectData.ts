/**
 * Finale 3D — Effect Data / Motion Data parser & serializer
 *
 * Canonical implementation of the field format documented in
 * docs/reference/finale-effect-motion-data.md.
 *
 * Pure functions only — no engine wiring. Renderer integration is a separate
 * round.
 */

export type Vec4Sample = { t: number; x: number; y: number; z: number };
export type HprSample = { t: number; h: number; p: number; r: number };
export type RgbSample = { t: number; rgb: number };

export interface FinaleEffectData {
  pos?: Vec4Sample[];
  pos2?: Vec4Sample[];
  hpr?: HprSample[];
  hpr2?: HprSample[];
  /** Effect Data only — Finale ignores rgb in position Motion Data. */
  rgb?: RgbSample[];
  /** Optional Finale-side hash of payload (excluding itself). Manual data should omit. */
  hash?: number;
  /** Unknown attributes preserved verbatim as raw token lists. */
  unknown?: Record<string, number[]>;
  /** Non-fatal issues found while parsing (e.g. non-monotonic times). */
  warnings?: string[];
}

const STRIDE_VEC4 = 4;
const STRIDE_RGB = 2;

/** Tokenize the field into atoms: '{', '}', '[', ']', or number-strings. */
function tokenize(input: string): string[] {
  const out: string[] = [];
  let buf = '';
  const flush = () => { if (buf.length) { out.push(buf); buf = ''; } };
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (c === '{' || c === '}' || c === '[' || c === ']') {
      flush();
      out.push(c);
    } else if (c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === ',') {
      flush();
    } else {
      buf += c;
    }
  }
  flush();
  return out;
}

function expect(tokens: string[], pos: number, tok: string): number {
  if (tokens[pos] !== tok) {
    throw new Error(`Finale data: expected '${tok}' at token ${pos}, got '${tokens[pos] ?? '<eof>'}'`);
  }
  return pos + 1;
}

function parseNumberList(tokens: string[], start: number): { values: number[]; next: number } {
  let i = expect(tokens, start, '[');
  const values: number[] = [];
  while (i < tokens.length && tokens[i] !== ']') {
    const n = Number(tokens[i]);
    if (!Number.isFinite(n)) {
      throw new Error(`Finale data: non-numeric token '${tokens[i]}' at position ${i}`);
    }
    values.push(n);
    i++;
  }
  i = expect(tokens, i, ']');
  return { values, next: i };
}

function toVec4Samples(values: number[], attr: string): Vec4Sample[] {
  if (values.length % STRIDE_VEC4 !== 0) {
    throw new Error(`Finale data: ${attr} sample list length ${values.length} not a multiple of 4`);
  }
  const out: Vec4Sample[] = [];
  for (let i = 0; i < values.length; i += STRIDE_VEC4) {
    out.push({ t: values[i], x: values[i + 1], y: values[i + 2], z: values[i + 3] });
  }
  return out;
}

function toHprSamples(values: number[], attr: string): HprSample[] {
  if (values.length % STRIDE_VEC4 !== 0) {
    throw new Error(`Finale data: ${attr} sample list length ${values.length} not a multiple of 4`);
  }
  const out: HprSample[] = [];
  for (let i = 0; i < values.length; i += STRIDE_VEC4) {
    out.push({ t: values[i], h: values[i + 1], p: values[i + 2], r: values[i + 3] });
  }
  return out;
}

function toRgbSamples(values: number[]): RgbSample[] {
  if (values.length % STRIDE_RGB !== 0) {
    throw new Error(`Finale data: rgb sample list length ${values.length} not a multiple of 2`);
  }
  const out: RgbSample[] = [];
  for (let i = 0; i < values.length; i += STRIDE_RGB) {
    out.push({ t: values[i], rgb: values[i + 1] | 0 });
  }
  return out;
}

function checkMonotonic(times: number[], attr: string, warnings: string[]) {
  for (let i = 1; i < times.length; i++) {
    if (times[i] < times[i - 1]) {
      warnings.push(`${attr}: times not monotonic at sample ${i} (${times[i - 1]} → ${times[i]})`);
      return;
    }
  }
}

/**
 * Parse a Motion Data or Effect Data field. Returns a typed object plus any
 * non-fatal warnings.
 */
export function parseFinaleEffectData(input: string): FinaleEffectData {
  const trimmed = input.trim();
  if (trimmed === '' || trimmed === '{}') {
    return {};
  }
  const tokens = tokenize(trimmed);
  let i = expect(tokens, 0, '{');
  const result: FinaleEffectData = {};
  const warnings: string[] = [];

  while (i < tokens.length && tokens[i] !== '}') {
    i = expect(tokens, i, '[');
    const attr = tokens[i];
    if (!attr || attr === '[' || attr === ']' || attr === '{' || attr === '}') {
      throw new Error(`Finale data: expected attribute name at token ${i}`);
    }
    i++;

    if (attr === 'hash') {
      // [hash N]
      const n = Number(tokens[i]);
      if (!Number.isFinite(n)) {
        throw new Error(`Finale data: hash must be a number, got '${tokens[i]}'`);
      }
      result.hash = n | 0;
      i++;
      i = expect(tokens, i, ']');
      continue;
    }

    const { values, next } = parseNumberList(tokens, i);
    i = next;
    i = expect(tokens, i, ']');

    switch (attr) {
      case 'pos': {
        const s = toVec4Samples(values, attr);
        checkMonotonic(s.map(p => p.t), attr, warnings);
        result.pos = s;
        break;
      }
      case 'pos2': {
        const s = toVec4Samples(values, attr);
        checkMonotonic(s.map(p => p.t), attr, warnings);
        result.pos2 = s;
        break;
      }
      case 'hpr': {
        const s = toHprSamples(values, attr);
        checkMonotonic(s.map(p => p.t), attr, warnings);
        result.hpr = s;
        break;
      }
      case 'hpr2': {
        const s = toHprSamples(values, attr);
        checkMonotonic(s.map(p => p.t), attr, warnings);
        result.hpr2 = s;
        break;
      }
      case 'rgb': {
        const s = toRgbSamples(values);
        checkMonotonic(s.map(p => p.t), attr, warnings);
        result.rgb = s;
        break;
      }
      default: {
        result.unknown ??= {};
        result.unknown[attr] = values;
      }
    }
  }
  expect(tokens, i, '}');
  if (warnings.length) result.warnings = warnings;
  return result;
}

/** Numeric formatter that preserves integers and strips trailing zeros on floats. */
function fmt(n: number): string {
  if (Number.isInteger(n)) return String(n);
  // Match Finale-style compact ".5" / "-3.86" output
  let s = n.toString();
  // Don't expand exponentials for typical engineering ranges.
  if (s.includes('e') || s.includes('E')) return s;
  return s;
}

function serializeVec4(name: string, samples: Vec4Sample[]): string {
  const body = samples.flatMap(s => [fmt(s.t), fmt(s.x), fmt(s.y), fmt(s.z)]).join(' ');
  return `[${name} [${body}]]`;
}

function serializeHpr(name: string, samples: HprSample[]): string {
  const body = samples.flatMap(s => [fmt(s.t), fmt(s.h), fmt(s.p), fmt(s.r)]).join(' ');
  return `[${name} [${body}]]`;
}

function serializeRgb(samples: RgbSample[]): string {
  const body = samples.flatMap(s => [fmt(s.t), fmt(s.rgb | 0)]).join(' ');
  return `[rgb [${body}]]`;
}

/**
 * Serialize back to Finale's bracket syntax. Order: hash, pos, pos2, hpr, hpr2, rgb,
 * then unknown attributes in insertion order — stable for round-trip.
 */
export function serializeFinaleEffectData(data: FinaleEffectData): string {
  const parts: string[] = [];
  if (typeof data.hash === 'number') parts.push(`[hash ${data.hash | 0}]`);
  if (data.pos)  parts.push(serializeVec4('pos',  data.pos));
  if (data.pos2) parts.push(serializeVec4('pos2', data.pos2));
  if (data.hpr)  parts.push(serializeHpr('hpr',  data.hpr));
  if (data.hpr2) parts.push(serializeHpr('hpr2', data.hpr2));
  if (data.rgb)  parts.push(serializeRgb(data.rgb));
  if (data.unknown) {
    for (const [name, values] of Object.entries(data.unknown)) {
      parts.push(`[${name} [${values.map(fmt).join(' ')}]]`);
    }
  }
  return `{${parts.join(' ')}}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Interpolation helpers — match Finale's per-component linear interp semantics
// ─────────────────────────────────────────────────────────────────────────────

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Sample a vec4 path at time t. Returns held-first / held-last per spec. */
export function sampleVec4(samples: Vec4Sample[] | undefined, t: number, identity: [number, number, number] = [0, 0, 0]): [number, number, number] {
  if (!samples || samples.length === 0) return [...identity] as [number, number, number];
  const first = samples[0];
  if (t <= 0 || t <= first.t) {
    // implicit identity at t=0 → interp to first sample
    if (t <= 0) return [...identity] as [number, number, number];
    if (first.t === 0) return [first.x, first.y, first.z];
    const u = t / first.t;
    return [lerp(identity[0], first.x, u), lerp(identity[1], first.y, u), lerp(identity[2], first.z, u)];
  }
  const last = samples[samples.length - 1];
  if (t >= last.t) return [last.x, last.y, last.z];
  // binary search would be faster; linear is fine for typical N
  for (let i = 1; i < samples.length; i++) {
    const b = samples[i];
    if (t <= b.t) {
      const a = samples[i - 1];
      const span = b.t - a.t;
      if (span <= 0) return [b.x, b.y, b.z];
      const u = (t - a.t) / span;
      return [lerp(a.x, b.x, u), lerp(a.y, b.y, u), lerp(a.z, b.z, u)];
    }
  }
  return [last.x, last.y, last.z];
}

/** Sample HPR per-component (Finale's scalar interp — enables multi-cycle spins). */
export function sampleHpr(samples: HprSample[] | undefined, t: number): [number, number, number] {
  if (!samples || samples.length === 0) return [0, 0, 0];
  const first = samples[0];
  if (t <= 0) return [0, 0, 0];
  if (t <= first.t) {
    if (first.t === 0) return [first.h, first.p, first.r];
    const u = t / first.t;
    return [lerp(0, first.h, u), lerp(0, first.p, u), lerp(0, first.r, u)];
  }
  const last = samples[samples.length - 1];
  if (t >= last.t) return [last.h, last.p, last.r];
  for (let i = 1; i < samples.length; i++) {
    const b = samples[i];
    if (t <= b.t) {
      const a = samples[i - 1];
      const span = b.t - a.t;
      if (span <= 0) return [b.h, b.p, b.r];
      const u = (t - a.t) / span;
      return [lerp(a.h, b.h, u), lerp(a.p, b.p, u), lerp(a.r, b.r, u)];
    }
  }
  return [last.h, last.p, last.r];
}

/** Sample RGB packed int (0xRRGGBB). Per-channel linear interp, implicit black at t=0. */
export function sampleRgb(samples: RgbSample[] | undefined, t: number): number {
  if (!samples || samples.length === 0) return 0;
  const splitChans = (v: number) => [(v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff] as const;
  const packChans = (r: number, g: number, b: number) =>
    ((Math.round(r) & 0xff) << 16) | ((Math.round(g) & 0xff) << 8) | (Math.round(b) & 0xff);

  const first = samples[0];
  if (t <= 0) return 0;
  if (t <= first.t) {
    if (first.t === 0) return first.rgb & 0xffffff;
    const [r, g, b] = splitChans(first.rgb);
    const u = t / first.t;
    return packChans(lerp(0, r, u), lerp(0, g, u), lerp(0, b, u));
  }
  const last = samples[samples.length - 1];
  if (t >= last.t) return last.rgb & 0xffffff;
  for (let i = 1; i < samples.length; i++) {
    const b = samples[i];
    if (t <= b.t) {
      const a = samples[i - 1];
      const span = b.t - a.t;
      if (span <= 0) return b.rgb & 0xffffff;
      const u = (t - a.t) / span;
      const [ar, ag, ab] = splitChans(a.rgb);
      const [br, bg, bb] = splitChans(b.rgb);
      return packChans(lerp(ar, br, u), lerp(ag, bg, u), lerp(ab, bb, u));
    }
  }
  return last.rgb & 0xffffff;
}
