/**
 * Guard: ensure Round-15 consoles never re-introduce mock fixtures.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const FILES = [
  'src/components/editor/FireOneExportConsole.tsx',
  'src/components/editor/DMXArtNetConsole.tsx',
  'src/components/editor/AddressingPanel.tsx',
  'src/components/safety/CueConflictsConsole.tsx',
  'src/components/editor/live-firing/MobileLinkMode.tsx',
];

const HARDWARE_HONEST_FILES = [
  'src/components/editor/live-firing/MobileLinkMode.tsx',
];

const HARDWARE_FORBIDDEN = [
  /\bMath\.random\b/,
  /\bhwSimulated\b/,
  /\bcreateSimulatedModuleStatus\b/,
  /'Modo simulação/,
  /\(Simulado\)/,
];

const FORBIDDEN = [
  /\bMOCK_[A-Z]/,
  /\bFAKE_[A-Z]/,
  /\bSIMULATED_DATA\b/,
  /\bSTATIC_FIXTURE\b/,
  /\bmockData\b/,
  /\bfakeData\b/,
];

describe('mocksErradicated guard', () => {
  for (const rel of FILES) {
    it(`${rel} is free from mock fixtures`, () => {
      const src = readFileSync(resolve(process.cwd(), rel), 'utf8');
      for (const re of FORBIDDEN) {
        expect(src, `${rel} contains forbidden token ${re}`).not.toMatch(re);
      }
    });
  }
});
