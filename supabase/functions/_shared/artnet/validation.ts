import type { DMXUniverseData } from "./types.ts";
import { jsonError } from "../response.ts";

/** Validate a single DMX universe's ranges and channel values. */
export function validateUniverse(data: DMXUniverseData): string[] {
  const errors: string[] = [];
  if (data.universe < 0 || data.universe > 15) errors.push(`Universe ${data.universe} out of range (0-15)`);
  if (data.subnet < 0 || data.subnet > 15) errors.push(`Subnet ${data.subnet} out of range (0-15)`);
  if (data.net < 0 || data.net > 127) errors.push(`Net ${data.net} out of range (0-127)`);
  if (!Array.isArray(data.channels) || data.channels.length === 0) errors.push('No channel data');
  if (Array.isArray(data.channels) && data.channels.length > 512) errors.push(`Too many channels: ${data.channels.length} (max 512)`);

  if (!Array.isArray(data.channels)) return errors;

  for (let i = 0; i < data.channels.length; i++) {
    if (data.channels[i] < 0 || data.channels[i] > 255) {
      errors.push(`Channel ${i + 1} value ${data.channels[i]} out of range (0-255)`);
      break;
    }
  }
  return errors;
}

/** Guard: returns a 400 Response if universes are missing/empty, null otherwise. */
export function requireUniverses(universes: DMXUniverseData[] | undefined): Response | null {
  if (!universes || !Array.isArray(universes) || universes.length === 0) {
    return jsonError('No universe data provided', 400);
  }
  return null;
}
