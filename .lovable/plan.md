

# Ciclo de Polish #27 — Crossette Split Physics, Kamuro Star Weight, Nishiki Shimmer

## Bugs Identificados

| # | Bug | Local | Fix |
|---|-----|-------|-----|
| 1 | **Crossette sub-particles spawn spherically** — L788 uses random `theta/phi` for sub-burst velocities. Real crossettes split into exactly 4 symmetrical arms at 90° intervals, each arm a tight cluster. Current code creates a random cloud instead of directional splits | `FireworkRenderer.tsx` L786-791 | Compute 4 arm directions from parent velocity vector, spawn sub-particles along each arm with tight jitter cone |
| 2 | **Crossette sub-particles overwrite main stars** — L811 writes sub-particle data into `STAR_COUNT - 1 - (i % 15%)` which stomps on real star positions. Stars at the tail of the buffer flicker/teleport | L811-816 | Use dedicated crossette sub-buffer rendering (separate Points mesh) or write into slots after `STAR_COUNT` with expanded buffer |
| 3 | **Crossette sub-particle count inconsistent** — L783 spawns 4-6 random sub-particles per star via `Math.random()`. Should be exactly 4 (crossette = "cross" = 4 arms) | L783 | Fix to exactly 4 sub-particles per parent star |
| 4 | **Kamuro falls through generic else branch** — L591 uses default `gravityMult` without progressive droop. Kamuro stars are heavy metal-coated (gold/silver) and should have increasing gravity similar to willow/horsetail | L591-593 | Add dedicated `kamuro` branch with progressive gravity: `1.0x` early → `3.5x` at 60%+ life, matching heavy star weight |
| 5 | **Kamuro drag too aggressive** — `dragMult = 0.45` (L467) combined with low velocity `0.35 * breakSpeed` (L228) makes kamuro barely expand. Real kamuro has moderate initial spread that gradually droops into a golden cascade | L228, L467 | Increase initial velocity to `0.45 * breakSpeed`, reduce dragMult to `0.55` for wider initial spread before gravity takes over |
| 6 | **Nishiki shimmer uses generic trailing flicker** — L633 applies `temporalFlicker(base=0.82, amp=0.15)` to all trailing patterns. Real nishiki kamuro has a distinctive high-frequency aluminum shimmer (20-30Hz oscillation) that differentiates it from plain kamuro | L631-633 | Add nishiki detection (pattern=kamuro + color=gold/#FFD700) and apply high-frequency shimmer: `base=0.75, amp=0.25` with 25Hz overlay |
| 7 | **Crossette trail segments use default gravity** — L697-731 has no crossette-specific trail handling. After split, sub-particle trails should show the 4-arm divergence | trail section | Add crossette trail gravity handling (slightly increased post-split) |

## Plano de Implementacao

### Arquivo 1: `src/components/editor/skycanvas/FireworkRenderer.tsx`

**Fix 1-3: Crossette sub-split rewrite (L776-817)**
- Change sub-particle spawn to compute 4 arm directions from parent velocity: `armDir = rotate(parentVel, armIndex * PI/2)` around parent velocity axis
- Each arm gets exactly 1 sub-particle (4 total per star) with speed `breakSpeed * 0.4` and tight 8° cone jitter
- Write sub-particles into the crossetteSubData buffers without stomping main buffer — render as overlay positions in the buffer's reserved tail region (`STAR_COUNT * 0.85` to `STAR_COUNT`)

**Fix 4-5: Kamuro physics branch (L590, insert before else)**
- Add `pattern === 'kamuro'` branch:
  - Progressive gravity: `starAge < 0.4 ? gravityMult * 0.8 : gravityMult * (0.8 + (starAge - 0.4) / 0.6 * 2.7)` (peaks at 3.5x)
  - Reduced horizontal drag: `dragCoeff * 0.7` for wider cascade spread
- Update velocity init L228: `0.35 → 0.45`
- Update dragMult L467: `0.45 → 0.55`

**Fix 6: Nishiki shimmer (L631-633)**
- Detect nishiki: `pattern === 'kamuro' && (baseColor similarity to gold #FFD700)`
- Apply shimmer overlay: `temporalFlicker(seed, time, 0.70, 0.30, 0.12)` + high-freq modulation `sin(time * 50 + seed) * 0.15`
- Non-nishiki kamuro keeps current trailing flicker

**Fix 7: Crossette trail gravity (L697-731)**
- Add `pattern === 'crossette'` case in trail gravity section
- Post-split segments (segAge > 0.4): `trailGrav = gravityMult * 1.5` for visible droop divergence

## Ordem de Execucao

| Passo | Tarefa |
|-------|--------|
| 1 | Kamuro physics branch + velocity/drag calibration |
| 2 | Nishiki shimmer detection + high-freq flicker |
| 3 | Crossette sub-split rewrite (4-arm directional) |
| 4 | Crossette trail gravity |
| 5 | Build verification |

