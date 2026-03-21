

# Plan: Add Missing Pyrotechnic Effects from Manual + Refine Chemistry

## Summary

The Manual de Pirotecnia (Maio & Jona, 1931) describes several classic pyrotechnic devices that are **missing** from the platform. Cross-referencing the manual's catalog against our `effectTypeSystem.ts` and the `effects/` component folder reveals 5 missing effect types. Additionally, the manual's detailed chemical color science (Sr=red, Ba=green, Cu=blue, Na=yellow, Mg/Al=white) and black powder composition (KNO3 75 + S 12.5 + C 12.5) can refine existing rendering.

## Missing Effects (from Manual)

1. **Bengala (Bengal Light/Flare)** — Manual Ch. IV: colored ground-level flare burning with intense monochromatic flame. Used for illumination and colored ground effects. Not the same as gerb (no sparks, pure flame color). **No component exists.**

2. **Cohete (Rocket)** — Manual describes self-propelled aerial device with stick stabilizer and motor exhaust trail. Already in `FinalePartType` as `'rocket'` with physics (`createRocketTrail`), but **no effect component** and **no entry in EFFECT_TYPES**.

3. **Traca (Firecracker String)** — Manual: rapid sequence of small reports connected by quick-match. Classic ground effect producing staccato bangs with small flashes. **No component exists.**

4. **Margarita/Girasol (Ground Spinner/Saxon)** — Manual: ground-level spinning device with radiating flame arms (different from our `wheel` which is mounted on a pivot — the Saxon/Girasol spins flat on the ground). **No component exists.**

5. **Bomba de Paracaídas (Parachute Flare)** — Manual: aerial shell that deploys a slow-descending illumination star on a parachute. Military and civilian signaling use. **No component exists.**

## Chemistry Refinements (from Manual)

The manual provides explicit color-chemistry mappings that can enhance `particleChemistry.ts`:

- **Cu in S vapor** → "hermosa luz roja" (copper burns RED in sulfur vapor, not blue — a nuance missing)
- **Zn limaduras** → "luz blanca ligeramente azulada" (zinc = blue-white, not in our compounds)
- **Sb (antimonio)** → "llama blancoazulada" (antimony = blue-white)
- **Ca compounds** → "rojo claro" (calcium = light red, distinct from Sr = carmesí)
- **Charcoal type matters**: "carbón rojo" (low-temp, red-brown, easy ignite) vs "carbón negro" (high-temp, black, hard ignite) — affects burn rate and spark color
- **Black powder formula confirmed**: KNO3 75 + S 12.5 + C 12.5 (or S 10 + C 15)

## Changes

### 1. `src/lib/effectTypeSystem.ts` — Add 5 new effect types

Add to `PyroEffectType` union and `EFFECT_TYPES` record:
- `bengal`: Bengal Light — ground, category 'ground', duration 60s, no lift, height 0, spread 0, colorChannels 1
- `rocket`: Rocket — aerial, hasLiftPhase false (self-propelled), category 'aerial', duration 3s, height 80m, defaultShotsPerDevice 1
- `firecracker_string`: Traca — ground, duration 5s, no lift, defaultShotsPerDevice 50 (rapid reports)
- `saxon`: Ground Spinner/Saxon — ground, duration 8s, spread 360, spinning flat
- `parachute_flare`: Parachute Flare — aerial, duration 20s (slow descent), hasLiftPhase true, height 60m

### 2. `src/components/editor/effects/RocketEffect.tsx` — New component

- Motor exhaust trail (use existing `createRocketTrail` from pyroPhysics)
- Ascending phase with visible motor flame (orange-white core)
- Stick visible during ascent (thin cylinder trailing behind)
- At apogee: burst like a shell using ShellBurstRenderer pattern
- Motor smoke trail: thick white-gray, persists longer than shell lift smoke

### 3. `src/components/editor/effects/BengalEffect.tsx` — New component

- Intense colored flame at ground level (no sparks, pure flame)
- Color determined by compound (Sr=crimson, Ba=green, Cu=blue, Na=yellow)
- Long burn duration (30-120s), steady flame with slight flicker
- Smoke column matching flame color (tinted smoke per manual's description)
- Use `thermalColor` from particleChemistry for flame gradient

### 4. `src/components/editor/effects/FirecrackerStringEffect.tsx` — New component

- Rapid sequential small flashes along a line/arc
- Each report: tiny white flash + small smoke puff + ground debris
- Timing: 50-100ms between reports (quick-match speed from manual: "1 metro por segundo")
- Visual: chain of small explosions rippling along placement path
- Sound cue markers for each report

### 5. `src/components/editor/effects/SaxonEffect.tsx` — New component

- Flat ground spinner with 2-4 flame arms
- Rotation accelerates as composition burns
- Spark trails from arm tips forming spiral patterns
- Ground-level (y=0), circular motion
- Different from WheelEffect (vertical pivot) — this is horizontal flat spin

### 6. `src/components/editor/effects/ParachuteFlareEffect.tsx` — New component

- Shell lift phase (reuse PrefireShell logic)
- At apogee: parachute deploys (small mesh or sprite)
- Slow descent with bright illumination star
- Illumination casts light on scene (point light that descends)
- Drift with wind during descent
- Duration 15-30s (much longer hang time than normal shells)

### 7. `src/render_ultra/fireworks/particleChemistry.ts` — Add manual compounds

- Add `zinc` compound: blue-white light, element 'Zn'
- Add `antimony` compound: blue-white flame, element 'Sb'
- Add `calcium` compound: light red (distinct from strontium's crimson)
- Add `black_powder` compound entry with proper KNO3/S/C ratios and characteristic yellow-gray smoke
- Add `sulfurContent` and `charcoalType` ('red' | 'black') fields to `ChemicalCompound` interface — affects burn rate and smoke color per manual's description

### 8. `src/components/editor/effects/index.ts` — Export new components

Add exports for all 5 new effect components.

### 9. `src/lib/pyroPhysics.ts` — Add rocket motor physics

- Add `ROCKET_MOTOR_THRUST` table: caliber → thrust force and burn time
- Add `getRocketApogee()`: calculate max height from motor parameters
- Add `getRocketMotorBurnTime()`: caliber-based motor duration

## Files Summary

| File | Change |
|------|--------|
| `src/lib/effectTypeSystem.ts` | Add bengal, rocket, firecracker_string, saxon, parachute_flare types |
| `src/components/editor/effects/RocketEffect.tsx` | New — motor trail, stick, ascent, burst |
| `src/components/editor/effects/BengalEffect.tsx` | New — colored ground flare |
| `src/components/editor/effects/FirecrackerStringEffect.tsx` | New — rapid sequential reports |
| `src/components/editor/effects/SaxonEffect.tsx` | New — horizontal ground spinner |
| `src/components/editor/effects/ParachuteFlareEffect.tsx` | New — descending illumination |
| `src/render_ultra/fireworks/particleChemistry.ts` | Add Zn, Sb, Ca, black_powder compounds |
| `src/components/editor/effects/index.ts` | Export 5 new components |
| `src/lib/pyroPhysics.ts` | Rocket motor physics tables |

