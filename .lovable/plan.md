## Goal
Remove the redundant `QuickJumpMenu` pill (top-right) on routes where the `AppSidebar` is already visible, since the sidebar already provides Studio + AI Choreography navigation. Keep the pill on `/studio` and `/command`, where the sidebar is hidden and the pill is the only quick-jump affordance.

## Change
**File:** `src/layouts/MainLayout.tsx`

Currently (around line 154):
```tsx
{/* Global quick-jump menu — always visible top-left, even inside editor/command */}
<QuickJumpMenu />
```

Change to render it only when the sidebar is hidden — i.e. on the immersive routes (`/studio` and `/command`):
```tsx
{(isEditor || commandImmersive) && <QuickJumpMenu />}
```

`isEditor` and `commandImmersive` are already computed earlier in the component, so no new state is needed.

## Why this scope
- On regular routes, `AppSidebar` lists Studio (and the rest of the app) — the pill duplicates that.
- On `/studio` and `/command`, the sidebar is intentionally hidden for a fullscreen workspace; without the pill there'd be no quick way back to other surfaces.
- The stale "top-left" JSDoc in `QuickJumpMenu.tsx` (the pill is actually positioned top-right) is unrelated and out of scope — happy to clean it up in a follow-up if you want.

## Verification
- `/` (Index) → no pill, sidebar visible. ✅
- `/studio` → pill visible, sidebar hidden. ✅
- `/command` → pill visible, sidebar hidden. ✅
- No other files reference `QuickJumpMenu`, so no further cleanup needed.
