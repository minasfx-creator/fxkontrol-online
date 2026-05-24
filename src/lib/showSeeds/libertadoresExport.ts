/**
 * ─── libertadoresExport — Honest export bundle for the golden seed ──
 *
 * Gera, a partir de um ShowPlan canônico (não do singleton), um pacote
 * ZIP com 3 artefatos honestos para conferência humana:
 *
 *   1. fxk_show.fir          — FireOne-style ASCII script (pyro cues
 *                              tempo-ordenadas, cabeçalho com metadata).
 *   2. fxk_sequencing.csv    — sequenciamento completo via
 *                              inspectShowPlan.sequencingToCsv.
 *   3. fxk_bom.json          — BoM + pinout determinísticos.
 *   4. _FXK_DISCLAIMER.txt   — claim policy explícito.
 *
 * **Claim policy**:
 *   - O `.fir` segue a convenção FireOne mas NÃO foi homologado contra
 *     uma instância FireOne 2.0 real (status: `marketing_hypothesis`
 *     para aceitação automática; `validated` para o conteúdo de cues
 *     porque vem direto do ShowPlan canônico).
 *   - BoM em peso bruto é estimativa de transporte (claim
 *     `marketing_hypothesis`) — BoM contratual do operador prevalece.
 *   - Não autoriza disparo. Autorização real continua exclusiva do
 *     `CommandBus → SafetyStateMachine` em `real_operation`.
 *
 * Pure em dados. Único side-effect = `downloadLibertadoresExportZip`.
 */

import JSZip from 'jszip';
import type { ShowPlan } from '@/core/showplan/ShowPlan';
import {
  inspectShowPlan,
  sequencingToCsv,
  type InspectShowPlanResult,
} from './inspectShowPlan';

// ── FireOne .fir (pure, ShowPlan-driven) ─────────────────────────────

export interface FireOneScriptResult {
  filename: string;
  content: string;
  cueCount: number;
  errors: string[];
}

const FIREONE_FILENAME = 'fxk_show.fir';
const SEQUENCING_FILENAME = 'fxk_sequencing.csv';
const BOM_FILENAME = 'fxk_bom.json';
const DISCLAIMER_FILENAME = '_FXK_DISCLAIMER.txt';

/**
 * Renderiza o .fir ASCII a partir de um ShowPlan **passado como
 * parâmetro** (não lê o singleton). Determinístico. FXK16: aceita
 * canais 0..15; outros módulos aceitam 0..31 (compat FireOne legacy).
 */
export function generateFireOneScriptFromPlan(sp: ShowPlan): FireOneScriptResult {
  const errors: string[] = [];
  const lines: string[] = [];

  lines.push('; FX KONTROL — FireOne Export Script (honest, ShowPlan-driven)');
  lines.push(`; Show: ${sp.metadata.name}`);
  lines.push(`; Show ID: ${sp.metadata.id}`);
  lines.push(`; Venue: ${sp.metadata.venue || 'N/A'}`);
  lines.push(`; Author: ${sp.metadata.author || 'N/A'}`);
  lines.push(`; Duration: ${sp.metadata.duration.toFixed(1)}s`);
  lines.push(`; Modules: ${sp.hardwareConfig.modules.length}`);
  lines.push(`; Cues: ${sp.pyroCues.length}`);
  lines.push(`; Generated: ${new Date().toISOString()}`);
  lines.push('; Claim policy: ShowPlan content = validated · FireOne 2.0 acceptance = marketing_hypothesis.');
  lines.push(';');
  lines.push('; Module,Channel,Time(ms),FuseDelay(ms),Effect,Caliber(mm),Elevation,Position,Section');

  // Sort by time, then module, then channel — deterministic.
  const sorted = [...sp.pyroCues].sort(
    (a, b) => a.time - b.time || a.module - b.module || a.channel - b.channel,
  );

  // Per-module channel ceiling: FXK16 = 16ch, others = 32ch.
  const modules = sp.hardwareConfig.modules;
  const channelCeilingFor = (idx: number): number => {
    const m = modules[idx];
    if (!m) return 32;
    return Math.max(1, m.channelCount);
  };

  for (let i = 0; i < sorted.length; i++) {
    const cue = sorted[i];
    if (cue.module < 0) {
      errors.push(`Cue ${i + 1}: invalid module ${cue.module}`);
    }
    const ceiling = channelCeilingFor(cue.module);
    if (cue.channel < 0 || cue.channel >= ceiling) {
      errors.push(
        `Cue ${i + 1}: channel ${cue.channel} out of range 0..${ceiling - 1} for module ${cue.module}`,
      );
    }
    const pos = sp.positions.find((p) => p.id === cue.positionId);
    const timeMs = Math.round(cue.time * 1000);
    lines.push(
      [
        cue.module,
        cue.channel,
        timeMs,
        Math.round(cue.fuseDelay),
        cue.effectId,
        cue.caliber,
        cue.elevation.toFixed(1),
        pos?.name ?? cue.positionId,
        cue.section ?? '',
      ].join(','),
    );
  }

  return {
    filename: FIREONE_FILENAME,
    content: lines.join('\n') + '\n',
    cueCount: sorted.length,
    errors,
  };
}

// ── Disclaimer ───────────────────────────────────────────────────────

function buildDisclaimer(sp: ShowPlan): string {
  return [
    'FXKONTROL · Honest Export Bundle · Disclaimer',
    '─────────────────────────────────────────────',
    '',
    `Show: ${sp.metadata.name} (${sp.metadata.id})`,
    `Generated: ${new Date().toISOString()}`,
    '',
    'Claim policy:',
    '  • ShowPlan content (positions, cues, modules, safety constraints) = VALIDATED.',
    '    Comes directly from the canonical ShowPlan and is regenerable from source.',
    '  • Estimated weights and transport-planning fields in fxk_bom.json =',
    '    MARKETING_HYPOTHESIS. They are coarse references; the operator’s contractual',
    '    BoM overrides this file for regulatory submissions.',
    '  • FireOne 2.0 automatic acceptance of fxk_show.fir = MARKETING_HYPOTHESIS.',
    '    Format mirrors FireOne conventions but has not been certified against a',
    '    live FireOne controller. Manual review by a licensed pyrotechnician is',
    '    required before any field use.',
    '',
    'This bundle DOES NOT authorize firing. Authorization is exclusive of the',
    'CommandBus → SafetyStateMachine in `real_operation` work mode, with dual-key',
    'and continuity-check satisfied.',
    '',
    'Generated by FXKONTROL · simulation = execution = reality',
  ].join('\n');
}

// ── Bundle ───────────────────────────────────────────────────────────

export interface LibertadoresExportBundle {
  fir: FireOneScriptResult;
  sequencingCsv: string;
  bomJson: string;
  disclaimer: string;
  inspection: InspectShowPlanResult;
}

export function buildLibertadoresExportBundle(sp: ShowPlan): LibertadoresExportBundle {
  const inspection = inspectShowPlan(sp);
  const fir = generateFireOneScriptFromPlan(sp);
  const sequencingCsv = sequencingToCsv(inspection.sequencing);
  const bomJson = JSON.stringify(
    {
      showId: sp.metadata.id,
      showName: sp.metadata.name,
      generatedAt: new Date().toISOString(),
      bom: inspection.bom,
      pinout: inspection.pinout,
      minChannelReuseS: inspection.minChannelReuseS,
      tightReuseChannels: inspection.tightReuseChannels,
      claim: {
        showPlanContent: 'validated',
        weightsAndTransport: 'marketing_hypothesis',
        fireOneAcceptance: 'marketing_hypothesis',
      },
    },
    null,
    2,
  );
  const disclaimer = buildDisclaimer(sp);
  return { fir, sequencingCsv, bomJson, disclaimer, inspection };
}

/** Build a downloadable ZIP. Async because JSZip serializes async. */
export async function buildLibertadoresExportZip(sp: ShowPlan): Promise<Blob> {
  const bundle = buildLibertadoresExportBundle(sp);
  const zip = new JSZip();
  zip.file(bundle.fir.filename, bundle.fir.content);
  zip.file(SEQUENCING_FILENAME, bundle.sequencingCsv);
  zip.file(BOM_FILENAME, bundle.bomJson);
  zip.file(DISCLAIMER_FILENAME, bundle.disclaimer);
  return zip.generateAsync({ type: 'blob' });
}

export async function downloadLibertadoresExportZip(
  sp: ShowPlan,
  filename = 'fxk_libertadores_export.zip',
): Promise<void> {
  const blob = await buildLibertadoresExportZip(sp);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const LIBERTADORES_EXPORT_FILES = {
  FIREONE: FIREONE_FILENAME,
  SEQUENCING: SEQUENCING_FILENAME,
  BOM: BOM_FILENAME,
  DISCLAIMER: DISCLAIMER_FILENAME,
} as const;
