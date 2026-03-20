/**
 * usePBusHardware — React hook for Showven PBUS hardware control
 * Dual-band 433M/868M with auto-select and device discovery
 * Supports transparent radio fallback via useRadioLink when antenna connected
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  getPBusController,
  type PBusDevice,
  type PBusEvent,
  type PBusWirelessBand,
} from '@/lib/pbusProtocol';
import { useRadioLink } from '@/hooks/useRadioLink';

export interface PBusHardwareState {
  isConnected: boolean;
  devices: Map<number, PBusDevice>;
  connectionError: string | null;
  scanning: boolean;
  txBytes: number;
  rxBytes: number;
}

const WIRELESS_POLL_INTERVAL = 3000;

export function usePBusHardware() {
  const [state, setState] = useState<PBusHardwareState>({
    isConnected: false,
    devices: new Map(),
    connectionError: null,
    scanning: false,
    txBytes: 0,
    rxBytes: 0,
  });

  const txRef = useRef(0);
  const rxRef = useRef(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const controller = getPBusController();
  const radioLink = useRadioLink();

  // Connection path: 'wired' when serial connected, 'radio' when only antenna available
  const connectionPath = useMemo((): 'wired' | 'radio' | 'none' => {
    if (state.isConnected) return 'wired';
    if (radioLink.isConnected) return 'radio';
    return 'none';
  }, [state.isConnected, radioLink.isConnected]);

  // Effective connection = wired OR radio
  const effectivelyConnected = connectionPath !== 'none';

  // Computed
  const deviceCount = useMemo(() => state.devices.size, [state.devices]);

  const bestBand = useMemo((): PBusWirelessBand => {
    let total433 = 0, total868 = 0, count = 0;
    state.devices.forEach(d => {
      total433 += d.rssi433;
      total868 += d.rssi868;
      count++;
    });
    if (count === 0) return 'dual';
    const avg433 = total433 / count;
    const avg868 = total868 / count;
    if (avg433 > avg868 + 5) return '433M';
    if (avg868 > avg433 + 5) return '868M';
    return 'dual';
  }, [state.devices]);

  const worstBattery = useMemo(() => {
    let worst: number | null = null;
    state.devices.forEach(d => {
      if (worst === null || d.batteryV < worst) worst = d.batteryV;
    });
    return worst;
  }, [state.devices]);

  // Subscribe to events
  useEffect(() => {
    const unsubscribe = controller.on((event: PBusEvent) => {
      rxRef.current += 8;

      switch (event.type) {
        case 'device-discovered':
        case 'status-update':
        case 'cue-update':
        case 'wireless-update': {
          setState(prev => {
            const newDevices = new Map(controller.discoveredDevices);
            return { ...prev, devices: newDevices, rxBytes: rxRef.current };
          });
          break;
        }
        case 'arm-confirm':
        case 'fire-confirm':
        case 'estop': {
          setState(prev => ({
            ...prev,
            devices: new Map(controller.discoveredDevices),
            rxBytes: rxRef.current,
          }));
          break;
        }
        case 'error': {
          setState(prev => ({
            ...prev,
            connectionError: `Device ${event.deviceAddress}: ${JSON.stringify(event.data)}`,
          }));
          break;
        }
      }
    });
    return unsubscribe;
  }, [controller]);

  // Wireless polling every 3s
  useEffect(() => {
    if (!state.isConnected) {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      return;
    }

    pollRef.current = setInterval(() => {
      state.devices.forEach((d) => {
        controller.requestWireless(d.address).catch(() => {});
        controller.requestCueStatus(d.address).catch(() => {});
      });
      txRef.current += state.devices.size * 16;
      setState(prev => ({ ...prev, txBytes: txRef.current }));
    }, WIRELESS_POLL_INTERVAL);

    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [state.isConnected, state.devices, controller]);

  const connect = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, connectionError: null }));
      await controller.connect();
      setState(prev => ({ ...prev, isConnected: true }));
    } catch (err: any) {
      setState(prev => ({ ...prev, isConnected: false, connectionError: err.message || 'Failed' }));
      throw err;
    }
  }, [controller]);

  const disconnect = useCallback(async () => {
    await controller.disconnect();
    setState(prev => ({ ...prev, isConnected: false, devices: new Map() }));
  }, [controller]);

  const discoverDevices = useCallback(async (maxAddr = 64) => {
    setState(prev => ({ ...prev, scanning: true }));
    try {
      await controller.discoverDevices(maxAddr);
      await new Promise(r => setTimeout(r, maxAddr * 50));
    } finally {
      setState(prev => ({ ...prev, scanning: false }));
    }
  }, [controller]);

  const armDevice = useCallback(async (addr: number) => {
    txRef.current += 7; setState(prev => ({ ...prev, txBytes: txRef.current }));
    await controller.armDevice(addr);
  }, [controller]);

  const disarmDevice = useCallback(async (addr: number) => {
    txRef.current += 7; setState(prev => ({ ...prev, txBytes: txRef.current }));
    await controller.disarmDevice(addr);
  }, [controller]);

  const armAll = useCallback(async () => {
    if (!state.isConnected && radioLink.isConnected) {
      const frame = new Uint8Array([0x50, 0x42, 0xFF, 0x20]);
      await radioLink.sendPBus(0xFF, frame);
      return;
    }
    txRef.current += 7; setState(prev => ({ ...prev, txBytes: txRef.current }));
    await controller.armAll();
  }, [controller, state.isConnected, radioLink]);

  const disarmAll = useCallback(async () => {
    if (!state.isConnected && radioLink.isConnected) {
      const frame = new Uint8Array([0x50, 0x42, 0xFF, 0x21]);
      await radioLink.sendPBus(0xFF, frame);
      return;
    }
    txRef.current += 7; setState(prev => ({ ...prev, txBytes: txRef.current }));
    await controller.disarmAll();
  }, [controller, state.isConnected, radioLink]);

  const fireCue = useCallback(async (addr: number, cueIndex: number, durationMs = 500) => {
    // Radio fallback: route via radio if wired not connected but radio is
    if (!state.isConnected && radioLink.isConnected) {
      const frame = new Uint8Array([0x50, 0x42, addr, 0x10, cueIndex, (durationMs >> 8) & 0xFF, durationMs & 0xFF]);
      await radioLink.sendPBus(addr, frame);
      return;
    }
    txRef.current += 10; setState(prev => ({ ...prev, txBytes: txRef.current }));
    await controller.fireCue(addr, cueIndex, durationMs);
  }, [controller, state.isConnected, radioLink]);

  const requestCueStatus = useCallback(async (addr: number) => {
    txRef.current += 7; setState(prev => ({ ...prev, txBytes: txRef.current }));
    await controller.requestCueStatus(addr);
  }, [controller]);

  const emergencyStop = useCallback(async () => {
    txRef.current += 7; setState(prev => ({ ...prev, txBytes: txRef.current }));
    await controller.emergencyStop();
  }, [controller]);

  const setBand = useCallback(async (addr: number, band: PBusWirelessBand) => {
    txRef.current += 8; setState(prev => ({ ...prev, txBytes: txRef.current }));
    await controller.setBand(addr, band);
  }, [controller]);

  return {
    ...state,
    connect,
    disconnect,
    discoverDevices,
    armDevice,
    disarmDevice,
    armAll,
    disarmAll,
    fireCue,
    requestCueStatus,
    emergencyStop,
    setBand,
    deviceCount,
    bestBand,
    worstBattery,
  };
}
