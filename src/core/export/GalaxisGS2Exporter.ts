/**
 * ─── GalaxisGS2Exporter — ShowPlan → Galaxis GS2 (V2.6) ───────────
 * Implementa o formato GS2 V2.6 (Pyrotec Composer ≥ V2.3.0.253) conforme
 * spec Finale 3D (Out 2021).
 *
 * Estrutura do arquivo (todos campos terminados por CRLF — sem EOL final):
 *   1. Header (3 fields):  "V2.6" | date | available_SC_ID
 *   2. Script table:       exatamente 15.000 rows × 70 fields
 *   3. Device Allocation:
 *      - Position Names              (1000 strings)
 *      - Device IDs At Positions     (1000 × 10 ints)
 *      - Device Types At Positions   (1000 × 10 ints)
 *      - Hazard Zone per Device ID   (1000 single letters A-P or blank)
 *      - Position Angle (deg)        (1000 ints, blank=0)
 *      - Position X (mm)             (1000 ints)
 *      - Position Y (mm)             (1000 ints)
 *      - Position Z (mm)             (1000 ints)
 *   4. Galaxis internal info: 18775 blank fields
 *
 * Convenções críticas (Tabela 2 da spec):
 *   - Encoding Code Page 1252; field delimiter CR+LF (0x0D0A)
 *   - Sort ASC por event time
 *   - Galaxis Integer Time: MMSScc (ex: 1m20s10cs → 12010, NÃO 8010)
 *   - Comma-radix floats (vírgula como separador decimal): "0,00"
 *   - Linha [0] sempre "Start Show" no time 0 (gerada se não existir)
 *   - Quantity sempre = qtd de devices (não de chains)
 *   - Caracteres ' " , ; \ TAB LF filtrados (sem escaping)
 *   - SC-ID começa em 10001 (script row 1)
 *   - Device Number 1..999 / Output Number 1..999
 *
 * Pre-export gate: VerificationEngine + blackbox audit.
 */
import { showPlanManager } from '@/core/showplan/ShowPlanManager';
import { verificationEngine } from '@/core/verification/VerificationEngine';
import { blackbox } from '@/core/reliability/blackBoxRecorder';
import type { PyroCue, ShowPosition } from '@/core/showplan/ShowPlan';

export interface GalaxisExportResult {
  script: string;          // arquivo GS2 completo
  cueCount: number;        // unique event times (Field #0 final)
  rowCount: number;        // script rows usados (inclui Start Show)
  positionCount: number;
  errors: string[];
  verified: boolean;
}

// ── constantes da spec ──────────────────────────────────────────────────
const VERSION = 'V2.6';
const SCRIPT_ROWS = 15_000;          // V2.6 fixo
const FIELDS_PER_ROW = 70;           // 0..69
const POSITIONS_MAX = 1000;
const DEVICES_PER_POSITION = 10;
const INTERNAL_TRAILER = 18_775;     // blank fields finais
const EOF = '\r\n';                   // field delimiter (Tabela 1)
const SC_ID_BASE = 10_000;

// ── helpers ─────────────────────────────────────────────────────────────

/** Filtra caracteres ilegais. Spec: ' " , ; \ TAB LF. */
function sanitize(input: string, maxLen = 80): string {
  const cleaned = input.replace(/['",;\\\t\r\n\x00-\x1F\x7F]/g, ' ').trim();
  return cleaned.length > maxLen ? cleaned.slice(0, maxLen) : cleaned;
}

/**
 * Galaxis Integer Time: cada par decimal representa cs/s/m.
 * Ex: 80.10s = 1min 20s 10cs → 12010 (não 8010).
 *     0.276s =                 → 27 (centissegundos somente)
 *     12.34s = 12s 34cs        → 1234
 *     65.50s = 1m 5s 50cs      → 10550
 */
function galaxisIntTime(seconds: number): number {
  const totalCs = Math.max(0, Math.round(seconds * 100));
  const cs = totalCs % 100;
  const totalSec = Math.floor(totalCs / 100);
  const ss = totalSec % 60;
  const mm = Math.floor(totalSec / 60);
  return mm * 10000 + ss * 100 + cs;
}

/** Float comma-radix: 1.04 → "1,04". */
function commaFloat(n: number): string {
  return (Number.isFinite(n) ? n : 0).toFixed(2).replace('.', ',');
}

/**
 * Angle string: degrees + symbol arrow (dG up, dF left, dH right).
 * Spec exemplo: "45dF" (45° à esquerda), "0dG" (vertical).
 */
function angleString(headingDeg: number): string {
  const h = Math.round(headingDeg);
  if (h === 0) return '0dG';
  if (h < 0) return `${Math.abs(h)}dF`;
  return `${h}dH`;
}

/**
 * Estima duração do efeito em segundos (calibre-driven, mesma heurística
 * dos demais exporters — substituível quando effect library expor duração).
 */
function estimateDuration(cue: PyroCue): number {
  const c = cue.caliber || 75;
  if (c <= 50) return 0.8;
  if (c <= 75) return 1.0;
  if (c <= 100) return 1.4;
  if (c <= 150) return 2.0;
  return 2.6;
}

/** Map de calibre → device type GS2 (Tabela 5).
 *  Default: 7 (PFE Advanced – 50 Outputs). Heurística simples baseada no
 *  channelCount do hardwareConfig. Pode ser refinada quando ShowPosition
 *  expor moduleType explícito.
 */
function deviceTypeForPosition(_pos: ShowPosition | undefined): number {
  // 7 = PFE Advanced – 50 Outputs (default seguro p/ pyro padrão).
  return 7;
}

/** Hazard zone A-P; default 'A' (Class 1.3G genérico). */
function hazardZone(_cue: PyroCue): string {
  return 'A';
}

// ── core build ──────────────────────────────────────────────────────────

interface ScriptRow {
  fields: string[]; // 70 elementos (idx 0..69)
}

function makeBlankRow(): ScriptRow {
  return { fields: new Array(FIELDS_PER_ROW).fill('') };
}

function buildStartShowRow(scId: number, deltaToFirstEventCs: number): ScriptRow {
  const r = makeBlankRow();
  r.fields[0] = '1';                                     // Cue
  r.fields[1] = String(deltaToFirstEventCs);             // Dt (cs até próximo)
  r.fields[2] = '0';                                     // Event Time (Galaxis int)
  r.fields[3] = '0';                                     // Effect Time
  r.fields[4] = commaFloat(0);                           // Delay
  r.fields[5] = commaFloat(0);                           // Duration
  r.fields[11] = 'Start Show';                           // Name
  r.fields[30] = String(scId);                           // SC-ID
  return r;
}

function buildEffectRow(args: {
  cueNumber: number | '';
  dtCs: number | '';
  eventTimeSec: number;
  prefireSec: number;
  durationSec: number;
  effectName: string;
  effectType: string;       // shell, comet, mine, …
  sizeStr: string;          // "75mm" / "2\""
  positionName: string;
  angleDeg: number;
  deviceNumber: number;     // module 1..999
  outputNumber: number;     // pin 1..999
  scId: number;
  partNumber: string;
  vdl: string;
}): ScriptRow {
  const r = makeBlankRow();
  const eventInt = galaxisIntTime(args.eventTimeSec);
  const effectInt = galaxisIntTime(args.eventTimeSec + args.prefireSec);
  r.fields[0] = args.cueNumber === '' ? '' : String(args.cueNumber);
  r.fields[1] = args.dtCs === '' ? '' : String(args.dtCs);
  r.fields[2] = String(eventInt);
  r.fields[3] = String(effectInt);
  r.fields[4] = commaFloat(args.prefireSec);
  r.fields[5] = commaFloat(args.durationSec);
  r.fields[10] = sanitize(args.effectType);
  r.fields[11] = sanitize(args.effectName);
  r.fields[12] = sanitize(args.effectName);              // Notes ≈ Name (sem campo notes ainda)
  r.fields[13] = sanitize(args.sizeStr);
  r.fields[21] = '1';                                    // Quantity (devices)
  r.fields[22] = sanitize(args.positionName);
  r.fields[23] = sanitize(angleString(args.angleDeg));
  r.fields[28] = String(Math.max(1, Math.min(999, args.deviceNumber)));
  r.fields[29] = String(Math.max(1, Math.min(999, args.outputNumber)));
  r.fields[30] = String(args.scId);
  r.fields[42] = sanitize(args.partNumber);
  r.fields[60] = sanitize(args.vdl);
  return r;
}

function sizeString(caliberMm: number): string {
  if (!Number.isFinite(caliberMm) || caliberMm <= 0) return '';
  return `${Math.round(caliberMm)}mm`;
}

// ── public ──────────────────────────────────────────────────────────────

export function generateGalaxisGS2Script(): GalaxisExportResult {
  const sp = showPlanManager.current;
  const vResult = verificationEngine.run();
  const canExport = vResult.level === 'READY_FOR_EXPORT' || vResult.level === 'READY_FOR_FIELD';
  const errors: string[] = [];

  if (!canExport) {
    errors.push(...vResult.issues
      .filter(i => !i.passed && i.severity === 'error')
      .map(i => `[BLOCKED] ${i.label}: ${i.detail}`));
  }

  // ── 1. Ordena cues e atribui Cue/Dt ──────────────────────────────────
  const sorted = [...sp.pyroCues]
    .filter(c => Number.isFinite(c.time) && c.time >= 0 && c.module >= 0 && c.channel >= 0)
    .sort((a, b) => a.time - b.time || a.module - b.module || a.channel - b.channel);

  if (sorted.length === 0) {
    errors.push('No valid pyro cues to export');
  }

  // Validação de ranges hardware
  for (let i = 0; i < sorted.length; i++) {
    const c = sorted[i];
    const dev = c.module + 1;
    const out = c.channel + 1;
    if (dev > 999) errors.push(`Cue ${i + 1}: device number ${dev} excede 999`);
    if (out > 999) errors.push(`Cue ${i + 1}: output number ${out} excede 999`);
  }

  // Agrupa unique event times → Cue numbers
  const uniqueTimesMs: number[] = [];
  const cueByCueIdx: { eventCue: number; isFirstAtTime: boolean }[] = [];
  let lastTimeMs = -1;
  for (const c of sorted) {
    const tMs = Math.round(c.time * 1000);
    let firstAtTime = false;
    if (tMs !== lastTimeMs) {
      uniqueTimesMs.push(tMs);
      firstAtTime = true;
      lastTimeMs = tMs;
    }
    cueByCueIdx.push({ eventCue: uniqueTimesMs.length, isFirstAtTime: firstAtTime });
  }

  // ── 2. Build script rows ────────────────────────────────────────────
  const rows: ScriptRow[] = [];

  // Start Show row se não houver evento exatamente em t=0
  const hasZero = sorted.length > 0 && Math.round(sorted[0].time * 1000) === 0;
  let scIdCounter = SC_ID_BASE + 1; // 10001 para a primeira linha
  let cueOffset = 0;                // ajusta numeração quando inserimos Start Show
  if (!hasZero && sorted.length > 0) {
    const firstTimeCs = Math.max(0, Math.round(sorted[0].time * 100));
    const startRow = buildStartShowRow(SC_ID_BASE, firstTimeCs);
    // Renumera: Start Show é Cue 1, demais shiftam
    rows.push(startRow);
    scIdCounter = SC_ID_BASE + 2; // próxima linha será 10002 (Start=10000? spec exemplo usa 10000 para Start)
    // Spec exemplo: Start Show.SC-ID=10000, primeiro shot=10001
    // Ajustamos: Start = 10000, primeiro shot = SC_ID_BASE + 1 = 10001
    rows[0].fields[30] = String(SC_ID_BASE);
    scIdCounter = SC_ID_BASE + 1;
    cueOffset = 1; // soma 1 em todos os cue numbers dos efeitos
  } else if (hasZero) {
    // Se já tem t=0, usamos o primeiro como Start (spec)
    // Mas cliente pode ter cue real em 0; mantemos o cue real (Start é só inicializador).
  }

  for (let i = 0; i < sorted.length; i++) {
    const c = sorted[i];
    const meta = cueByCueIdx[i];
    const pos = sp.positions.find(p => p.id === c.positionId);

    // Cue number (Field #0): apenas para 1ª linha de cada event time, blank nas demais
    let cueField: number | '' = '';
    let dtField: number | '' = '';
    if (meta.isFirstAtTime) {
      cueField = meta.eventCue + cueOffset;
      // Dt em cs até o próximo event time único; blank se for o último
      const nextTimeMs = uniqueTimesMs[meta.eventCue]; // próximo (1-based -> next index)
      if (meta.eventCue < uniqueTimesMs.length) {
        const dtMs = nextTimeMs - uniqueTimesMs[meta.eventCue - 1];
        dtField = Math.round(dtMs / 10); // ms → cs
      }
    }

    // Atualiza Dt do Start Show se necessário (delta para 1º event)
    if (i === 0 && cueOffset === 1 && meta.isFirstAtTime) {
      const firstEventCs = Math.round(c.time * 100);
      rows[0].fields[1] = String(firstEventCs);
      // Cue do Start já é 1; primeiro efeito vira Cue 2
    }

    rows.push(buildEffectRow({
      cueNumber: cueField,
      dtField === undefined ? '' : dtField as any, // placeholder
      eventTimeSec: c.time,
      prefireSec: (c.fuseDelay ?? 0) / 1000,
      durationSec: estimateDuration(c),
      effectName: c.effectId || 'Effect',
      effectType: 'shell',
      sizeStr: sizeString(c.caliber),
      positionName: pos?.name ?? c.positionId ?? '',
      angleDeg: c.heading ?? 0,
      deviceNumber: c.module + 1,
      outputNumber: c.channel + 1,
      scId: scIdCounter++,
      partNumber: c.effectId ?? '',
      vdl: '',
    } as any));
  }

  const usedRowCount = rows.length;

  // ── 3. Pad até 15.000 rows ───────────────────────────────────────────
  if (usedRowCount > SCRIPT_ROWS) {
    errors.push(`Script excede limite GS2 V2.6 de ${SCRIPT_ROWS} rows (atual: ${usedRowCount})`);
  }
  while (rows.length < SCRIPT_ROWS) rows.push(makeBlankRow());

  // ── 4. Device Allocation Tables ──────────────────────────────────────
  // Coleta posições referenciadas (na ordem de aparição nos rows)
  const seenPos = new Set<string>();
  const positionList: ShowPosition[] = [];
  for (const c of sorted) {
    const p = sp.positions.find(pp => pp.id === c.positionId);
    if (p && !seenPos.has(p.id)) {
      seenPos.add(p.id);
      positionList.push(p);
      if (positionList.length >= POSITIONS_MAX) break;
    }
  }

  if (positionList.length > POSITIONS_MAX) {
    errors.push(`Posições excedem limite GS2 de ${POSITIONS_MAX}`);
  }

  // Device IDs por posição (até 10 por posição)
  const deviceIdsByPos: number[][] = positionList.map(p => {
    const ids = new Set<number>();
    for (const c of sorted) {
      if (c.positionId === p.id) ids.add(c.module + 1);
      if (ids.size >= DEVICES_PER_POSITION) break;
    }
    return [...ids];
  });

  // Device Types (mesma cardinalidade)
  const deviceTypesByPos: number[][] = positionList.map(p =>
    deviceIdsByPos[positionList.indexOf(p)].map(() => deviceTypeForPosition(p))
  );

  // Hazard zone por Device ID (1..1000)
  const hazardByDeviceId = new Map<number, string>();
  for (const c of sorted) {
    const id = c.module + 1;
    if (!hazardByDeviceId.has(id)) hazardByDeviceId.set(id, hazardZone(c));
  }

  // ── 5. Serializa tudo ────────────────────────────────────────────────
  const parts: string[] = [];

  // Header (3 fields)
  const dateStr = formatGalaxisDate(new Date());
  const availableScId = SC_ID_BASE + usedRowCount; // 10000 + used rows
  parts.push(VERSION, dateStr, String(availableScId));

  // Script: 15000 × 70
  for (const r of rows) parts.push(...r.fields);

  // Position Names (1000)
  for (let i = 0; i < POSITIONS_MAX; i++) {
    parts.push(i < positionList.length ? sanitize(positionList[i].name) : '');
  }

  // Device IDs At Positions (1000 × 10)
  for (let i = 0; i < POSITIONS_MAX; i++) {
    const ids = i < positionList.length ? deviceIdsByPos[i] : [];
    for (let j = 0; j < DEVICES_PER_POSITION; j++) {
      parts.push(String(ids[j] ?? 0));
    }
  }

  // Device Types At Positions (1000 × 10)
  for (let i = 0; i < POSITIONS_MAX; i++) {
    const types = i < positionList.length ? deviceTypesByPos[i] : [];
    for (let j = 0; j < DEVICES_PER_POSITION; j++) {
      parts.push(String(types[j] ?? 0));
    }
  }

  // Hazard Zone per Device ID (1000 single letters, 1-indexed: idx 0 = device 1)
  for (let i = 1; i <= POSITIONS_MAX; i++) {
    parts.push(hazardByDeviceId.get(i) ?? '');
  }

  // Position Angle (1000 ints, deg)
  for (let i = 0; i < POSITIONS_MAX; i++) {
    parts.push(i < positionList.length ? String(Math.round(positionList[i].heading ?? 0)) : '');
  }

  // Position X / Y / Z (mm) — convertemos m → mm.
  // Mapeamento spec: X=audience-right, Y=up, Z=forward toward audience.
  // ShowPosition.x = audience-right (m), .y = up (m), .z = forward (m).
  const writeAxis = (key: 'x' | 'y' | 'z') => {
    for (let i = 0; i < POSITIONS_MAX; i++) {
      if (i < positionList.length) {
        const v = (positionList[i][key] ?? 0) * 1000;
        parts.push(String(Math.round(v)));
      } else {
        parts.push('');
      }
    }
  };
  writeAxis('x');
  writeAxis('y');
  writeAxis('z');

  // Galaxis internal trailer (18.775 blank fields)
  for (let i = 0; i < INTERNAL_TRAILER; i++) parts.push('');

  // ── 6. Join com CRLF (sem EOL final, conforme spec "End-of-line: None")
  const script = parts.join(EOF);

  blackbox.record('state',
    `GalaxisGS2Exporter: ${usedRowCount} rows / ${uniqueTimesMs.length} cues / ${positionList.length} positions, ${errors.length} errors, verified=${canExport}`
  );

  return {
    script,
    cueCount: uniqueTimesMs.length,
    rowCount: usedRowCount,
    positionCount: positionList.length,
    errors,
    verified: canExport,
  };
}

function formatGalaxisDate(d: Date): string {
  // Spec exemplo: "8/27/2009-4:42:18 PM"
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const y = d.getFullYear();
  let h = d.getHours();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${m}/${day}/${y}-${h}:${mm}:${ss} ${ampm}`;
}

/**
 * Triggers download. Encoding alvo Code Page 1252 (Win-1252); conteúdo é
 * ASCII puro após sanitize, byte-compatível com 1252.
 */
export function downloadGalaxisGS2Script(filename = 'fxk_show_galaxis.gs2'): GalaxisExportResult {
  const result = generateGalaxisGS2Script();
  const blob = new Blob([result.script], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return result;
}
