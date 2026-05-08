/**
 * Guard: SkyCanvasViewportShell + GlassTimelineDock pertencem ao plano
 * Show/Experience. NUNCA podem importar safety/command/hardware.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

const FORBIDDEN = [
  '@/core/safety/safetyStateMachine',
  '@/core/safety/SafetyStateMachine',
  '@/core/hardware/fieldBus',
  '@/core/hardware/FieldBus',
  '@/core/command/commandBus',
  '@/core/command/CommandBus',
  '@/core/command/uiCommandGateway',
];

const FILES = [
  'src/components/skycanvas/SkyCanvasViewportShell.tsx',
  'src/components/skycanvas/GlassTimelineDock.tsx',
  'src/components/skycanvas/timeline/GlassTimelineLanes.tsx',
];

describe('SkyCanvasViewportShell · Show/Experience plane guard', () => {
  for (const rel of FILES) {
    it(`${rel} — sem imports de safety/command/hardware`, () => {
      const src = readFileSync(join(process.cwd(), rel), 'utf8');
      for (const banned of FORBIDDEN) {
        expect(src.includes(banned), `${rel} importa ${banned}`).toBe(false);
      }
    });
  }
});
