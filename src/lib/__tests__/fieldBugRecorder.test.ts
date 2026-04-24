import { describe, it, expect, beforeEach } from 'vitest';
import { TransportEmulator } from '@/dev/transportEmulator';
import { FieldBugRecorder, isValidBugBundle } from '@/dev/fieldBugRecorder';

describe('FieldBugRecorder', () => {
  let emu: TransportEmulator;
  let rec: FieldBugRecorder;

  beforeEach(() => {
    emu = new TransportEmulator({ mode: 'normal', latencyMs: 10, jitterMs: 5, lossRate: 0.1, seed: 42 });
    rec = new FieldBugRecorder();
  });

  it('starts and reports recording state', () => {
    expect(rec.isRecording()).toBe(false);
    rec.start(emu, 'BLE_BAD');
    expect(rec.isRecording()).toBe(true);
  });

  it('resets emulator log on start so the bundle reflects only the session', () => {
    emu.send('OLD');
    expect(emu.getStats().tx).toBe(1);
    rec.start(emu, 'WIFI_NOISY');
    expect(emu.getStats().tx).toBe(0);
  });

  it('returns null if stopped without starting', () => {
    expect(rec.stop('nothing')).toBeNull();
  });

  it('produces a valid bundle with profile, config, notes, and trace', () => {
    rec.start(emu, 'BLE_BAD');
    emu.send('FIRE:1');
    emu.injectResponse('OK:1');
    const bundle = rec.stop('safari freezes after 3rd cue');
    expect(bundle).not.toBeNull();
    expect(isValidBugBundle(bundle)).toBe(true);
    expect(bundle!.profile).toBe('BLE_BAD');
    expect(bundle!.notes).toBe('safari freezes after 3rd cue');
    expect(bundle!.config.seed).toBe(42);
    expect(bundle!.config.latencyMs).toBe(10);
    expect(bundle!.trace.frames.length).toBeGreaterThan(0);
    expect(bundle!.durationMs).toBeGreaterThanOrEqual(0);
    expect(bundle!.capturedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('detaches from emulator after stop (safe to destroy emu)', () => {
    rec.start(emu, 'CLEAN');
    rec.stop('done');
    expect(rec.isRecording()).toBe(false);
    expect(() => emu.destroy()).not.toThrow();
  });

  it('cancel() drops the session without producing a bundle', () => {
    rec.start(emu, 'CLEAN');
    rec.cancel();
    expect(rec.isRecording()).toBe(false);
    expect(rec.stop('late')).toBeNull();
  });

  it('isValidBugBundle rejects malformed input', () => {
    expect(isValidBugBundle(null)).toBe(false);
    expect(isValidBugBundle({})).toBe(false);
    expect(isValidBugBundle({ version: 2 })).toBe(false);
    expect(isValidBugBundle({
      version: 1, capturedAt: 'x', durationMs: 0, profile: 'p',
      notes: '', ua: '', config: {}, trace: { frames: 'no' },
    })).toBe(false);
  });
});
