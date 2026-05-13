## Rev 7 — Silver Crackling Tip mine family

The 9 uploaded `.fwe` files share an identical Mine body (Silver Crackling, 6 StarTails layers, `MineDistribution{Speed=1.25, Sigma=0.071, Spread≈0.122}`, `Count=14`, lifetime 1.5–2.41 s, `fadeABCD=[0.6434,0.7585,0.9,0.999]`) and differ only by the inner Stars `<Color>` ("tip color"): Aqua, Blue, Green, Mint, Orange, PastelBlue, PastelGreen, PastelPurple, PastelRed.

### Scope

- **Data only.** No safety, workMode, uiCommandGateway, CommandBus, FieldBus, hardware, renderer, or GPGPU change.
- Strict 1:1 with FWsim XML (parameters extracted from the canonical capture, with the per-file color override).

### Files to edit

**1. `src/data/finalePresets.ts`**

Add a shared helper inside `FINALE_MINE_PRESETS` (or as a local builder) that constructs each preset from the canonical Silver-Crackling body + a per-tip color hex. Then add 9 entries:

```
mine-silver-crackling-aqua          (#10D7D7)
mine-silver-crackling-blue          (#2A55FF)
mine-silver-crackling-green         (#22C24A)
mine-silver-crackling-mint          (#80FFC8)
mine-silver-crackling-orange        (#FF7A00)
mine-silver-crackling-pastel-blue   (#A8C8FF)
mine-silver-crackling-pastel-green  (#A8FFB0)
mine-silver-crackling-pastel-purple (#D6A8FF)
mine-silver-crackling-pastel-red    (#FFA8A8)
```

Each entry uses:
- `speedMS: 1.25`, `sigmaRad: 0.071`, `count: 14`
- `starType: 'XSmall'`, `mass: 0.5` (matches `MinimumLifetime/MaximumLifetime` 1.5–2.41 + StarSizeFactor band)
- `lifeMin: 1.5`, `lifeMax: 2.41`
- `fadeABCD: [0.6433962, 0.75849056, 0.9, 0.999]`
- `colorHex: <tip>`
- `tails`: the 6 canonical Silver-Crackling layers from the XML (Spark dense strobe 2.7 Hz body + secondary, plus 2 Crackle layers at `EmitStart 0.25, Life 0.12, sizeFactor 1.4/0.7, Crackle:true`, plus Orange micro-glow at `Life 2.43`, plus a tip-tinted custom-RGB layer that mirrors the per-color fragment `(251,222,170)`-style soft halo — captured per-file).

Extend `resolveMinePresetId()` with prefix-matched regexes (placed BEFORE the existing `glitter`/`gold` clauses):

```ts
if (/silver.*crackl/.test(s)) {
  if (/aqua/.test(s))           return 'mine-silver-crackling-aqua';
  if (/pastel.*blue/.test(s))   return 'mine-silver-crackling-pastel-blue';
  if (/pastel.*green/.test(s))  return 'mine-silver-crackling-pastel-green';
  if (/pastel.*purple/.test(s)) return 'mine-silver-crackling-pastel-purple';
  if (/pastel.*red/.test(s))    return 'mine-silver-crackling-pastel-red';
  if (/\bblue\b/.test(s))       return 'mine-silver-crackling-blue';
  if (/\bgreen\b/.test(s))      return 'mine-silver-crackling-green';
  if (/\bmint\b/.test(s))       return 'mine-silver-crackling-mint';
  if (/\borange\b/.test(s))     return 'mine-silver-crackling-orange';
}
```

**2. `src/data/__tests__/finalePresets.shell.spec.ts`**

- Bump mine-count assertion to `12` (3 existing + 9 new).
- One parametrised block iterating the 9 ids: asserts shared canonical numbers (`speedMS`, `sigmaRad`, `count`, `lifeMin`, `lifeMax`, `fadeABCD`, tail count) and per-id `colorHex`.
- Resolver block with the 9 input strings (and a couple of casing/spacing variants) → expected ids; plus negative case `"silver crackling"` alone returns `undefined` (no tip → ambiguous).

### Out of scope (deferred)

- Any UI surface, library card, or renderer wiring.
- Cake-shot or shell additions.
- Touching `EFFECT_LIBRARY`, `resolveEffect`, or `vdlColorPipeline` (Rev 8 once the catalog stabilizes).

### Verification

- `bunx vitest run src/data/__tests__/finalePresets.shell.spec.ts` green.
- `Object.keys(FINALE_MINE_PRESETS).length === 12`.
- Type-check passes; zero runtime/visual change in the app.
