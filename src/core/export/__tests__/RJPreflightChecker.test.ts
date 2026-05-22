import { describe, it, expect } from 'vitest';
import { runRJPreflight, getNonTrivialEntries } from '../RJPreflightChecker';
import type { ShowPlan, PyroCue, ShowPosition } from '@/core/showplan/ShowPlan';

// ── Fixture builders ─────────────────────────────────────────────────────

function pos(id: string, section?: string): ShowPosition {
  return {
    id, name: id, type: 'pyro',
    x: 0, y: 0, z: 0, heading: 0, pitch: 0,
    section,
  };
}

function cue(over: Partial<PyroCue>): PyroCue {
  return {
    id: 'c-' + Math.random().toString(36).slice(2, 8),
    time: 1.0,
    positionId: 'p1',
    module: 0,
    channel: 0,
    effectId: 'fx',
    fuseDelay: 0,
    caliber: 75,
    elevation: 90,
    heading: 0,
    position: { x: 0, y: 0, z: 0 },
    ...over,
  };
}

function plan(
  cues: PyroCue[],
  positions: ShowPosition[] = [pos('p1')],
): ShowPlan {
  return {
    metadata: {
      id: 'sp', name: 'test', venue: 'lab',
      gps: null, duration: 60, version: 1,
      createdAt: 0, updatedAt: 0, author: 'test', notes: '',
    },
    pyroCues: cues,
    dmxCues: [],
    dronePaths: [],
    constraints: { exclusionZones: [], spectatorBoundary: null, weatherLimits: { maxWind: 12, minVisibility: 5000 } } as any,
    formations: [],
    timelineItems: [],
    positions,
  } as any as ShowPlan;
}

// ── Common rules (apply to both variants) ────────────────────────────────

describe('RJPreflight — common hard validations', () => {
  it('blocks invalid module', () => {
    const r = runRJPreflight('timecode', plan([cue({ module: -1 })]));
    expect(r.entries[0].disposition).toBe('blocked');
    expect(r.entries[0].reasons.join('|')).toMatch(/invalid module/);
  });

  it('blocks invalid channel', () => {
    const r = runRJPreflight('traditional', plan([cue({ channel: -2 })]));
    expect(r.entries[0].disposition).toBe('blocked');
  });

  it('blocks invalid time (NaN, negative, infinity)', () => {
    const r = runRJPreflight('timecode', plan([
      cue({ time: NaN, id: 'a' }),
      cue({ time: -0.5, id: 'b' }),
      cue({ time: Infinity, id: 'c' }),
    ]));
    expect(r.countByDisposition.blocked).toBe(3);
  });

  it('willBeEmpty=true when all cues blocked', () => {
    const r = runRJPreflight('traditional', plan([cue({ module: -1 }), cue({ channel: -1 })]));
    expect(r.willBeEmpty).toBe(true);
    expect(r.exportableCount).toBe(0);
  });

  it('willBeEmpty=false when zero cues at all', () => {
    const r = runRJPreflight('timecode', plan([]));
    expect(r.willBeEmpty).toBe(false);
  });
});

// ── Module remap (≥100 → mod 100) ────────────────────────────────────────

describe('RJPreflight — module remap fallback', () => {
  it('module 100 (1-based) → 100 (no remap, exatamente 100 ainda passa)', () => {
    // module 99 (0-based) = 100 (1-based) → fallback (≥100 disparado)
    const r = runRJPreflight('timecode', plan([cue({ module: 99 })]));
    expect(r.entries[0].disposition).toBe('fallback');
    expect(r.entries[0].fallbacks?.moduleRemapped).toEqual({ from: 100, to: 100 });
  });

  it('module 101 (1-based) → 1', () => {
    const r = runRJPreflight('timecode', plan([cue({ module: 100 })]));
    expect(r.entries[0].disposition).toBe('fallback');
    expect(r.entries[0].fallbacks?.moduleRemapped).toEqual({ from: 101, to: 1 });
  });

  it('module 250 (1-based) → 50', () => {
    const r = runRJPreflight('traditional', plan([cue({ module: 249 })]));
    expect(r.entries[0].disposition).toBe('fallback');
    expect(r.entries[0].fallbacks?.moduleRemapped).toEqual({ from: 250, to: 50 });
  });
});

// ── Traditional — SFX é bloqueado ────────────────────────────────────────

describe('RJPreflight — Traditional blocks SFX', () => {
  it('blocks cue cuja position section indica flame', () => {
    const r = runRJPreflight('traditional', plan(
      [cue({ positionId: 'pf' })],
      [pos('pf', 'flame-line-A')],
    ));
    expect(r.entries[0].disposition).toBe('blocked');
    expect(r.entries[0].reasons[0]).toMatch(/SFX/);
  });

  it('blocks cryo (C) e stadium (S)', () => {
    const r = runRJPreflight('traditional', plan(
      [
        cue({ positionId: 'pc', id: 'c1' }),
        cue({ positionId: 'ps', id: 'c2' }),
      ],
      [pos('pc', 'cryojet-left'), pos('ps', 'stadium-shot-bowl')],
    ));
    expect(r.countByDisposition.blocked).toBe(2);
  });

  it('warns sobre duration=Xms em notes (Traditional ignora ABERTURA)', () => {
    const r = runRJPreflight('traditional', plan([cue({ notes: 'duration: 1200ms' })]));
    expect(r.entries[0].disposition).toBe('warn');
    expect(r.entries[0].reasons[0]).toMatch(/duration override/);
  });
});

// ── Timecode — SFX permitido, snap 30fps ─────────────────────────────────

describe('RJPreflight — Timecode SFX + snap', () => {
  it('exporta SFX flame normalmente', () => {
    const r = runRJPreflight('timecode', plan(
      [cue({ positionId: 'pf', time: 1.0 })],
      [pos('pf', 'flame-bar')],
    ));
    expect(r.entries[0].disposition).toBe('exported');
  });

  it('warn quando tempo não está em grid 30fps com >=1ms drift', () => {
    // 1.012s → frame 30.36 → snap 1.0333s (drift ~21ms)
    const r = runRJPreflight('timecode', plan([cue({ time: 1.012 })]));
    expect(r.entries[0].disposition).toBe('warn');
    expect(r.entries[0].fallbacks?.timeSnappedMs).toBeDefined();
  });

  it('exporta sem warn quando tempo já está em frame exato', () => {
    // 1/30 segundo → frame 1 exato
    const r = runRJPreflight('timecode', plan([cue({ time: 1 / 30 })]));
    expect(r.entries[0].disposition).toBe('exported');
  });
});

// ── Combinações ──────────────────────────────────────────────────────────

describe('RJPreflight — combos de severidade', () => {
  it('module≥100 + SFX em traditional → continua blocked (severidade maior vence)', () => {
    const r = runRJPreflight('traditional', plan(
      [cue({ module: 100, positionId: 'pf' })],
      [pos('pf', 'flame')],
    ));
    expect(r.entries[0].disposition).toBe('blocked');
  });

  it('module≥100 + tempo off-grid em timecode → fallback (não warn)', () => {
    const r = runRJPreflight('timecode', plan([cue({ module: 100, time: 1.012 })]));
    expect(r.entries[0].disposition).toBe('fallback');
    expect(r.entries[0].fallbacks?.moduleRemapped).toBeDefined();
    expect(r.entries[0].fallbacks?.timeSnappedMs).toBeDefined();
  });

  it('summary contém contagem agregada legível', () => {
    const r = runRJPreflight('traditional', plan([
      cue({ id: 'a' }),
      cue({ id: 'b', module: -1 }),
      cue({ id: 'c', module: 100 }),
    ]));
    expect(r.summary).toMatch(/RJ TRADITIONAL preflight/);
    expect(r.summary).toMatch(/1 BLOCKED/);
    expect(r.summary).toMatch(/1 fallback/);
  });

  it('getNonTrivialEntries omite os exported puros', () => {
    const r = runRJPreflight('timecode', plan([
      cue({ id: 'ok' }),                     // exported
      cue({ id: 'bad', module: -1 }),        // blocked
      cue({ id: 'remap', module: 100 }),     // fallback
    ]));
    const nt = getNonTrivialEntries(r);
    expect(nt.length).toBe(2);
    expect(nt.map(e => e.disposition).sort()).toEqual(['blocked', 'fallback']);
  });
});
