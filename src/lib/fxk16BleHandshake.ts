/**
 * ─── FXK16 BLE Handshake Helper ───────────────────────────────────
 * Self-contained Web Bluetooth probe used by the BLE pairing wizard.
 *
 * Opens GATT to a user-selected FXK16 device, subscribes to the RX
 * notify char, sends VERSION + STATUS, and resolves with the parsed
 * handshake banner (`MODEL:FXK16;CH:16;FW:...;ID:...`) or rejects with
 * an actionable HandshakeError.
 *
 * Honest: never returns synthetic data. On any failure (timeout, bad
 * banner, GATT error) the caller is expected to leave the registry
 * untouched.
 *
 * Same UUIDs as fireoneModuleHardwareBridge.ts and the ESP32 firmware
 * (firmware/fxk16-esp32s3/src/main.ino).
 */

export const FXK16_BLE_SERVICE_UUID = '0000ffe0-0000-1000-8000-00805f9b34fb';
export const FXK16_BLE_CHAR_TX_UUID = '0000ffe1-0000-1000-8000-00805f9b34fb';
export const FXK16_BLE_CHAR_RX_UUID = '0000ffe2-0000-1000-8000-00805f9b34fb';
export const FXK16_NAME_PREFIX = 'FXK16-';

export interface FXK16Handshake {
  /** Raw banner line received from the device. */
  raw: string;
  /** Always 'FXK16' on success. */
  model: string;
  /** Channel count reported by the firmware (16). */
  channels: number;
  /** Firmware version (e.g. '1.3.0'), if reported. */
  firmware?: string;
  /** Device serial / unique ID, if reported. */
  deviceId?: string;
  /** Wallclock time the banner was decoded (ms). */
  receivedAt: number;
  /** Latency from request to handshake (ms). */
  latencyMs: number;
}

export type HandshakeFailureCode =
  | 'unsupported'      // No Web Bluetooth in this browser
  | 'cancelled'        // User dismissed the chooser
  | 'gatt-failed'      // Could not open GATT or service
  | 'timeout'          // No banner within window
  | 'bad-banner'       // Banner missing MODEL:FXK16 or CH:16
  | 'disconnected'     // Device dropped mid-handshake
  | 'unknown';

export class HandshakeError extends Error {
  constructor(public code: HandshakeFailureCode, message: string, public cause?: unknown) {
    super(message);
    this.name = 'HandshakeError';
  }
}

interface WebBluetooth {
  requestDevice: (opts: unknown) => Promise<BluetoothDeviceLike>;
}
interface BluetoothDeviceLike {
  id: string;
  name?: string;
  gatt?: {
    connected: boolean;
    connect: () => Promise<BluetoothServerLike>;
    disconnect: () => void;
  };
  addEventListener: (ev: string, cb: () => void) => void;
  removeEventListener: (ev: string, cb: () => void) => void;
}
interface BluetoothServerLike {
  getPrimaryService: (uuid: string) => Promise<BluetoothServiceLike>;
}
interface BluetoothServiceLike {
  getCharacteristic: (uuid: string) => Promise<BluetoothCharLike>;
}
interface BluetoothCharLike {
  startNotifications: () => Promise<unknown>;
  stopNotifications?: () => Promise<unknown>;
  writeValue: (data: ArrayBuffer | Uint8Array) => Promise<unknown>;
  addEventListener: (ev: string, cb: (e: { target: { value: DataView } }) => void) => void;
  removeEventListener: (ev: string, cb: (e: { target: { value: DataView } }) => void) => void;
}

function getBluetooth(): WebBluetooth | null {
  const nav = navigator as unknown as { bluetooth?: WebBluetooth };
  return nav.bluetooth ?? null;
}

export function isWebBluetoothSupported(): boolean {
  return !!getBluetooth();
}

export interface ScanResult {
  device: BluetoothDeviceLike;
  name: string;
}

/**
 * Pop the browser's BLE chooser filtered to FXK16 devices. Resolves
 * with the user's pick. Rejects with `cancelled` when the operator
 * dismisses the chooser.
 */
export async function scanForFXK16(): Promise<ScanResult> {
  const bt = getBluetooth();
  if (!bt) throw new HandshakeError('unsupported', 'Web Bluetooth indisponível neste navegador.');
  try {
    const device = await bt.requestDevice({
      filters: [
        { namePrefix: FXK16_NAME_PREFIX },
        { services: [FXK16_BLE_SERVICE_UUID] },
      ],
      optionalServices: [FXK16_BLE_SERVICE_UUID],
    });
    return { device, name: device.name ?? 'FXK16' };
  } catch (err) {
    const e = err as { name?: string; message?: string };
    if (e?.name === 'NotFoundError') {
      throw new HandshakeError('cancelled', 'Nenhum dispositivo selecionado.', err);
    }
    if (e?.name === 'SecurityError') {
      throw new HandshakeError('gatt-failed', 'Bluetooth bloqueado pelo navegador (necessita HTTPS).', err);
    }
    if (e?.name === 'NotSupportedError') {
      throw new HandshakeError('unsupported', 'Web Bluetooth não suportado.', err);
    }
    throw new HandshakeError('unknown', e?.message ?? 'Falha ao iniciar busca BLE.', err);
  }
}

interface ParsedBanner {
  model?: string;
  channels?: number;
  firmware?: string;
  deviceId?: string;
}

function parseBanner(line: string): ParsedBanner {
  const out: ParsedBanner = {};
  for (const tok of line.split(';')) {
    const [k, v] = tok.split(':').map((s) => s.trim());
    if (!k || !v) continue;
    switch (k.toUpperCase()) {
      case 'MODEL': out.model = v; break;
      case 'CH': out.channels = Number.parseInt(v, 10); break;
      case 'FW': out.firmware = v; break;
      case 'ID': out.deviceId = v; break;
    }
  }
  return out;
}

/**
 * Connect to the chosen FXK16, send VERSION+STATUS, await the banner.
 * Always tears down notifications and disconnects when done — caller
 * must NOT keep the GATT link open after this returns.
 */
export async function performHandshake(
  device: BluetoothDeviceLike,
  opts: { timeoutMs?: number } = {},
): Promise<FXK16Handshake> {
  const timeoutMs = opts.timeoutMs ?? 3000;
  const t0 = performance.now();

  if (!device.gatt) {
    throw new HandshakeError('gatt-failed', 'Dispositivo sem GATT disponível.');
  }

  let server: BluetoothServerLike;
  try {
    server = await device.gatt.connect();
  } catch (err) {
    throw new HandshakeError('gatt-failed', 'Não foi possível abrir o servidor GATT.', err);
  }

  let charTx: BluetoothCharLike;
  let charRx: BluetoothCharLike;
  try {
    const svc = await server.getPrimaryService(FXK16_BLE_SERVICE_UUID);
    charTx = await svc.getCharacteristic(FXK16_BLE_CHAR_TX_UUID);
    charRx = await svc.getCharacteristic(FXK16_BLE_CHAR_RX_UUID);
  } catch (err) {
    try { device.gatt.disconnect(); } catch { /* ignore */ }
    throw new HandshakeError('gatt-failed', 'Serviço UART do FXK16 não encontrado.', err);
  }

  const decoder = new TextDecoder();
  let buf = '';
  let resolved = false;

  return await new Promise<FXK16Handshake>((resolve, reject) => {
    const cleanup = () => {
      try { charRx.removeEventListener('characteristicvaluechanged', onValue); } catch { /* ignore */ }
      try { device.removeEventListener('gattserverdisconnected', onDisconnect); } catch { /* ignore */ }
      try { charRx.stopNotifications?.(); } catch { /* ignore */ }
      try { device.gatt?.disconnect(); } catch { /* ignore */ }
      if (timer) clearTimeout(timer);
    };

    const finishOk = (hs: FXK16Handshake) => {
      if (resolved) return;
      resolved = true;
      cleanup();
      resolve(hs);
    };
    const finishErr = (e: HandshakeError) => {
      if (resolved) return;
      resolved = true;
      cleanup();
      reject(e);
    };

    const onValue = (e: { target: { value: DataView } }) => {
      const dv = e.target.value;
      const bytes = new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength);
      buf += decoder.decode(bytes, { stream: true });
      let nl = buf.indexOf('\n');
      while (nl >= 0) {
        const line = buf.slice(0, nl).replace(/\r$/, '').trim();
        buf = buf.slice(nl + 1);
        if (line.includes('MODEL:')) {
          const parsed = parseBanner(line);
          if ((parsed.model ?? '').toUpperCase() === 'FXK16' && parsed.channels === 16) {
            finishOk({
              raw: line,
              model: parsed.model!,
              channels: parsed.channels,
              firmware: parsed.firmware,
              deviceId: parsed.deviceId,
              receivedAt: Date.now(),
              latencyMs: Math.round(performance.now() - t0),
            });
            return;
          }
          finishErr(new HandshakeError(
            'bad-banner',
            `Banner inválido: "${line}". Esperado MODEL:FXK16;CH:16.`,
          ));
          return;
        }
        nl = buf.indexOf('\n');
      }
    };

    const onDisconnect = () => {
      finishErr(new HandshakeError('disconnected', 'Dispositivo desconectou durante o handshake.'));
    };

    const timer = setTimeout(() => {
      finishErr(new HandshakeError('timeout', `Sem resposta em ${timeoutMs}ms.`));
    }, timeoutMs);

    (async () => {
      try {
        await charRx.startNotifications();
        charRx.addEventListener('characteristicvaluechanged', onValue);
        device.addEventListener('gattserverdisconnected', onDisconnect);
        const enc = new TextEncoder();
        await charTx.writeValue(enc.encode('VERSION\n'));
        await charTx.writeValue(enc.encode('STATUS\n'));
      } catch (err) {
        finishErr(new HandshakeError('gatt-failed', 'Falha ao iniciar notificações.', err));
      }
    })();
  });
}
