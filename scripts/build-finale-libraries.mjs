#!/usr/bin/env bun
/**
 * Pre-parses the 5 Finale libraries (Showven/Lidu/Magic/Winda/Amazon)
 * into a single canonical JSON consumed by src/data/effectsLibraries.
 *
 * Run manually after updating any xlsx in public/finale-libraries/.
 *   bun scripts/build-finale-libraries.mjs
 */
import * as XLSX from 'xlsx';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'public', 'finale-libraries');
const OUT = join(ROOT, 'src', 'data', 'effectsLibraries', 'generated');

const WINDA_TO_CANONICAL = {
  'Product ID': 'partNumber',
  'Description': 'description',
  'Caliber': 'size',
  'Prefire time': 'internalDelay',
  'Duration': 'duration',
  'Effect height': 'height',
  'Chain number of devices': 'numDevices',
  'Effect Color': 'color',
  'Effect Sub Type': 'subtype',
  'VDL description': 'vdl',
  'Mfg product ID': 'manufacturerPartNumber',
  'Manufacturer': 'manufacturer',
  'Choreography tab': 'partType',
  'Item price': 'stdPrice',
  'Category': 'category',
  'Custom Part Field': 'customPartField',
  'Notes': 'partNotes',
};

const SOURCES = [
  { id: 'showven', file: 'showven.xlsx', expectedManufacturer: 'Showven' },
  { id: 'lidu',    file: 'lidu.xlsx',    expectedManufacturer: 'Lidu' },
  { id: 'magic',   file: 'magic.xlsx',   expectedManufacturer: 'Magic' },
  { id: 'winda',   file: 'winda.xlsx',   expectedManufacturer: 'Winda' },
  { id: 'amazon',  file: 'amazon.xlsx',  expectedManufacturer: 'Amazon Fireworks' },
];

function normalizeRow(row, isWinda) {
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    if (v === null || v === undefined || v === '') continue;
    const key = isWinda ? (WINDA_TO_CANONICAL[k] ?? k) : k;
    out[key] = typeof v === 'string' ? v.trim() : v;
  }
  return out;
}

function parseLibrary({ id, file, expectedManufacturer }) {
  const buf = readFileSync(join(SRC, file));
  const wb = XLSX.read(buf);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rawRows = XLSX.utils.sheet_to_json(ws, { defval: '' });
  const isWinda = rawRows.length > 0 && Object.keys(rawRows[0]).includes('Product ID');
  const parts = rawRows
    .map((r) => normalizeRow(r, isWinda))
    .filter((r) => r.partNumber)
    .map((r) => ({
      ...r,
      manufacturer: r.manufacturer || expectedManufacturer,
      libraryId: id,
    }));
  return parts;
}

mkdirSync(OUT, { recursive: true });

const allParts = [];
const summary = {};

for (const src of SOURCES) {
  const parts = parseLibrary(src);
  summary[src.id] = parts.length;
  allParts.push(...parts);
  console.log(`[finale-libs] ${src.id}: ${parts.length} parts`);
}

writeFileSync(
  join(OUT, 'finaleLibrariesParts.json'),
  JSON.stringify({ version: 1, generatedAt: new Date().toISOString(), summary, parts: allParts }, null, 0),
);

const total = allParts.length;
console.log(`[finale-libs] total: ${total} parts → src/data/effectsLibraries/generated/finaleLibrariesParts.json`);
