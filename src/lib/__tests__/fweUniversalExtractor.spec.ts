import { describe, it, expect } from 'vitest';
import { extractFweUniversal } from '../fweUniversalExtractor';

const SHELL_XML = `<?xml version="1.0"?>
<FireworkEffect xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <Children>
    <BaseEffectNode xsi:type="Shell">
      <Children>
        <BaseEffectNode xsi:type="BurstingCharge">
          <Children>
            <BaseEffectNode xsi:type="Stars">
              <Color>Red</Color>
              <Diameter>0.1016</Diameter>
            </BaseEffectNode>
            <BaseEffectNode xsi:type="SphericalDistribution"/>
          </Children>
        </BaseEffectNode>
      </Children>
    </BaseEffectNode>
  </Children>
</FireworkEffect>`;

const MINE_XML = `<FireworkEffect xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <Children>
    <BaseEffectNode xsi:type="Mine">
      <Children>
        <BaseEffectNode xsi:type="Stars">
          <Color>Purple</Color>
        </BaseEffectNode>
        <BaseEffectNode xsi:type="Stars">
          <Color>White</Color>
        </BaseEffectNode>
        <BaseEffectNode xsi:type="CustomTailsLink"><ComponentID><Name>Silver Tail</Name></ComponentID></BaseEffectNode>
        <BaseEffectNode xsi:type="MineDistribution"/>
      </Children>
    </BaseEffectNode>
  </Children>
</FireworkEffect>`;

const BENGAL_XML = `<FireworkEffect xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <Children>
    <BaseEffectNode xsi:type="Bengal">
      <Color>Aqua</Color>
    </BaseEffectNode>
  </Children>
</FireworkEffect>`;

const CUSTOM_RGB_XML = `<FireworkEffect xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <Children><BaseEffectNode xsi:type="Shell">
    <Children><BaseEffectNode xsi:type="Stars">
      <Color>
        <CustomR>149</CustomR><CustomG>74</CustomG><CustomB>0</CustomB>
        <Color>Custom</Color>
      </Color>
    </BaseEffectNode></Children>
  </BaseEffectNode></Children>
</FireworkEffect>`;

describe('extractFweUniversal', () => {
  it('detects Shell root + Spherical distribution + caliber from Diameter', () => {
    const s = extractFweUniversal(SHELL_XML, 'X.fwe');
    expect(s.rootType).toBe('Shell');
    expect(s.distribution).toBe('Spherical');
    expect(s.caliberIn).toBe(4); // 0.1016 m → 4"
    expect(s.palette).toContain('#FF1A1A');
  });
  it('detects Mine + tails-link + multi-color palette', () => {
    const s = extractFweUniversal(MINE_XML, 'Mine_Purple_to_White.fwe');
    expect(s.rootType).toBe('Mine');
    expect(s.distribution).toBe('Mine');
    expect(s.hasTailsLink).toBe(true);
    expect(s.palette).toEqual(['#A24BFF', '#FFFFFF']);
    expect(s.primary).toBe('#A24BFF');
    expect(s.secondary).toBe('#FFFFFF');
  });
  it('extracts Bengal duration from filename', () => {
    const s = extractFweUniversal(BENGAL_XML, 'Bengal Light Aqua (30s).fwe');
    expect(s.rootType).toBe('Bengal');
    expect(s.bengalDurationS).toBe(30);
    expect(s.palette).toContain('#33D6FF');
  });
  it('parses Custom RGB siblings into hex', () => {
    const s = extractFweUniversal(CUSTOM_RGB_XML, 'rgb.fwe');
    expect(s.palette).toContain('#954A00');
  });
  it('returns null distribution when none present', () => {
    const xml = `<FireworkEffect xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><BaseEffectNode xsi:type="Rocket"/></FireworkEffect>`;
    expect(extractFweUniversal(xml, 'r.fwe').distribution).toBeNull();
  });
});
