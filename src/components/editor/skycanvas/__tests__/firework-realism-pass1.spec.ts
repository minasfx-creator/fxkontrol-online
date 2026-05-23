/**
 * Pass 1 realism refinements for FireworkRenderer:
 *   1. r_star_stretch_v2 flag exists and defaults ON.
 *   2. The v2 shader source contains the three new features:
 *      velocity-stretched sprite (aVel attribute + screen-space projection),
 *      HDR break flash (exp(-vLife * 35.0)), and ember temperature ramp.
 *   3. The legacy v1 shader is preserved verbatim for fallback when the
 *      flag is disabled (so a regression in v2 has a safety net).
 *
 * GPU shader execution itself is not testable in JSDOM — these checks
 * lock the source contract so a future refactor cannot silently drop the
 * v2 features. Visual validation happens in the preview at /editor.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isEnabled, getFlags } from '@/lib/featureFlags';

const SRC = readFileSync(
  resolve(__dirname, '..', 'FireworkRenderer.tsx'),
  'utf8',
);

describe('FireworkRenderer Pass 1 — velocity stretch + break flash + ember', () => {
  it('flag r_star_stretch_v2 exists and defaults ON', () => {
    const flags = getFlags();
    expect(flags).toHaveProperty('r_star_stretch_v2');
    expect(isEnabled('r_star_stretch_v2')).toBe(true);
  });

  it('v2 vertex shader declares aVel and projects velocity into screen space', () => {
    expect(SRC).toContain('STAR_VERTEX_SHADER_V2');
    expect(SRC).toMatch(/attribute\s+vec3\s+aVel/);
    expect(SRC).toMatch(/varying\s+vec2\s+vVelDir/);
    expect(SRC).toMatch(/varying\s+float\s+vSpeedFactor/);
    // Projects position + aVel offset into clip space (the heart of stretch)
    expect(SRC).toContain('position + aVel');
  });

  it('v2 fragment shader applies velocity-aligned stretch, ember ramp, and HDR break flash', () => {
    expect(SRC).toContain('STAR_FRAGMENT_SHADER_V2');
    // Stretch: sprite is rotated into velocity-aligned frame
    expect(SRC).toMatch(/uvAligned/);
    expect(SRC).toMatch(/stretch\s*=\s*1\.0\s*\+\s*vSpeedFactor/);
    // Ember ramp: amber hue mixed in via smoothstep over vLife
    expect(SRC).toMatch(/emberHue/);
    expect(SRC).toMatch(/smoothstep\(0\.55,\s*0\.95,\s*vLife\)/);
    // Break flash: exponential HDR spike on first frames
    expect(SRC).toMatch(/breakFlash\s*=\s*exp\(-vLife\s*\*\s*35\.0\)/);
  });

  it('legacy v1 shader is preserved verbatim for fallback', () => {
    // The legacy material is the safety net when r_star_stretch_v2 is OFF.
    // The selector inside _sharedStarMaterial() picks v2 first, v1 second.
    expect(SRC).toContain('STAR_VERTEX_SHADER ');
    expect(SRC).toContain('STAR_FRAGMENT_SHADER ');
    expect(SRC).toMatch(/_starMaterialInstance\s*=\s*new\s+THREE\.ShaderMaterial/);
    expect(SRC).toMatch(/_starMaterialV2Instance\s*=\s*new\s+THREE\.ShaderMaterial/);
  });

  it('particle buffer allocates vels Float32Array sized to STAR_COUNT * 3', () => {
    // Verify the buffer slot exists; runtime size is per-burst (variable STAR_COUNT)
    expect(SRC).toMatch(/vels:\s*new\s+Float32Array\(STAR_COUNT\s*\*\s*3\)/);
    // And that it's wired to the bufferAttribute "aVel" on the geometry
    expect(SRC).toContain('attach="attributes-aVel"');
    expect(SRC).toContain('particleBuffers.vels');
  });

  it('useFrame loop writes current velocity into particleBuffers.vels each frame', () => {
    // The physics loop must update aVel — otherwise stretch would freeze
    // at initial-velocity direction and stop looking dynamic over the arc.
    expect(SRC).toMatch(/particleBuffers\.vels\[i\s*\*\s*3\]/);
    expect(SRC).toMatch(/particleBuffers\.vels\[i\s*\*\s*3\s*\+\s*1\]/);
    expect(SRC).toMatch(/particleBuffers\.vels\[i\s*\*\s*3\s*\+\s*2\]/);
    // And that needsUpdate is flagged so GPU sees the new values
    expect(SRC).toMatch(/velAttr\.needsUpdate\s*=\s*true/);
  });
});
