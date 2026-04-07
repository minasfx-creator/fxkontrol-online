

# Ciclo de Engenharia #26 — Niagara sizeOverLife Fix, GC Optimization, Deterministic Random, VDL Rack Type

## Bugs a Corrigir

| # | Tipo | Problema | Local |
|---|------|----------|-------|
| 1 | **BUG CRÍTICO** | `p.size *= sampleCurve(...)` (L425) multiplica size pela curva a cada frame, causando decaimento exponencial. Após 60 frames com valor 0.6, size → `0.6^60 ≈ 0`. Deveria usar `initialSize * curveValue` | `niagaraEmitterSystem.ts` L425 |
| 2 | **GC PRESSURE** | `sampleColorGradient` cria `new THREE.Color()` a cada chamada (L181-190). Com 2000 partículas = ~120K allocations/s | `niagaraEmitterSystem.ts` L180-191 |
| 3 | **NON-DETERMINISTIC** | `randRange` e `randVec3` usam `Math.random()` ao invés do `simRNG` do projeto | `niagaraEmitterSystem.ts` L155-165 |
| 4 | **MISSING** | VDL_TYPES não inclui `rack` e `not_an_effect` — tipos presentes no manual Finale 3D Table 2 | `vdlParser.ts` L164-203 |

## Plano de Implementação

### Arquivo 1: `src/render_ultra/fireworks/niagaraEmitterSystem.ts`

**Fix 1: Adicionar `initialSize` ao NiagaraParticle + corrigir sizeOverLife**
- Adicionar campo `initialSize: number` à interface `NiagaraParticle` (L85-98)
- Em `spawnParticles` (L382): setar `initialSize: randRange(init.size[0], init.size[1])` e `size` igual ao mesmo valor
- Em `updateParticles` (L425): trocar `p.size *= sampleCurve(...)` por `p.size = p.initialSize * sampleCurve(...)`

**Fix 2: GC optimization em sampleColorGradient**
- Criar `const _tempColor = new THREE.Color()` estático no módulo (antes da função)
- Reescrever `sampleColorGradient` para reutilizar `_tempColor` com `.copy().lerp()` — o caller em L422 já faz `p.color.copy()`, então retornar `_tempColor` diretamente é seguro
- Remover `.clone()` das early returns (L182-183) — usar `_tempColor.copy()`

**Fix 3: Deterministic random**
- Importar `simRNG` de `@/core/reliability/seededRandom`
- Substituir `Math.random()` em `randRange` (L156) por `simRNG.next()`

**Fix 4: VDL rack/not_an_effect**
- Adicionar ao `VDL_TYPES` (após L203):
  - `rack`: partType `'rack'`, baseSpread 0, baseDuration 0, baseStars 0, baseBreakSpeed 0
  - `not_an_effect`: partType `'marker'`, baseSpread 0, baseDuration 0, baseStars 0, baseBreakSpeed 0

## Ordem de Execução

| Passo | Tarefa |
|-------|--------|
| 1 | Add `initialSize` + fix sizeOverLife |
| 2 | GC optimize sampleColorGradient |
| 3 | Replace Math.random with simRNG |
| 4 | Add rack/not_an_effect to VDL_TYPES |
| 5 | Build verification |

