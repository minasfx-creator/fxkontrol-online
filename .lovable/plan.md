## Bugs found

**1. `isEditor` checks wrong path** — `src/layouts/MainLayout.tsx:67` uses `location.pathname === '/editor'`, but the actual editor route is `/studio` (`/editor` is just a redirect in `App.tsx`). Result on `/studio`: `isEditor` is false → AppSidebar + header render around the editor (shrinking the viewport), and the redundant Studio NavLink shows up even when we're already inside Studio.
**Fix:** change to `location.pathname === '/studio'`.

**2. Redundant "Studio" pill in header** — Lines 204–218 of `MainLayout.tsx` render a NavLink to `/studio` that QuickJumpMenu now duplicates (and exposes 2 more targets).
**Fix:** delete the NavLink block; drop the now-unused `Wand2` and `NavLink` imports.

**3. FXK-DRONES never highlights as active** — `QuickJumpMenu.tsx` checks `pathname + search === '/studio?panel=drones'`, but `Index.tsx` (around line 356) strips `?panel=` from the URL immediately after opening the panel, so the active state never matches.
**Fix:** drop the misleading active comparison for the drones item; only highlight Studio (any `/studio*`) and AI Choreography. Cleaner UX matches the actual URL state.

**4. iOS notch / safe area** — `fixed top-2 right-2` can sit under the status bar / dynamic island on iPhone PWA.
**Fix:** offset the container with `top: calc(0.5rem + env(safe-area-inset-top))` and `right: calc(0.5rem + env(safe-area-inset-right))`.

## Files

- `src/layouts/MainLayout.tsx` — fix `isEditor`, remove redundant NavLink + imports.
- `src/components/QuickJumpMenu.tsx` — drop drones active-state, add safe-area offsets.

## Out of scope

Wiring QuickJumpMenu to the actual open-panel store in `Index.tsx` (would let DRONES highlight correctly while the panel is open) — larger refactor; happy to follow up if you want it.