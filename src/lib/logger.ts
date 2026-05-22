/**
 * ─── Dev-gated Logger ───────────────────────────────────────────────
 * Wraps console.* so info-level logs are stripped from production builds.
 * Vite replaces `import.meta.env.DEV` with a literal at build time, so
 * the `if` blocks below tree-shake away in production.
 *
 * Use `logger.dev(...)` for hot-path / verbose logs.
 * Always use plain `console.warn` / `console.error` for real problems.
 */

const IS_DEV = import.meta.env.DEV;

export const logger = {
  dev: (...args: unknown[]): void => {
    if (IS_DEV) console.log(...args);
  },
  info: (...args: unknown[]): void => {
    if (IS_DEV) console.info(...args);
  },
  warn: (...args: unknown[]): void => {
    console.warn(...args);
  },
  error: (...args: unknown[]): void => {
    console.error(...args);
  },
};
