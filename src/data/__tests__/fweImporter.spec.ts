import { describe, it, expect } from 'vitest';
import { parseFweXml } from '@/data/fweImporter';

const SHELL_XML = `<?xml version="1.0" encoding="utf-8"?>
<FireworkEffect xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <Children>
    <BaseEffectNode xsi:type="Shell">
      <Children>
        <BaseEffectNode xsi:type="BurstingCharge">
          <Children>
            <BaseEffectNode xsi:type="Stars">
              <Children>
                <BaseEffectNode xsi:type="CustomTailsLink">
                  <Component>
                    <Inserts>
                      <BaseEffectNode xsi:type="StarTails">
                        <Color>
                          <CustomR>120</CustomR>
                          <CustomG>70</CustomG>
                          <CustomB>29</CustomB>
                          <Color>Custom</Color>
                        </Color>
                        <Life>0.6</Life>
                        <LifeSigma>0.4</LifeSigma>
                      </BaseEffectNode>
                    </Inserts>
                  </Component>
                </BaseEffectNode>
              </Children>
              <Phases>
                <StarPhase>
                  <Color>
                    <CustomR>0</CustomR><CustomG>0</CustomG><CustomB>0</CustomB>
                    <Color>Red</Color>
                  </Color>
                </StarPhase>
              </Phases>
            </BaseEffectNode>
          </Children>
        </BaseEffectNode>
      </Children>
    </BaseEffectNode>
  </Children>
</FireworkEffect>`;

const CAKE_XML = `<?xml version="1.0" encoding="utf-8"?>
<FireworkEffect xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <Children>
    <BaseEffectNode xsi:type="Cake">
      <Children>
        <BaseEffectNode xsi:type="Shell"><Children/></BaseEffectNode>
        <BaseEffectNode xsi:type="Shell"><Children/></BaseEffectNode>
        <BaseEffectNode xsi:type="Shell"><Children/></BaseEffectNode>
        <BaseEffectNode xsi:type="StarTails">
          <Color>
            <CustomR>0</CustomR><CustomG>0</CustomG><CustomB>0</CustomB>
            <Color>Spark</Color>
          </Color>
          <Life>0.5</Life>
          <LifeSigma>0.3</LifeSigma>
        </BaseEffectNode>
      </Children>
    </BaseEffectNode>
  </Children>
</FireworkEffect>`;

const MINE_XML = `<?xml version="1.0" encoding="utf-8"?>
<FireworkEffect xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <Children>
    <BaseEffectNode xsi:type="Mine">
      <Children>
        <BaseEffectNode xsi:type="StarTails">
          <Color><CustomR>0</CustomR><CustomG>0</CustomG><CustomB>0</CustomB><Color>Red</Color></Color>
          <Life>0.4</Life><LifeSigma>0.2</LifeSigma>
        </BaseEffectNode>
      </Children>
    </BaseEffectNode>
  </Children>
</FireworkEffect>`;

describe('parseFweXml — runtime .fwe → Effect importer', () => {
  it('parses a Shell with Custom RGB color', () => {
    const r = parseFweXml(SHELL_XML, 'Chrysanthemum_Charcoal_Gold_to_Red.fwe');
    expect(r.ok).toBe(true);
    expect(r.spec?.rootKind).toBe('Shell');
    expect(r.effect?.partType).toBe('shell');
    expect(r.effect?.category).toBe('morteiros');
    expect(r.effect?.color.toUpperCase()).toBe('#78461D');
    expect(r.effect?.pattern).toBe('chrysanthemum');
    expect(r.effect?.duration).toBeGreaterThan(0.9);
    expect(r.effect?.id).toMatch(/^fwe-chrysanthemum/);
  });

  it('parses a Cake with shot-count from filename hint and direct Shell children', () => {
    const r = parseFweXml(CAKE_XML, 'Cake_Fan-Shape_Demo_21_Shots_I_3s.fwe');
    expect(r.ok).toBe(true);
    expect(r.spec?.rootKind).toBe('Cake');
    expect(r.effect?.partType).toBe('cake');
    expect(r.effect?.shotCount).toBe(21); // filename hint wins
    expect(r.effect?.duration).toBe(3);   // "_3s" suffix
  });

  it('falls back to direct Shell child count when filename lacks shots hint', () => {
    const r = parseFweXml(CAKE_XML, 'Cake_Mystery.fwe');
    expect(r.ok).toBe(true);
    expect(r.effect?.shotCount).toBe(3); // 3 direct <Shell> children
  });

  it('parses a Mine with named color', () => {
    const r = parseFweXml(MINE_XML, 'Comet_Ultrafast_Red.fwe');
    expect(r.ok).toBe(true);
    expect(r.spec?.rootKind).toBe('Mine');
    expect(r.effect?.partType).toBe('mine');
    expect(r.effect?.category).toBe('mines');
    expect(r.effect?.color).toBe('#FF1A1A');
    expect(r.effect?.pattern).toBe('comet');
  });

  it('rejects empty / malformed XML cleanly', () => {
    expect(parseFweXml('', 'x.fwe').ok).toBe(false);
    expect(parseFweXml('not xml at all', 'x.fwe').ok).toBe(false);
    expect(parseFweXml('<NotFireworkEffect/>', 'x.fwe').ok).toBe(false);
  });

  it('produces stable id keyed off filename (re-import = same id)', () => {
    const a = parseFweXml(SHELL_XML, 'My_Shell.fwe');
    const b = parseFweXml(SHELL_XML, 'My_Shell.fwe');
    expect(a.effect?.id).toBe(b.effect?.id);
    expect(a.effect?.id).toBe('fwe-my-shell');
  });

  it('emits Effect ready for the timeline (required fields populated)', () => {
    const r = parseFweXml(SHELL_XML, 'Test_Shell.fwe');
    const fx = r.effect!;
    expect(fx.id).toBeTruthy();
    expect(fx.name).toBeTruthy();
    expect(fx.type).toBe('firework');
    expect(fx.duration).toBeGreaterThan(0);
    expect(fx.cost).toBeGreaterThan(0);
    expect(fx.caliber).toBeGreaterThan(0);
    expect(fx.heightMeters).toBeGreaterThan(0);
    expect(typeof fx.icon).toBe('string');
  });
});
