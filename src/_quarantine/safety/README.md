# Safety Quarantine — DO NOT IMPORT FROM RUNTIME

This directory holds the **original** implementations of all blocking
safety subsystems while the platform is in testing.

## What lives here (frozen .ts.txt copies)

| Original file                                  | Quarantine copy                                  |
|------------------------------------------------|--------------------------------------------------|
| `src/core/safety/safetyGate.ts`                | `safetyGate.original.ts.txt`                     |
| `src/core/hardware/OperationalModeGuard.ts`    | `OperationalModeGuard.original.ts.txt`           |
| `src/lib/uiLockHelper.ts`                      | `uiLockHelper.original.ts.txt`                   |
| `src/components/editor/live-firing/LockoutPanel.tsx` | `LockoutPanel.original.tsx.txt`            |

Files are saved with `.txt` suffix so TypeScript ignores them and they
are not accidentally re-imported.

## Runtime behavior NOW

The active modules at the original paths have been replaced with
**no-op shims** that:

- always return "not enforced"
- silently ignore writes (`setMaster`, `setLayer`, `enableAll`)
- preserve the public API and listener subscription so React UIs still mount

This means **all 4 blocking layers are off**:

1. **lockoutGroups** — Lockout Groups (A–E) on Live Firing Panel
2. **interlockChain** — LOCK → ARM → FIRE state machine gating
3. **modeGuard**     — OperationalModeGuard (preview / dry-run / export…)
4. **uiLocks**       — per-item `.locked` enforcement in editor

## How to RE-ACTIVATE before production deploy

```bash
# From repo root
cp src/_quarantine/safety/safetyGate.original.ts.txt          src/core/safety/safetyGate.ts
cp src/_quarantine/safety/OperationalModeGuard.original.ts.txt src/core/hardware/OperationalModeGuard.ts
cp src/_quarantine/safety/uiLockHelper.original.ts.txt        src/lib/uiLockHelper.ts
cp src/_quarantine/safety/LockoutPanel.original.tsx.txt       src/components/editor/live-firing/LockoutPanel.tsx
```

Then:
- Re-enable the **Settings → Segurança** tab in `src/pages/Settings.tsx`
- Run the full safety regression suite (E-STOP latency <50ms, interlock chain, lockout groups)
- Verify `safetyGate.enableAll()` actually flips all 4 layers

## Why quarantine instead of delete?

- Preserves the full SafetyGate API surface (`isEnforced`, `subscribe`, listeners)
- ~16 import sites continue to compile with zero refactor
- Reactive UIs (`useItemLocked`, settings panel) keep mounting cleanly
- Reversal is a 4-line `cp` operation
