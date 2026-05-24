# VDL — `AND` vs `+` vs `&` vs `With`

> Source: Finale 3D VDL Documentation, *“The difference between AND, PLUS, and AMPERSAND”* (last updated 2023-09-12).

VDL distinguishes four conjunction-like terms that English (and other natural languages) often blur together. Getting them right is what lets one unambiguous string represent a complex multi-color, multi-shot, multi-component effect.

## Table

| Term | Meaning | Example |
|------|---------|---------|
| **`AND`** | **Not a VDL term.** Software is free to interpret as `+`, `&`, or `With` based on context. | `Red And Blue Peony` |
| **`+`** | Combines **shots** of a cake, candle, or chain whose shots are *not all the same*. | `Red Comet + Gold Comet Cake` |
| **`&`** | Combines the **colors of a single multi-color effect** (one shell, several star colors). | `Red & Blue Peony` |
| **`With`** | Combines an effect with an **added mine / petal / tail / mixed-in stars**. | `Gold Comet With Red Mine` |

### Why `AND` has no canonical meaning

Existing inventories use *And* with conflicting intents. Forcing a single VDL meaning would mis-render a large slice of real-world libraries. By leaving `AND` unbound, software (incl. our parser) is allowed to pick the smartest interpretation per phrase — usually treating it as `+`, `&`, or `With` based on the surrounding tokens.

If you don’t like the guess, **rewrite `AND` as `+`, `&`, or `With`** — those three are deterministic.

## `+` — different shots in the same item

```
20 Shot Red Peony + Blue Peony Cake
Red + White + Blue Chain Of 6
8 Shot Red Comet + Blue Comet Roman Candle
```

Each `+` introduces a distinct shot type. Counts / firing order are not implied — see VDL Firing Patterns and Cake Segments docs to specify those.

## `&` — multi-color single effect

```
Red & White & Blue Chain Of 6
```

Compare with the `+` chain above: this one is *six identical* tri-color shells, each one carrying red, white, and blue stars together.

In our parser this populates `VDLResult.multiColors: string[][]` (one group of hex colors per `&`-separated chunk).

## `With` — adds a mine / petal / tail / mixed stars

```
Gold Comet With Blue Mine
Gold Palm With Red Ring
Gold Kamuro With Tail
Gold Chrysanthemum With Blue
```

Disambiguation:

- **Mine / Bouquet** word present → adds a *mine layer* (loose stars rising from the muzzle under the shell).
- **Shape word** present (Palm, Ring, Crown, Peony, Dahlia, Chrysanthemum, Willow, Kamuro, Horsetail, Crossette, Brocade, Spider, Flower) → adds a *petal*.
- **Tail / Glitter / Strobe / Crackle / Twinkle / Flicker** → adds a *trail-style component* mixed into the rising tail or stars.
- Otherwise (just a color or generic descriptor) → adds *mixed-in stars* of that description.

In our parser this populates `VDLResult.withModifiers: WithModifier[]`, one entry per `With …` (or `w/ …`) clause. The pre-existing `w/ <color> pistil` parsing is unchanged and consumes its own pistil clauses.

## Parser surface (this repo)

```ts
type WithModifierKind = 'mine' | 'bouquet' | 'petal' | 'tail' | 'mixedStars';

interface WithModifier {
  kind: WithModifierKind;
  shape?: string;      // for petal kind
  color?: string;      // hex if a named color was found in the clause
  colorName?: string;  // canonical lowercase name
  raw: string;         // original clause text
}
```

- `&` continues to feed `multiColors`.
- `+` continues to feed `cakeSegments` / `chainEffects`.
- `With` now feeds `withModifiers` (pistil `with` clauses are still routed to `hasPistil` / `pistilColor`).
- `AND` is **never** matched by VDL terms — it is left as natural-language filler.

## Renderer wiring

Out of scope for this round. Future work:
- `withModifiers[kind='mine']` → spawn additional `MineEffect` co-timed with the parent shell.
- `withModifiers[kind='petal']` → spawn a secondary burst layer using `shape` as the silhouette.
- `withModifiers[kind='tail']` → upgrade `trailType` of the parent burst (glitter/strobe/etc.).
- `withModifiers[kind='mixedStars']` → append `color` to the star palette of the parent burst at reduced weight.
