---
name: Reopen Match Policy
description: Operator-tunable VID:PID vs VID:PID+Serial keying for portRegistry / auto-reopen
type: feature
---
- Store: `useReopenMatchPolicy` (zustand, persist `fxk:reopenMatchPolicy:v1`); values `'vidpid' | 'vidpid+serial'`; default `'vidpid'`.
- `keyFor()` in `portRegistry.ts` accepts optional `serialNumber` and `policy`; appends serial only when policy is `vidpid+serial`. Non-React access via `getReopenMatchPolicy()`.
- `portRegistry.recordSuccess` accepts `serialNumber` and forwards to `keyFor`.
- WebUSB: `deviceToDiscovered` and disconnect handler both pass `serialNumber` through `keyFor`. Web Serial does NOT expose serial — option only affects WebUSB.
- UI: `ReopenMatchPolicySelector` mounted in `HardwareOverview` next to `TransportFilterChips`.
- Switching policy after authorizations are stored creates new keys for next discovery; old entries persist until `forgetDevice` or `portRegistry.clear()`.
