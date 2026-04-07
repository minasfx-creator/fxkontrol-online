

# Ciclo de Calibracao #18 — Ground Bounce Sparks, Ember Glow Trail, Smoke Pos-Burst, Angle Trajectory Verification

## Problemas Identificados

| # | Problema |
|---|----------|
| 1 | **MineEffect sem ground bounce sparks** — quando particulas atingem Y=0, simplesmente usam `abs(rawY) * restitution` sem gerar sparks secundarias no impacto |
| 2 | **Ember glow trail ausente** — particulas que caem (drip class + spray tardio) nao deixam trilha de brasa incandescente; apenas desaparecem |
| 3 | **Smoke pos-burst insuficiente** — FireworkBurst so mostra `SmokeTrail` apos 60% do progress; falta nuvem volumetrica expandindo no ponto de burst que persista alem do efeito |
| 4 | **Verificacao de angulos** — confirmar que `burstPos` no FireworkRenderer calcula corretamente a posicao final do burst usando o quaternion de heading/pitch, e que shells explodem no final da trajetoria angulada |

## Solucao

### 1. MineEffect — Ground Bounce Sparks
- Detectar quando `rawY < 0` (particula atinge o chao)
- No momento do bounce, spawnar 3-5 micro-sparks no buffer de trail existente
- Sparks: velocidade lateral baixa (1-3 m/s), cor amber/orange, lifetime 0.2-0.4s
- Reutilizar o buffer de trail (ultimos 15% dos trail segments) para bounce sparks sem alocacao extra

### 2. FireworkBurst — Ember Glow Trail
- Adicionar buffer `LineSegments` para stars na fase tardia (>60% life)
- Cada star que esta na fase ember (emberPhase > 0.3) gera 2-3 trail segments
- Trail color: thermal ramp de amber quente → cinza escuro
- Trail desaparece com `opacity *= (1 - emberPhase)`

### 3. FireworkBurst — Smoke Volumetrico Pos-Burst
- Substituir a `SmokeTrail` simples por uma nuvem de 20-30 particulas de fumaca
- Nuvem expande radialmente a partir do centro do burst
- Comeca em 40% progress (nao 60%), persiste ate 100%
- Cor: cinza quente absorvendo cor da explosao (30% tint)
- Buoyancy leve (+0.5 m/s vertical), drag alto

### 4. Angle Trajectory Verification
- Revisar calculo de `burstPos` em FireworkRenderer (linhas 1099-1125)
- Confirmar que `launchDir` e calculado corretamente: heading rotaciona em Y, pitch aplica inclinacao no eixo X local
- Verificar que `burstPos = pos + launchDir * realBreakHeight` posiciona a explosao no final da trajetoria
- Corrigir se houver inversao de sinal ou ordem de multiplicacao de quaternions

## Arquivos Modificados

| Arquivo | Acao |
|---------|------|
| `src/components/editor/effects/MineEffect.tsx` | Ground bounce sparks no impacto |
| `src/components/editor/skycanvas/FireworkRenderer.tsx` | Ember glow trail + smoke volumetrico pos-burst + verificar angulos |

## Ordem de Execucao

| Passo | Tarefa |
|-------|--------|
| 1 | FireworkRenderer.tsx — verificar/corrigir calculo de angulos no burstPos |
| 2 | FireworkRenderer.tsx — ember glow trail segments na fase tardia |
| 3 | FireworkRenderer.tsx — smoke volumetrico pos-burst |
| 4 | MineEffect.tsx — ground bounce sparks |
| 5 | Build verification |

