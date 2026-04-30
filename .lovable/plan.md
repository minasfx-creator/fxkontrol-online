## Goal

Refactor the Studio (`/`, `Index.tsx`) chrome per the annotated mockup, **reusing existing modules**. No new business logic — only layout, mounting and visual refinement.

## Mockup decode

```text
┌─────────────────────────────────────────────────────────────────┐
│ [FXK] [☰ Master Menu — NEW, top-center floating]   [Studio ▼ ]  │  ← "Studio" floats top-right
│       (access to all areas/functions, glassmorphic)             │
│                                                                 │
│   (viewport always black, no fixed left rail, no fixed right)   │
│                                                                 │
│        ┌──── Floating category dock (PYRO/DRONE/LIGHT/DMX) ──┐  │
│        │  Glassmorphic, retractable, replaces PanelTabBar    │  │
│        └─────────────────────────────────────────────────────┘  │
│                                                                 │
│                                              ╭─────────╮        │
│                                              │ Avatar  │ ← float│
│                                              ╰─────────╯        │
├─────────────────────────────────────────────────────────────────┤
│  Timeline (refined UX)                                          │
└─────────────────────────────────────────────────────────────────┘
```

## Scope (MVP)

1. **Master Menu (top-center, NEW shell, reuses existing panels)**
2. **Float the Studio mode-switcher** (top-right) over the viewport
3. **Remove the fixed right `PanelTabBar` rail**; replace with the existing `ViewportSegmentToolbar` (PYRO/SFX/DRONES/LIGHT/DMX) re-skinned as a floating, retractable, glassmorphic dock on the right edge
4. **Floating user avatar** (bottom-right, above timeline)
5. **Timeline UX refinement** (visual polish, no behavior change)

## What to build / change

### 1. `MasterMenu` — new top-center floating component
- File: `src/components/editor/MasterMenu.tsx` (new)
- A glassmorphic pill that opens a command-palette style overlay listing every entry currently in `PanelTabBar` (`PanelId` union — already exhaustive: ~80 panels grouped in `RAW_PANEL_SECTIONS`).
- Reuse the existing `RAW_PANEL_SECTIONS` array from `PanelTabBar.tsx` by **extracting it to** `src/components/editor/panelSections.ts` (pure data, no new logic). Both `PanelTabBar` (kept for mobile/legacy) and `MasterMenu` import from the same source — no duplication.
- Click an item → calls the same `handleTogglePanel(id)` already wired in `Index.tsx`. The existing right-side floating panel renderer (`Layer 3` at `Index.tsx:743`) shows the panel — no change to panel rendering.
- Keyboard: `⌘K` / `Ctrl+K` opens it, `Esc` closes, type-to-filter.
- Mounted in `Index.tsx` `Layer 1` next to `Toolbar`.

### 2. Floating Studio mode-switcher
- The "Studio ▼" pill currently lives inside `Toolbar.tsx` (top-right cluster). Lift it into a small `<StudioModeFloat />` rendered absolutely at `top-2 right-3 z-50` in `Index.tsx`, outside the `Toolbar` flow.
- Implementation: extract the existing JSX block from `Toolbar.tsx` (the "Studio/Office/Field/Command" mode dropdown) into `src/components/editor/StudioModeFloat.tsx`. Keep using the same router navigation handlers.
- Visual: black glassmorphic background (`bg-[#050810]/85 backdrop-blur border border-cyan-500/25`), Vantablack palette per memory.

### 3. Right rail → floating category dock
- Remove the fixed `PanelTabBar` mount at `Index.tsx:737-741` (Layer 2) on **desktop** (keep on mobile via `useIsMobile()` guard so the mobile UnifiedPanelMenu path is untouched).
- Promote `ViewportSegmentToolbar` (`src/features/viewport-tools/components/ViewportSegmentToolbar.tsx`) to a **right-edge vertical floating dock**:
  - New prop `orientation?: 'horizontal' | 'vertical-right'` (default keeps current horizontal top-center for backward compatibility in `ShowEngineHost`).
  - When `vertical-right`: renders as a thin vertical pill on `right-3 top-1/2 -translate-y-1/2`, each segment becomes a 36×36 glass icon. Click expands a horizontally-attached `ViewportToolPanel` overlay (already exists).
  - The dock is **retractable**: a tiny chevron collapses it to a 24px hover-strip.
- Remove the duplicate horizontal mount inside `ShowEngineHost` for the `/` route (or keep it conditional via prop) — the new vertical version takes over on desktop. Mobile keeps horizontal.
- The Floating Panel layer (`Index.tsx:743`) still renders panels triggered by Master Menu; the segment dock instead surfaces **viewport tools** (selection / formations / mirror / time-offset / configure-effect / configure-drone) — exactly what the mockup labels "ferramentas existentes divididas por categoria".

### 4. Floating user avatar
- File: `src/components/editor/UserAvatarFloat.tsx` (new)
- Reads from existing `useProfile()` hook (already in `src/hooks/useProfile.tsx`).
- 56×56 round glass card at `bottom-[calc(var(--timeline-h)+12px)] right-3 z-40`. Click opens a small popover with: profile name, role, sign-out (reuse `useAuth().signOut`), settings shortcut.
- No new auth logic.

### 5. Timeline UX refinement (visual only)
- Keep the existing `Timeline` component intact. Refine the host wrapper at `Index.tsx:789-830`:
  - Replace the squared border with the same glassmorphic treatment used by the new dock (rounded-t-xl, cyan inner accent, softer shadow).
  - Move the "Timeline / Reset" pill (line 808) to the **right** edge so it doesn't fight the play-head.
  - Add a 4px hover affordance (cursor: ns-resize) on the top edge to hint resize (keeps existing handler `handleTimelineResize*`).
- Strictly visual; no logic change. No timeline rule violations from `Timeline UX Precision` memory.

### 6. Always-black viewport
- Already mostly enforced by `bg-background` + Vantablack tokens. Audit `Index.tsx:587-680` and remove any `bg-card`/border that introduces gray seams behind the floating chrome (turn them to `bg-transparent` since the chrome is now floating).

## Things explicitly NOT changed
- `useProjectStore`, `ShowPlan`, `CommandBus`, `SafetyStateMachine` — untouched.
- `viewport-tools` registry, plugins, validators, command-dispatcher — untouched. We only add a layout prop to `ViewportSegmentToolbar`.
- Panels themselves (effects, racks, addressing, etc.) — untouched; same toggle handler.
- Mobile shell — gated by `useIsMobile()`; current mobile UI preserved.

## Files

**New**
- `src/components/editor/MasterMenu.tsx`
- `src/components/editor/StudioModeFloat.tsx`
- `src/components/editor/UserAvatarFloat.tsx`
- `src/components/editor/panelSections.ts` (extracted data)

**Edited**
- `src/pages/Index.tsx` — mount the four new floats, hide desktop `PanelTabBar`, polish timeline wrapper.
- `src/components/editor/Toolbar.tsx` — remove the Studio dropdown block (now in `StudioModeFloat`).
- `src/components/editor/PanelTabBar.tsx` — import `RAW_PANEL_SECTIONS` from the new `panelSections.ts` (no behavior change; mobile keeps using it).
- `src/features/viewport-tools/components/ViewportSegmentToolbar.tsx` — add `orientation` prop + vertical-right layout + retract chevron.
- `src/components/show-engine/ShowEngineHost.tsx` — accept/forward `orientation` so desktop renders vertical-right and mobile stays horizontal.

## Acceptance

- Top of viewport shows: `[FXK] … [Master Menu pill] … [Studio ▼ float]` over a fully black canvas, no gray top bar artifacts.
- The fixed right strip with stacked icons is gone on desktop; in its place, a thin glass dock with PYRO/SFX/DRONES/LIGHT/DMX, retractable.
- `⌘K` opens Master Menu; selecting any panel opens it in the existing right-side floating panel area.
- Bottom-right shows a circular avatar float; click reveals profile/sign-out.
- Timeline still works identically (drag, scrub, resize, collapse) and looks like a single rounded glass slab.
- Mobile (`useIsMobile()`): unchanged behavior; tab bar + UnifiedPanelMenu still work.
- No changes to ShowPlan / CommandBus / Safety paths.
