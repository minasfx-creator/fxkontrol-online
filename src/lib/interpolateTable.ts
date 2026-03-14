/**
 * ─── Generic Table Interpolation Utility ─────────────────────────────
 * Eliminates code duplication across pyroPhysics lookup tables.
 * Provides linear interpolation between keyed numeric values.
 */

export type LookupTable = Record<number, number>;

/**
 * Linearly interpolates a value from a numeric lookup table.
 * Clamps to boundary values for inputs outside the table range.
 * 
 * @param table - Record<number, number> mapping keys to values
 * @param input - The input key to look up
 * @param fallback - Optional fallback if table is empty
 * @returns Interpolated value
 */
export function interpolateTable(table: LookupTable, input: number, fallback = 0): number {
  const keys = Object.keys(table).map(Number).sort((a, b) => a - b);
  if (keys.length === 0) return fallback;
  if (input <= keys[0]) return table[keys[0]];
  if (input >= keys[keys.length - 1]) return table[keys[keys.length - 1]];
  
  for (let i = 0; i < keys.length - 1; i++) {
    if (input >= keys[i] && input <= keys[i + 1]) {
      const t = (input - keys[i]) / (keys[i + 1] - keys[i]);
      return table[keys[i]] * (1 - t) + table[keys[i + 1]] * t;
    }
  }
  return fallback;
}

/**
 * Same as interpolateTable but rounds the result to the nearest integer.
 */
export function interpolateTableRound(table: LookupTable, input: number, fallback = 0): number {
  return Math.round(interpolateTable(table, input, fallback));
}
