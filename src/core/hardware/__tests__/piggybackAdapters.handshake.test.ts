/**
 * Mux (CD4051) + SR (74HC595) piggy-back handshake tests.
 * Both are reported by the FXK16 host controller — promotion API
 * mirrors Battery-12V. Read-only by construction.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { muxReaderAdapter } from '../adapters/MuxReaderAdapterCD4051';
import { shiftRegisterAdapter } from '../adapters/ShiftRegisterAdapter74HC595';

describe('MuxReaderAdapterCD4051 · handshake (piggy-back FXK16)', () => {
  beforeEach(() => muxReaderAdapter.reset());

  it('starts disconnected with simulated provenance', () => {
    expect(muxReaderAdapter.getConnectionState()).toBe('disconnected');
    expect(muxReaderAdapter.getProvenance().integration_mode).toBe('not_integrated');
  });

  it('promotes/demotes via markHandshakeOk/Lost', () => {
    muxReaderAdapter.markHandshakeOk('serial_usb');
    expect(muxReaderAdapter.getConnectionState()).toBe('connected');
    expect(muxReaderAdapter.getProvenance().integration_mode).toBe('live_read_only');
    expect(muxReaderAdapter.getProvenance().transport_type).toBe('serial_usb');

    muxReaderAdapter.markHandshakeLost();
    expect(muxReaderAdapter.getConnectionState()).toBe('disconnected');
    expect(muxReaderAdapter.getProvenance().integration_mode).toBe('not_integrated');
  });

  it('remains read-only after promotion', () => {
    muxReaderAdapter.markHandshakeOk('ble');
    expect(muxReaderAdapter.getCapabilities().canWrite).toBe(false);
  });
});

describe('ShiftRegisterAdapter74HC595 · handshake (piggy-back FXK16)', () => {
  beforeEach(() => shiftRegisterAdapter.reset());

  it('starts disconnected with simulated provenance', () => {
    expect(shiftRegisterAdapter.getConnectionState()).toBe('disconnected');
    expect(shiftRegisterAdapter.getProvenance().integration_mode).toBe('not_integrated');
  });

  it('promotes/demotes via markHandshakeOk/Lost', () => {
    shiftRegisterAdapter.markHandshakeOk('serial_usb');
    expect(shiftRegisterAdapter.getConnectionState()).toBe('connected');
    expect(shiftRegisterAdapter.getProvenance().integration_mode).toBe('live_read_only');

    shiftRegisterAdapter.markHandshakeLost();
    expect(shiftRegisterAdapter.getConnectionState()).toBe('disconnected');
    expect(shiftRegisterAdapter.getProvenance().integration_mode).toBe('not_integrated');
  });

  it('remains read-only after promotion', () => {
    shiftRegisterAdapter.markHandshakeOk('serial_usb');
    expect(shiftRegisterAdapter.getCapabilities().canWrite).toBe(false);
  });
});
