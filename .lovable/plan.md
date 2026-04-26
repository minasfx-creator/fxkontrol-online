
# End-to-End Platform Audit, Bug Fixes & UX Polish

I audited the full project (build, typecheck, tests, runtime logs, routes) and found **4 failing tests, 1 runtime warning duplicate registration, and several cleanup opportunities**. The build itself is green. Below is the focused plan.

---

## 🐛 Bugs Found & Fixes

### 1. Duplicate Lockstep system registration (runtime warning)
**Symptom (in console)**: `[Lockstep] System 'executionBridge' already registered`
**Cause**: Both `src/orchestration/EngineProvider.tsx:172` and `src/components/editor/SkyCanvas.tsx:267` register the same `'executionBridge'` system. This causes a noisy warning on every Studio mount and means the SkyCanvas registration silently no-ops.
**Fix**: Remove the duplicate registration from `SkyCanvas.tsx` (keep the one in `EngineProvider`, which is the canonical lifecycle owner). SkyCanvas should only consume, not register.

### 2. `timelineClock` external-sync regressions (2 failing tests)
**Symptom**:
- `syncs external time metadata` → expected `playbackSpeed=1`, got `2`
- `allows external sync while speed is zero` → expected `playbackSpeed=1`, got `0`
**Cause**: The store mirror in `timelineClock` is no longer setting `playbackSpeed` to `1` when an external source attaches (it preserves the prior speed instead of forcing the canonical "playing at real-time" value).
**Fix**: When mirroring external sync into `useProjectStore`, force `playbackSpeed = 1` (matching the documented contract that external time always plays at real-time). This is the original intent — the regression makes external SMPTE/MTC sync behave incorrectly when the user had paused or scrubbed first.

### 3. Stale design-token guard test (2 failing tests)
**Symptom**: `expected src/components/editor/DevSimulationPanel.tsx to exist` and same for `EmulatorTraceTimeline.tsx`.
**Cause**: Those two dev-tooling components were removed from the repo, but `src/lib/__tests__/designTokens.guard.test.ts` still lists them in `MIGRATED_FILES`.
**Fix**: Remove the two deleted files from `MIGRATED_FILES`. Keep `AuditBlackBoxConsole.tsx` (it still exists). This makes the guard accurate again.

---

## 🧹 Code Cleanup

### 4. Lockstep registration ownership
Add a short comment in `EngineProvider.tsx` clarifying that `executionBridge` is registered exactly once at provider boot — to prevent future duplicate registrations from being added in editor components.

### 5. Bundle size note (informational, no action)
Build warns about chunks >600 kB (`three-core`, `vendor-export`, `mermaid.core`). These are already well-isolated vendor chunks and the gzip sizes are reasonable (230 kB / 267 kB / 136 kB). **No change** — splitting `three-core` further hurts more than it helps for this 3D-heavy product. Just noted for awareness.

---

## ✨ UI/UX Polish

### 6. Settings → Segurança tab — add a clearer empty-state hint
The new SafetyGate "Free Mode" (default OFF) is great for new users, but the Settings → Segurança tab currently shows toggles immediately. Add a one-line subtitle at the top:
> "Modo livre ativo. Sem bloqueios. Ative camadas individuais abaixo se você usa hardware ao vivo."

This reinforces the "everything works, no friction" promise per the recently-saved memory `safety-gate-opt-in`.

### 7. LockoutPanel — verify the disabled-state chip on mobile (440×688)
The current viewport is 440×688. Quick visual pass on `LockoutPanel.tsx` to ensure the new "Lockout desativado" chip doesn't overflow on narrow screens, and the link to Settings is tap-friendly (≥44 px touch target).

---

## ✅ Verification Plan
After implementing the fixes:
1. `bunx vitest run` — expect **0 failures** (currently 4).
2. Reload Studio — expect **no `Lockstep` duplicate-registration warning** in console.
3. Open `/settings?tab=safety` — verify subtitle appears and toggles still work.
4. Run `npx tsc --noEmit` — confirm still clean.
5. Build (`vite build`) — confirm still green.

---

## 🚫 Out of Scope (intentional)
- **Browser end-to-end interaction testing** of every feature. The platform has 50+ pages and 300+ editor components; a true full-app E2E would take many hours and is far better done as a dedicated session against the deployed preview. Happy to do a targeted browser pass on a specific flow if you tell me which one (e.g., Studio → Live Firing, Auth → Office, AI Choreography).
- **Refactoring large vendor chunks** — would risk regressions in the 3D pipeline for marginal gain.
- **Touching the SafetyGate behavior** — already shipped and matches your previous approval.

---

**TL;DR**: 4 real bugs (1 runtime warning, 2 timeline regressions, 1 stale test), plus a tiny UX subtitle in Settings. ~6 small files to edit. Low risk, high signal cleanup.
