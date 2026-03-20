/**
 * OSC (Open Sound Control) Engine
 * Implements OSC 1.0 message encoding/decoding over WebSocket bridge
 * Used for grandMA3 ↔ editor bidirectional control
 *
 * grandMA3 OSC namespace:
 *   /gma3/exec/{page}.{fader}   — executor control
 *   /gma3/cmd                    — command line input
 *   /gma3/playback/{id}          — playback control
 *   /gma3/cue/{seq}/{cue}        — cue trigger
 *   /gma3/seq/{id}/go            — sequence go
 */

export interface OSCMessage {
  address: string;
  args: OSCArg[];
  timestamp?: number;
}

export type OSCArg =
  | { type: 'i'; value: number }    // int32
  | { type: 'f'; value: number }    // float32
  | { type: 's'; value: string }    // string
  | { type: 'b'; value: Uint8Array }; // blob

export interface OSCBundle {
  timetag: bigint;
  elements: (OSCMessage | OSCBundle)[];
}

export interface OSCConfig {
  host: string;       // MA3 console IP
  txPort: number;     // Send port (default 8000)
  rxPort: number;     // Receive port (default 9000)
  bridgeUrl: string;  // WebSocket bridge URL
}

// ── Encoding ─────────────────────────────────────────────

function padTo4(len: number): number {
  return len + (4 - (len % 4)) % 4;
}

function encodeString(s: string): Uint8Array {
  const bytes = new TextEncoder().encode(s + '\0');
  const padded = new Uint8Array(padTo4(bytes.length));
  padded.set(bytes);
  return padded;
}

function encodeInt32(v: number): Uint8Array {
  const buf = new ArrayBuffer(4);
  new DataView(buf).setInt32(0, v, false);
  return new Uint8Array(buf);
}

function encodeFloat32(v: number): Uint8Array {
  const buf = new ArrayBuffer(4);
  new DataView(buf).setFloat32(0, v, false);
  return new Uint8Array(buf);
}

function encodeBlob(data: Uint8Array): Uint8Array {
  const sizeBytes = encodeInt32(data.length);
  const paddedLen = padTo4(data.length);
  const result = new Uint8Array(4 + paddedLen);
  result.set(sizeBytes);
  result.set(data, 4);
  return result;
}

export function encodeOSCMessage(msg: OSCMessage): Uint8Array {
  const addressBytes = encodeString(msg.address);
  let typeTag = ',';
  const argBuffers: Uint8Array[] = [];

  for (const arg of msg.args) {
    typeTag += arg.type;
    switch (arg.type) {
      case 'i': argBuffers.push(encodeInt32(arg.value)); break;
      case 'f': argBuffers.push(encodeFloat32(arg.value)); break;
      case 's': argBuffers.push(encodeString(arg.value)); break;
      case 'b': argBuffers.push(encodeBlob(arg.value)); break;
    }
  }

  const typeBytes = encodeString(typeTag);
  const totalLen = addressBytes.length + typeBytes.length + argBuffers.reduce((s, b) => s + b.length, 0);
  const result = new Uint8Array(totalLen);
  let offset = 0;
  result.set(addressBytes, offset); offset += addressBytes.length;
  result.set(typeBytes, offset); offset += typeBytes.length;
  for (const buf of argBuffers) {
    result.set(buf, offset); offset += buf.length;
  }
  return result;
}

// ── Decoding ─────────────────────────────────────────────

export function decodeOSCMessage(data: Uint8Array): OSCMessage | null {
  try {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    let offset = 0;

    // Read address
    const addrEnd = data.indexOf(0, offset);
    if (addrEnd === -1) return null;
    const address = new TextDecoder().decode(data.subarray(offset, addrEnd));
    offset = padTo4(addrEnd + 1);

    // Read type tag
    if (data[offset] !== 0x2C) return null; // ','
    const typeEnd = data.indexOf(0, offset);
    if (typeEnd === -1) return null;
    const typeTag = new TextDecoder().decode(data.subarray(offset + 1, typeEnd));
    offset = padTo4(typeEnd + 1);

    const args: OSCArg[] = [];
    for (const t of typeTag) {
      switch (t) {
        case 'i':
          args.push({ type: 'i', value: view.getInt32(offset, false) });
          offset += 4;
          break;
        case 'f':
          args.push({ type: 'f', value: view.getFloat32(offset, false) });
          offset += 4;
          break;
        case 's': {
          const sEnd = data.indexOf(0, offset);
          args.push({ type: 's', value: new TextDecoder().decode(data.subarray(offset, sEnd)) });
          offset = padTo4(sEnd + 1);
          break;
        }
        case 'b': {
          const bLen = view.getInt32(offset, false);
          offset += 4;
          args.push({ type: 'b', value: data.subarray(offset, offset + bLen) });
          offset = padTo4(offset + bLen);
          break;
        }
      }
    }
    return { address, args };
  } catch {
    return null;
  }
}

// ── grandMA3 Specific Helpers ────────────────────────────

export function buildMA3Command(cmd: string): OSCMessage {
  return { address: '/gma3/cmd', args: [{ type: 's', value: cmd }] };
}

export function buildMA3ExecutorFader(page: number, fader: number, value: number): OSCMessage {
  return {
    address: `/gma3/exec/${page}.${fader}`,
    args: [{ type: 'f', value: Math.max(0, Math.min(1, value)) }],
  };
}

export function buildMA3ExecutorButton(page: number, button: number, pressed: boolean): OSCMessage {
  return {
    address: `/gma3/exec/${page}.${button}/key`,
    args: [{ type: 'i', value: pressed ? 1 : 0 }],
  };
}

export function buildMA3CueTrigger(sequence: number, cue: number): OSCMessage {
  return {
    address: `/gma3/cue/${sequence}/${cue}`,
    args: [{ type: 'f', value: 1.0 }],
  };
}

export function buildMA3SequenceGo(sequence: number): OSCMessage {
  return {
    address: `/gma3/seq/${sequence}/go`,
    args: [{ type: 'i', value: 1 }],
  };
}

export function buildMA3PlaybackControl(playbackId: number, action: 'go' | 'pause' | 'stop' | 'goback'): OSCMessage {
  return {
    address: `/gma3/playback/${playbackId}/${action}`,
    args: [{ type: 'i', value: 1 }],
  };
}

// ── OSC WebSocket Bridge Client ──────────────────────────

export type OSCConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

export class OSCBridgeClient {
  private ws: WebSocket | null = null;
  private config: OSCConfig;
  private listeners: Set<(msg: OSCMessage) => void> = new Set();
  private _state: OSCConnectionState = 'disconnected';
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private txCount = 0;
  private rxCount = 0;

  constructor(config: Partial<OSCConfig> = {}) {
    this.config = {
      host: config.host || '192.168.1.100',
      txPort: config.txPort || 8000,
      rxPort: config.rxPort || 9000,
      bridgeUrl: config.bridgeUrl || 'ws://localhost:9002',
    };
  }

  get state() { return this._state; }
  get stats() { return { tx: this.txCount, rx: this.rxCount }; }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this._state = 'connecting';
      try {
        this.ws = new WebSocket(this.config.bridgeUrl);
        this.ws.binaryType = 'arraybuffer';

        this.ws.onopen = () => {
          this._state = 'connected';
          // Send config to bridge
          this.ws!.send(JSON.stringify({
            type: 'config',
            host: this.config.host,
            txPort: this.config.txPort,
            rxPort: this.config.rxPort,
          }));
          resolve();
        };

        this.ws.onmessage = (ev) => {
          this.rxCount++;
          if (ev.data instanceof ArrayBuffer) {
            const msg = decodeOSCMessage(new Uint8Array(ev.data));
            if (msg) this.listeners.forEach(l => l(msg));
          }
        };

        this.ws.onerror = () => {
          this._state = 'error';
          reject(new Error('OSC bridge connection failed'));
        };

        this.ws.onclose = () => {
          this._state = 'disconnected';
        };
      } catch (err) {
        this._state = 'error';
        reject(err);
      }
    });
  }

  disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;
    this._state = 'disconnected';
  }

  send(msg: OSCMessage) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const encoded = encodeOSCMessage(msg);
    this.ws.send(encoded.buffer);
    this.txCount++;
  }

  on(listener: (msg: OSCMessage) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  updateConfig(config: Partial<OSCConfig>) {
    Object.assign(this.config, config);
  }
}

// Singleton
let _oscClient: OSCBridgeClient | null = null;
export function getOSCClient(): OSCBridgeClient {
  if (!_oscClient) _oscClient = new OSCBridgeClient();
  return _oscClient;
}
