/**
 * inferFxkModel — heuristic model classifier for FXK / FXK-M1 / IFMx-i32Q /
 * generic ESP32 hardware advertised over any transport (BLE name, USB
 * vendor/product, WS hostname, RS-485 IDENT).
 *
 * Honest: returns 'Unknown' when no signal matches — never guesses.
 */

export type FxkModel =
  | 'FXK'
  | 'FXK-M1'
  | 'IFMx-i32Q'
  | 'ESP32-Generic'
  | 'Unknown';

export interface InferModelInput {
  /** BLE advertised name, USB product string, WS hostname, RS-485 ident… */
  name?: string | null;
  /** Firmware tag if known, e.g. "FXK-M1 5.0", "IFMx 5.10". */
  firmware?: string | null;
  /** USB VID/PID hex tuple e.g. {vid:0x303A, pid:0x4001} for ESP32. */
  vidPid?: { vid?: number; pid?: number } | null;
}

const ESP32_VENDORS = new Set([0x303a /* Espressif */, 0x10c4 /* SiLabs CP210x */, 0x1a86 /* CH340 */]);

export function inferFxkModel(input: InferModelInput): FxkModel {
  const name = (input.name ?? '').trim().toUpperCase();
  const fw = (input.firmware ?? '').trim().toUpperCase();
  const haystack = `${name} ${fw}`;

  if (/\bFXK[-_ ]?M1\b/.test(haystack) || /\bM1[-_ ]?MODULE\b/.test(haystack)) return 'FXK-M1';
  if (/\bIFMX[-_ ]?I?32Q?\b/.test(haystack) || /\bIFMX\b/.test(haystack)) return 'IFMx-i32Q';
  if (/\bFXK\b/.test(haystack) || haystack.startsWith('FXK')) return 'FXK';

  if (input.vidPid?.vid != null && ESP32_VENDORS.has(input.vidPid.vid)) return 'ESP32-Generic';
  if (/\bESP32\b/.test(haystack) || /FXK[-_ ]?ESP/.test(haystack)) return 'ESP32-Generic';

  return 'Unknown';
}

/** Default channel count by inferred model — used when status frame is silent. */
export function defaultChannelCount(model: FxkModel): number {
  switch (model) {
    case 'FXK-M1': return 1;
    case 'FXK': return 16;
    case 'IFMx-i32Q': return 32;
    case 'ESP32-Generic': return 32;
    default: return 0;
  }
}
