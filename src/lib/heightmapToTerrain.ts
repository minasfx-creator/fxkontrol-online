// ═══ Heightmap to Terrain Geometry ═══
// Converts image data (PNG/JPG) into displacement data for 3D terrain

export interface TerrainConfig {
  width: number;          // world units (meters)
  depth: number;          // world units (meters)
  maxHeight: number;      // max displacement (meters)
  resolution: number;     // segments per axis (64, 128, 256)
  offsetX: number;
  offsetZ: number;
}

export interface TerrainData {
  heightmap: Float32Array;   // normalized 0-1 values
  width: number;
  height: number;
  config: TerrainConfig;
}

export const DEFAULT_TERRAIN_CONFIG: TerrainConfig = {
  width: 500,
  depth: 500,
  maxHeight: 50,
  resolution: 128,
  offsetX: 0,
  offsetZ: 0,
};

/**
 * Load an image file and extract heightmap data
 */
export async function imageToHeightmap(file: File): Promise<{ data: Float32Array; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Canvas 2D context unavailable')); return; }

        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, img.width, img.height);
        const pixels = imageData.data;
        const heightmap = new Float32Array(img.width * img.height);

        for (let i = 0; i < heightmap.length; i++) {
          const idx = i * 4;
          // Luminance: 0.299R + 0.587G + 0.114B, normalized to 0-1
          heightmap[i] = (pixels[idx] * 0.299 + pixels[idx + 1] * 0.587 + pixels[idx + 2] * 0.114) / 255;
        }

        resolve({ data: heightmap, width: img.width, height: img.height });
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Sample heightmap at given resolution for mesh generation
 */
export function sampleHeightmap(
  data: Float32Array,
  srcWidth: number,
  srcHeight: number,
  targetResolution: number
): Float32Array {
  const sampled = new Float32Array((targetResolution + 1) * (targetResolution + 1));

  for (let z = 0; z <= targetResolution; z++) {
    for (let x = 0; x <= targetResolution; x++) {
      const srcX = Math.min(Math.floor((x / targetResolution) * (srcWidth - 1)), srcWidth - 1);
      const srcZ = Math.min(Math.floor((z / targetResolution) * (srcHeight - 1)), srcHeight - 1);
      sampled[z * (targetResolution + 1) + x] = data[srcZ * srcWidth + srcX];
    }
  }

  return sampled;
}
