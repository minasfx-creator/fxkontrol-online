/**
 * useFireOneModuleMode — React hook for IFMx-i32Q virtual module mode
 * 
 * Instantiates the module emulator and hardware bridge,
 * provides reactive state for the VirtualIFMx32QPanel UI.
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { FireOneModuleEmulator, type ModuleStatus, type ModuleState } from '@/lib/fireoneModuleEmulator';
import { FireOneHardwareBridge, type BridgeStatus, type BridgeTransport } from '@/lib/fireoneModuleHardwareBridge';
import { toast } from 'sonner';

export interface UseFireOneModuleReturn {
  // Module state
  status: ModuleStatus | null;
  powered: boolean;
  // Actions
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
      } else if (event === 'disconnected') {
        toast.info('Hardware desconectado');
        setBridgeStatus(bridge.getStatus());
      }
    });
    bridgeRef.current = bridge;
    setBridgeStatus(bridge.getStatus());

    return () => {
      bridge.disconnect();
    };
  }, []);

  const powerOn = useCallback(() => {
    const bridge = bridgeRef.current;
    const emu = new FireOneModuleEmulator({
      simulateHardware: !bridge?.getStatus().connected,
      onFire: bridge ? (pin, dur) => bridge.fire(pin, dur) : undefined,
      onContinuityRead: bridge ? (pin) => bridge.readContinuity(pin) : undefined,
      onStateChange: (_state: ModuleState) => {
        // Update through status
      },
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

  const arm = useCallback(() => {
    return emulatorRef.current?.arm() ?? false;
  }, []);

  const disarm = useCallback(() => {
    emulatorRef.current?.disarm();
  }, []);

  const eStop = useCallback(() => {
    emulatorRef.current?.eStop();
    bridgeRef.current?.eStop();
    toast.error('🛑 E-STOP ATIVADO');
  }, []);

  const fire = useCallback(async (pin: number, duration: number) => {
    return emulatorRef.current?.fire(pin, duration) ?? false;
  }, []);

  const fireGroup = useCallback(async (pins: number[], duration: number) => {
    return emulatorRef.current?.fireGroup(pins, duration) ?? [];
  }, []);

  const readContinuity = useCallback(async (pin: number) => {
    return emulatorRef.current?.readContinuity(pin) ?? 0;
  }, []);

  const readAllContinuity = useCallback(async () => {
    return emulatorRef.current?.readAllContinuity() ?? [];
  }, []);

  const setAddress = useCallback((addr: number) => {
    emulatorRef.current?.setAddress(addr);
  }, []);

  const connectBLE = useCallback(async () => {
    return bridgeRef.current?.connectBLE() ?? false;
  }, []);

  const connectUSB = useCallback(async () => {
    return bridgeRef.current?.connectUSB() ?? false;
  }, []);

  const connectWS = useCallback(async (url?: string) => {
    return bridgeRef.current?.connectWebSocket(url) ?? false;
  }, []);

  const disconnectHardware = useCallback(async () => {
    await bridgeRef.current?.disconnect();
    setBridgeStatus(bridgeRef.current?.getStatus() ?? null);
  }, []);

  return {
    status, powered,
    powerOn, powerOff, arm, disarm, eStop,
    fire, fireGroup, readContinuity, readAllContinuity, setAddress,
    bridgeStatus, connectBLE, connectUSB, connectWS, disconnectHardware,
  };
}
