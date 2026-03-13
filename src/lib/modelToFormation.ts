/**
 * 3D Model → Formation Point Converter
 * Parses OBJ, STL, GLTF/GLB files and extracts surface points for drone formations.
 * Supports SketchUp exports, Google Earth/Maps KMZ models, and Blender exports.
 *
 * v2 — Surface sampling, edge extraction, STL support, improved density control.
 */

import type { FormationPoint } from './formations';

interface Vertex3D {
  x: number;
  y: number;
  z: number;
}

interface Triangle {
  a: Vertex3D;
  b: Vertex3D;
  c: Vertex3D;
}

// ─── Parsers ──────────────────────────────────────────────────

function parseOBJ(text: string): { vertices: Vertex3D[]; triangles: Triangle[] } {
  const vertices: Vertex3D[] = [];
  const triangles: Triangle[] = [];
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
    } else if (trimmed.startsWith('f ')) {
      const parts = trimmed.split(/\s+/).slice(1);
      // Parse face indices (OBJ is 1-based, supports v, v/vt, v/vt/vn formats)
      const indices = parts.map(p => parseInt(p.split('/')[0]) - 1);
      // Triangulate polygon fans
      for (let i = 1; i < indices.length - 1; i++) {
        const a = vertices[indices[0]];
        const b = vertices[indices[i]];
        const c = vertices[indices[i + 1]];
        if (a && b && c) triangles.push({ a, b, c });
      }
    }
  }

  return { vertices, triangles };
}

/** Parse binary STL */
function parseSTL(buffer: ArrayBuffer): { vertices: Vertex3D[]; triangles: Triangle[] } {
  const vertices: Vertex3D[] = [];
  const triangles: Triangle[] = [];
  const view = new DataView(buffer);

  // Check if ASCII STL
  const header = new Uint8Array(buffer, 0, Math.min(80, buffer.byteLength));
  const headerStr = new TextDecoder().decode(header);
  if (headerStr.startsWith('solid') && buffer.byteLength < 1_000_000) {
    // Try ASCII parse
    const text = new TextDecoder().decode(new Uint8Array(buffer));
    return parseSTLAscii(text);
  }

  // Binary STL: 80-byte header, then uint32 triangle count
  if (buffer.byteLength < 84) return { vertices, triangles };
  const numTriangles = view.getUint32(80, true);
  const expectedSize = 84 + numTriangles * 50;

  if (buffer.byteLength < expectedSize) return { vertices, triangles };

  for (let i = 0; i < numTriangles; i++) {
    const offset = 84 + i * 50;
    // Skip normal (12 bytes), read 3 vertices (each 12 bytes)
    const a: Vertex3D = {
      x: view.getFloat32(offset + 12, true),
      y: view.getFloat32(offset + 16, true),
      z: view.getFloat32(offset + 20, true),
    };
    const b: Vertex3D = {
      x: view.getFloat32(offset + 24, true),
      y: view.getFloat32(offset + 28, true),
      z: view.getFloat32(offset + 32, true),
    };
    const c: Vertex3D = {
      x: view.getFloat32(offset + 36, true),
      y: view.getFloat32(offset + 40, true),
      z: view.getFloat32(offset + 44, true),
    };
    vertices.push(a, b, c);
    triangles.push({ a, b, c });
  }

  return { vertices, triangles };
}

function parseSTLAscii(text: string): { vertices: Vertex3D[]; triangles: Triangle[] } {
  const vertices: Vertex3D[] = [];
  const triangles: Triangle[] = [];
  const vertexRegex = /vertex\s+([\d.eE+-]+)\s+([\d.eE+-]+)\s+([\d.eE+-]+)/g;
  let match;
  const triVerts: Vertex3D[] = [];

  while ((match = vertexRegex.exec(text)) !== null) {
    const v: Vertex3D = {
      x: parseFloat(match[1]),
      y: parseFloat(match[2]),
      z: parseFloat(match[3]),
    };
    vertices.push(v);
    triVerts.push(v);
    if (triVerts.length === 3) {
      triangles.push({ a: triVerts[0], b: triVerts[1], c: triVerts[2] });
      triVerts.length = 0;
    }
  }

  return { vertices, triangles };
}

function parseGLTF(json: any, buffers: ArrayBuffer[]): { vertices: Vertex3D[]; triangles: Triangle[] } {
  const vertices: Vertex3D[] = [];
  const triangles: Triangle[] = [];

  try {
    for (const mesh of json.meshes || []) {
      for (const primitive of mesh.primitives || []) {
        const posIdx = primitive.attributes?.POSITION;
        if (posIdx === undefined) continue;

        const accessor = json.accessors?.[posIdx];
        if (!accessor) continue;

        const bvIdx = accessor.bufferView;
        const bv = json.bufferViews?.[bvIdx];
        if (!bv) continue;

        const buf = buffers[bv.buffer || 0];
        if (!buf) continue;

        const byteOff = (bv.byteOffset || 0) + (accessor.byteOffset || 0);
        const count = accessor.count || 0;
        const posData = new Float32Array(buf, byteOff, count * 3);

        const meshVerts: Vertex3D[] = [];
        for (let i = 0; i < count; i++) {
          const v: Vertex3D = { x: posData[i * 3], y: posData[i * 3 + 1], z: posData[i * 3 + 2] };
          vertices.push(v);
          meshVerts.push(v);
        }

        // Extract index buffer for triangles
        const indexIdx = primitive.indices;
        if (indexIdx !== undefined) {
          const idxAccessor = json.accessors?.[indexIdx];
          if (idxAccessor) {
            const idxBvIdx = idxAccessor.bufferView;
            const idxBv = json.bufferViews?.[idxBvIdx];
            if (idxBv) {
              const idxBuf = buffers[idxBv.buffer || 0];
              if (idxBuf) {
                const idxOff = (idxBv.byteOffset || 0) + (idxAccessor.byteOffset || 0);
                const idxCount = idxAccessor.count || 0;
                const componentType = idxAccessor.componentType;
                let indices: number[] = [];

                if (componentType === 5123) { // UNSIGNED_SHORT
                  const arr = new Uint16Array(idxBuf, idxOff, idxCount);
                  indices = Array.from(arr);
                } else if (componentType === 5125) { // UNSIGNED_INT
                  const arr = new Uint32Array(idxBuf, idxOff, idxCount);
                  indices = Array.from(arr);
                } else if (componentType === 5121) { // UNSIGNED_BYTE
                  const arr = new Uint8Array(idxBuf, idxOff, idxCount);
                  indices = Array.from(arr);
                }

                for (let i = 0; i + 2 < indices.length; i += 3) {
                  const a = meshVerts[indices[i]];
                  const b = meshVerts[indices[i + 1]];
                  const c = meshVerts[indices[i + 2]];
                  if (a && b && c) triangles.push({ a, b, c });
                }
              }
            }
          }
        }
      }
    }
  } catch (e) {
    console.warn('GLTF parse error:', e);
  }

  return { vertices, triangles };
}

function parseGLB(arrayBuffer: ArrayBuffer): { vertices: Vertex3D[]; triangles: Triangle[] } {
  const view = new DataView(arrayBuffer);
  const magic = view.getUint32(0, true);
  if (magic !== 0x46546C67) return { vertices: [], triangles: [] };

  const chunk0Length = view.getUint32(12, true);
  const chunk0Type = view.getUint32(16, true);
  if (chunk0Type !== 0x4E4F534A) return { vertices: [], triangles: [] };

  const jsonBytes = new Uint8Array(arrayBuffer, 20, chunk0Length);
  const json = JSON.parse(new TextDecoder().decode(jsonBytes));

  const buffers: ArrayBuffer[] = [];
  const chunk1Offset = 20 + chunk0Length;
  if (chunk1Offset + 8 <= arrayBuffer.byteLength) {
    const chunk1Length = view.getUint32(chunk1Offset, true);
    buffers.push(arrayBuffer.slice(chunk1Offset + 8, chunk1Offset + 8 + chunk1Length));
  }

  return parseGLTF(json, buffers);
}

function parseGLTFWithEmbeddedBuffers(json: any): { vertices: Vertex3D[]; triangles: Triangle[] } {
  const buffers: ArrayBuffer[] = [];
  for (const bufDef of json.buffers || []) {
    if (bufDef.uri && bufDef.uri.startsWith('data:')) {
      const base64 = bufDef.uri.split(',')[1];
      const binary = atob(base64);
      const arr = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
      buffers.push(arr.buffer);
    } else {
      buffers.push(new ArrayBuffer(bufDef.byteLength || 0));
    }
  }
  return parseGLTF(json, buffers);
}

// ─── Surface Sampling ─────────────────────────────────────────

/** Sample points uniformly across triangle surfaces */
function sampleTriangleSurface(triangles: Triangle[], targetCount: number): Vertex3D[] {
  if (triangles.length === 0) return [];

  // Calculate area of each triangle
  const areas: number[] = [];
  let totalArea = 0;
  for (const tri of triangles) {
    const ax = tri.b.x - tri.a.x, ay = tri.b.y - tri.a.y, az = tri.b.z - tri.a.z;
    const bx = tri.c.x - tri.a.x, by = tri.c.y - tri.a.y, bz = tri.c.z - tri.a.z;
    const cx = ay * bz - az * by, cy = az * bx - ax * bz, cz = ax * by - ay * bx;
    const area = 0.5 * Math.sqrt(cx * cx + cy * cy + cz * cz);
    areas.push(area);
    totalArea += area;
  }

  if (totalArea === 0) return [];

  const points: Vertex3D[] = [];
  for (let i = 0; i < triangles.length; i++) {
    const samplesForTri = Math.max(1, Math.round((areas[i] / totalArea) * targetCount));
    const tri = triangles[i];
    for (let s = 0; s < samplesForTri && points.length < targetCount * 1.2; s++) {
      // Random barycentric coordinates
      let u = Math.random(), v = Math.random();
      if (u + v > 1) { u = 1 - u; v = 1 - v; }
      const w = 1 - u - v;
      points.push({
        x: tri.a.x * w + tri.b.x * u + tri.c.x * v,
        y: tri.a.y * w + tri.b.y * u + tri.c.y * v,
        z: tri.a.z * w + tri.b.z * u + tri.c.z * v,
      });
    }
  }

  return points;
}

/** Extract edge points from triangles — good for wireframe-style formations */
function extractEdgePoints(triangles: Triangle[], targetCount: number): Vertex3D[] {
  if (triangles.length === 0) return [];

  // Collect unique edges using a spatial hash
  const edgeSet = new Set<string>();
  const edges: [Vertex3D, Vertex3D][] = [];

  const edgeKey = (a: Vertex3D, b: Vertex3D) => {
    const k1 = `${a.x.toFixed(4)},${a.y.toFixed(4)},${a.z.toFixed(4)}`;
    const k2 = `${b.x.toFixed(4)},${b.y.toFixed(4)},${b.z.toFixed(4)}`;
    return k1 < k2 ? `${k1}|${k2}` : `${k2}|${k1}`;
  };

  for (const tri of triangles) {
    for (const [a, b] of [[tri.a, tri.b], [tri.b, tri.c], [tri.c, tri.a]] as [Vertex3D, Vertex3D][]) {
      const key = edgeKey(a, b);
      if (!edgeSet.has(key)) {
        edgeSet.add(key);
        edges.push([a, b]);
      }
    }
  }

  // Calculate total edge length
  let totalLength = 0;
  const lengths: number[] = [];
  for (const [a, b] of edges) {
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
    const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
    lengths.push(len);
    totalLength += len;
  }

  if (totalLength === 0) return [];

  // Sample points along edges proportionally
  const points: Vertex3D[] = [];
  for (let i = 0; i < edges.length; i++) {
    const samplesForEdge = Math.max(1, Math.round((lengths[i] / totalLength) * targetCount));
    const [a, b] = edges[i];
    for (let s = 0; s < samplesForEdge && points.length < targetCount * 1.1; s++) {
      const t = samplesForEdge === 1 ? 0.5 : s / (samplesForEdge - 1);
      points.push({
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
        z: a.z + (b.z - a.z) * t,
      });
    }
  }

  return points;
}

// ─── Projection & Normalization ───────────────────────────────

export type ProjectionMode = 'top-down' | 'front' | 'side' | 'isometric';
export type SamplingMode = 'vertices' | 'surface' | 'edges';

function projectVertices(vertices: Vertex3D[], projection: ProjectionMode): FormationPoint[] {
  return vertices.map((v) => {
    switch (projection) {
      case 'top-down': return { x: v.x, z: v.z };
      case 'front': return { x: v.x, z: v.y };
      case 'side': return { x: v.z, z: v.y };
      case 'isometric': return {
        x: (v.x - v.z) * Math.cos(Math.PI / 6),
        z: (v.x + v.z) * Math.sin(Math.PI / 6) - v.y,
      };
    }
  });
}

function normalizePoints(points: FormationPoint[], radius: number): FormationPoint[] {
  if (points.length === 0) return [];
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
  }
  const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
  const span = Math.max(maxX - minX, maxZ - minZ, 0.001);
  const scale = (radius * 2) / span;
  return points.map(p => ({ x: (p.x - cx) * scale, z: (p.z - cz) * scale }));
}

function downsamplePoints(points: FormationPoint[], targetCount: number): FormationPoint[] {
  if (points.length <= targetCount) return points;

  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
  }
  const span = Math.max(maxX - minX, maxZ - minZ, 0.001);

  let lo = span / Math.sqrt(targetCount * 4);
  let hi = span;
  let best = points;

  for (let iter = 0; iter < 20; iter++) {
    const cellSize = (lo + hi) / 2;
    const grid = new Map<string, { sx: number; sz: number; count: number }>();
    for (const p of points) {
      const gx = Math.floor(p.x / cellSize), gz = Math.floor(p.z / cellSize);
      const key = `${gx},${gz}`;
      const cell = grid.get(key);
      if (cell) { cell.sx += p.x; cell.sz += p.z; cell.count++; }
      else grid.set(key, { sx: p.x, sz: p.z, count: 1 });
    }
    const result: FormationPoint[] = [];
    for (const cell of grid.values()) {
      result.push({ x: cell.sx / cell.count, z: cell.sz / cell.count });
    }
    if (result.length <= targetCount) { best = result; hi = cellSize; }
    else lo = cellSize;
    if (Math.abs(result.length - targetCount) <= 2) { best = result; break; }
  }

  if (best.length > targetCount) {
    const shuffled = [...best].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, targetCount);
  }
  return best;
}

// ─── Public API ───────────────────────────────────────────────

export interface ModelParseResult {
  points: FormationPoint[];
  originalVertexCount: number;
  triangleCount: number;
  modelName: string;
  samplingUsed: SamplingMode;
}

export async function parseModelToFormation(
  file: File,
  targetCount: number,
  radius: number,
  projection: ProjectionMode = 'top-down',
  sampling: SamplingMode = 'surface',
): Promise<ModelParseResult> {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const modelName = file.name.replace(/\.[^.]+$/, '');
  let vertices: Vertex3D[] = [];
  let triangles: Triangle[] = [];

  if (ext === 'obj') {
    const text = await file.text();
    const parsed = parseOBJ(text);
    vertices = parsed.vertices;
    triangles = parsed.triangles;
  } else if (ext === 'stl') {
    const buffer = await file.arrayBuffer();
    const parsed = parseSTL(buffer);
    vertices = parsed.vertices;
    triangles = parsed.triangles;
  } else if (ext === 'glb') {
    const buffer = await file.arrayBuffer();
    const parsed = parseGLB(buffer);
    vertices = parsed.vertices;
    triangles = parsed.triangles;
  } else if (ext === 'gltf') {
    const text = await file.text();
    const json = JSON.parse(text);
    const parsed = parseGLTFWithEmbeddedBuffers(json);
    vertices = parsed.vertices;
    triangles = parsed.triangles;
  } else {
    throw new Error(`Formato não suportado: .${ext}. Use .OBJ, .STL, .GLTF ou .GLB`);
  }

  if (vertices.length === 0) {
    throw new Error('Nenhum vértice encontrado no modelo 3D');
  }

  // Choose sampling strategy
  let sampledVertices: Vertex3D[];
  let actualSampling = sampling;

  if (sampling === 'surface' && triangles.length > 0) {
    sampledVertices = sampleTriangleSurface(triangles, targetCount * 2);
  } else if (sampling === 'edges' && triangles.length > 0) {
    sampledVertices = extractEdgePoints(triangles, targetCount * 2);
  } else {
    // Fallback to raw vertices
    sampledVertices = vertices;
    actualSampling = 'vertices';
  }

  let points = projectVertices(sampledVertices, projection);
  points = normalizePoints(points, radius);
  points = downsamplePoints(points, targetCount);

  return {
    points,
    originalVertexCount: vertices.length,
    triangleCount: triangles.length,
    modelName,
    samplingUsed: actualSampling,
  };
}

export async function parseKMZToFormation(
  file: File,
  targetCount: number,
  radius: number,
): Promise<ModelParseResult> {
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext === 'kml') {
    const text = await file.text();
    return parseKMLText(text, targetCount, radius, file.name);
  }
  throw new Error('KMZ requer descompactação. Exporte como .KML ou .OBJ do Google Earth.');
}

function parseKMLText(kmlText: string, targetCount: number, radius: number, fileName: string): ModelParseResult {
  const parser = new DOMParser();
  const doc = parser.parseFromString(kmlText, 'text/xml');
  const coordElements = doc.querySelectorAll('coordinates');
  const vertices: Vertex3D[] = [];

  coordElements.forEach((el) => {
    const text = el.textContent?.trim() || '';
    for (const line of text.split(/\s+/)) {
      const parts = line.split(',');
      if (parts.length >= 2) {
        vertices.push({
          x: parseFloat(parts[0]) || 0,
          y: parseFloat(parts[2] || '0') || 0,
          z: parseFloat(parts[1]) || 0,
        });
      }
    }
  });

  if (vertices.length === 0) throw new Error('Nenhuma coordenada encontrada no KML');

  let points = projectVertices(vertices, 'top-down');
  points = normalizePoints(points, radius);
  points = downsamplePoints(points, targetCount);

  return {
    points,
    originalVertexCount: vertices.length,
    triangleCount: 0,
    modelName: fileName.replace(/\.[^.]+$/, ''),
    samplingUsed: 'vertices',
  };
}
