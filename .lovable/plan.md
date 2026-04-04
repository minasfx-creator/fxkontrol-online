

# Ciclo de Refatoração — Fase 4A: Extração Segura do EFFECT_LIBRARY + Feature Flags

## Análise do Estado Atual

Fases completas: 1 (Dedup), 2 (Facade Hooks), 3 (DMX Hierarchy), 5 (Edge Shared Utils).

Situação do `useProjectStore.ts` (908 LOC):
- **~140 LOC** são dados estáticos (`EFFECT_LIBRARY`) — constante pura, sem relação com estado reativo
- **42 arquivos** importam `EFFECT_LIBRARY` diretamente do store
- **169 arquivos** importam algo de `useProjectStore`
- O store contém tipos, constantes, estado e lógica — tudo misturado

## O que será feito (2 ações seguras e reversíveis)

### 1. Extrair EFFECT_LIBRARY para módulo próprio

`EFFECT_LIBRARY` é uma constante estática (array de ~140 efeitos). Não é estado Zustand, não muda em runtime. Mantê-la no store polui o módulo e aumenta o bundle do store.

**Ação:**
- Criar `src/data/effectLibrary.ts` com o array e o tipo `Effect`
- Criar `src/data/effectLibraryMap.ts` com o Map indexado (O(1) lookups) — atualmente duplicado em `sharedState.tsx`
- Re-exportar `EFFECT_LIBRARY` de `useProjectStore.ts` para backward compat (zero breaking change)
- Migrar progressivamente os 42 consumidores para importar de `src/data/effectLibrary`

**Risco:** Nenhum. É uma constante pura. Re-export mantém compatibilidade total.
**Impacto:** -140 LOC no store monolítico. Eliminação de lógica duplicada no `sharedState.tsx`.

### 2. Criar sistema de Feature Flags leve

Sistema minimalista para controlar novas implementações com fallback automático.

**Ação:**
- Criar `src/lib/featureFlags.ts` — objeto imutável com flags booleanas
- Flags iniciais: `useNewEffectLibrary`, `useEditorUIHooks` (ambas `true` — validar migração)
- Helper `isEnabled(flag)` com fallback seguro (retorna `false` se flag não existe)

**Risco:** Nenhum. Aditivo, não altera comportamento existente.

## Ficheiros

| Ação | Ficheiro |
|------|---------|
| Criar | `src/data/effectLibrary.ts` — tipos + EFFECT_LIBRARY |
| Criar | `src/data/effectLibraryMap.ts` — Map indexado |
| Criar | `src/lib/featureFlags.ts` — sistema de flags |
| Modificar | `src/store/useProjectStore.ts` — re-export de `src/data/effectLibrary` |
| Modificar | `src/components/editor/skycanvas/sharedState.tsx` — usar `effectLibraryMap` |

## Proteções

- `useProjectStore` continua exportando `EFFECT_LIBRARY` e `Effect` (re-export)
- Nenhum consumidor existente quebra
- Core engines intocados
- Zero alteração de comportamento runtime

## Próximo Passo Recomendado

Após validação: migrar os 42 consumidores de `EFFECT_LIBRARY` para `src/data/effectLibrary` em lotes de 10, removendo a dependência do store.

