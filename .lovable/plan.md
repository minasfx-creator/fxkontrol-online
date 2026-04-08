

# Ciclo #43 — ShellBurstRenderer GC Pressure + Smoke Consistency

## Bugs Identificados

| # | Bug | Local | Impacto |
|---|-----|-------|---------|
| 1 | **`new THREE.Color()` per-frame no smoke loop** — L708-709 cria `warmColor` e `coolColor` a cada frame dentro de `useFrame`. 60 alocações/s × 2 cores = GC spikes | `ShellBurstRenderer.tsx` L708-709 | Alto |
| 2 | **Objeto `tipCurlMods` criado per-particle per-frame** — L512-523 faz object spread (`{...stepMods, ...}`) para cada partícula a cada frame. Com 2000 partículas × 60fps = 120.000 objetos/s | `ShellBurstRenderer.tsx` L512-523 | Alto |
| 3 | **`crossetteTriggered` nunca limpo** — Ref Set não reseta quando pattern/color muda, impedindo sub-breaks se componente for reusado (mesmo bug corrigido no FireworkRenderer no ciclo #42) | `ShellBurstRenderer.tsx` L488 | Médio |
| 4 | **Smoke billboards sem `depthTest`** — Fumaça volumétrica renderiza sobre geometria sólida. Inconsistente com as correções de oclusão aplicadas no FireworkRenderer | `ShellBurstRenderer.tsx` L895-909 | Médio |
| 5 | **`glitter.splice(i,1)` inside reverse loop** — L611 usa `splice` em loop reverso, correto em ordem mas O(n²) com 800 partículas. Deveria usar swap-and-pop | `ShellBurstRenderer.tsx` L611 | Baixo |

## Implementação — `ShellBurstRenderer.tsx`

**Fix 1 — Hoist smoke colors (L708-709):**
- Mover `warmColor` e `coolColor` para singletons module-level:
```ts
const _warmSmokeColor = new THREE.Color(0.47, 0.40, 0.33);
const _coolSmokeColor = new THREE.Color(0.40, 0.47, 0.53);
```
- L710: trocar `new THREE.Color(...)` por referência ao singleton

**Fix 2 — Pre-allocate tipCurlMods (L512-523):**
- Criar um objeto singleton module-level `_stepModsCache: StepModifiers = {}`
- Dentro do loop, mutar campos em vez de criar novo objeto a cada iteração
- Elimina 120k alocações/s

**Fix 3 — Crossette cleanup (L488):**
- Adicionar `useEffect(() => { crossetteTriggered.current.clear(); crossetteRef.current = []; }, [pattern, color]);`

**Fix 4 — Smoke depthTest (L895-909):**
- Adicionar `depthTest` no shaderMaterial das smoke billboards

**Fix 5 — Swap-and-pop glitter cleanup (L604-611):**
- Substituir `gp.splice(i, 1)` por swap com último elemento + pop

## Ordem de Execução

| Passo | Tarefa |
|-------|--------|
| 1 | Aplicar 5 fixes no ShellBurstRenderer.tsx |
| 2 | Build verification |

