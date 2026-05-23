# Finale 3D — What Happens When a Chain Is Inserted into the Script

Source: Finale 3D docs, "Effects Overview — Programmer documentation: What happens when I insert a chain into the script?" (last updated 2022-06-05).

Companion to [`finale-chain-script-rows.md`](./finale-chain-script-rows.md), which covers the *representation* of chains once inserted. This doc covers the *insertion mechanics*.

## Canonical rules

1. **One row in the Effects window → N rows in the script.**
   A chain is a single row in the Effects window but expands to one row per device on insert. Expansion only happens for chains, identified by the word `Chain` in the VDL column.

2. **`Devices` column wins — VDL/Description chain counts are ignored.**
   The number of expanded rows equals the chain effect's **`Devices`** column, regardless of what `Description` or `VDL` says. A `Chain of 5` with `Devices=1` inserts exactly **one** device row.

3. **Per-show effects copy-on-insert (match by Part Number).**
   Inserting an effect copies its definition (one row) from the source collection into the show-local **Per-show effects** table:
   - **Same part number present** → overwrite.
   - **Part number absent** → append.
   All script rows reference the same Per-show effects row for shared attributes (e.g. `Description`).

4. **Decoupled per-row attributes are computed on insert.**
   `Duration`, `Devices`, `Chain Device VDL`, `Prefire` are filled in automatically on the script rows, because the chain-level value would be wrong for the individual devices. After insert, these attributes are decoupled from the Per-show effects row (see `finale-chain-script-rows.md`).

5. **Missing-field auto-derivation (chains and non-chains).**
   If the source effects list lacks fields like `Part Type`, Finale 3D derives them from what is present (e.g. from `Description` or `VDL`). The **modified** definition — with the derived fields filled in — is what lands in Per-show effects.

## Implication for FX-Kontrol importers

Any importer that materialises a Finale-style script from an effect collection must:

| Step | Behavior |
|---|---|
| Resolve chain row count | Read from `effect.Devices`; ignore `Chain of N` in VDL/Description for row count. |
| Upsert Per-show effects | Match on Part Number. Replace existing row or append. |
| Fill missing columns | Derive `Part Type` (and similar) from VDL/Description before upsert. |
| Compute per-row fields | Set `Duration`, `Devices` (per-row = 1), `Chain Device VDL`, `Prefire` per device. |
| Assign Chain reference | Allocate a single `Chain` reference number shared by all N rows of one chain. |

Script-row materialisation is **not** currently implemented in `src/lib/vdlParser.ts`. The parser exposes the description-level chain hints (`isChain`, `chainCount`, `chainEffects`, `chainDelays`), and per `finale-chain-script-rows.md`, `chainCount` from the VDL is a *hint* — the authoritative count for insertion is `effect.Devices`.
