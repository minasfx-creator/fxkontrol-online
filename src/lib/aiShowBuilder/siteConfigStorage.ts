/**
 * Persistência leve do ShowSiteConfig por projectId em localStorage.
 * Não mexe no schema do banco e não interfere em save_project_atomic.
 */
import type { ShowSiteConfig } from './types';

const KEY_PREFIX = 'fxk:aiShowBuilder:site:';
const GLOBAL_KEY = 'fxk:aiShowBuilder:site:__global__';

function safeParse(raw: string | null): ShowSiteConfig | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ShowSiteConfig>;
    if (
      typeof parsed?.width === 'number' &&
      typeof parsed?.depth === 'number' &&
      typeof parsed?.maxHeight === 'number' &&
      typeof parsed?.safetyDistance === 'number' &&
      typeof parsed?.audiencePosition === 'string' &&
      typeof parsed?.showType === 'string'
    ) {
      return parsed as ShowSiteConfig;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function loadSiteConfig(projectId: string | null): ShowSiteConfig | null {
  if (typeof window === 'undefined') return null;
  try {
    const key = projectId ? KEY_PREFIX + projectId : GLOBAL_KEY;
    return safeParse(window.localStorage.getItem(key))
      ?? safeParse(window.localStorage.getItem(GLOBAL_KEY));
  } catch {
    return null;
  }
}

export function saveSiteConfig(projectId: string | null, config: ShowSiteConfig): void {
  if (typeof window === 'undefined') return;
  try {
    const payload = JSON.stringify(config);
    window.localStorage.setItem(GLOBAL_KEY, payload);
    if (projectId) window.localStorage.setItem(KEY_PREFIX + projectId, payload);
  } catch {
    /* quota / private mode — silently ignore */
  }
}
