
## Cleanup `SmartScriptAssistant.tsx`

Quick, surgical pass to remove dead code and reduce render churn in the JOI assistant panel.

### Changes
1. **Drop unused imports** — scan icon imports from `lucide-react`, shadcn primitives, hooks, and utility modules; remove anything not referenced after the last refactor (e.g. leftover `Zap`, `ChevronDown`, `Button`, etc.).
2. **Trim `EXAMPLE_PROMPTS`** — keep only the 3 prompts actually rendered; remove the residual array entries no longer surfaced in the UI.
3. **Remove unreachable branches**
   - Drop dead conditionals in the `catch` / error path that referenced removed states.
   - Remove guards that depend on flags or props no longer passed in.
   - Collapse `if/else` branches that always evaluate the same way after the swipe-to-close + Escape refactor.
4. **Rerender hygiene**
   - Memoize the trimmed `EXAMPLE_PROMPTS` as a module-level constant (already const, but ensure no inline object literals are rebuilt per render in the header/footer).
   - Replace any inline `() => {}` handlers in static elements with `useCallback` only where they cross a memoized child boundary; otherwise leave alone (cheap).
   - Ensure the swipe-drag `useState` (`dragY`) is reset to `0` in a single place to avoid redundant state writes.

### Out of scope
- No behavior changes (close button, Escape, swipe-to-close, dimensions remain identical).
- No styling changes.
- No new dependencies.

### Validation
- `tsc --noEmit` must report 0 errors.
- Existing JOI-related tests must still pass.
- Manual smoke: open panel, send a prompt, swipe to close, press Escape — all unchanged.

### Files touched
- `src/components/editor/SmartScriptAssistant.tsx` (only)
