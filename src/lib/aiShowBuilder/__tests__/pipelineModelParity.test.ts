/**
 * Testes guardiões de paridade responsiva.
 *
 * Garante que mobile portrait, mobile landscape e desktop usem
 * EXATAMENTE o mesmo modelo renderizável do aiShowBuilder.
 * Layout responsivo só pode mudar apresentação, nunca dados.
 */
import { describe, it, expect } from 'vitest';
import { localShowPlanProvider } from '../localShowPlanProvider';
import { getPipelineModel } from '../pipelineModel';
import { DEFAULT_SITE_CONFIG } from '../types';

const SITE = {
  ...DEFAULT_SITE_CONFIG,
  name: 'Parity Arena',
  width: 200,
  depth: 100,
  maxHeight: 100,
  safetyDistance: 15,
};

const PROMPT = 'Show híbrido com finale dourado de 90 segundos';

describe('aiShowBuilder responsive model parity', () => {
  it('uses the same pipeline model for mobile portrait, mobile landscape and desktop', async () => {
    const plan = await localShowPlanProvider.generate({
      prompt: PROMPT,
      site: SITE,
      variationSeed: 42,
    });

    const mobilePortrait = getPipelineModel(plan, 'mobilePortrait');
    const mobileLandscape = getPipelineModel(plan, 'mobileLandscape');
    const desktop = getPipelineModel(plan, 'desktop');

    expect(mobilePortrait).toEqual(mobileLandscape);
    expect(desktop).toEqual(mobileLandscape);
    expect(desktop).toEqual(mobilePortrait);
  });

  it('returns the same identity references regardless of layoutMode', async () => {
    const plan = await localShowPlanProvider.generate({
      prompt: PROMPT,
      site: SITE,
      variationSeed: 7,
    });

    const portrait = getPipelineModel(plan, 'mobilePortrait');
    const landscape = getPipelineModel(plan, 'mobileLandscape');
    const desktop = getPipelineModel(plan, 'desktop');

    // Identidade referencial: nenhum modo pode clonar/reordenar dados.
    expect(portrait.timelineItems).toBe(landscape.timelineItems);
    expect(portrait.timelineItems).toBe(desktop.timelineItems);
    expect(portrait.positions).toBe(desktop.positions);
    expect(portrait.sections).toBe(desktop.sections);
    expect(portrait.site).toBe(desktop.site);
  });

  it('uses timelineItems as the canonical timeline source', async () => {
    const plan = await localShowPlanProvider.generate({
      prompt: PROMPT,
      site: SITE,
      variationSeed: 42,
    });

    const model = getPipelineModel(plan, 'desktop');

    expect(model.timelineItems).toBe(plan.timelineItems);
    expect(model.timelineItems.length).toBeGreaterThan(0);
  });

  it('does not expose any legacy timeline aliases', async () => {
    const plan = await localShowPlanProvider.generate({
      prompt: PROMPT,
      site: SITE,
      variationSeed: 1,
    });
    const model = getPipelineModel(plan, 'desktop') as Record<string, unknown>;

    // Campos legados proibidos no modelo renderizável.
    expect(model.timeline).toBeUndefined();
    expect(model.cues).toBeUndefined();
    expect(model.events).toBeUndefined();
    expect(model.steps).toBeUndefined();
  });
});
