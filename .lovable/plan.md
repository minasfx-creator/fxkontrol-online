## FXK16 Typed Command API for FXKPYRO

Add a small, strongly-typed command surface on top of the existing `useFXK16Bridge` / `FireOneHardwareBridge` so FXKPYRO panels stop calling raw `fire(ch, ms): boolean` and instead get **discriminated `CommandResponse` results** with stable error codes — including a client-side **ARM gate** that prevents `fire`/`fireBatch` from ever reaching the wire on a disarmed bridge.

### What gets built

1. **`src/lib/fxk16/commandApi.ts`** — pure types + a `createFxk16CommandApi(bridge)` factory. No React.
2. **`src/hooks/useFXK16Commands.ts`** — React hook wrapping the singleton bridge, exposing the typed API with a reactive `armed` flag (singleton-scoped, persists across mounts).
3. **`src/components/editor/live-firing/FXK16ConnectionPanel.tsx`** — wire the existing Test FIRE / E-STOP buttons through the new API; show last error code + add an ARM/DISARM toggle (Hold-to-Confirm 800ms) gating the Test FIRE.
4. **`mem://funcionalidades/fxk16-typed-command-api.md`** + index entry.

### Public surface (typed)

```ts
type Fxk16Channel = number; // runtime-validated 1..16

type Fxk16ErrorCode =
  | 'NOT_CONNECTED'        // bridge offline
  | 'WRONG_DEVICE'         // connected but not FXK16
  | 'NOT_ARMED'            // client-side ARM gate blocked
  | 'INVALID_CHANNEL'      // outside 1..16
  | 'INVALID_DURATION'     // <=0 or >10000ms
  | 'EMPTY_CHANNEL_SET'    // setChannels([]) / batch([])
  | 'LINK_DEGRADED'        // bridge.linkHealth !== 'healthy'
  | 'BRIDGE_REJECTED'      // bridge returned false
  | 'BRIDGE_THREW'         // exception during sendCommand
  | 'TIMEOUT';             // FIRE_CONFIRM_TIMEOUT in bridge

type Ok<T = void>  = { ok: true;  value: T };
type Err           = { ok: false; code: Fxk16ErrorCode; message: string; cause?: unknown };
type CommandResponse<T = void> = Ok<T> | Err;

interface Fxk16CommandApi {
  // State queries (sync)
  isReady(): boolean;        // connected + isFXK16 + healthy
  isArmed(): boolean;

  // ARM gate (client-side, bridge has no ARM opcode)
  arm():    CommandResponse;
  disarm(): CommandResponse;

  // Firing — all guarded by isReady() + isArmed()
  fire(channel: Fxk16Channel, durationMs: number): Promise<CommandResponse<{ channel: number; durationMs: number }>>;
  fireBatch(channels: Fxk16Channel[], durationMs: number): Promise<CommandResponse<{ mask: number; channels: number[]; durationMs: number }>>;

  // Channel selection state (which channels the operator "armed" for next BATCH)
  setChannels(channels: Fxk16Channel[]): CommandResponse<{ channels: number[]; mask: number }>;
  getSelectedChannels(): Fxk16Channel[];
  fireSelected(durationMs: number): Promise<CommandResponse<{ mask: number; channels: number[]; durationMs: number }>>;

  // Always allowed, bypasses ARM (matches bridge.eStop semantics)
  stop(): Promise<CommandResponse>;        // alias eStop, also auto-disarms
  eStop(): Promise<CommandResponse>;       // raw eStop
}
```

### Key behaviors

- **ARM gate is local.** `arm()` flips an in-memory flag on the singleton; `disarm()` clears it. Any non-emergency firing call returns `{ ok:false, code:'NOT_ARMED' }` synchronously when disarmed — no bytes hit the wire. `stop()` and `eStop()` ignore ARM and additionally call `disarm()` after success (fail-safe).
- **Validation before bridge.** Channel range, duration range, empty arrays, and `isReady()` are all checked before touching `bridge.fire/fireBatch`. Mask is built via existing `channelsToMask()` to keep the single source of truth.
- **No protocol invention.** No new ASCII opcodes. `fire`/`fireBatch`/`eStop` map 1:1 to the existing firmware verbs (`FIRE:` / `BATCH:` / `ESTOP`). `setChannels` is purely a UI staging buffer — `fireSelected` is what actually sends `BATCH:`.
- **Error mapping.** Bridge returns `boolean`; on `false` we read `bridge.getStatus().lastErrorCode` and translate (`HEARTBEAT_TIMEOUT` / `LINK_NOT_HEALTHY` → `LINK_DEGRADED`, `COMMAND_TIMEOUT` → `TIMEOUT`, etc.). `try/catch` around the call surfaces `BRIDGE_THREW` with `cause`.
- **Singleton-scoped ARM.** Stored on the same module as `useFXK16Bridge` so a second panel sees the same ARM state — and an unmount/remount doesn't silently re-arm.
- **Auto-disarm on link loss.** Subscribes to bridge events `disconnected` / `heartbeat_timeout` and clears the ARM flag; toast `"FXK16 desarmado: link perdido"`.

### Files

```text
src/lib/fxk16/
  commandApi.ts                  (new)  pure types + factory, fully unit-testable
src/hooks/
  useFXK16Commands.ts            (new)  reactive wrapper around the singleton
src/components/editor/live-firing/
  FXK16ConnectionPanel.tsx       (edit) ARM toggle + typed-error display, Test FIRE through new API
mem://funcionalidades/
  fxk16-typed-command-api.md     (new)  feature memory
mem://index.md                   (edit) one new line
```

### Out of scope

- No firmware changes (FXK16 sketch already deployed).
- No new transport. Continues to ride USB/BLE via `FireOneHardwareBridge`.
- No ARM protocol opcode — adding one would require firmware work and would violate the honest-hardware rule (no synthetic capabilities). If you later want hardware-backed ARM, that's a follow-up.