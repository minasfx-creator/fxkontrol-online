/**
 * FX KONTROL · Geometry Pool — Object Pooling for Particle Systems
 * 
 * Eliminates GC pressure from firework effects by reusing
 * Float32Array buffers and BufferGeometry instances.
 * 
 * UE5-inspired: pre-allocated pools with reset-on-acquire pattern.
 */

import * as THREE from 'three';

interface PooledBuffer {
  array: Float32Array;
  inUse: boolean;
}

interface PooledGeometry {
  geometry: THREE.BufferGeometry;
  inUse: boolean;
}

class BufferPool {
  private pools = new Map<number, PooledBuffer[]>();
  private maxPoolSize = 32;

  /**
   * Acquire a Float32Array of the given size.
   * Returns a recycled buffer (zeroed) or creates a new one.
   */
  acquire(size: number): Float32Array {
    const pool = this.pools.get(size);
    if (pool) {
      for (const entry of pool) {
        if (!entry.inUse) {
          entry.inUse = true;
          entry.array.fill(0);
          return entry.array;
        }
      }
    }

    // No free buffer — create new
    const arr = new Float32Array(size);
    if (!this.pools.has(size)) {
      this.pools.set(size, []);
    }
    const entries = this.pools.get(size)!;
    if (entries.length < this.maxPoolSize) {
      entries.push({ array: arr, inUse: true });
    }
    return arr;
  }

  /**
   * Release a buffer back to the pool for reuse.
   */
  release(arr: Float32Array) {
    const pool = this.pools.get(arr.length);
    if (pool) {
      for (const entry of pool) {
        if (entry.array === arr) {
          entry.inUse = false;
          return;
        }
      }
    }
  }

  /**
   * Get pool statistics for debug overlay.
   */
  getStats(): { totalBuffers: number; inUse: number; totalBytes: number } {
    let total = 0, inUse = 0, bytes = 0;
    this.pools.forEach(pool => {
      pool.forEach(entry => {
        total++;
        bytes += entry.array.byteLength;
        if (entry.inUse) inUse++;
      });
    });
    return { totalBuffers: total, inUse, totalBytes: bytes };
  }

  /**
   * Clear all pools — call on WebGL context loss recovery.
   */
  clear() {
    this.pools.clear();
  }
}

class GeometryPool {
  private available: PooledGeometry[] = [];
  private maxSize = 24;

  acquire(): THREE.BufferGeometry {
    for (const entry of this.available) {
      if (!entry.inUse) {
        entry.inUse = true;
        return entry.geometry;
      }
    }

    const geo = new THREE.BufferGeometry();
    if (this.available.length < this.maxSize) {
      this.available.push({ geometry: geo, inUse: true });
    }
    return geo;
  }

  release(geo: THREE.BufferGeometry) {
    for (const entry of this.available) {
      if (entry.geometry === geo) {
        entry.inUse = false;
        return;
      }
    }
  }

  clear() {
    this.available.forEach(e => e.geometry.dispose());
    this.available = [];
  }

  getStats() {
    return {
      total: this.available.length,
      inUse: this.available.filter(e => e.inUse).length,
    };
  }
}

// ═══ Global Singletons ═══
export const bufferPool = new BufferPool();
export const geometryPool = new GeometryPool();

/**
 * Reset pools on WebGL context recovery.
 */
export function resetPools() {
  bufferPool.clear();
  geometryPool.clear();
}
