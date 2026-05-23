/**
 * Função central de geração com fallback seguro.
 *
 * Estratégia atual: usa o provider local determinístico.
 * Quando o remoto for habilitado, esta função tentará o remoto primeiro
 * e cairá no local em caso de erro/timeout, sempre devolvendo um ShowPlan
 * pronto para validateShowPlan + preview + materializeShowPlan.
 */
import type { GenerateShowPlanInput, ShowPlanProvider } from './aiShowPlanProvider';
import { localShowPlanProvider } from './localShowPlanProvider';
import type { ShowPlan } from './types';

export interface GenerateShowPlanResult {
  plan: ShowPlan;
  providerId: string;
  fellBack: boolean;
}

let activeProvider: ShowPlanProvider = localShowPlanProvider;

export function setActiveShowPlanProvider(provider: ShowPlanProvider): void {
  activeProvider = provider;
}

export function getActiveShowPlanProvider(): ShowPlanProvider {
  return activeProvider;
}

export async function generateShowPlanWithProvider(
  input: GenerateShowPlanInput,
): Promise<ShowPlan> {
  const result = await generateShowPlanWithProviderDetailed(input);
  return result.plan;
}

export async function generateShowPlanWithProviderDetailed(
  input: GenerateShowPlanInput,
): Promise<GenerateShowPlanResult> {
  const provider = activeProvider;
  if (provider.id === localShowPlanProvider.id) {
    const plan = await provider.generate(input);
    return { plan, providerId: provider.id, fellBack: false };
  }

  try {
    const plan = await provider.generate(input);
    return { plan, providerId: provider.id, fellBack: false };
  } catch (err) {
    // Fallback seguro: sempre devolver um plano via gerador local.
    console.warn(
      `[aiShowBuilder] provider "${provider.id}" failed, falling back to local:`,
      err,
    );
    const plan = await localShowPlanProvider.generate(input);
    return { plan, providerId: localShowPlanProvider.id, fellBack: true };
  }
}
