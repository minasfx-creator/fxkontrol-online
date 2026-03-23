

## Fix: Command Center Dashboard — Module Navigation and Old Cards

### Problems Identified

1. **Two old module cards (FXK-PYRO, FXK-DMX) appear on top** — The mobile portrait view starts with `mobileCategory = 0` (Exec), so it always shows execution loadout cards even when the active console is SHOW CTRL (which belongs to category 1/Monitor).

2. **Modules don't open when clicked** — The `handleModeChange` function (line 141) returns early if `bootConsole` is still set. On initial load, `bootConsole` is set to `show_control`, and if the boot sequence hasn't completed, all clicks are blocked. Additionally, the boot animation adds ~1 second of delay before the console becomes interactive.

3. **Mobile category mismatch** — When navigating to a console in a different category, the bottom nav category doesn't sync, so the loadout cards still show the wrong set.

### Plan

**File: `src/pages/CommandCenter.tsx`**

1. **Sync `mobileCategory` to active mode** — Derive the initial `mobileCategory` from `initialMode` so if