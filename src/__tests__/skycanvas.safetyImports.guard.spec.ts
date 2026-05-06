/**
 * Guard: SkyCanvas surface MUST stay free of safety/dispatch imports.
 * Real-operation commands belong on /command via uiCommandGateway.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const FORBIDDEN = [
  /from\s+['"][^'"]*commandBus['"]/,
  /from\s+['"][^'"]*fieldBus['"]/,
  /from\s+['"][^'"]*safetyStateMachine['"]/,
  /workMode\.set\s*\(/,
  /uiCommandGateway\.(arm|fire|disarm|eStop)\s*\(/,
];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

describe('SkyCanvas safety imports guard', () => {
  const files = [
    'src/pages/SkyCanvas.tsx',
    ...walk('src/components/skycanvas'),
    'src/hooks/useFloatingDock.ts',
  ];

  for (const f of files) {
    it(`${f} has no forbidden safety/dispatch imports`, () => {
      const src = readFileSync(f, 'utf8');
      for (const pat of FORBIDDEN) {
        expect(src, `${f} matches ${pat}`).not.toMatch(pat);
      }
    });
  }
});
