/**
 * ─── FireOne Profile Adapter ───────────────────────────────────────
 * Logical adapter representing FireOne export capability.
 * Validates export readiness — no physical device.
 */

import type { HardwareAdapter, HardwareCapabilities, HardwareStatusSnapshot, DeviceConnectionState, ExportProfile } from '../types';
import { createSimulatedProvenance, type ProvenanceInfo } from '../provenance';

export class FireOneProfileAdapter implements HardwareAdapter<ExportProfile> {
  readonly deviceId = 'fireone-profile';
  readonly deviceType = 'fireone-profile' as const;
  readonly label = 'FireOne Export Profile';
  private _provenance: ProvenanceInfo = createSimulatedProvenance('logical');

  private _connected: DeviceConnectionState = 'connected'; // always logical
  private _profile: ExportProfile = {
    id: 'fireone-export', type: 'fireone',
    validation_state: 'unchecked', generated_at: null,
    cue_count: 0, errors: [],
  };

  getConnectionState(): DeviceConnectionState { return this._connected; }

  getCapabilities(): HardwareCapabilities {
    return {
      canRead: true, canWrite: false, canDiagnose: true, canSimulate: true,
      canExport: true, supportsTelemetry: false, supportsContinuity: false,
      maxChannels: 0, protocols: ['fireone-fir'],
    };
  }

  getSnapshot(): HardwareStatusSnapshot {
    return {
      device_id: this.deviceId, timestamp: Date.now(), online: true,
      warnings: this._profile.validation_state === 'unchecked' ? ['Not validated'] : [],
      errors: this._profile.errors,
      metrics: {
        state: this._profile.validation_state,
        cues: this._profile.cue_count,
        generated: this._profile.generated_at ?? 'never',
      },
    };
  }

  getState(): ExportProfile { return { ...this._profile }; }
  getProvenance(): ProvenanceInfo { return { ...this._provenance, last_seen_at: Date.now(), data_freshness_ms: 0 }; }
  pollTelemetry(): void {}

  runDiagnostics(): { healthy: boolean; issues: string[] } {
    const issues: string[] = [];
    if (this._profile.validation_state === 'invalid') issues.push('Export validation failed');
    if (this._profile.cue_count === 0) issues.push('No cues to export');
    return { healthy: issues.length === 0, issues };
  }

  reset(): void {
    this._profile = { id: 'fireone-export', type: 'fireone', validation_state: 'unchecked', generated_at: null, cue_count: 0, errors: [] };
  }

  updateProfile(p: Partial<ExportProfile>): void {
    Object.assign(this._profile, p);
  }
}

export const fireOneProfileAdapter = new FireOneProfileAdapter();
