import { describe, it, expect } from 'vitest';
import {
  serializeExtensionHistory,
  parseExtensionHistoryExport,
  EXT_HISTORY_FMT,
  EXT_HISTORY_VERSION,
} from '../extensionHistoryIO';

describe('extensionHistoryIO', () => {
  it('round-trips export → parse', () => {
    const out = serializeExtensionHistory('p1', { history: [], redo: [] });
    expect(out.fmt).toBe(EXT_HISTORY_FMT);
    expect(out.v).toBe(EXT_HISTORY_VERSION);
    const parsed = parseExtensionHistoryExport(JSON.parse(JSON.stringify(out)));
    expect(parsed.ok).toBe(true);
    expect(parsed.data?.planId).toBe('p1');
  });

  it('rejects wrong fmt', () => {
    const r = parseExtensionHistoryExport({ fmt: 'other', v: 1, planId: 'p', history: [], redo: [] });
    expect(r.ok).toBe(false);
  });

  it('rejects wrong version', () => {
    const r = parseExtensionHistoryExport({ fmt: EXT_HISTORY_FMT, v: 99, planId: 'p', history: [], redo: [] });
    expect(r.ok).toBe(false);
  });

  it('rejects missing planId / arrays', () => {
    expect(parseExtensionHistoryExport({ fmt: EXT_HISTORY_FMT, v: 1 }).ok).toBe(false);
    expect(parseExtensionHistoryExport(null).ok).toBe(false);
    expect(parseExtensionHistoryExport({ fmt: EXT_HISTORY_FMT, v: 1, planId: 'p', history: 'x', redo: [] }).ok).toBe(false);
  });
});
