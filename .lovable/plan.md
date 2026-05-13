## Refinamento de Realismo — calibrado por Great Grizzly + Weingart + FWsim "F1" (vídeos enviados)

Os dois vídeos são do **FWsim "Hans Zimmer F1"** — definem o look-alvo: bursts pequenos com **estrelas discretas brilhantes** (não blobs), **gerbs/fountains de palco** muito densos e dourados, **mines em leque cônico** subindo do palco, **cascade/Niagara de longa persistência** dourado caindo paralelo, e **comet rises** dourados visíveis indo do solo até o ponto de quebra. Bloom controlado, não estourado.

Escopo: render/simulação dos efeitos pirotécnicos. Sem mexer em safety, ShowPlan, WebGPU layers 10/11, hardware ou backend.

---

### Lacunas detectadas no plano anterior (após análise dos vídeos)

| Gap | Evidência no vídeo | Ação adicionada |
|---|---|---|
| **Bloom muito alto faz tudo virar blob** | FWsim mostra estrelas como pontos discretos brilhantes | Reduzir HDR peak global de 7.5 → **5.5** e star size base −20% |
| **Falta perfil "stage gerb"** denso dourado de borda de palco | Linhas de gerbs no proscênio (v1_3, v2_3) | `GerbEffect` ganha preset `stage` (ângulo cone 4°, density ×1.5, golden #ffb060) |
| **Mines V-cone (leque) ausentes** após omnidirectional | Pares de mines abrindo leque ~35° (v1_3, v2_3) | `MineEffect` ganha `pattern: 'omni' \| 'fan' \| 'v'`; default `fan` 30°±10° upward |
| **Niagara/cascade waterfall fraca** (curta, sem paralelismo) | v2_8: chuva dourada longa, paralela, ~3-4s persistência | `WaterfallEffect`: lifetime ×2.2, gravity 1.4×, sparks paralelos com jitter horizontal <0.05, golden #ffa840 |
| **Comet rise pouco visível** | Trilhos dourados verticais do solo ao burst (v1_3) | `CometEffect` rising trail density +60%, brilho do head ×1.4 |
| **Ground strobes azuis** sincronizados ausentes | Pontos azuis intermitentes na base do palco (v2_3, v2_12) | `BengalEffect` ganha modo `strobe` (flicker 8Hz, cor azul #4080ff configurável) |
| **Star size variation** fraca → look "CG" uniforme | Refs mostram tamanhos visivelmente diferentes | Já contemplado (variância ±15%); reforçar para ±25% nos color stars |

---

### Plano consolidado (substitui o anterior)

#### 1. `src/render_ultra/fireworks/burstSimulation.ts` — calibração de padrões

Tabela `BURST_CONFIGS`:

| Padrão | tailFactor | velocity | gravityMult | starCount | Notas |
|---|---|---|---|---|---|
| peony | 0.3→**0.05** | 26 | 1.0 | 280 | Esfera limpa sem rastro (Grizzly) |
| chrysanthemum | 1.4→**1.6** | 30 | 1.0 | 200 | Ponta com curl progressivo (já existe) |
| willow | 2.0→**2.8** | 22→**18** | 1.8→**2.2** | 180 | Charcoal pesado, life ×1.6 |
| brocade | 1.8→**2.2** | 25→**23** | 1.3 | 250 | Default cor gold |
| kamuro | 2.0→**2.6** | 18 | 1.5 | 300 | Life ×1.4, gold persistente até solo |
| palm | 1.2 | 24 | 1.6 | 60 | Adicionar **rising comet trunk** 0.4s pré-burst |
| crossette | 0.6 | 32 | 1.0 | 36→**40** | Sub-burst em 4 ramos **ortogonais reais** (não jitter) |
| crackle/dragon_egg | 0.3 | 15 | 1.8 | 40 | `crackleSparkRate` +60%, micro-flashes 0.08–0.15s |
| glitter | 0.4→**0.8** | 26 | 1.0 | 200 | Intermitência 8–14Hz |
| horsetail | 2.5 | 16→**14** | 2.0→**2.4** | 160 | Cascata pesada |
| dahlia | 0.2 | 42 | 1.1 | 60 | OK, manter |

Adicionar **drag aerodinâmico fraco** no integrador de partículas: `v *= 1 - 0.018*dt*speed/30`. Quebra a esfera perfeita CGI.

Adicionar **variância ±25%** em `starSize` e `starBrightness` por partícula (Weingart §III).

#### 2. `src/render_ultra/fireworks/cinemaFireShader.ts` — bloom controlado + cooling

- HDR multiplier 7.5 → **5.5** (impede que estrelas virem blobs estourados)
- Color shift no fade últimos 25% de vida: `mix(starColor, vec3(1.0,0.45,0.1), smoothstep(0.75,1.0,lifeRatio))` — simula cooling blackbody

#### 3. `src/components/editor/effects/RealisticFirework.tsx` + `ShellBurstRenderer.tsx`

- **Cor padrão por padrão** quando usuário não definir: brocade/kamuro/willow → gold (#ffb84d); peony/chrys → cor do shell explícita
- **Charcoal stars** (willow/brocade/kamuro): HDR peak local **3.5** (não 5.5), tail life ×1.6, "drip" particles a cada 80–120ms
- **Pistil interno** auto em chrys/brocade_crown ≥100mm: dispara em **t=0** (não 250ms; Weingart: simultâneo)
- **Star size base −20%** + variância ±25%

#### 4. `src/components/editor/effects/GerbEffect.tsx` — preset "stage"

Novo prop `preset?: 'standard' | 'stage' | 'cold'`:
- `stage`: coneAngle 4°, density ×1.5, color #ffb060 (gold), lifetime ×1.3, top-cap brightness +30%

#### 5. `src/components/editor/effects/MineEffect.tsx` — patterns

Novo prop `pattern?: 'omni' | 'fan' | 'v'` (default: **`fan`**):
- `omni`: comportamento atual (hemisférico)
- `fan`: cone vertical 30°±10°, stars discretos brilhantes (FWsim look)
- `v`: dois leques ortogonais 25°

#### 6. `src/components/editor/effects/WaterfallEffect.tsx` — niagara/cascade

- Lifetime ×2.2 (~3.5s)
- Gravity 1.4× (queda visivelmente acelerada)
- Jitter horizontal <0.05 (paralelo, não esparramado)
- Color default #ffa840
- Spark size −15%, density ×1.4

#### 7. `src/components/editor/effects/CometEffect.tsx` — rising trail

- Trail density +60% no `rising` phase
- Head brightness ×1.4
- Trail color gold default; persist 0.6s após head desaparecer

#### 8. `src/components/editor/effects/BengalEffect.tsx` — modo strobe

Novo prop `mode?: 'steady' | 'strobe'` + `flickerHz?: number`:
- `strobe`: on/off square-wave 8Hz default, cor configurável (default #4080ff azul gelado)

#### 9. `src/components/editor/effects/EmberParticles.tsx` — densidade por padrão

- peony: density ×0.3 (limpa)
- willow/kamuro/brocade: density ×1.6, length ×1.6, drip particles
- crackle/dragon_egg: micro-burst sparkle ×3 brilho no fim de vida

---

### Arquivos afetados

- `src/render_ultra/fireworks/burstSimulation.ts` — tabela + drag + variância
- `src/render_ultra/fireworks/cinemaFireShader.ts` — HDR 5.5 + color shift fade
- `src/components/editor/effects/RealisticFirework.tsx`
- `src/components/editor/effects/ShellBurstRenderer.tsx`
- `src/components/editor/effects/GerbEffect.tsx` (preset `stage`)
- `src/components/editor/effects/MineEffect.tsx` (patterns omni/fan/v)
- `src/components/editor/effects/WaterfallEffect.tsx`
- `src/components/editor/effects/CometEffect.tsx`
- `src/components/editor/effects/BengalEffect.tsx` (modo strobe)
- `src/components/editor/effects/EmberParticles.tsx`

### Não muda

Safety/SSM/CommandBus/uiCommandGateway · ShowPlan/VVIZ/VDL · WebGPU layers 10/11 · MineEffect-omnidirectional fix anterior · marcadores 3D já removidos · hardware adapters · edge functions · Lovable Cloud schema.

### Validação

- Build limpa
- `/editor`: comparar peony, chrys, willow, brocade, palm, crossette, crackle, comet, glitter, mine `fan`, gerb `stage`, waterfall lado-a-lado com frames FWsim
- Sem regressão de FPS (drag e variância são O(N) no mesmo loop; novos presets são só configs)
- Confirmar que estrelas viram pontos discretos brilhantes (não blobs) — critério visual de "passou"
