

# Ciclo de Polish #25 — Time Rain Apogee Drift, Girandola Precession, Tourbillon Trail

## Bugs Identificados

| # | Bug | Local | Fix |
|---|-----|-------|-----|
| 1 | **Time rain hangT calculation wrong** — `hangT = hangStart * lt / (starLife * 0.88)` uses elapsed time `lt` which changes every frame, making the "apogee anchor" slide. Should use a fixed fraction of total lifetime | `FireworkRenderer.tsx` L507, L517 | Calculate `hangT` as `hangStart * starLife * 0.88 / (starLife * 0.88)` → simplify to just `hangStart * lt_total_fraction` using the actual elapsed time at hangStart |
| 2 | **Time rain wind drift during hang too weak** — stars barely move laterally during the 30% hang phase. Real time rain drifts visibly with wind at apogee | L512-514 | Amplify wind drift during hang: `w[0] * driftT * 2.0` and add per-star lateral scatter based on sparkleSeeds |
| 3 | **Time rain rain phase gravity too weak** — `rainT = rainPhase * 3.0` then `GRAVITY * 1.2` produces slow descent. Real time rain stars accelerate sharply | L521-524 | Increase rain gravity to `2.5x` and reduce horizontal damping to create vertical rain columns |
| 4 | **Girandola no gyroscopic precession** — wobble is simple sin/cos offset, not a tilting spin plane. Real girandolas precess: the spin axis traces a cone as angular momentum builds | `GirandolaEffect.tsx` L82-83 | Add precession: tilt the entire spin plane using a rotation matrix that precesses around vertical axis. Tilt angle grows with omega, precession rate inversely proportional to omega (gyroscopic) |
| 5 | **Girandola sparks use device wobble offset** — sparks at L123-125 add `wobbleX/Z` directly instead of transforming through the precessing frame. Creates disconnect between spark emission and visible wheel orientation | L123-125 | Transform spark nozzle positions through the precession rotation |
| 6 | **Tourbillon trail uses Math.random() per frame** — L149, L151 inject random jitter every frame, causing trail points to flicker/dance instead of being smooth | `TourbillonEffect.tsx` L149, L151 | Replace with deterministic noise based on point index: `sin(i * 73.37) * 0.06` |
| 7 | **Tourbillon trailSizes buffer unused** — L49 allocates trailSizes and L160 fills it, but it's never attached as a `size` attribute. The material uses a fixed `size={0.22}` | L160, L273 | Attach trailSizes as a `size` attribute and use a custom vertex shader snippet, OR use the simpler approach: modulate point size via the alpha channel and keep the fixed size but vary opacity for taper effect (already partially done via color fade) |

## Plano de Implementacao

### Arquivo 1: `src/components/editor/skycanvas/FireworkRenderer.tsx`

**Fix 1-3: Time rain apogee drift rewrite**
- Compute `hangT` correctly: `const hangT = hangStart * lt` (time at which hang starts = fraction of elapsed time)
- Hang phase: amplify wind drift (2.5x), add per-star lateral scatter `± sparkleSeeds[i] % 30 * 0.02`
- Rain phase: gravity `2.5x`, reduce horizontal velocity to create vertical rain columns
- Add trail droop for time_rain pattern in trail segment computation (L710-725)

### Arquivo 2: `src/components/editor/effects/GirandolaEffect.tsx`

**Fix 4-5: Gyroscopic precession**
- Add precession state: `precessionAngle = time * precessionRate`, where `precessionRate = 0.8 / (1 + omega * 0.1)` (slower precession as spin increases — gyroscopic stability)
- Tilt angle: `tiltAngle = Math.min(0.25, omega * 0.008)` radians (~15° max)
- Transform all nozzle positions and ejection vectors through the precession rotation matrix
- Remove simple wobbleX/Z, replace with proper tilt transformation

### Arquivo 3: `src/components/editor/effects/TourbillonEffect.tsx`

**Fix 6-7: Deterministic trail + size taper**
- Replace `Math.random()` jitter with `Math.sin(i * 73.37 + clampedP * 11) * 0.04`
- Remove trailSizes buffer (unused overhead) — taper is already achieved via color fade
- OR: attach trailSizes as attribute with custom shader — prefer removing since point size variation via color intensity is sufficient

## Ordem de Execucao

| Passo | Tarefa |
|-------|--------|
| 1 | Fix time rain apogee drift + wind + rain gravity |
| 2 | Fix time rain trail segments |
| 3 | Girandola gyroscopic precession |
| 4 | Tourbillon deterministic trail |
| 5 | Build verification |

