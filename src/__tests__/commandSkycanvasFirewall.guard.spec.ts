/**
 * ─── Command ↔ SkyCanvas Firewall Guard ──────────────────────────
 * Garante separação total entre a superfície /skycanvas (editor 3D /
 * coreografias) e /command (controladores / safety consoles).
 *
 * Regras:
 *   • Lado /command (CommandCenter.tsx + features/command/**) NÃO pode
 *     importar nada da superfície /skycanvas (3D engine, viewport,
 *     timeline glass, render_ultra).
 *   • Lado /skycanvas (SkyCanvas.tsx + features/skycanvas/**) NÃO pode
 *     importar CommandBus / uiCommandGateway / hardware/transports nem
 *     painéis de controle (LiveFiringPanel, ShowCommanderPanel, etc.).
 *
 * Strings de navegação (`navigate('/command')`, `navigate('/skycanvas')`)
 * permanecem permitidas — a regra só veta `import`/`from`.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';

const ROOT = resolve(__dirname, '..', '..');

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, files);
    else if (/\.(ts|tsx)$/.test(entry)) files.push(full);
  }
  return files;
}

function read(p: string): string {
  try { return readFileSync(p, 'utf8'); } catch { return ''; }
}

function importLines(src: string): string[] {
  return src.split('\n').filter((l) => /^\s*(import|export)\b.*from\s+['"]/.test(l));
}

const COMMAND_FILES = [
  resolve(ROOT, 'src/pages/CommandCenter.tsx'),
  ...walk(resolve(ROOT, 'src/features/command')),
];

const SKY_FILES = [
  resolve(ROOT, 'src/pages/SkyCanvas.tsx'),
  ...walk(resolve(ROOT, 'src/features/skycanvas')),
];

// Forbidden targets when importing FROM /command surface.
const COMMAND_FORBIDDEN = [
  '@/components/editor/SkyCanvasMount',
  '@/components/editor/SkyCanvasDiagnosticsPanel',
  '@/components/skycanvas/',
  '@/features/skycanvas',
  '@/render_ultra/',
  'Show3DEngine',
  'SkyCanvas2',
  'SkyCanvas3D',
];

// Forbidden targets when importing FROM /skycanvas surface.
const SKY_FORBIDDEN = [
  '@/core/command/CommandBus',
  '@/core/safety/uiCommandGateway',
  '@/hardware/transports/',
  '@/features/command',
  '@/components/editor/LiveFiringPanel',
  '@/components/editor/ShowCommanderPanel',
  '@/components/editor/DroneCommandPanel',
  '@/components/editor/MA3ControlPanel',
  '@/components/editor/live-firing/FXKNetPanel',
  '@/components/command/',
];

describe('Firewall: /command ↔ /skycanvas', () => {
  it('command surface does not import skycanvas viewport / 3D engine', () => {
    const violations: { file: string; line: string }[] = [];
    for (const file of COMMAND_FILES) {
      const lines = importLines(read(file));
      for (const line of lines) {
        for (const needle of COMMAND_FORBIDDEN) {
          if (line.includes(needle)) {
            violations.push({ file: file.replace(ROOT + '/', ''), line: line.trim() });
          }
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it('skycanvas surface does not import command-bus / safety-gateway / control panels', () => {
    const violations: { file: string; line: string }[] = [];
    for (const file of SKY_FILES) {
      const lines = importLines(read(file));
      for (const line of lines) {
        for (const needle of SKY_FORBIDDEN) {
          if (line.includes(needle)) {
            violations.push({ file: file.replace(ROOT + '/', ''), line: line.trim() });
          }
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it('barrels exist for both surfaces (canonical entry points)', () => {
    expect(read(resolve(ROOT, 'src/features/command/index.ts'))).toContain('LiveFiringPanel');
    expect(read(resolve(ROOT, 'src/features/skycanvas/index.ts'))).toContain('SkyCanvasMount');
  });
});
