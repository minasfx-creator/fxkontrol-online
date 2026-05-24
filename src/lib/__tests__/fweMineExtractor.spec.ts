import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { extractMineSpecFromXml } from '@/lib/fweMineExtractor';

const DIR = resolve(__dirname, '../../../public/finale-presets/mines');

function load(name: string): string | null {
  const p = resolve(DIR, name);
  return existsSync(p) ? readFileSync(p, 'utf8') : null;
}

describe('fweMineExtractor', () => {
  it('color-shift detection from filename "_to_"', () => {
    const xml = load('Mine_Red_to_Green.fwe');
    if (!xml) return;
    const s = extractMineSpecFromXml(xml, 'Mine_Red_to_Green.fwe');
    expect(s.isColorShift).toBe(true);
    expect(s.primary).toBe('#FF1A1A');
    expect(s.secondary).toBe('#00E676');
  });

  it('comet head + silver tail flags from filename', () => {
    const xml = load('Mine_Purple_Comet_White_w_Silver_Tail.fwe');
    if (!xml) return;
    const s = extractMineSpecFromXml(xml, 'Mine_Purple_Comet_White_w_Silver_Tail.fwe');
    expect(s.hasCometHead).toBe(true);
    expect(s.hasSilverTail).toBe(true);
    expect(s.hasTailsLink).toBe(true);
  });

  it('solid Mine_Yellow has no shift and yellow primary', () => {
    const xml = load('Mine_Yellow.fwe');
    if (!xml) return;
    const s = extractMineSpecFromXml(xml, 'Mine_Yellow.fwe');
    expect(s.isColorShift).toBe(false);
    expect(s.primary).toBe('#FFD600');
    expect(s.secondary).toBeUndefined();
  });

  it('Silver fallback from filename when XML colors are Invisible', () => {
    const xml = load('Mine_Silver.fwe');
    if (!xml) return;
    const s = extractMineSpecFromXml(xml, 'Mine_Silver.fwe');
    expect(s.primary).toBe('#E5E5E5');
    expect(s.isColorShift).toBe(false);
  });
});
