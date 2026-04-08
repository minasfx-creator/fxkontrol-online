

# Ciclo #55 — Sprint 2: Command Log, Snapshot System, Replay + Rollback

## Inventário Existente

| Componente | Existe | Avaliação |
|---|---|---|
| CommandBus (dispatch/drain) | SIM | Sprint 1 — funcional |
| LockstepEngine (60Hz fixed) | SIM | Determinístico |
| useUndoStore (undo/redo) | SIM | Zustand-based, structuredClone snapshots, max 50 |
| useBlackBox (crash recovery) | SIM | IndexedDB auto-save 500ms, dirty session detection |
| StateBuffer (double buffer) | SIM | Front/back swap |
| VersioningPanel (UI) | SIM | Named snapshots, local state only (não persiste) |

## O que o Sprint 2 Adiciona

### 1. CommandLog — Gravação determinística de comandos

**Novo arquivo:** `src/core/command/CommandLog.ts`

Grava cada comando com tick number e timestamp. Permite replay exato.

```text
CommandLog
├── record(tick, cmd)     — append ao log
├── getLog()              — retorna array completo
├── slice(fromTick, toTick) — range query
├── clear()               — reset
└── exportJSON() / importJSON()  — serialização
```

Integração: o subsystem `commandBus` no EngineProvider já drena comandos — após `applyAll`, gravar no log com `lockstep.getTickCount()`.

### 2. SnapshotManager — Snapshots periódicos do estado

**Novo arquivo:** `src/core/state/SnapshotManager.ts`

Captura snapshots do ProjectStore a cada N ticks (configurável, default 300 = ~5s). Mantém ring buffer de max 20 snapshots.

```text
SnapshotManager
├── capture(tick)         — structuredClone do estado
├── nearest(tick)         — snapshot mais próximo ≤ tick
├── getAll()              — lista de snapshots
├── clear()
```

Integração: registar como subsystem no lockstep com priority 200 (baixa). A cada 300 ticks chama `capture`.

### 3. ReplayEngine — Replay determinístico

**Novo arquivo:** `src/core/engine/ReplayEngine.ts`

Dado um CommandLog e um snapshot inicial, re-executa comandos tick-a-tick para reproduzir o estado exato.

```text
ReplayEngine
├── startReplay(fromTick, toTick?)  — inicia replay
├── tick()                          — avança 1 tick do replay
├── isReplaying()
├── stop()
```

Fluxo de replay:
1. Encontra snapshot mais próximo via SnapshotManager
2. Aplica snapshot ao ProjectStore
3. Re-executa comandos do CommandLog desde aquele tick
4. Cada `tick()` aplica os comandos daquele tick no CommandBus

### 4. Rollback — Voltar a qualquer ponto

Rollback = snapshot restore + descarte de comandos posteriores. Usa `SnapshotManager.nearest(targetTick)` + `CommandLog.slice(snapshotTick, targetTick)` e re-aplica.

Integrar como command type no CommandBus:
```ts
| { type: 'ROLLBACK'; targetTick: number }
```

### 5. Integração no EngineProvider

Atualizar `EngineProvider.tsx` para:
- Importar e registar `SnapshotManager` como subsystem
- Após `commandBus.applyAll`, gravar no `CommandLog`
- Expor `commandLog` e `snapshotManager` como singletons importáveis

### 6. Upgrade da VersioningPanel (UI)

Conectar a `SnapshotManager` real em vez de estado local:
- Listar snapshots automáticos
- Botão "Rollback to here" dispara `commandBus.dispatch({ type: 'ROLLBACK', targetTick })`
- Mostrar tick number e timestamp de cada snapshot

## Arquivos

| Ação | Arquivo |
|------|---------|
| Criar | `src/core/command/CommandLog.ts` |
| Criar | `src/core/state/SnapshotManager.ts` |
| Criar | `src/core/engine/ReplayEngine.ts` |
| Editar | `src/core/command/CommandBus.ts` (adicionar ROLLBACK type) |
| Editar | `src/orchestration/EngineProvider.tsx` (integrar log + snapshots) |
| Editar | `src/components/editor/VersioningPanel.tsx` (conectar a SnapshotManager) |

## Ordem de Execução

| Passo | Tarefa |
|-------|--------|
| 1 | Criar CommandLog |
| 2 | Criar SnapshotManager |
| 3 | Criar ReplayEngine |
| 4 | Adicionar ROLLBACK ao CommandBus |
| 5 | Integrar tudo no EngineProvider |
| 6 | Conectar VersioningPanel ao sistema real |
| 7 | Build verification |

