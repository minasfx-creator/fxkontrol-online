# FireOne Field Module — Quick Start (extract)

Source: `Modules_1-2.pdf` shipped by the user (FireOne Field Module Quick Start
Guide + Users Guide cover). Captured 2026-05-13 for traceability.

This document carries **specs only** — no operational adapter is implied.

## Hardware constants

| Spec | Value |
|---|---|
| Pyrotechnics outputs per module | **32 cues** |
| Output voltage | 24 V (current-limited) |
| Output current limit | 5 A per cue |
| Typical e-matches in parallel | 5 |
| Typical e-matches in series | 10 |
| Max modules per Control Panel **output** | **20** (≠ 99 module-address space) |
| Wired link | FireOne 2-Wire (parallel) |
| DMX connector | LEMO 5-pin (pins 1/2/3 standard DMX, 4/5 reserved for firmware upgrade) |
| Wireless antenna connector | TNC |
| Min wire gauge | 18 AWG / 1 mm² |

## LCD

- **2-Wire module**: shows `ON/OFF` + `DMX` (flashes when sending DMX data)
- **Wireless module**: shows `ON/OFF` + battery (4 bars max, top-left) + RSSI (5 bars max, top-right)

> **Conflict with UltraFire User Guide v0.9.8**: that document quotes
> 5 battery bars + 6 RSSI bars. Field module quick-start (this doc) quotes
> 4 + 5. Field module value is canonical for *Field Modules*; UltraFire
> values apply to *transceivers/control panels*.

## Address rules

- Address space `01..99` per module (LCD-set)
- Address change blocked while Fire Power is ON (key switch)
- Module remembers last address through power loss
- COM LED flashes yellow on each command received

## Troubleshooting checklist (verbatim)

- LCD blank → battery exhausted (works on panel power)
- DMX absent → DMX disabled in Hardware Configuration
- Insufficient fire power → check wiring length / gauge / modules per output
- Bad e-match continuity → verify rail wiring, address, swap rail with bare wire to test

## Scope

- Specs feed `src/data/fireOneCatalog.ts` / `fireOneFieldModule.ts` (planned).
- No firing protocol is exposed in this PDF.
- All adapters using these constants must carry `provenanceBadge: 'pilot'`
  (constants are official, but our code path is bench-only).
