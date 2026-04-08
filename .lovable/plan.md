
# Ciclo #56 — Sprint 3: Distributed Command Sync + Multi-Site Coordinator + Replay Visual

## Inventário Existente

| Componente | Existe | Estado |
|---|---|---|
| CommandBus (dispatch/drain/apply) | SIM | Sprint 1-2, funcional |
| CommandLog (record/replay/rollback) | SIM | Sprint 2, funcional |
| SnapshotManager (periodic capture) | SIM | Sprint 2, funcional |
| ReplayEngine (rollback + slow-mo) | SIM | Sprint 2, funcional |
| ClusterSyncEngine (camera/physics broadcast) | SIM | Broadcasts ClusterFrame, não Commands |
| RealtimeClient (WebSocket generic) | SIM | Genérico, sem integração com CommandBus |
| remoteCommandEngine (Supabase Realtime) | SIM | Controle remoto, sem command relay |
| FrameSyncEngine (timecode alignment) | SIM | Drift correction, frame-locked |
| MissionControlPanel (multi-site UI) | SIM | Stub `multiSiteSync` — not implemented |
| EngineProvider (React bridge) | SIM | Sprint 2, boots kernel |

## O que FALTA para Sprint 3

### 1. CommandRelay — Distributed Command Sync

**Novo:** `src/core/sync/CommandRelay.ts`

Bridges CommandBus to Supabase Realtime broadcast channel. Master site dispatches commands that are relayed to all connected sites. Each site applies them through the same deterministic pipeline.

```text
CommandRelay
├── start(sessionCode, role)  — join relay channel
├── stop()                    — leave
├── relayOutgoing(cmd)        — broadcast local command to peers
├── onIncoming(cmd)           — inject remote command into local CommandBus
├── getState()                — connected, peerCount, latencyMs
```

Key design decisions:
- Commands are tagged with `originSiteId` to prevent echo loops
- Only Master can relay mutation commands (FIRE, ARM); Clients relay read-only (OPEN_PANEL)
- Uses Supabase Realtime broadcast (already in project) — no new WebSocket server needed
- Integrates into EngineProvider as a subsystem

### 2. MultiSiteCoordinator — Replace Stub

**Novo:** `src/core/sync/MultiSiteCoordinator.ts`

Replaces the stub `multiSiteSync` object in MissionControlPanel with a real implementation.

```text
MultiSiteCoordinator
├── registerSite(siteId, name, role)
├── getAllSites()              — SiteInfo[]
├── isLocalMode()              — true if no remote sites
├── getMaster()                — current master site
├── onStateChange(cb)          — notify UI
├── heartbeat()                — periodic presence via Supabase
```

Site presence via Supabase Realtime presence API (already used in remoteCommandEngine). Each site tracks: siteId, name, role (master/slave), lastHeartbeat, latencyMs, tickCount.

### 3. ReplayVisualizer — Replay Playback UI

**Novo:** `src/components/editor/ReplayOverlay.tsx`

Overlay that shows during active replay:
- Progress bar (currentTick / targetTick)
- Speed controls (0.25x, 0.5x, 1x, 2x)
- Play/Pause/Stop buttons
- Tick counter display
- Semi-transparent overlay badge "REPLAY MODE"

Connects to `replayEngine` state. Mounted conditionally in EngineProvider when replay is active.

### 4. Integration Updates

**Edit:** `src/orchestration/EngineProvider.tsx`
- Register CommandRelay as subsystem (priority 5, after commandBus drain)
- After `commandBus.applyAll`, relay outgoing commands via CommandRelay
- Inject incoming remote commands before next drain
- Conditionally render ReplayOverlay when `replayEngine.getState() === 'replaying'`

**Edit:** `src/components/editor/MissionControlPanel.tsx`
- Replace stub `multiSiteSync` with real `MultiSiteCoordinator` import
- Remove stub type definitions

**Edit:** `src/core/command/CommandBus.ts`
- Add new command types: `SITE_JOIN`, `SITE_LEAVE`, `REPLAY_START`, `REPLAY_STOP`, `REPLAY_SPEED`

## Arquivos

| Acao | Arquivo |
|------|---------|
| Criar | `src/core/sync/CommandRelay.ts` |
| Criar | `src/core/sync/MultiSiteCoordinator.ts` |
| Criar | `src/components/editor/ReplayOverlay.tsx` |
| Editar | `src/core/command/CommandBus.ts` (novos tipos) |
| Editar | `src/orchestration/EngineProvider.tsx` (relay + replay overlay) |
| Editar | `src/components/editor/MissionControlPanel.tsx` (replace stub) |

## Ordem de Execucao

| Passo | Tarefa |
|-------|--------|
| 1 | Adicionar novos command types ao CommandBus |
| 2 | Criar CommandRelay (Supabase Realtime broadcast) |
| 3 | Criar MultiSiteCoordinator (presence-based) |
| 4 | Criar ReplayOverlay (UI) |
| 5 | Integrar tudo no EngineProvider + MissionControlPanel |
| 6 | Build verification |
