/**
 * 3D Model → Formation Point Converter
 * Parses OBJ, GLTF/GLB files and extracts surface points for drone formations.
 * Supports SketchUp exports and Google Earth/Maps KMZ models.
 */

import type { FormationPoint } from './formations';

interface Vertex3D {
  x: number;
  y: number;
  z: number;
}

/**
 * Parse OBJ file text content into vertices
 */
function parseOBJ(text: string): Vertex3D[] {
  const vertices: Vertex3D[] = [];
  const lines = text.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('v ')) {
      const parts = trimmed.split(/\s+/);
      if (parts.length >= 4) {
        vertices.push({
          x: parseFloat(parts[1]),
          y: parseFloat(parts[2]),
          z: parseFloat(parts[3]),
        });
      }
    }
  }
  return vertices;
}

/**
 * Parse GLTF JSON and extract mesh positions
 */
function parseGLTF(json: any, buffers: ArrayBuffer[]): Vertex3D[] {
  const vertices: Vertex3D[] = [];

  try {
    const meshes = json.meshes || [];
    for (const mesh of meshes) {
      for (const primitive of mesh.primitives || []) {
        const posAccessorIdx = primitive.attributes?.POSITION;
        if (posAccessorIdx === undefined) continue;

        const accessor = json.accessors?.[posAccessorIdx];
        if (!accessor) continue;

        const bufferViewIdx = accessor.bufferView;
        const bufferView = json.bufferViews?.[bufferViewIdx];
        if (!bufferView) continue;

        const buffer = buffers[bufferView.buffer || 0];
        if (!buffer) continue;

        const byteOffset = (bufferView.byteOffset || 0) + (accessor.byteOffset || 0);
        const count = accessor.count || 0;
        const dataView = new Float32Array(buffer, byteOffset, count * 3);

        for (let i = 0; i < count; i++) {
          vertices.push({
            x: dataView[i * 3],
            y: dataView[i * 3 + 1],
            z: dataView[i * 3 + 2],
          });
        }
      }
    }
  } catch (e) {
    console.warn('GLTF parse error:', e);
  }

  return vertices;
}

/**
 * Parse GLB binary format
 */
function parseGLB(arrayBuffer: ArrayBuffer): Vertex3D[] {
  const view = new DataView(arrayBuffer);

  // GLB Header: magic (4), version (4), length (4)
  const magic = view.getUint32(0, true);
  if (magic !== 0x46546C67) { // 'glTF'
    console.warn('Invalid GLB magic number');
    return [];
  }

  // Chunk 0: JSON
  const chunk0Length = view.getUint32(12, true);
  const chunk0Type = view.getUint32(16, true);
  if (chunk0Type !== 0x4E4F534A) { // 'JSON'
    console.warn('Expected JSON chunk');
    return [];
  }

  const jsonBytes = new Uint8Array(arrayBuffer, 20, chunk0Length);
  const jsonStr = new TextDecoder().decode(jsonBytes);
  const json = JSON.parse(jsonStr);

  // Chunk 1: Binary buffer
  const buffers: ArrayBuffer[] = [];
  const chunk1Offset = 20 + chunk0Length;
  if (chunk1Offset + 8 <= arrayBuffer.byteLength) {
    const chunk1Length = view.getUint32(chunk1Offset, true);
    const chunk1Data = arrayBuffer.slice(chunk1Offset + 8, chunk1Offset + 8 + chunk1Length);
    buffers.push(chunk1Data);
  }

  return parseGLTF(json, buffers);
}

/**
 * Parse GLTF with embedded base64 buffers
 */
function parseGLTFWithEmbeddedBuffers(json: any): Vertex3D[] {
  const buffers: ArrayBuffer[] = [];

  for (const bufDef of json.buffers || []) {
    if (bufDef.uri && bufDef.uri.startsWith('data:')) {
      const base64 = bufDef.uri.split(',')[1];
      const binary = atob(base64);
      const arr = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
      buffers.push(arr.buffer);
    } else {
      // External buffer reference - create empty placeholder
      buffers.push(new ArrayBuffer(bufDef.byteLength || 0));
    }
  }

  return parseGLTF(json, buffers);
}

export type ProjectionMode = 'top-down' | 'front' | 'side' | 'isometric';

/**
 * Project 3D vertices to 2D formation points
 */
function projectVertices(
  vertices: Vertex3D[],
  projection: ProjectionMode,
): FormationPoint[] {
  return vertices.map((v) => {
    switch (projection) {
      case 'top-down':
        return { x: v.x, z: v.z };
      case 'front':
        return { x: v.x, z: v.y };
      case 'side':
        return { x: v.z, z: v.y };
      case 'isometric':
        return {
          x: (v.x - v.z) * Math.cos(Math.PI / 6),
          z: (v.x + v.z) * Math.sin(Math.PI / 6) - v.y,
        };
    }
  });
}

/**
 * Normalize points to fit within a target radius and center them
 */
function normalizePoints(points: FormationPoint[], radius: number): FormationPoint[] {
  if (points.length === 0) return [];

  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minZ = Math.min(minZ, p.z);
    maxZ = Math.max(maxZ, p.z);
  }

  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;
  const span = Math.max(maxX - minX, maxZ - minZ, 0.001);
  const scale = (radius * 2) / span;

  return points.map((p) => ({
    x: (p.x - cx) * scale,
    z: (p.z - cz) * scale,
  }));
}

/**
 * Downsample points using spatial hashing (voxel grid)
 */
function downsamplePoints(points: FormationPoint[], targetCount: number): FormationPoint[] {
  if (points.length <= targetCount) return points;

  // Find bounds
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minZ = Math.min(minZ, p.z);
    maxZ = Math.max(maxZ, p.z);
  }

  const span = Math.max(maxX - minX, maxZ - minZ, 0.001);

  // Binary search for the right cell size
  let lo = span / Math.sqrt(targetCount * 4);
  let hi = span;
  let best = points;

  for (let iter = 0; iter < 20; iter++) {
    const cellSize = (lo + hi) / 2;
    const grid = new Map<string, { sx: number; sz: number; count: number }>();

    for (const p of points) {
      const gx = Math.floor(p.x / cellSize);
      const gz = Math.floor(p.z / cellSize);
      const key = `${gx},${gz}`;
      const cell = grid.get(key);
      if (cell) {
        cell.sx += p.x;
        cell.sz += p.z;
        cell.count++;
      } else {
        grid.set(key, { sx: p.x, sz: p.z, count: 1 });
      }
    }

    const result: FormationPoint[] = [];
    for (const cell of grid.values()) {
      result.push({ x: cell.sx / cell.count, z: cell.sz / cell.count });
    }

    if (result.length <= targetCount) {
      best = result;
      hi = cellSize;
    } else {
      lo = cellSize;
    }

    if (Math.abs(result.length - targetCount) <= 2) {
      best = result;
      break;
    }
  }

  // If still too many, randomly sample
  if (best.length > targetCount) {
    const shuffled = [...best].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, targetCount);
  }

  return best;
}

export interface ModelParseResult {
  points: FormationPoint[];
  originalVertexCount: number;
  modelName: string;
}

/**
 * Main entry: parse a 3D model file and generate formation points
 */
export async function parseModelToFormation(
  file: File,
  targetCount: number,
  radius: number,
  projection: ProjectionMode = 'top-down',
): Promise<ModelParseResult> {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const modelName = file.name.replace(/\.[^.]+$/, '');
  let vertices: Vertex3D[] = [];

  if (ext === 'obj') {
    const text = await file.text();
    vertices = parseOBJ(text);
  } else if (ext === 'glb') {
    const buffer = await file.arrayBuffer();
    vertices = parseGLB(buffer);
  } else if (ext === 'gltf') {
    const text = await file.text();
    const json = JSON.parse(text);
    vertices = parseGLTFWithEmbeddedBuffers(json);
  } else {
    throw new Error(`Formato não suportado: .${ext}. Use .OBJ, .GLTF ou .GLB`);
  }

  if (vertices.length === 0) {
    throw new Error('Nenhum vértice encontrado no modelo 3D');
  }

  // Project 3D → 2D
  let points = projectVertices(vertices, projection);

  // Normalize to target radius
  points = normalizePoints(points, radius);

  // Downsample to target count
  points = downsamplePoints(points, targetCount);

  return {
    points,
    originalVertexCount: vertices.length,
    modelName,
  };
}

/**
 * Parse a KMZ file (Google Earth export) — extracts KML coordinates
 */
export async function parseKMZToFormation(
  file: File,
  targetCount: number,
  radius: number,
): Promise<ModelParseResult> {
  // KMZ is a ZIP containing a KML file
  // For browser, we'll try to read it as a KML text if it's actually .kml
  const ext = file.name.split('.').pop()?.toLowerCase();

  if (ext === 'kml') {
    const text = await file.text();
    return parseKMLText(text, targetCount, radius, file.name);
  }

  // For true KMZ (zip), we extract coordinates from any embedded models
  throw new Error('KMZ requer descompactação. Exporte como .KML ou .OBJ do Google Earth.');
}

function parseKMLText(
  kmlText: string,
  targetCount: number,
  radius: number,
  fileName: string,
): ModelParseResult {
  const parser = new DOMParser();
  const doc = parser.parseFromString(kmlText, 'text/xml');
  const coordElements = doc.querySelectorAll('coordinates');
  const vertices: Vertex3D[] = [];

  coordElements.forEach((el) => {
    const text = el.textContent?.trim() || '';
    const lines = text.split(/\s+/);
    for (const line of lines) {
      const parts = line.split(',');
      if (parts.length >= 2) {
        vertices.push({
          x: parseFloat(parts[0]) || 0, // lng
          y: parseFloat(parts[2] || '0') || 0, // alt
          z: parseFloat(parts[1]) || 0, // lat
        });
      }
    }
  });

  if (vertices.length === 0) {
    throw new Error('Nenhuma coordenada encontrada no KML');
  }

  let points = projectVertices(vertices, 'top-down');
  points = normalizePoints(points, radius);
  points = downsamplePoints(points, targetCount);

  return {
    points,
    originalVertexCount: vertices.length,
    modelName: fileName.replace(/\.[^.]+$/, ''),
  };
}
