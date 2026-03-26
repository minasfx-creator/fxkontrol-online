

# Fix Desktop Viewport — Stale Closure + Chrome Blocking

## Bugs Found

### BUG 1: `F` key shortcut has stale closure
Line 232 references `activePanel` but the `useEffect` deps (line 242) only include `viewportMaximized`. When a panel opens/closes, the handler still reads the old `activePanel` value. Result: `F` key may not toggle maximize when expected.

### BUG 2: Toolbar is `relative` but should be `absolute`
The Toolbar (line 545) renders as a normal flow child inside the root `div`. While the canvas is `absolute inset-0`, the Toolbar being `relative` creates unnecessary flow space at the top. All other UI layers (docks, timeline, panels) are `absolute` positioned. Toolbar should be too, for consistency and to prevent layout quirks.

### BUG 3: GeoSetup always starts open
`showGeoSetup` defaults to `true` (line 206). Every time the editor loads, the location picker overlay appears, obscuring the viewport. Should default to `false` (or only show on first visit).

## Solution

### 1. Fix stale closure in F key handler
Add `activePanel` to the `useEffect` dependency array so the handler always has the current value.

### 2. Make Toolbar absolutely positioned
Wrap the Toolbar render in an `absolute top-0 left-0 right-0 z-50` container so it overlays the canvas instead of pushing flow content. This matches all other UI layers.

### 3. Default GeoSetup to closed
Change `useState(true)` to `useState(false)` for `showGeoSetup`. The user can open it via the existing "open-geo-setup" event or toolbar button.

### 4. Ensure maximize fully clears viewport
When `viewportMaximized` is true, also hide the GeoSetup overlay and the SkyCanvas mini-dock (top-right utility buttons inside SkyCanvas) to give a truly clean fullscreen viewport.

## Files to Change

| File | Changes |
|------|---------|
| `src/pages/Index.tsx` | Fix `useEffect` deps for F key; wrap Toolbar in absolute container; default `showGeoSetup` to `false`; hide GeoSetup when maximized |

