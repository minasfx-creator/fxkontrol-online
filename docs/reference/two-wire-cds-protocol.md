# 2-Wire FireOne CDS — Physical Layer & Protocol Reference

> Status: **pilot** (claim). Bench validation pending. See
> `src/lib/twoWireProtocol.ts` and `src/lib/twoWireTransport.ts` for the
> canonical TS implementation.

## 1 · Physical layer

| Parameter | Value | Notes |
|---|---|---|
| DC bias | 28 V ±10 % | Polarity-agnostic via input bridge in slave |
| Bus current limit | 5 A | Master enforces with foldback |
| Modulation | FSK over bias, half-duplex | Single twisted pair |
| Baud | 9600 (≤ 6.5 km) or 19200 (≤ 2 km) | Trade rate ↔ distance |
| Termination | 120 Ω at both extremes | Mismatch → reflections |
| Wire | 18 AWG twisted pair | Outdoor-rated jacket |
| Galvanic isolation | Required at slave | ISO1500-class, 2.5 kVrms |
| Surge | IEC 61000-4-5 class 4 | TVS bidir + GDT, 4 kV pair↔pair, 6 kV pair↔earth |
| Inrush soft-start | PTC + 100 ms ramp | Cap charge cold-start |
| Operating range | −20 °C … +60 °C | Slave refuses FIRE outside |
| Channel-to-channel isolation | ≥ 500 V | Prevents cross-fire from inductive kick |

## 2 · Frame layout (max **80 bytes**)

```
[PRE 0xAA 0xAA][SYNC 0x7E][ADDR u8][CMD u8][LEN u8][PAYLOAD ≤56B]
[COUNTER u32 LE][HMAC8 8B][CRC16-CCITT LE 2B]
```

- **Anti-replay** — `COUNTER` is monotonic per `(psk, addr)`. Master persists
  it locally; slave tracks last-seen and rejects ≤ value.
- **Anti-tamper** — HMAC-SHA256 over `ADDR..COUNTER`, truncated to 8 bytes.
- **Integrity** — CRC16-CCITT over the entire body + HMAC.

## 3 · Opcodes

| Hex | Name | Direction | Notes |
|---|---|---|---|
| 0x10 | POLL | M→S | Heartbeat, 80 ms slot |
| 0x11 | IDENTIFY | M→S | Returns family + fwVersion + capability bitmask |
| 0x12 | STATUS | M→S | Returns ARM/temp/bias |
| 0x20 | CONTINUITY_REQ | M→S | 30 mA test (NFPA 1126) |
| 0x21 | CONTINUITY_REPLY | S→M | `<50Ω = OK`, `50–200 = WARN`, `>200 = FAIL` |
| 0x30 | ARM | M→S | Latches arm state (auto-disarm watchdog 500 ms) |
| 0x31 | DISARM | M→S | Drops bias caps in ≤ 200 ms |
| 0x40 | FIRE_MASK | M→S | `mask: u32[]` + `tFireMs` |
| 0x50 | E_STOP | M→broadcast | `addr=0`, preempts in ≤ 2 byte-times |
| 0x60 | BUS_RENUMBER | M→S | Operator-assisted addr collision recovery |
| 0x61 | SET_PSK | M→S | Wizard-time only (during /pairing/two-wire) |
| 0x70 | FW_VERSION | M→S | Reports running fw + bootloader |
| 0x71 | TEMP_READ | M→S | °C, used by phase-2 gate |

## 4 · CRC16-CCITT canonical test vectors

Implementation in `src/lib/twoWireProtocol.ts` (`crc16Ccitt` + `CRC16_TEST_VECTORS`).

| Input | CRC |
|---|---|
| `<empty>` | `0xFFFF` |
| `0x00` | `0xE1F0` |
| `'A'` (0x41) | `0xB915` |
| `'123456789'` | `0x29B1` |

## 5 · Watchdog & safe state

- **Master watchdog**: no POLL frame received for 500 ms → auto-disarm all.
- **Slave watchdog**: no POLL received from master for 500 ms → drop bias
  caps in ≤ 200 ms (cold-start safe state).
- **E-STOP latency target**: < 50 ms from operator gesture to slave abort,
  validated by `eStopBroadcastLatency.spec.ts` (TODO).

## 6 · Out of scope

- C++ firmware implementation (only TS protocol + decl headers exist today).
- grandMA `.show.gz` binary parsing.
- Skybrush PBUS interop in 2-Wire (gap, pending Showven docs).
- FX Commander Pro 2-Wire compatibility (gap).
