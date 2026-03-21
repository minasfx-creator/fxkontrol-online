

# Plan: Integrate Historical Manual Knowledge into Chemistry, Physics & Training

## Summary

Three new historical sources provide formulations and techniques absent from our system:
- **Kurt Saxon (1903–1907 cyclopedias)**: 12 Gerbe compositions, Roman Candle compositions (3 variants), star formulations for every color (Crimson, Rose, Green, Yellow, Blue, Violet, White, Mauve/Lilac, Purple), signal fire recipes, lance compositions, and Pin Wheel charges
- **Pyrotechny 1829**: Spur Fire composition (the "most beautiful fire"), rocket mallet-stroke tables by weight (4oz=16, 1lb=28, 2lb=36, 4lb=42, 6lb=56), rocket stick proportions, Caduceus Rockets, Tourbillon construction, wheel compositions (slow/dead/brilliant/Chinese fire)
- **Anderson 1696**: Mathematical rocket proportions (bore=⅓ diameter, fill 4 diameters, bore 2-3), star recipes (Sulphur/Antimony/Saltpetre ratios), center-of-gravity stick balancing
- **FreePyroInfo library**: Catalog index of 100+ PDF references organized by topic (Black Powder, Stars, Shells, Rockets, Colors, Safety)

## Changes

### 1. `src/render_ultra/fireworks/particleChemistry.ts` — Historical Formulations

Add 10 new `REAL_FORMULATIONS` entries from the manuals:

- **`crimson_star_saxon`**: KClO3 24 + Sr(NO3)2 3 + HgCl (calomel) 12 + S 6 + Shellac 6 — intense crimson (Kurt Saxon's formula #1)
- **`blue_star_intense`**: KClO3 16 + Cu(Chertier) 12 + HgCl 8 + Stearine 2 + S 2 + Shellac 1 — "most intense blue" (Saxon formula Blue #3)
- **`violet_star_manual`**: KClO3 9 + Sr(NO3)2 4 + S 6 + CuCO3 1 + HgCl 1 — purple/violet (Saxon)
- **`rose_colored_star`**: KClO3 20 + SrCO3 8 + HgCl 10 + Shellac 2 + S 3 — moisture-resistant rose (Saxon)
- **`golden_yellow_star`**: KClO3 20 + Ba(NO3)2 30 + Na oxalate 15 + S 8 + Shellac 4 — "beautiful contrast with blue" (Saxon)
- **`spur_fire_1829`**: KNO3 4lb + S 2lb + Lampblack 1lb — "most beautiful fire known" (Pyrotechny 1829)
- **`roman_candle_comp_3`**: KNO3 16 + meal powder 11 + S 6 + Sb 4 — Roman candle with antimony sparks (Saxon)
- **`gerbe_golden_rain`**: KNO3 + S 16 + meal powder 11 + Lampblack 20 + Zn flowers + gum arabic — golden rain from gerbe tables (Saxon)
- **`white_fire_1903`**: KNO3 16 + meal powder 1 + S 8 — classic white fire (Scientific American 1903)
- **`signal_scarlet`**: Sr(NO3)2 24 + Ba(NO3)2 20 — Lamarre patent scarlet signal fire (Saxon)

Add `malachite` compound (Cu2(CO3)(OH)2): green colorant, used in violet fire compositions, density 3.8.

Add `calomel` compound (HgCl2/Hg2Cl2): chlorine donor historically used in star compositions (now obsolete due to toxicity), noted as **HISTORICAL ONLY — TOXIC**.

### 2. `src/lib/pyroPhysics.ts` — Rocket Ramming & Stick Proportions

Add from Pyrotechny 1829:

- **`ROCKET_MALLET_STROKES`** table: maps rocket weight to required mallet strokes per ladle of charge:
  - 4oz=16, 8oz=20, 1lb=28, 2lb=36, 4lb=42, 6lb=56
- **`ROCKET_STICK_LENGTH`** table: maps rocket weight to stick length (in feet):
  - 6lb=11ft, 4lb=10ft, 2lb=9.3ft, 1lb=8.2ft, 8oz=6.5ft, 4oz=5.25ft
- **`ROCKET_BORE_RATIO`**: constant 1/3 (Anderson 1696: bore diameter = ⅓ rocket diameter)
- **`ROCKET_FILL_DIAMETERS`**: 4 (fill height = 4× diameter, bore 2-3 diameters)

Add `getRocketStickLength(weightLbs)` and `getRocketMalletStrokes(weightOz)` functions.

### 3. `src/lib/effectTypeSystem.ts` — Add Historical Effect Types

Add 4 new types from the manuals:

| Type | Source | Category | Description |
|------|--------|----------|-------------|
| `tourbillon` | Pyrotechny 1829 | aerial | Spinning case with opposing vents, rises while rotating |
| `caduceus` | Pyrotechny 1829 | aerial | Two rockets on opposite sides of stick forming spiral lines |
| `table_rocket` | Pyrotechny 1829 | ground | Spins horizontally on a cone point, circle of fire |
| `spur_fire` | Pyrotechny 1829 | ground | "Most beautiful fire" — clusters of stars/pinks without drossy sparks |

### 4. `src/pages/Training.tsx` — Add Manual References + New Chapter

Add 3 new manuals to `MANUALS` array:
- **Kurt Saxon "Granddad's Fireworks"** (1903-1907 cyclopedias): Topics — Star Formulas, Roman Candles, Gerbe Compositions, Signal Fires, Lance Work
- **Pyrotechny 1829 "Endless Amusement"**: Topics — Rocket Construction, Wheels, Tourbillons, Spur Fire, Touch Paper, Quick Match
- **Anderson 1696 "The Making of Rockets"**: Topics — Mathematical Rocket Proportions, Bore Ratios, Composition Recipes, Stick Balancing, Center of Gravity

Add new chapter **Cap. 8 — Técnicas Históricas** with 3 missions:
- **`historical-star-formulas`**: "Fórmulas Clássicas de Estrelas" — Identify which historical formula produces each color (crimson, blue, violet, rose, golden yellow). Reference Saxon's compositions. Difficulty: easy, XP: 200
- **`rocket-proportions`**: "Proporções Matemáticas de Foguetes" — Calculate bore diameter (⅓), fill height (4D), stick length (11× for 6lb), and mallet strokes per Anderson & 1829 manuals. Difficulty: medium, XP: 350
- **`roman-candle-charging`**: "Carregamento de Candelas Romanas" — Sequence the charging process: clay plug → blowing powder (graduated scoops) → star → fuse → repeat. Per Saxon's detailed instructions. Difficulty: medium, XP: 300

### 5. `src/render_ultra/fireworks/particleChemistry.ts` — FreePyroInfo Reference Index

Add `PYRO_REFERENCE_LIBRARY` constant: array of categorized reference entries from the FreePyroInfo catalog, grouped by topic:
- Black Powder (8 references: Discovery of Gunpowder, Chemical & Ballistic Properties, Greek Fire, etc.)
- Stars & Colors (per Saxon's systematic color tables)
- Rocket Science (Anderson 1696, Pyrotechny 1829 proportions)
- Roman Candles (charging technique, scoops, fuse intervals)

This serves as metadata for the Training library UI — no file downloads, just topic/title/author for educational reference.

## Files Summary

| File | Change |
|------|--------|
| `src/render_ultra/fireworks/particleChemistry.ts` | 10 historical formulations, malachite & calomel compounds, reference library index |
| `src/lib/pyroPhysics.ts` | Rocket ramming strokes, stick length tables, bore ratio constants |
| `src/lib/effectTypeSystem.ts` | Add tourbillon, caduceus, table_rocket, spur_fire |
| `src/pages/Training.tsx` | 3 new manuals, Cap. 8 with 3 historical technique missions |

