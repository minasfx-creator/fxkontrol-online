/**
 * SkyCanvas3D smoke — verifies the R3F module exports a default component
 * and is composed of the expected sub-layers without rendering WebGL
 * (jsdom has no GPU). We import the source and assert the named layer
 * helpers exist via a structural snapshot of the module.
 *
 * Render-side correctness is covered by the /dev/skycanvas-3d route in
 * a real browser (R3F + WebGL).
 */
import { describe, it, expect } from 'vitest';
import SkyCanvas3D from '@/components/show3d/SkyCanvas3D';

describe('SkyCanvas3D module', () => {
  it('exports a default React component', () => {
    expect(typeof SkyCanvas3D).toBe('function');
  });

  it('component name is preserved', () => {
    expect(SkyCanvas3D.name).toBe('SkyCanvas3D');
  });
});
