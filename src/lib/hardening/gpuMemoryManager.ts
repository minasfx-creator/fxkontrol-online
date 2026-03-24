/**
 * FX KONTROL · GPU Memory Manager
 * Auto-dispose, LRU cache, VRAM hard limits, scene node limits.
 */

import * as THREE from 'three';

// ── VRAM Budget ──────────────────────────────────────────────
export interface VRAMBudget {
  maxTextureMB: number;        // e.g. 512
  maxGeometryMB: number;       // e.g. 256
  maxSceneNodes: number;       // e.g. 5000
  warningThresholdPct: number; // 0-1, e.g. 0.8
}

const DEFAULT_VRAM_BUDGET: VRAMBudget = {
  maxTextureMB: 512,
  maxGeometryMB: 256,
  maxSceneNodes: 5000,
  warningThresholdPct: 0.8,
};

let _budget = { ...DEFAULT_VRAM_BUDGET };
export function setVRAMBudget(b: Partial<VRAMBudget>) { _budget = { ..._budget, ...b }; }
export function getVRAMBudget(): Readonly<VRAMBudget> { return _budget; }

// ── LRU Resource Cache ───────────────────────────────────────
interface CacheEntry<T> {
  resource: T;
  lastAccess: number;
  sizeMB: number;
  key: string;
}

class LRUResourceCache<T extends { dispose?: () => void }> {
  private entries = new Map<string, CacheEntry<T>>();
  private maxSizeMB: number;
  private currentSizeMB = 0;

  constructor(maxSizeMB: number) {
    this.maxSizeMB = maxSizeMB;
  }

  get(key: string): T | null {
    const entry = this.entries.get(key);
    if (!entry) return null;
    entry.lastAccess = performance.now();
    return entry.resource;
  }

  set(key: string, resource: T, sizeMB: number): void {
    // Evict if already exists
    if (this.entries.has(key)) this.evict(key);

    // Evict LRU entries until we have space
    while (this.currentSizeMB + sizeMB > this.maxSizeMB && this.entries.size > 0) {
      this.evictLRU();
    }

    this.entries.set(key, { resource, lastAccess: performance.now(), sizeMB, key });
    this.currentSizeMB += sizeMB;
  }

  private evict(key: string): void {
    const entry = this.entries.get(key);
    if (!entry) return;
    entry.resource.dispose?.();
    this.currentSizeMB -= entry.sizeMB;
    this.entries.delete(key);
  }

  private evictLRU(): void {
    let oldest: CacheEntry<T> | null = null;
    for (const entry of this.entries.values()) {
      if (!oldest || entry.lastAccess < oldest.lastAccess) oldest = entry;
    }
    if (oldest) this.evict(oldest.key);
  }

  clear(): void {
    for (const entry of this.entries.values()) {
      entry.resource.dispose?.();
    }
    this.entries.clear();
    this.currentSizeMB = 0;
  }

  getStats() {
    return {
      entries: this.entries.size,
      currentSizeMB: this.currentSizeMB,
      maxSizeMB: this.maxSizeMB,
      usagePct: this.currentSizeMB / this.maxSizeMB,
    };
  }
}

// Singleton caches
export const textureCache = new LRUResourceCache<THREE.Texture>(512);
export const geometryCache = new LRUResourceCache<THREE.BufferGeometry>(256);

// ── Resource Tracker ─────────────────────────────────────────
interface TrackedResource {
  resource: THREE.Texture | THREE.BufferGeometry | THREE.Material;
  type: 'texture' | 'geometry' | 'material';
  sizeMB: number;
  createdAt: number;
  label?: string;
}

const _tracked = new Map<number, TrackedResource>();
let _nextId = 1;

export function trackResource(
  resource: THREE.Texture | THREE.BufferGeometry | THREE.Material,
  type: TrackedResource['type'],
  sizeMB: number,
  label?: string,
): number {
  const id = _nextId++;
  _tracked.set(id, { resource, type, sizeMB, createdAt: performance.now(), label });
  return id;
}

export function untrackResource(id: number): void {
  const entry = _tracked.get(id);
  if (entry) {
    (entry.resource as any).dispose?.();
    _tracked.delete(id);
  }
}

export function disposeAllTracked(): void {
  for (const [id, entry] of _tracked) {
    (entry.resource as any).dispose?.();
    _tracked.delete(id);
  }
}

// ── Scene Health Check ───────────────────────────────────────
export interface SceneHealthReport {
  totalNodes: number;
  totalGeometries: number;
  totalTextures: number;
  estimatedVRAM_MB: number;
  withinBudget: boolean;
  warnings: string[];
}

export function checkSceneHealth(renderer: THREE.WebGLRenderer): SceneHealthReport {
  const info = renderer.info;
  const geomMem = info.memory.geometries;
  const texMem = info.memory.textures;

  // Rough VRAM estimation
  const estimatedVRAM = (texMem * 4) + (geomMem * 0.5); // Very rough MB estimate

  const warnings: string[] = [];
  if (texMem > 200) warnings.push(`High texture count: ${texMem}`);
  if (geomMem > 500) warnings.push(`High geometry count: ${geomMem}`);
  if (info.render.triangles > _budget.maxGeometryMB * 10000) {
    warnings.push(`Triangle count very high: ${info.render.triangles}`);
  }

  return {
    totalNodes: geomMem + texMem,
    totalGeometries: geomMem,
    totalTextures: texMem,
    estimatedVRAM_MB: estimatedVRAM,
    withinBudget: estimatedVRAM < (_budget.maxTextureMB + _budget.maxGeometryMB),
    warnings,
  };
}

// ── Auto-Dispose Helper ──────────────────────────────────────
/**
 * Recursively dispose all materials, geometries, and textures in a scene graph.
 */
export function deepDispose(obj: THREE.Object3D): void {
  obj.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      if (child.geometry) child.geometry.dispose();
      if (Array.isArray(child.material)) {
        child.material.forEach(disposeMaterial);
      } else if (child.material) {
        disposeMaterial(child.material);
      }
    }
  });
}

function disposeMaterial(mat: THREE.Material): void {
  mat.dispose();
  // Dispose textures on the material
  for (const key of Object.keys(mat)) {
    const val = (mat as any)[key];
    if (val instanceof THREE.Texture) {
      val.dispose();
    }
  }
}
