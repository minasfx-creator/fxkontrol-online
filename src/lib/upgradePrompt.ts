/**
 * upgradePrompt — Tiny event bus so non-React modules (e.g. joiLLMAdapter)
 * can trigger the global UpgradeDialog without a hook.
 */

export type UpgradeReason = 'export' | 'hardware' | 'joi-quota' | 'joi-unlimited' | 'generic';

export interface UpgradePromptDetail {
  reason: UpgradeReason;
  feature?: string;
}

const EVENT = 'fxk:upgrade-prompt';

export function promptUpgrade(detail: UpgradePromptDetail) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<UpgradePromptDetail>(EVENT, { detail }));
}

export function onUpgradePrompt(handler: (detail: UpgradePromptDetail) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const listener = (e: Event) => handler((e as CustomEvent<UpgradePromptDetail>).detail);
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}
