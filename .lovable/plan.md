# Plan — `wiring_a4.svg` (A4 side-by-side print layout)

Provide a second wiring diagram tailored for **A4 paper printing**, while keeping the **exact same canonical v1.3 mapping** already enforced by `firmware/fxk16-esp32s3/src/fxk16_pinmap.h`. The first `wiring.svg` (landscape, wide) stays untouched.

## Goals

- Fit cleanly on A4 portrait (210×297 mm) with 10 mm safe margins.
- "Lado a lado" arrangement: ESP32-S3 card on the left, 16-relay board on the right, both at the same vertical scale, so each `GPIO → IN<n>` wire is a short horizontal trace.
- Print legibly in black & white (line weights + labels), color used only as accent.
- Reuse the v1.3 mapping verbatim — no hardware contract changes.

## Canonical mapping (must match firmware)

```text
C1→GPIO4 →IN1     C9 →GPIO17→IN9
C2→GPIO5 →IN2     C10→GPIO18→IN10
C3→GPIO6 →IN3     C11→GPIO8 →IN11
C4→GPIO7 →IN4     C12→GPIO9 →IN12
C5→GPIO15→IN5     C13→GPIO10→IN13
C6→GPIO16→IN6     C14→GPIO11→IN14
C7→GPIO35→IN7     C15→GPIO12→IN15
C8→GPIO36→IN8     C16→GPIO13→IN16
```

Source pulled from `fxk16_pinmap.h::CHANNEL_MAP[]` — single source of truth (matches existing `PINMAP.md` and the first wiring SVG).

## Layout (A4 portrait)

```text
+---------------------- 210 × 297 mm ----------------------+
| Title: FXK16 Wiring — A4 Print (v1.3 canonical)          |
|                                                          |
|  +-------------------+        +-------------------+      |
|  |  ESP32-S3 v1.3    |        |  16-Relay Board   |      |
|  |  (left column)    |        |  (right column)   |      |
|  |  GPIO4   ●--------|--------|--● IN1            |      |
|  |  GPIO5   ●--------|--------|--● IN2            |      |
|  |  ...     ●--------|--------|--● ...            |      |
|  |  GPIO13  ●--------|--------|--● IN16           |      |
|  |  +5V/GND ●========|========|==● VCC/GND        |      |
|  +-------------------+        +-------------------+      |
|                                                          |
|  Legend:  signal ── (active-LOW)   power ══   gnd ──     |
|  Footer: pinmap source = fxk16_pinmap.h v1.3             |
+----------------------------------------------------------+
```

- Both modules drawn as vertical strips; channel rows aligned 1:1 so wires are straight horizontal segments (no gutter routing needed — that's the whole point of the A4 layout).
- Aux pins (ESTOP GPIO14, jumper GPIO21, LED GPIO48, USB-CDC) placed in a small reserved block under the ESP32 card with a "do not wire to relay inputs" note.
- Compact mapping table omitted (the rows themselves are the table) — saves space for A4.

## Files

- **`firmware/fxk16-esp32s3/docs/wiring_a4.svg`** — new file. SVG with `width="210mm" height="297mm" viewBox="0 0 210 297"` (mm units) so it prints true-to-size from any browser/PDF tool with "Actual size".
- **`firmware/fxk16-esp32s3/docs/PINMAP.md`** — append a short "Print layouts" section linking both diagrams:
  - `wiring.svg` — landscape bench reference
  - `wiring_a4.svg` — A4 portrait, print-ready
- **`/mnt/documents/wiring_a4.svg`** — copy for immediate user download/preview.

## Generation approach (technical)

- One-shot Python script in `/tmp/` (not committed) that emits the SVG procedurally from a single `CHANNELS` list mirroring `CHANNEL_MAP[]`.
- Use `mm` units throughout; constants for margins (10 mm), card width (~70 mm), row pitch (≈11 mm for 16 rows + headers within the printable height).
- Stroke widths ≥ 0.35 mm so traces survive B&W laser printing.
- Font: `Inter, system-ui, sans-serif` with explicit `font-size` in mm; channel labels bold, GPIO numbers monospace-styled via `font-family="ui-monospace, monospace"`.
- Color accents (kept minimal for B&W friendliness):
  - Signal traces: `#111827` (near-black)
  - +5V rail: `#b91c1c` (red), GND: `#111827` with double-line style
  - Active-LOW indicator: small open circle at the relay end of each signal trace
- Post-generation QA: rasterize the SVG to PNG at 150 DPI and inspect to confirm no row collisions, all 16 channels present, labels not clipped at the A4 edges. (QA images are temporary, not delivered.)

## Out of scope

- No changes to `fxk16_pinmap.h`, `fxk16_config.h`, firmware, host adapters, or the existing `wiring.svg`.
- No new build flags or runtime behavior.
