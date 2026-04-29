/**
 * Pipeline model — fonte única de verdade renderizável do aiShowBuilder.
 *
 * Garante que mobile portrait, mobile landscape e desktop consumam
 * exatamente o mesmo modelo de dados. O `layoutMode` existe na
 * assinatura apenas para manter a interface consistente e permitir
 * testes de paridade — ele NÃO altera o modelo retornado.
 *
 * Layout responsivo só pode mudar apresentação (CSS, colunas, scroll,
 * densidade), nunca dados (sections/positions/timelineItems/duration/site).
 */
import type {
  PlannedPosition,
  PlannedTimelineItem,
  ShowPlan,
  ShowSection,
  ShowSiteConfig,
} from './types';

export type AiShowBuilderLayoutMode =
  | 'mobilePortrait'
  | 'mobileLandscape'
  | 'desktop';

export interface AiShowPipelineModel {
  duration: number;
  sections: ShowSection[];
  positions: PlannedPosition[];
  timelineItems: PlannedTimelineItem[];
  site: ShowSiteConfig;
}

/**
 * Decide o layout a partir do viewport. SSR-safe (default: desktop).
 * `layoutMode` afeta apenas apresentação visual.
 */
export function getAiShowBuilderLayoutMode(): AiShowBuilderLayoutMode {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'desktop';
  }
  const isDesktop = window.matchMedia('(min-width: 1024px)').matches;
  if (isDesktop) return 'desktop';
  const isLandscape = window.matchMedia('(orientation: landscape)').matches;
  return isLandscape ? 'mobileLandscape' : 'mobilePortrait';
}

/**
 * Extrai o modelo renderizável do ShowPlan canônico.
 * `layoutMode` é aceito apenas para preservar a assinatura — o modelo
 * retornado é idêntico em todos os modos.
 */
export function getPipelineModel(
  plan: ShowPlan,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _layoutMode: AiShowBuilderLayoutMode,
): AiShowPipelineModel {
  return {
    duration: plan.duration,
    sections: plan.sections,
    positions: plan.positions,
    timelineItems: plan.timelineItems,
    site: plan.site,
  };
}
