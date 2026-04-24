import { describe, it, expect } from 'vitest';
import {
  COMMAND_POLICY,
  ALL_COMMAND_TYPES,
  RETRYABLE_COMMAND_TYPES,
  NON_RETRYABLE_COMMAND_TYPES,
  inferCommandType,
  isCommandRetryable,
  isRetryableCommandType,
  assertSafeRetry,
  assertSafeRetryFromRaw,
  type BridgeCommandType,
} from '@/lib/bridgeCommandPolicy';

describe('bridgeCommandPolicy', () => {
  describe('SAFETY INVARIANT — destructive commands MUST NEVER be retryable', () => {
    const destructive: BridgeCommandType[] = ['FIRE', 'BATCH', 'GPIO', 'ESTOP'];

    it.each(destructive)('%s is marked risk=destructive', (cmd) => {
      expect(COMMAND_POLICY[cmd].risk).toBe('destructive');
    });

    it.each(destructive)('%s has retry=false in COMMAND_POLICY', (cmd) => {
      expect(COMMAND_POLICY[cmd].retry).toBe(false);
    });

    it.each(destructive)('%s is NOT in RETRYABLE_COMMAND_TYPES', (cmd) => {
      expect(RETRYABLE_COMMAND_TYPES.has(cmd)).toBe(false);
    });

    it.each(destructive)('%s IS in NON_RETRYABLE_COMMAND_TYPES', (cmd) => {
      expect(NON_RETRYABLE_COMMAND_TYPES.has(cmd)).toBe(true);
    });

    it.each(destructive)('isCommandRetryable(%s) === false', (cmd) => {
      expect(isCommandRetryable(cmd)).toBe(false);
    });

    it.each(destructive)('assertSafeRetry(%s) throws', (cmd) => {
      expect(() => assertSafeRetry(cmd)).toThrow(/refusing to retry/);
    });
  });

  describe('SDK ↔ internal whitelist alignment (drift guard)', () => {
    it('every retry=true entry is in RETRYABLE_COMMAND_TYPES', () => {
      for (const t of ALL_COMMAND_TYPES) {
        if (COMMAND_POLICY[t].retry) {
          expect(RETRYABLE_COMMAND_TYPES.has(t)).toBe(true);
        }
      }
    });

    it('every RETRYABLE_COMMAND_TYPES entry has retry=true in policy', () => {
      for (const t of RETRYABLE_COMMAND_TYPES) {
        expect(COMMAND_POLICY[t].retry).toBe(true);
      }
    });

    it('isCommandRetryable matches the bridge-internal isRetryableCommandType', () => {
      for (const t of ALL_COMMAND_TYPES) {
        expect(isCommandRetryable(t)).toBe(isRetryableCommandType(t));
      }
    });

    it('every retry=true entry has a concrete rule with positive timeouts', () => {
      for (const t of ALL_COMMAND_TYPES) {
        const p = COMMAND_POLICY[t];
        if (p.retry) {
          expect(p.rule).toBeDefined();
          expect(p.rule!.maxRetries).toBeGreaterThanOrEqual(1);
          expect(p.rule!.perAttemptTimeoutMs).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('inferCommandType — string parsing', () => {
    it.each([
      ['FIRE:7\n', 'FIRE'],
      ['fire:7\n', 'FIRE'],
      ['  FIRE:7  ', 'FIRE'],
      ['BATCH:1,2,3\n', 'BATCH'],
      ['ESTOP\n', 'ESTOP'],
      ['CONT:14', 'CONT'],
      ['STATUS', 'STATUS'],
      ['HEARTBEAT', 'HEARTBEAT'],
      ['HANDSHAKE:v2', 'HANDSHAKE'],
    ] as const)('classifies %s → %s', (raw, expected) => {
      expect(inferCommandType(raw)).toBe(expected);
    });

    it.each([
      ['PING', 'HEARTBEAT'],
      ['HB', 'HEARTBEAT'],
      ['VER:1.0', 'VERSION'],
      ['STAT', 'STATUS'],
      ['CONTINUITY:7', 'CONT'],
      ['EMERGENCY', 'ESTOP'],
      ['STOP', 'ESTOP'],
      ['ABORT', 'ESTOP'],
    ] as const)('aliases %s → %s', (raw, expected) => {
      expect(inferCommandType(raw)).toBe(expected);
    });

    it('returns UNKNOWN for empty / unrecognised input', () => {
      expect(inferCommandType('')).toBe('UNKNOWN');
      expect(inferCommandType('   ')).toBe('UNKNOWN');
      expect(inferCommandType('GIBBERISH:9')).toBe('UNKNOWN');
    });

    it('handles Uint8Array frames', () => {
      const enc = new TextEncoder();
      expect(inferCommandType(enc.encode('FIRE:1\n'))).toBe('FIRE');
      expect(inferCommandType(enc.encode('CONT:7\n'))).toBe('CONT');
    });

    it('UNKNOWN is never retryable (fail-closed default)', () => {
      expect(isCommandRetryable('UNKNOWN')).toBe(false);
      expect(() => assertSafeRetry('UNKNOWN')).toThrow();
    });
  });

  describe('assertSafeRetryFromRaw — combined classify + assert', () => {
    it('returns the type when retry is allowed', () => {
      expect(assertSafeRetryFromRaw('CONT:7\n')).toBe('CONT');
      expect(assertSafeRetryFromRaw('STATUS')).toBe('STATUS');
    });

    it('throws when raw is destructive', () => {
      expect(() => assertSafeRetryFromRaw('FIRE:7\n')).toThrow(/refusing to retry/);
      expect(() => assertSafeRetryFromRaw('ESTOP')).toThrow(/refusing to retry/);
    });

    it('throws on UNKNOWN (fail-closed)', () => {
      expect(() => assertSafeRetryFromRaw('GIBBERISH')).toThrow(/refusing to retry/);
    });
  });

  describe('policy table immutability', () => {
    it('COMMAND_POLICY is frozen (cannot weaken FIRE.retry at runtime)', () => {
      expect(Object.isFrozen(COMMAND_POLICY)).toBe(true);
      // Defensive: even if someone tries, strict mode throws or silently no-ops
      expect(() => {
        // @ts-expect-error — intentional violation attempt
        COMMAND_POLICY.FIRE = { retry: true, risk: 'safe', description: 'hacked' };
      }).toThrow();
    });
  });

  describe('coverage — every type has a policy entry', () => {
    it('ALL_COMMAND_TYPES matches Object.keys(COMMAND_POLICY)', () => {
      expect(ALL_COMMAND_TYPES.length).toBe(Object.keys(COMMAND_POLICY).length);
    });
    it.each(ALL_COMMAND_TYPES)('%s has description and risk', (t) => {
      expect(COMMAND_POLICY[t].description.length).toBeGreaterThan(0);
      expect(['safe', 'sensitive', 'destructive']).toContain(COMMAND_POLICY[t].risk);
    });
  });
});
