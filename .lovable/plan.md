

# Plan: Auto-Enter Angle Mode After Effect Spawn + Fix SFX Cue Persistence

## Problems Identified

1. **No angle editing after effect spawn**: When effects are added to positions, the editor stays in `select` mode. Users want it to automatically enter `adjust-angles` mode with the affected positions highlighted, similar to Finale 3D workflow.

2. **SFX cues don't save**: The `timeline_items` table only has `effect_id`, `start_time`, `track_index`, `pos_x/y/z`. Critical fields like `position_id`, `position_name`, and `notes` are NOT persisted — so on reload, SFX cues lose their position link and appear broken.

3. **Batch angle editing**: Already implemented with `A` key toggle. Just needs the auto-trigger after spawn to complete the workflow.

## Changes

### 1. Database Migration — Add Missing Columns to `timeline_items`

Add columns to persist position linkage and metadata:
```sql
ALTER TABLE public.timeline_items 
  ADD COLUMN IF NOT EXISTS position_id TEXT,
  ADD COLUMN IF NOT EXISTS position_name TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT;
```

### 2. `src/hooks/useProjectPersistence.ts` — Save & Load New Fields

**Save** (line ~82-90): Add `position_id`, `position_name`, `notes` to the `tlRows` mapping.

**Load** (line ~156-163): Read back `position_id`, `position_name`, `notes` from loaded data and pass them to `addTimelineItem`.

### 3. `src/components/editor/EffectLibrary.tsx` — Auto-Enter Angle Mode After Add

In both `EffectTableRow` and `EffectCard` `handleAdd` callbacks, after adding timeline items to pyro positions:
- Set `editorMode` to `'adjust-angles'` so gizmos appear immediately
- The positions are already selected (via `selectPosition` or `selectMultiplePositions`), so the angle handles will show on the correct positions

~3 lines added to each handler, after the `toast.success()` call:
```typescript
if (isPyro && targetIds.length > 0) {
  store.setEditorMode('adjust-angles');
}
```

### 4. `src/components/editor/PyroLaunchAngle.tsx` — Show Gizmos for All Pyro in Angle Mode

Currently both branches of `visiblePositions` are identical. Fix:
- In `adjust-angles` mode with NO selection: show gizmos for ALL pyro positions (so user can click any to start adjusting)
- In `adjust-angles` mode with selection: show gizmos only for selected (current behavior)
- Keeps `A` key toggle and batch drag working as-is

## Files

| File | Change |
|------|--------|
| DB migration | Add `position_id`, `position_name`, `notes` to `timeline_items` |
| `src/hooks/useProjectPersistence.ts` | Persist and restore position link fields |
| `src/components/editor/EffectLibrary.tsx` | Auto-enter `adjust-angles` after pyro effect add |
| `src/components/editor/PyroLaunchAngle.tsx` | Show all pyro gizmos when in angle mode with no selection |

