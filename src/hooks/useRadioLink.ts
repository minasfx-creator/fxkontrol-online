/**
 * useRadioLink — React hook for USB radio antenna control
 * Bridges radioProtocol ↔ PBUS/FireOne transparent routing
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  type RadioDongleType,
  type RadioBand,
  type RadioState,
  type RadioDevice,
  type RadioPacketStats,
  type RadioConfig,
  type RadioDongleProfile,
  type RadioResponse,
  type TDMAConfig,
  type TDMAStatus,
  RADIO_DONGLE_PROFILES,
  BAND_FREQUENCIES,
  buildRadioPacket,
  buildDiscoveryPacket,
  buildRangeTestPacket,
  buildSetFrequencyCmd,
  buildSetPowerCmd,
  parseRadioResponse,
  wrapProtocolFrame,
  getDefaultRadioConfig,
  RadioCmd,
  TDMAScheduler,
} from '@/lib/radioProtocol';

const nav = navigator as any;

export interface RadioLinkState {
  state: RadioState;
  dongleType: RadioDongleType | null;
  dongleProfile: RadioDongleProfile | null;
  config: RadioConfig;
  devices: Map<number, RadioDevice>;
  packetStats: RadioPacketStats;
  isScanning: boolean;
  rangeTestActive: boolean;
  rangeTestRssiHistory: number[];
  tdmaStatus: TDMAStatus | null;
  error: string | null;
}

export function useRadioLink() {
  const [linkState, setLinkState] = useState<RadioLinkState>({
    state: 'disconnected',
    dongleType: null,
    dongleProfile: null,
    config: getDefaultRadioConfig(),
    devices: new Map(),
    packetStats: { totalTx: 0, totalRx: 0, ackSuccess: 0, ackFailed: 0, avgRssi: -100, channelHops: 0 },
    isScanning: false,
    rangeTestActive: false,
    rangeTestRssiHistory: [],
    error: null,
  });

  const portRef = useRef<any>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const writerRef = useRef<WritableStreamDefaultWriter<Uint8Array> | null>(null);
  const seqRef = useRef(0);
  const readLoopRef = useRef(false);
  const rangeTestIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const bufferRef = useRef(new Uint8Array(0));

  // Read loop
  const startReadLoop = useCallback(async () => {
    readLoopRef.current = true;
    while (readLoopRef.current && readerRef.current) {
      try {
        const { value, done } = await readerRef.current.read();
        if (done) break;
        if (value) {
          // Append to buffer
          const combined = new Uint8Array(bufferRef.current.length + value.length);
          combined.set(bufferRef.current);
          combined.set(value, bufferRef.current.length);
          bufferRef.current = combined;

          // Try parsing responses
          let response: RadioResponse | null;
          while ((response = parseRadioResponse(bufferRef.current)) !== null) {
            // Consume parsed bytes
            const syncIdx = bufferRef.current.indexOf(0xD5);
            const totalLen = 1 + 1 + bufferRef.current[syncIdx + 1] + 2;
            bufferRef.current = bufferRef.current.subarray(syncIdx + totalLen);

            handleResponse(response);
          }

          // Trim buffer if too large
          if (bufferRef.current.length > 4096) {
            bufferRef.current = bufferRef.current.subarray(bufferRef.current.length - 512);
          }
        }
      } catch {
        break;
      }
    }
  }, []);

  const handleResponse = useCallback((resp: RadioResponse) => {
    setLinkState(prev => {
      const stats = { ...prev.packetStats, totalRx: prev.packetStats.totalRx + 1 };
      const devices = new Map(prev.devices);

      switch (resp.cmd) {
        case RadioCmd.DISCOVER: {
          // Device discovery response
          const devType = resp.payload.length > 0 ? resp.payload[0] : 0;
          const typeMap: Record<number, RadioDevice['type']> = {
            0x01: 'C16', 0x02: 'X4', 0x03: 'IFMx', 0x04: 'PyroMote', 0x05: 'FXbutton',
          };
          devices.set(resp.srcAddr, {
            address: resp.srcAddr,
            type: typeMap[devType] || 'unknown',
            rssi: resp.rssi ?? -80,
            band: prev.config.band === 'auto' ? '433M' : prev.config.band,
            lastSeen: Date.now(),
            packetLoss: 0,
            batteryV: resp.payload.length > 1 ? resp.payload[1] / 10 : undefined,
            armed: resp.payload.length > 2 ? resp.payload[2] === 1 : undefined,
            cueCount: resp.payload.length > 3 ? resp.payload[3] : undefined,
          });
          break;
        }
        case RadioCmd.ACK: {
          stats.ackSuccess++;
          break;
        }
        case RadioCmd.RANGE_TEST: {
          const rssi = resp.rssi ?? -80;
          return {
            ...prev,
            packetStats: stats,
            rangeTestRssiHistory: [...prev.rangeTestRssiHistory.slice(-59), rssi],
          };
        }
      }

      return { ...prev, packetStats: stats, devices };
    });
  }, []);

  const sendRaw = useCallback(async (data: Uint8Array) => {
    if (!writerRef.current) throw new Error('Radio não conectado');
    await writerRef.current.write(data);
    setLinkState(prev => ({
      ...prev,
      packetStats: { ...prev.packetStats, totalTx: prev.packetStats.totalTx + 1 },
    }));
  }, []);

  // ─── Public API ───

  const connectAntenna = useCallback(async () => {
    if (!('serial' in navigator)) throw new Error('WebSerial não suportado');

    setLinkState(prev => ({ ...prev, state: 'connecting', error: null }));

    try {
      const port = await nav.serial.requestPort();
      const info = port.getInfo?.() ?? {};

      // Auto-detect dongle type
      const profile = RADIO_DONGLE_PROFILES.find(p =>
        p.vendorId && p.vendorId === info.usbVendorId
      ) || RADIO_DONGLE_PROFILES.find(p => p.type === 'generic')!;

      await port.open({
        baudRate: profile.baudRate,
        dataBits: 8,
        stopBits: 1,
        parity: 'none',
        bufferSize: 4096,
      });

      portRef.current = port;
      readerRef.current = port.readable.getReader();
      writerRef.current = port.writable.getWriter();

      setLinkState(prev => ({
        ...prev,
        state: 'connected',
        dongleType: profile.type,
        dongleProfile: profile,
      }));

      startReadLoop();

      // Set initial frequency
      const freqCmd = buildSetFrequencyCmd(BAND_FREQUENCIES[profile.bands[0] || '433M']);
      await writerRef.current!.write(freqCmd);
    } catch (err: any) {
      setLinkState(prev => ({ ...prev, state: 'error', error: err.message }));
      throw err;
    }
  }, [startReadLoop]);

  const disconnectAntenna = useCallback(async () => {
    readLoopRef.current = false;
    if (rangeTestIntervalRef.current) {
      clearInterval(rangeTestIntervalRef.current);
      rangeTestIntervalRef.current = null;
    }
    try {
      if (readerRef.current) { await readerRef.current.cancel().catch(() => {}); readerRef.current.releaseLock(); }
      if (writerRef.current) { await writerRef.current.close().catch(() => {}); writerRef.current.releaseLock(); }
      if (portRef.current) await portRef.current.close().catch(() => {});
    } catch { /* ignore */ }
    portRef.current = null;
    readerRef.current = null;
    writerRef.current = null;
    setLinkState(prev => ({
      ...prev,
      state: 'disconnected',
      dongleType: null,
      dongleProfile: null,
      devices: new Map(),
      rangeTestActive: false,
      rangeTestRssiHistory: [],
    }));
  }, []);

  const scanDevices = useCallback(async () => {
    if (linkState.state !== 'connected') return;
    setLinkState(prev => ({ ...prev, isScanning: true, devices: new Map() }));

    // Scan on current band
    for (let addr = 1; addr <= 64; addr++) {
      const pkt = buildDiscoveryPacket(0x00, seqRef.current++);
      await sendRaw(pkt);
      await new Promise(r => setTimeout(r, 30));
    }

    // If auto band, also scan other band
    if (linkState.config.band === 'auto') {
      const altFreq = linkState.config.frequency === 433.92 ? 868.35 : 433.92;
      await sendRaw(buildSetFrequencyCmd(altFreq));
      await new Promise(r => setTimeout(r, 100));
      for (let addr = 1; addr <= 64; addr++) {
        const pkt = buildDiscoveryPacket(0x00, seqRef.current++);
        await sendRaw(pkt);
        await new Promise(r => setTimeout(r, 30));
      }
      // Switch back
      await sendRaw(buildSetFrequencyCmd(linkState.config.frequency));
    }

    await new Promise(r => setTimeout(r, 500));
    setLinkState(prev => ({ ...prev, isScanning: false }));
  }, [linkState.state, linkState.config, sendRaw]);

  const sendPBus = useCallback(async (addr: number, protocolFrame: Uint8Array) => {
    const pkt = wrapProtocolFrame(addr, 0x00, seqRef.current++, protocolFrame);
    await sendRaw(pkt);
  }, [sendRaw]);

  const sendFireOne = useCallback(async (addr: number, protocolFrame: Uint8Array) => {
    const pkt = wrapProtocolFrame(addr, 0x00, seqRef.current++, protocolFrame);
    await sendRaw(pkt);
  }, [sendRaw]);

  const setBand = useCallback(async (band: RadioBand) => {
    const freq = BAND_FREQUENCIES[band] || 433.92;
    await sendRaw(buildSetFrequencyCmd(freq));
    setLinkState(prev => ({
      ...prev,
      config: { ...prev.config, band, frequency: freq },
    }));
  }, [sendRaw]);

  const setTxPower = useCallback(async (dbm: number) => {
    await sendRaw(buildSetPowerCmd(dbm));
    setLinkState(prev => ({
      ...prev,
      config: { ...prev.config, txPowerDbm: dbm },
    }));
  }, [sendRaw]);

  const startRangeTest = useCallback(async (targetAddr: number) => {
    setLinkState(prev => ({ ...prev, rangeTestActive: true, rangeTestRssiHistory: [] }));
    rangeTestIntervalRef.current = setInterval(async () => {
      try {
        const pkt = buildRangeTestPacket(targetAddr, 0x00, seqRef.current++);
        await sendRaw(pkt);
      } catch { /* ignore */ }
    }, 1000);
  }, [sendRaw]);

  const stopRangeTest = useCallback(() => {
    if (rangeTestIntervalRef.current) {
      clearInterval(rangeTestIntervalRef.current);
      rangeTestIntervalRef.current = null;
    }
    setLinkState(prev => ({ ...prev, rangeTestActive: false }));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      readLoopRef.current = false;
      if (rangeTestIntervalRef.current) clearInterval(rangeTestIntervalRef.current);
    };
  }, []);

  return {
    ...linkState,
    isConnected: linkState.state === 'connected',
    connectAntenna,
    disconnectAntenna,
    scanDevices,
    sendPBus,
    sendFireOne,
    setBand,
    setTxPower,
    startRangeTest,
    stopRangeTest,
  };
}
