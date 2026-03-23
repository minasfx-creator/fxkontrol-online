

## Field Test Enhancement — Complete Field Testing Tool

### Current State

- **FXK-PYRO card**: Only shows as shortcut when `mobileCategory !== 0` (lines 406-423). When already on Exec (cat 0), it's part of the normal loadout — correct behavior.
- **FIELD TEST card**: Always visible in all categories (lines 391-404) — working correctly.
- **BLE Scanner**: Basic single-device scan via browser picker, no multi-device visibility or controller discovery.

### Issues to Fix

1. **FXK-PYRO on category 0**: The card IS there as part of `allMobileModes` (Exec section includes `pyro_fire`), so it already shows. The shortcut only adds for categories 1/2. This is correct — no