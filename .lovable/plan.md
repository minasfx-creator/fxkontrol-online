

# Ciclo #7 — Realismo Visual: Melhoria Incremental do Pipeline VFX

## Análise do Estado Atual

O sistema VFX é maduro e bem arquitetado:

| Componente | LOC | Estado | Nota |
|------------|-----|--------|------|
| ShellBurstRenderer | 932 | Produção | Shaders térmicos, glitter, crossette, fumaça |
| RealisticFirework | 454 | Produção | GPU-only, material singleton, object pool |
| PostExplosionSmokeManager | 309 | Produção | Pool pré-alocado, zero-GC |
| SmokeSystem (render_ultra) | 250 | Produção | Curl noise, soft particles |
| PrefireShell | 259 | Produção | Comet trail, muzzle flash |
| particleChemistry | 1312 | Produção | 30+ compostos reais calibrados |
| HDR Lighting | 193 | Produção | Burst light pool, inverse-square |
| Exposure | 87 | Produção | Adaptação assimétrica |

### Gaps Identificados (vs. referência real)

1. **Burst não-instantâneo ausente** — explosão expande imediatamente; fogos reais têm 50-120ms de expansão visível do núcleo
2. **Spark drag uniforme** — todas as partículas usam mesmo coeficiente; realidade: Ti sparks pesados vs charcoal leves
3. **Fumaça post-burst sem interação com luz** — smoke billboards não recebem iluminação dos burst lights
4. **Flicker mecânico** — `sin()` produz flicker periódico; fogos reais têm flicker estocástico
5. **Trail sem variação de espessura** — spark trails têm largura constante; realidade: mais grosso perto da fonte

## Plano de Execução (3 intervenções seguras)

### Intervenção 1 — Flicker Estocástico nos Shaders (Baixo Risco)

Substituir o flicker `sin()` periódico no `ShellBurstRenderer` e `RealisticFirework` por noise hash que produz pulsação irregular e não-repetitiva.

**Antes (ShellBurstRenderer, linha 118):**
```glsl
float flicker = 0.85 + 0.15 * sin(vLife * 47.0 + stretchedCoord.x * 13.0);
```

**Depois:**
```glsl
float flickerHash = fract(sin(dot(vec2(vLife * 31.7, vBrightness * 17.3), vec2(127.1, 311.7))) * 43758.5453);
float flicker = 0.80 + 0.20 * flickerHash;
```

Mesmo padrão para `RealisticFirework` (linha 134: `sin(vRandom * 6283.0 + uTime * 12.0)`).

**Impacto:** Partículas piscam de forma orgânica e imprevisível, eliminando padrão visual repetitivo.

### Intervenção 2 — Drag por Material (Baixo Risco)

Adicionar um atributo `aDragCoeff` per-particle nos shaders, alimentado pelos dados de `particleChemistry` (density/sparkSize). Partículas de Titânio (density 4.5) mantêm trajetória; Charcoal (density ~0.5) desacelera rápido.

**ShellBurstRenderer:**
- Novo attribute `aDragCoeff` no vertex shader
- Buffer `dragBuffer` pré-computado no `useEffect` com base no `formulationId`
- `stepParticle()` já aceita drag — apenas variar per-particle

**Cálculo:** `dragCoeff = baseDrag * (1.0 / (0.5 + density * 0.3))` — materiais densos têm menos drag.

### Intervenção 3 — Expansão de Burst em 2 Fases (Médio Risco)

Modificar o vertex shader do `ShellBurstRenderer` para que nos primeiros 80ms (lifeRatio < 0.03) as partículas expandam a velocidade crescente (detonação), e depois sigam a balística normal. Simula o "flash + shell break" real.

**No BURST_VERTEX:**
```glsl
// Detonation envelope: fast expansion in first 3% of life
float detonationPhase = smoothstep(0.0, 0.03, rawRatio);
float burstEnvelope = mix(0.2, 1.0, detonationPhase);
// Apply to velocity before position integration
vec3 scaledVel = aVelocity * burstEnvelope;
```

Isso faz o burst "crescer" visivelmente em vez de aparecer instantâneamente.

## Ficheiros Afetados

| Ação | Ficheiro |
|------|---------|
| Modificar | `src/components/editor/effects/ShellBurstRenderer.tsx` — flicker hash + drag attribute + burst envelope |
| Modificar | `src/components/editor/effects/RealisticFirework.tsx` — flicker hash |
| Preservar | Todos os outros ficheiros (zero mudanças) |

## Proteções

- Shaders são isolados — mudança não afeta lógica React
- Parâmetros mantêm valores default idênticos ao comportamento atual
- Object pools e material singletons intocados
- Core engines (fxkEngine, timelineEngine) intocados
- Build verificado com `tsc`

## Risco

**Baixo.** Intervenções 1-2 são aditivas (novo attribute + novo cálculo no shader). Intervenção 3 é multiplicativa mas o `smoothstep` garante que em t>3% o comportamento é idêntico ao atual.

## Resultado Esperado

- Flicker orgânico eliminando repetição visual mecânica
- Partículas pesadas (Ti, Fe) com trajetórias distintas de partículas leves (charcoal, fumaça)
- Burst com expansão progressiva visível (detonação → balística)
- Zero impacto em performance (mesmos draw calls, mesmos buffers)

## Próximo Passo (após validação)

Intervenção 4: Iluminação dinâmica na fumaça — fazer os smoke billboards receberem cor dos burst lights ativos, criando o efeito de fumaça colorida que é fundamental no realismo pirotécnico.

