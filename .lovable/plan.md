

# Refined Plan: Finale 3D Identical Angle System — Gaps Identified & Fixed

## Gaps Found in Current Plan

After cross-referencing the Finale 3D documentation (coordinate system, script columns, video reference) against the existing code, these gaps exist:

### Gap 1: Euler Rotation Order is WRONG
The Finale docs specify: **Pitch (X) → Roll (Z) → Heading (Y)** (Table 1 in docs). The current `PositionPins.tsx` applies only `rotation={[0, -heading * PI/180, 0]}` — it ignores pitch and roll for the mortar icon orientation entirely. The `PyroLaunchAngle.tsx` gizmo computes direction correctly but the *actual 3D model* doesn't rotate with pitch/roll. This is a critical fidelity gap.

### Gap 2: Pan/Tilt/Spin vs Heading/Pitch/Roll Confusion
The Finale docs are explicit: **Heading/Pitch/Roll are POSITION-level** (rack orientation), while **Pan/Tilt/Spin are EFFECT-level** (relative to position). Pan/Tilt/Spin use a DIFFERENT Euler convention: Pan(Y) → Tilt(X-after-Pan) → Spin(Y-after-Tilt). The plan mentions this but doesn't specify the correct composition math. The `SkyCanvas.tsx` (4106 lines) needs to compose: `Position(H/P/R) * Effect(Pan/Tilt/Spin)` for each rendered effect.

### Gap 3: No Always-On Direction Line
Currently the direction arrow (cone at line 491-496 of PositionPins.tsx) is always visible but it's just a small cone. Finale shows a **long thin line** from every position indicating launch direction at all times. The plan mentions this but it needs to be more specific: the line should use the FULL Euler rotation to show the actual launch vector, not just heading.

### Gap 4: "Rotate (around position's up vector)" Missing
The Finale docs describe a 4th rotation mode for wall-mounted positions. The current context menu only has H/P/R. Need to add "Rotate (around up vector)" which rotates around the position's local Y-axis after all rotations are applied.

### Gap 5: "Move on axis..." Missing  
Finale's right-click menu includes "Move on axis..." which shows 3 colored arrows (local XYZ) for dragging positions along their local frame. Not in current plan.

### Gap 6: Rotation Wheel Visual Missing
The plan says "right-click rotation wheel" but current implementation just uses free-drag on the handle sphere. Finale shows an actual **circular wheel** on the ground plane (for heading) or vertical plane (for pitch) with the position's arrow draggable around it. Current `HeadingCompass` is close but the draggable interaction is on the handle, not on the compass ring itself.

### Gap 7: Angles* Column in Script Window
Finale has an `Angles*` column that shows ASCII art angle indicators like `\|/` for groups. Not in ScriptWindow currently.

### Gap 8: Pitch/Roll Read-Only Derived Columns
In Finale, `Pitch` and `Roll` in the script are READ-ONLY fields derived from Pan/Tilt. They show the forward/back and side-to-side components. The plan has Pan/Tilt/Spin as editable (correct) but doesn't mention the derived Pitch/Roll display columns.

---

## Updated Changes

### 1. `src/components/editor/PositionPins.tsx` — Fix Euler Rotation + Always-On Line

**Rotation fix**: Apply full Finale Euler order to mortar icon: Pitch(X) → Roll(Z) → Heading(Y).
```
<group rotation={[pitch * PI/180, -heading * PI/180, roll * PI/180]} euler order="YZX">
```

**Always-on direction line**: Add a `<Line>` from `[0,0,0]` to `[dx, dy, dz]` computed from full H/P/R Euler rotation applied to the up vector `[0, 1, 0]`. Length 2 units unselected (opacity 0.15), 3 units selected (opacity 0.7), colored by type.

### 2. `src/components/editor/PyroLaunchAngle.tsx` — Rotation Wheel + Solid Trajectory

**Rotation wheel**: Make the `HeadingCompass` ring itself draggable (not just the handle). When in heading-constrained mode, clicking/dragging on the compass ring rotates heading. Add similar vertical ring for pitch mode.

**Solid trajectory**: Change trajectory `Line` from `dashed` to solid, increase lineWidth to 2, add gradient opacity. Add burst point marker (small diamond mesh) at `trajectoryData.apexPoint`.

**"Around up vector" mode**: Add 4th drag axis mode `'up-vector'` — computes the position's local up vector after H/P/R rotations and constrains drag around that axis.

### 3. `src/components/editor/PositionContextMenu.tsx` — Add Missing Menu Items

Add these Finale right-click items:
- "Rotate (around up vector)" — emits axis mode `'up-vector'`
- "Move on axis..." — emits a new mode that shows 3 colored arrows for local XYZ translation
- Separator before rotation commands for clearer grouping

### 4. `src/store/useProjectStore.ts` — Verify Pan/Tilt/Spin

Already has `pan`, `tilt`, `spin` on `TimelineItem` (lines 68-70). No store change needed.

### 5. `src/components/editor/ScriptWindow.tsx` — Pan/Tilt/Spin + Angles* Columns

Add editable columns:
- **Pan** — editable, default 90 for shells, 0 for DMX (per Finale docs: "shells typically have Pan of 90")
- **Tilt** — editable, default 0
- **Spin** — editable, default 0
- **Angles*** — read-only, ASCII art `\|/` representation of angles for grouped items
- **Pitch** (derived) — read-only, computed from Pan+Tilt
- **Roll** (derived) — read-only, computed from Pan+Tilt

### 6. `src/components/editor/SkyCanvas.tsx` — Compose Effect Orientation

When rendering effects, compute final world orientation:
1. Position rotation: Pitch(X) → Roll(Z) → Heading(Y)
2. Effect rotation: Pan(Y) → Tilt(X-rotated-by-Pan) → Spin(Y-rotated)
3. Final = Position quaternion × Effect quaternion

Apply to effect group transform in the rendering loop.

### 7. `src/components/editor/PositionPins.tsx` — Enhanced Glow (from previous plan)

Keep the LinkedGlowRing with shockwave + particles (already implemented). Ensure it shows when `hasLinkedGlow` is true regardless of `isSelected` state.

## Files

| File | Change |
|------|--------|
| `src/components/editor/PositionPins.tsx` | Fix Euler order, always-on direction line, glow visibility |
| `src/components/editor/PyroLaunchAngle.tsx` | Draggable rotation wheel, solid trajectory, burst marker, up-vector mode |
| `src/components/editor/PositionContextMenu.tsx` | Add "Rotate (around up vector)", "Move on axis..." |
| `src/components/editor/ScriptWindow.tsx` | Pan/Tilt/Spin editable cols, Angles* ASCII art col |
| `src/components/editor/SkyCanvas.tsx` | Compose Position H/P/R + Effect P/T/S for rendering |

