

# UI/UX Pente Fino — Apple-Level Polish Pass

## Issues Found

### BUG 1: PerformanceHUD + NavControls ignore timeline state
Both `PerformanceHUD` (line 197) and `ViewportNavControls` (line 208) have hardcoded `bottom-[calc(25vh+8px)]`. They don't respond to `timelineCollapsed` — when timeline is collapsed (default), they float 25vh above the bottom instead of sitting near the bottom edge.

### BUG 2: Duplicate PerformanceHUD
There's a simple FPS counter in `Index.tsx` (line 176) AND a full debug `PerformanceHUD` in `SkyCanvas.tsx` (line 1666). The Index one always renders; the SkyCanvas one only with Ctrl+Shift+D. The simple one should be removed — it adds visual noise and redundancy.

### BUG 3: Left dock uses emoji icons
Left dock (line 613-627) uses `🎆`, `🎨`, `⚙️` emoji strings instead of Lucide icons. Breaks the professional aesthetic — emojis render inconsistently across OS/browsers.

### BUG 4: 'F' key shortcut is dead code
The keyboard handler (lines 262-264) has the `f` key logic commented out with a note about conflict. The shortcut promised in the plan never works.

### BUG 5: Toolbar visual density
The right section crams Timecode, Maximize, Night Mode, Command, LIVE, ARM, E-STOP, hardware dots, and Logout into a single row with inconsistent spacing. Needs visual breathing room and grouping.

## Solution

### 1. Fix PerformanceHUD + NavControls positioning
Pass `timelineCollapsed` to both components (or make them accept a `bottomOffset` prop). Use the same dynamic `bottom` calculation as the docks: `32px` when collapsed, `25vh` when expanded.

### 2. Remove duplicate simple PerformanceHUD
Delete the `PerformanceHUD` function (lines 175-203) and its render (line 659) from Index.tsx. The SkyCanvas debug HUD is the proper one, toggled by Ctrl+Shift+D.

### 3. Replace emoji with Lucide icons in left dock
Replace:
- `🎆` → `<Sparkles />` (Effects)
- `🎨` → `<Paintbrush />` (Scene)  
- `⚙️` → `<Cog />` (Settings)

Already imported in Toolbar.tsx, need to import in Index.tsx.

### 4. Fix 'F' key shortcut
Enable the `f` key to toggle `viewportMaximized` only when no input is focused and no panel is actively open (to avoid conflict). This makes it safe alongside other single-key shortcuts.

### 5. Toolbar right-side refinement
- Add subtle `w-px h-5 bg-white/[0.06]` separators between logical groups: [Timecode] | [Maximize + NightMode] | [⌘K] | [LIVE + ARM + E-STOP] | [HW dots] | [Logout]
- Increase E-STOP border radius to `rounded-xl` for visual weight
- Remove `animate-pulse-subtle` from E-STOP (distracting in design mode — pulse only in ARMED state)

### 6. Timeline collapse button refinement
The collapse toggle (line 676-683) sits half outside the timeline div. Add a subtle tooltip and increase the hit area to 44px width for confident clicking.

## Files to Change

| File | Changes |
|------|---------|
| `src/pages/Index.tsx` | Remove duplicate PerformanceHUD; fix NavControls positioning; replace emoji with Lucide icons; enable F key shortcut; widen timeline toggle hit area |
| `src/components/editor/Toolbar.tsx` | Add separator dividers between right-side groups; refine E-STOP styling |

