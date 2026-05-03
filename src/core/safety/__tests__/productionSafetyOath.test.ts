import { describe, it, expect } from 'vitest';
import {
  evaluateProductionOath,
  detectProductionOathInputs,
  explainProductionOath,
} from '../productionSafetyOath';

describe('productionSafetyOath', () => {
  it('passes in development regardless of quarantine', () => {
    expect(evaluateProductionOath({ envMode: 'development', quarantineActive: true }).ok).toBe(true);
    expect(evaluateProductionOath({ envMode: 'development', quarantineActive: false }).ok).toBe(true);
  });

  it('passes in production when quarantine is OFF', () => {
    expect(evaluateProductionOath({ envMode: 'production', quarantineActive: false }).ok).toBe(true);
  });

  it('refuses in production with quarantine ON', () => {
    const r = evaluateProductionOath({ envMode: 'production', quarantineActive: true });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('production-with-safety-quarantine-active');
  });

  it('passes in test/CI even with quarantine ON', () => {
    expect(evaluateProductionOath({ envMode: 'test', quarantineActive: true }).ok).toBe(true);
  });

  it('detector reads global flag for quarantine', () => {
    const g = globalThis as { __FXK_SAFETY_QUARANTINE__?: boolean };
    g.__FXK_SAFETY_QUARANTINE__ = true;
    try {
      const inputs = detectProductionOathInputs();
      expect(inputs.quarantineActive).toBe(true);
    } finally {
      delete g.__FXK_SAFETY_QUARANTINE__;
    }
  });

  it('explain returns operator-friendly message', () => {
    expect(explainProductionOath('production-with-safety-quarantine-active'))
      .toMatch(/produção|quarentena/i);
  });
});
