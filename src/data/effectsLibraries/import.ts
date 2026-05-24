/**
 * ─── Finale Part Library Importer ──────────────────────────────────
 * Single canonical entry point for importing Finale 3D part libraries.
 * Accepts either:
 *   - XLSX (canonical 35-col headers OR Winda "Display Names")
 *   - JSON `{ manufacturer, slug, parts: FinalePart[] }`
 *
 * Always returns a normalized `FinaleLibrary` plus parser warnings.
 */

import * as XLSX from 'xlsx';
import {
  type FinaleLibrary,
  type FinalePart,
  FINALE_PART_COLUMNS,
  FINALE_NUMERIC_KEYS,
  WINDA_DISPLAY_TO_CANONICAL,
} from './finalePart';

const CANON = new Set<string>(FINALE_PART_COLUMNS as readonly string[]);

export interface ImportResult {
  library: FinaleLibrary;
  warnings: string[];
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'library';
}

function coerce(key: string, value: unknown): unknown {
  if (value === '' || value == null) return undefined;
  if (FINALE_NUMERIC_KEYS.has(key)) {
    const n = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(n)) return undefined;
    return Number.isInteger(n) ? n : Math.round(n * 10000) / 10000;
  }
  if (typeof value === 'string') {
    const t = value.trim();
    return t.length ? t : undefined;
  }
  return value;
}

function normalizeRow(raw: Record<string, unknown>, headerMap: Record<string, string>): FinalePart | null {
  const out: Record<string, unknown> = {};
  for (const [src, val] of Object.entries(raw)) {
    const target = headerMap[src];
    if (!target || !CANON.has(target)) continue;
    const v = coerce(target, val);
    if (v !== undefined) out[target] = v;
  }
  if (!out.partNumber) return null;
  out.partNumber = String(out.partNumber).trim();
  return out as unknown as FinalePart;
}

function buildHeaderMap(headers: string[]): { map: Record<string, string>; isWinda: boolean } {
  const map: Record<string, string> = {};
  let windaHits = 0;
  for (const h of headers) {
    if (CANON.has(h)) { map[h] = h; continue; }
    const winda = WINDA_DISPLAY_TO_CANONICAL[h];
    if (winda) { map[h] = winda; windaHits++; }
  }
  return { map, isWinda: windaHits >= 5 };
}

export interface ImportOptions {
  /** Override slug (default: derived from manufacturer or filename). */
  slug?: string;
  /** Fallback manufacturer when row-level `manufacturer` is missing. */
  manufacturer?: string;
}

export function parseFinalePartsWorkbook(wb: XLSX.WorkBook, opts: ImportOptions = {}): ImportResult {
  const warnings: string[] = [];
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error('Workbook has no sheets');
  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  if (!rows.length) throw new Error('Sheet is empty');

  const headers = Object.keys(rows[0]);
  const { map, isWinda } = buildHeaderMap(headers);
  if (isWinda) warnings.push('Detected Winda "Display Names" — applied canonical mapping.');
  const unmapped = headers.filter((h) => !map[h]);
  if (unmapped.length) warnings.push(`Ignored ${unmapped.length} unmapped column(s): ${unmapped.slice(0, 5).join(', ')}${unmapped.length > 5 ? '…' : ''}`);

  const parts: FinalePart[] = [];
  const seen = new Set<string>();
  let skipped = 0;
  for (const r of rows) {
    const part = normalizeRow(r, map);
    if (!part) { skipped++; continue; }
    if (seen.has(part.partNumber)) { warnings.push(`Duplicate partNumber "${part.partNumber}" — last wins`); }
    seen.add(part.partNumber);
    if (!part.manufacturer && opts.manufacturer) part.manufacturer = opts.manufacturer;
    parts.push(part);
  }
  if (skipped) warnings.push(`Skipped ${skipped} row(s) without partNumber.`);

  const manufacturer = opts.manufacturer
    ?? parts.find((p) => p.manufacturer)?.manufacturer
    ?? 'Unknown';
  const slug = opts.slug ?? slugify(String(manufacturer));

  return {
    library: { manufacturer: String(manufacturer), slug, count: parts.length, parts },
    warnings,
  };
}

export async function parseFinalePartsXlsx(file: Blob | ArrayBuffer, opts: ImportOptions = {}): Promise<ImportResult> {
  const buf = file instanceof ArrayBuffer ? file : await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  return parseFinalePartsWorkbook(wb, opts);
}

export function parseFinalePartsJson(text: string, opts: ImportOptions = {}): ImportResult {
  const data = JSON.parse(text) as Partial<FinaleLibrary> & { parts?: unknown };
  if (!Array.isArray(data.parts)) throw new Error('JSON missing `parts` array');
  const warnings: string[] = [];
  const parts: FinalePart[] = [];
  const seen = new Set<string>();
  for (const raw of data.parts as unknown as Record<string, unknown>[]) {
    const map: Record<string, string> = {};
    for (const k of Object.keys(raw)) if (CANON.has(k)) map[k] = k;
    const part = normalizeRow(raw, map);
    if (!part) continue;
    if (seen.has(part.partNumber)) warnings.push(`Duplicate partNumber "${part.partNumber}" — last wins`);
    seen.add(part.partNumber);
    parts.push(part);
  }
  const manufacturer = data.manufacturer ?? opts.manufacturer ?? 'Unknown';
  const slug = data.slug ?? opts.slug ?? slugify(manufacturer);
  return {
    library: { manufacturer, slug, count: parts.length, parts },
    warnings,
  };
}
