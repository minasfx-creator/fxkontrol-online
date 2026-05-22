/**
 * Garante que efeitos importados (Amazon, Winda, Magic, Lidu, Showven) e
 * FWsim/Standard Effects sejam encontrados pelo renderer via getEffectById
 * e tenham um VDL parseável — base para a derivação de partType/caliber/
 * height/pattern/color no FireworkRenderer.
 */
import { describe, it, expect } from 'vitest';
import { getEffectById } from '@/data/effectLibraryMap';
import { getFinaleParts } from '@/data/effectsLibraries/registry';
import { finalePartToEffectId } from '@/data/effectsLibraries/finalePartToEffect';
import { FWSIM_BUILTIN_EFFECTS } from '@/data/fwsimBuiltinPresets';
import { getStandardEffects } from '@/data/standardEffectsCatalog';
import { parseVDL } from '@/lib/vdlParser';

type Lib = 'amazon' | 'winda' | 'magic' | 'lidu' | 'showven';
const LIBS: Lib[] = ['amazon', 'winda', 'magic', 'lidu', 'showven'];

describe('importedEffectsRender — renderer lookup fallback', () => {
  const parts = getFinaleParts();

  for (const lib of LIBS) {
    it(`Finale ${lib}: getEffectById resolve e VDL parseia`, () => {
      const sample = parts.find((p) => p.libraryId === lib);
      expect(sample, `bundle Finale precisa conter parts ${lib}`).toBeDefined();
      const id = finalePartToEffectId(sample!);
      const eff = getEffectById(id);
      expect(eff, `getEffectById deve resolver ${id}`).toBeDefined();
      expect(eff!.vdl, 'imported parts carregam VDL').toBeTruthy();
      const parsed = parseVDL(eff!.vdl as string);
      expect(parsed.valid, `VDL "${eff!.vdl}" deve parsear`).toBe(true);
    });
  }

  it('FWsim builtin: ao menos um efeito resolve', () => {
    const e = FWSIM_BUILTIN_EFFECTS[0];
    if (!e) return; // catálogo opcional
    expect(getEffectById(e.id)).toBeDefined();
  });

  it('Standard Effects: ao menos um efeito resolve', () => {
    const list = getStandardEffects();
    const e = list[0];
    if (!e) return;
    expect(getEffectById(e.id)).toBeDefined();
  });

  it('id inexistente continua retornando undefined', () => {
    expect(getEffectById('definitivamente-nao-existe-xyz-999')).toBeUndefined();
  });
});
