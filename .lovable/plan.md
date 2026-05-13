# Plano rev5 — Quarter-Sphere shells + Single-Shot Mine/Comet/Cake presets

Estende `src/data/finalePresets.ts` (já criado na rev4 com 7 shells) com 9 novos presets extraídos dos FWE recém-enviados, incluindo a primeira família **Mine** e a primeira família **Cake** canônicas.

## Parâmetros canônicos extraídos (FWsim Pro)

### Shells novos (Distribution variants)

| ID | Source | Stars | Distribution | Speed | Sigma | Star/Mass | Life (s) | FadeABCD | Tails / cor |
|---|---|---|---|---|---|---|---|---|---|
| `quarter-4-4` | 34_4-4 | 60 | **QuarterSphere** (X-rot 2π) | 0.9 | 0 | XXSmall/0.7 | 1.2–1.6 | 0.064, 0.324, 0.781, 0.996 | Red, sem tail |
| `ghost-shell` | 34a_Ghost_Shell | TBD | Spherical (provável) | TBD | TBD | TBD | TBD | TBD | Gold Sparks D200 W2 Life0.1 + amber D100 W0.4 EmitEnd 0.8 |
| `hybrid-special` | 35_Hybrids_Special | TBD | Spherical | TBD | TBD | TBD | TBD | TBD | mesma base "Gold Sparks" do ghost + camadas extras (783 linhas, multi-layer) |

### Mines novos (Cake/single-shot, Mine node)

| ID | Source | Tail principal | Strobe | Cor | Notas |
|---|---|---|---|---|---|
| `single-mine-gold-glitter` | 40 | D5 W1 Life1.34 σ0.89 size0.5 | **29.4 Hz** | (254,224,184) warm gold | Glitter #3 |
| `single-comet-silver-glitter` | 41 | D17 W0.5 Life0.76 σ0.68 size0.6 | 7.92 Hz | White + secundário (72,…) | Mine node + comet head Silver #4 |
| `single-comet-mine-gold` | 42 | D9 W0.3 Life0.21 σ1.14 size0.3 | — | (149,74,0) deep gold | 1034 linhas — múltiplos layers Gold Sparks #3 |

### Cake-Shells (single-shot dentro de Cake node)

| ID | Source | Tail | Cor | Notas |
|---|---|---|---|---|
| `cake-shell-silver-titanium` | 43 | D250 W0.8 Life0.7 size0.5 fade(0,0,0.447,1) | Spark | 3577 linhas — Silver Titanium |
| `cake-mine-shell-gold` | 44 | D9 W0.3 Life0.21 size0.3 (=Gold Sparks #3) | (149,74,0) | mine→shell hybrid 1968 lin |
| `cake-hybrid-coal-gold` | 45 | D300 W0.3 Life0.6 σ0.7 size0.3 fade(0,0.5,0.501,1) | (55,28,0) coal gold | Coal Gold #2 |

(`TBD` = preencho na implementação via leitura completa dos FWE — janela truncada não cobre tudo).

## Mudanças

### 1. `src/data/finalePresets.ts`
- Estender enum `ShellGeometry` com `'quarter-sphere'`.
- Adicionar 3 entradas em `FINALE_SHELL_PRESETS` (`quarter-4-4`, `ghost-shell`, `hybrid-special`).
- Criar `MinePreset` interface + `FINALE_MINE_PRESETS` record com 3 entradas (`single-mine-gold-glitter`, `single-comet-silver-glitter`, `single-comet-mine-gold`). Reusa `TailLayer`.
- Criar `CakeShotPreset` interface + `FINALE_CAKE_SHOT_PRESETS` record com 3 entradas (`cake-shell-silver-titanium`, `cake-mine-shell-gold`, `cake-hybrid-coal-gold`). Cada cake-shot tem `wrappedKind: 'shell' | 'mine'` + sub-preset embutido.
- Estender `resolveShellPresetId()` para reconhecer "quarter", "ghost", "hybrid" / "ghost shell" / "hybrid special".
- Novos helpers: `resolveMinePresetId(raw)`, `resolveCakeShotPresetId(raw)`, `resolveMinePresetProps(id)`, `resolveCakeShotPresetProps(id)`.
- Novo helper único `listAllPresetIds(): { shells, mines, cakes }`.

### 2. Test guard
- Estender `src/data/__tests__/finalePresets.shell.spec.ts`:
  - Bloco "Quarter-sphere shells" valida `quarter-4-4` count 60, speed 0.9, sigma 0, FadeABCD exato.
  - Bloco "FINALE_MINE_PRESETS" valida glitter strobe 29.4 Hz, life 1.34, color (254,224,184).
  - Bloco "FINALE_CAKE_SHOT_PRESETS" valida wrappedKind + sub-preset.
  - Resolver: `resolveMinePresetId('Gold Glitter mine')` → `single-mine-gold-glitter` etc.

### 3. Renderer wiring (rev6 — não nesta rodada)
- `MineEffect.tsx` / `CakeEffect.tsx` ainda **não** consumirão `presetId`. Esta rev é só dados + guard. A integração visual fica para rev6 quando os renderers forem refatorados (igual ao que rev4 fez para shells: dados primeiro, render depois).

## Não muda

- Safety / workMode / uiCommandGateway / CommandBus / FieldBus
- WebGPU / GPGPU
- Hardware (FXK16 / FireOne / DMX / etc.)
- Renderers (`ShellBurstRenderer`, `MineEffect`, `CakeEffect`, `CometEffect`) — só consumirão na rev6
- Outros emitters (gerb / waterfall / bengal / laser / drone)

## Verificação

- `bunx vitest run src/data/__tests__/finalePresets.shell.spec.ts` — 100% passa (já passa hoje pelos 7 shells; +3 blocos novos).
- Type-check verde no build harness.
- `listAllPresetIds()` retorna 10 shells + 3 mines + 3 cakes.
- Zero alteração visual no preview (nenhum renderer foi tocado).

Aprovar para implementar?
