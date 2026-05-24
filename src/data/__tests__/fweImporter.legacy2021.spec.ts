/**
 * Bulk regression: every legacy .fwe (2021-04 dump, 229 files) must parse
 * cleanly through `parseFweXml` and yield a timeline-droppable Effect.
 *
 * Loaded via Vite's `import.meta.glob('…', { query: '?raw', eager: true })`
 * which jsdom + Vitest both honour out of the box.
 */
import { describe, it, expect } from 'vitest';
import { parseFweXml } from '@/data/fweImporter';

const RAW = import.meta.glob(
  '../__fixtures__/fwe/legacy-2021-04/**/*.fwe',
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>;

const ENTRIES = Object.entries(RAW)
  .map(([path, xml]) => {
    const fileName = path.split('/').pop() ?? path;
    return { path, fileName, xml };
  })
  // Defensive: skip empty payloads (the zip had a stray 0-byte LT/.fwe).
  .filter((e) => typeof e.xml === 'string' && e.xml.trim().length > 0);

describe('fweImporter — legacy 2021-04 bulk regression', () => {
  it('discovers the full 2021-04 fixture set', () => {
    expect(ENTRIES.length).toBeGreaterThanOrEqual(220);
  });

  it.each(ENTRIES)('parses $fileName into a valid Effect', ({ fileName, xml }) => {
    const result = parseFweXml(xml, fileName);
    expect(result.ok, `parse failed: ${result.errors.join('; ')}`).toBe(true);
    const effect = result.effect!;
    const spec = result.spec!;

    // Effect contract — must be timeline-droppable.
    expect(effect.id).toMatch(/^fwe-/);
    expect(effect.type).toBe('firework');
    expect(effect.name?.length).toBeGreaterThan(0);
    expect(effect.duration).toBeGreaterThan(0);
    expect(effect.color).toMatch(/^#[0-9A-F]{6}$/);

    // Spec contract.
    expect(['Cake', 'Shell', 'Mine']).toContain(spec.rootKind);
    expect(spec.partType).toMatch(/^(cake|shell|mine)$/);
    expect(spec.duration).toBeGreaterThan(0);
    expect(spec.cost).toBeGreaterThanOrEqual(12);
  });

  it('produces stable, unique ids across the whole legacy set', () => {
    const ids = ENTRIES.map(({ fileName, xml }) => parseFweXml(xml, fileName).effect!.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('classifies a healthy mix of root kinds (not all defaulted to Shell)', () => {
    const counts = { Cake: 0, Shell: 0, Mine: 0 } as Record<string, number>;
    for (const { fileName, xml } of ENTRIES) {
      const r = parseFweXml(xml, fileName);
      if (r.ok && r.spec) counts[r.spec.rootKind] = (counts[r.spec.rootKind] ?? 0) + 1;
    }
    // Shells dominate the dump but at least one other kind should appear.
    expect(counts.Shell).toBeGreaterThan(0);
    expect(counts.Cake + counts.Mine).toBeGreaterThan(0);
  });
});
