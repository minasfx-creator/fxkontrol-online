# FXK16 — Channel ↔ GPIO ↔ Relay Terminal Map

**Hardware:** ESP32-S3 v1.3 (YD-ESP32-S3 N16R8) + 16-channel relay board (active-LOW)
**Source of truth:** `firmware/fxk16-esp32s3/src/fxk16_pinmap.h` (`CHANNEL_MAP[]`)

> ⚠️ The table below is generated to match the firmware. If you rewire the
> bench, update `CHANNEL_MAP[]` and re-publish this doc in the same commit.
> A `static_assert` in `fxk16_pinmap.h` will fail the build if the runtime
> `RELAY_PINS[]` array drifts from this map.

## 1-to-1 binding

Each app channel `C<N>` drives exactly one ESP32-S3 GPIO, which drives
exactly one relay input `IN<N>` on the relay board. No multiplexing, no
shift registers, no shared lines.

| App channel | ESP32-S3 GPIO | Relay terminal | Notes                       |
|:-----------:|:-------------:|:--------------:|:----------------------------|
| C1          | GPIO 4        | IN1            |                             |
| C2          | GPIO 5        | IN2            |                             |
| C3          | GPIO 6        | IN3            |                             |
| C4          | GPIO 7        | IN4            |                             |
| C5          | GPIO 15       | IN5            |                             |
| C6          | GPIO 16       | IN6            |                             |
| C7          | GPIO 35       | IN7            |                             |
| C8          | GPIO 36       | IN8            |                             |
| C9          | GPIO 17       | IN9            |                             |
| C10         | GPIO 18       | IN10           |                             |
| C11         | GPIO 8        | IN11           |                             |
| C12         | GPIO 9        | IN12           |                             |
| C13         | GPIO 10       | IN13           |                             |
| C14         | GPIO 11       | IN14           |                             |
| C15         | GPIO 12       | IN15           |                             |
| C16         | GPIO 13       | IN16           |                             |

## Reserved auxiliary pins (do NOT wire to relay inputs)

| Function           | GPIO   | Mode             |
|:-------------------|:------:|:-----------------|
| ESTOP button       | 14     | INPUT_PULLUP     |
| Unsafe-GPIO jumper | 21     | INPUT_PULLUP     |
| Heartbeat LED      | 48     | OUTPUT (RGB)     |
| USB-CDC D+/D-      | 19/20  | (USB native)     |

## Pins explicitly avoided

`0`, `3`, `45`, `46` — strapping pins (boot-mode sensitive).
`19`, `20` — reserved for USB-OTG.

## Field verification

Send the firmware command **`PINMAP`** over USB-CDC or BLE to dump the
live mapping for audit:

```
PINMAP
→ MAP:1:GPIO4:IN1
  MAP:2:GPIO5:IN2
  ...
  MAP:16:GPIO13:IN16
  OK:PINMAP
```

If any line disagrees with this table, **the firmware wins** — re-pull
the source and re-flash. The host app will reject mismatched
`MODEL`/`CH` tokens during handshake.
