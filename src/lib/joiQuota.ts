/**
 * joiQuota — Free-tier daily JOI generation counter (UX only — server-side
 * enforcement comes via the entitlements webhook flow).
 *
 * Storage: localStorage, keyed by date so it auto-resets at local midnight.
 */
const KEY = 'fxk:joi-quota';
export const FREE_DAILY_LIMIT = 5;

interface QuotaState {
  date: string; // YYYY-MM-DD
  count: number;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function read(): QuotaState {
  if (typeof window === 'undefined') return { date: today(), count: 0 };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { date: today(), count: 0 };
    const parsed = JSON.parse(raw) as QuotaState;
    if (parsed.date !== today()) return { date: today(), count: 0 };
    return parsed;
  } catch {
    return { date: today(), count: 0 };
  }
}

function write(state: QuotaState) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* quota or privacy mode — no-op */
  }
}

export function getJoiUsage(): { used: number; limit: number; remaining: number } {
  const { count } = read();
  return { used: count, limit: FREE_DAILY_LIMIT, remaining: Math.max(0, FREE_DAILY_LIMIT - count) };
}

/** Returns true if the call is permitted; increments the counter on success. */
export function consumeJoiQuota(): boolean {
  const state = read();
  if (state.count >= FREE_DAILY_LIMIT) return false;
  write({ date: state.date, count: state.count + 1 });
  return true;
}
