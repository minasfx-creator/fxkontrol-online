

# Fix Google 3D Tiles Initialization + Verify Loading

## Problem Found

**Race condition in `GoogleTilesEngine.tsx`**: The API key is fetched asynchronously in one `useEffect` and stored in a `ref`. The initialization `useEffect` checks `apiKeyRef.current` but only depends on `[enabled, scene, camera]`. When the key arrives after mount, the init effect never re-fires because refs don't trigger re-renders. Result: tiles never initialize.

## Fix (1 file)

### `src/core/geo/GoogleTilesEngine.tsx`

1. **Convert `apiKeyRef` to state** (`useState`) so that when the key arrives, it triggers a re-render and the init effect re-runs.

2. **Fix `setResolutionFromRenderer`** — the current code uses a fragile `__r3f` internal path. Use the `useThree` hook to get `gl` directly:
   ```typescript
   const { scene, camera, gl } = useThree();
   // ...
   tiles.setResolutionFromRenderer(camera, gl);
   ```

3. **Add the anchor matrix update as a dependency** — the anchor effect (line 145) checks `tilesRef.current` which may not be set yet when anchor changes fire before init completes. Add the `apiKey` state to ensure proper sequencing.

4. **Add error/status logging** — log when key is fetched, when tiles start loading, and any load errors to help diagnose Map Tiles API issues.

### Concrete changes:

```typescript
// Before (broken):
const apiKeyRef = useRef<string | null>(null);
// ...
useEffect(() => { /* fetch key, set ref */ }, []);
useEffect(() => {
  if (!enabled || !apiKeyRef.current) return; // never re-evaluated
}, [enabled, scene, camera]);

// After (fixed):
const [apiKey, setApiKey] = useState<string | null>(null);
// ...
useEffect(() => { /* fetch key, setApiKey(data.key) */ }, []);
useEffect(() => {
  if (!enabled || !apiKey) return; // re-runs when apiKey state changes
}, [enabled, apiKey, scene, camera, gl]);
```

## Files Changed

| File | Change |
|---|---|
| `src/core/geo/GoogleTilesEngine.tsx` | Fix race condition (ref→state), fix GL renderer access, add diagnostic logging |

## What is NOT Changed

- No other files modified
- Coordinate math, ECEF→ENU matrix — unchanged
- SkyCanvas mounting logic — already correct

