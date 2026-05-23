/**
 * niagaraBlenderRules — pure type extracts
 * ─────────────────────────────────────────────────────────────────
 * Lives here (separate from `niagaraBlenderRules.ts`) so consumers
 * that only need the `ViewTransform` literal type can `import type`
 * from a module with **zero runtime dependencies on `three`**.
 *
 * Why this matters: any `import type` from a module that statically
 * imports `three` keeps `three` in the eager bundle graph because
 * Vite/Rollup analyses the whole module file before tree-shaking
 * the type. Splitting the type into its own file lets the public
 * route stay below the bundle budget.
 */
export type ViewTransform = 'aces-filmic' | 'agx' | 'standard' | 'pbr-neutral';
