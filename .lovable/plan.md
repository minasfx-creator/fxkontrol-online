

# Plan: Bug Hunt + UX Refinement

## Bugs Found

### BUG 1: `br2049-atmosphere` class never applied
The CSS class exists in `index.css` but is never used in any `.tsx` file. The previous plan to add it to viewport containers was never executed.

### BUG 2: `JoiHologramAvatar` never created
The approved plan to create a Joi hologram avatar component was never implemented. `FXKAssistant` still uses the basic `VoiceWave` circles.

### BUG 3: FXKAssistant not rendered on Index page
`FXKAssistant` is only rendered inside `MainLayout.tsx` (sidebar layout). The main editor `Index.tsx` never mounts it, so users in the editor have no assistant access.

### BUG 4: ViewportTransitionOverlay starts invisible — no fade-IN on mount
When `phase` starts as `'idle'`, the component returns `null`. On first `fade-out`, it jumps from nothing to `opacity-100 bg-black` with no initial rendered state to transition FROM. The CSS `transition-opacity` has no effect because the element is being mounted, not transitioning.

### BUG 5: MobileHUD GPS pill overlaps Dynamic Island / notch
The GPS pill is positioned at `top-14` (56px) with `absolute` inside a `fixed` container. On devices with tall notches (iPhone 14 Pro+), this overlaps the HUD transport controls at `pt-2 pb-1`.

### BUG 6: LiveModeOverlay E-STOP fires on single tap — no hold-to-confirm
The E-STOP button (line 157-165) uses `onClick` for immediate firing. The plan specified hold-to-confirm for ALL critical actions, but E-STOP was left as a single-tap. While quick E-STOP is arguably correct for safety, it contradicts the accidental-trigger protection.

### BUG 7: MobileConsoleFullscreen missing `onTouchMove` handler
The swipe-to-dismiss only checks `onTouchEnd` delta. Without `onTouchMove`, there's no visual drag feedback (no rubber-band effect like `MobileFloatingPanel` has).

### BUG 8: Desktop panel lacks close button
The floating panel at line 558-571 of `Index.tsx` has no close button. Users must click the same panel tab again to close — not discoverable.

## UX Refinements

### REF 1: Add `br2049-atmosphere` to viewport containers
Apply the warm amber glow to the 3 viewport wrapper divs (mobile live, mobile editor, desktop).

### REF 2: Create `JoiHologramAvatar` component
CSS-only holographic woman silhouette with amber/cyan glow, scanline sweep, and idle/active states. Replace `VoiceWave` in `FXKAssistant` header and empty state.

### REF 3: Mount `FXKAssistant` in `Index.tsx`
Add the assistant bubble to the editor layout so it's accessible in all modes.

### REF 4: Fix ViewportTransitionOverlay mount animation
Render the overlay always (with `opacity-0 pointer-events-none`) and toggle opacity via state, so CSS transitions work properly.

### REF 5: Fix GPS pill position
Move it below the HUD bar, use `top-[72px]` or make it relative to the HUD container instead of absolute.

### REF 6: Add visual drag feedback to MobileConsoleFullscreen
Add `onTouchMove` handler with `dragOffset` state and rubber-band transform, matching `MobileFloatingPanel` pattern.

### REF 7: Add close button to desktop floating panel
Add an X button in the top-right corner of the floating panel.

### REF 8: Improve FXKAssistant mobile positioning
The bubble sits at `bottom-20` which may conflict with `MobileTabBar`. Adjust to sit above the tab bar safely.

## Files to Change

| File | Changes |
|------|---------|
| `src/components/JoiHologramAvatar.tsx` | New — CSS hologram silhouette component |
| `src/components/FXKAssistant.tsx` | Replace VoiceWave with JoiHologramAvatar, fix mobile z-index |
| `src/pages/Index.tsx` | Add `br2049-atmosphere` to viewports, mount `FXKAssistant`, add panel close button |
| `src/components/editor/ViewportTransitionOverlay.tsx` | Fix mount animation (always-render pattern) |
| `src/components/editor/MobileHUD.tsx` | Fix GPS pill position overlap |
| `src/components/editor/MobileConsoleFullscreen.tsx` | Add drag feedback on swipe |
| `src/index.css` | Add `@keyframes hologram-flicker`, hologram silhouette styles |

