

# Ciclo de Realismo #8 — Pistil, Crossette Sub-Breaks, Star Twinkle, Trajectory Sync

## Problemas Identificados

| # | Problema | Localização |
|---|---|---|
| 1 | **Pistil nunca renderizado no FireworkBurst** — `hasPistil` e `pistilColor` são recebidos como props (linha 128) mas NUNCA usados no JSX ou useFrame. O pistil só existe no `ShellBurstRenderer` (usado pelo `ShellExplosionManager`), mas o renderer principal `FireworkBurst` ignora completamente | `FireworkRenderer.tsx:128,137` |
| 2 | **Crossette sem sub-breaks no FireworkBurst** — `ShellBurstRenderer` tem crossette sub-burst logic (linhas 524-541), mas `FireworkBurst` renderiza crossette como simples 6 braços sem split. Estrelas deveriam fragmentar-se a ~40% da vida em mini-explosões | `FireworkRenderer.tsx:230-236` |
| 3 | **Star twinkle sem blink pattern** — todos os patterns usam `temporalFlicker` com curva suave. Fogos reais (especialmente strobe/twinkle effects) têm blink discreto: ON/OFF rápido com duty-cycle variável. Não há blink pattern implementado | `FireworkRenderer.tsx:349-357` |
| 4 | **Explosão não acompanha mudança de ângulo em tempo real** — `burstPos` é calculado uma vez no `TimelineEffects` usando `launchHeading`/`launchPitch`, mas quando o usuário muda a angulação da posição no editor, o burst já renderizado não atualiza sua posição. O `burstPos` depende de `_launchDir` que é recalculado a cada frame, mas o `FireworkBurst` recebe `position={burstPos}` como prop estático — React não re-renderiza se o array reference não mudar | `FireworkRenderer.tsx:726-751,787-803` |

## Soluções

### 1. Pistil interno no FireworkBurst
**Arquivo**: `FireworkRenderer.tsx`

Adicionar ao `FireworkBurst`:
- Gerar velocidades de pistil separadas (25% do `STAR_COUNT`, velocidade 40% do breakSpeed) no `useMemo` de velocidades
- No `useFrame`, calcular posições do pistil com drag reduzido (0.8x) e gravidade reduzida (0.7x)
- Renderizar como segundo `<points>` com cor do `pistilColor` e tamanho 0.7x
- Só ativar quando `hasPistil === true`

### 2. Crossette sub-breaks no FireworkBurst
**Arquivo**: `FireworkRenderer.tsx`

Adicionar lógica de fragmentação:
- Quando `pattern === 'crossette'` e `starAge > 0.4`, cada estrela dos 6 braços spawna 4-6 sub-partículas em direções aleatórias com velocidade 30% do breakSpeed
- Usar um `useRef<Set<number>>` para trackear quais estrelas já fragmentaram (evitar re-spawn)
- Sub-partículas renderizadas no mesmo `<points>` buffer, usando slots extras pré-alocados

### 3. Star twinkle com blink pattern
**Arquivo**: `FireworkRenderer.tsx`

Adicionar blink discreto para patterns que suportam:
- `twinklePhases[i]` já existe — usar como seed para blink timing
- Blink: `Math.sin(time * freq + phase) > threshold ? 1.0 : 0.05` onde threshold controla duty-cycle
- Patterns com blink: peony (sutil, 70% duty), crossette (forte, 50% duty), heart (sutil, 80%)
- Trailing patterns (willow, kamuro): sem blink (mantêm flicker suave atual)

### 4. Burst position reativa à mudança de ângulo
**Arquivo**: `FireworkRenderer.tsx`

O problema é que `burstPos` é calculado dentro do `useMemo` do `activeEffects` e passado como prop. Como `launchHeading`/`launchPitch` vêm do store e mudam, o `useMemo` já recalcula — mas o array `[x,y,z]` cria referência nova a cada frame quando os valores mudam. Verificar:
- Garantir que `positions` está nas dependências do `useMemo` (já está na linha 668)
- O `burstPos` é recalculado no render do `cappedEffects.map()` (linhas 726-751) que roda a cada render — isso já é reativo
- **Bug real**: `_posQuat`, `_effQuat` etc. são singletons compartilhados (sharedState). Se múltiplos efeitos renderizam no mesmo frame, eles sobrescrevem os quaternions um do outro. Solução: mover cálculo de quaternion para variáveis locais dentro do `.map()` callback

## Arquivos Modificados

| Arquivo | Ação |
|---|---|
| `src/components/editor/skycanvas/FireworkRenderer.tsx` | Pistil rendering, crossette sub-breaks, blink twinkle, fix quaternion race |

## Ordem de Execução

| Passo | Tarefa |
|---|---|
| 1 | Pistil interno — gerar, simular, renderizar |
| 2 | Crossette sub-breaks — fragmentação a 40% da vida |
| 3 | Star twinkle blink pattern por compound |
| 4 | Fix quaternion singletons → variáveis locais no map |
| 5 | Build verification |

