/**
 * FireOne Script Parser — UltraFire CSV / FIR interchange
 * 
 * Supports:
 * - Official FireOne CSV format (import/export)
 * - Pipe-delimited FIR/SEM text exports (import only)
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
  module: number;         // Slat address (1-99)
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
      0,                                     // Event
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
      0,                                     // Priority
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
