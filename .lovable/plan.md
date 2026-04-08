

# Ciclo #33 — Time Rain Column Stability, Girandola Precession Fix, Strobe Pulse Frequency + Trail Sync

## Bugs Identificados

| # | Bug | Local | Impacto |
|---|-----|-------|---------|
| 1 | **Time rain columns drift too much** — Hanging phase applies `w[0] * driftT * 2.5` lateral wind + per-star scatter, causing stars to spread horizontally. Real time rain hangs in tight vertical columns with minimal drift. Rain phase also lacks per-star column grouping | FireworkRenderer L537-539 | Columns dissolve into cloud |
| 2 | **Girandola visual hub rotation doesn't match precession** — Spark physics computes proper `precessionAngle` from `time * precessionRate`, but visual hub uses hardcoded `vizTiltAngle * 0.5` and `0.3` for X/Z rotation instead of deriving from precession angle. Hub visually decouples from spark trajectories | GirandolaEffect L161-162 | Hub doesn't visually precess |
| 3 | **Strobe pulse too slow (3.6Hz vs real 6-12Hz)** — `strobeFlicker` called with `smolderDuration=0.2, burnDuration=0.08` → cycle 0.28s = 3.6Hz. Real magnalium strobe stars pulse at 8-12Hz. Also, "Gold Strobing" effect (peon-06) uses generic flicker, not strobe | FireworkRenderer L660, pyroNoise L172 | Strobe looks like slow blink |
| 4 | **Horsetail trail gravity mismatch** — Trail uses `4.8` ramp but main star uses `5.5`. Trails lag behind stars | FireworkRenderer L748-749 | Trail/star visual separation |
| 5 | **Coconut trail pattern name wrong** — `'coconut'` vs `'coconut_tree'` | FireworkRenderer L752 | Trails ignore 3-phase gravity |
| 6 | **Saturn ring trail missing reduced gravity** — No saturn case in trail section → ring trails sag while stars stay flat | FireworkRenderer L778 | Ring deformation in trails |

## Plano de Implementação

### Arquivo 1: `src/components/editor/skycanvas/FireworkRenderer.tsx`

**Fix 1 — Time rain column stability (L516-547):**
- Reduce hanging phase wind multiplier from `2.5` to `0.6` (tight columns)
- Reduce lateral scatter amplitude from `0.003` to `0.001`
- Reduce sinusoidal drift amplitude from `0.08/0.06` to `0.03/0.02`
- Add column grouping: stars with same `sparkleSeeds[i] % 8` form a column, sharing base drift

**Fix 2 — Strobe frequency (L660):**
- Change `strobeFlicker(sparkleSeeds[i], time, 0.2, 0.08)` → `strobeFlicker(sparkleSeeds[i], time, 0.06, 0.04)` → cycle 0.10s ≈ 10Hz
- Add "Gold Strobing" detection: if effect name contains "strobing" or compound includes strobe marker, use `strobeFlicker` instead of generic flicker

**Fix 3 — Trail sync (L748-778):**
- Horsetail: `4.8` → `5.5`, drag `0.7` → `0.55`
- Coconut: `'coconut'` → `'coconut_tree'`
- Add saturn trail case after kamuro: ring stars (first 60%) get `gravityMult * 0.3`

### Arquivo 2: `src/components/editor/effects/GirandolaEffect.tsx`

**Fix — Visual hub precession (L155-162):**
- Compute `vizPrecessionAngle` from elapsed time (use `progress * 10` as proxy for continuous time)
- Set hub rotation X = `Math.sin(vizPrecessionAngle) * vizTiltAngle`, Z = `Math.cos(vizPrecessionAngle) * vizTiltAngle` (matching spark physics formula)
- Keep Y = `vizTotalAngle` (spin)

### Arquivo 3: `src/lib/pyroNoise.ts`

**Enhancement — strobeFlicker frequency range:**
- No change to function signature, but add doc comment noting recommended ranges: magnalium 8-12Hz (smolder=0.06-0.08, burn=0.03-0.05), dragon_egg 6-8Hz (smolder=0.08-0.10, burn=0.04-0.06)

## Ordem de Execução

| Passo | Tarefa |
|-------|--------|
| 1 | Time rain column stability + strobe frequency (FireworkRenderer) |
| 2 | Trail sync: horsetail, coconut, saturn (FireworkRenderer) |
| 3 | Girandola visual precession fix |
| 4 | Build verification |

