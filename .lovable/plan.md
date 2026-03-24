

## Plan: Fix White Screen Crash on /editor

### Problem
The editor page renders a blank white screen. Network requests show the user is authenticated and data loads successfully, but the React tree crashes before rendering. No console errors are captured.

### Root Cause
Circular dependency in module initialization:
- `src/core/execution/executionBridge.ts` imports `blackbox` from `@/core/reliability/index.ts`
- `@/core/reliability/index.ts` re-exports from `executionBridge.ts`

This circular import can cause `blackbox` to be `undefined` at module initialization time, crashing the `ExecutionBridge` constructor or its first usage.

### Fix

**File: `src/core/execution/executionBridge.ts`**
- Change `import { blackbox } from '@/core/reliability'` to the direct path: `import { blackbox } from '@/core/reliability/blackBoxRecorder'`

**File: `src/core/execution/pyroExecutor.ts`** (check if same pattern)
- If it imports from `@/core/reliability`, change to direct path.

**File: `src/core/execution/droneExecutor.ts`** (check if same pattern)
- Same fix if applicable.

**File: `src/core/network/fieldBus.ts`** (check if same pattern)
- Same fix if applicable.

**File: `src/core/validation/simulationValidator.ts`** (check if same pattern)
- Same fix if applicable.

This breaks the circular dependency chain while keeping all functionality identical.

### Technical details
ES module circular dependencies work with live bindings for named exports, but if a module's top-level code runs before its dependency has finished initializing (e.g., calling `new Class()` at module scope that references a not-yet-initialized import), it can fail silently. Changing to direct imports eliminates the cycle entirely.

