

## Plan: Upgrade AI CoPilot with Lerp/Clamp Smoothing + CINEMATIC Mode

### What changed
You provided upgraded versions of the AI modules with significant improvements:
1. **AICoPilot** — adds `lerp`/`clamp` helpers, per-mode input scaling (MANUAL/ASSISTED/AI_CONTROL/CINEMATIC), and `suggestedCameraTarget`
2. **FXKAssistant** — new TypeScript version with typed interfaces, orb color/opacity output, and wind compensation state
3. **HARDENING doc** — new Section 6 documenting the AI Copilot layer

### Changes

**1. `modules/ai/AICoPilot.cjs`** — Rewrite with new logic:
- Add `clamp(n, min, max)` and `lerp(a, b, t)` utility functions
- Replace `smoothingFactor` approach with per-mode input maps (MANUAL raw, ASSISTED lerp'd, AI_CONTROL clamped, CINEMATIC extra-dampened)
- Add `getMode()` method
- Return `suggestedCameraTarget` from last trajectory waypoint and full `decision` object
- Override logic: risk + non-MANUAL triggers safe input override

**2. `modules/ai/FXKAssistant.cjs`** — Update to match new behavior:
- Return `orbColor` and `orbOpacity` fields alongside state/hudMessage/voiceMessage
- Add GUIDING state for wind compensation (`windMps > 8`)
- Simplify priority logic (ALERT for risk, CINEMATIC for cinematic/drop, GUIDING for wind, IDLE default)
- Voice messages conditionally included based on `voiceEnabled`

**3. `test/ai_copilot.test.cjs`** — Update tests to match new return shapes:
- AICoPilot test: check for `decision` and `suggestedCameraTarget` in output
- FXKAssistant test: verify `orbColor` and `orbOpacity` are returned

**4. `HARDENING_RENDER_ENGINE3D_LOVABLE.md`** — Add Section 6 documenting the AI Copilot FPV layer

### Test compatibility
All 5 existing tests will continue passing — the new modules maintain backward-compatible return shapes while extending them with new fields.

