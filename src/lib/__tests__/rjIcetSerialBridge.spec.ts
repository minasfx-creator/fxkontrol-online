import { describe, it, expect, vi } from 'vitest';
import {
  sendIcetScript,
  DEFAULT_ASCII_FRAMING,
  type SerialPortLike,
  type IcetSerialFraming,
} from '@/lib/rjIcetSerialBridge';
import type { IcetCue } from '@/lib/rjIcetScript';

// ─── fake port ──────────────────────────────────────────────────────

class FakePort implements SerialPortLike {
  public written: Uint8Array[] = [];
  private rxQueue: Uint8Array[] = [];
  private rxResolve: ((v: ReadableStreamReadResult<Uint8Array>) => void) | null = null;
  private opened = false;
  public closeCount = 0;

  readable: ReadableStream<Uint8Array> | null = null;
  writable: WritableStream<Uint8Array> | null = null;

  constructor() {
    this.readable = new ReadableStream<Uint8Array>({
      pull: (controller) => new Promise<void>((resolve) => {
        const tryDeliver = () => {
          const chunk = this.rxQueue.shift();
          if (chunk) {
            controller.enqueue(chunk);
            resolve();
            return;
          }
          // park
          this.rxResolve = (r) => {
            if (r.done) controller.close();
            else if (r.value) controller.enqueue(r.value);
            resolve();
          };
        };
        tryDeliver();
      }),
    });
    this.writable = new WritableStream<Uint8Array>({
      write: (chunk) => {
        const c = new Uint8Array(chunk.byteLength);
        c.set(chunk);
        this.written.push(c);
      },
    });
  }

  async open() {
    if (this.opened) throw new Error('already open');
    this.opened = true;
  }
  async close() {
    this.closeCount++;
    this.opened = false;
  }
  getInfo() { return { usbVendorId: 0x1a86, usbProductId: 0x7523 }; }

  /** Simula bytes vindos do equipamento. */
  feed(bytes: string | Uint8Array) {
    const u = typeof bytes === 'string' ? new TextEncoder().encode(bytes) : bytes;
    if (this.rxResolve) {
      const r = this.rxResolve;
      this.rxResolve = null;
      r({ value: u, done: false });
    } else {
      this.rxQueue.push(u);
    }
  }
}

const cue = (seq: number): IcetCue => ({
  timecode: `00:00:00:${String(seq).padStart(2, '0')}`,
  modulo: 1,
  canal: seq,
  abertura: 200,
  seq,
});

describe('rjIcetSerialBridge — sendIcetScript happy path', () => {
  it('handshakes, sends title + cues, returns ok', async () => {
    const port = new FakePort();
    // Pre-queue ACKs in order: VER, title, then 3 cue ACKs
    port.feed('VER ICET-1.5\n');
    port.feed('OK\n');
    port.feed('OK\nOK\nOK\n');

    const result = await sendIcetScript(port, 'SHOW', [cue(1), cue(2), cue(3)], {
      ackTimeoutMs: 500,
      versionTimeoutMs: 500,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.cuesSent).toBe(3);
      expect(result.firmwareVersion).toBe('ICET-1.5');
    }
    // Verifica frames enviados (VER? + TITULO + 3 CUE)
    const writtenStr = port.written.map(b => new TextDecoder().decode(b)).join('');
    expect(writtenStr).toContain('VER?');
    expect(writtenStr).toContain('TITULO SHOW');
    expect(writtenStr).toMatch(/CUE 00:00:00:01,1,1,200/);
    expect(writtenStr).toMatch(/CUE 00:00:00:03,1,3,200/);
    expect(port.closeCount).toBe(1);
  });
});

describe('rjIcetSerialBridge — error paths', () => {
  it('returns response-timeout when handshake has no reply', async () => {
    const port = new FakePort();
    const result = await sendIcetScript(port, 'SHOW', [cue(1)], {
      versionTimeoutMs: 50,
      ackTimeoutMs: 50,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('response-timeout');
      expect(result.cuesSent).toBe(0);
    }
  });

  it('returns version-incompatible when title is NACKd', async () => {
    const port = new FakePort();
    port.feed('VER 0.9\n');
    port.feed('ERR INCOMPATIBLE\n');
    const result = await sendIcetScript(port, 'SHOW', [cue(1)], {
      versionTimeoutMs: 200,
      ackTimeoutMs: 200,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('version-incompatible');
      expect(result.message).toMatch(/Versão do equipamento incompatível/);
    }
  });

  it('returns transfer-error when a cue is rejected', async () => {
    const port = new FakePort();
    port.feed('VER ICET-1.5\n');
    port.feed('OK\n');     // title ack
    port.feed('OK\n');     // cue 1 ack
    port.feed('ERR BAD\n'); // cue 2 nack
    const result = await sendIcetScript(port, 'S', [cue(1), cue(2)], {
      versionTimeoutMs: 200,
      ackTimeoutMs: 200,
    });
    expect(result.ok).toBe(false);
    
      expect(result.code).toBe('transfer-error');
      expect(result.cuesSent).toBe(1);
    }
  });

  it('honors abort signal mid-stream', async () => {
    const port = new FakePort();
    port.feed('VER ICET-1.5\n');
    port.feed('OK\n');
    port.feed('OK\n');
    const ac = new AbortController();
    const progress = vi.fn((sent: number) => {
      if (sent === 1) ac.abort();
    });
    const result = await sendIcetScript(port, 'S', [cue(1), cue(2), cue(3)], {
      versionTimeoutMs: 200,
      ackTimeoutMs: 100,
      signal: ac.signal,
      onProgress: progress,
    });
    expect(result.ok).toBe(false);
    
      expect(['aborted', 'response-timeout']).toContain(result.code);
    }
    expect(progress).toHaveBeenCalled();
  });
});

describe('rjIcetSerialBridge — framing ASCII parsers', () => {
  it('parses VER response and consumes line', () => {
    const buf = new TextEncoder().encode('VER 1.5\nextra');
    const r = DEFAULT_ASCII_FRAMING.parseVersionResponse(buf);
    expect(r).not.toBeNull();
    expect(r!.version).toBe('1.5');
    expect(r!.consumed).toBe('VER 1.5\n'.length);
  });
  it('parses OK / ERR ACKs', () => {
    expect(DEFAULT_ASCII_FRAMING.parseAck(new TextEncoder().encode('OK\n'))!.kind).toBe('ok');
    expect(DEFAULT_ASCII_FRAMING.parseAck(new TextEncoder().encode('ERR x\n'))!.kind).toBe('err');
    expect(DEFAULT_ASCII_FRAMING.parseAck(new TextEncoder().encode('incomp'))).toBeNull();
  });
});

// Used to suppress an unused-import warning when framing test branch is touched
const _typeCheck: IcetSerialFraming = DEFAULT_ASCII_FRAMING;
void _typeCheck;
