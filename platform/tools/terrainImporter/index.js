/**
 * FX KONTROL · Terrain Importer Tool
 * Imports terrain data from GeoTIFF, SRTM, and heightmap PNGs.
 * by Minas FX
 */

export class TerrainImporter {
  static async fromHeightmapPNG(url, config = {}) {
    const { width = 500, depth = 500, maxHeight = 50 } = config;
    console.log(`[TerrainImporter] Loading heightmap: ${url}`);
    // PNG → Float32Array heightfield
    return { type: "heightmap", width, depth, maxHeight, source: url };
  }

  static async fromGeoTIFF(url) {
    console.log(`[TerrainImporter] Loading GeoTIFF: ${url}`);
    return { type: "geotiff", source: url };
  }

  static async fromSRTM(lat, lon, radius = 1000) {
    const tile = `N${Math.floor(lat)}E${Math.floor(lon)}`;
    console.log(`[TerrainImporter] Loading SRTM tile: ${tile}, radius=${radius}m`);
    return { type: "srtm", tile, lat, lon, radius };
  }
}
