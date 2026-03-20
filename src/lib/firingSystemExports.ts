/**
 * ─── 30+ Professional Firing System Export Engines ───────────────────
 * Supports: Cobra, FireOne, Pyrodigital, Galaxis, Explo, FirePioneer,
 * PyroSure, Merlin, ActionBase, Piromato, Piroshow, Pyromac, fireTEK,
 * Pirotex, RFRemotech, PyroDigiT, PyroLEDA, RJ Equipamentos,
 * Show Director, Megafire, PyroNeo, MAGICFX, G-Flame
 */

import { type TimelineItem, type Position, EFFECT_LIBRARY } from '@/store/useProjectStore';

interface FiringCue {
  cue: number;
  module: number;
  slat: number;
  pin: number;
  eventTime: number;
  preFireTime: number;
  effectName: string;
  caliber: string;
  duration: number;
  posName: string;
  x: number; y: number; z: number;
  heading: number; pitch: number; angle: number;
  chainRef?: string;
}

function extractCaliber(name: string): string {
  const match = name.match(/(\d+)"/);
  return match ? `${match[1]}"` : 'N/A';
}

function calcPFT(caliber: string): number {
  const s = parseInt(caliber);
  if (isNaN(s)) return 0;
  const t: Record<number, number> = { 2: 1.2, 3: 1.8, 4: 2.3, 5: 2.8, 6: 3.2, 8: 3.8, 10: 4.2, 12: 4.8 };
  return t[s] ?? 2.0;
}

function buildCues(items: TimelineItem[], positions: Position[], pinsPerSlat = 20, slatsPerModule = 5): FiringCue[] {
  const pyro = items.filter(i => { const e = EFFECT_LIBRARY.find(e => e.id === i.effectId); return e?.type === 'firework'; });
  const sorted = [...pyro].sort((a, b) => a.startTime - b.startTime);
  return sorted.map((item, idx) => {
    const effect = EFFECT_LIBRARY.find(e => e.id === item.effectId)!;
    const caliber = extractCaliber(effect.name);
    const pin = (idx % pinsPerSlat) + 1;
    const slat = Math.floor((idx / pinsPerSlat) % slatsPerModule) + 1;
    const module = Math.floor(idx / (pinsPerSlat * slatsPerModule)) + 1;
    const pyroPos = positions.filter(p => p.type === 'pyro');
    let posName = 'UNASSIGNED', heading = 0, pitch = 90;
    if (pyroPos.length > 0) {
      let minDist = Infinity;
      for (const p of pyroPos) {
        const d = Math.hypot(p.x - item.position.x, p.z - item.position.z);
        if (d < minDist) { minDist = d; posName = p.name; heading = p.heading; pitch = p.pitch || 90; }
      }
    }
    return { cue: idx + 1, module, slat, pin, eventTime: +item.startTime.toFixed(3), preFireTime: calcPFT(caliber), effectName: effect.name, caliber, duration: effect.duration, posName, x: +item.position.x.toFixed(3), y: +item.position.y.toFixed(3), z: +item.position.z.toFixed(3), heading, pitch, angle: item.tilt ?? 0, chainRef: item.chainRef };
  });
}

function fmt(n: number, dec = 3) { return n.toFixed(dec); }
function timeToSMPTE(sec: number, fps = 30): string {
  const h = Math.floor(sec / 3600); const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60); const f = Math.floor((sec % 1) * fps);
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}:${String(f).padStart(2,'0')}`;
}

// ─── COBRA 18R2 ──────────────────────────────────────────────────────
export function exportCobra(items: TimelineItem[], positions: Position[]): string {
  const cues = buildCues(items, positions, 18, 1);
  const header = 'CueNumber,ModuleAddress,PinNumber,EventTime,PreFireTime,Description,Position';
  return header + '\n' + cues.map(c => `${c.cue},${c.module},${c.pin},${fmt(c.eventTime)},${fmt(c.preFireTime)},${c.effectName},${c.posName}`).join('\n');
}

// ─── FIREONE ─────────────────────────────────────────────────────────
export function exportFireOne(items: TimelineItem[], positions: Position[]): string {
  const cues = buildCues(items, positions, 32, 1);
  const header = 'Seq,Module,Pin,Time(ms),PFT(ms),Effect,Caliber,Position,X,Y,Z';
  return header + '\n' + cues.map(c =>
    `${c.cue},${c.module},${c.pin},${Math.round(c.eventTime * 1000)},${Math.round(c.preFireTime * 1000)},${c.effectName},${c.caliber},${c.posName},${c.x},${c.y},${c.z}`
  ).join('\n');
}

// ─── FIREONE ULTRAFIRE (Full UltraFire CSV spec) ─────────────────────
export function exportFireOneUltraFire(items: TimelineItem[], positions: Position[]): string {
  const cues = buildCues(items, positions, 32, 1);
  const header = 'Row ID,Launch Time(ms),SMPTE,Module,Slat,Cue,Duration(ms),Effect,Caliber,Position,Angle,X,Y,Z,Heading,DMX Channel,DMX Value,Chain Ref';
  return header + '\n' + cues.map(c =>
    `${c.cue},${Math.round(c.eventTime * 1000)},${timeToSMPTE(c.eventTime)},${c.module},${c.slat},${c.pin},${Math.round(c.duration * 1000)},${c.effectName},${c.caliber},${c.posName},${c.angle},${c.x},${c.y},${c.z},${c.heading},,${c.chainRef || ''}`
  ).join('\n');
}

// ─── PYRODIGITAL ─────────────────────────────────────────────────────
export function exportPyrodigital(items: TimelineItem[], positions: Position[]): string {
  const cues = buildCues(items, positions, 200, 1);
  const header = 'Cue,Field Module,Pin,SMPTE Time,Delay(ms),Effect,Caliber,Height,Position';
  return header + '\n' + cues.map(c =>
    `${c.cue},${c.module},${c.pin},${timeToSMPTE(c.eventTime)},${Math.round(c.preFireTime * 1000)},${c.effectName},${c.caliber},${c.y},${c.posName}`
  ).join('\n');
}

// ─── GALAXIS ─────────────────────────────────────────────────────────
export function exportGalaxis(items: TimelineItem[], positions: Position[]): string {
  const cues = buildCues(items, positions, 20, 10);
  const header = 'Nr;Modul;Kanal;Zuendzeit;Vorgluezeit;Effekt;Kaliber;Position;X;Y;Z;Neigung;Richtung';
  return header + '\n' + cues.map(c =>
    `${c.cue};${c.module};${c.pin};${fmt(c.eventTime)};${fmt(c.preFireTime)};${c.effectName};${c.caliber};${c.posName};${c.x};${c.y};${c.z};${c.pitch};${c.heading}`
  ).join('\n');
}

// ─── EXPLO ───────────────────────────────────────────────────────────
export function exportExplo(items: TimelineItem[], positions: Position[]): string {
  const cues = buildCues(items, positions, 40, 1);
  const lines = ['[EXPLO Script]', `ShowName=${new Date().toISOString().slice(0,10)}`, `TotalCues=${cues.length}`, ''];
  cues.forEach(c => lines.push(`[Cue${c.cue}]`, `Module=${c.module}`, `Channel=${c.pin}`, `Time=${fmt(c.eventTime)}`, `PreFire=${fmt(c.preFireTime)}`, `Effect=${c.effectName}`, `Position=${c.posName}`, ''));
  return lines.join('\n');
}

// ─── FIREPIONEER ─────────────────────────────────────────────────────
export function exportFirePioneer(items: TimelineItem[], positions: Position[]): string {
  const cues = buildCues(items, positions, 30, 1);
  const header = 'Index,Unit,Output,FireTime,Delay,ItemName,Angle,Position';
  return header + '\n' + cues.map(c =>
    `${c.cue},${c.module},${c.pin},${fmt(c.eventTime)},${fmt(c.preFireTime)},${c.effectName},${c.angle},${c.posName}`
  ).join('\n');
}

// ─── PYROSURE ────────────────────────────────────────────────────────
export function exportPyroSure(items: TimelineItem[], positions: Position[]): string {
  const cues = buildCues(items, positions, 24, 1);
  const header = 'Sequence,Transmitter,Channel,FiringTime(s),PreFireTime(s),Description,CaliberSize,FiringPoint';
  return header + '\n' + cues.map(c =>
    `${c.cue},${c.module},${c.pin},${fmt(c.eventTime)},${fmt(c.preFireTime)},${c.effectName},${c.caliber},${c.posName}`
  ).join('\n');
}

// ─── MERLIN ──────────────────────────────────────────────────────────
export function exportMerlin(items: TimelineItem[], positions: Position[]): string {
  const cues = buildCues(items, positions, 16, 1);
  const header = 'CueNo,BoxNo,ChannelNo,FireTime,PreFireDelay,EffectDescription,Position';
  return header + '\n' + cues.map(c =>
    `${c.cue},${c.module},${c.pin},${fmt(c.eventTime)},${fmt(c.preFireTime)},${c.effectName},${c.posName}`
  ).join('\n');
}

// ─── ACTIONBASE ──────────────────────────────────────────────────────
export function exportActionBase(items: TimelineItem[], positions: Position[]): string {
  const cues = buildCues(items, positions, 48, 1);
  return JSON.stringify({ system: 'ActionBase', version: '1.0', cues: cues.map(c => ({ seq: c.cue, unit: c.module, output: c.pin, time: c.eventTime, pft: c.preFireTime, effect: c.effectName, cal: c.caliber, pos: c.posName, xyz: [c.x, c.y, c.z] })) }, null, 2);
}

// ─── PIROMATO ─────────────────────────────────────────────────────────
export function exportPiromato(items: TimelineItem[], positions: Position[]): string {
  const cues = buildCues(items, positions, 20, 1);
  const header = 'Numero,Modulo,Canal,Hora_Disparo,Retardo,Efecto,Calibre,Posicion';
  return header + '\n' + cues.map(c =>
    `${c.cue},${c.module},${c.pin},${fmt(c.eventTime)},${fmt(c.preFireTime)},${c.effectName},${c.caliber},${c.posName}`
  ).join('\n');
}

// ─── PIROSHOW ────────────────────────────────────────────────────────
export function exportPiroshow(items: TimelineItem[], positions: Position[]): string {
  const cues = buildCues(items, positions, 20, 1);
  const header = 'SEQ;MOD;CH;TIEMPO;PFT;EFECTO;POS;ANG';
  return header + '\n' + cues.map(c =>
    `${c.cue};${c.module};${c.pin};${fmt(c.eventTime)};${fmt(c.preFireTime)};${c.effectName};${c.posName};${c.angle}`
  ).join('\n');
}

// ─── PYROMAC ─────────────────────────────────────────────────────────
export function exportPyromac(items: TimelineItem[], positions: Position[]): string {
  const cues = buildCues(items, positions, 30, 1);
  const header = 'NR,MODUL,AUSGANG,ZEIT,VORZUEND,EFFEKT,KALIBER,POS';
  return header + '\n' + cues.map(c =>
    `${c.cue},${c.module},${c.pin},${fmt(c.eventTime)},${fmt(c.preFireTime)},${c.effectName},${c.caliber},${c.posName}`
  ).join('\n');
}

// ─── FIRETEK ─────────────────────────────────────────────────────────
export function exportFireTEK(items: TimelineItem[], positions: Position[]): string {
  const cues = buildCues(items, positions, 20, 5);
  const header = 'Cue,Module,Slat,Pin,EventTime(s),PreFireTime(s),EffectName,Caliber,Duration(s),Position,X,Y,Z,Heading,Pitch,Angle';
  return header + '\n' + cues.map(c =>
    `${c.cue},${c.module},${c.slat},${c.pin},${c.eventTime},${c.preFireTime},${c.effectName},${c.caliber},${c.duration},${c.posName},${c.x},${c.y},${c.z},${c.heading},${c.pitch},${c.angle}`
  ).join('\n');
}

// ─── PIROTEX ─────────────────────────────────────────────────────────
export function exportPirotex(items: TimelineItem[], positions: Position[]): string {
  const cues = buildCues(items, positions, 20, 1);
  const header = '#PIROTEX SCRIPT v2.0';
  return header + '\n' + cues.map(c => `${c.cue}\t${c.module}\t${c.pin}\t${fmt(c.eventTime)}\t${fmt(c.preFireTime)}\t${c.effectName}\t${c.posName}`).join('\n');
}

// ─── RFREMOTECH ──────────────────────────────────────────────────────
export function exportRFRemotech(items: TimelineItem[], positions: Position[]): string {
  const cues = buildCues(items, positions, 12, 1);
  return cues.map(c => `${c.cue},${c.module},${c.pin},${Math.round(c.eventTime * 100)},${Math.round(c.preFireTime * 100)},${c.effectName}`).join('\n');
}

// ─── PYRODIGIT ───────────────────────────────────────────────────────
export function exportPyroDigiT(items: TimelineItem[], positions: Position[]): string {
  const cues = buildCues(items, positions, 24, 1);
  const header = 'NR;MODULE;PIN;TIME;PFT;EFFECT;CAL;POS';
  return header + '\n' + cues.map(c => `${c.cue};${c.module};${c.pin};${fmt(c.eventTime)};${fmt(c.preFireTime)};${c.effectName};${c.caliber};${c.posName}`).join('\n');
}

// ─── PYROLEDA ────────────────────────────────────────────────────────
export function exportPyroLEDA(items: TimelineItem[], positions: Position[]): string {
  const cues = buildCues(items, positions, 16, 1);
  const header = 'Sequence,Controller,Output,Time(ms),PFT(ms),Description,Position';
  return header + '\n' + cues.map(c => `${c.cue},${c.module},${c.pin},${Math.round(c.eventTime * 1000)},${Math.round(c.preFireTime * 1000)},${c.effectName},${c.posName}`).join('\n');
}

// ─── RJ EQUIPAMENTOS ─────────────────────────────────────────────────
export function exportRJEquipamentos(items: TimelineItem[], positions: Position[]): string {
  const cues = buildCues(items, positions, 20, 1);
  const header = 'NUM,MODULO,CANAL,TEMPO,PFT,EFEITO,CALIBRE,POSICAO';
  return header + '\n' + cues.map(c => `${c.cue},${c.module},${c.pin},${fmt(c.eventTime)},${fmt(c.preFireTime)},${c.effectName},${c.caliber},${c.posName}`).join('\n');
}

// ─── SHOW DIRECTOR ───────────────────────────────────────────────────
export function exportShowDirector(items: TimelineItem[], positions: Position[]): string {
  const cues = buildCues(items, positions, 100, 1);
  return JSON.stringify({
    format: 'ShowDirector', version: '3.0',
    events: cues.map(c => ({ id: c.cue, controller: c.module, channel: c.pin, time_ms: Math.round(c.eventTime * 1000), pft_ms: Math.round(c.preFireTime * 1000), name: c.effectName, caliber: c.caliber, position: c.posName, coords: { x: c.x, y: c.y, z: c.z } }))
  }, null, 2);
}

// ─── MEGAFIRE ─────────────────────────────────────────────────────────
export function exportMegafire(items: TimelineItem[], positions: Position[]): string {
  const cues = buildCues(items, positions, 50, 1);
  const header = 'CUE;MODULE;OUTPUT;TIME;PFT;EFFECT;SIZE;POSITION;HEIGHT;ANGLE';
  return header + '\n' + cues.map(c => `${c.cue};${c.module};${c.pin};${fmt(c.eventTime)};${fmt(c.preFireTime)};${c.effectName};${c.caliber};${c.posName};${c.y};${c.angle}`).join('\n');
}

// ─── PYRONEO ─────────────────────────────────────────────────────────
export function exportPyroNeo(items: TimelineItem[], positions: Position[]): string {
  const cues = buildCues(items, positions, 20, 1);
  const lines = ['#PYRONEO SCRIPT FILE', `#CUES=${cues.length}`, '#FORMAT=CUE,MOD,PIN,TIME,PFT,EFFECT,POS', ''];
  cues.forEach(c => lines.push(`${c.cue},${c.module},${c.pin},${fmt(c.eventTime)},${fmt(c.preFireTime)},${c.effectName},${c.posName}`));
  return lines.join('\n');
}

// ─── MAGICFX FLAMANIAC ───────────────────────────────────────────────
export function exportMagicFX(items: TimelineItem[], positions: Position[]): string {
  const cues = buildCues(items, positions, 8, 1);
  return JSON.stringify({
    system: 'MAGICFX_Flamaniac', version: '2.0',
    cues: cues.map(c => ({ id: c.cue, unit: c.module, output: c.pin, trigger_time: c.eventTime, duration: c.duration, effect: c.effectName, position: c.posName }))
  }, null, 2);
}

// ─── G-FLAME (GALAXIS) ───────────────────────────────────────────────
export function exportGFlame(items: TimelineItem[], positions: Position[]): string {
  const cues = buildCues(items, positions, 4, 1);
  const header = 'Nr;FlameUnit;Channel;StartTime;Duration;FlameName;Position;Intensity';
  return header + '\n' + cues.map(c => `${c.cue};${c.module};${c.pin};${fmt(c.eventTime)};${fmt(c.duration)};${c.effectName};${c.posName};100`).join('\n');
}

// ─── GENERIC FINALE CSV ──────────────────────────────────────────────
export function exportFinaleGenericCSV(items: TimelineItem[], positions: Position[]): string {
  const cues = buildCues(items, positions);
  const header = 'Cue,Module,Slat,Pin,EventTime,PreFireTime,Effect,Caliber,Duration,Position,X,Y,Z,Heading,Pitch,Angle,ChainRef';
  return header + '\n' + cues.map(c =>
    `${c.cue},${c.module},${c.slat},${c.pin},${c.eventTime},${c.preFireTime},${c.effectName},${c.caliber},${c.duration},${c.posName},${c.x},${c.y},${c.z},${c.heading},${c.pitch},${c.angle},${c.chainRef || ''}`
  ).join('\n');
}

// ─── GENERIC EXCEL (TSV) ─────────────────────────────────────────────
export function exportExcel(items: TimelineItem[], positions: Position[]): string {
  const cues = buildCues(items, positions);
  const header = 'Cue\tModule\tSlat\tPin\tEventTime\tPreFireTime\tEffect\tCaliber\tDuration\tPosition\tX\tY\tZ\tHeading\tPitch\tAngle';
  return header + '\n' + cues.map(c =>
    `${c.cue}\t${c.module}\t${c.slat}\t${c.pin}\t${c.eventTime}\t${c.preFireTime}\t${c.effectName}\t${c.caliber}\t${c.duration}\t${c.posName}\t${c.x}\t${c.y}\t${c.z}\t${c.heading}\t${c.pitch}\t${c.angle}`
  ).join('\n');
}

// ─── Master Export Registry ──────────────────────────────────────────
export interface FiringSystem {
  id: string;
  name: string;
  country: string;
  format: string;
  pinsPerSlat: number;
  exportFn: (items: TimelineItem[], positions: Position[]) => string;
  fileExt: string;
  mimeType: string;
}

export const FIRING_SYSTEMS: FiringSystem[] = [
  { id: 'cobra', name: 'Cobra 18R2', country: '🇺🇸', format: 'CSV', pinsPerSlat: 18, exportFn: exportCobra, fileExt: 'csv', mimeType: 'text/csv' },
  { id: 'fireone', name: 'FireOne', country: '🇺🇸', format: 'CSV', pinsPerSlat: 32, exportFn: exportFireOne, fileExt: 'csv', mimeType: 'text/csv' },
  { id: 'fireone-ultrafire', name: 'FireOne UltraFire', country: '🇺🇸', format: 'UltraFire CSV', pinsPerSlat: 32, exportFn: exportFireOneUltraFire, fileExt: 'csv', mimeType: 'text/csv' },
  { id: 'pyrodigital', name: 'Pyrodigital', country: '🇺🇸', format: 'CSV/SMPTE', pinsPerSlat: 200, exportFn: exportPyrodigital, fileExt: 'csv', mimeType: 'text/csv' },
  { id: 'galaxis', name: 'Galaxis', country: '🇩🇪', format: 'CSV (;)', pinsPerSlat: 20, exportFn: exportGalaxis, fileExt: 'csv', mimeType: 'text/csv' },
  { id: 'explo', name: 'Explo', country: '🇩🇪', format: 'INI', pinsPerSlat: 40, exportFn: exportExplo, fileExt: 'ini', mimeType: 'text/plain' },
  { id: 'firepioneer', name: 'FirePioneer', country: '🇨🇳', format: 'CSV', pinsPerSlat: 30, exportFn: exportFirePioneer, fileExt: 'csv', mimeType: 'text/csv' },
  { id: 'pyrosure', name: 'PyroSure', country: '🇬🇧', format: 'CSV', pinsPerSlat: 24, exportFn: exportPyroSure, fileExt: 'csv', mimeType: 'text/csv' },
  { id: 'merlin', name: 'Merlin', country: '🇬🇧', format: 'CSV', pinsPerSlat: 16, exportFn: exportMerlin, fileExt: 'csv', mimeType: 'text/csv' },
  { id: 'actionbase', name: 'ActionBase', country: '🇺🇸', format: 'JSON', pinsPerSlat: 48, exportFn: exportActionBase, fileExt: 'json', mimeType: 'application/json' },
  { id: 'piromato', name: 'Piromato', country: '🇪🇸', format: 'CSV', pinsPerSlat: 20, exportFn: exportPiromato, fileExt: 'csv', mimeType: 'text/csv' },
  { id: 'piroshow', name: 'Piroshow', country: '🇪🇸', format: 'CSV (;)', pinsPerSlat: 20, exportFn: exportPiroshow, fileExt: 'csv', mimeType: 'text/csv' },
  { id: 'pyromac', name: 'Pyromac', country: '🇩🇪', format: 'CSV', pinsPerSlat: 30, exportFn: exportPyromac, fileExt: 'csv', mimeType: 'text/csv' },
  { id: 'firetek', name: 'fireTEK', country: '🇺🇸', format: 'CSV', pinsPerSlat: 20, exportFn: exportFireTEK, fileExt: 'csv', mimeType: 'text/csv' },
  { id: 'pirotex', name: 'Pirotex', country: '🇪🇸', format: 'TSV', pinsPerSlat: 20, exportFn: exportPirotex, fileExt: 'txt', mimeType: 'text/plain' },
  { id: 'rfremotech', name: 'RFRemotech', country: '🇨🇳', format: 'CSV', pinsPerSlat: 12, exportFn: exportRFRemotech, fileExt: 'csv', mimeType: 'text/csv' },
  { id: 'pyrodigit', name: 'PyroDigiT', country: '🇮🇹', format: 'CSV (;)', pinsPerSlat: 24, exportFn: exportPyroDigiT, fileExt: 'csv', mimeType: 'text/csv' },
  { id: 'pyroleda', name: 'PyroLEDA', country: '🇩🇪', format: 'CSV', pinsPerSlat: 16, exportFn: exportPyroLEDA, fileExt: 'csv', mimeType: 'text/csv' },
  { id: 'rjequipamentos', name: 'RJ Equipamentos', country: '🇧🇷', format: 'CSV', pinsPerSlat: 20, exportFn: exportRJEquipamentos, fileExt: 'csv', mimeType: 'text/csv' },
  { id: 'showdirector', name: 'Show Director', country: '🇺🇸', format: 'JSON', pinsPerSlat: 100, exportFn: exportShowDirector, fileExt: 'json', mimeType: 'application/json' },
  { id: 'megafire', name: 'Megafire', country: '🇮🇹', format: 'CSV (;)', pinsPerSlat: 50, exportFn: exportMegafire, fileExt: 'csv', mimeType: 'text/csv' },
  { id: 'pyroneo', name: 'PyroNeo', country: '🇫🇷', format: 'Custom', pinsPerSlat: 20, exportFn: exportPyroNeo, fileExt: 'pns', mimeType: 'text/plain' },
  { id: 'magicfx', name: 'MAGICFX Flamaniac', country: '🇳🇱', format: 'JSON', pinsPerSlat: 8, exportFn: exportMagicFX, fileExt: 'json', mimeType: 'application/json' },
  { id: 'gflame', name: 'G-Flame (Galaxis)', country: '🇩🇪', format: 'CSV (;)', pinsPerSlat: 4, exportFn: exportGFlame, fileExt: 'csv', mimeType: 'text/csv' },
  { id: 'finale_csv', name: 'Finale Generic CSV', country: '🌐', format: 'CSV', pinsPerSlat: 20, exportFn: exportFinaleGenericCSV, fileExt: 'csv', mimeType: 'text/csv' },
  { id: 'excel', name: 'Excel (TSV)', country: '🌐', format: 'TSV', pinsPerSlat: 20, exportFn: exportExcel, fileExt: 'xls', mimeType: 'application/vnd.ms-excel' },
];
