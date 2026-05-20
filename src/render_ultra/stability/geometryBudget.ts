/**
 * Geometry Budget — registry for triangle and texture memory usage across the scene.
 * Used by upload validation, asset library, and runtime VRAM guard.
 */

export interface GeometryBudgetEntry {
  id: string;
  triangles: number;
  textureBytes: number;
  source?: string;
}

export interface GeometryBudgetReport {
  totalTriangles: number;
  totalTextureBytes: number;
  totalVramMb: number;
  entries: number;
  overTriangles: GeometryBudgetEntry[];
  overTextureDim: GeometryBudgetEntry[];
  overVram: boolean;
}

export const GEOMETRY_LIMITS = {
  MAX_TRIANGLES_PER_ASSET: 50_000,
  MAX_TEXTURE_DIM: 2048,
  MAX_TEXTURE_BYTES_PER_ASSET: 2048 * 2048 * 4, // RGBA8 budget at MAX_TEXTURE_DIM
  MAX_VRAM_SCENE_MB: 512,
} as const;

class GeometryBudget {
  private map = new Map<string, GeometryBudgetEntry>();

  register(entry: GeometryBudgetEntry): void {
    this.map.set(entry.id, entry);
  }

  unregister(id: string): void {
    this.map.delete(id);
  }

  clear(): void {
    this.map.clear();
  }

  has(id: string): boolean {
    return this.map.has(id);
  }

  validateAsset(entry: GeometryBudgetEntry): { ok: boolean; reasons: string[] } {
    const reasons: string[] = [];
    if (entry.triangles > GEOMETRY_LIMITS.MAX_TRIANGLES_PER_ASSET) {
      reasons.push(`triangles ${entry.triangles} > ${GEOMETRY_LIMITS.MAX_TRIANGLES_PER_ASSET}`);
    }
    if (entry.textureBytes > GEOMETRY_LIMITS.MAX_TEXTURE_BYTES_PER_ASSET) {
      reasons.push(`textureBytes ${entry.textureBytes} > ${GEOMETRY_LIMITS.MAX_TEXTURE_BYTES_PER_ASSET}`);
    }
    return { ok: reasons.length === 0, reasons };
  }

  report(): GeometryBudgetReport {
    let totalTriangles = 0;
    let totalTextureBytes = 0;
    const overTri: GeometryBudgetEntry[] = [];
    const overTex: GeometryBudgetEntry[] = [];
    for (const e of this.map.values()) {
      totalTriangles += e.triangles;
      totalTextureBytes += e.textureBytes;
      if (e.triangles > GEOMETRY_LIMITS.MAX_TRIANGLES_PER_ASSET) overTri.push(e);
      if (e.textureBytes > GEOMETRY_LIMITS.MAX_TEXTURE_BYTES_PER_ASSET) overTex.push(e);
    }
    const totalVramMb = totalTextureBytes / (1024 * 1024);
    return {
      totalTriangles,
      totalTextureBytes,
      totalVramMb,
      entries: this.map.size,
      overTriangles: overTri,
      overTextureDim: overTex,
      overVram: totalVramMb > GEOMETRY_LIMITS.MAX_VRAM_SCENE_MB,
    };
  }
}

export const geometryBudget = new GeometryBudget();
