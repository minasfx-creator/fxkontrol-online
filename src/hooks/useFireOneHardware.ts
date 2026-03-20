/**
 * useFireOneHardware — React hook bridging FireOneController ↔ component state
 * 
 * Wraps the singleton FireOneController to provide:
 * - WebSerial connect/disconnect lifecycle
 * - Module discovery and real-time status
 * - Safety-gated ARM/FIRE/CONTINUITY commands
 * - TX/RX counters and connection telemetry
 * - DMX output for IFMx-i32Q modules
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  getFireOneController,
  type FireOneModuleStatus,
  type FireOneEvent,
  type FireOneModuleConfig,
  buildDmxOutCommand,
  buildModuleConfigQuery,
} from '@/lib/fireoneProtocol';

export interface FireOneHardwareState {
  isConnected: boolean;
  modules: Map<number, FireOneModuleStatus>;
  connectionError: string | null;
  lastHeartbeat: number | null;
  txBytes: number;
  rxBytes: number;
  scanning: boolean;
}

export function useFireOneHardware() {
  const [state, setState] = useState<FireOneHardwareState>({
    isConnected: false,
    modules: new Map(),
    connectionError: null,
    lastHeartbeat: null,
    txBytes: 0,
    rxBytes: 0,
    scanning: false,
  });

  const txRef = useRef(0);
  const rxRef = useRef(0);
  const controller = getFireOneController();

  // Subscribe to controller events
  useEffect(() => {
    const unsubscribe = controller.on((event: FireOneEvent) => {
      rxRef.current += 8; // approximate per-frame RX bytes

      switch (event.type) {
        case 'module-discovered':
        case 'status-update': {
          const status = event.data as FireOneModuleStatus;
          setState(prev => {
            const newModules = new Map(prev.modules);
            newModules.set(event.moduleAddress, status);
            return { ...prev, modules: newModules };
          });
          break;
        }

        case 'continuity-result': {
          // Module status already updated in controller
          const updatedModules = controller.discoveredModules;
          setState(prev => {
            const newModules = new Map(prev.modules);
            updatedModules.forEach(m => newModules.set(m.moduleAddress, m));
            return { ...prev, modules: newModules };
          });
          break;
        }

        case 'fire-confirm': {
          const updatedModules = controller.discoveredModules;
          setState(prev => {
            const newModules = new Map(prev.modules);
            updatedModules.forEach(m => newModules.set(m.moduleAddress, m));
            return { ...prev, modules: newModules };
          });
          break;
        }

        case 'arm-confirm': {
          const updatedModules = controller.discoveredModules;
          setState(prev => {
            const newModules = new Map(prev.modules);
            updatedModules.forEach(m => newModules.set(m.moduleAddress, m));
            return { ...prev, modules: newModules };
          });
          break;
        }

        case 'heartbeat': {
          setState(prev => ({ ...prev, lastHeartbeat: event.timestamp }));
          break;
        }

        case 'emergency-stop': {
          const updatedModules = controller.discoveredModules;
          setState(prev => {
            const newModules = new Map(prev.modules);
            updatedModules.forEach(m => newModules.set(m.moduleAddress, m));
            return { ...prev, modules: newModules };
          });
          break;
        }

        case 'config-response': {
          const config = event.data as FireOneModuleConfig;
          setState(prev => {
            const newModules = new Map(prev.modules);
            const existing = newModules.get(event.moduleAddress);
            if (existing) {
              newModules.set(event.moduleAddress, {
                ...existing,
                serialNumber: config.serialNumber,
                dmxUniverse: config.dmxUniverse,
                wireless: config.wireless,
                firmwareVersion: config.firmwareVersion,
              });
            }
            return { ...prev, modules: newModules };
          });
          break;
        }

        case 'error': {
          setState(prev => ({ ...prev, connectionError: `Module ${event.moduleAddress}: ${JSON.stringify(event.data)}` }));
          break;
        }
      }
    });

    return unsubscribe;
  }, [controller]);

  // Connect via WebSerial
  const connect = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, connectionError: null }));
      await controller.connect();
      setState(prev => ({ ...prev, isConnected: true }));
    } catch (err: any) {
      setState(prev => ({
        ...prev,
        isConnected: false,
        connectionError: err.message || 'Failed to connect',
      }));
      throw err;
    }
  }, [controller]);

  // Disconnect
  const disconnect = useCallback(async () => {
    await controller.disconnect();
    setState(prev => ({
      ...prev,
      isConnected: false,
      modules: new Map(),
      lastHeartbeat: null,
    }));
  }, [controller]);

  // Arm module
  const armModule = useCallback(async (addr: number) => {
    txRef.current += 5;
    setState(prev => ({ ...prev, txBytes: txRef.current }));
    await controller.armModule(addr);
  }, [controller]);

  // Disarm module
  const disarmModule = useCallback(async (addr: number) => {
    txRef.current += 5;
    setState(prev => ({ ...prev, txBytes: txRef.current }));
    await controller.disarmModule(addr);
  }, [controller]);

  // Fire igniter (safety gate happens in the UI layer)
  const fireIgniter = useCallback(async (addr: number, pin: number, durationMs = 500) => {
    txRef.current += 8;
    setState(prev => ({ ...prev, txBytes: txRef.current }));
    await controller.fireIgniter(addr, pin, durationMs);
  }, [controller]);

  // Request continuity check
  const requestContinuity = useCallback(async (addr: number) => {
    txRef.current += 5;
    setState(prev => ({ ...prev, txBytes: txRef.current }));
    await controller.requestContinuity(addr);
  }, [controller]);

  // Discover modules on the RS-485 bus
  const discoverModules = useCallback(async (maxAddr = 20) => {
    setState(prev => ({ ...prev, scanning: true }));
    try {
      await controller.discoverModules(maxAddr);
      // Allow time for responses
      await new Promise(r => setTimeout(r, maxAddr * 60));
    } finally {
      setState(prev => ({ ...prev, scanning: false }));
    }
  }, [controller]);

  // Emergency stop
  const emergencyStop = useCallback(async () => {
    txRef.current += 15;
    setState(prev => ({ ...prev, txBytes: txRef.current }));
    await controller.emergencyStop();
  }, [controller]);

  // Arm/Disarm all
  const armAll = useCallback(async () => {
    txRef.current += 5;
    setState(prev => ({ ...prev, txBytes: txRef.current }));
    await controller.armAll();
  }, [controller]);

  const disarmAll = useCallback(async () => {
    txRef.current += 5;
    setState(prev => ({ ...prev, txBytes: txRef.current }));
    await controller.disarmAll();
  }, [controller]);

  // Sync timecode
  const syncTimecode = useCallback(async (ms: number) => {
    txRef.current += 9;
    setState(prev => ({ ...prev, txBytes: txRef.current }));
    await controller.syncTimecode(ms);
  }, [controller]);

  // Send DMX out to IFMx-i32Q module
  const sendDmxOut = useCallback(async (moduleAddr: number, startChannel: number, values: number[]) => {
    const frame = buildDmxOutCommand(moduleAddr, startChannel, values);
    txRef.current += frame.length;
    setState(prev => ({ ...prev, txBytes: txRef.current }));
    await controller.send(frame);
  }, [controller]);

  // Query module config
  const queryModuleConfig = useCallback(async (moduleAddr: number) => {
    const frame = buildModuleConfigQuery(moduleAddr);
    txRef.current += frame.length;
    setState(prev => ({ ...prev, txBytes: txRef.current }));
    await controller.send(frame);
  }, [controller]);

  return {
    ...state,
    connect,
    disconnect,
    armModule,
    disarmModule,
    fireIgniter,
    requestContinuity,
    discoverModules,
    emergencyStop,
    armAll,
    disarmAll,
    syncTimecode,
    sendDmxOut,
    queryModuleConfig,
  };
}
