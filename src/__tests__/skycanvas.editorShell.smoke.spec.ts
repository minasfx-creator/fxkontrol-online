/**
 * SkyCanvas EditorShell smoke (static):
 * Validates that /skycanvas keeps the canonical DS v1 grid wiring:
 *   - imports EditorShell + useEditorLayout('skycanvas')
 *   - mounts <EditorShell> with topbar/tabs/left/right/timeline slots
 *   - mobile uses MobilePanelSwitcher (state-driven, not dockStore)
 *   - command palette + master menu hooks are present
 *   - .ds-editor-grid class exists in index.css with expected tracks
 *
 * Static text scan (avoids rendering the full WebGL surface in jsdom).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const PAGE = 'src/pages/SkyCanvas.tsx';
const CSS = 'src/index.css';
const SHELL = 'src/components/ds/EditorShell.tsx';

describe('SkyCanvas → EditorShell DS v1 wiring (smoke)', () => {
  const page = readFileSync(PAGE, 'utf8');
  const css = readFileSync(CSS, 'utf8');
  const shell = readFileSync(SHELL, 'utf8');

  it('imports EditorShell from the @/components/ds barrel', () => {
    expect(page).toMatch(/import\s*\{[^}]*\bEditorShell\b[^}]*\}\s*from\s+['"]@\/components\/ds(?:\/EditorShell)?['"]/);
  });

  it("uses useEditorLayout('skycanvas') for persistent shell layout", () => {
    expect(page).toMatch(/useEditorLayout\(\s*['"]skycanvas['"]\s*\)/);
  });

  it('mounts <EditorShell> with topbar / tabs / left / right / timeline slots', () => {
    expect(page).toMatch(/<EditorShell\b/);
    for (const slot of ['topbar=', 'tabs=', 'left=', 'right=', 'timeline=']) {
      expect(page, `missing slot prop ${slot}`).toContain(slot);
    }
  });

  it('passes effectiveLayout (computed) to EditorShell', () => {
    expect(page).toMatch(/layout=\{effectiveLayout\}/);
  });

  it('mobile uses MobilePanelSwitcher (state-driven, no dockStore)', () => {
    expect(page).toMatch(/MobilePanelSwitcher/);
    expect(page).not.toMatch(/from\s+['"][^'"]*dockStore['"]/);
  });

  it('exposes Master Menu / Command Palette wiring', () => {
    expect(page).toMatch(/SkyCanvasCommandPalette/);
    expect(page).toMatch(/paletteOpen/);
  });

  it('EditorShell renders .ds-editor-grid as the root grid', () => {
    expect(shell).toMatch(/ds-editor-grid/);
  });

  it('index.css defines .ds-editor-grid with topbar/tabs/left/right/timeline tracks', () => {
    expect(css).toMatch(/\.ds-editor-grid\b/);
    // Layout vars / area names must exist (DS v1 contract).
    for (const token of [
      '--ds-layout-left',
      '--ds-layout-right',
      '--ds-layout-timeline',
      'ds-area-topbar',
      'ds-area-tabs',
      'ds-area-left',
      'ds-area-right',
      'ds-area-viewport',
      'ds-area-timeline',
    ]) {
      expect(css, `index.css missing ${token}`).toContain(token);
    }
  });

  it('Round 1 — registers all legacy creation tabs in SkyCanvas.tsx', () => {
    const refs = [
      'LibraryCatalogTab',
      'LibraryMarketplaceTab',
      'InspectorEffectTab',
      'InspectorChainTab',
      'InspectorLightTab',
      'InspectorLaserTab',
      'InspectorBoidsTab',
      'InspectorParticleTab',
      'TimelineWaveformTab',
      'TimelineStoryboardTab',
    ];
    for (const r of refs) {
      expect(page, `SkyCanvas.tsx missing tab wiring for ${r}`).toContain(`/tabs/${r}`);
    }
  });

  it('Round 1 — wrapper files exist and have no banned safety imports', () => {
    const FORBIDDEN = /commandBus|fieldBus|safetyStateMachine|workMode\.set|uiCommandGateway\.(arm|fire|disarm|eStop)/;
    const wrappers = [
      'LibraryCatalogTab',
      'LibraryMarketplaceTab',
      'InspectorEffectTab',
      'InspectorChainTab',
      'InspectorLightTab',
      'InspectorLaserTab',
      'InspectorBoidsTab',
      'InspectorParticleTab',
      'TimelineWaveformTab',
      'TimelineStoryboardTab',
    ];
    for (const w of wrappers) {
      const src = readFileSync(`src/components/skycanvas/tabs/${w}.tsx`, 'utf8');
      expect(src, `${w} must not import safety/dispatch`).not.toMatch(FORBIDDEN);
    }
  });
});
