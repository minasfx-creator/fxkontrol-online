# FWsim Graphics Tuning — Canonical Mapping

**Source**: `public/fwsim/graphics.xml` (FWsim 3.4.x, authored by Lukas/Marcus).
**Generator**: `scripts/parse-fwsim-graphics.mjs` → `src/data/fwsimGraphicsConfig.json`.
**Accessor**: `src/data/fwsimGraphicsConfig.ts` (`getFwsimGraphics`, `getFwsimPresetHex`, `sampleCurve`).

Read-only mapping between FWsim graphics.xml and FXKONTROL renderers. Data parsed and memoized; renderer wiring opt-in via feature flags so behavior is unchanged until a flag flips ON.

## Feature flags (in `src/lib/featureFlags.ts`)

| Flag | Default | Purpose |
|---|---|---|
| `fwsim_extended_palette` | **ON** | Exposes 30 FWsim preset colors via `getFwsimPresetHex(name)`. Read-only lookup; does NOT touch `vdlQuantizer` (Finale 3D spec stays independent). |
| `r_fwsim_bloom_weights` | OFF | When wired: EffectComposer uses `bloom.amountOfBloom=0.1` + `bloom.upsamplingWeights[8]`. |
| `r_fwsim_tonemapping` | OFF | When wired: ACES tone-mapper uses `tonemapping.contrast=1.7` + `hdrMax=16`. |
| `r_fwsim_launch_flash_v2` | OFF | When wired: LaunchFlash uses `flashes.shellLaunchFlame.sizeDependingOnEnergy` (16→0.2, 1300→1, 13000→1.5). |
| `r_fwsim_mine_calibration` | OFF | When wired: MineEffect consumes `flashes.mineFlame` + `launchSparks.mine*` curves. |
| `r_fwsim_smoke_texture` | OFF | When wired: SmokeSystem swaps procedural noise for `src/assets/textures/fwsim/smoke_with_alpha.png`. |

## Section map

| graphics.xml block | JSON field | Use in FXKONTROL |
|---|---|---|
| `PresetColors_` (29 named RGB) | `presetColors: Record<string,[r,g,b]>` (30 entries — `Red` listed twice) | Color naming, optional renderer tint. NOT a VDL replacement. |
| `TonemappingConfig` | `tonemapping.{contrast, hdrMax}` | Studio Layer 4-5 ACES |
| `MotionBlur` | `motionBlur.{enabled, oneDividedByExposureTime, exposureCorrection}` | EffectComposer post |
| `MainStarsShape` + `MainStars_SettingsForEachType` (8 types) | `mainStarsShape`, `perTypeStars[type].{brightness, shapeOverride?}` | InstancedParticleRenderer per-type |
| `FlashesConfiguration` (3 × `SizeDependingOnEnergy`) | `flashes.{shellLaunchFlame, mineFlame, shellExplosion}` | LaunchFlash, MineEffect, ShellEffect |
| `StrobeConfig` | `strobeConfig.{strobeFadeBegin, strobeFadeEnd}` | Strobe renderer |
| `RandomFlickeringFor{Stars,Tails}` | `randomFlickeringForStars`, `randomFlickeringForTails` | Per-type flicker amplitude |
| `DefaultStarBrightnessCurve` | `defaultStarBrightnessCurve.{durationOfFadeIn, durationOfFadeOut}` | Peony/dahlia fade |
| Scalars (`MainStarsBrightness=25` etc) | `globals.*` | HDR multipliers, size factors |
| `AscentStarFlickering` | `ascentFlickering.minimumBrightness` | Ascent particle |
| `ExplosionSparksConfig` | `explosionSparks.*` | Shell explosion sparks |
| `LaunchSparksConfig` (4 curves + scalars) | `launchSparks.{shell*, comet*, mine*}` | Mine/Comet/Shell launch sparks |
| `Bloom` | `bloom.{amountOfBloom, upsamplingWeights[], radiusForUpsampling, nrLevels, algorithm}` | EffectComposer Bloom |
| `TailDynamics` | `tailDynamics.{particleCountOverTime, particleWidthOverTime}` | Tail renderer |
| `MainStars_/Sparks_Distance_Scaling` | `distanceScaling.{mainStars, sparks}` | Distance LOD |
| `Whistle`, `Farfalle`, `Tourbillon` | `spinners.*` | Spinner physics |
| `Water` | `water.*` | Optional water surface |
| `MainStarSortingEnabled` | `mainStarSortingEnabled: boolean` | Z-sort |

## Curve sampling

```ts
import { getFwsimGraphics, sampleCurve } from '@/data/fwsimGraphicsConfig';

const cfg = getFwsimGraphics();
const nStarsFor150mm = sampleCurve(cfg.launchSparks.shellNrStars, 150); // ~225
const mineFlashScale = sampleCurve(cfg.flashes.mineFlame!.sizeDependingOnEnergy, 75); // 1.25
```

## Out of scope (intentional)

- **FMOD `.bank` files** — proprietary FMOD Studio format. Browser needs `fmodstudio-wasm` (commercial license, ~2 MB). Decision deferred; libre WAV/OGG + Web Audio is the lighter alternative.
- **`fwsim_style_config.xml`** — FWsim UI skin with orange accent #F06700. Conflicts with canonical Vantablack + cyan-dessat palette (memory: `Design Decision Priority`). Not adopted as chrome.
- **`dimensions.png`** — blank pixels, skipped.
- **`2021-04_Old_Effects_Index-3.txt`** — already covered by `src/data/fwsimOldEffectsIndex.ts` (229 names, `marketing_hypothesis`).

## Rebuild

```bash
node scripts/parse-fwsim-graphics.mjs
```

Idempotent. Re-run any time `public/fwsim/graphics.xml` changes upstream.
