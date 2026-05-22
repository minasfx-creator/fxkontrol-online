/**
 * Canonical types for parts imported from Finale 3D-style XLSX libraries.
 * Source columns are preserved verbatim (35-col canonical schema).
 */

export type FinaleLibraryId = 'showven' | 'lidu' | 'magic' | 'winda' | 'amazon';

export interface FinalePart {
  /** Manufacturer SKU */
  partNumber: string;
  /** Internal library origin */
  libraryId: FinaleLibraryId;
  manufacturer: string;
  description?: string;
  /** Caliber/size — string in source ("4\"", "30mm", "0.0") */
  size?: string | number;
  internalDelay?: string | number;
  duration?: string | number;
  height?: string | number;
  numDevices?: string | number;
  color?: string;
  subtype?: string;
  vdl?: string;
  manufacturerPartNumber?: string;
  partType?: string;
  category?: string;
  customPartField?: string;
  partNotes?: string;
  stdPrice?: string | number;
  safetyDistance?: string | number;
  fuseDelay?: string | number;
  weight?: string | number;
  neq?: string | number;
  dmxPatch?: string;
  ematches?: string | number;
  /** Catch-all for any other column the source spreadsheet carries. */
  [extra: string]: unknown;
}

export interface FinaleLibrariesBundle {
  version: number;
  generatedAt: string;
  summary: Record<FinaleLibraryId, number>;
  parts: FinalePart[];
}
