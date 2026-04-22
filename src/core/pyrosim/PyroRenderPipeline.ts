/**
 * ─── PyroRenderPipeline ─────────────────────────────────────────────
 * Layer-separated render pipeline configuration.
 * 
 * Layers:
 *   0: Emissive fire core (additive, HDR bright)
 *   1: Spark particles (additive, velocity-stretched)
 *   2: Ember trails (additive, dimmer, longer life)
 *   3: Smoke volume (normal blend, soft particles)
 *   4: Bloom/HDR (post-processing)
 *   5: Camera response (desaturation, highlight compression)
 */

export type RenderLayerId = 0 | 1 | 2 | 3 | 4 | 5;

export interface RenderLayerConfig {
  id: RenderLayerId;
  name: string;
  enabled: boolean;
  blendMode: 'additive' | 'normal' | 'multiply';
  opacityMultiplier: number;
  hdrMultiplier: number;    // >1 for HDR layers
}

export interface CameraResponseConfig {
  autoExposure: boolean;
  exposureBias: number;         // EV offset
  highlightCompression: number; // 0-1 (how much to compress bright areas)
  desaturationAtPeak: number;   // 0-1 (desaturate when luminance very high)
  motionBlurStrength: number;   // 0-1
}

export interface PyroRenderConfig {
  layers: RenderLayerConfig[];
  camera: CameraResponseConfig;
  bloomThreshold: number;       // luminance threshold for bloom
  bloomIntensity: number;       // bloom strength
  bloomRadius: number;          // bloom spread
}

const DEFAULT_LAYERS: RenderLayerConfig[] = [
  { id: 0, name: 'Emissive Core', enabled: true, blendMode: 'additive', opacityMultiplier: 1.0, hdrMultiplier: 3.0 },
  { id: 1, name: 'Spark Particles', enabled: true, blendMode: 'additive', opacityMultiplier: 0.9, hdrMultiplier: 2.0 },
  { id: 2, name: 'Ember Trails', enabled: true, blendMode: 'additive', opacityMultiplier: 0.6, hdrMultiplier: 1.0 },
  { id: 3, name: 'Smoke Volume', enabled: true, blendMode: 'normal', opacityMultiplier: 0.7, hdrMultiplier: 1.0 },
  { id: 4, name: 'Bloom/HDR', enabled: true, blendMode: 'additive', opacityMultiplier: 1.0, hdrMultiplier: 1.5 },
  { id: 5, name: 'Camera Response', enabled: true, blendMode: 'normal', opacityMultiplier: 1.0, hdrMultiplier: 1.0 },
];

const DEFAULT_CAMERA: CameraResponseConfig = {
  autoExposure: true,
  exposureBias: 0.0,
  highlightCompression: 0.3,
  desaturationAtPeak: 0.2,
  motionBlurStrength: 0.15,
};

export class PyroRenderPipeline {
  private config: PyroRenderConfig;

  constructor(config?: Partial<PyroRenderConfig>) {
    this.config = {
      layers: config?.layers ?? DEFAULT_LAYERS.map(l => ({ ...l })),
      camera: { ...DEFAULT_CAMERA, ...config?.camera },
      bloomThreshold: config?.bloomThreshold ?? 0.8,
      bloomIntensity: config?.bloomIntensity ?? 1.2,
      bloomRadius: config?.bloomRadius ?? 0.4,
    };
  }

  /**
   * Check if a layer is enabled.
   */
  isLayerEnabled(id: RenderLayerId): boolean {
    return this.config.layers[id]?.enabled ?? false;
  }

  /**
   * Toggle a layer on/off (for debug/LOD).
   */
  setLayerEnabled(id: RenderLayerId, enabled: boolean): void {
    if (this.config.layers[id]) {
      this.config.layers[id].enabled = enabled;
    }
  }

  /**
   * Get HDR multiplier for a layer.
   */
  getHDRMultiplier(id: RenderLayerId): number {
    return this.config.layers[id]?.hdrMultiplier ?? 1.0;
  }

  /**
   * Get full layer config.
   */
  getLayerConfig(id: RenderLayerId): Readonly<RenderLayerConfig> {
    return this.config.layers[id];
  }

  /**
   * Get camera response config.
   */
  getCameraResponse(): Readonly<CameraResponseConfig> {
    return this.config.camera;
  }

  /**
   * Get bloom config.
   */
  getBloomConfig(): { threshold: number; intensity: number; radius: number } {
    return {
      threshold: this.config.bloomThreshold,
      intensity: this.config.bloomIntensity,
      radius: this.config.bloomRadius,
    };
  }

  /**
   * Update camera response (e.g., from calibration panel).
   */
  setCameraResponse(partial: Partial<CameraResponseConfig>): void {
    Object.assign(this.config.camera, partial);
  }

  /**
   * Apply LOD-based layer reduction.
   * Lower quality → disable expensive layers.
   */
  applyLODPreset(quality: 'ultra' | 'high' | 'medium' | 'safe'): void {
    switch (quality) {
      case 'ultra':
        this.config.layers.forEach(l => l.enabled = true);
        break;
      case 'high':
        this.config.layers.forEach(l => l.enabled = true);
        this.config.layers[5].enabled = false; // skip camera response
        break;
      case 'medium':
        this.config.layers[0].enabled = true;
        this.config.layers[1].enabled = true;
        this.config.layers[2].enabled = false; // skip embers
        this.config.layers[3].enabled = true;
        this.config.layers[4].enabled = true;
        this.config.layers[5].enabled = false;
        break;
      case 'safe':
        this.config.layers[0].enabled = true;
        this.config.layers[1].enabled = false;
        this.config.layers[2].enabled = false;
        this.config.layers[3].enabled = false;
        this.config.layers[4].enabled = true;
        this.config.layers[5].enabled = false;
        break;
    }
  }

  /**
   * Get full config for serialization / debug.
   */
  getConfig(): Readonly<PyroRenderConfig> {
    return this.config;
  }

  /**
   * Reset to defaults.
   */
  reset(): void {
    this.config.layers = DEFAULT_LAYERS.map(l => ({ ...l }));
    this.config.camera = { ...DEFAULT_CAMERA };
    this.config.bloomThreshold = 0.8;
    this.config.bloomIntensity = 1.2;
    this.config.bloomRadius = 0.4;
  }
}

/** Global render pipeline instance */
export const globalRenderPipeline = new PyroRenderPipeline();
