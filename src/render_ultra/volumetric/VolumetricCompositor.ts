/**
 * VolumetricCompositor — Orchestrates volumetric volume lifecycle.
 * Manages spawn/inject/update/render with distance-based LOD and culling.
 * Automatically selects WebGPU native path or WebGL fallback.
 */
import * as THREE from 'three';
import { VoxelGrid, VoxelGridConfig } from './VoxelGrid';
import { injectSources, InjectionSource } from './DensityInjection';
import { simulateVolume, SimulationConfig, DEFAULT_SIM_CONFIG } from './VolumeSimulation';
import { RaymarchRenderer, RaymarchConfig, DEFAULT_RAYMARCH_CONFIG } from './RaymarchRenderer';
import { WebGPURaymarchPipeline, VolumeParamsGPU } from './WebGPURaymarchPipeline';

export type VolumePhase = 'fadein' | 'active' | 'fadeout' | 'dead';

export interface VolumeInstance {
  id: string;
  grid: VoxelGrid;
  renderer: RaymarchRenderer | null;  // WebGL fallback
  phase: VolumePhase;
  age: number;
  maxAge: number;
  fadeInDuration: number;
  fadeOutDuration: number;
  simConfig: SimulationConfig;
}

export interface CompositorConfig {
  maxActiveVolumes: number;
  cullDistance: number;
  lodNearDistance: number;
  lodFarDistance: number;
}

const DEFAULT_COMPOSITOR: CompositorConfig = {
  maxActiveVolumes: 4,
  cullDistance: 200,
  lodNearDistance: 30,
  lodFarDistance: 100,
};

export class VolumetricCompositor {
  private _volumes: Map<string, VolumeInstance> = new Map();
  private _scene: THREE.Scene;
  private _config: CompositorConfig;
  private _nextId = 0;

  // WebGPU native path
  private _gpuPipeline: WebGPURaymarchPipeline | null = null;
  private _gpuDevice: GPUDevice | null = null;
  private _useWebGPU = false;

  constructor(scene: THREE.Scene, config: Partial<CompositorConfig> = {}, gpuDevice?: GPUDevice) {
    this._scene = scene;
    this._config = { ...DEFAULT_COMPOSITOR, ...config };

    if (gpuDevice) {
      try {
        this._gpuPipeline = new WebGPURaymarchPipeline(gpuDevice);
        this._gpuDevice = gpuDevice;
        this._useWebGPU = true;
        console.log('[Volumetric] WebGPU native raymarch pipeline active');
      } catch (e) {
        console.warn('[Volumetric] WebGPU pipeline failed, using WebGL fallback', e);
        this._useWebGPU = false;
      }
    }
  }

  /** Spawn a new volume at a world position */
  spawn(
    gridConfig: Partial<VoxelGridConfig> = {},
    maxAge = 8,
    fadeIn = 0.5,
    fadeOut = 2.0,
    simConfig: Partial<SimulationConfig> = {},
    raymarchConfig: Partial<RaymarchConfig> = {},
  ): string {
    // Enforce limit
    if (this._volumes.size >= this._config.maxActiveVolumes) {
      // Kill oldest
      let oldest: VolumeInstance | null = null;
      for (const v of this._volumes.values()) {
        if (!oldest || v.age > oldest.age) oldest = v;
      }
      if (oldest) this._killVolume(oldest.id);
    }

    const id = `vol_${this._nextId++}`;
    const grid = new VoxelGrid(gridConfig);

    let renderer: RaymarchRenderer | null = null;
    if (!this._useWebGPU) {
      renderer = new RaymarchRenderer(grid, raymarchConfig);
      this._scene.add(renderer.mesh);
    }

    this._volumes.set(id, {
      id,
      grid,
      renderer,
      phase: 'fadein',
      age: 0,
      maxAge,
      fadeInDuration: fadeIn,
      fadeOutDuration: fadeOut,
      simConfig: { ...DEFAULT_SIM_CONFIG, ...simConfig },
    });

    return id;
  }

  /** Inject density sources into a volume */
  inject(id: string, sources: InjectionSource[]): void {
    const vol = this._volumes.get(id);
    if (!vol || vol.phase === 'dead') return;
    injectSources(vol.grid, sources);
  }

  /** Per-frame update: simulate, upload, manage lifecycle */
  update(dt: number, time: number, cameraPosition: THREE.Vector3): void {
    const toRemove: string[] = [];

    for (const vol of this._volumes.values()) {
      vol.age += dt;

      // Phase transitions
      if (vol.phase === 'fadein' && vol.age >= vol.fadeInDuration) {
        vol.phase = 'active';
      }
      if (vol.phase === 'active' && vol.age >= vol.maxAge - vol.fadeOutDuration) {
        vol.phase = 'fadeout';
      }
      if (vol.age >= vol.maxAge) {
        vol.phase = 'dead';
        toRemove.push(vol.id);
        continue;
      }

      // Distance culling
      const origin = vol.grid.worldOrigin;
      const dx = cameraPosition.x - origin[0];
      const dy = cameraPosition.y - origin[1];
      const dz = cameraPosition.z - origin[2];
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (dist > this._config.cullDistance) {
        if (vol.renderer) vol.renderer.mesh.visible = false;
        continue;
      }

      // Simulate
      simulateVolume(vol.grid, dt, time, vol.simConfig);

      // WebGL path: upload + render
      if (vol.renderer) {
        vol.renderer.mesh.visible = true;
        vol.renderer.uploadGrid();
        vol.renderer.updateCamera(cameraPosition);

        // LOD: adjust step count by distance
        if (dist < this._config.lodNearDistance) {
          vol.renderer.updateConfig({ maxSteps: 96 });
        } else if (dist < this._config.lodFarDistance) {
          vol.renderer.updateConfig({ maxSteps: 48 });
        } else {
          vol.renderer.updateConfig({ maxSteps: 24 });
        }

        // Fade opacity
        let opacity = 1.0;
        if (vol.phase === 'fadein') opacity = vol.age / vol.fadeInDuration;
        if (vol.phase === 'fadeout') opacity = (vol.maxAge - vol.age) / vol.fadeOutDuration;
        (vol.renderer.mesh.material as THREE.ShaderMaterial).opacity = opacity;
      }

      // WebGPU path: upload grid to shared pipeline
      if (this._useWebGPU && this._gpuPipeline) {
        this._gpuPipeline.uploadGrid(vol.grid);
      }
    }

    for (const id of toRemove) {
      this._killVolume(id);
    }
  }

  /** Render WebGPU volumes (call from WebGPU render loop) */
  renderWebGPU(
    encoder: GPUCommandEncoder,
    targetView: GPUTextureView,
    viewMatrix: Float32Array,
    projMatrix: Float32Array,
    invViewProj: Float32Array,
    camPos: [number, number, number],
  ): void {
    if (!this._gpuPipeline || !this._gpuPipeline.ready) return;
    this._gpuPipeline.updateCamera(viewMatrix, projMatrix, invViewProj, camPos[0], camPos[1], camPos[2]);
    this._gpuPipeline.render(encoder, targetView);
  }

  get useWebGPU(): boolean { return this._useWebGPU; }
  get activeCount(): number { return this._volumes.size; }

  private _killVolume(id: string): void {
    const vol = this._volumes.get(id);
    if (!vol) return;
    if (vol.renderer) {
      this._scene.remove(vol.renderer.mesh);
      vol.renderer.dispose();
    }
    this._volumes.delete(id);
  }

  dispose(): void {
    for (const id of this._volumes.keys()) {
      this._killVolume(id);
    }
    this._gpuPipeline?.dispose();
    this._gpuPipeline = null;
  }
}
