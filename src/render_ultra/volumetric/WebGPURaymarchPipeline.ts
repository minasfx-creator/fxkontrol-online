/**
 * WebGPURaymarchPipeline — Native WebGPU render pipeline for volumetric raymarch.
 * Creates GPU resources, uploads voxel grid as 3D texture, renders fullscreen quad.
 * Struct-aligned uniform buffers matching WGSL layout exactly.
 */
import { FXK_VOXEL_RAYMARCH_WGSL } from './shaders/fxk_voxel_raymarch.wgsl';
import { VoxelGrid } from './VoxelGrid';

// Camera uniform: 3× mat4x4 (192B) + vec4 (16B) = 208 bytes
const CAMERA_BUFFER_SIZE = 208;
// VolumeParams: 8× f32/i32 = 32 bytes
const PARAMS_BUFFER_SIZE = 32;

export interface VolumeParamsGPU {
  stepSize: number;
  maxSteps: number;
  densityScale: number;
  emissionScale: number;
  absorption: number;
  scattering: number;
  anisotropy: number;
}

const DEFAULT_PARAMS: VolumeParamsGPU = {
  stepSize: 0.02,
  maxSteps: 96,
  densityScale: 8.0,
  emissionScale: 3.0,
  absorption: 1.2,
  scattering: 0.6,
  anisotropy: 0.35,
};

export class WebGPURaymarchPipeline {
  private _device: GPUDevice;
  private _pipeline: GPURenderPipeline | null = null;
  private _bindGroup: GPUBindGroup | null = null;

  private _cameraBuffer: GPUBuffer;
  private _paramsBuffer: GPUBuffer;
  private _volumeTexture: GPUTexture | null = null;
  private _sampler: GPUSampler;
  private _bindGroupLayout: GPUBindGroupLayout;

  private _params: VolumeParamsGPU;
  private _cameraData = new ArrayBuffer(CAMERA_BUFFER_SIZE);
  private _cameraF32 = new Float32Array(this._cameraData);
  private _paramsData = new ArrayBuffer(PARAMS_BUFFER_SIZE);
  private _paramsF32 = new Float32Array(this._paramsData);
  private _paramsI32 = new Int32Array(this._paramsData);

  private _gridResX = 0;
  private _gridResY = 0;
  private _gridResZ = 0;
  private _ready = false;

  constructor(device: GPUDevice, params: Partial<VolumeParamsGPU> = {}) {
    this._device = device;
    this._params = { ...DEFAULT_PARAMS, ...params };

    // Camera uniform buffer
    this._cameraBuffer = device.createBuffer({
      size: CAMERA_BUFFER_SIZE,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // Params uniform buffer
    this._paramsBuffer = device.createBuffer({
      size: PARAMS_BUFFER_SIZE,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // Sampler
    this._sampler = device.createSampler({
      magFilter: 'linear',
      minFilter: 'linear',
      mipmapFilter: 'linear',
      addressModeU: 'clamp-to-edge',
      addressModeV: 'clamp-to-edge',
      addressModeW: 'clamp-to-edge',
    });

    // Bind group layout
    this._bindGroupLayout = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float', viewDimension: '3d' } },
        { binding: 3, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
      ],
    });

    // Write initial params
    this._writeParams();

    // Build pipeline
    this._buildPipeline(device);
  }

  private _buildPipeline(device: GPUDevice): void {
    const shaderModule = device.createShaderModule({ code: FXK_VOXEL_RAYMARCH_WGSL });

    const pipelineLayout = device.createPipelineLayout({
      bindGroupLayouts: [this._bindGroupLayout],
    });

    this._pipeline = device.createRenderPipeline({
      layout: pipelineLayout,
      vertex: {
        module: shaderModule,
        entryPoint: 'vs_main',
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fs_main',
        targets: [{
          format: 'bgra8unorm' as GPUTextureFormat,
          blend: {
            color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
            alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
          },
        }],
      },
      primitive: { topology: 'triangle-list' },
    });
  }

  /** Upload voxel grid data to 3D GPU texture */
  uploadGrid(grid: VoxelGrid): void {
    const { resX, resY, resZ } = grid;

    // Recreate texture if resolution changed
    if (!this._volumeTexture || resX !== this._gridResX || resY !== this._gridResY || resZ !== this._gridResZ) {
      this._volumeTexture?.destroy();

      this._volumeTexture = this._device.createTexture({
        size: [resX, resY, resZ],
        format: 'rgba32float',
        dimension: '3d',
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
      });

      this._gridResX = resX;
      this._gridResY = resY;
      this._gridResZ = resZ;

      // Rebuild bind group with new texture
      this._rebuildBindGroup();
    }

    const data = grid.packTextureData();

    this._device.queue.writeTexture(
      { texture: this._volumeTexture },
      data.buffer,
      { bytesPerRow: resX * 4 * 4, rowsPerImage: resY },
      { width: resX, height: resY, depthOrArrayLayers: resZ },
    );

    this._ready = true;
  }

  private _rebuildBindGroup(): void {
    if (!this._volumeTexture || !this._pipeline) return;

    this._bindGroup = this._device.createBindGroup({
      layout: this._bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: this._cameraBuffer } },
        { binding: 1, resource: { buffer: this._paramsBuffer } },
        { binding: 2, resource: this._volumeTexture.createView({ dimension: '3d' }) },
        { binding: 3, resource: this._sampler },
      ],
    });
  }

  /** Update camera matrices. Arrays must be column-major mat4 (16 floats each). */
  updateCamera(view: Float32Array, proj: Float32Array, invViewProj: Float32Array, posX: number, posY: number, posZ: number): void {
    this._cameraF32.set(view, 0);       // offset 0: view
    this._cameraF32.set(proj, 16);      // offset 64B: proj
    this._cameraF32.set(invViewProj, 32); // offset 128B: inv_view_proj
    this._cameraF32[48] = posX;         // offset 192B: position.x
    this._cameraF32[49] = posY;
    this._cameraF32[50] = posZ;
    this._cameraF32[51] = 1.0;          // w

    this._device.queue.writeBuffer(this._cameraBuffer, 0, this._cameraData);
  }

  updateParams(p: Partial<VolumeParamsGPU>): void {
    Object.assign(this._params, p);
    this._writeParams();
  }

  private _writeParams(): void {
    this._paramsF32[0] = this._params.stepSize;
    this._paramsI32[1] = this._params.maxSteps;
    this._paramsF32[2] = this._params.densityScale;
    this._paramsF32[3] = this._params.emissionScale;
    this._paramsF32[4] = this._params.absorption;
    this._paramsF32[5] = this._params.scattering;
    this._paramsF32[6] = this._params.anisotropy;
    this._paramsF32[7] = 0; // pad

    this._device.queue.writeBuffer(this._paramsBuffer, 0, this._paramsData);
  }

  /** Render volumetric pass into the given texture view */
  render(encoder: GPUCommandEncoder, targetView: GPUTextureView): void {
    if (!this._ready || !this._pipeline || !this._bindGroup) return;

    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view: targetView,
        loadOp: 'load' as GPULoadOp,
        storeOp: 'store' as GPUStoreOp,
      }],
    });

    pass.setPipeline(this._pipeline);
    pass.setBindGroup(0, this._bindGroup);
    pass.draw(6, 1, 0, 0); // fullscreen quad
    pass.end();
  }

  get ready(): boolean { return this._ready; }

  dispose(): void {
    this._volumeTexture?.destroy();
    this._cameraBuffer.destroy();
    this._paramsBuffer.destroy();
    this._ready = false;
    this._pipeline = null;
    this._bindGroup = null;
  }
}
