import { describe, it, expect } from 'vitest';
import { inferModelFromIdentify } from '@/lib/fireoneProtocol';

function buildPayload(nameTag: string, fwMajor = 1, fwMinor = 2): Uint8Array {
  const buf = new Uint8Array(40 + nameTag.length + 1);
  buf[5] = fwMajor;
  buf[6] = fwMinor;
  for (let i = 0; i < nameTag.length; i++) buf[40 + i] = nameTag.charCodeAt(i);
  buf[40 + nameTag.length] = 0; // NUL terminator
  return buf;
}

describe('inferModelFromIdentify (XL4 discovery)', () => {
  it('recognises FXK-M1 from ASCII suffix appended after status block', () => {
    expect(inferModelFromIdentify(buildPayload('FXK-M1'))).toBe('FXK-M1');
  });

  it('recognises IFMx-i32Q from suffix', () => {
    expect(inferModelFromIdentify(buildPayload('IFMx-i32Q'))).toBe('IFMx-i32Q');
  });

  it('falls back to firmware-string heuristic when no suffix is present', () => {
    const payload = new Uint8Array(40);
    expect(inferModelFromIdentify(payload, 'FXK-M1 5.0')).toBe('FXK-M1');
  });

  it('returns Unknown when nothing matches (honest)', () => {
    expect(inferModelFromIdentify(new Uint8Array(40), '1.0')).toBe('Unknown');
  });
});
