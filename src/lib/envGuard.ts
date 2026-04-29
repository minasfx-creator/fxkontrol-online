/**
 * envGuard — runtime validation of critical Vite env vars.
 *
 * WHY: missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY at runtime
 * causes the supabase client to silently fall back to broken defaults — every
 * subsequent .from() / .functions.invoke() call then fails with cryptic
 * "Failed to fetch" or 401s long after the actual root cause. We fail fast
 * at module load so the deployment misconfiguration is impossible to miss.
 *
 * Called once from src/main.tsx before React mounts.
 */

const REQUIRED = [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
] as const;

export interface EnvGuardResult {
  ok: boolean;
  missing: string[];
}

export function validateRuntimeEnv(): EnvGuardResult {
  const env = import.meta.env as Record<string, string | undefined>;
  const missing: string[] = [];
  for (const k of REQUIRED) {
    const v = env[k];
    if (typeof v !== "string" || v.trim().length === 0) missing.push(k);
  }
  return { ok: missing.length === 0, missing };
}

/**
 * Throws in production builds if any required env var is missing.
 * In dev, only warns — Vite already surfaces missing vars in the overlay.
 */
export function assertRuntimeEnv(): void {
  const { ok, missing } = validateRuntimeEnv();
  if (ok) return;
  const msg = `[envGuard] Missing required env vars: ${missing.join(", ")}`;
  if (import.meta.env.PROD) {
    // Render a visible banner so misconfigured deploys never look "blank".
    if (typeof document !== "undefined") {
      const el = document.createElement("div");
      el.setAttribute("role", "alert");
      el.style.cssText =
        "position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:#0a0c10;color:#ff5e5e;font-family:system-ui,sans-serif;padding:24px;text-align:center;";
      el.textContent = `Configuração inválida do servidor. ${msg}`;
      document.body?.appendChild(el);
    }
    throw new Error(msg);
  }
  // Dev: just warn — local devs without .env still need the app to render.
  // eslint-disable-next-line no-console
  console.warn(msg);
}
