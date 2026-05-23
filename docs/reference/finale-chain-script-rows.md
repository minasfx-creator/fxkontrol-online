# Finale 3D — Representation of Chains in the Script

Source: Finale 3D docs, "Effects Overview — Programmer documentation: Representation of chains in the script" (last updated 2022-06-05).

## Canonical rule

**A chain of N devices is represented by N rows in the script**, one row per device, regardless of the "Show chains as one row" display setting (gear menu of the Script window).

Rows belonging to the same chain are linked by sharing the same reference number in the **`Chain`** column. The presence of a value in `Chain` is also what determines whether a row is part of a chain at all.

- Two chains of 10 → 20 script rows total, 10 with `Chain=#1`, 10 with `Chain=#2`.
- The Finale Generic CSV format supports the `Chain` column. Most other script formats do not, so a chain is collapsed to a single row in those formats; the importer expands it back to N rows and auto-assigns chain reference numbers.
- The `Quantity` column in third-party formats may mean "number of chains" or "number of devices" — interpretation is format-specific.

## Special columns on chain rows

| Column | Behavior on chain rows |
|---|---|
| `Duration` | **Editable per row.** Filled with the specified or default duration of the *device effect*, NOT the chain's first-to-last-launch duration. (For non-chain rows, `Duration` is otherwise read-only and references the effect definition, unless the effect type is `other_effect` or `not_an_effect`.) |
| `Chain Device VDL` | Usually hidden. The per-device VDL, which can differ between rows of the same chain. Example: chain `"Red Peony + Blue Peony + Green Peony Chain of 3"` → device VDLs `Red Peony`, `Blue Peony`, `Green Peony` (chain VDL is the full description, the same on all 3 rows). |
| `Prefire` | Decoupled from the chain definition after insertion. |

After insertion, `Duration`, `Chain Device VDL`, `Prefire`, and the number of devices are **decoupled** from the chain definition. `Edit simulation` in the Effects window changes the original definition but does not retro-edit script rows for these decoupled fields.

## `Used` column in the Effects window

Controlled by `File > User settings > Display chain 'Used' quantity as per-shell`:

- **Checked (per-shell)**: `Used = number of device rows in the script with this part number`.
- **Unchecked (per-chain)**: `Used = device rows ÷ effect.Devices`, where `Devices` blank or `0` is treated as `1`.
- The chain quantity that appears in `Description` or `VDL` does **not** affect `Used`. Only the `Devices` field of the effect does.

## Parser scope (FX-Kontrol)

The VDL parser at `src/lib/vdlParser.ts` handles **chain VDL strings** (the textual description seen on a chain row). It does **not** materialise script rows — script-level expansion (1 row per device, auto-numbered `Chain` references, decoupled `Duration` / `Chain Device VDL`) is an importer-level concern.

What the parser exposes per `Chain` parse:

- `isChain: boolean` — true when the token `Chain` appears.
- `chainCount: number` — explicit `Chain Of N` if present, else inferred from `+`-separated parts, else **default 10**.
- `chainEffects: string[]` — per-device VDLs split on `+`, trimmed.
- `chainDelays: number[]` — `CDS` (Chain Device Spacing) values between successive devices.

Tests pinning this behavior live at `src/lib/__tests__/vdlChainsCoverage.spec.ts`.
