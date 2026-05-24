/**
 * UE5 Bridge — accessors p/ catálogos importados do Unreal Engine 5.7.
 *
 * Conteúdo importado dos uploads:
 *  - mvrCatalog.json    (838 fixtures GDTF do DMXLib_v4.mvr)
 *  - niagaraPresets.json (3 cores Ns_Firework: Blue/Yellow/Pink)
 *  - renderSettings.json (defaults MovieRenderPipeline)
 *
 * Presentation only — NÃO toca safety/hardware/workMode.
 */
import mvrCatalog from '@/assets/ue5/mvrCatalog.json';
import niagaraPresets from '@/assets/ue5/niagaraPresets.json';
import renderSettings from '@/assets/ue5/renderSettings.json';

export interface NiagaraBurstPreset {
  id: string;
  label: string;
  color: string;
  secondaryColor: string;
  particleCount: number;
  lifetimeSec: number;
  speed: number;
  coneAngleDeg: number;
  gravity: number;
  drag: number;
  trail: boolean;
  trailHeads: number;
}

export interface MvrFixtureSummary {
  count: number;
  byKind: Record<string, number>;
  source: string;
}

export function getNiagaraPresets(): NiagaraBurstPreset[] {
  return (niagaraPresets as { presets: NiagaraBurstPreset[] }).presets;
}

export function getNiagaraPreset(id: string): NiagaraBurstPreset | undefined {
  return getNiagaraPresets().find((p) => p.id === id);
}

export function getMvrSummary(): MvrFixtureSummary {
  const cat = mvrCatalog as { count: number; totals: Record<string, number>; source: string };
  return { count: cat.count, byKind: cat.totals, source: cat.source };
}

export function getRenderSettings() {
  return renderSettings as {
    source: string;
    extracted: Record<string, string>;
    defaultsApplied: Record<string, string>;
    usage: string;
  };
}
