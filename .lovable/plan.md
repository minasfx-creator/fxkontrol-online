

# Ciclo #80 — Bug Sweep & Fixes em Toda Plataforma

## Bug #1: IndexedDB Version Conflict (CONSOLE SPAM)
**Causa raiz dos warnings repetidos no console.** Três módulos abrem o mesmo DB `fxkontrol_blackbox` com versões diferentes:
- `useBlackBox.ts` → DB_VERSION = **1**
- `IndexedDBPersistence.ts` → DB_VERSION = **3**
- `SafetyAuditTrail.ts` → DB_VERSION = **3**

Quando `useBlackBox` abre com version 1, o browser retorna o DB já na version 3 (sem trigger `onupgradeneeded`). Mas quando `SafetyAuditTrail` abre com version 3, se o DB já está aberto por outro módulo, a `onupgradeneeded` não roda e o object store `safety_audit` pode não existir. Resultado: `"One of the specified object stores was not found"` a cada 200 ticks (~7 segundos).

**Fix**: Unificar todos os acessos IndexedDB em um único módulo centralizador, ou pelo menos alinhar `useBlackBox` para DB_VERSION = 3 e garantir que sua `onupgradeneeded` crie TODOS os stores (sessions, snapshots, commandlog, safety_audit).

## Bug #2: Terrain Loading Loop (PERFORMANCE)
O session replay mostra "Carregando terreno 3D..." → "Terreno carregado" em loop a cada ~2 segundos.

**Causa**: `applyAnchorTransform` (useCallback com deps `[anchorLat, anchorLon, anchorAlt]`) está na dependency array do useEffect principal que cria/destrói o TilesRenderer (linha 210). Qualquer mudança de anchor destrói e recria todo o renderer, triggering o ciclo loading→ready.

**Fix**: Remover `applyAnchorTransform` da dependency array do useEffect de inicialização. Usar um ref para a função e chamá-la manualmente. O useEffect separado (linha 219-221) já cuida de updates de anchor.

## Bug #3: Terrain State Flicker (UX)
Mesmo sem mudança de anchor, `visibleCount` oscila entre >2 e <=2 conforme tiles entram/saem do frustum, causando flip constante entre `'ready'` e `'loading-tiles'`.

**Fix**: Adicionar hysteresis: só voltar para `'loading-tiles'` se `visibleCount === 0` por N frames consecutivos. Uma vez `ready`, permanecer `ready` a menos que realmente não haja tiles.

## Bug #4: IndexedDBPersistence não cria `safety_audit` store
O `onupgradeneeded` de `IndexedDBPersistence.ts` cria apenas `snapshots` e `commandlog`, mas não `safety_audit`. Se este módulo for o primeiro a abrir o DB, o store não existirá quando `SafetyAuditTrail` tentar usá-lo.

**Fix**: Centralizar a criação de todos os stores em um único ponto.

## Plano de Implementação

### 1. Criar módulo centralizado de IndexedDB (`src/core/persistence/dbConnection.ts`)
- Uma única função `getDB()` que abre `fxkontrol_blackbox` com version 4
- `onupgradeneeded` cria todos os 4 stores: `sessions`, `snapshots`, `commandlog`, `safety_audit`
- Singleton cached, retorna mesma Promise para todos os callers

### 2. Refatorar `useBlackBox.ts`
- Importar `getDB()` do módulo centralizado em vez de abrir DB localmente
- Remover `DB_NAME`, `DB_VERSION`, `openDB()` locais

### 3. Refatorar `IndexedDBPersistence.ts`
- Importar `getDB()` do módulo centralizado
- Remover `_open()` local e duplicação de DB_NAME/DB_VERSION

### 4. Refatorar `SafetyAuditTrail.ts`
- Importar `getDB()` do módulo centralizado
- Remover `_open()` local e duplicação de DB_NAME/DB_VERSION

### 5. Fix terrain loading loop (`GoogleTilesEngine.tsx`)
- Remover `applyAnchorTransform` da deps do useEffect de init (linha 210)
- Usar `applyAnchorTransformRef` (ref) dentro do init para a chamada inicial
- Adicionar hysteresis ao state: só voltar a `'loading-tiles'` se `visibleCount === 0` por 3+ ciclos consecutivos

## Arquivos

| Acao | Arquivo |
|------|---------|
| Create | `src/core/persistence/dbConnection.ts` |
| Edit | `src/hooks/useBlackBox.ts` |
| Edit | `src/core/persistence/IndexedDBPersistence.ts` |
| Edit | `src/core/safety/SafetyAuditTrail.ts` |
| Edit | `src/core/geo/GoogleTilesEngine.tsx` |

## Ordem
1. Criar `dbConnection.ts` centralizado
2. Refatorar os 3 consumidores de IndexedDB
3. Fix terrain loading loop + hysteresis
4. Build verification

