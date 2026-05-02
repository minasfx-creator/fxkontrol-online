import { describe, it } from 'vitest';
import { vdlToEffectSpec } from '../vdlEffectMapper';
describe('probe', () => {
  it('extremes', () => {
    for (const v of ['0mm Red Peony', '1mm Red Peony', '1000mm Red Peony', '5000mm Red Peony', '-50mm Red Peony', 'Red Peony', '75mm Red Peony']) {
      try {
        const s = vdlToEffectSpec(v);
        // eslint-disable-next-line no-console
        console.log(JSON.stringify({v, caliber: s.caliberMM, energy: s.physicsOverrides.energyTotal, vel: s.physicsOverrides.burstVelocity, mass: s.physicsOverrides.particleMass, stars: s.physicsOverrides.starCount}));
      } catch (e) {
        console.log(v, 'THREW', (e as Error).message);
      }
    }
  });
});
