# Plano rev4 — Mine + Comet + Shell presets canônicos

Consolida no mesmo `src/data/finalePresets.ts` os 7 shells reais extraídos dos FWE enviados, mantendo os mines (rev2) e comets (rev3) já planejados.

## Parâmetros canônicos extraídos (FWsim Pro)

| Preset | Stars Count | Speed | Sigma | Star Type / Mass | Lifetime (s) | FadeRatios A,B,C,D | Tails | Cor | Strobe |
|---|---|---|---|---|---|---|---|---|---|
| **peony** (01) | 110 | 0.8 | 0.017 | XXSmall / 0.7 | 1.2–1.6 | 0.077, 0.420, 0.891, 0.996 | — | Red (override) | — |
| **peony-pistil** (02) | 110 + pistil | 0.8 / pistil 0.3 | 0.017 | XXSmall / 0.7 | 1.2–1.6 | mesmo peony | — | Outer Orange + pistil | — |
| **wave** (03) | ~80 | 0.7 | 0.05 (anel) | XSmall / 0.6 | 0.8–1.2 | (0,0.124,0.63,1) | Silver Sparks D250 W0.6 Life0.05 strobe 2.7Hz | Spark | sim |
| **chrysanthemum** (04) | ~120 | 0.9 | 0.025 | XSmall / 0.6 | 1.5–2.0 | (0.46,0.71,0.71,1) | Brocade #2: D250 W0.4 Life2.6 + D40 (gold→amber 254/176/0) | Custom (51,26,0) gold | — |
| **dahlia** (05) | 20 | 0.6 | 0.024 | Normal / 0.8 | 2.0–2.5 | 0.064, 0.497, 0.824, 0.999 | — | LightPink (override) | — |
| **palm** (06) | ~30 (semi) | 1.0 vert / 0.05 lateral | Normal / 1.0 | 1.6–2.2 | (0.147,0.852,0.853,1) | Gold #2: D400 W0.6 Life0.8 (255,226,174) + D100 W0.4 | Custom warm gold | — |
| **crown** (07) | ~40 | 1.1 | 0.04 | Small / 0.7 | 1.4–1.8 | (0.178,0.780,0.781,1) | Gold Ferrotitanium #2: D400 W0.5 EmitEnd 0.9 (120,70,29) + D200 W0.1 ferrotitanium (90…) | Custom amber | — |

(Counts marcados ~ serão refinados na leitura completa dos FWE; valores acima já cobrem a janela visível do upload — leitura final na implementação.)

## Mudanças

### 1. `src/data/finalePresets.ts` (novo, único)
- `FinalePresetKind = 'mine' | 'comet' | 'shell'`
- `ShellPreset`: `count, speedMS, sigmaRad, starType ('XXSmall'|'XSmall'|'Normal'|'Small'|'Large'), mass, lifeMin, lifeMax, fadeABCD: [number,number,number,number], colorHex, pistil?: { count, speedMS, colorHex }, tails?: TailLayer[], geometry?: 'sphere'|'ring'|'palm-semi'|'crown-asym'`
- `TailLayer`: `densityHz, width, lifeS, lifeSigma, sizeFactor, colorHex, strobeHz?, emitStart, emitEnd, fadeABCD, crackle?`
- `FINALE_SHELL_PRESETS`: 7 entradas acima.

### 2. `RealisticFirework.tsx` / `ShellBurstRenderer.tsx`
- Aceitar `presetId?: string`. Quando setado, ler `FINALE_SHELL_PRESETS[presetId]` em vez de heurística atual.
- `geometry`:
  - `sphere` — padrão Peony/Dahlia/Chrysanthemum
  - `ring` — Wave (distribuição planar XZ + sigma vertical pequeno)
  - `palm-semi` — Palm (hemisfério superior + tronco vertical com tail longo)
  - `crown-asym` — Crown (hemisfério com queda gravitacional dominante, EmitEnd 0.9)
- Pistil renderizado como sub-burst central com `pistil.count/speed/colorHex`.
- Tails passados ao mesmo motor 4-layer descrito em rev3 (comet).

### 3. `cinemaFireShader.ts`
- Já recebe `[A,B,C,D]` envelope + strobe per-particle (rev2). Sem mudança extra.

### 4. `FireworkRenderer.tsx`
- Estender `resolvePresetId()` para mapear nomes VDL/Effect → shell preset:
  - "peony" → peony; "peony pistil" / "pistil" → peony-pistil
  - "wave" / "ring" → wave
  - "chrysanthemum" / "brocade" / "kamuro" → chrysanthemum
  - "dahlia" → dahlia
  - "palm" → palm
  - "crown" → crown
  - fallback: mantém heurística atual (efeitos não catalogados não regridem).

### 5. `index.ts`
- Re-exportar `FinalePresetKind`, `ShellPreset`, `MinePreset`, `CometPreset`, `FINALE_SHELL_PRESETS`, `FINALE_MINE_PRESETS`, `FINALE_COMET_PRESETS`.

## Não muda

- Safety / workMode / uiCommandGateway / CommandBus / FieldBus
- WebGPU 10/11 unified compute
- Hardware (FXK16/FireOne/DMX/etc.)
- Outros emitters (gerb/waterfall/bengal/laser/drone)
- VDL color pipeline (já LED-accurate)

## Verificação

- `__tests__/finalePresets.shell.spec.ts`: cada preset retorna `count/speed/sigma/fade/tails` exatos do FWE.
- Side-by-side visual em `/dev/effects-libraries`: 6 mines + 4 comets + 7 shells × screenshot FWsim Pro.
- Performance: render dos 7 shells em ≤200ms cada na janela 1067×672 (viewport atual).
- Zero regressão em 1263+ tests existentes.

Aprovar para implementar?
