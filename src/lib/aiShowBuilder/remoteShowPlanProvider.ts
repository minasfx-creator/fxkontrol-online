/**
 * Provider remoto (stub): reservado para integração futura com Lovable AI
 * (Gemini / GPT-5) via edge function. Hoje sempre lança erro para garantir
 * que o fallback local seja usado.
 *
 * Mesmo quando ativado, a saída DEVE passar por validateShowPlan + preview
 * antes de materializeShowPlan. Nunca aplicar diretamente no mundo 3D.
 */
import type { GenerateShowPlanInput, ShowPlanProvider } from './aiShowPlanProvider';
import type { ShowPlan } from './types';

export const remoteShowPlanProvider: ShowPlanProvider = {
  id: 'remote-ai',
  label: 'IA criativa',
  async generate(_input: GenerateShowPlanInput): Promise<ShowPlan> {
    throw new Error('Remote AI provider not configured yet');
  },
};
