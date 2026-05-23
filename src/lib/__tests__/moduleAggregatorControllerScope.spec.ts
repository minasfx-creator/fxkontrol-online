import { describe, it, expect, beforeEach } from 'vitest';
import { moduleAggregator } from '@/lib/moduleAggregator';

describe('moduleAggregator — controller-scoped keys', () => {
  beforeEach(() => moduleAggregator._resetForTests());

  it('same model+address from XL4 and XL2 yield two distinct entries', () => {
    moduleAggregator.upsert({
      address: 3, model: 'IFMx-i32Q', transport: 'wifi_direct',
      controllerId: 'xl4', controllerLabel: 'XL4 Gateway',
    });
    moduleAggregator.upsert({
      address: 3, model: 'IFMx-i32Q', transport: 'wifi_direct',
      controllerId: 'xl2', controllerLabel: 'XL2 Gateway',
    });
    const rows = moduleAggregator.list();
    expect(rows).toHaveLength(2);
    expect(rows.map(r => r.controllerLabel).sort()).toEqual(['XL2 Gateway', 'XL4 Gateway']);
  });

  it('same controllerId re-upsert merges (no duplication)', () => {
    moduleAggregator.upsert({
      address: 7, model: 'IFMx-i32Q', transport: 'wifi_direct',
      controllerId: 'xl4', controllerLabel: 'XL4 Gateway',
    });
    moduleAggregator.upsert({
      address: 7, model: 'IFMx-i32Q', transport: 'wifi_direct',
      controllerId: 'xl4', controllerLabel: 'XL4 Gateway', firmware: '5.0',
    });
    const rows = moduleAggregator.list();
    expect(rows).toHaveLength(1);
    expect(rows[0].firmware).toBe('5.0');
  });
});
