# VDL — PFT, LFT and Delay Default (aerial shell cake prefire)

> **Source:** Finale 3D VDL Documentation — "Creating an aerial shell cake
> with arbitrary prefire time" (last updated Sep 12, 2023).
>
> **Status:** documentation-only. `vdlParser.ts` already implements the
> full PFT/LFT precedence below. No code changes required.

## Terms

| Term  | Unit | Meaning                                                     |
|-------|------|-------------------------------------------------------------|
| `PFT` | s    | Prefire time of the effect (or the **first** shot of a cake) |
| `LFT` | s    | Explicit lift time of a shell (overrides PFT for lift)      |
| `DLY` | s    | Delay before simulation (auto-derived when `PFT < 0.5`)     |

`Delay Default` / `Delay` (script column `externalDelay`) is **not** a VDL
term. It is a Finale 3D **column-level** field used for physical fuse
delays (e.g. Pyro-Clock, Visco). It is parallel to VDL — applied on the
script row, not on the VDL string.

## Behaviour matrix (aerial shells)

| Condition          | Lift time      | Sim offset before lift | Choreographer mark |
|--------------------|----------------|------------------------|--------------------|
| `PFT < 0.5`        | engine default | `+PFT` (delay)         | ignition + PFT     |
| `PFT >= 0.5`       | **= PFT**      | 0                      | ignition + PFT     |
| `PFT >= 0.5` + LFT | **= LFT**      | 0                      | ignition + PFT     |

The third row is the "GOOD ANSWER" from the spec: prefire still drives the
choreographer's effect-time blip on the timeline, but the explicit LFT
takes precedence over PFT for the **simulated** lift time.

### Example (spec verbatim)

```text
1" 2.0s 10 Shot 1.75 PFT FNR Cake Blue Peony 1.50 LFT
```

* `1.75 PFT` → choreographer mark sits 1.75 s after ignition.
* `1.50 LFT` → simulated lift time is 1.50 s (overrides PFT for lift).
* Net effect: visual break occurs 1.50 s after ignition; the choreographer
  syncs to a moment 0.25 s **after** the break, giving stars time to bloom.

## `Delay Default` (Finale 3D column, NOT a VDL term)

Use Delay Default instead of PFT when the delay is physical (external
fuse, Pyro-Clock, Visco) rather than internal to the shell:

* Shown in the Effects window as **Delay Default**.
* Copied into the script row as **Delay** (internal name `externalDelay`).
* Editable per row in the script — different occurrences of the same
  effect can have different physical fuse lengths.
* Reveal the column via the blue gear menu (effects window and script).

Operationally, in this codebase, `externalDelay` belongs to the
**ShowPlan cue**, not to the VDL result. Treat it as additive to PFT/LFT
when projecting ignition → first visible effect on the timeline:

```text
visualEffectTime = cue.startTime
                 + cue.externalDelay   // physical fuse / Pyro-Clock
                 + result.prefire      // PFT or its < 0.5 delay form
                 - (result.liftTime >= 0 ? 0 : 0)
                 // Note: when LFT > 0 it replaces PFT in the *lift*
                 // calculation; PFT still anchors the timeline mark.
```

## Current parser coverage (`src/lib/vdlParser.ts`)

The PFT/LFT branching is implemented at parse time:

```ts
const pftMatch = raw.match(PFT_REGEX);
if (pftMatch) {
  const pft = parseFloat(pftMatch[1]);
  if (pft < 0.5) {
    result.delayBefore = pft;       // small delay, default lift time stays
  } else {
    result.prefire    = pft;        // choreographer mark
    result.liftTime   = pft;        // and lift time (overridable by LFT)
  }
}
const lftMatch = raw.match(LFT_REGEX);
if (lftMatch) result.liftTime = parseFloat(lftMatch[1]); // wins over PFT
```

`result.delayBefore`, `result.prefire`, `result.liftTime` are the
canonical fields downstream consumers (ShowPlan compiler, renderer,
verification engine) must read. `externalDelay` is intentionally **not**
on `VDLResult` — it lives on the cue row in ShowPlan.

## Non-goals

* No new VDL token; no parser change.
* No automatic conversion of `Delay Default` into PFT — they are
  semantically different (internal vs external fuse) and must remain so
  to preserve the Reliability Engineering invariant
  (simulation = execution = reality).
