/**
 * ─── RJ Equipamentos / ICET Timecode V1.5 — Script Builder ──────────
 *
 * Spec extraída por reverse-engineering do binário oficial
 * `Timecode.exe V1.5` (icet — Importar arquivo / Validar / Exportar).
 *
 * CSV importável pelo aplicativo Timecode + equipamento ICET:
 *  - Colunas: timecode, modulo, canal, abertura
 *  - Ordenação canônica: timecode ASC, modulo ASC, canal ASC
 *  - timecode: SMPTE HH:MM:SS:FF (30 fps non-drop)
 *      HH 0..23, MM 0..59, SS 0..59, FF 0..29
 *  - modulo: inteiro 1..99
 *  - canal: inteiro 1..32  OU  "C" | "F" | "S"  (Comum / Flama / Stop)
 *  - abertura: inteiro em ms, múltiplo de 100, dentro de [min, max]
 *  - Limite: 9999 disparos por script
 *  - Título do show: ASCII ≤ 20 caracteres
 *
 * Mensagens de erro/aviso espelham as do app oficial:
 *  - "Valor de modulo deve estar entre 1 e 99"
 *  - "Valor de canal deve estar entre 1 e 32, ou C ou F ou S"
 *  - "Valor da abertura deve ser múltiplo de 100"
 *  - "Arquivo possui mais de 9999 disparos."
 *  - "Formato de timecode inválido. HH:MM:SS:FF"
 *
 * Honest data-in/data-out: nenhum efeito colateral, nenhuma simulação.
 */

import type { TimelineItem, Position } from '@/types/projectTypes';
import { findEffectById } from '@/data/effectsLibraries/resolveEffect';

// ─── tipos ──────────────────────────────────────────────────────────

export type IcetCanal = number | 'C' | 'F' | 'S';

export interface IcetCue {
  timecode: string;         // "HH:MM:SS:FF"
  modulo: number;           // 1..99
  canal: IcetCanal;         // 1..32 | C | F | S
  abertura: number;         // ms, múltiplo de 100
  /** índice 1-based (apenas para diagnóstico, não vai pro CSV) */
  seq: number;
  /** nome do efeito (apenas para diagnóstico) */
  effectName?: string;
  /** nome da posição (apenas para diagnóstico) */
  posName?: string;
}

export interface BuildIcetOptions {
  /** Título do show — sanitizado para ASCII ≤ 20 chars */
  title?: string;
  /** Frame rate. ICET V1.5 = 30 non-drop. Editável só pra futuros firmwares. */
  fps?: 30;
  /** Abertura default (ms) se não houver duração no efeito. Default 200. */
  defaultAberturaMs?: number;
  /** Abertura mínima permitida pelo equipamento (ms). Default 100. */
  minAberturaMs?: number;
  /** Abertura máxima permitida pelo equipamento (ms). Default 9900. */
  maxAberturaMs?: number;
  /** Slats por módulo (1 ICET: 32 canais por módulo). */
  canalsPerModulo?: number;
  /** Separador CSV. Default ','. (Timecode parser aceita vírgula.) */
  separator?: ',' | ';';
}

export interface BuildIcetResult {
  csv: string;
  title: string;
  cues: IcetCue[];
  warnings: string[];
  errors: string[];
  truncated: boolean;
}

// ─── helpers puros ──────────────────────────────────────────────────

export const ICET_MAX_CUES = 9999;
export const ICET_TITLE_MAX = 20;
export const ICET_CANALS_DEFAULT = 32;
export const ICET_MODULO_MAX = 99;
export const ICET_ABERTURA_STEP = 100;

const SPECIAL_CANALS: ReadonlySet<string> = new Set(['C', 'F', 'S']);

/** ASCII-only, trim, ≤ 20 chars — exatamente como o campo TBTitulo do app. */
export function sanitizeIcetTitle(input: string | undefined): string {
  if (!input) return 'SHOW';
  // remove acentos básicos + qualquer non-ASCII printable
  const ascii = input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, '')
    .trim();
  const safe = ascii || 'SHOW';
  return safe.slice(0, ICET_TITLE_MAX);
}

/** Segundos → "HH:MM:SS:FF" non-drop. Clampa em 23:59:59:29 com warning. */
export function secondsToIcetTimecode(sec: number, fps = 30): { tc: string; warning?: string } {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const cap = 24 * 3600 - 1 / fps;
  let warning: string | undefined;
  if (sec > cap) {
    warning = `Tempo ${sec.toFixed(2)}s excede 23:59:59:${fps - 1} — clamped`;
    sec = cap;
  }
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const f = Math.floor((sec - Math.floor(sec)) * fps + 1e-6);
  const tc = `${pad2(h)}:${pad2(m)}:${pad2(s)}:${pad2(f)}`;
  return { tc, warning };
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** "HH:MM:SS:FF" → segundos (para round-trip / testes). */
export function icetTimecodeToSeconds(tc: string, fps = 30): number {
  const m = /^(\d{2}):(\d{2}):(\d{2}):(\d{2})$/.exec(tc);
  if (!m) throw new Error('Formato de timecode inválido. HH:MM:SS:FF');
  const [h, mi, s, f] = [+m[1], +m[2], +m[3], +m[4]];
  if (h > 23 || mi > 59 || s > 59 || f >= fps) {
    throw new Error('Formato de timecode inválido. HH:MM:SS:FF');
  }
  return h * 3600 + mi * 60 + s + f / fps;
}

/** Quantiza para múltiplo de 100 dentro de [min,max]. Retorna {value, snapped}. */
export function quantizeAbertura(
  ms: number,
  minMs: number,
  maxMs: number,
): { value: number; snapped: boolean } {
  const clamped = Math.max(minMs, Math.min(maxMs, Math.round(ms)));
  const quantized = Math.round(clamped / ICET_ABERTURA_STEP) * ICET_ABERTURA_STEP;
  const finalVal = Math.max(minMs, Math.min(maxMs, quantized));
  return { value: finalVal, snapped: finalVal !== Math.round(ms) };
}

/** Valida um canal individual (forma de erro idêntica ao app). */
export function isValidIcetCanal(c: IcetCanal): boolean {
  if (typeof c === 'string') return SPECIAL_CANALS.has(c.toUpperCase());
  return Number.isInteger(c) && c >= 1 && c <= ICET_CANALS_DEFAULT;
}

function formatCanal(c: IcetCanal): string {
  return typeof c === 'string' ? c.toUpperCase() : String(c);
}

/** Comparator canônico: timecode ASC, modulo ASC, canal ASC. */
export function compareIcetCues(a: IcetCue, b: IcetCue): number {
  if (a.timecode < b.timecode) return -1;
  if (a.timecode > b.timecode) return 1;
  if (a.modulo !== b.modulo) return a.modulo - b.modulo;
  // canais especiais (C/F/S) vão depois dos numéricos, ordem alfabética
  const aNum = typeof a.canal === 'number';
  const bNum = typeof b.canal === 'number';
  if (aNum && bNum) return (a.canal as number) - (b.canal as number);
  if (aNum && !bNum) return -1;
  if (!aNum && bNum) return 1;
  return String(a.canal).localeCompare(String(b.canal));
}

// ─── builder ────────────────────────────────────────────────────────

export function buildIcetScript(
  items: TimelineItem[],
  positions: Position[],
  opts: BuildIcetOptions = {},
): BuildIcetResult {
  const fps = opts.fps ?? 30;
  const defaultAbertura = opts.defaultAberturaMs ?? 200;
  const minAbertura = opts.minAberturaMs ?? 100;
  const maxAbertura = opts.maxAberturaMs ?? 9900;
  const canalsPerModulo = opts.canalsPerModulo ?? ICET_CANALS_DEFAULT;
  const separator = opts.separator ?? ',';
  const title = sanitizeIcetTitle(opts.title);

  const warnings: string[] = [];
  const errors: string[] = [];

  // 1. filtra pyro + ordena por tempo
  const pyro = items
    .filter(i => {
      const e = findEffectById(i.effectId);
      return e?.type === 'firework';
    })
    .sort((a, b) => a.startTime - b.startTime);

  // 2. cap em 9999 (mesma mensagem do app)
  let truncated = false;
  let effective = pyro;
  if (pyro.length > ICET_MAX_CUES) {
    truncated = true;
    warnings.push(
      `Arquivo possui mais de ${ICET_MAX_CUES} disparos — ${pyro.length - ICET_MAX_CUES} cues truncados.`,
    );
    effective = pyro.slice(0, ICET_MAX_CUES);
  }

  // 3. mapeia para IcetCue
  const cues: IcetCue[] = effective.map((item, idx) => {
    const effect = findEffectById(item.effectId);
    const effectName = effect?.name;

    // posição mais próxima (apenas diagnóstico)
    let posName: string | undefined;
    const pyroPos = positions.filter(p => p.type === 'pyro');
    if (pyroPos.length > 0) {
      let best = Infinity;
      for (const p of pyroPos) {
        const d = Math.hypot(p.x - item.position.x, p.z - item.position.z);
        if (d < best) {
          best = d;
          posName = p.name;
        }
      }
    }

    // timecode
    const { tc, warning: tcWarn } = secondsToIcetTimecode(item.startTime, fps);
    if (tcWarn) warnings.push(`cue ${idx + 1}: ${tcWarn}`);

    // canal/módulo derivados linearmente (1..canalsPerModulo por módulo)
    const linear = idx;
    const canal = (linear % canalsPerModulo) + 1;
    const modulo = Math.floor(linear / canalsPerModulo) + 1;

    if (modulo > ICET_MODULO_MAX) {
      errors.push(
        `cue ${idx + 1}: Valor de modulo deve estar entre 1 e ${ICET_MODULO_MAX} (calculado ${modulo}). Excede capacidade ICET.`,
      );
    }

    // abertura a partir da duração do efeito, quantizada
    const rawMs = effect?.duration ? Math.round(effect.duration * 1000) : defaultAbertura;
    const { value: abertura, snapped } = quantizeAbertura(rawMs, minAbertura, maxAbertura);
    if (snapped) {
      warnings.push(
        `cue ${idx + 1}: abertura ${rawMs}ms ajustada para ${abertura}ms (múltiplo de ${ICET_ABERTURA_STEP}, range ${minAbertura}-${maxAbertura}).`,
      );
    }

    return {
      timecode: tc,
      modulo: Math.min(modulo, ICET_MODULO_MAX),
      canal,
      abertura,
      seq: idx + 1,
      effectName,
      posName,
    };
  });

  // 4. ordenação canônica (espelha "timecode ASC, modulo ASC, canal ASC" do DGV)
  cues.sort(compareIcetCues);

  // 5. validações finais
  for (const c of cues) {
    if (!isValidIcetCanal(c.canal)) {
      errors.push(`cue ${c.seq}: Valor de canal deve estar entre 1 e ${ICET_CANALS_DEFAULT}, ou C ou F ou S`);
    }
    if (c.abertura % ICET_ABERTURA_STEP !== 0) {
      errors.push(`cue ${c.seq}: Valor da abertura deve ser múltiplo de ${ICET_ABERTURA_STEP}`);
    }
  }

  // 6. monta CSV
  const sep = separator;
  const header = ['timecode', 'modulo', 'canal', 'abertura'].join(sep);
  const lines = cues.map(c =>
    [c.timecode, String(c.modulo), formatCanal(c.canal), String(c.abertura)].join(sep),
  );
  const csv = [header, ...lines].join('\n');

  return { csv, title, cues, warnings, errors, truncated };
}
