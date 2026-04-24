## Goal
Always render the SwarmGPT panel on `/swarmgpt`, eliminate the dynamic-import failure mode, and surface any runtime/render error inline with a clear reload path — without breaking the rest of the Commander shell.

## Files to create

### `src/components/swarmgpt/PanelErrorBoundary.tsx`
- Class component, state `{ hasError: boolean, error?: Error }`.
- `static getDerivedStateFromError(error)` → `{ hasError: true, error }`.
- `componentDidCatch(error, info)` → `console.error('SwarmGPT panel crashed', error, info)` and calls optional `props.onError?.(error)` so the parent can append a `[PANEL] …` line to the existing System Log.
- Props: `children: ReactNode`, `onError?: (err: Error) => void`, `onReset?: () => void`.
- Fallback UI fits inside the right-rail glass card (no full-page takeover):
  - Title: **"Painel SwarmGPT indisponível"**
  - Short explanatory paragraph (PT-BR).
  - Truncated `error.message` in a `font-mono text-xs` muted block.
  - Two `Button`s side-by-side:
    - **Tentar novamente** → `setState({ hasError: false, error: undefined })` then `props.onReset?.()`.
    - **Recarregar** → `clearLazyRetryFlag()` (imported from `@/lib/lazyRetry`) then `window.location.reload()`.
- Uses existing `Button` from `@/components/ui/button` and Tailwind tokens only — no new CSS.

## Files to modify

### `src/pages/SwarmGPT.tsx`
- Remove imports: `lazy`, `Suspense` (from `react`), and `lazyRetry` (from `@/lib/lazyRetry`).
- Replace `const SwarmGPTPanel = lazy(lazyRetry(() => import('@/components/editor/SwarmGPTPanel')));` with a direct top-level `import SwarmGPTPanel from '@/components/editor/SwarmGPTPanel';`.
- Add `import { PanelErrorBoundary } from '@/components/swarmgpt/PanelErrorBoundary';`.
- Delete the `<Suspense fallback={…spinner…}>` wrapper around `<SwarmGPTPanel … />`.
- Wrap the panel render in:
  ```tsx
  <PanelErrorBoundary
    onError={(e) => append(`[PANEL] ${e.message}`, 'warn')}
    onReset={() => setBusy(false)}
  >
    <SwarmGPTPanel hideHeader onClose={() => navigate(-1)} onLog={…unchanged…} />
  </PanelErrorBoundary>
  ```
- Keep the surrounding `glass-premium` container, `useSystemLog` wiring, HUD, Core, Stage, and System Log untouched.

## Out of scope
- `SwarmGPTPanel.tsx` internals.
- `lazyRetry.ts`, `LazyChunkBoundary.tsx`, routing, other Commander components, global styles.
- Timeline / transport bar work (separate request).

## Trade-off
Removing `lazy` ships `SwarmGPTPanel` and its dependency graph in the same chunk as the `/swarmgpt` route entry. Since the panel **is** the route, this is the right call: it removes the dynamic-import failure that was hiding the panel, and guarantees first paint includes it. The new `PanelErrorBoundary` covers any *runtime* error inside the panel without taking down the rest of the Commander shell.