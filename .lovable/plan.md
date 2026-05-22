## Causa-raiz

O renderer 3D (`FireworkRenderer.tsx` linha 1513) resolve cada `item.effectId` via `getEffectById` de `src/data/effectLibraryMap.ts`. Esse map indexa **apenas** `EFFECT_LIBRARY` (catálogo curado, ~150 efeitos). Tudo que veio do bundle Finale (Amazon 109, Winda 85, Magic 40, Lidu 112, Showven 181), do FWsim (~605) e do FWE Mine catalog **não está no map** → lookup retorna `undefined` → item é descartado (`if (!effect) return null`) → não renderiza.

A camada unificada já existe (`src/data/effectsLibraries/resolveEffect.ts → findEffectById`) e cobre as 5 fontes, mas o renderer não a consome. O bloco de derivação VDL (linhas 1532-1556) já está pronto para preencher `partType / caliber / heightMeters / pattern / shotCount / color / trail / pistil / firingPattern` a partir de `effect.vdl` — só precisa receber o Effect.

## Fix (1 arquivo + 1 spec)

### `src/data/effectLibraryMap.ts`
- Manter Map curado para o caminho rápido (zero regressão de perf no caso comum).
- Quando o lookup falha, delegar para `findEffectById` (resolveEffect.ts), que cobre EFFECT_LIBRARY ∪ FWsim ∪ FWE Mine ∪ Standard Effects ∪ Finale parts (incluindo Amazon).
- Import direto (não dinâmico) — bundle Finale já é estático.
- `invalidateEffectCache()` também chama `__resetResolveEffectCache()`.

```ts
// pseudo
import { findEffectById } from './effectsLibraries/resolveEffect';

export function getEffectById(id: string): Effect | undefined {
  const fast = rebuildIfNeeded().get(id);
  if (fast) return fast;
  return findEffectById(id);    // fallback p/ Amazon/Winda/Magic/Lidu/Showven/FWsim/Standard
}
```

### Comportamento resultante
1. Drag de "Amazon — AMZ1234 Red Peony 4″" para timeline.
2. Renderer chama `getEffectById('fl-amazon-AMZ1234')` → cai no fallback → acha Effect com `vdl: "4\" Red Peony"`.
3. Bloco existente (linha 1532) parseia o VDL → preenche `partType=shell, caliber=4, heightMeters≈85, color=#FF0033, pattern=peony`.
4. `MineEffect`/`ShellEffect`/etc. renderiza normalmente.

Sem mudar nenhum componente de render, sem tocar safety, sem tocar `EFFECT_LIBRARY`, sem mexer no merge dedup do `getMergedEffectsCatalog`.

### `src/__tests__/importedEffectsRender.spec.ts` (novo)
- Para cada manufacturer (Amazon, Winda, Magic, Lidu, Showven), pega 1 part qualquer do bundle, monta `item.effectId = finalePartToEffectId(p)`, garante:
  - `getEffectById(id)` retorna definido.
  - O Effect retornado tem `.vdl` não-vazio.
  - `parseVDL(effect.vdl).valid === true`.
  - `vdlToEffect(parsed).partType` está em `PART_TYPE_MAP`.
- Spec de Standard Effects e FWsim análogo.

## Fora de escopo
- Não mexer em mine angle (rodada anterior).
- Não tocar JOI / dev UI (continuações pendentes).
- Não alterar dedup do `getMergedEffectsCatalog` — ele continua respeitando precedência curated>fwsim>finale.

## Risco
Baixo. Mudança é **aditiva** (só preenche um buraco do fallback). Caminho rápido curado preservado, então shows existentes idênticos. Caso `findEffectById` também não ache, comportamento atual (null) preservado.
