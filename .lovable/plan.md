
# Ciclo #42 — Rendering Bugs: Depth, Frustum Cull, Dead Code, Crossette Leak

## Bugs Identificados

| # | Bug | Local | Impacto |
|---|-----|-------|---------|
| 1 | **Core flash `depthTest={false}`** — Flash de detonação renderiza sobre toda geometria. Halo e shockwave corrigidos no #40, core flash ficou | L1039 | Médio |
| 2 | **Frustum cull usa `partType` em vez de `pattern`** — `patternStr = String(pt)` compara contra nomes de pattern ('willow' etc), mas `pt` é partType. Trailing patterns nunca recebem raio expandido 40x → culled prematuramente | L1290-1291 | Alto |
| 3 | **`emberColor` nunca usado** — 2× `new THREE.Color` por burst sem uso. GC waste | L203-209 | Baixo |
| 4 | **`crossetteSplitRef` Set nunca limpo** — Key swap pode reusar componente com Set stale, impedindo sub-breaks | L157 | Médio |
| 5 | **Array duplicado** — `effectPos` e `pos` criados separadamente com mesmos valores; `effectPos` descartável | L1288-1294 | Baixo |

## Implementação — `FireworkRenderer.tsx`

**Fix 1 (L1039):** `depthTest={false}` → `depthTest={true}` no core flash

**Fix 2 (L1288-1294):** Eliminar `effectPos`, usar `pos` para frustum check. Trocar `String(pt || '')` por `String(effect.pattern || '')`

**Fix 3 (L203-209):** Deletar bloco `emberColor` useMemo inteiro

**Fix 4 (L157):** Após `crossetteSplitRef`, adicionar `useEffect(() => { crossetteSplitRef.current.clear(); }, [pattern, color]);`

**Fix 5:** Já coberto pelo Fix 2 (eliminação de `effectPos`)

## Ordem de Execução

| Passo | Tarefa |
|-------|--------|
| 1 | Aplicar 4 fixes no FireworkRenderer.tsx |
| 2 | Build verification |
