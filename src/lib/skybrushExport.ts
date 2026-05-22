/**
 * FX KONTROL · Skybrush Export — Honest Stub
 *
 * Generates a plausible Skybrush-style package (ZIP) for sales conversations.
 *
 * CLAIM POLICY: marketing_hypothesis
 *   - The format mirrors Skybrush conventions but has NOT been validated against
 *     the actual Skybrush importer / Drotek toolchain. Every artifact is tagged
 *     with `_FXK_DISCLAIMER.txt` so reviewers know this is a preview.
 *   - DO NOT submit the resulting .zip to a live Skybrush server expecting it
 *     to play. Use it for demo, investor and design conversations only.
 *
 * Validation rules implemented (safety / sanity, not regulatory):
 *   - max drones: 500 (alert above)
 *   - min spacing: 2.0 m at any waypoint
 *   - max altitude: 120 m AGL (FAA Part 107 ceiling without waiver)
 *   - max speed: 8 m/s lateral, 4 m/s vertical
 */

export interface ChoreoDrone {
  id: string;
  /** waypoints in (t_seconds, x_m, y_m, z_m_AGL) */
  path: Array<{ t: number; x: number; y: number; z: number }>;
  /** RGB color stops (0..1) along time */
  color?: Array<{ t: number; r: number; g: number; b: number }>;
}

export interface ChoreoScene {
  title: string;
  drones: ChoreoDrone[];
  /** seconds */
  duration: number;
}

export interface ValidationIssue {
  severity: 'info' | 'warn' | 'error';
  rule: string;
  droneId?: string;
  message: string;
}

export interface ValidationReport {
  ok: boolean;
  totals: { drones: number; waypoints: number; durationSec: number };
  issues: ValidationIssue[];
}

const LIMITS = {
  MAX_DRONES: 500,
  MIN_SPACING_M: 2.0,
  MAX_ALT_M: 120,
  MAX_LATERAL_MS: 8,
  MAX_VERTICAL_MS: 4,
} as const;

export function validateScene(scene: ChoreoScene): ValidationReport {
  const issues: ValidationIssue[] = [];
  let totalWaypoints = 0;

  if (scene.drones.length > LIMITS.MAX_DRONES) {
    issues.push({
      severity: 'warn',
      rule: 'MAX_DRONES',
      message: `Scene has ${scene.drones.length} drones; pilot ceiling is ${LIMITS.MAX_DRONES}.`,
    });
  }
  if (scene.duration <= 0) {
    issues.push({ severity: 'error', rule: 'DURATION', message: 'Scene duration must be > 0s.' });
  }

  for (const d of scene.drones) {
    if (!d.path.length) {
      issues.push({ severity: 'error', rule: 'EMPTY_PATH', droneId: d.id, message: 'Drone has no waypoints.' });
      continue;
    }
    totalWaypoints += d.path.length;

    for (let i = 0; i < d.path.length; i++) {
      const w = d.path[i];
      if (w.z > LIMITS.MAX_ALT_M) {
        issues.push({
          severity: 'warn',
          rule: 'MAX_ALT',
          droneId: d.id,
          message: `Waypoint #${i} altitude ${w.z.toFixed(1)}m exceeds ${LIMITS.MAX_ALT_M}m AGL (FAA Part 107).`,
        });
      }
      if (i > 0) {
        const p = d.path[i - 1];
        const dt = Math.max(0.001, w.t - p.t);
        const dxy = Math.hypot(w.x - p.x, w.y - p.y) / dt;
        const dz = Math.abs(w.z - p.z) / dt;
        if (dxy > LIMITS.MAX_LATERAL_MS) {
          issues.push({
            severity: 'warn',
            rule: 'MAX_LATERAL_SPEED',
            droneId: d.id,
            message: `Segment #${i} lateral speed ${dxy.toFixed(2)} m/s exceeds ${LIMITS.MAX_LATERAL_MS} m/s.`,
          });
        }
        if (dz > LIMITS.MAX_VERTICAL_MS) {
          issues.push({
            severity: 'warn',
            rule: 'MAX_VERTICAL_SPEED',
            droneId: d.id,
            message: `Segment #${i} vertical speed ${dz.toFixed(2)} m/s exceeds ${LIMITS.MAX_VERTICAL_MS} m/s.`,
          });
        }
      }
    }
  }

  // Spacing check at sampled times (cheap O(N²·S))
  const samples = Math.min(8, Math.max(2, Math.floor(scene.duration / 2)));
  for (let s = 0; s < samples; s++) {
    const t = (scene.duration * s) / Math.max(1, samples - 1);
    const positions = scene.drones
      .map((d) => ({ id: d.id, p: sampleAt(d, t) }))
      .filter((x) => x.p);
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const a = positions[i].p!;
        const b = positions[j].p!;
        const dist = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
        if (dist < LIMITS.MIN_SPACING_M) {
          issues.push({
            severity: 'error',
            rule: 'MIN_SPACING',
            droneId: positions[i].id,
            message: `t=${t.toFixed(1)}s: ${positions[i].id}↔${positions[j].id} = ${dist.toFixed(2)}m < ${LIMITS.MIN_SPACING_M}m.`,
          });
        }
      }
    }
  }

  const hasError = issues.some((i) => i.severity === 'error');
  return {
    ok: !hasError,
    totals: { drones: scene.drones.length, waypoints: totalWaypoints, durationSec: scene.duration },
    issues,
  };
}

function sampleAt(d: ChoreoDrone, t: number): { x: number; y: number; z: number } | null {
  if (!d.path.length) return null;
  if (t <= d.path[0].t) return { x: d.path[0].x, y: d.path[0].y, z: d.path[0].z };
  if (t >= d.path[d.path.length - 1].t) {
    const w = d.path[d.path.length - 1];
    return { x: w.x, y: w.y, z: w.z };
  }
  for (let i = 1; i < d.path.length; i++) {
    if (d.path[i].t >= t) {
      const a = d.path[i - 1];
      const b = d.path[i];
      const k = (t - a.t) / Math.max(0.001, b.t - a.t);
      return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k };
    }
  }
  return null;
}

// ─── Minimal ZIP writer (store / no compression) ──────────────────────
// Avoids adding a new dependency. Skybrush importer accepts uncompressed ZIPs.

function crc32(bytes: Uint8Array): number {
  let table = (crc32 as unknown as { _t?: Uint32Array })._t;
  if (!table) {
    table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[i] = c >>> 0;
    }
    (crc32 as unknown as { _t?: Uint32Array })._t = table;
  }
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = table[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

interface ZipEntry { name: string; data: Uint8Array; crc: number; offset: number }

function buildZip(files: Array<{ name: string; content: string | Uint8Array }>): Blob {
  const enc = new TextEncoder();
  const entries: ZipEntry[] = [];
  const chunks: Uint8Array[] = [];
  let offset = 0;

  for (const f of files) {
    const data = typeof f.content === 'string' ? enc.encode(f.content) : f.content;
    const nameBytes = enc.encode(f.name);
    const crc = crc32(data);
    const local = new Uint8Array(30 + nameBytes.length);
    const dv = new DataView(local.buffer);
    dv.setUint32(0, 0x04034b50, true);
    dv.setUint16(4, 20, true); // version
    dv.setUint16(6, 0, true);  // flags
    dv.setUint16(8, 0, true);  // method = store
    dv.setUint16(10, 0, true); // mtime
    dv.setUint16(12, 0, true); // mdate
    dv.setUint32(14, crc, true);
    dv.setUint32(18, data.length, true);
    dv.setUint32(22, data.length, true);
    dv.setUint16(26, nameBytes.length, true);
    dv.setUint16(28, 0, true);
    local.set(nameBytes, 30);
    chunks.push(local, data);
    entries.push({ name: f.name, data, crc, offset });
    offset += local.length + data.length;
  }

  const cdStart = offset;
  for (const e of entries) {
    const nameBytes = enc.encode(e.name);
    const cd = new Uint8Array(46 + nameBytes.length);
    const dv = new DataView(cd.buffer);
    dv.setUint32(0, 0x02014b50, true);
    dv.setUint16(4, 20, true);
    dv.setUint16(6, 20, true);
    dv.setUint16(8, 0, true);
    dv.setUint16(10, 0, true);
    dv.setUint16(12, 0, true);
    dv.setUint16(14, 0, true);
    dv.setUint32(16, e.crc, true);
    dv.setUint32(20, e.data.length, true);
    dv.setUint32(24, e.data.length, true);
    dv.setUint16(28, nameBytes.length, true);
    dv.setUint32(42, e.offset, true);
    cd.set(nameBytes, 46);
    chunks.push(cd);
    offset += cd.length;
  }
  const cdSize = offset - cdStart;

  const eocd = new Uint8Array(22);
  const dv = new DataView(eocd.buffer);
  dv.setUint32(0, 0x06054b50, true);
  dv.setUint16(8, entries.length, true);
  dv.setUint16(10, entries.length, true);
  dv.setUint32(12, cdSize, true);
  dv.setUint32(16, cdStart, true);
  chunks.push(eocd);

  return new Blob(chunks as BlobPart[], { type: 'application/zip' });
}

const DISCLAIMER = `FX KONTROL · Skybrush Export Preview
=====================================

CLAIM: marketing_hypothesis

This package was generated by FX KONTROL Strategic Command Hub for
demo / investor / client preview purposes only.

The structure mirrors common drone-show conventions but has NOT been
validated against a live Skybrush server or Drotek importer. Do not
attempt to fly this package without a full re-export from a validated
Skybrush studio session.

For the validated path, see the FX KONTROL roadmap milestone
"AI Choreography Studio · Skybrush binding (pilot)".
`;

export function exportSkybrushPackage(scene: ChoreoScene, validation: ValidationReport): Blob {
  const manifest = {
    format: 'fxk-skybrush-preview',
    format_version: '0.1.0',
    claim: 'marketing_hypothesis',
    generated_at: new Date().toISOString(),
    title: scene.title,
    duration_s: scene.duration,
    drone_count: scene.drones.length,
    validation: {
      ok: validation.ok,
      issues_total: validation.issues.length,
      errors: validation.issues.filter((i) => i.severity === 'error').length,
      warnings: validation.issues.filter((i) => i.severity === 'warn').length,
    },
  };

  const dronesCsv = ['drone_id,t_s,x_m,y_m,z_m_agl,r,g,b'];
  for (const d of scene.drones) {
    const colorAt = (t: number) => {
      if (!d.color || !d.color.length) return { r: 1, g: 1, b: 1 };
      let last = d.color[0];
      for (const c of d.color) if (c.t <= t) last = c;
      return last;
    };
    for (const w of d.path) {
      const c = colorAt(w.t);
      dronesCsv.push(
        `${d.id},${w.t.toFixed(3)},${w.x.toFixed(3)},${w.y.toFixed(3)},${w.z.toFixed(3)},${c.r.toFixed(3)},${c.g.toFixed(3)},${c.b.toFixed(3)}`
      );
    }
  }

  return buildZip([
    { name: '_FXK_DISCLAIMER.txt', content: DISCLAIMER },
    { name: 'manifest.json', content: JSON.stringify(manifest, null, 2) },
    { name: 'show/drones.csv', content: dronesCsv.join('\n') },
    { name: 'validation/report.json', content: JSON.stringify(validation, null, 2) },
  ]);
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
