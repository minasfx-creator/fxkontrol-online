/**
 * ─── Drone Executor ─────────────────────────────────────────────────
 * Deterministic drone waypoint sender.
 * Converts local simulation coords to WGS84 for MAVLink.
 * RTH fail-safe if signal is lost.
 */

import { blackbox } from '@/core/reliability';
import type { FieldBus, TransportMessage } from '@/core/network/fieldBus';

export interface DroneWaypoint {
  droneId: string;
  time: number;        // seconds
  localX: number;      // meters (ENU)
  localY: number;
  localZ: number;
  lat?: number;        // WGS84 — filled by conversion
  lng?: number;
  alt?: number;
  speed?: number;      // m/s
  heading?: number;    // degrees
}

export type DroneFailSafeMode = 'hover' | 'rth' | 'land';

const LOCAL_BUFFER_MAX = 512;
const DEG_PER_METER_LAT = 1 / 111_320;

class DroneExecutor {
  private _localBuffer: DroneWaypoint[] = [];
  private _failSafeMode: DroneFailSafeMode = 'rth';
  private _anchorLat = 0;
  private _anchorLng = 0;
  private _anchorAlt = 0;

  /** Set geo anchor for local→WGS84 conversion. */
  setAnchor(lat: number, lng: number, alt: number): void {
    this._anchorLat = lat;
    this._anchorLng = lng;
    this._anchorAlt = alt;
  }

  setFailSafeMode(mode: DroneFailSafeMode): void {
    this._failSafeMode = mode;
  }

  /** Convert local ENU coordinates to WGS84. */
  localToWGS84(wp: DroneWaypoint): { lat: number; lng: number; alt: number } {
    const lat = this._anchorLat + wp.localY * DEG_PER_METER_LAT;
    const lngScale = DEG_PER_METER_LAT / Math.cos(this._anchorLat * Math.PI / 180);
    const lng = this._anchorLng + wp.localX * lngScale;
    const alt = this._anchorAlt + wp.localZ;
    return { lat, lng, alt };
  }

  /** Send a waypoint command through the field bus. */
  sendWaypoint(wp: DroneWaypoint, bus: FieldBus): boolean {
    const geo = this.localToWGS84(wp);
    wp.lat = geo.lat;
    wp.lng = geo.lng;
    wp.alt = geo.alt;

    const msg: TransportMessage = {
      type: 'drone',
      payload: {
        droneId: wp.droneId,
        lat: geo.lat,
        lng: geo.lng,
        alt: geo.alt,
        speed: wp.speed ?? 5,
        heading: wp.heading ?? 0,
      },
    };

    if (bus.isAlive()) {
      const sent = bus.send(msg);
      if (sent) {
        blackbox.record('drone', `DRONE WP ${wp.droneId} → ${geo.lat.toFixed(6)},${geo.lng.toFixed(6)}`, {
          droneId: wp.droneId,
        });
        return true;
      }
    }

    // Signal lost → buffer + fail-safe
    if (this._localBuffer.length < LOCAL_BUFFER_MAX) {
      this._localBuffer.push(wp);
    }
    blackbox.record('drone', `DRONE BUFFERED (offline) ${wp.droneId} mode=${this._failSafeMode}`);
    return false;
  }

  /** Trigger fail-safe for a specific drone. */
  triggerFailSafe(droneId: string, bus: FieldBus): void {
    const msg: TransportMessage = {
      type: 'drone',
      payload: { droneId, command: this._failSafeMode },
    };
    bus.send(msg);
    blackbox.record('emergency', `DRONE FAILSAFE ${droneId}: ${this._failSafeMode}`);
  }

  getBufferSize(): number { return this._localBuffer.length; }
  getFailSafeMode(): DroneFailSafeMode { return this._failSafeMode; }
  clearBuffer(): void { this._localBuffer.length = 0; }
}

export const droneExecutor = new DroneExecutor();
