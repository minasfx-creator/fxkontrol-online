/**
 * Guard: forbid `EFFECT_LIBRARY.find(x => x.id === ...)` outside of resolveEffect.
 * All effect-by-id lookups must go through `findEffectById` so imported
 * libraries (FWsim, Mine, Standard, Finale) resolve too.
 *
 * Non-id queries (.find by name/partType/pattern) are allowed.
 */
import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';

describe('EFFECT_LIBRARY.find id-equality guard', () => {
  it('no source file calls EFFECT_LIBRARY.find(x => x.id === ...)', () => {
    let out = '';
    try {
      out = execSync(
        `rg -n "EFFECT_LIBRARY\\.find\\(\\s*\\(?\\w+\\)?\\s*=>\\s*\\w+\\.id\\s*===" src -g '*.ts' -g '*.tsx' -g '!src/data/effectsLibraries/resolveEffect.ts' -g '!src/__tests__/effectLookupGuard.spec.ts' || true`,
        { encoding: 'utf8' },
      );
    } catch (e: any) {
      out = e?.stdout?.toString() ?? '';
    }
    const offenders = out.split('\n').filter(Boolean);
    expect(offenders, `Replace with findEffectById:\n${offenders.join('\n')}`).toHaveLength(0);
  });
});
