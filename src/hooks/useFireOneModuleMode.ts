/**
 * useFireOneModuleMode — React hook for IFMx-i32Q virtual module mode
 * 
 * Instantiates the module emulator and hardware bridge,
 * provides reactive state for the VirtualIFMx32QPanel UI.
 * Dynamically reconnects bridge callbacks when hardware connects after powerOn.
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { FireOneModuleEmulator, type ModuleStatus, type ModuleState, type FiringMode, type ScriptEvent } from '@/lib/fireoneModuleEmulator';
import { FireOneHardwareBridge, type BridgeStatus } from '@/lib/fireoneModuleHardwareBridge';
import { toast } from 'sonner';

export interface UseFireOneModuleReturn {
  status: ModuleStatus | null;
  powered: boolean;
  powerOn: () => void;
  powerOff: () => void;
  arm: () => boolean;
  disarm: () => void;
  eStop: () => void;
  fire: (pin: number, duration: number) => Promise<boolean>;
  fireGroup: (pins: number[], duration: number) => Promise<boolean[]>;
  readContinuity: (pin: number) => Promise<number>;
  readAllContinuity: () => Promise<number[]>;
  setAddress: (addr: number) => void;
  // Firing modes
  setFiringMode: (mode: FiringMode) => void;
  loadSemiAutoScript: (events: ScriptEvent[]) => void;
  stepEvent: () => Promise<boolean>;
  resetSemiAuto: () => void;
  loadAutoScript: (events: ScriptEvent[]) => void;
  startAutoFire: () => void;
  stopAutoFire: () => void;
  downloadUltraScript: (slot: number, events: ScriptEvent[], code: string) => void;
  setUltraSlot: (slot: number) => void;
  startUltraFire: () => void;
  stopUltraFire: () => void;
  setPreset: (pins: number[]) => void;
  firePreset: () => Promise<boolean[]>;
  clearPreset: () => void;
  // Hardware bridge
  bridgeStatus: BridgeStatus | null;
  connectBLE: () => Promise<boolean>;
  connectUSB: () => Promise<boolean>;
  connectWS: (url?: string) => Promise<boolean>;
  disconnectHardware: () => Promise<void>;
}

export function useFireOneModuleMode(): UseFireOneModuleReturn {
  const [status, setStatus] = useState<ModuleStatus | null>(null);
  const [powered, setPowered] = useState(false);
  const [bridgeStatus, setBridgeStatus] = useState<BridgeStatus | null>(null);
  
  const emulatorRef = useRef<FireOneModuleEmulator | null>(null);
  const bridgeRef = useRef<FireOneHardwareBridge | null>(null);

  // Initialize bridge
  useEffect(() => {
    const bridge = new FireOneHardwareBridge((event, data) => {
      if (event === 'connected') {
        toast.success(`Hardware conectado: ${(data as any)?.device}`);
        setBridgeStatus(bridge.getStatus());
        // Dynamically update emulator callbacks
        const emu = emulatorRef.current;
        if (emu) {
          emu.onFire = (pin, dur) => bridge.fire(pin, dur);
          emu.onContinuityRead = (pin) => bridge.readContinuity(pin);
        }
      } else if (event === 'disconnected') {
        toast.info('Hardware desconectado');
        setBridgeStatus(bridge.getStatus());
      } else if (event === 'heartbeat_timeout') {
        toast.warning('Hardware sem resposta — desconectado');
        setBridgeStatus(bridge.getStatus());
      }
    });
    bridgeRef.current = bridge;
    setBridgeStatus(bridge.getStatus());

    return () => { bridge.disconnect(); };
  }, []);

  // Poll bridgeStatus every 1s to keep UI in sync
  useEffect(() => {
    const interval = setInterval(() => {
      const bridge = bridgeRef.current;
      if (bridge) setBridgeStatus(bridge.getStatus());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const powerOn = useCallback(() => {
    const bridge = bridgeRef.current;
    const bridgeConnected = bridge?.getStatus().connected ?? false;
    const emu = new FireOneModuleEmulator({
      simulateHardware: !bridgeConnected,
      onFire: bridgeConnected && bridge ? (pin, dur) => bridge.fire(pin, dur) : undefined,
      onContinuityRead: bridgeConnected && bridge ? (pin) => bridge.readContinuity(pin) : undefined,
      onStateChange: (_state: ModuleState) => {},
      onStatusUpdate: (s) => setStatus({ ...s }),
    });
    emulatorRef.current = emu;
    emu.powerOn();
    setPowered(true);
  }, []);

  const powerOff = useCallback(() => {
    emulatorRef.current?.powerOff();
    emulatorRef.current?.destroy();
    emulatorRef.current = null;
    setStatus(null);
    setPowered(false);
  }, []);

  const arm = useCallback(() => emulatorRef.current?.arm() ?? false, []);
  const disarm = useCallback(() => { emulatorRef.current?.disarm(); }, []);

  const eStop = useCallback(() => {
    emulatorRef.current?.eStop();
    bridgeRef.current?.eStop();
    toast.error('🛑 E-STOP ATIVADO — Lockout 3s');
  }, []);

  const fire = useCallback(async (pin: number, duration: number) =>
    emulatorRef.current?.fire(pin, duration) ?? false, []);

  const fireGroup = useCallback(async (pins: number[], duration: number) =>
    emulatorRef.current?.fireGroup(pins, duration) ?? [], []);

  const readContinuity = useCallback(async (pin: number) =>
    emulatorRef.current?.readContinuity(pin) ?? 0, []);

  const readAllContinuity = useCallback(async () =>
    emulatorRef.current?.readAllContinuity() ?? [], []);

  const setAddress = useCallback((addr: number) => {
    emulatorRef.current?.setAddress(addr);
  }, []);

  // ─── Firing mode controls ──────────────────────────────

  const setFiringMode = useCallback((mode: FiringMode) => {
    emulatorRef.current?.setFiringMode(mode);
  }, []);

  const loadSemiAutoScript = useCallback((events: ScriptEvent[]) => {
    emulatorRef.current?.loadSemiAutoScript(events);
  }, []);

  const stepEvent = useCallback(async () =>
    emulatorRef.current?.stepEvent() ?? false, []);

  const resetSemiAuto = useCallback(() => {
    emulatorRef.current?.resetSemiAuto();
  }, []);

  const loadAutoScript = useCallback((events: ScriptEvent[]) => {
    emulatorRef.current?.loadAutoScript(events);
  }, []);

  const startAutoFire = useCallback(() => {
    emulatorRef.current?.startAutoFire();
  }, []);

  const stopAutoFire = useCallback(() => {
    emulatorRef.current?.stopAuto();
  }, []);

  const downloadUltraScript = useCallback((slot: number, events: ScriptEvent[], code: string) => {
    emulatorRef.current?.downloadScript(slot, events, code);
  }, []);

  const setUltraSlot = useCallback((slot: number) => {
    emulatorRef.current?.setUltraSlot(slot);
  }, []);

  const startUltraFire = useCallback(() => {
    emulatorRef.current?.startUltraFire();
  }, []);

  const stopUltraFire = useCallback(() => {
    emulatorRef.current?.stopUltraFire();
  }, []);

  const setPreset = useCallback((pins: number[]) => {
    emulatorRef.current?.setPreset(pins);
  }, []);

  const firePreset = useCallback(async () =>
    emulatorRef.current?.firePreset() ?? [], []);

  const clearPreset = useCallback(() => {
    emulatorRef.current?.clearPreset();
  }, []);

  // ─── Bridge connections ────────────────────────────────

  const connectBLE = useCallback(async () => {
    const ok = await (bridgeRef.current?.connectBLE() ?? false);
    setBridgeStatus(bridgeRef.current?.getStatus() ?? null);
    return ok;
  }, []);

  const connectUSB = useCallback(async () => {
    const ok = await (bridgeRef.current?.connectUSB() ?? false);
    setBridgeStatus(bridgeRef.current?.getStatus() ?? null);
    return ok;
  }, []);

  const connectWS = useCallback(async (url?: string) => {
    const ok = await (bridgeRef.current?.connectWebSocket(url) ?? false);
    setBridgeStatus(bridgeRef.current?.getStatus() ?? null);
    return ok;
  }, []);

  const disconnectHardware = useCallback(async () => {
    await bridgeRef.current?.disconnect();
    setBridgeStatus(bridgeRef.current?.getStatus() ?? null);
  }, []);

  return {
    status, powered,
    powerOn, powerOff, arm, disarm, eStop,
    fire, fireGroup, readContinuity, readAllContinuity, setAddress,
    setFiringMode, loadSemiAutoScript, stepEvent, resetSemiAuto,
    loadAutoScript, startAutoFire, stopAutoFire,
    downloadUltraScript, setUltraSlot, startUltraFire, stopUltraFire,
    setPreset, firePreset, clearPreset,
    bridgeStatus, connectBLE, connectUSB, connectWS, disconnectHardware,
  };
}
