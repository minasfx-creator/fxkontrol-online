/**
 * ─── Passive Telemetry Ingestion Layer ─────────────────────────────
 * Read-only ingestion of snapshots from files, logs, or passive feeds.
 * NO write commands. Supports JSON/CSV snapshot import and replay.
 */

import type { HardwareStatusSnapshot } from './types';
import type { ProvenanceInfo, IntegrationMode, DataProvenance } from './provenance';
import { deviceEventLog } from './DeviceEventLog';
import { realOnlyGate } from './realOnlyGate';

// ── Snapshot Store ─────────────────────────────────────────────────

export interface StoredSnapshot {
  snapshot: HardwareStatusSnapshot;
  provenance: ProvenanceInfo;
  ingested_at: number;
}

class HardwareSnapshotStore {
  private _store: Map<string, StoredSnapshot[]> = new Map();
  private _maxPerDevice = 200;

  push(deviceId: string, snapshot: HardwareStatusSnapshot, provenance: ProvenanceInfo): void {
    if (!this._store.has(deviceId)) this._store.set(deviceId, []);
    const arr = this._store.get(deviceId)!;
    arr.push({ snapshot, provenance, ingested_at: Date.now() });
    if (arr.length > this._maxPerDevice) {
      this._store.set(deviceId, arr.slice(-Math.floor(this._maxPerDevice * 0.7)));
    }
  }

  getLatest(deviceId: string): StoredSnapshot | null {
    const arr = this._store.get(deviceId);
    return arr && arr.length > 0 ? arr[arr.length - 1] : null;
  }

  getHistory(deviceId: string, count: number = 50): StoredSnapshot[] {
    return (this._store.get(deviceId) ?? []).slice(-count);
  }

  getAllLatest(): StoredSnapshot[] {
    const result: StoredSnapshot[] = [];
    for (const [, arr] of this._store) {
      if (arr.length > 0) result.push(arr[arr.length - 1]);
    }
    return result;
  }

  getDeviceIds(): string[] {
    return Array.from(this._store.keys());
  }

  clear(): void { this._store.clear(); }
}

export const hardwareSnapshotStore = new HardwareSnapshotStore();

// ── Passive Telemetry Ingestor ─────────────────────────────────────

class PassiveTelemetryIngestor {
  /** Ingest a single snapshot (from any source) */
  ingest(snapshot: HardwareStatusSnapshot, source: DataProvenance = 'passive_device_feed'): void {
    const provenance: ProvenanceInfo = {
      integration_mode: source === 'synthetic' ? 'simulated' : source === 'imported_log' ? 'replay' : 'live_read_only',
      provenance: source,
      evidence_level: source === 'passive_device_feed' ? 'telemetry_verified' : 'adapter_only',
      transport_type: 'none',
      last_seen_at: snapshot.timestamp,
      data_freshness_ms: Date.now() - snapshot.timestamp,
      writable: false,
    };
    // ── Real-Only Gate ─────────────────────────────────────────
    // Drop snapshots whose provenance is not verified (not_integrated /
    // simulated) when real-only mode is on. No store push, no event.
    if (!realOnlyGate.acceptSnapshot(provenance, snapshot.device_id)) return;

    hardwareSnapshotStore.push(snapshot.device_id, snapshot, provenance);
    deviceEventLog.log(snapshot.device_id, 'telemetry',
      `Ingested snapshot (${source}): ${snapshot.online ? 'online' : 'offline'}`);
  }

  /** Ingest a batch of snapshots (e.g. from file import) */
  ingestBatch(snapshots: HardwareStatusSnapshot[], source: DataProvenance = 'imported_log'): number {
    for (const snap of snapshots) this.ingest(snap, source);
    return snapshots.length;
  }
}

export const passiveTelemetryIngestor = new PassiveTelemetryIngestor();

// ── Snapshot Ingestion Service (JSON/CSV) ──────────────────────────

export interface SnapshotFileData {
  format: 'json' | 'csv';
  device_id: string;
  snapshots: HardwareStatusSnapshot[];
}

class SnapshotIngestionService {
  /** Parse a JSON snapshot file */
  parseJSON(jsonString: string): SnapshotFileData {
    const data = JSON.parse(jsonString);
    const snapshots: HardwareStatusSnapshot[] = Array.isArray(data) ? data : data.snapshots ?? [data];
    const deviceId = snapshots[0]?.device_id ?? 'unknown';
    return { format: 'json', device_id: deviceId, snapshots };
  }

  /** Import parsed data into the store */
  import(data: SnapshotFileData): number {
    return passiveTelemetryIngestor.ingestBatch(data.snapshots, 'imported_log');
  }
}

export const snapshotIngestionService = new SnapshotIngestionService();

// ── Replay Log Loader ──────────────────────────────────────────────

export interface ReplaySession {
  id: string;
  label: string;
  startTime: number;
  endTime: number;
  snapshots: { timestamp: number; deviceId: string; snapshot: HardwareStatusSnapshot }[];
  isPlaying: boolean;
  currentIndex: number;
  speed: number; // 1x, 2x, etc.
}

class ReplayLogLoader {
  private _session: ReplaySession | null = null;
  private _timer: ReturnType<typeof setInterval> | null = null;
  private _listeners = new Set<(session: ReplaySession) => void>();

  get session(): ReplaySession | null { return this._session; }
  get isPlaying(): boolean { return this._session?.isPlaying ?? false; }

  /** Load a replay session from snapshot array */
  load(snapshots: HardwareStatusSnapshot[], label: string = 'Replay Session'): ReplaySession {
    this.stop();
    const sorted = [...snapshots].sort((a, b) => a.timestamp - b.timestamp);
    this._session = {
      id: `replay-${Date.now()}`,
      label,
      startTime: sorted[0]?.timestamp ?? 0,
      endTime: sorted[sorted.length - 1]?.timestamp ?? 0,
      snapshots: sorted.map(s => ({ timestamp: s.timestamp, deviceId: s.device_id, snapshot: s })),
      isPlaying: false,
      currentIndex: 0,
      speed: 1,
    };
    deviceEventLog.log('system', 'state_change', `Replay loaded: "${label}" — ${sorted.length} snapshots`);
    this._notify();
    return this._session;
  }

  /** Start replaying */
  play(speed: number = 1): void {
    if (!this._session) return;
    this._session.isPlaying = true;
    this._session.speed = speed;

    const tick = () => {
      if (!this._session || !this._session.isPlaying) return;
      if (this._session.currentIndex >= this._session.snapshots.length) {
        this.stop();
        return;
      }
      const entry = this._session.snapshots[this._session.currentIndex];
      passiveTelemetryIngestor.ingest(entry.snapshot, 'imported_log');
      this._session.currentIndex++;
      this._notify();
    };

    // Base interval = 250ms at 1x speed
    this._timer = setInterval(tick, 250 / speed);
    this._notify();
  }

  stop(): void {
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
    if (this._session) { this._session.isPlaying = false; this._notify(); }
  }

  reset(): void {
    this.stop();
    if (this._session) { this._session.currentIndex = 0; this._notify(); }
  }

  onChange(fn: (session: ReplaySession) => void): () => void {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  private _notify(): void {
    if (this._session) for (const fn of this._listeners) fn(this._session);
  }
}

export const replayLogLoader = new ReplayLogLoader();
