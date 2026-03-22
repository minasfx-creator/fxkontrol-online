

# Plan: Finale 3D UX Parity + FX KONTROL Differentiators — Phase 6

## Summary

After auditing the Finale 3D documentation (keyboard shortcuts, script columns, addressing, effects, position management) against the current FX KONTROL implementation, this plan addresses **missing Finale parity features** and then adds **differentiators** that exceed Finale's capabilities.

## Part A — Finale 3D Parity Gaps

### 1. Keyboard Shortcuts — Full Finale Mapping

**`src/components/editor/Toolbar.tsx`** + **`src/pages/Index.tsx`**

Missing Finale shortcuts from documentation Table 2:
- **C** — Open Effects window with search focused (currently not mapped)
- **W** — Insert effect from effects window (Finale: "Insert effect")
- **Y** — Replace effect (currently not mapped)
- **I** — Insert empty cue at playhead
- **F** — Make into fan (open fan dialog)
- **K** — Mirror angles of selected items
- **S** — Make into sequence (conflicts with current "select mode"; remap select to pointer click)
- **H** — Spread out evenly (spread selected items by duration)
- **M** — Reverse order of selected items
- **Shift+M** — Randomize order
- **D** — Duplicate into pairs
- **Shift+F** — Duplicate into flights
- **Ctrl+H** — Combine as chain
- **G** — Combine as group
- **Ctrl+G** — Create effect by VDL description
- **Ctrl+L** — Add one position
- **Z** — Add racks for show
- **P** — Address show
- **L** — Lock addresses
- **Left/Right Arrow** — Tab between cues on timeline
- **Home/End** — Jump to beginning/end of timeline

### 2. Script Window — Missing Columns

**`src/components/editor/ScriptWindow.tsx`**

Add Finale-standard columns (toggleable via column visibility menu):
- **Address** (fullAddress) — read-only, combines Rail + Pin
- **Devices** (numDevices) — device count per row
- **Flight Count** — items at same time + position
- **Cue Count** — chronological cue number
- **Size** (caliber display as `4"`)
- **Type** (partType: shell/comet/mine/cake)
- **Hazard/Lockout** — risk group assignment
- **Track** — semi-auto firing track assignment
- **Universe** — firing system universe
- **Custom Script Field** — user-defined text

Also add: column visibility toggle menu (gear icon), column reorder by drag, column width resize handles.

### 3. Effects Window — "C" Key Quick Search

**`src/components/editor/EffectLibrary.tsx`**

- When **C** key is pressed, focus the search input and select all text (Finale behavior)
- **Ctrl+Enter** from effects window inserts selected effect at playhead
- **Ctrl+Shift+Enter** replaces selected timeline item's effect
- **Up/Down arrows** navigate effect rows when search is focused
- **Escape** clears selection and closes if auto-opened

### 4. Script Window — Groups & Chain Collapsing

**`src/components/editor/ScriptWindow.tsx`**

- Implement `group` field on TimelineItem — array of group identifiers
- **G** key combines selected items into a group
- Groups collapse into single rows on timeline + script (toggleable)
- Right-click group on timeline → rename, ungroup, edit
- Chain rows show combined Angles* field with ASCII art: `\|/`

### 5. Position Properties — Missing Fields

**`src/store/useProjectStore.ts`** + **`src/components/editor/PositionWindow.tsx`**

Add to Position interface:
- `startModule?: number` — pre-assigned starting module number
- `preAssignedRails?: string` — pre-assigned rail numbers
- `moduleType?: string` — module/slat type
- `universe?: string` — firing system universe
- `customPositionField?: string` — user-defined sort field
- `safetyDistanceMeters?: number` — position-level safety distance
- `excludeFromAddressing?: boolean` — exclude position from receiving addresses

### 6. Timeline — Cue Flags & Track Field Color Mapping

**`src/components/editor/Timeline.tsx`**

- Show cue flags (small triangular markers) above timeline items at Effect Time
- Color cue flags by Track field value (Finale: "Set cue flag color mapping")
- Show prefire as line segment to the left of the effect blip (already partially done, verify)

## Part B — FX KONTROL Differentiators (Beyond Finale)

### 7. AI-Powered Smart Scripting Assistant

**`src/components/editor/SmartScriptAssistant.tsx`** — NEW

A floating assistant (Ctrl+Shift+A) that uses AI to:
- "Add 20 gold willows across positions A1-A20, staggered 200ms apart in a left-to-right sequence" → auto-generates timeline items
- "Replace all red peony shells with blue ones" → batch replace
- "Create a crescendo finale: start with 3" shells every 2s, escalate to 6" every 0.5s over 30 seconds" → programmatic scripting
- Natural language VDL: "big bright red peony with silver pistil" → creates effect

### 8. Live Collaboration Cursors

**`src/components/editor/CollaborationCursors.tsx`** — NEW

Real-time multi-user editing (via Supabase Realtime):
- Show other users' cursor positions on viewport and timeline
- Color-coded user avatars with names
- "User X is editing Position A5" lock indicators
- Voice chat integration indicator

### 9. Smart Safety Validation Engine

**`src/components/editor/SafetyValidationOverlay.tsx`** — NEW

Automatic NFPA 1123 validation that Finale doesn't have:
- Real-time safety distance circles rendered in 3D viewport
- Red zones highlight when audience/structures are within fallout radius
- Auto-suggest position adjustments to resolve safety conflicts
- Generate compliance report with one click
- Wind-adjusted safety calculations using live weather data

### 10. Predictive Timeline Intelligence

**`src/components/editor/TimelineIntelligence.tsx`** — NEW

- Auto-detect gaps in the timeline and suggest fills
- "Dead air" warning markers when no effects fire for >5 seconds
- Music beat analysis → auto-suggest effect placement on beats
- "This section feels sparse compared to the rest" AI suggestions
- One-click "fill this gap with complementary effects"

### 11. Visual Diff for Script Versions

**`src/components/editor/VersionDiff.tsx`** — NEW

Side-by-side script comparison:
- Color-coded additions (green), deletions (red), modifications (yellow)
- Timeline overlay showing changed items
- "Accept/Reject" per-change workflow
- Works with versioning panel already in place

## Files

| File | Change |
|------|--------|
| `src/components/editor/Toolbar.tsx` | Full Finale keyboard shortcut mapping |
| `src/pages/Index.tsx` | Global shortcut handler updates |
| `src/components/editor/ScriptWindow.tsx` | Missing columns, column visibility menu, groups |
| `src/components/editor/EffectLibrary.tsx` | C-key quick search, Ctrl+Enter insert/replace |
| `src/components/editor/Timeline.tsx` | Cue flags, track color mapping, arrow key navigation |
| `src/store/useProjectStore.ts` | Position fields, group system, TimelineItem.group |
| `src/components/editor/PositionWindow.tsx` | New position fields UI |
| `src/components/editor/SmartScriptAssistant.tsx` | NEW — AI scripting assistant |
| `src/components/editor/SafetyValidationOverlay.tsx` | NEW — NFPA auto-validation |
| `src/components/editor/TimelineIntelligence.tsx` | NEW — Predictive timeline gaps/suggestions |
| `src/components/editor/VersionDiff.tsx` | NEW — Visual script version comparison |

## Implementation Priority

**Phase 6A (Finale Parity)**: Items 1-6 — keyboard shortcuts, script columns, effects C-key, groups, position fields, cue flags. This ensures feature parity.

**Phase 6B (Differentiators)**: Items 7-11 — AI assistant, safety validation, timeline intelligence, version diff. These are the competitive advantages.

