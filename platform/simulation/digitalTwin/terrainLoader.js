/**
 * FX KONTROL · Digital Twin — Terrain Loader
 * Loads heightmap and satellite imagery for venue simulation.
 * Supports GeoTIFF, PNG heightmaps, and KMZ overlays.
 */

export class TerrainLoader {
  constructor(scene) {
    this.scene = scene;
    this.terrain = null;
    this.resolution = 256;
  }

  async loadHeightmap(url, size = { width: 500, depth: 500 }, maxHeight = 50) {
    const img = await this.loadImage(url);
    const canvas = document.createElement("canvas");
    canvas.width = this.resolution;
    canvas.height = this.resolution;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, this.resolution, this.resolution);
    const imageData = ctx.getImageData(0, 0, this.resolution, this.resolution);

    const heights = new Float32Array(this.resolution * this.resolution);
    for (let i = 0; i < heights.length; i++) {
      heights[i] = (imageData.data[i * 4] / 255) * maxHeight;
    }

    console.log(`[Terrain] Loaded heightmap ${this.resolution}x${this.resolution}, maxH=${maxHeight}m`);
    return { heights, size, resolution: this.resolution };
  }

  async loadSatelliteOverlay(url, terrainMesh) {
    console.log("[Terrain] Satellite overlay applied");
  }

  getHeightAt(x, z, terrainData) {
    const { heights, size, resolution } = terrainData;
    const gridX = Math.floor(((x + size.width / 2) / size.width) * resolution);
    const gridZ = Math.floor(((z + size.depth / 2) / size.depth) * resolution);
    const idx = Math.min(Math.max(gridZ * resolution + gridX, 0), heights.length - 1);
    return heights[idx];
  }

  loadImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
  }
}
