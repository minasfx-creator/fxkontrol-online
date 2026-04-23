import { describe, expect, it } from 'vitest';
import { normalizeTelemetryProjectId } from '@/core/cluster/HealthPersistenceService';

describe('normalizeTelemetryProjectId', () => {
  it('accepts app project UUIDs', () => {
    expect(normalizeTelemetryProjectId(' 123e4567-e89b-42d3-a456-426614174000 ')).toBe(
      '123e4567-e89b-42d3-a456-426614174000',
    );
  });

  it('rejects Supabase backend refs and empty values', () => {
    expect(normalizeTelemetryProjectId('abcdefghijklmnopqrst')).toBeNull();
    expect(normalizeTelemetryProjectId('')).toBeNull();
    expect(normalizeTelemetryProjectId(null)).toBeNull();
  });
});
