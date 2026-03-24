/**
 * ─── Memory & VRAM Manager ──────────────────────────────────────────
 * Monitors GPU resource usage and provides disposal utilities.
 * Prevents memory leaks from dynamic geometry/textures.
 */

import * as THREE from 'three';

// ── Resource Tracking ──────────────────────────────────────────────

export interface MemoryReport {
  geometries: number;
  textures: number;
  programs: number;
  drawCalls: number;
  triangles: number;
  estimatedVRAM_MB: number;
  jsHeap_MB: number;
  tilesCached: number;
}

/**
 * Generate a memory report from the current renderer.
 */
export function getMemoryReport(gl: THREE.WebGLRenderer): MemoryReport {
  const info = gl.info;
  const mem = (performance as any).memory;

  return {
    geometries: info.memory.geometries,
    textures: info.memory.textures,
    programs: info.programs?.length ?? 0,
    drawCalls: info.render.calls,
    triangles: info.render.triangles,
    estimatedVRAM_MB: estimateVRAM(info),
    jsHeap_MB: mem ? Math.round(mem.usedJSHeapSize / 1048576) : 0,
    tilesCached: _tileCacheCount,
  };
}

function estimateVRAM(info: THREE.WebGLInfo): number {
  // Rough estimate: ~4 bytes per vertex * 3 attributes + texture memory
  const geoMem = info.memory.geometries * 0.1;  // ~100KB avg per geometry
  const texMem = info.memory.textures * 0.5;     // ~500KB avg per texture
  return Math.round((geoMem + texMem) * 10) / 10;
}

// ── Tile Cache Management ──────────────────────────────────────────

interface CacheEntry {
  object: THREE.Object3D;
  lastUsed: number;
  byteSize: number;
}

const _tileCache = new Map<string, CacheEntry>();
let _tileCacheCount = 0;
const MAX_CACHE_SIZE = 200;         // Max cached tile meshes
const CACHE_TTL_MS = 30_000;       // 30 seconds unused → purge

export function registerTileInCache(key: string, object: THREE.Object3D, byteSize = 0): void {
  _tileCache.set(key, { object, lastUsed: Date.now(), byteSize });
  _tileCacheCount = _tileCache.size;
}

export function touchTileCache(key: string): void {
  const entry = _tileCache.get(key);
  if (entry) entry.lastUsed = Date.now();
}

/**
 * Purge stale tiles from cache. Call periodically (~1Hz).
 * Returns number of entries purged.
 */
export function purgeStaleTiles(): number {
  const now = Date.now();
  let purged = 0;

  // First pass: time-based expiry
  for (const [key, entry] of _tileCache) {
    if (now - entry.lastUsed > CACHE_TTL_MS) {
      disposeObject3D(entry.object);
      _tileCache.delete(key);
      purged++;
    }
  }

  // Second pass: if still over budget, evict oldest
  if (_tileCache.size > MAX_CACHE_SIZE) {
    const sorted = [..._tileCache.entries()].sort((a, b) => a[1].lastUsed - b[1].lastUsed);
    const excess = _tileCache.size - MAX_CACHE_SIZE;
    for (let i = 0; i < excess; i++) {
      disposeObject3D(sorted[i][1].object);
      _tileCache.delete(sorted[i][0]);
      purged++;
    }
  }

  _tileCacheCount = _tileCache.size;
  return purged;
}

// ── GPU Resource Disposal ──────────────────────────────────────────

/**
 * Recursively dispose all GPU resources (geometry, material, textures)
 * of an Object3D and its children. Safe for scene cleanup.
 */
export function disposeObject3D(obj: THREE.Object3D): void {
  obj.traverse((child) => {
    if (child instanceof THREE.Mesh || child instanceof THREE.InstancedMesh) {
      if (child.geometry) {
        child.geometry.dispose();
      }
      if (child.material) {
        disposeMaterial(child.material);
      }
    }
    if (child instanceof THREE.Points) {
      child.geometry?.dispose();
      if (child.material) disposeMaterial(child.material);
    }
  });
}

function disposeMaterial(material: THREE.Material | THREE.Material[]): void {
  const materials = Array.isArray(material) ? material : [material];
  for (const mat of materials) {
    // Dispose all texture maps
    for (const key of Object.keys(mat)) {
      const value = (mat as any)[key];
      if (value instanceof THREE.Texture) {
        value.dispose();
      }
    }
    mat.dispose();
  }
}

/**
 * Emergency memory cleanup. Disposes all cached tiles and forces GC hint.
 */
export function emergencyPurge(): void {
  for (const [, entry] of _tileCache) {
    disposeObject3D(entry.object);
  }
  _tileCache.clear();
  _tileCacheCount = 0;
  console.warn('[MemoryManager] Emergency purge — all tile cache cleared');
}

// ── VRAM Budget Monitor ────────────────────────────────────────────

const MAX_VRAM_MB = 512; // Budget cap

/**
 * Check if we're approaching VRAM budget limits.
 * Returns a 0-1 pressure value (1 = at limit).
 */
export function getVRAMPressure(gl: THREE.WebGLRenderer): number {
  const report = getMemoryReport(gl);
  return Math.min(report.estimatedVRAM_MB / MAX_VRAM_MB, 1);
}
