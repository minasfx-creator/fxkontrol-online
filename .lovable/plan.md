

# Ciclo #57 — Sprint 4: IndexedDB Persistence + Export/Import + Timeline Scrubber

## What Exists

| Component | Status |
|---|---|
| CommandLog (in-memory ring buffer 60K) | Functional, has `exportJSON()`/`importJSON()` |
| SnapshotManager (in-memory ring buffer 20) | Functional, no persistence |
| useBlackBox (IndexedDB crash recovery) | Functional, separate DB `fxkontrol_blackbox` |
| VersioningPanel (UI) | Functional, polls snapshots, rollback button |
| ReplayOverlay (UI) | Functional, progress/speed/controls |
| Timeline.tsx | Has basic scrubber/progress bar, no tick-level scrubbing |

## Sprint 4 Deliverables

### 1. IndexedDB Persistence Layer — `src/core/persistence/IndexedDBPersistence.ts`

Unified IndexedDB wrapper (reuses existing `fxkontrol_blackbox` DB with new object stores):
- **Store `snapshots`**: Persists SnapshotManager ring buffer on each capture
- **Store `commandlog`**: Periodically flushes CommandLog to IDB (every 30s or on page unload)
- **On boot**: Loads persisted snapshots into SnapshotManager and command log into CommandLog
- Uses DB version upgrade to add new stores alongside existing `sessions` store

Key methods:
```text
persistSnapshots(snapshots: Snapshot[])
persistCommandLog(entries: LogEntry[])
loadSnapshots(): Snapshot[]
loadCommandLog(): LogEntry[]
clearAll()
```

### 2. Export/Import Commands — `src/core/command/CommandBus.ts` + VersioningPanel

Add command types:
```ts
| { type: 'EXPORT_LOG'; format: 'json' }
| { type: 'IMPORT_LOG'; json: string }
```

In VersioningPanel, add two buttons:
- **Export Log** — downloads `commandLog.exportJSON()` as `.json` file via `triggerDownload`
- **Import Log** — file input that reads JSON and calls `commandLog.importJSON()`

### 3. Integration in EngineProvider

- Import `IndexedDBPersistence` 
- On boot: load persisted snapshots + command log
- Register low-priority subsystem (priority 300) that flushes to IDB every 1800 ticks (~30s)
- On unmount: final flush

### 4. Visual Timeline Scrubber — `src/components/editor/TimelineScrubber.tsx`

A dedicated scrubber component that maps tick-space to pixel-space:
- Horizontal bar showing full session duration (tick 0 → lastTick)
- Snapshot markers (dots) at each snapshot tick
- Draggable playhead that dispatches `ROLLBACK` on release
- Current tick indicator
- Integrates into VersioningPanel below the snapshot list

```text
|●───●────●──────●──▶────────|
 s1   s2    s3     s4  ▲current
                      drag to rollback
```

## Files

| Action | File |
|--------|------|
| Create | `src/core/persistence/IndexedDBPersistence.ts` |
| Create | `src/components/editor/TimelineScrubber.tsx` |
| Edit | `src/core/command/CommandBus.ts` (add EXPORT_LOG, IMPORT_LOG types) |
| Edit | `src/orchestration/EngineProvider.tsx` (boot load + periodic flush) |
| Edit | `src/components/editor/VersioningPanel.tsx` (export/import buttons + scrubber) |

## Execution Order

| Step | Task |
|------|------|
| 1 | Create IndexedDBPersistence |
| 2 | Add export/import command types to CommandBus |
| 3 | Create TimelineScrubber component |
| 4 | Integrate persistence in EngineProvider |
| 5 | Update VersioningPanel with export/import + scrubber |
| 6 | Build verification |

