

## Plan: Add Timeline Master + Timecode Player Status to Show Control

### Problem
The ShowControlPanel's clock shows elapsed time since component mount (`Date.now() - startRef`), not the actual project timeline position or SMPTE timecode status. There's no visibility into the timeline master state, frame sync status, or transport controls.

### Solution
Replace the simple elapsed timer with a **Timeline Master** section that shows:
1. Real project timecode (from `useProjectStore.currentTime` + SMPTE formatting)
2. Transport status (PLAY/STOP/ARMED)
3. Frame sync lock status (from `frameSyncEngine`)
4. SMPTE source + mode (from `useSMPTEStore`)
5. Drift indicator

### Changes

**File: `src/components/editor/ShowControlPanel.tsx`**

Replace the "Mission Clock + Global Gauges" section (lines 238-249) with a **TIMELINE MASTER** bar:

```text
┌─────────────────────────────────────────────────────────┐
│  ▶ PLAY   00:01:23:15   30fps   SMPTE   LOCKED  +2ms  │
│  ├ GAUGES ─────────────────────────────────────────────┤│
│  │ [ARMED] [FIRING] [ONLINE] [SYSTEMS]                 ││
└─────────────────────────────────────────────────────────┘
```

Specifically:
- Import `useProjectStore` and `useSMPTEStore`
- Import `frameSyncEngine` for drift/status
- Replace `elapsedMs` timer with real `currentTime` from project store
- Show transport state: ▶ PLAY / ■ STOP with green/red indicator
- Show SMPTE-formatted timecode from the project timeline position
- Show frame rate, sync source (MASTER/SLAVE/FREERUN), lock status (LOCKED/DRIFTING/FREERUN), and drift in ms
- Keep the circular gauges row below the timecode

### Technical details
- `useProjectStore` provides `currentTime`, `isPlaying`, `duration`
- `useSMPTEStore` provides `getDisplayString()`, `mode`, `frameRate`, `status` (external sync)
- `frameSyncEngine.getState()` provides `driftMs`, `status`, `source`, `fps`
- Poll `frameSyncEngine.getState()` at 10Hz via `setInterval` in a `useEffect`
- The `TimecodeDisplay` component will be updated to accept seconds and format as HH:MM:SS:FF using the SMPTE frame rate

