/**
 * ─── MegafireExporter — ShowPlan → Megafire CSV ────────────────────
 * Generates Megafire-compatible firing scripts (Finale 3D spec, Out 2021).
 *
 * Spec resumo:
 *  - Encoding: UTF-8 · Field delimiter: `;` · End-of-line: CRLF
 *  - Header em pt-BR; linhas ordenadas por tempo de ignição ascendente.
 *  - Resolução de tempo: milissegundos (3 casas decimais em segundos).
 *  - Cada linha = combinação única (módulo, pino, tempo). Múltiplos efeitos
 *    no mesmo cue são agrupados: prefixo "(N) PrimeiroEfeito…".
 *  - Caracteres `;`, LF, CR, TAB são filtrados (sem escaping/quoting).
 *
 * Pre-export gate: roda VerificationEngine antes de gerar (igual FireOne).
 */
import { showPlanManager } from '@/core/showplan/ShowPlanManager';
import { verificationEngine } from '@/core/verification/VerificationEngine';
import { blackbox } from '@/core/reliability/blackBoxRecorder';
import type { PyroCue } from '@/core/showplan/ShowPlan';

export interface MegafireExportResult {
  script: string;          // Conteúdo completo do CSV (com CRLF)
  cueCount: number;        // Linhas geradas (firing events únicos)
  effectCount: number;     // Total de efeitos cobertos (≥ cueCount)
  errors: string[];
  verified: boolean;
}

/** Filtra caracteres ilegais para o formato (sem quoting/escaping). */
function sanitize(input: string): string {
  // Remove `;`, TAB, LF, CR e demais controles. Preserva UTF-8 imprimível.
  return input.replace(/[;\t\r\n\x00-\x1F\x7F]/g, ' ').trim();
}

/** Formata segundos com 3 casas decimais (resolução ms). */
function fmtSec(seconds: number): string {
  return Number.isFinite(seconds) ? seconds.toFixed(3) : '0.000';
}

/**
 * Direção em ASCII art a partir de heading (-180..180°) e elevation (0..90°).
 * Convenção:
 *   `|` vertical (elevation ≥ 80°)
 *   `/` heading > +20° (à direita)
 *   `\` heading < -20° (à esquerda)
 *   `\|/` fan/sortido quando múltiplos cues compartilham a vaga
 */
function directionAscii(heading: number, elevation: number): string {
  if (elevation >= 80) return '|';
  if (heading > 20) return '/';
  if (heading < -20) return '\\';
  return '|';
}

/** Combina direções de múltiplos efeitos no mesmo cue (dedup, mantém ordem). */
function combineDirections(cues: PyroCue[]): string {
  const seen = new Set<string>();
  const order: string[] = [];
  for (const c of cues) {
    const d = directionAscii(c.heading ?? 0, c.elevation ?? 90);
    if (!seen.has(d)) { seen.add(d); order.push(d); }
  }
  return order.join('');
}

/** Nome do efeito + calibre (ex: "White Chrysanthemum 75mm"). */
function effectLabel(cue: PyroCue): string {
  const id = sanitize(cue.effectId || 'Effect');
  const cal = Number.isFinite(cue.caliber) && cue.caliber > 0 ? `${Math.round(cue.caliber)}mm` : '';
  return cal ? `${id} ${cal}` : id;
}

/** Estima duração do efeito (s) — campo não existe em PyroCue; fallback por calibre. */
function estimateDuration(cue: PyroCue): number {
  // Heurística conservadora baseada em literatura (Piroex/Skyking):
  // 50mm≈0.8s · 75mm≈1.0s · 100mm≈1.4s · 150mm≈2.0s · 200mm≈2.6s.
  const c = cue.caliber || 75;
  if (c <= 50) return 0.8;
  if (c <= 75) return 1.0;
  if (c <= 100) return 1.4;
  if (c <= 150) return 2.0;
  return 2.6;
}

export function generateMegafireScript(): MegafireExportResult {
  const sp = showPlanManager.current;
  const vResult = verificationEngine.run();
  const canExport = vResult.level === 'READY_FOR_EXPORT' || vResult.level === 'READY_FOR_FIELD';
  const errors: string[] = [];

  if (!canExport) {
    const blocking = vResult.issues.filter(i => !i.passed && i.severity === 'error');
    errors.push(...blocking.map(i => `[BLOCKED] ${i.label}: ${i.detail}`));
  }

  // ── Validação básica + agrupamento por (time_ms, module, channel) ─────────
  // Spec: "rows for the firing events, i.e., unique combinations of module,
  // pin, and ignition-time".
  const groups = new Map<string, PyroCue[]>();
  for (let i = 0; i < sp.pyroCues.length; i++) {
    const c = sp.pyroCues[i];
    if (c.module < 0) errors.push(`Cue ${i + 1}: invalid module ${c.module}`);
    if (c.channel < 0) errors.push(`Cue ${i + 1}: invalid channel ${c.channel}`);
    if (!Number.isFinite(c.time) || c.time < 0) {
      errors.push(`Cue ${i + 1}: invalid time ${c.time}`);
      continue;
    }
    const key = `${Math.round(c.time * 1000)}|${c.module}|${c.channel}`;
    const bucket = groups.get(key);
    if (bucket) bucket.push(c); else groups.set(key, [c]);
  }

  // Ordena por tempo (asc), depois module, depois channel — saída determinística.
  const sortedKeys = [...groups.keys()].sort((a, b) => {
    const [ta, ma, ca] = a.split('|').map(Number);
    const [tb, mb, cb] = b.split('|').map(Number);
    return ta - tb || ma - mb || ca - cb;
  });

  // ── Build CSV ──
  const HEADER = [
    'Sequência', 'Tempo de ignição', 'Duração do efeito', 'Tempo para disparo',
    'Artefato e calibre', 'Nome da posição', 'Direção',
    'Distribuidor', 'Canal', 'ID do artefato', 'Preço do artefato',
  ].join(';');

  const rows: string[] = [HEADER];
  let effectCount = 0;
  let seq = 0;

  for (const key of sortedKeys) {
    const bucket = groups.get(key)!;
    bucket.sort((a, b) => a.id.localeCompare(b.id));
    const head = bucket[0];
    const n = bucket.length;
    effectCount += n;
    seq += 1;

    // Posição (mesma para o cue inteiro — vem do head; warn se divergir)
    const pos = sp.positions.find(p => p.id === head.positionId);
    const positionName = sanitize(pos?.name ?? head.positionId ?? '');

    if (n > 1 && bucket.some(c => c.positionId !== head.positionId)) {
      errors.push(`Cue ${seq} (mod ${head.module + 1}/pin ${head.channel + 1} @ ${head.time.toFixed(3)}s): efeitos no mesmo pino com posições divergentes`);
    }

    // Effect label — agrupado conforme spec ("(N) Nome…")
    const labelHead = effectLabel(head);
    const artefato = n > 1 ? `(${n}) ${labelHead}…` : labelHead;

    // Duração: usa o maior dos efeitos do grupo (cue só fecha quando o último termina).
    let durMax = 0;
    for (const c of bucket) {
      const d = estimateDuration(c);
      if (d > durMax) durMax = d;
    }

    // Prefire: do head (todos no mesmo pino devem ter mesmo fuseDelay; warn se não).
    const prefireMs = head.fuseDelay ?? 0;
    if (n > 1 && bucket.some(c => (c.fuseDelay ?? 0) !== prefireMs)) {
      errors.push(`Cue ${seq}: prefires divergentes no mesmo pino — usado ${prefireMs}ms (head)`);
    }

    rows.push([
      seq,
      fmtSec(head.time),
      fmtSec(durMax),
      fmtSec((prefireMs ?? 0) / 1000),
      sanitize(artefato),
      positionName,
      sanitize(combineDirections(bucket)),
      head.module + 1,        // Distribuidor (1-based)
      head.channel + 1,       // Canal (1-based)
      sanitize(head.effectId || ''),
      '0.00',                  // Preço — opcional, sem fonte canônica no ShowPlan
    ].join(';'));
  }

  const script = rows.join('\r\n') + '\r\n';
  const cueCount = sortedKeys.length;

  blackbox.record('state',
    `MegafireExporter: ${cueCount} cues / ${effectCount} effects, ${errors.length} errors, verified=${canExport}`
  );

  return { script, cueCount, effectCount, errors, verified: canExport };
}

/**
 * Triggers download of the generated Megafire CSV.
 * Inclui BOM UTF-8 para compatibilidade com Excel/Outlook (spec não exige,
 * mas evita corrupção de acentuação na importação por planilha).
 */
export function downloadMegafireScript(filename = 'fxk_show_megafire.csv'): MegafireExportResult {
  const result = generateMegafireScript();
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + result.script], { type: 'text/csv;charset=utf-8' });
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
