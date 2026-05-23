import { describe, it, expect, vi } from 'vitest';
import {
  compileShowToModules,
  verifyCodeFor,
  downloadAll,
  type UltraFireTransportLike,
  type UltraFireCueData,
  type ModuleDownloadProgress,
} from '../UltraFireDownloader';
import type { PyroCue } from '@/core/showplan/ShowPlan';

const cue = (over: Partial<PyroCue>): PyroCue => ({
  id: over.id ?? 'c', time: 0, positionId: 'p', module: 0, channel: 0,
  effectId: 'e', fuseDelay: 50, caliber: 75, elevation: 85, heading: 0,
  position: { x: 0, y: 0, z: 0 }, ...over,
});

function makeTransport(opts: { failVerifyTimes?: number; throwSendTimes?: number } = {}): UltraFireTransportLike & {
  sent: number; verifyCalls: number;
} {
  let failsLeft = opts.failVerifyTimes ?? 0;
  let throwsLeft = opts.throwSendTimes ?? 0;
  const t = {
    sent: 0,
    verifyCalls: 0,
    send: vi.fn(async () => {
      if (throwsLeft-- > 0) throw new Error('tx fail');
      t.sent++;
    }),
    sendVerify: vi.fn(async () => { t.verifyCalls++; }),
    waitVerify: vi.fn(async () => failsLeft-- > 0 ? false : true),
  };
  return t;
}

describe('UltraFireDownloader — compile', () => {
  it('groups cues by module and sorts by time', () => {
    const c = compileShowToModules([
      cue({ id: 'a', module: 1, channel: 0, time: 5 }),
      cue({ id: 'b', module: 1, channel: 1, time: 1 }),
      cue({ id: 'c', module: 2, channel: 0, time: 2 }),
    ]);
    expect(c.errors).toEqual([]);
    expect(c.byModule.size).toBe(2);
    const m1 = c.byModule.get(1)!;
    expect(m1[0].timecodeMs).toBe(1000);
    expect(m1[1].timecodeMs).toBe(5000);
  });

  it('rejects out-of-range channels', () => {
    const c = compileShowToModules([cue({ id: 'bad', channel: 99 })]);
    expect(c.errors.some((e) => e.includes('out of range'))).toBe(true);
    expect(c.totalCues).toBe(0);
  });

  it('verifyCode is deterministic across runs', () => {
    const cues = [cue({ id: 'a', module: 0, channel: 0, time: 1 })];
    expect(compileShowToModules(cues).verifyCode)
      .toBe(compileShowToModules(cues).verifyCode);
  });

  it('verifyCode differs when cues change', () => {
    const a = compileShowToModules([cue({ id: 'a', module: 0, channel: 0, time: 1 })]);
    const b = compileShowToModules([cue({ id: 'a', module: 0, channel: 0, time: 2 })]);
    expect(a.verifyCode).not.toBe(b.verifyCode);
  });

  it('verifyCodeFor on empty map is 0xFFFF (CRC16-CCITT init)', () => {
    expect(verifyCodeFor(new Map<number, UltraFireCueData[]>())).toBe(0xffff);
  });
});

describe('UltraFireDownloader — downloadAll', () => {
  it('downloads + verifies all modules in mock loopback', async () => {
    const compiled = compileShowToModules([
      cue({ id: 'a', module: 0, channel: 0 }),
      cue({ id: 'b', module: 1, channel: 1 }),
    ]);
    const t = makeTransport();
    const events: ModuleDownloadProgress[] = [];
    const r = await downloadAll(compiled, { transport: t, onProgress: (p) => events.push(p) });
    expect(r.modulesOk.sort()).toEqual([0, 1]);
    expect(r.modulesFail).toEqual([]);
    expect(events.some((e) => e.status === 'ok')).toBe(true);
  });

  it('retries once on verify failure then succeeds', async () => {
    const compiled = compileShowToModules([cue({ id: 'a', module: 0, channel: 0 })]);
    const t = makeTransport({ failVerifyTimes: 1 });
    const r = await downloadAll(compiled, { transport: t });
    expect(r.modulesOk).toEqual([0]);
    expect(t.verifyCalls).toBeGreaterThanOrEqual(2);
  }, 3000);

  it('aborts mid-queue', async () => {
    const compiled = compileShowToModules([
      cue({ id: 'a', module: 0, channel: 0 }),
      cue({ id: 'b', module: 1, channel: 0 }),
      cue({ id: 'c', module: 2, channel: 0 }),
    ]);
    const ac = new AbortController();
    const t = makeTransport();
    ac.abort();
    const r = await downloadAll(compiled, { transport: t, signal: ac.signal });
    expect(r.modulesOk).toEqual([]);
    expect(r.modulesFail.length).toBe(3);
  });

  it('marks fail after all retries exhausted', async () => {
    const compiled = compileShowToModules([cue({ id: 'a', module: 0, channel: 0 })]);
    const t = makeTransport({ failVerifyTimes: 99 });
    const r = await downloadAll(compiled, { transport: t });
    expect(r.modulesFail).toEqual([0]);
  }, 5000);
});
