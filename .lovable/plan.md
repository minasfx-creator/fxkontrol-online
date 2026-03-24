

## Viewport Crash — Root Cause & Fix

### Problem

Two bugs in the context-loss recovery flow cause the viewport to crash and never recover:

1. **`recoveringContextRef` never resets on remount**: When context is lost, the code sets `recoveringContextRef.current = true`, then remounts the Canvas via `setCanvasInstanceKey(prev + 1)`. The old canvas is destroyed, so `webglcontextrestored` never fires on it, meaning `recoveringContextRef` stays `true` forever. Any subsequent context loss is silently swallowed (line 1606: `if (recoveringContextRef.current) return`).

2. **Event listeners leak on every remount**: `onCreated` adds `webglcontextlost` and `webglcontextrestored` listeners but never removes them. Each remount adds a new pair to the new canvas, while old listeners become orphaned. After 2+ context losses the accumulated state becomes corrupted.

### Fix (1 file: `SkyCanvas.tsx`)

**A) Reset `recoveringContextRef` when the new Canvas mounts**

Inside the `onCreated` callback, immediately reset the flag so the new canvas instance can handle future context losses:

```typescript
onCreated={({ gl }) => {
  recoveringContextRef.current = false; // ← ADD THIS LINE
  const canvas = gl.domElement;
  // ... rest of handler
```

**B) Clean up event listeners on unmount**

Store listener references and return a cleanup from a `useEffect` tied to `canvasInstanceKey`, or move listener registration into a child component that uses `useThree` + `useEffect` with proper cleanup. The cleanest approach: extract context-loss handling into a small R3F child component:

```typescript
function ContextLossGuard() {
  const { gl } = useThree();
  useEffect(() => {
    const canvas = gl.domElement;
    const onLost = (e: Event) => {
      e.preventDefault();
      recordContextLoss();
      const shouldRecover = reportCrash();
      if (!shouldRecover || isInCooldown()) return;
      recoveringContextRef.current = true;
      resetPools();
      setCanvasInstanceKey(prev => prev + 1);
    };
    const onRestored = () => { recoveringContextRef.current = false; };
    canvas.addEventListener('webglcontextlost', onLost);
    canvas.addEventListener('webglcontextrestored', onRestored);
    return () => {
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
    };
  }, [gl]);
  return null;
}
```

This ensures listeners are cleaned up automatically when the Canvas remounts.

### Changes

| File | Change |
|---|---|
| `src/components/editor/SkyCanvas.tsx` | Extract context-loss listeners from `onCreated` into a `ContextLossGuard` R3F child component with proper `useEffect` cleanup; reset `recoveringContextRef` on mount |

