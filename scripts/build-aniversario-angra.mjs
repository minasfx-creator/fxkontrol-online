#!/usr/bin/env node
/**
 * Build src/data/demoShows/aniversarioAngra.generated.json from a Finale 3D
 * firing-list CSV (FIRING_HEADER_ROW / FIRING_DATA_ROW format).
 *
 * Usage: node scripts/build-aniversario-angra.mjs <input.csv>
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const inPath = process.argv[2] || '/tmp/aniversario_angra.csv';
const outPath = join(__dirname, '..', 'src/data/demoShows/aniversarioAngra.generated.json');

// ─── Minimal RFC 4180 line splitter ─────────────────────────────────
function splitCsvLine(line) {
  const out = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') { inQ = false; }
      else { cur += ch; }
    } else {
      if (ch === ',') { out.push(cur); cur = ''; }
      else if (ch === '"') { inQ = true; }
      else { cur += ch; }
    }
  }
  out.push(cur);
  return out;
}

function caliberToMm(s) {
  if (!s) return 0;
  const t = s.trim();
  const mm = t.match(/^(\d+(?:\.\d+)?)\s*mm/i);
  if (mm) return Math.round(Number(mm[1]));
  const inch = t.match(/^(\d+(?:\.\d+)?)\s*"/);
  if (inch) return Math.round(Number(inch[1]) * 25.4);
  const n = Number(t.replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? Math.round(n) : 0;
}

const raw = readFileSync(inPath, 'utf-8').split(/\r?\n/).filter(Boolean);
const headerCols = splitCsvLine(raw[0]);
const colIdx = Object.fromEntries(headerCols.map((c, i) => [c.trim(), i]));

const cues = [];
const positionsMap = new Map(); // posName -> {x,y,z}

for (let i = 1; i < raw.length; i++) {
  const cols = splitCsvLine(raw[i]);
  if (cols[0] !== 'FIRING_DATA_ROW') continue;

  const time = Number(cols[colIdx['Ignition Event Time']]);
  const duration = Number(cols[colIdx['Duration']]) || 0;
  const coordStr = cols[colIdx['Coordinates']] || '';
  const coords = coordStr.trim().split(/\s+/).map(Number);
  const [x = 0, y = 0, z = 0, h = 0, p = 0, r = 0] = coords;
  const prefire = Number(cols[colIdx['Prefire Delay']]) || 0;
  const deviceDelay = Number(cols[colIdx['Device Delay']]) || 0;
  const effectName = cols[colIdx['Effect Name']] || '';
  const caliber = caliberToMm(cols[colIdx['Caliber']] || '');
  const category = cols[colIdx['Category']] || '';
  const posName = cols[colIdx['Position Name']] || `P-${i.toString().padStart(2, '0')}`;
  const vdl = cols[colIdx['Animation Description']] || '';
  const moduleAddr = cols[colIdx['Module Address']] || '';
  const slatAddr = cols[colIdx['Slat Address']] || '';
  const pinAddr = cols[colIdx['Pin Address']] || '';
  const notes = cols[colIdx['Firing Notes']] || '';
  const moduleDesc = cols[colIdx['Module Description']] || '';
  const anglesStr = cols[colIdx['Angles']] || '';
  const heading = anglesStr ? Number(anglesStr.split(/\s+/)[0]) || h : h;

  cues.push({
    time,
    duration,
    prefire,
    deviceDelay,
    effectName,
    caliber,
    category,
    posName,
    vdl,
    moduleDesc,
    moduleAddr: Number(moduleAddr) || 0,
    slatAddr: Number(slatAddr) || 1,
    pinAddr: Number(pinAddr) || 0,
    heading,
    pitch: p,
    roll: r,
    x, y, z,
    notes,
  });

  if (!positionsMap.has(posName)) {
    positionsMap.set(posName, { x, y, z });
  }
}

cues.sort((a, b) => a.time - b.time);

const positions = [...positionsMap.entries()].map(([name, p]) => ({
  name,
  x: p.x,
  y: p.y,
  z: p.z,
}));

const lastEnd = cues.reduce((m, c) => Math.max(m, c.time + (c.duration || 0)), 0);
const duration = Math.ceil(lastEnd + 5);

const moduleAddrs = [...new Set(cues.map(c => c.moduleAddr).filter(n => n > 0))].sort((a, b) => a - b);

const out = {
  id: 'aniversario-angra-2024',
  name: 'Aniversário Angra',
  source: 'Finale 3D firing CSV (user-imported)',
  provenance: 'pilot',
  durationS: duration,
  totalCues: cues.length,
  moduleAddrs,
  positions,
  cues,
};

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log(`Wrote ${outPath}`);
console.log(`  cues=${cues.length} positions=${positions.length} duration=${duration}s modules=[${moduleAddrs.join(',')}]`);
