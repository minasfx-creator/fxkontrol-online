/**
 * ─── Hardware Test Data Loader ─────────────────────────────────────
 * Seeds all adapters with realistic test scenarios.
 * Tests: online/offline devices, low battery, degraded links,
 * mixed continuity states, fault channels.
 */

import { arduinoNanoAdapter } from './adapters/ArduinoNanoAdapter';
import { shiftRegisterAdapter } from './adapters/ShiftRegisterAdapter74HC595';
import { muxReaderAdapter } from './adapters/MuxReaderAdapterCD4051';
import { relayBankAdapter } from './adapters/RelayBankAdapter32';
import { batteryMonitorAdapter } from './adapters/BatteryMonitorAdapter';
import { artNetNodeAdapter } from './adapters/ArtNetNodeAdapter';
import { fireOneProfileAdapter } from './adapters/FireOneProfileAdapter';
import { deviceEventLog } from './DeviceEventLog';

export type TestScenario = 'healthy' | 'degraded' | 'critical' | 'mixed';

export function loadHardwareTestData(scenario: TestScenario = 'mixed'): void {
  // Reset all
  arduinoNanoAdapter.reset();
  shiftRegisterAdapter.reset();
  muxReaderAdapter.reset();
  relayBankAdapter.reset();
  batteryMonitorAdapter.reset();
  artNetNodeAdapter.reset();
  fireOneProfileAdapter.reset();

  deviceEventLog.log('system', 'state_change', `Loading test scenario: ${scenario}`);

  switch (scenario) {
    case 'healthy':
      _loadHealthy();
      break;
    case 'degraded':
      _loadDegraded();
      break;
    case 'critical':
      _loadCritical();
      break;
    case 'mixed':
    default:
      _loadMixed();
      break;
  }

  deviceEventLog.log('system', 'state_change', `Test scenario "${scenario}" loaded`);
}

function _loadHealthy(): void {
  arduinoNanoAdapter.simulateConnect();
  shiftRegisterAdapter.simulateConnect();
  muxReaderAdapter.simulateConnect();
  relayBankAdapter.simulateConnect();
  batteryMonitorAdapter.simulateConnect(12.4);
  artNetNodeAdapter.simulateConnect('192.168.1.100', [1, 2, 3]);

  // All relay channels OK
  for (let i = 0; i < 32; i++) {
    relayBankAdapter.simulateChannel(i, 'ok', 1.2 + Math.random() * 0.8);
  }

  // All MUX channels OK
  for (let i = 0; i < 16; i++) {
    muxReaderAdapter.simulateChannelState(i, 'ok');
  }

  fireOneProfileAdapter.updateProfile({ validation_state: 'valid', cue_count: 6 });
}

function _loadDegraded(): void {
  arduinoNanoAdapter.simulateConnect();
  shiftRegisterAdapter.simulateConnect();
  muxReaderAdapter.simulateConnect();
  relayBankAdapter.simulateConnect();
  batteryMonitorAdapter.simulateConnect(11.3); // low-ish
  artNetNodeAdapter.simulateConnect('192.168.1.100', [1, 2]);
  artNetNodeAdapter.simulateDegraded(); // degraded link

  // Most channels OK, some open
  for (let i = 0; i < 32; i++) {
    if (i === 5 || i === 12 || i === 23) {
      relayBankAdapter.simulateChannel(i, 'open', 99999);
    } else {
      relayBankAdapter.simulateChannel(i, 'ok', 1.2 + Math.random() * 0.8);
    }
  }

  for (let i = 0; i < 16; i++) {
    if (i === 3 || i === 11) {
      muxReaderAdapter.simulateChannelState(i, 'open');
    } else {
      muxReaderAdapter.simulateChannelState(i, 'ok');
    }
  }

  fireOneProfileAdapter.updateProfile({ validation_state: 'valid', cue_count: 4 });
}

function _loadCritical(): void {
  arduinoNanoAdapter.simulateConnect();
  shiftRegisterAdapter.simulateFault(); // SPI fault
  muxReaderAdapter.simulateConnect();
  muxReaderAdapter.simulateMuxFault('mux-a');
  relayBankAdapter.simulateConnect();
  batteryMonitorAdapter.simulateConnect(10.8);
  batteryMonitorAdapter.simulateLowBattery();
  artNetNodeAdapter.simulateDisconnect(); // offline

  // Several shorts and opens
  for (let i = 0; i < 32; i++) {
    if (i < 5) relayBankAdapter.simulateChannel(i, 'short', 0.01);
    else if (i < 12) relayBankAdapter.simulateChannel(i, 'open', 99999);
    else relayBankAdapter.simulateChannel(i, 'ok', 1.5);
  }

  for (let i = 0; i < 8; i++) muxReaderAdapter.simulateChannelState(i, 'short');
  for (let i = 8; i < 16; i++) muxReaderAdapter.simulateChannelState(i, 'ok');

  fireOneProfileAdapter.updateProfile({ validation_state: 'invalid', cue_count: 0, errors: ['No valid cues'] });
}

function _loadMixed(): void {
  // Arduino: online
  arduinoNanoAdapter.simulateConnect();
  deviceEventLog.log('arduino-nano-01', 'connected', 'Arduino Nano connected — FXK-NANO-v2.4.1');

  // Shift register: online
  shiftRegisterAdapter.simulateConnect();
  deviceEventLog.log('sr-74hc595-chain', 'connected', '74HC595 chain online — 32 outputs');

  // MUX: online with mixed channels
  muxReaderAdapter.simulateConnect();
  for (let i = 0; i < 16; i++) {
    if (i === 4) muxReaderAdapter.simulateChannelState(i, 'short');
    else if (i === 9 || i === 14) muxReaderAdapter.simulateChannelState(i, 'open');
    else muxReaderAdapter.simulateChannelState(i, 'ok');
  }
  deviceEventLog.log('mux-cd4051-dual', 'warning', 'Channel 4: SHORT detected (0.01Ω)');
  deviceEventLog.log('mux-cd4051-dual', 'warning', 'Channels 9, 14: OPEN');

  // Relay bank: mostly healthy, 2 faults
  relayBankAdapter.simulateConnect();
  for (let i = 0; i < 32; i++) {
    if (i === 7) relayBankAdapter.simulateChannel(i, 'short', 0.01);
    else if (i === 19) relayBankAdapter.simulateChannel(i, 'open', 99999);
    else relayBankAdapter.simulateChannel(i, 'ok', 1.0 + Math.random() * 1.2);
  }
  deviceEventLog.log('relay-bank-32ch', 'error', 'Channel 7: SHORT circuit');
  deviceEventLog.log('relay-bank-32ch', 'warning', 'Channel 19: OPEN');

  // Battery: normal
  batteryMonitorAdapter.simulateConnect(12.2);
  deviceEventLog.log('battery-12v', 'connected', 'Battery: 12.2V (87%)');

  // Art-Net: degraded
  artNetNodeAdapter.simulateConnect('192.168.1.100', [1, 2, 3]);
  artNetNodeAdapter.simulateDegraded();
  deviceEventLog.log('artnet-node-01', 'warning', 'Art-Net link degraded — high latency');

  // FireOne: valid
  fireOneProfileAdapter.updateProfile({ validation_state: 'valid', cue_count: 6 });
  deviceEventLog.log('fireone-profile', 'state_change', 'Export profile validated: 6 cues');
}
