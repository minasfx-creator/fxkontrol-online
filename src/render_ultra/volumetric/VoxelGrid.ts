/**
 * VoxelGrid — SoA 3D voxel grid for volumetric effects.
 * Pre-allocated Float32Arrays, zero-GC in hot path.
 */

export interface VoxelGridConfig {
  resX: number;
  resY: number;
  resZ: number;
  worldSize: [number, number, number];
  worldOrigin: [number, number, number];
}

const DEFAULT_CONFIG: VoxelGridConfig = {
  resX: 32,
  resY: 32,
  resZ: 32,
  worldSize: [10, 10, 10],
  worldOrigin: [0, 0, 0],
};

export class VoxelGrid {
  readonly resX: number;
  readonly resY: number;
  readonly resZ: number;
  readonly cellCount: number;
  readonly worldSize: [number, number, number];
  readonly worldOrigin: [number, number, number];

  // SoA buffers
  readonly density: Float32Array;
  readonly temperature: Float32Array;
  readonly emissive: Float32Array;
  readonly velocityX: Float32Array;
  readonly velocityY: Float32Array;
  readonly velocityZ: Float32Array;
  readonly age: Float32Array;
  readonly turbulence: Float32Array;
  readonly absorption: Float32Array;

  // Packed RGBA texture data for GPU upload (density, emissive, temperature, absorption)
  private _textureData: Float32Array;
  private _textureDirty = true;

  constructor(config: Partial<VoxelGridConfig> = {}) {
    const c = { ...DEFAULT_CONFIG, ...config };
    this.resX = c.resX;
    this.resY = c.resY;
    this.resZ = c.resZ;
    this.cellCount = c.resX * c.resY * c.resZ;
    this.worldSize = [...c.worldSize];
    this.worldOrigin = [...c.worldOrigin];

    this.density = new Float32Array(this.cellCount);
    this.temperature = new Float32Array(this.cellCount);
    this.emissive = new Float32Array(this.cellCount);
    this.velocityX = new Float32Array(this.cellCount);
    this.velocityY = new Float32Array(this.cellCount);
    this.velocityZ = new Float32Array(this.cellCount);
    this.age = new Float32Array(this.cellCount);
    this.turbulence = new Float32Array(this.cellCount);
    this.absorption = new Float32Array(this.cellCount);

    this._textureData = new Float32Array(this.cellCount * 4);
  }

  /** Flat index from 3D coords */
  index(x: number, y: number, z: number): number {
    return x + y * this.resX + z * this.resX * this.resY;
  }

  /** World position → grid coords (clamped) */
  worldToGrid(wx: number, wy: number, wz: number): [number, number, number] {
    const lx = (wx - this.worldOrigin[0] + this.worldSize[0] * 0.5) / this.worldSize[0];
    const ly = (wy - this.worldOrigin[1] + this.worldSize[1] * 0.5) / this.worldSize[1];
    const lz = (wz - this.worldOrigin[2] + this.worldSize[2] * 0.5) / this.worldSize[2];
    return [
      Math.max(0, Math.min(this.resX - 1, Math.floor(lx * this.resX))),
      Math.max(0, Math.min(this.resY - 1, Math.floor(ly * this.resY))),
      Math.max(0, Math.min(this.resZ - 1, Math.floor(lz * this.resZ))),
    ];
  }

  /** Clear all buffers */
  clear(): void {
    this.density.fill(0);
    this.temperature.fill(0);
    this.emissive.fill(0);
    this.velocityX.fill(0);
    this.velocityY.fill(0);
    this.velocityZ.fill(0);
    this.age.fill(0);
    this.turbulence.fill(0);
    this.absorption.fill(0);
    this._textureDirty = true;
  }

  markDirty(): void {
    this._textureDirty = true;
  }

  /** Pack SoA → RGBA f32 for GPU texture upload */
  packTextureData(): Float32Array {
    if (!this._textureDirty) return this._textureData;
    const n = this.cellCount;
    for (let i = 0; i < n; i++) {
      const o = i * 4;
      this._textureData[o] = this.density[i];
      this._textureData[o + 1] = this.emissive[i];
      this._textureData[o + 2] = this.temperature[i];
      this._textureData[o + 3] = this.absorption[i];
    }
    this._textureDirty = false;
    return this._textureData;
  }
}
