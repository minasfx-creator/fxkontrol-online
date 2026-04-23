/**
 * FireOne Telemetry Parser — pure, side-effect-free.
 *
 * Parses STATUS frames from FXK-ESP32 / FireOne hardware tolerantly:
 *   "STATUS BAT:87;RSSI:-64"
 *   "STATUS;BAT:87;RSSI:-64"
 *   "STATUS BAT:87%; RSSI:-64dBm"
 *   "BAT:87;RSSI:-64"
 *   "STATUS RSSI:-70"          (BAT missing)
 *   "STATUS BAT:bad;RSSI:-64"  (BAT invalid → ignored, RSSI kept)
 *
 * Returns ONLY fields that were present and valid. Caller decides
 * whether to merge into existing state (invalid tokens never erase
 * a previously valid value).
 */

export interface TelemetryFields {
  batteryVoltage?: number;
  batteryPercent?: number;
  rssi?: number;
  pinsMask?: number;
  firmwareVersion?: string;
  /** Any token we didn't recognize (kept for diagnostics, not required). */
  unknown?: string[];
}

const STATUS_PREFIX = /^STATUS[\s;:]?/i;

/** Strip optional trailing units like "%", "dBm", "V", "mV". */
function stripUnits(raw: string): string {
  return raw.replace(/(%|dbm|mv|v)\s*$/i, '').trim();
}

function parseFloatSafe(raw: string): number | undefined {
  const cleaned = stripUnits(raw);
  if (!cleaned) return undefined;
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : undefined;
}

function parseIntSafe(raw: string): number | undefined {
  const cleaned = stripUnits(raw);
  if (!cleaned) return undefined;
  const n = Number.parseInt(cleaned, 10);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Parse a single line of telemetry. Returns only fields that were
 * present AND valid. Callers should merge — never overwrite valid
 * existing state with `undefined`.
 */
export function parseTelemetryLine(line: string): TelemetryFields {
  const out: TelemetryFields = {};
  if (typeof line !== 'string') return out;

  const trimmed = line.trim();
  if (!trimmed) return out;

  // Strip "STATUS" prefix if present (with optional separator).
  const body = trimmed.replace(STATUS_PREFIX, '').trim();
  if (!body) return out;

  const tokens = body.split(';').map(t => t.trim()).filter(Boolean);
  const unknown: string[] = [];

  for (const token of tokens) {
    const sepIdx = token.indexOf(':');
    if (sepIdx <= 0) {
      unknown.push(token);
      continue;
    }
    const key = token.slice(0, sepIdx).trim().toUpperCase();
    const value = token.slice(sepIdx + 1).trim();
    if (!value) continue;

    switch (key) {
      case 'BAT':
      case 'BATTERY': {
        // Heuristic: value with "%" → percent; otherwise volts.
        if (/%/.test(value)) {
          const pct = parseFloatSafe(value);
          if (pct !== undefined) out.batteryPercent = pct;
        } else {
          const v = parseFloatSafe(value);
          if (v !== undefined) {
            // Values >20 with no unit are likely percent (e.g. "87")
            // ESP32 voltage range is ~3.0–4.2V.
            if (v > 20) out.batteryPercent = v;
            else out.batteryVoltage = v;
          }
        }
        break;
      }
      case 'RSSI': {
        const n = parseIntSafe(value);
        if (n !== undefined) out.rssi = n;
        break;
      }
      case 'PINS': {
        // "PINS:0xFF" or "PINS:255"
        const hex = /^0x[0-9a-f]+$/i.test(value);
        const n = hex ? Number.parseInt(value, 16) : parseIntSafe(value);
        if (n !== undefined) out.pinsMask = n;
        break;
      }
      case 'VER':
      case 'VERSION':
        out.firmwareVersion = value;
        break;
      default:
        unknown.push(token);
    }
  }

  if (unknown.length) out.unknown = unknown;
  return out;
}

/**
 * Merge parsed fields into an existing state object. Only defined
 * fields overwrite — invalid/missing tokens never erase good data.
 */
export function mergeTelemetry<T extends Partial<TelemetryFields>>(
  current: T,
  next: TelemetryFields,
): T {
  const merged = { ...current } as T & TelemetryFields;
  if (next.batteryVoltage !== undefined) merged.batteryVoltage = next.batteryVoltage;
  if (next.batteryPercent !== undefined) merged.batteryPercent = next.batteryPercent;
  if (next.rssi !== undefined) merged.rssi = next.rssi;
  if (next.pinsMask !== undefined) merged.pinsMask = next.pinsMask;
  if (next.firmwareVersion !== undefined) merged.firmwareVersion = next.firmwareVersion;
  return merged;
}
