## Otimizações usando os arquivos enviados

Avaliação rápida de cada arquivo e onde ele agrega valor no FXKONTROL.

### 1. `graphics.xml` — Tuning canônico do FWsim (ALTÍSSIMO valor)

É o **manual de calibração do render do FWsim**: 599 linhas de parâmetros que casam exatamente com nossos sistemas (sparks, tails, bloom, motion blur, flickering, distance scaling, launch flames, whistle/farfalle/tourbillon).

**Ação**: parsear como JSON canônico e plugar nos renderers existentes atrás de flags (default ON), preservando comportamento atual via fallback.

Mapeamento direto (sem inventar nada):

| graphics.xml | FXKONTROL alvo | Ganho |
|---|---|---|
| `PresetColors_` (29 cores) | `vdlColorPipeline` palette extension | Mais cobertura RGB→VDL (hoje 25, +4: DeepPurple, LightGreen, LightPink, LightRed, LightYellow, Lilac, SeaGreen, SkyBlue, IceBlue) |
| `TonemappingConfig` (Contrast 1.7, HdrMax 16) | `Studio Layer 4-5` (ACES) | Match FWsim color response |
| `MotionBlur` (1/35s, exposure 0.8) | `EffectComposer` post | Streak realista nas comets/sparks |
| `MainStarsShape` + per-type (XLarge..XXSmall, Sparks, FallingLeaves) | `InstancedParticleRenderer` + `SmokeSystem` | Brilho/falloff por TypeEnum (já temos Type no ECS) |
| `FlashesConfiguration` (ShellLaunchFlame, MineFlame, ShellExplosion) com `SizeDependingOnEnergy` curves | `MineEffect`, `LaunchSparksConfig` | Flash de boca/explosão escalonado por energia (curvas exatas FWsim) |
| `StrobeConfig`, `RandomFlickering*` | `SilhouetteRenderer` strobe + flicker | Per-type flicker amplitude (XLarge=0.12 … XXSmall=0.02) |
| `DefaultStarBrightnessCurve` (fade-in 9%, fade-out 15%) | curva canônica `peony/dahlia` | Fade orgânico |
| `BrightnessNormalization_ForMainStars=0.3` | renderer color compensation | Branco não estoura |
| `MainStarsSizeFactor=0.55`, `MicrostarsSizeFactor=0.7`, `SparksSizeFactor=0.35` | ECS particle size globals | Calibração canônica |
| `MainStarsBrightness=25`, `SparksBrightness=10.75`, `CracklingBrightnessModifier=0.25` | HDR multiplier | Numbers exatos FWsim |
| `ExplosionSparksConfig` (100 sparks, 1.5s burn, GoldDense<76mm) | `ShellEffect` | Sparks canônicos por calibre |
| `LaunchSparksConfig` (curvas shell_NrStars/expStrength/relativeSpeed por calibre + Comet/Mine) | `MineEffect`/`CometEffect`/`launchFlash` | Mine width e contagem por shell size |
| `Bloom` (AmountOfBloom 0.1, Upsampling Weights 9 levels, NrLevels 10) | EffectComposer Bloom | Pesos por nível (1.3,0.9,0.4,…,1.6) |
| `TailDynamics` (TailParticleCountOverTime, TailParticleWidthOverTime) | tail renderer | Fade-on/off canônico |
| `MainStars_Distance_Scaling` (ref 120m, scaling 0.5) | renderer LOD | Tamanho consistente com distância |
| `Whistle`/`Farfalle`/`Tourbillon` (Density, RotSpeed, NrNozzles, RandomVelocity) | renderers correspondentes | Parâmetros físicos exatos |
| `LightOnEnvironmentFactor=50` | `GlobalIllumination` | Iluminação do entorno |
| `Water` (WaveSpeed 0.01, Height 0.04, Scaling 5) | SkyCanvas water (se houver) | Lago/rio realista |

### 2. `smoke_with_alpha.png` — Sprite de fumaça com alpha (ALTO valor)

Plugar no `SmokeSystem` como textura canônica (substitui procedural noise atual). Copiar para `src/assets/textures/fwsim/smoke_with_alpha.png`.

### 3. `2021-04_Old_Effects_Index-3.txt` — Index expandido (MÉDIO valor)

Já temos `fwsimOldEffectsIndex` (229 names) como pista de busca (`marketing_hypothesis`). A versão enviada parece idêntica — confirmar diff e merge se houver novidade.

### 4. `fwsim_style_config.xml` — Skin UI do FWsim (BAIXO valor)

Tem accent laranja (#F06700) e cinzas — **conflita com paleta canônica Vantablack/cyan-dessat** já consolidada e com a constraint registrada. Não vamos adotar como chrome do app. Pode ser usado **apenas** dentro do viewport 3D para tinta de overlays decorativos (opcional).

### 5. `Master.bank` + `Master.strings-2.bank` — FMOD audio banks (NÃO usável em browser)

Formato proprietário **FMOD Studio**. Browser não tem FMOD runtime; usar exige fmodstudio-wasm (~2 MB, licença comercial). Recomendação: **não plugar**. Se quiser SFX (whoosh launch, boom, crackle), gerar/curar WAV/OGG livres e usar Web Audio. Posso propor essa rota em rodada separada.

### 6. `dimensions.png` — Imagem em branco (sem dado)

A view retornou pixels brancos. Parece placeholder/erro de exportação. **Skip**.

---

## Plano de implementação (1 rodada, feature-flagged)

**Arquivos a criar**
1. `public/fwsim/graphics.xml` — cópia raw (auditoria)
2. `scripts/parse-fwsim-graphics.mjs` — parser XML → JSON canônico
3. `src/data/fwsimGraphicsConfig.ts` — typed config + `getFwsimGraphics()` memo
4. `src/data/fwsimGraphicsConfig.json` — gerado pelo script
5. `src/assets/textures/fwsim/smoke_with_alpha.png` — copy
6. `src/__tests__/fwsimGraphicsConfigParse.spec.ts` — pin do parser
7. `docs/reference/fwsim-graphics-tuning.md` — mapeamento canônico

**Arquivos a editar (pequeno, atrás de flags)**
- `vdlColorPipeline.ts` — adicionar 9 PresetColors faltantes (flag `vdl_fwsim_extended_palette`, default ON)
- `SmokeSystem.ts` — opcional usar `smoke_with_alpha.png` (flag `r_fwsim_smoke_texture`)
- `MineEffect.tsx` — consumir `MineFlame` + `Mine_*` curves (flag `r_fwsim_mine_calibration`)
- `LaunchFlash.tsx` (se existir) — `ShellLaunchFlame.SizeDependingOnEnergy` (flag `r_fwsim_launch_flash_v2`)
- EffectComposer Bloom — `AmountOfBloom=0.1` + `Upsampling_Weights` (flag `r_fwsim_bloom_weights`)
- Tonemapping — `Contrast 1.7`, `HdrMax 16` (flag `r_fwsim_tonemapping`)

**Zero impacto**: safety, workMode, CommandBus, FieldBus, store de projeto. Apenas data + render.

**Defaults**: TODAS as flags ON. Fallback exato ao comportamento atual quando OFF.

**Testes**: 1 parser spec + 1 spec validando que `getFwsimGraphics()` é memo estável + cada flag novo tem default registrado.

**Memória**: salvar como `funcionalidades/fwsim-graphics-canonical-tuning` após implementação.

**FMOD .bank**: anotar em `docs/reference/audio-roadmap.md` como "decisão pendente — exige fmodstudio-wasm ou substituição por SFX livres". Não plugar nesta rodada.

---

## Pergunta única antes de seguir

Quer que eu execute **toda a rodada de uma vez** (parser + palette + smoke + mine + launch flash + bloom + tonemapping), ou prefere **fatiar por sistema** (ex.: só palette + smoke primeiro, depois mine, depois bloom)? Recomendo tudo de uma vez já que cada peça está atrás de flag e o risco de regressão é baixo.