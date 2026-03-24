/**
 * MVR-xchange Protocol Engine
 * Implements real-time MVR file exchange with grandMA3 over TCP/WebSocket
 *
 * MVR-xchange (ANSI E1.67) enables:
 * - Live fixture position sync between MA3 and editor
 * - Automatic patch updates when MA3 show changes
 * - Bidirectional 3D position exchange
 * - GDTF profile sync
 *
 * Protocol: TCP mDNS discovery on port 9100, JSON messages wrapping MVR file chunks
 */

import { type MVRFixture, parseMVR, type MVRParseResult } from './mvrParser';

export interface MVRXchangeMessage {
  type: 'mvr_join' | 'mvr_leave' | 'mvr_commit' | 'mvr_request' | 'mvr_new_session_host';
  version: string;
  provider: string;
  stationName: string;
  stationUUID: string;
  fileUUID?: string;
  fileSize?: number;
  fileName?: string;
  comment?: string;
}

export interface MVRXchangeStation {
  name: string;
  uuid: string;
  provider: string;       // e.g. "grandMA3 v2.1"
  ip: string;
  lastSeen: number;
  isSessionHost: boolean;
  commits: MVRXchangeCommit[];
}

export interface MVRXchangeCommit {
  fileUUID: string;
  fileName: string;
  comment: string;
  timestamp: number;
  fileSize: number;
  fixtures?: MVRFixture[];
}

export type MVRXchangeState = 'disconnected' | 'discovering' | 'connected' | 'syncing';

export type MVRXchangeListener = (event: MVRXchangeEvent) => void;

export interface MDNSDiscoveredStation {
  name: string;
  ip: string;
  port: number;
  provider: string;
  uuid: string;
  lastSeen: number;
}

export type MVRXchangeEvent =
  | { type: 'station-joined'; station: MVRXchangeStation }
  | { type: 'station-left'; stationUUID: string }
  | { type: 'commit-received'; station: MVRXchangeStation; commit: MVRXchangeCommit }
  | { type: 'fixtures-updated'; fixtures: MVRFixture[]; source: string }
  | { type: 'mdns-discovered'; station: MDNSDiscoveredStation }
  | { type: 'error'; message: string }
  | { type: 'state-changed'; state: MVRXchangeState };

export class MVRXchangeClient {
  private ws: WebSocket | null = null;
  private _state: MVRXchangeState = 'disconnected';
  private stations: Map<string, MVRXchangeStation> = new Map();
  private listeners: Set<MVRXchangeListener> = new Set();
  private bridgeUrl: string;
  private stationName: string;
  private stationUUID: string;

  constructor(bridgeUrl = 'ws://localhost:9004', stationName = 'PyroEditor') {
    this.bridgeUrl = bridgeUrl;
    this.stationName = stationName;
    this.stationUUID = crypto.randomUUID();
  }

  get state() { return this._state; }
  get discoveredStations() { return Array.from(this.stations.values()); }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this._state = 'discovering';
      this.emit({ type: 'state-changed', state: this._state });

      try {
        this.ws = new WebSocket(this.bridgeUrl);

        this.ws.onopen = () => {
          this._state = 'connected';
          this.emit({ type: 'state-changed', state: this._state });
          // Announce ourselves
          this.send({
            type: 'mvr_join',
            version: '1.6',
            provider: 'PyroEditor v1.0',
            stationName: this.stationName,
            stationUUID: this.stationUUID,
          });
          resolve();
        };

        this.ws.onmessage = (ev) => {
          try {
            const msg = JSON.parse(ev.data);
            this.handleMessage(msg);
          } catch { /* ignore binary */ }
        };

        this.ws.onerror = () => {
          this._state = 'disconnected';
          this.emit({ type: 'state-changed', state: this._state });
          reject(new Error('MVR-xchange bridge connection failed'));
        };

        this.ws.onclose = () => {
          this._state = 'disconnected';
          this.emit({ type: 'state-changed', state: this._state });
        };
      } catch (err) {
        this._state = 'disconnected';
        reject(err);
      }
    });
  }

  disconnect() {
    if (this.ws) {
      this.send({
        type: 'mvr_leave',
        version: '1.6',
        provider: 'PyroEditor v1.0',
        stationName: this.stationName,
        stationUUID: this.stationUUID,
      });
      this.ws.close();
      this.ws = null;
    }
    this._state = 'disconnected';
    this.stations.clear();
    this.emit({ type: 'state-changed', state: this._state });
  }

  requestLatest(stationUUID: string) {
    this.send({
      type: 'mvr_request',
      version: '1.6',
      provider: 'PyroEditor v1.0',
      stationName: this.stationName,
      stationUUID: this.stationUUID,
      fileUUID: stationUUID,
    });
  }

  requestDiscovery() {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'discover' }));
    }
  }

  connectStation(uuid: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'connect_station', uuid }));
    }
  }

  private handleMessage(msg: any) {
    switch (msg.type) {
      case 'mvr_join': {
        const station: MVRXchangeStation = {
          name: msg.stationName || 'Unknown',
          uuid: msg.stationUUID || '',
          provider: msg.provider || '',
          ip: msg.ip || '',
          lastSeen: Date.now(),
          isSessionHost: false,
          commits: [],
        };
        this.stations.set(station.uuid, station);
        this.emit({ type: 'station-joined', station });
        break;
      }

      case 'mvr_leave': {
        this.stations.delete(msg.stationUUID);
        this.emit({ type: 'station-left', stationUUID: msg.stationUUID });
        break;
      }

      case 'mvr_commit': {
        const station = this.stations.get(msg.stationUUID);
        if (station) {
          const commit: MVRXchangeCommit = {
            fileUUID: msg.fileUUID || '',
            fileName: msg.fileName || 'scene.mvr',
            comment: msg.comment || '',
            timestamp: Date.now(),
            fileSize: msg.fileSize || 0,
          };
          station.commits.push(commit);
          station.lastSeen = Date.now();
          this.emit({ type: 'commit-received', station, commit });
        }
        break;
      }

      case 'mvr_new_session_host': {
        const station = this.stations.get(msg.stationUUID);
        if (station) {
          this.stations.forEach(s => { s.isSessionHost = false; });
          station.isSessionHost = true;
        }
        break;
      }

      case 'mvr_fixtures': {
        if (Array.isArray(msg.fixtures)) {
          this.emit({
            type: 'fixtures-updated',
            fixtures: msg.fixtures as MVRFixture[],
            source: msg.stationName || 'MA3',
          });
        }
        break;
      }

      case 'mdns_service': {
        if (msg.station) {
          const s: MDNSDiscoveredStation = {
            name: msg.station.name || 'Unknown',
            ip: msg.station.ip || '',
            port: msg.station.port || 9100,
            provider: msg.station.provider || '',
            uuid: msg.station.uuid || '',
            lastSeen: Date.now(),
          };
          this.emit({ type: 'mdns-discovered', station: s });
        }
        break;
      }
    }
  }

  private send(msg: MVRXchangeMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  on(listener: MVRXchangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: MVRXchangeEvent) {
    this.listeners.forEach(l => l(event));
  }
}

// Singleton
let _mvrClient: MVRXchangeClient | null = null;
export function getMVRXchangeClient(): MVRXchangeClient {
  if (!_mvrClient) _mvrClient = new MVRXchangeClient();
  return _mvrClient;
}
