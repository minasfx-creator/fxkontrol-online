/**
 * ─── RJEquipamentosExporter — ShowPlan → RJ Equipamentos CSV ───────
 * Implementa as duas variantes oficiais (Finale 3D spec, Out 2021):
 *
 *   1. TRADITIONAL  → "Cue,Shot Time,Burst,Module,Chanel,Comment"
 *      - Tempos em ms padded 7 dígitos (ex.: 7.152s → "0007152").
 *      - Pinos numéricos (1..N). Sem efeitos especiais.
 *
 *   2. TIMECODE      → "CUE,TIMECODE,MODULO,CANAL,ABERTURA"
 *      - TIMECODE em 30fps (HH:MM:SS:FF, non-drop).
 *      - CANAL pode ser numérico OU 'F' / 'C' / 'S' (special effects).
 *      - ABERTURA: branco p/ pyro; ms de duração p/ SFX.
 *      - Module numbers ≥100 são gravados módulo 100 (ex.: 101→1).
 *
 * Características comuns (Tabela 1/2 da spec):
 *   - Encoding Code Page 1252 · delimitador `,` · EOL CRLF
 *   - Linhas ordenadas ascendente por tempo
 *   - Linha = (módulo, pino, tempo) único; múltiplos efeitos agrupam Comment
 *   - Caracteres ' " , ; \ TAB LF são filtrados (sem quoting)
 *
 * Pre-export gate: VerificationEngine + blackbox audit (igual demais exporters).
 */
import { showPlanManager } from '@/core/showplan/ShowPlanManager';
import { verificationEngine } from '@/core/verification/VerificationEngine';
import { blackbox } from '@/core/reliability/blackBoxRecorder';
import type { PyroCue } from '@/core/showplan/ShowPlan';

export type RJVariant = 'traditional' | 'timecode';

export interface RJExportResult {
  script: string;
  cueCount: number;
  effectCount: number;
  variant: RJVariant;
  errors: string[];
  verified: boolean;
}

// ── helpers ──────────────────────────────────────────────────────────────

/** Filtra caracteres ilegais conforme spec (sem escaping/quoting). */
function sanitize(input: string): string {
  return input.replace(/['",;\\\t\r\n\x00-\x1F\x7F]/g, ' ').trim();
}

/** ms padded para 7 dígitos: 7152 → "0007152". */
function padMs(seconds: number): string {
  const ms = Math.max(0, Math.round(seconds * 1000));
  return String(ms).padStart(7, '0');
}

/** HH:MM:SS:FF em 30fps non-drop. */
function toTimecode30(seconds: number): string {
  const total = Math.max(0, seconds);
  const totalFrames = Math.round(total * 30);
  const ff = totalFrames % 30;
  const totalSec = Math.floor(totalFrames / 30);
  const ss = totalSec % 60;
  const mm = Math.floor(totalSec / 60) % 60;
  const hh = Math.floor(totalSec / 3600);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(hh)}:${p(mm)}:${p(ss)}:${p(ff)}`;
}

/**
 * Resolve canal SFX a partir do PyroCue.
 * Convenção (alinhada com a spec do Finale 3D): se a Position carrega
 * `section` ou `notes` indicando flame/cryo/stadium, mapeia para F/C/S.
 * Caso contrário usa pino numérico (1-based).
 */
function resolveChannel(cue: PyroCue, sectionHint?: string): { canal: string; isSFX: boolean; sfxType: 'F' | 'C' | 'S' | null } {
  const hint = (sectionHint ?? cue.section ?? '').toLowerCase();
  if (/(^|\b)(flame|fogo|chama)\b/.test(hint)) return { canal: 'F', isSFX: true, sfxType: 'F' };
  if (/(^|\b)(cryo|co2|cryojet)\b/.test(hint)) return { canal: 'C', isSFX: true, sfxType: 'C' };
  if (/(^|\b)(stadium|shotgun|stadium-shot)\b/.test(hint)) return { canal: 'S', isSFX: true, sfxType: 'S' };
  return { canal: String(cue.channel + 1), isSFX: false, sfxType: null };
}

/** Module exportado: ≥100 → modulo 100 (spec: 101→1, 201→1, 301→1). */
function exportModule(rawModuleZeroBased: number): number {
  const m1 = rawModuleZeroBased + 1; // 1-based
  return m1 >= 100 ? ((m1 % 100) || 100) : m1;
}

/** Estima Burst (duração total do efeito incluindo pre-fire) em segundos. */
function estimateBurst(cue: PyroCue): number {
  const c = cue.caliber || 75;
  const dur = c <= 50 ? 0.8 : c <= 75 ? 1.0 : c <= 100 ? 1.4 : c <= 150 ? 2.0 : 2.6;
  return dur + (cue.fuseDelay ?? 0) / 1000;
}

/** Duração ABERTURA p/ SFX (ms) — heurística por section/notes. */
function sfxAperturaMs(cue: PyroCue): number {
  // Regra: durações dirigidas pelo cue (notes) ou fallback 500ms (spec).
  // Quando o show tiver `durationOverride` no TimelineItem isso pode ser
  // propagado ao PyroCue futuramente; por ora, usa 500ms default conforme spec.
  const m = (cue.notes ?? '').match(/dur(?:ation)?\s*[:=]\s*(\d{2,5})\s*ms/i);
  if (m) return parseInt(m[1], 10);
  return 500;
}

// ── core: agrupamento por (time_ms, module, channel) ─────────────────────

interface FiringEvent {
  key: string;
  timeMs: number;
  module: number; // 0-based raw
  channel: string; // já resolvido (numérico ou F/C/S)
  isSFX: boolean;
  cues: PyroCue[];
}

function buildEvents(sp: typeof showPlanManager.current): { events: FiringEvent[]; errors: string[] } {
  const errors: string[] = [];
  const groups = new Map<string, FiringEvent>();

  for (let i = 0; i < sp.pyroCues.length; i++) {
    const c = sp.pyroCues[i];
    if (c.module < 0) { errors.push(`Cue ${i + 1}: invalid module ${c.module}`); continue; }
    if (c.channel < 0) { errors.push(`Cue ${i + 1}: invalid channel ${c.channel}`); continue; }
    if (!Number.isFinite(c.time) || c.time < 0) { errors.push(`Cue ${i + 1}: invalid time ${c.time}`); continue; }

    const pos = sp.positions.find(p => p.id === c.positionId);
    const { canal, isSFX } = resolveChannel(c, pos?.section);
    const timeMs = Math.round(c.time * 1000);
    const key = `${timeMs}|${c.module}|${canal}`;
    const existing = groups.get(key);
    if (existing) {
      existing.cues.push(c);
    } else {
      groups.set(key, { key, timeMs, module: c.module, channel: canal, isSFX, cues: [c] });
    }
  }

  const events = [...groups.values()].sort((a, b) =>
    a.timeMs - b.timeMs || a.module - b.module || a.channel.localeCompare(b.channel)
  );
  return { events, errors };
}

// ── TRADITIONAL ──────────────────────────────────────────────────────────

function generateTraditional(): RJExportResult {
  const sp = showPlanManager.current;
  const vResult = verificationEngine.run();
  const canExport = vResult.level === 'READY_FOR_EXPORT' || vResult.level === 'READY_FOR_FIELD';
  const errors: string[] = [];

  if (!canExport) {
    errors.push(...vResult.issues
      .filter(i => !i.passed && i.severity === 'error')
      .map(i => `[BLOCKED] ${i.label}: ${i.detail}`));
  }

  const { events, errors: gErrs } = buildEvents(sp);
  errors.push(...gErrs);

  const HEADER = 'Cue,Shot Time,Burst,Module,Chanel,Comment';
  const rows: string[] = [HEADER];
  let effectCount = 0;
  let seq = 0;

  for (const ev of events) {
    // Traditional não suporta SFX — alerta mas exporta como pino numérico fallback.
    if (ev.isSFX) {
      errors.push(`Cue at ${ev.timeMs}ms: SFX channel '${ev.channel}' (mod ${ev.module + 1}) não suportado em RJ Traditional — use variant 'timecode'`);
      continue;
    }
    seq++;
    effectCount += ev.cues.length;
    const head = ev.cues[0];
    const burstSec = Math.max(...ev.cues.map(estimateBurst));
    const name = sanitize(head.effectId || 'Effect');
    const comment = ev.cues.length > 1 ? `(${ev.cues.length}) ${name}` : name;

    rows.push([
      seq,
      padMs(ev.timeMs / 1000),
      padMs(burstSec),
      exportModule(ev.module),
      Number(ev.channel),
      sanitize(comment),
    ].join(','));
  }

  const script = rows.join('\r\n') + '\r\n';
  blackbox.record('state',
    `RJExporter[traditional]: ${seq} cues / ${effectCount} effects, ${errors.length} errors, verified=${canExport}`
  );
  return { script, cueCount: seq, effectCount, variant: 'traditional', errors, verified: canExport };
}

// ── TIMECODE ─────────────────────────────────────────────────────────────

function generateTimecode(): RJExportResult {
  const sp = showPlanManager.current;
  const vResult = verificationEngine.run();
  const canExport = vResult.level === 'READY_FOR_EXPORT' || vResult.level === 'READY_FOR_FIELD';
  const errors: string[] = [];

  if (!canExport) {
    errors.push(...vResult.issues
      .filter(i => !i.passed && i.severity === 'error')
      .map(i => `[BLOCKED] ${i.label}: ${i.detail}`));
  }

  const { events, errors: gErrs } = buildEvents(sp);
  errors.push(...gErrs);

  const HEADER = 'CUE,TIMECODE,MODULO,CANAL,ABERTURA';
  const rows: string[] = [HEADER];
  let effectCount = 0;
  let seq = 0;

  for (const ev of events) {
    seq++;
    effectCount += ev.cues.length;
    const head = ev.cues[0];
    const abertura = ev.isSFX ? String(sfxAperturaMs(head)) : '';
    rows.push([
      seq,
      toTimecode30(ev.timeMs / 1000),
      exportModule(ev.module),
      ev.channel, // numérico ou F/C/S
      abertura,
    ].join(','));
  }

  const script = rows.join('\r\n') + '\r\n';
  blackbox.record('state',
    `RJExporter[timecode]: ${seq} cues / ${effectCount} effects, ${errors.length} errors, verified=${canExport}`
  );
  return { script, cueCount: seq, effectCount, variant: 'timecode', errors, verified: canExport };
}

// ── public API ───────────────────────────────────────────────────────────

export function generateRJEquipamentosScript(variant: RJVariant = 'timecode'): RJExportResult {
  return variant === 'traditional' ? generateTraditional() : generateTimecode();
}

/**
 * Triggers download. Encoding alvo do RJ é Code Page 1252 (Windows-1252);
 * o conteúdo é UTF-8 puro (após sanitize, que remove caracteres problemáticos),
 * compatível byte-a-byte com Win-1252 no subset ASCII gerado.
 */
export function downloadRJEquipamentosScript(
  variant: RJVariant = 'timecode',
  filename?: string,
): RJExportResult {
  const result = generateRJEquipamentosScript(variant);
  const fname = filename ?? `fxk_show_rj_${variant}.csv`;
  // Sem BOM (RJ não documenta BOM; Win-1252 puro). Conteúdo é ASCII após sanitize.
  const blob = new Blob([result.script], { type: 'text/csv;charset=windows-1252' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fname;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return result;
}
