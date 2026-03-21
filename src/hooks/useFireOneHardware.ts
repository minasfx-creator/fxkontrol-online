/**
 * useFireOneHardware — React hook bridging FireOneController ↔ component state
 * Supports wired RS-485 + wireless IFMx-i32Q with RSSI polling and auto-fallback
 * Transparent radio fallback via useRadioLink when antenna connected
 * UltraFire mode: download fire files to modules for autonomous firing
 * Priority Disable: 16 groups for selective product disabling
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  getFireOneController,
  FIREONE_MAX_MODULES,
  type FireOneModuleStatus,
  type FireOneEvent,
  type FireOneModuleConfig,
  type FireOneWirelessStatus,
  type FireOneWirelessConfig,
  type WirelessConnectionMode,
  type UltraFireCueData,
  buildDmxOutCommand,
  buildModuleConfigQuery,
  buildWirelessStatusQuery,
  buildWirelessConfigCommand,
  clampFireDuration,
} from '@/lib/fireoneProtocol';
import { useRadioLink } from '@/hooks/useRadioLink';

export interface FireOneHardwareState {
  isConnected: boolean;
  modules: Map<number, FireOneModuleStatus>;
  connectionError: string | null;
  lastHeartbeat: number | null;
  txBytes: number;
  rxBytes: number;
  scanning: boolean;
  // UltraFire
  ultraFireMode: boolean;
  verifyCode: string | null;
  ultraFireVerifiedModules: number[];
  ultraFireDownloading: boolean;
  // Priority Disable (1–16 → enabled)
  priorities: Map<number, boolean>;
}

const RSSI_POLL_INTERVAL = 3000;

export function useFireOneHardware() {
  const [state, setState] = useState<FireOneHardwareState>({
    isConnected: false,
    modules: new Map(),
    connectionError: null,
    lastHeartbeat: null,
    txBytes: 0,
    rxBytes: 0,
    scanning: false,
    ultraFireMode: false,
    verifyCode: null,
    ultraFireVerifiedModules: [],
    ultraFireDownloading: false,
    priorities: new Map(Array.from({ length: 16 }, (_, i) => [i + 1, true])),
  });

  const txRef = useRef(0);
  const rxRef = useRef(0);
  const wirelessPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const controller = getFireOneController();
  const radioLink = useRadioLink();

  // Connection path
  const connectionPath = useMemo((): 'wired' | 'radio' | 'none' => {
    if (state.isConnected) return 'wired';
    if (radioLink.isConnected) return 'radio';
    return 'none';
  }, [state.isConnected, radioLink.isConnected]);

  const effectivelyConnected = connectionPath !== 'none';

  // Computed wireless/wired counts
  const wirelessModuleCount = useMemo(() => {
    let count = 0;
    state.modules.forEach(m => { if (m.connectionMode === 'wireless' || m.connectionMode === 'fallback') count++; });
    return count;
  }, [state.modules]);

  const wiredModuleCount = useMemo(() => {
    let count = 0;
    state.modules.forEach(m => { if (m.connectionMode === 'wired' || !m.connectionMode) count++; });
    return count;
  }, [state.modules]);

  // Worst RSSI across all wireless modules
  const worstRssi = useMemo(() => {
    let worst: number | null = null;
    state.modules.forEach(m => {
      if (m.rssiDbm !== undefined && m.connectionMode !== 'wired') {
        if (worst === null || m.rssiDbm < worst) worst = m.rssiDbm;
      }
    });
    return worst;
  }, [state.modules]);

  // Subscribe to controller events
  useEffect(() => {
    const unsubscribe = controller.on((event: FireOneEvent) => {
      rxRef.current += 8;

      switch (event.type) {
        case 'module-discovered':
        case 'status-update': {
          const status = event.data as FireOneModuleStatus;
          setState(prev => {
            const newModules = new Map(prev.modules);
            newModules.set(event.moduleAddress, status);
            return { ...prev, modules: newModules, rxBytes: rxRef.current };
          });
          break;
        }

        case 'continuity-result':
        case 'fire-confirm':
        case 'arm-confirm':
        case 'emergency-stop': {
          const updatedModules = controller.discoveredModules;
          setState(prev => {
            const newModules = new Map(prev.modules);
            updatedModules.forEach(m => newModules.set(m.moduleAddress, m));
            return { ...prev, modules: newModules, rxBytes: rxRef.current };
          });
          break;
        }

        case 'heartbeat': {
          setState(prev => ({ ...prev, lastHeartbeat: event.timestamp, rxBytes: rxRef.current }));
          break;
        }

        case 'wireless-status': {
          const ws = event.data as FireOneWirelessStatus;
          setState(prev => {
            const newModules = new Map(prev.modules);
            const existing = newModules.get(event.moduleAddress);
            if (existing) {
              newModules.set(event.moduleAddress, {
                ...existing,
                rssiDbm: ws.rssiDbm,
                wirelessChannel: ws.channel,
                packetLoss: ws.packetLoss,
                linkQuality: ws.linkQuality,
                connectionMode: ws.mode,
                wireless: ws.mode !== 'wired',
              });
            }
            return { ...prev, modules: newModules, rxBytes: rxRef.current };
          });
          break;
        }

        case 'wireless-fallback': {
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
            return { ...prev, modules: newModules, rxBytes: rxRef.current };
          });
          break;
        }

        case 'ultrafire-verify': {
          const { verified } = event.data as { verified: boolean };
          if (verified) {
            setState(prev => ({
              ...prev,
              ultraFireVerifiedModules: [...prev.ultraFireVerifiedModules, event.moduleAddress],
              rxBytes: rxRef.current,
            }));
          }
          break;
        }

        case 'ultrafire-download-progress': {
          break;
        }

        case 'priority-update': {
          const { priority, enabled } = event.data as { priority: number; enabled: boolean };
          setState(prev => {
            const newPriorities = new Map(prev.priorities);
            newPriorities.set(priority, enabled);
            return { ...prev, priorities: newPriorities, rxBytes: rxRef.current };
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

  // Wireless RSSI polling — poll every 3s when connected
  useEffect(() => {
    if (!state.isConnected) {
      if (wirelessPollRef.current) { clearInterval(wirelessPollRef.current); wirelessPollRef.current = null; }
      return;
    }

    wirelessPollRef.current = setInterval(() => {
      state.modules.forEach((m) => {
        if (m.wireless || m.connectionMode === 'wireless' || m.connectionMode === 'fallback') {
          const frame = buildWirelessStatusQuery(m.moduleAddress);
          txRef.current += frame.length;
          controller.send(frame).catch(() => {});
        }
      });
      setState(prev => ({ ...prev, txBytes: txRef.current }));
    }, RSSI_POLL_INTERVAL);

    return () => { if (wirelessPollRef.current) clearInterval(wirelessPollRef.current); };
  }, [state.isConnected, state.modules, controller]);

  const connect = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, connectionError: null }));
      await controller.connect();
      setState(prev => ({ ...prev, isConnected: true }));
    } catch (err: any) {
      setState(prev => ({ ...prev, isConnected: false, connectionError: err.message || 'Failed to connect' }));
      throw err;
    }
  }, [controller]);

  const disconnect = useCallback(async () => {
    await controller.disconnect();
    setState(prev => ({ ...prev, isConnected: false, modules: new Map(), lastHeartbeat: null }));
  }, [controller]);

  const armModule = useCallback(async (addr: number) => {
    txRef.current += 5; setState(prev => ({ ...prev, txBytes: txRef.current }));
    await controller.armModule(addr);
  }, [controller]);

  const disarmModule = useCallback(async (addr: number) => {
    txRef.current += 5; setState(prev => ({ ...prev, txBytes: txRef.current }));
    await controller.disarmModule(addr);
  }, [controller]);

  const fireIgniter = useCallback(async (addr: number, pin: number, durationMs = 500) => {
    const safeDuration = clampFireDuration(durationMs);
    // Radio fallback
    if (!state.isConnected && radioLink.isConnected) {
      const frame = new Uint8Array([0x46, 0x4F, addr, 0x10, pin, (safeDuration >> 8) & 0xFF, safeDuration & 0xFF]);
      await radioLink.sendFireOne(addr, frame);
      return;
    }
    txRef.current += 8; setState(prev => ({ ...prev, txBytes: txRef.current }));
    await controller.fireIgniter(addr, pin, safeDuration);
  }, [controller, state.isConnected, radioLink]);

  const requestContinuity = useCallback(async (addr: number) => {
    txRef.current += 5; setState(prev => ({ ...prev, txBytes: txRef.current }));
    await controller.requestContinuity(addr);
  }, [controller]);

  /** Discover modules — default 40 per XLII+ manual */
  const discoverModules = useCallback(async (maxAddr = FIREONE_MAX_MODULES) => {
    setState(prev => ({ ...prev, scanning: true }));
    try {
      await controller.discoverModules(maxAddr);
      await new Promise(r => setTimeout(r, maxAddr * 60));
    } finally {
      setState(prev => ({ ...prev, scanning: false }));
    }
  }, [controller]);

  const emergencyStop = useCallback(async () => {
    // E-STOP goes through ALL paths simultaneously
    if (radioLink.isConnected) {
      const frame = new Uint8Array([0x46, 0x4F, 0xFF, 0xFF]);
      await radioLink.sendFireOne(0xFF, frame).catch(() => {});
    }
    if (state.isConnected) {
      txRef.current += 15; setState(prev => ({ ...prev, txBytes: txRef.current }));
      await controller.emergencyStop();
    }
  }, [controller, state.isConnected, radioLink]);

  const armAll = useCallback(async () => {
    if (!state.isConnected && radioLink.isConnected) {
      const frame = new Uint8Array([0x46, 0x4F, 0xFF, 0x20]);
      await radioLink.sendFireOne(0xFF, frame);
      return;
    }
    txRef.current += 5; setState(prev => ({ ...prev, txBytes: txRef.current }));
    await controller.armAll();
  }, [controller, state.isConnected, radioLink]);

  const disarmAll = useCallback(async () => {
    if (!state.isConnected && radioLink.isConnected) {
      const frame = new Uint8Array([0x46, 0x4F, 0xFF, 0x21]);
      await radioLink.sendFireOne(0xFF, frame);
      return;
    }
    txRef.current += 5; setState(prev => ({ ...prev, txBytes: txRef.current }));
    await controller.disarmAll();
  }, [controller, state.isConnected, radioLink]);

  const syncTimecode = useCallback(async (ms: number) => {
    txRef.current += 9; setState(prev => ({ ...prev, txBytes: txRef.current }));
    await controller.syncTimecode(ms);
  }, [controller]);

  const sendDmxOut = useCallback(async (moduleAddr: number, startChannel: number, values: number[]) => {
    const frame = buildDmxOutCommand(moduleAddr, startChannel, values);
    txRef.current += frame.length; setState(prev => ({ ...prev, txBytes: txRef.current }));
    await controller.send(frame);
  }, [controller]);

  const queryModuleConfig = useCallback(async (moduleAddr: number) => {
    const frame = buildModuleConfigQuery(moduleAddr);
    txRef.current += frame.length; setState(prev => ({ ...prev, txBytes: txRef.current }));
    await controller.send(frame);
  }, [controller]);

  const queryWirelessStatus = useCallback(async (moduleAddr: number) => {
    const frame = buildWirelessStatusQuery(moduleAddr);
    txRef.current += frame.length; setState(prev => ({ ...prev, txBytes: txRef.current }));
    await controller.send(frame);
  }, [controller]);

  const setWirelessConfig = useCallback(async (moduleAddr: number, config: FireOneWirelessConfig) => {
    const frame = buildWirelessConfigCommand(moduleAddr, config);
    txRef.current += frame.length; setState(prev => ({ ...prev, txBytes: txRef.current }));
    await controller.send(frame);
  }, [controller]);

  // ═══════════════════════════════════════════════════════════
  // UltraFire mode
  // ═══════════════════════════════════════════════════════════

  const enableUltraFire = useCallback((verifyCode: string) => {
    setState(prev => ({
      ...prev,
      ultraFireMode: true,
      verifyCode,
      ultraFireVerifiedModules: [],
    }));
  }, []);

  const disableUltraFire = useCallback(() => {
    setState(prev => ({
      ...prev,
      ultraFireMode: false,
      verifyCode: null,
      ultraFireVerifiedModules: [],
      ultraFireDownloading: false,
    }));
  }, []);

  /** Download fire cues to all relevant modules */
  const downloadToModules = useCallback(async (cuesByModule: Map<number, UltraFireCueData[]>, verifyCode: number) => {
    setState(prev => ({ ...prev, ultraFireDownloading: true, ultraFireVerifiedModules: [] }));
    try {
      for (const [addr, cues] of cuesByModule.entries()) {
        txRef.current += 3 + cues.length * 8;
        setState(prev => ({ ...prev, txBytes: txRef.current }));
        await controller.downloadUltraFire(addr, verifyCode, cues);
        await new Promise(r => setTimeout(r, 100)); // gap between modules
      }
      // Verify all
      txRef.current += 7;
      setState(prev => ({ ...prev, txBytes: txRef.current }));
      await controller.verifyUltraFire(verifyCode);
    } finally {
      setState(prev => ({ ...prev, ultraFireDownloading: false }));
    }
  }, [controller]);

  const startUltraFire = useCallback(async () => {
    txRef.current += 5; setState(prev => ({ ...prev, txBytes: txRef.current }));
    await controller.startUltraFire();
  }, [controller]);

  // ═══════════════════════════════════════════════════════════
  // Priority Disable
  // ═══════════════════════════════════════════════════════════

  const setPriorityDisable = useCallback(async (priority: number, enabled: boolean) => {
    txRef.current += 7; setState(prev => ({ ...prev, txBytes: txRef.current }));
    await controller.setPriorityDisable(priority, enabled);
    setState(prev => {
      const newPriorities = new Map(prev.priorities);
      newPriorities.set(priority, enabled);
      return { ...prev, priorities: newPriorities };
    });
  }, [controller]);

  // ═══════════════════════════════════════════════════════════
  // Presets
  // ═══════════════════════════════════════════════════════════

  const loadPreset = useCallback(async (moduleAddr: number, igniterPos: number) => {
    txRef.current += 7; setState(prev => ({ ...prev, txBytes: txRef.current }));
    await controller.loadPreset(moduleAddr, igniterPos);
  }, [controller]);

  const firePresets = useCallback(async () => {
    txRef.current += 5; setState(prev => ({ ...prev, txBytes: txRef.current }));
    await controller.firePresets();
  }, [controller]);

  const clearPresets = useCallback(async () => {
    txRef.current += 5; setState(prev => ({ ...prev, txBytes: txRef.current }));
    await controller.clearPresets();
  }, [controller]);

  return {
    ...state,
    isConnected: effectivelyConnected,
    connectionPath,
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
    queryWirelessStatus,
    setWirelessConfig,
    wirelessModuleCount,
    wiredModuleCount,
    worstRssi,
    // UltraFire
    enableUltraFire,
    disableUltraFire,
    downloadToModules,
    startUltraFire,
    // Priority
    setPriorityDisable,
    // Presets
    loadPreset,
    firePresets,
    clearPresets,
  };
}
