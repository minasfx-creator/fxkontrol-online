# Round 6 — Studio / 3D Viewport Functional Walkthrough

## ✅ Pre-flight (already verified, read-only)

| Check | Result |
|---|---|
| Tests | **604 / 604 passing** ✅ |
| Typecheck | clean ✅ |
| Dev runtime | no errors; FPS ~135–145 (session replay) ✅ |
| ESLint | 758 issues — **0 new actionable items**; all in 3 documented out-of-scope buckets (`no-explicit-any` × 575, `exhaustive-deps` × 132, `react-refresh/only-export-components` × 51) |

→ **No mechanical lint round needed.** Switching mode to a focused functional pass.

---

## 🎯 Scope: `/studio` → `<Index />` (SkyCanvas + editor shell)

### Walkthrough steps (browser automation, ~10–14 actions)

1. **Boot snapshot** — navigate to `/studio`, screenshot, capture console + network. Confirm SkyCanvas mounts cleanly (Premium Startup: starDensity 1.3, moon 0.8, fog 0.35 per memory).
2. **Viewport top bar (`ViewportBar`)** — observe chips, click each visible mode toggle (Synthetic / Terrain / Studio), screenshot transitions, watch console for WebGPU/WebGL2 fallback decisions.
3. **Right sidebar (`ViewportNavControls`)** — hover/click each icon button, verify tooltips + `aria-label` (Round 4 added these), confirm panels open/close without nesting violations.
4. **Camera controls per editor standard (memory: refinamento-viewport)** — middle-mouse-orbit, right-mouse-pan, wheel-zoom. Validate via observe + drag where supported; if drag fails (known dnd-kit limitation), report it instead of looping retries.
5. **Bottom timeline (`TimelineClockPanel`)** — confirm SMPTE clock ticks, scrub a few frames, check 4px dead-zone snap behavior (memory: timeline-ux-precision-snapping).
6. **World Shows panel** — open, pick one preset (e.g., Copacabana), confirm fixtures load + camera reframes, screenshot.
7. **Operator / Walk Mode toggle** — flip on, verify altitude lock to 1.7m + ±80° pitch clamp (memory: ground-operator-mode-altitude-lock); flip back off.
8. **Performance probe** — `browser--performance_profile` to capture JS heap, DOM nodes, layout count after the walkthrough; flag anything > sane thresholds.
9. **Network tab** — list XHR/fetch during the run, flag any 4xx/5xx (especially Google 3D Tiles + edge functions).
10. **Console final scan** — error/warn filter; cross-reference with code if anything new surfaces.

### Destructive actions explicitly skipped
- No fire / E-STOP / arming triggers
- No write to ShowPlan via persisted mutations
- No live-firing mode entry

---

## 🛠 Deliverables after the walkthrough

1. **Bug report** — any console errors, broken interactions, missing `aria-label`s, layout overflows, slow interactions (>100ms script time on a click). For each: file + line + proposed one-line fix.
2. **UX polish list** — tooltip gaps, focus-ring inconsistencies, inconsistent spacing/tokens vs. `interface/estetica-command-grade-mission-control` palette (Vantablack #050810, Cyan/Green/Amber/Red semantics).
3. **Fix the small stuff inline** — for trivial issues found (typos, missing `aria-label`, wrong token), patch them in the same round and report; per browser policy I will **stop and tell you** before bigger refactors.
4. **Final verification** — re-run vitest + tsc to prove nothing regressed.

---

## 🚫 Explicitly out of scope
- The 758 documented lint warnings (no-explicit-any baseline / shadcn variant exports / intentional exhaustive-deps).
- Drag-and-drop heavy interactions (dnd-kit is browser-automation hostile per limitations).
- Live Firing, Auth, AI Choreo, Office, Hardware Discovery flows — separate rounds on request.

---

**Estimated impact:** ~10–14 browser actions, ~3–8 small file patches if issues are found, full vitest re-run at the end. No schema changes, no migrations.
