/**
 * ─── tuyaOutletControl — honest-hardware Tuya outlet adapter ───────
 * Bridges the auto-controller card UI to whatever real Tuya transport is
 * present today. The current build only discovers Tuya BLE-mesh devices
 * via `WebBleDiscoverer`; there is NO real write path implemented yet
 * (the Tuya BLE protocol requires per-device session keys we do not have
 * in the browser without the official SDK).
 *
 * Honest-hardware policy: this adapter NEVER pretends a write succeeded.
 * It returns a discriminated `TuyaWriteResult` so the UI can render the
 * exact reason (NO_REAL_SENDER, OFFLINE, NO_TRANSPORT) and disable the
 * affected button instead of showing a fake success toast.
 *
 * When a real transport ships (edge function `tuya-control` + session
 * key handshake, or a CubeMesh BLE characteristic write), wire it inside
 * `_dispatchOn` / `_dispatchOff` only — the public API is stable.
 */
import { blackbox } from '@/core/reliability/blackBoxRecorder';
import { deviceAggregator } from '@/core/discovery/DeviceAggregator';
import type { PhysicalDevice } from '@/core/discovery/types';

export type TuyaWriteResult =
  | { ok: true; transport: 'webble'; latencyMs: number }
  | { ok: false; code: 'NO_REAL_SENDER'; message: string }
  | { ok: false; code: 'OFFLINE'; message: string }
  | { ok: false; code: 'NO_TRANSPORT'; message: string }
  | { ok: false; code: 'UNKNOWN'; message: string };

function _hasBleLink(dev: PhysicalDevice): boolean {
  return !!dev.links.webble && dev.links.webble.online;
}

function _noRealSender(action: 'on' | 'off', dev: PhysicalDevice): TuyaWriteResult {
  blackbox.record(
    'cmd',
    `Tuya ${action.toUpperCase()} ${dev.label}: NO_REAL_SENDER (BLE write path not implemented)`,
  );
  return {
    ok: false,
    code: 'NO_REAL_SENDER',
    message: 'Caminho de escrita Tuya BLE ainda não implementado. Pareie via /pairing/ble e use o painel TuyaPairingPanel.',
  };
}

async function _dispatch(
  action: 'on' | 'off',
  dev: PhysicalDevice,
): Promise<TuyaWriteResult> {
  if (!dev.online) {
    return { ok: false, code: 'OFFLINE', message: 'Dispositivo offline' };
  }
  if (!_hasBleLink(dev)) {
    return {
      ok: false,
      code: 'NO_TRANSPORT',
      message: 'Sem link BLE ativo para este Tuya',
    };
  }
  // No real BLE write implementation today — be honest.
  return _noRealSender(action, dev);
}

export const tuyaOutletControl = {
  /** Whether ANY real send path exists. Today: false. */
  hasRealSender(): boolean {
    return false;
  },

  async turnOn(dev: PhysicalDevice): Promise<TuyaWriteResult> {
    return _dispatch('on', dev);
  },

  async turnOff(dev: PhysicalDevice): Promise<TuyaWriteResult> {
    return _dispatch('off', dev);
  },

  /** Send OFF to every Tuya/CubeMesh device currently online. */
  async allOff(): Promise<{ attempted: number; ok: number; failed: number }> {
    const devices = deviceAggregator.getDevices().filter((d) => {
      const link = Object.values(d.links).find(Boolean);
      const family = (link?.family ?? '').toLowerCase();
      const label = (d.label ?? '').toLowerCase();
      return /tuya|cubemesh|re168/.test(`${family} ${label}`) && d.online;
    });
    let ok = 0;
    let failed = 0;
    for (const dev of devices) {
      const r = await _dispatch('off', dev);
      if (r.ok === true) ok++;
      else failed++;
    }
    blackbox.record('cmd', `Tuya ALL OFF: attempted=${devices.length} ok=${ok} failed=${failed}`);
    return { attempted: devices.length, ok, failed };
  },
};
