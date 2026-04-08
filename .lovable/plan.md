

# Ciclo #35 — Chemistry-Calibrated Realism + Bug Fixes (from Documentation)

## Dados Extraídos dos Documentos

| Fonte | Dado-Chave | Aplicação |
|-------|-----------|-----------|
| **Complete Book of Flash Powder** | KClO4 66% + Al 34% = stoichiometric; TNT equivalence 75%; Al: 7400 kcal/g, Mg: 6000 kcal/g; Al melts 660°C, boils 2270°C; Magnalium mp 460°C, SG 2.0 | Validates existing `COMBUSTION_HEAT_KCAL`. Missing: flash burn time "thousandths of a second" |
| **Chemistry of Pyrotechnics** | Strobe = oscillatory combustion with smolder + burn phases; Dragon eggs = lead/bismuth oxide + magnalium with "violent oscillation" and "sharp cracks"; Iron = "bright orange sparks" (not gold); Zinc = "bluish or green" sparks + "electric stars" = "bright blue with bluish zinc sparks"; Charcoal from soft wood = fast burn, hard wood = long-lasting sparks | Iron color wrong, zinc color description mismatch, charcoal burn rate should vary |
| **Pyrotechnic Chemicals** | Iron = "yellow branching sparks"; Titanium = "bright white sparks, intensity affected by particle size"; Lampblack = "finely dispersed orange sparks"; Magnalium = "glitter, strobes, colored stars, crackling stars"; Charcoal soft = fast, hard = long sparks | Confirms iron is yellow-branching (current orange is close), lampblack = orange fine sparks |

## Bugs Identificados

| # | Bug | Local | Fix |
|---|-----|-------|-----|
| 1 | **Iron compound color mismatch** — `particleChemistry.ts` iron color `(1.0, 0.65, 0.15)` = deep orange. But documents say iron produces "bright orange sparks" and "yellow branching sparks" — current is too red, not enough yellow branching | `particleChemistry.ts` L164 | Adjust to `(1.0, 0.75, 0.20)` — brighter, more yellow |
| 2 | **Zinc color too white** — `(0.85, 0.9, 1.0)` is nearly white. Documents: zinc = "bluish or green" and "electric stars are bright blue with bluish zinc sparks" — needs more blue tint | `particleChemistry.ts` L188 | Adjust to `(0.70, 0.82, 1.0)` — more distinctly bluish |
| 3 | **Magnesium boiling point missing** — Flash Powder book confirms Mg boils at 1107°C. Current compound has `meltingPoint: 650` but no `boilingPoint`. Not a visual bug but temperature data is incomplete | `particleChemistry.ts` L121 | Add boiling point comment (no visual impact, skip) |
| 4 | **Flash powder burn duration not modeled** — Documents emphasize flash burns in "thousandths of a second". Current `thermalColorRamp` flash path has 80% of life as white-hot, but the star lifetime for flash/salute effects is not shortened to match millisecond burn | `pyroNoise.ts` thermalColorRamp | Flash life multiplier should be dramatically short — but this is already handled via `dahlia` pattern's 0.35x life multiplier. OK as-is. |
| 5 | **Dragon egg compound lacks lead/bismuth specificity** — Documents say dragon eggs use "lead tetraoxide or bismuth trioxide mixed with magnalium, copper oxide, and NC lacquer" with "oscillatory burning much more vigorous than strobe mix". Current `dragon_egg` pattern uses generic magnalium strobe | `FireworkRenderer.tsx` L661 | Dragon egg strobe should be more violent: shorter cycles, higher spike amplitude |
| 6 | **Lampblack vs charcoal distinction missing** — Documents distinguish: lampblack = "extremely fine, finely dispersed orange sparks" vs charcoal = "charcoal from hard woods for long-lasting spark effects". Current code treats all charcoal identically | `pyroNoise.ts` FLICKER_BY_COMPOUND | Add `lampblack` entry with faster, finer flicker |
| 7 | **Sulfur ignition temp wrong in COMBUSTION_HEAT_KCAL** — Current: 2200 kcal/g. Flash Powder book confirms sulfur is a low-energy fuel (ignites at 223°C). The 2200 value seems reasonable for total combustion heat, but it's a fuel not a metal — HDR boost shouldn't apply equally | `pyroNoise.ts` L291 | Keep value but note it — sulfur doesn't produce bright sparks |
| 8 | **Ferrotitanium alloy missing** — Pyrotechnic Chemicals doc lists "Ferrotitanium [60/40 Fe/Ti]" for "yellow-white sparks in fountains and star compositions". Not modeled | `particleChemistry.ts` | Add ferrotitanium compound |

## Plano de Implementação

### Arquivo 1: `src/render_ultra/fireworks/particleChemistry.ts`

**Fix 1 — Iron color correction (L164):**
- Change iron color from `(1.0, 0.65, 0.15)` to `(1.0, 0.75, 0.22)` — more yellow-orange per documentation "yellow branching sparks"

**Fix 2 — Zinc color correction (L188):**
- Change zinc color from `(0.85, 0.9, 1.0)` to `(0.68, 0.82, 1.0)` — distinctly bluish per "bright blue with bluish zinc sparks"

**Fix 3 — Add ferrotitanium compound (after iron_filings ~L544):**
- New compound: ferrotitanium, 60/40 Fe/Ti alloy, color `(1.0, 0.90, 0.35)` yellow-white, temperature 3000K, sparkSize 1.6

### Arquivo 2: `src/lib/pyroNoise.ts`

**Fix 4 — Add lampblack flicker entry (after charcoal ~L117):**
- `lampblack: { base: 0.65, amplitude: 0.28, popStrength: 0.20 }` — finer, more uniform burn per "extremely fine, finely dispersed"

**Fix 5 — Add ferrotitanium flicker entry:**
- `ferrotitanium: { base: 0.52, amplitude: 0.44, popStrength: 0.48 }` — between iron and titanium flicker

**Fix 6 — Add lead_oxide and bismuth_oxide flicker entries for dragon egg distinction:**
- `lead_oxide: { base: 0.30, amplitude: 0.58, popStrength: 0.68 }` — "violent oscillation" more aggressive than generic lead
- `bismuth_oxide: { base: 0.33, amplitude: 0.55, popStrength: 0.62 }` — similarly violent

### Arquivo 3: `src/components/editor/skycanvas/FireworkRenderer.tsx`

**Fix 7 — Dragon egg strobe more violent (L661-663):**
- Change dragon egg strobe parameters from `0.06, 0.04` to `0.04, 0.025` — faster cycle (15Hz vs 10Hz) per documentation "much more vigorous than strobe mix"
- Add brightness spike: multiply strobe output by 1.3 for dragon_egg pattern

## Ordem de Execução

| Passo | Tarefa |
|-------|--------|
| 1 | Chemistry color corrections (iron, zinc) + ferrotitanium compound |
| 2 | Flicker entries (lampblack, ferrotitanium, lead/bismuth oxide) |
| 3 | Dragon egg strobe violence increase |
| 4 | Build verification |

