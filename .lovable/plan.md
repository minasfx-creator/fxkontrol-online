# Refino de Realismo dos Fogos — 7 Gaps Concretos

## Por que parecem "irreais" hoje

O renderer real (`src/components/editor/skycanvas/FireworkRenderer.tsx`, 1716 linhas) usa `THREE.Points` com um shader Gaussiano radial. As geometrias estão certas (ring, heart, smiley, saturn, etc.), mas faltam os **7 elementos** que separam "estrela genérica que sobe e cai" de pirotecnia real:

| # | Gap visual | Causa técnica | Existe no repo mas não wired? |
|---|---|---|---|
| 1 | Estrelas são bolhas redondas iguais | Gaussian sprite isotrópico, sem stretch | parcial |
| 2 | Sem rastro de faíscas (sparks) atrás de cada estrela | `sparkTrailsGPU.ts` existe, não chamado | ✅ existe |
| 3 | Cor "chapada" do início ao fim | Sem ramp blackbody temporal | ✅ `particleChemistry.thermalColor` |
| 4 | "Break flash" inexistente ou fraco | Frame 0..2 do burst não tem HDR boost | parcial |
| 5 | Sem fumaça residual no ponto de ruptura | `SmokeSystem` existe, só usado p/ ground smoke | ✅ `smokeSimulation.ts` |
| 6 | Willow/Kamuro sem trilha contínua | Falta ribbon/MeshLine por estrela | ✅ `ribbonTrailRenderer.ts` |
| 7 | Shapes (heart, smiley, ring) com densidade aleatória | Stars amostradas com `Math.random()` em vez de espaçamento uniforme | — |

Todo o resto (silhuetas de mine, niagaraProfile glow, chemistry compounds, frustum culling, HDR boost combustion) já está rodando.

## Plano em 3 passes (cada um isolável por flag, validável visualmente)

### Pass 1 — Velocity Stretch + Break Flash (alto impacto, baixo custo)

**Arquivo único editado:** `FireworkRenderer.tsx` (shader + setup do material)

1. **Velocity stretch** no `STAR_VERTEX_SHADER`:
   - Adicionar attribute `aVel` (vec3) já calculado nas velocidades existentes
   - Ovalizar o sprite na direção da velocidade projetada em screen-space: `gl_PointSize` continua igual, mas no fragment shader o `gl_PointCoord` é rotacionado pelo ângulo `atan2(velScreen.y, velScreen.x)` e escalado em Y por `(1 + speedFactor * 0.8)`. Resultado: estrelas "riscam" o céu em vez de serem pontos circulares.
   - Custo: zero (cálculo já é por-vértice)

2. **Break Flash HDR**:
   - Nova var `aBirthTime` (float). Nos primeiros `0.08s` após break: multiplicador `flash = exp(-age*40) * 8.0` adicionado ao `col` (HDR > 1.0 alimenta o bloom automaticamente)
   - Pico ~3 frames @60fps, depois decai pra zero — exatamente como o flash químico real do composto BP no rompimento
   - Custo: 1 atributo + 2 linhas no fragment

3. **Cor temporal blackbody**:
   - Importar `thermalColor` de `particleChemistry.ts` (já existe!)
   - No JS, pré-computar 32 amostras da curva `whiteHot(3500K) → starColor → ember(1200K)` em uma `DataTexture` 32×1 RGBA
   - Sampler no fragment: `vec3 baseCol = texture(uTempRamp, vec2(vLife, 0.5)).rgb`
   - Custo: 1 texture sampler + DataTexture de 128 bytes

**Flag:** `r_star_stretch_v2` (default ON após validação visual em `/dev/effect-preview`)
**Tests:** 3 — atributos populados, ramp gerada determinística, fallback para shader v1 quando flag OFF

### Pass 2 — Spark Trails (o "wow" visual mais importante)

Wire de `sparkTrailsGPU.ts` no `FireworkRenderer`:

1. Para cada `FireworkBurst` ativo, instanciar 1 `SparkTrailSystem` com `STAR_COUNT / 3` rastros (sub-amostragem — 1 em cada 3 estrelas tem trail, suficiente visualmente, terço do custo)
2. Cada frame: passar posição/velocidade atuais do `Points` → o `sparkTrailsGPU` mantém ring buffer de 8 posições passadas por trail e renderiza como `BufferGeometry LineSegments` com material aditivo
3. Cor do trail: `starColor * 0.6 * (1 - trailAge/0.4)` — esmaece em 400ms
4. **Willow/Kamuro/Palm** pegam 100% de cobertura (efeito definidor); demais 33%

**Flag:** `r_spark_trails` (default ON em desktop, OFF em mobile via `useDeviceTier`)
**Budget guard:** auto-OFF se `useFrameBudget` p95 ≥ 35ms
**Tests:** 4 — system criado por burst, dispose no unmount, sub-amostragem correta, mobile-OFF

### Pass 3 — Break Puff + Shape Pearl Spacing

1. **Break Puff de fumaça** — no instante do break, emitir 1 `SmokeSystem` puff (3-5 partículas, raio 0.8m, lifetime 8s, opacidade peak 0.4) no ponto de ruptura. Reaproveita `smokeSimulation.ts` que já está disposable-safe. Apenas para shells > 3" e sem chuva.

2. **Pearl Spacing** nas geometrias de shape (heart, smiley, ring, saturn): trocar `Math.random()` por `i / STAR_COUNT` no parâmetro `t` da curva — distribui estrelas uniformemente ao longo da silhueta (como "colar de pérolas"). Mantém jitter pequeno (`±0.02 * sigma`) pra não ficar mecânico. Já testei mentalmente nas funções existentes em `buildPresetVelocities` — é uma troca de 1 linha por shape (heart/smiley/ring/double-ring/saturn-ring).

**Flag:** `r_break_puff` (ON desktop) + `r_pearl_spacing` (ON sempre, é trivialmente melhor)
**Tests:** 3 — puff só dispara em shell ≥ 3", pearl spacing determinístico, no-rain gate

## Fora de escopo (deliberado)

- **Não** vou reescrever `FireworkRenderer.tsx` — só editar shader + adicionar 1 ref pra sparkTrails + 1 ref pra puff
- **Não** vou wire o Niagara emitter system inteiro — overkill, e o velocity stretch + spark trails já entregam 80% do realismo percebido
- **Não** mexo em VDL pipeline, ECS, safety, workMode, ou qualquer coisa fora do shader/render de fogos
- **Não** adiciono dependência nova

## Resumo numérico

| Pass | Arquivos editados | Arquivos novos | Tests | Custo GPU est. |
|---|---|---|---|---|
| 1 | 1 (FireworkRenderer.tsx) | 0 | 3 | +0.3ms p/ 2k stars |
| 2 | 1 (FireworkRenderer.tsx) | 0 | 4 | +1.2ms p/ 2k stars (auto-cap) |
| 3 | 1 (FireworkRenderer.tsx) | 0 | 3 | +0.4ms p/ break |
| **Total** | **1 arquivo** | **0** | **10** | **~2ms (budget 16.6ms@60fps)** |

Posso aplicar Pass 1 primeiro pra você validar visualmente em `/dev/effect-preview` antes de seguir pros 2 e 3 — assim cada delta é reversível e você vê o ganho incremental.