# Ciclo #42 — Rendering Bugs: Depth, Frustum Cull, Dead Code, Crossette Leak

## Bugs Identificados

| # | Bug | Local | Impacto |
|---|-----|-------|---------|
| 1 | **Core flash `depthTest={false}`** — O flash branco de detonação (80ms) renderiza sobre toda geometria sólida. Halo e shockwave já foram corrigidos no Ciclo #40, mas o core flash ficou inconsistente | L1039 | Médio |
| 2 | **Frustum cull usa `partType` em vez de `effect.pattern`** — `patternStr = String(pt)` compara contra 'willow', 'kamuro' etc. que são valores de `pattern`, não `partType`. Resultado: trailing patterns nunca recebem o raio expandido (40x) e podem ser culled prematuramente | L1290-1291 | Alto |
| 3 | **`emberColor` computado mas nunca utilizado** — `useMemo` cria 2× `new THREE.Color` por burst sem jamais ler o resultado. GC waste desnecessário | L203-209 | Baixo |
| 4 | **`crossetteSplitRef` Set nunca limpo** — Se o React reusar a instância do componente (key swap), dados stale impedem novas sub-breaks de spawnar | L157 | Médio |
| 5 | **Array duplicado `effectPos` e `pos`** — L1288 e L1294 criam arrays idênticos; `effectPos` é usado apenas para frustum check e `pos` para rendering — basta um | L1288-1294 | Baixo |

## Implementação — `src/components/editor/skycanvas/FireworkRenderer.tsx`

**Fix 1 — Core flash depthTest (L1039):**
- Trocar `depthTest={false}` por `depthTest={true}`

**Fix 2 — Frustum cull pattern detection (L1290-1291):**
- Trocar `String(pt || '')` por `String(effect.pattern || '')`
- Agora trailing patterns (willow, kamuro, brocade, palm) recebem raio 40x corretamente

**Fix 3 — Remover `emberColor` dead code (L203-209):**
- Deletar o bloco `useMemo` inteiro que computa `emberColor`

**Fix 4 — Reset crossetteSplitRef quando pattern muda:**
- Adicionar `useEffect` que limpa `crossetteSplitRef.current.clear()` quando `pattern` ou `color` mudam

**Fix 5 — Eliminar array duplicado (L1288-1294):**
- Usar apenas `pos` para frustum check e rendering, remover `effectPos`

## Ordem de Execução

| Passo | Tarefa |
|-------|--------|
| 1 | Aplicar 5 fixes no FireworkRenderer.tsx |
| 2 | Build verification |
