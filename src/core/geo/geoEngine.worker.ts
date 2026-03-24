/**
 * ─── GeoEngine Web Worker ───────────────────────────────────────────
 * All geodetic math runs here in Float64, off the main thread.
 * Posts Float32-safe results back for GPU consumption.
 * 
 * Messages:
 *   { type: 'latLngAltToECEF', id, payload: { lat, lng, alt } }
 *   { type: 'ecefToENU', id, payload: { ecef: [x,y,z], anchor: [x,y,z] } }
 *   { type: 'batchTransform', id, payload: { positions: [{lat,lng,alt},...], anchor: {lat,lng,alt} } }
 *   { type: 'recenter', id, payload: { newAnchor: {lat,lng,alt} } }
 */

// ── WGS84 Constants (Float64) ──────────────────────────────────────
const WGS84_A = 6378137.0;
const WGS84_E2 = 0.00669437999014;
const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

// ── Current anchor (Float64 precision) ─────────────────────────────
let _anchorLat = 0;
let _anchorLon = 0;
let _anchorAlt = 0;
let _anchorECEF: Float64Array = new Float64Array(3);
let _anchorSinLat = 0;
let _anchorCosLat = 0;
let _anchorSinLon = 0;
let _anchorCosLon = 0;

function setAnchor(lat: number, lon: number, alt: number) {
  _anchorLat = lat;
  _anchorLon = lon;
  _anchorAlt = alt;
  _anchorECEF = latLngAltToECEF(lat, lon, alt);
  const latRad = lat * DEG2RAD;
  const lonRad = lon * DEG2RAD;
  _anchorSinLat = Math.sin(latRad);
  _anchorCosLat = Math.cos(latRad);
  _anchorSinLon = Math.sin(lonRad);
  _anchorCosLon = Math.cos(lonRad);
}

// ── Core Conversions ───────────────────────────────────────────────

function latLngAltToECEF(lat: number, lng: number, alt: number): Float64Array {
  const latRad = lat * DEG2RAD;
  const lonRad = lng * DEG2RAD;
  const sinLat = Math.sin(latRad);
  const cosLat = Math.cos(latRad);
  const sinLon = Math.sin(lonRad);
  const cosLon = Math.cos(lonRad);

  const N = WGS84_A / Math.sqrt(1 - WGS84_E2 * sinLat * sinLat);

  const out = new Float64Array(3);
  out[0] = (N + alt) * cosLat * cosLon;
  out[1] = (N + alt) * cosLat * sinLon;
  out[2] = (N * (1 - WGS84_E2) + alt) * sinLat;
  return out;
}

function ecefToENU(ecef: Float64Array, anchorECEF: Float64Array): Float64Array {
  const dx = ecef[0] - anchorECEF[0];
  const dy = ecef[1] - anchorECEF[1];
  const dz = ecef[2] - anchorECEF[2];

  // ENU rotation using pre-computed anchor trig
  const e = -_anchorSinLon * dx + _anchorCosLon * dy;
  const n = -_anchorSinLat * _anchorCosLon * dx
          - _anchorSinLat * _anchorSinLon * dy
          + _anchorCosLat * dz;
  const u = _anchorCosLat * _anchorCosLon * dx
          + _anchorCosLat * _anchorSinLon * dy
          + _anchorSinLat * dz;

  const out = new Float64Array(3);
  out[0] = e;
  out[1] = n;
  out[2] = u;
  return out;
}

/** ENU → Three.js local (X=East, Y=Up, Z=-North) */
function enuToLocal(enu: Float64Array): Float32Array {
  const out = new Float32Array(3);
  out[0] = enu[0];        // East → X
  out[1] = enu[2];        // Up → Y
  out[2] = -enu[1];       // North → -Z (Three.js convention)
  return out;
}

/** Full pipeline: lat/lng/alt → Float32 local position */
function geoToLocal(lat: number, lng: number, alt: number): Float32Array {
  const ecef = latLngAltToECEF(lat, lng, alt);
  const enu = ecefToENU(ecef, _anchorECEF);
  return enuToLocal(enu);
}

/** Batch transform: N positions in one call, returns interleaved Float32Array */
function batchGeoToLocal(positions: { lat: number; lng: number; alt: number }[]): Float32Array {
  const out = new Float32Array(positions.length * 3);
  for (let i = 0; i < positions.length; i++) {
    const p = positions[i];
    const local = geoToLocal(p.lat, p.lng, p.alt);
    out[i * 3] = local[0];
    out[i * 3 + 1] = local[1];
    out[i * 3 + 2] = local[2];
  }
  return out;
}

// ── Meters Per Degree (at anchor latitude) ─────────────────────────

function metersPerDegreeLat(lat: number): number {
  const latRad = lat * DEG2RAD;
  return 111132.92 - 559.82 * Math.cos(2 * latRad)
       + 1.175 * Math.cos(4 * latRad)
       - 0.0023 * Math.cos(6 * latRad);
}

function metersPerDegreeLon(lat: number): number {
  const latRad = lat * DEG2RAD;
  return 111412.84 * Math.cos(latRad)
       - 93.5 * Math.cos(3 * latRad)
       + 0.118 * Math.cos(5 * latRad);
}

// ── Message Handler ────────────────────────────────────────────────

self.onmessage = (e: MessageEvent) => {
  const { type, id, payload } = e.data;

  switch (type) {
    case 'setAnchor': {
      const { lat, lng, alt } = payload;
      setAnchor(lat, lng, alt);
      self.postMessage({ type: 'anchorSet', id, result: { ecef: Array.from(_anchorECEF) } });
      break;
    }

    case 'latLngAltToECEF': {
      const ecef = latLngAltToECEF(payload.lat, payload.lng, payload.alt);
      self.postMessage({ type: 'ecefResult', id, result: Array.from(ecef) });
      break;
    }

    case 'ecefToENU': {
      const ecef = new Float64Array(payload.ecef);
      const anchor = new Float64Array(payload.anchor);
      const enu = ecefToENU(ecef, anchor);
      self.postMessage({ type: 'enuResult', id, result: Array.from(enu) });
      break;
    }

    case 'geoToLocal': {
      const local = geoToLocal(payload.lat, payload.lng, payload.alt);
      self.postMessage({ type: 'localResult', id, result: Array.from(local) });
      break;
    }

    case 'batchTransform': {
      const positions = payload.positions;
      if (payload.anchor) {
        setAnchor(payload.anchor.lat, payload.anchor.lng, payload.anchor.alt);
      }
      const buffer = batchGeoToLocal(positions);
      // Transfer the buffer for zero-copy
      self.postMessage(
        { type: 'batchResult', id, result: buffer },
        [buffer.buffer] as any
      );
      break;
    }

    case 'recenter': {
      const { newAnchor } = payload;
      setAnchor(newAnchor.lat, newAnchor.lng, newAnchor.alt);
      self.postMessage({
        type: 'recentered', id,
        result: {
          anchor: { lat: _anchorLat, lon: _anchorLon, alt: _anchorAlt },
          ecef: Array.from(_anchorECEF),
        },
      });
      break;
    }

    default:
      console.warn(`[GeoEngine Worker] Unknown message type: ${type}`);
  }
};

// Initialize with Angra dos Reis as default
setAnchor(-23.007, -44.318, 0);
self.postMessage({ type: 'ready' });
