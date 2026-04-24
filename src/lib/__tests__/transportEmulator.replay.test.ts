/**
 * Trace replay tests — emulator records → exports → loads → replays
 * and verifies frame fidelity + timing preservation.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TransportEmulator } from '@/dev/transportEmulator';

describe('TransportEmulator — trace replay', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('records TX/RX with O(1) counters', () => {
    const emu = new TransportEmulator({ mode: 'normal' });
    emu.send('PING\n');
    emu.injectResponse('PONG\n');
    vi.runAllTimers();
    const stats = emu.getStats();
    expect(stats.tx).toBe(1);
    expect(stats.rx).toBe(1);
    expect(stats.traced).toBe(2);
    emu.destroy();
  });

  it('exportTrace produces a JSON-serializable structure', () => {
    const emu = new TransportEmulator({ mode: 'normal', seed: 1 });
    emu.send('CONT:1\n');
    emu.injectResponse('CONT:1:OK\n');
    vi.runAllTimers();
    const trace = emu.exportTrace();
    expect(trace.version).toBe(1);
    expect(trace.frames).toHaveLength(2);
    const json = JSON.stringify(trace);
    expect(JSON.parse(json).frames[0].dir).toMatch(/^(tx|rx)$/);
    emu.destroy();
  });

  it('loadTrace + replay delivers RX frames in order', () => {
    const source = new TransportEmulator({ mode: 'normal' });
    source.send('A\n'); source.injectResponse('R1\n');
    source.send('B\n'); source.injectResponse('R2\n');
    vi.runAllTimers();
    const trace = source.exportTrace();
    source.destroy();

    const target = new TransportEmulator({ mode: 'normal' });
    const received: string[] = [];
    target.onResponse((f) => received.push(f));
    target.loadTrace(trace);
    target.replay({ preserveTiming: false });
    vi.runAllTimers();
    expect(received).toEqual(['R1\n', 'R2\n']);
    target.destroy();
  });

  it('stepReplay advances one frame at a time', () => {
    const emu = new TransportEmulator({ mode: 'normal' });
    const trace = {
      frames: [
        { dir: 'rx' as const, data: 'X\n', at: 0 },
        { dir: 'rx' as const, data: 'Y\n', at: 10 },
        { dir: 'rx' as const, data: 'Z\n', at: 20 },
      ],
    };
    const received: string[] = [];
    emu.onResponse((f) => received.push(f));
    emu.loadTrace(trace);

    emu.stepReplay();
    expect(received).toEqual(['X\n']);
    emu.stepReplay();
    emu.stepReplay();
    expect(received).toEqual(['X\n', 'Y\n', 'Z\n']);
    expect(emu.stepReplay()).toBe(false); // exhausted
    emu.destroy();
  });

  it('stopReplay prevents further frame delivery', () => {
    const emu = new TransportEmulator({ mode: 'normal' });
    const trace = {
      frames: [
        { dir: 'rx' as const, data: 'A\n', at: 0 },
        { dir: 'rx' as const, data: 'B\n', at: 100 },
        { dir: 'rx' as const, data: 'C\n', at: 200 },
      ],
    };
    const received: string[] = [];
    emu.onResponse((f) => received.push(f));
    emu.loadTrace(trace);
    emu.replay({ preserveTiming: true });
    vi.advanceTimersByTime(50); // first frame already fired
    emu.stopReplay();
    vi.runAllTimers();
    expect(received.length).toBeLessThan(3); // not all delivered
    emu.destroy();
  });

  it('getReplayStatus reflects state transitions', () => {
    const emu = new TransportEmulator({ mode: 'normal' });
    expect(emu.getReplayStatus().state).toBe('idle');
    emu.loadTrace({ frames: [{ dir: 'rx', data: 'X\n', at: 0 }] });
    expect(emu.getReplayStatus().total).toBe(1);
    emu.replay({ preserveTiming: false });
    expect(emu.getReplayStatus().state).toBe('running');
    vi.runAllTimers();
    expect(emu.getReplayStatus().state).toBe('idle');
    emu.destroy();
  });
});

describe('TransportEmulator — seek + breakpoint', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('seekReplay jumps cursor and re-anchors RX delta', () => {
    const emu = new TransportEmulator({ mode: 'normal' });
    emu.loadTrace({
      frames: [
        { dir: 'rx', data: 'A\n', at: 0 },
        { dir: 'rx', data: 'B\n', at: 100 },
        { dir: 'rx', data: 'C\n', at: 250 },
      ],
    });
    const received: string[] = [];
    emu.onResponse((f: string) => received.push(f));
    emu.seekReplay(2);
    emu.stepReplay();
    expect(received).toEqual(['C\n']);
    emu.destroy();
  });

  it('breakpoint auto-pauses BEFORE delivery and fires listener', () => {
    const emu = new TransportEmulator({ mode: 'normal' });
    emu.loadTrace({
      frames: [
        { dir: 'rx', data: 'OK:1\n', at: 0 },
        { dir: 'rx', data: 'ERROR:fault\n', at: 10 },
        { dir: 'rx', data: 'OK:2\n', at: 20 },
      ],
    });
    const received: string[] = [];
    let bpHit: { idx: number; data: string } | null = null;
    emu.onResponse((f: string) => received.push(f));
    emu.onBreakpointHit((frame: any, idx: number) => { bpHit = { idx, data: frame.data }; });
    emu.replay({ preserveTiming: false, breakpoint: (f: any) => f.data.includes('ERROR') });
    vi.runAllTimers();
    expect(received).toEqual(['OK:1\n']);            // ERROR not delivered
    expect(bpHit).toEqual({ idx: 1, data: 'ERROR:fault\n' });
    expect(emu.getReplayStatus().state).toBe('paused');
    emu.destroy();
  });

  it('resumeReplay after breakpoint hit advances past trapped frame (no infinite loop)', () => {
    const emu = new TransportEmulator({ mode: 'normal' });
    emu.loadTrace({
      frames: [
        { dir: 'rx', data: 'A\n', at: 0 },
        { dir: 'rx', data: 'TRAP\n', at: 5 },
        { dir: 'rx', data: 'B\n', at: 10 },
      ],
    });
    const received: string[] = [];
    emu.onResponse((f: string) => received.push(f));
    emu.replay({ preserveTiming: false, breakpoint: (f: any) => f.data === 'TRAP\n' });
    vi.runAllTimers();
    expect(received).toEqual(['A\n']);
    expect(emu.getReplayStatus().state).toBe('paused');
    // RESUME with breakpoint still active must NOT re-trigger on the trapped
    // frame (classic debugger semantics: cursor advances past the trap).
    emu.resumeReplay();
    vi.runAllTimers();
    expect(received).toEqual(['A\n', 'B\n']);
    expect(emu.getReplayStatus().state).toBe('idle');
    emu.destroy();
  });

  it('seeking back to a trapped frame re-triggers the breakpoint', () => {
    const emu = new TransportEmulator({ mode: 'normal' });
    emu.loadTrace({
      frames: [
        { dir: 'rx', data: 'A\n', at: 0 },
        { dir: 'rx', data: 'TRAP\n', at: 5 },
      ],
    });
    let hits = 0;
    emu.onBreakpointHit(() => { hits++; });
    emu.replay({ preserveTiming: false, breakpoint: (f: any) => f.data === 'TRAP\n' });
    vi.runAllTimers();
    expect(hits).toBe(1);
    emu.seekReplay(1); // jump back to TRAP
    emu.resumeReplay();
    vi.runAllTimers();
    expect(hits).toBe(2);
    emu.destroy();
  });
});
