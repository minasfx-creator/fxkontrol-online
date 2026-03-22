/**
 * FireOne Script Parser — UltraFire CSV / FIR / SCL interchange
 * 
 * Supports:
 * - Official FireOne CSV format (import/export)
 * - Pipe-delimited FIR/SEM text exports (import only)
 * - ScriptMaker Visual .ses session files (import only)
 * - Flames Launcher CSV (import/export)
 * - SCL (Show Cue List) from Flames Launcher wizard (import only)
 * - Maps between FireOne Slat/Cue numbering and internal Module/Igniter addressing
 */

import type { AutoFireCue } from '@/components/editor/live-firing/types';

// ═══════════════════════════════════════════════════════════
// CSV COLUMN DEFINITIONS (FireOne official format)
// ═══════════════════════════════════════════════════════════

const CSV_HEADERS = [
  'Row ID', 'Launch Time', 'Delay', 'Event', 'Module', 'Cue',
  'Quantity', 'Size', 'Duration', 'Product ID', 'DMX Channel',
  'DMX Value', 'DMX Duration', 'DMX Rate', 'Description',
  'Comment', 'Priority', 'Position'
] as const;

export interface FireOneCSVRow {
  rowId: number;
  launchTime: string;     // "MM:SS.mmm" or "HH:MM:SS.mmm"
  delay: number;          // ms
  event: number;          // 0 = single trigger, 1-999 = semi-auto group
  module: number;         // Slat address (1-40 per XLII+ manual)
  cue: number | null;     // Pin (1-32), null = DMX command
  quantity: number;
  size: string;
  duration: number;       // seconds
  productId: string;
  dmxChannel: number | null;
  dmxValue: number | null;
  dmxDuration: number | null;
  dmxRate: number | null;
  description: string;
  comment: string;
  priority: number;
  position: string;
}

// ═══════════════════════════════════════════════════════════
// TIME PARSING
// ═══════════════════════════════════════════════════════════

function parseTimeToMs(timeStr: string): number {
  if (!timeStr || timeStr.trim() === '') return 0;
  const cleaned = timeStr.trim();

  // HH:MM:SS.mmm or MM:SS.mmm or SS.mmm
  const parts = cleaned.split(':');
  let totalSeconds = 0;

  if (parts.length === 3) {
    totalSeconds = parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseFloat(parts[2]);
  } else if (parts.length === 2) {
    totalSeconds = parseInt(parts[0]) * 60 + parseFloat(parts[1]);
  } else {
    totalSeconds = parseFloat(parts[0]) || 0;
  }

  return Math.round(totalSeconds * 1000);
}

function msToTimeStr(ms: number): string {
  const totalSec = ms / 1000;
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${String(mins).padStart(2, '0')}:${secs.toFixed(3).padStart(6, '0')}`;
}

// ═══════════════════════════════════════════════════════════
// CSV PARSER
// ═══════════════════════════════════════════════════════════

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

/** Parse FireOne CSV text into AutoFireCue array */
export function parseFireOneCSV(text: string): AutoFireCue[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length < 2) return [];

  // Skip header line
  const dataLines = lines.slice(1);
  const cues: AutoFireCue[] = [];

  dataLines.forEach((line, idx) => {
    const cols = parseCSVLine(line);
    if (cols.length < 6) return;

    const module = parseInt(cols[4]) || 0;
    const cuePin = cols[5]?.trim();
    const isDmx = !cuePin || cuePin === '';
    const timecodeMs = parseTimeToMs(cols[1] || '');
    const duration = parseFloat(cols[8]) || 0.5;
    const description = cols[14] || cols[9] || '';
    const event = parseInt(cols[3]) || 0;
    const priority = parseInt(cols[16]) || 0;

    cues.push({
      id: `fone-${idx + 1}`,
      cueNumber: idx + 1,
      device: isDmx ? 'dmx' : 'pyro',
      name: description || `Module ${module} ${isDmx ? 'DMX' : `Pin ${cuePin}`}`,
      state: 'ready',
      timecodeMs,
      addresses: isDmx
        ? `${cols[10] || '0'}` // DMX channel as address
        : `${(module - 1) * 32 + (parseInt(cuePin!) - 1)}`, // Flat igniter index
      mode: event > 0 ? 'ltr' : 'sync',
      effect: isDmx ? `DMX Ch${cols[10]} Val${cols[11]}` : description,
      duration,
      prefire: (parseFloat(cols[2]) || 0) / 1000, // delay → prefire in seconds
      trigger: 0,
      triggerSource: 'manual',
      eventNumber: event > 0 ? event : undefined,
      priority: priority > 0 ? priority : undefined,
    });
  });

  return cues;
}

// ═══════════════════════════════════════════════════════════
// CSV EXPORTER
// ═══════════════════════════════════════════════════════════

/** Export AutoFireCue array to FireOne CSV format */
export function exportFireOneCSV(cues: AutoFireCue[]): string {
  const header = CSV_HEADERS.join(',');
  const rows = cues.map((cue, idx) => {
    const addrs = cue.addresses.split(':').map(Number);
    const firstAddr = addrs[0] || 0;

    // Map flat igniter index back to module/pin
    const module = cue.device === 'pyro' ? Math.floor(firstAddr / 32) + 1 : 0;
    const pin = cue.device === 'pyro' ? (firstAddr % 32) + 1 : '';

    const cols = [
      idx + 1,                              // Row ID
      msToTimeStr(cue.timecodeMs),          // Launch Time
      Math.round(cue.prefire * 1000),       // Delay (ms)
      cue.eventNumber ?? 0,                 // Event
      module || '',                          // Module (Slat)
      pin,                                   // Cue (Pin)
      1,                                     // Quantity
      '',                                    // Size
      cue.duration,                          // Duration
      '',                                    // Product ID
      cue.device === 'dmx' ? firstAddr : '', // DMX Channel
      cue.device === 'dmx' ? 255 : '',      // DMX Value
      cue.device === 'dmx' ? cue.duration : '', // DMX Duration
      '',                                    // DMX Rate
      `"${cue.name.replace(/"/g, '""')}"`,  // Description
      `"${cue.effect.replace(/"/g, '""')}"`, // Comment
      cue.priority ?? 0,                    // Priority
      '',                                    // Position
    ];

    return cols.join(',');
  });

  return [header, ...rows].join('\n');
}

// ═══════════════════════════════════════════════════════════
// FIR PARSER (pipe-delimited text export from Finale 3D)
// ═══════════════════════════════════════════════════════════

/** Parse pipe-delimited FIR/SEM text export */
export function parseFireOneFIR(text: string): AutoFireCue[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0 && !l.startsWith('#'));
  const cues: AutoFireCue[] = [];

  lines.forEach((line, idx) => {
    const parts = line.split('|').map(p => p.trim());
    if (parts.length < 4) return;

    // FIR format: LaunchTimeMS|Slat|Cue|Description|ProductNumber|Size|Position|Event
    const timecodeMs = parseInt(parts[0]) || 0;
    const slat = parseInt(parts[1]) || 1;
    const cuePin = parseInt(parts[2]) || 1;
    const description = parts[3] || '';
    const event = parts.length >= 8 ? (parseInt(parts[7]) || 0) : 0;

    cues.push({
      id: `fir-${idx + 1}`,
      cueNumber: idx + 1,
      device: 'pyro',
      name: description || `Slat ${slat} Cue ${cuePin}`,
      state: 'ready',
      timecodeMs,
      addresses: `${(slat - 1) * 32 + (cuePin - 1)}`,
      mode: 'sync',
      effect: description,
      duration: 0.5,
      prefire: 0,
      trigger: 0,
      triggerSource: 'manual',
      eventNumber: event > 0 ? event : undefined,
    });
  });

  return cues;
}

/** Download a string as a file */
export function downloadFile(content: string, filename: string, mimeType = 'text/csv'): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ═══════════════════════════════════════════════════════════
// SCRIPTMAKER VISUAL SESSION PARSER (.ses)
// ═══════════════════════════════════════════════════════════

/** Parse ScriptMaker Visual .ses session files */
export function parseScriptMakerSession(text: string): AutoFireCue[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0 && !l.startsWith(';') && !l.startsWith('//'));
  const cues: AutoFireCue[] = [];

  lines.forEach((line, idx) => {
    // SES format: TIME_MS,MODULE,CUE,PRODUCT_CODE,DESCRIPTION,QTY,SIZE,POSITION,ANGLE
    const parts = line.split(',').map(p => p.trim());
    if (parts.length < 5) return;

    const timecodeMs = parseInt(parts[0]) || 0;
    const module = parseInt(parts[1]) || 1;
    const cuePin = parseInt(parts[2]) || 1;
    const productCode = parts[3] || '';
    const description = parts[4] || '';

    cues.push({
      id: `ses-${idx + 1}`,
      cueNumber: idx + 1,
      device: 'pyro',
      name: description || `${productCode} M${module}/C${cuePin}`,
      state: 'ready',
      timecodeMs,
      addresses: `${(module - 1) * 32 + (cuePin - 1)}`,
      mode: 'sync',
      effect: productCode,
      duration: 0.5,
      prefire: 0,
      trigger: 0,
      triggerSource: 'manual',
    });
  });

  return cues;
}

// ═══════════════════════════════════════════════════════════
// FLAMES LAUNCHER DMX PARSER
// ═══════════════════════════════════════════════════════════

/** Parse Flames Launcher DMX choreography CSV */
export function parseFlamesLauncherCSV(text: string): AutoFireCue[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length < 2) return [];

  const dataLines = lines.slice(1);
  const cues: AutoFireCue[] = [];

  dataLines.forEach((line, idx) => {
    // Flames format: CueID,TimeMS,DMXChannel,DMXValue,Duration,Effect,DeviceName
    const parts = parseCSVLine(line);
    if (parts.length < 5) return;

    const timecodeMs = parseInt(parts[1]) || 0;
    const dmxChannel = parseInt(parts[2]) || 1;
    const dmxValue = parseInt(parts[3]) || 255;
    const duration = parseFloat(parts[4]) || 0.2;
    const effect = parts[5] || 'JET';
    const deviceName = parts[6] || `Flame Ch${dmxChannel}`;

    cues.push({
      id: `flames-${idx + 1}`,
      cueNumber: idx + 1,
      device: 'dmx',
      name: deviceName,
      state: 'ready',
      timecodeMs,
      addresses: `${dmxChannel}`,
      mode: 'sync',
      effect: `${effect} Val${dmxValue}`,
      duration,
      prefire: 0,
      trigger: 0,
      triggerSource: 'manual',
    });
  });

  return cues;
}

/** Export cues to Flames Launcher CSV */
export function exportFlamesLauncherCSV(cues: AutoFireCue[]): string {
  const header = 'CueID,TimeMS,DMXChannel,DMXValue,Duration,Effect,DeviceName';
  const rows = cues.filter(c => c.device === 'dmx').map((cue, idx) => {
    const addr = parseInt(cue.addresses.split(':')[0]) || 1;
    return [idx + 1, cue.timecodeMs, addr, 255, cue.duration, `"${cue.effect}"`, `"${cue.name}"`].join(',');
  });
  return [header, ...rows].join('\n');
}

// ═══════════════════════════════════════════════════════════
// SCL PARSER (Flames Launcher Show Cue List)
// ═══════════════════════════════════════════════════════════

/**
 * Parse SCL (Show Cue List) files from Flames Launcher Wizard.
 * SCL is generated from .fir files + audio for flame choreography.
 * 
 * SCL format (tab or comma separated):
 * CueNo, TimeCode, Channel, Value, Duration, Effect, Device, EventGroup
 */
export function parseSCL(text: string): AutoFireCue[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length < 2) return [];

  const cues: AutoFireCue[] = [];
  // Detect delimiter: tab or comma
  const delimiter = lines[0].includes('\t') ? '\t' : ',';
  const dataLines = lines.slice(1); // skip header

  dataLines.forEach((line, idx) => {
    const parts = line.split(delimiter).map(p => p.trim().replace(/^"|"$/g, ''));
    if (parts.length < 5) return;

    const cueNo = parseInt(parts[0]) || (idx + 1);
    const timecodeMs = parseTimeToMs(parts[1] || '');
    const channel = parseInt(parts[2]) || 1;
    const value = parseInt(parts[3]) || 255;
    const duration = parseFloat(parts[4]) || 0.2;
    const effect = parts[5] || 'FIRE';
    const device = parts[6] || `CH${channel}`;
    const eventGroup = parts.length >= 8 ? (parseInt(parts[7]) || 0) : 0;

    cues.push({
      id: `scl-${idx + 1}`,
      cueNumber: cueNo,
      device: 'dmx',
      name: device,
      state: 'ready',
      timecodeMs,
      addresses: `${channel}`,
      mode: 'sync',
      effect: `${effect} Val${value}`,
      duration,
      prefire: 0,
      trigger: 0,
      triggerSource: 'ltc', // SCL files typically sync to LTC
      eventNumber: eventGroup > 0 ? eventGroup : undefined,
    });
  });

  return cues;
}

// ═══════════════════════════════════════════════════════════
// FIR EXPORTER (pipe-delimited for Finale 3D / FireOne)
// ═══════════════════════════════════════════════════════════

export interface FIRExportItem {
  launchTimeMs: number;
  slat: number;
  cue: number;
  description: string;
  productNumber: string;
  size: string;
  positionName: string;
  event: number;
}

/** Export items to pipe-delimited FIR format */
export function exportFireOneFIR(items: FIRExportItem[]): string {
  const header = '# FIR Export — FX KONTROL → FireOne/Finale 3D';
  const rows = items
    .sort((a, b) => a.launchTimeMs - b.launchTimeMs)
    .map(item =>
      [item.launchTimeMs, item.slat, item.cue, item.description, item.productNumber, item.size, item.positionName, item.event].join('|')
    );
  return [header, ...rows].join('\n');
}

/**
 * Convenience: build FIR export data from project + addressing stores.
 * Import this where you have access to the stores.
 */
export function buildFIRExportItems(
  timelineItems: Array<{ id: string; effectId: string; startTime: number; positionId?: string; positionName?: string; section?: string }>,
  effects: Array<{ id: string; name: string; caliber?: number; partType?: string; vdl?: string }>,
  addresses: Array<{ timelineItemId: string; module: number; slat: number; pin: number }>,
  positions: Array<{ id: string; name: string }>,
): FIRExportItem[] {
  return timelineItems.map(item => {
    const effect = effects.find(e => e.id === item.effectId);
    const addr = addresses.find(a => a.timelineItemId === item.id);
    const pos = item.positionId ? positions.find(p => p.id === item.positionId) : null;

    // Use addressing store for slat/cue, fall back to flat index
    const slat = addr ? addr.module : 1;
    const cue = addr ? addr.pin : 1;

    return {
      launchTimeMs: Math.round(item.startTime * 1000),
      slat,
      cue,
      description: effect?.name || '',
      productNumber: effect?.vdl || effect?.partType || '',
      size: effect?.caliber ? `${effect.caliber}"` : '',
      positionName: pos?.name || item.positionName || '',
      event: 0,
    };
  });
}

/** Auto-detect format from file content and parse */
export function autoDetectAndParse(text: string, filename: string): { cues: AutoFireCue[]; source: string } {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.ses')) {
    return { cues: parseScriptMakerSession(text), source: 'ScriptMaker' };
  }
  if (lower.endsWith('.scl')) {
    return { cues: parseSCL(text), source: 'Flames SCL' };
  }
  if (lower.endsWith('.fir') || lower.endsWith('.sem')) {
    return { cues: parseFireOneFIR(text), source: 'FIR/SEM' };
  }
  // CSV — check if Flames, SCL-style, or FireOne by header
  const firstLine = text.split(/\r?\n/)[0]?.toLowerCase() || '';
  if (firstLine.includes('cueid') && firstLine.includes('dmxchannel')) {
    return { cues: parseFlamesLauncherCSV(text), source: 'Flames' };
  }
  if (firstLine.includes('cueno') && firstLine.includes('timecode') && firstLine.includes('eventgroup')) {
    return { cues: parseSCL(text), source: 'Flames SCL' };
  }
  return { cues: parseFireOneCSV(text), source: 'UltraFire' };
}
