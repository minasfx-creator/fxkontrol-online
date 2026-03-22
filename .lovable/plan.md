


# Plan: PyroJam 2025 "Timeless Storytimes" — Realism Refinements

## Status: ✅ IMPLEMENTED

All 8 changes completed and verified.

## Summary

Standardized thermal rendering and organic flicker across all pyro effect types using shared utilities (`thermalColorRamp`, `temporalFlicker`, `combustionFlicker`). Upgraded CometEffect with per-particle size shader and denser smoke. Mine ground smoke uses ShaderMaterial. ShellBurstRenderer smoke uses warm/cool gray variation.

## Files Modified

| File | Change |
|------|--------|
| `src/lib/pyroNoise.ts` | Added `thermalColorRamp()` shared utility |
| `src/components/editor/effects/CometEffect.tsx` | Per-particle size shader, 50 smoke wake particles, thermalColorRamp for sparks |
| `src/components/editor/effects/MineEffect.tsx` | thermalColorRamp for all 3 particle classes, ShaderMaterial ground smoke |
| `src/components/editor/effects/FanEffect.tsx` | temporalFlicker + thermalColorRamp, caliber-scaled density |
| `src/components/editor/effects/WaterfallEffect.tsx` | temporalFlicker + thermalColorRamp |
| `src/components/editor/effects/RomanCandleEffect.tsx` | combustionFlicker (main star) + temporalFlicker (sparks) + thermalColorRamp |
| `src/components/editor/effects/SparkShower.tsx` | temporalFlicker + white-hot spawn boost |
| `src/components/editor/effects/ShellBurstRenderer.tsx` | Warm/cool gray smoke variation |
