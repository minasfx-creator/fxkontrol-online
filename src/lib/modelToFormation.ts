/**
 * 3D Model → Formation Point Converter
 * Parses OBJ, STL, GLTF/GLB, SKP files and extracts surface points for drone formations.
 * Supports SketchUp exports, Google Earth/Maps KMZ models, and Blender exports.
 *
 * v3 — SKP support, adaptive density, multi-axis projection, quality metrics.
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

// ─── OBJ Parser ───────────────────────────────────────────────

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
      const indices = parts.map(p => parseInt(p.split('/')[0]) - 1);
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

// ─── STL Parser ───────────────────────────────────────────────

function parseSTL(buffer: ArrayBuffer): { vertices: Vertex3D[]; triangles: Triangle[] } {
  const vertices: Vertex3D[] = [];
  const triangles: Triangle[] = [];
  const view = new DataView(buffer);

  const header = new Uint8Array(buffer, 0, Math.min(80, buffer.byteLength));
  const headerStr = new TextDecoder().decode(header);
  if (headerStr.startsWith('solid') && buffer.byteLength < 1_000_000) {
    const text = new TextDecoder().decode(new Uint8Array(buffer));
    return parseSTLAscii(text);
  }

  if (buffer.byteLength < 84) return { vertices, triangles };
  const numTriangles = view.getUint32(80, true);
  const expectedSize = 84 + numTriangles * 50;
  if (buffer.byteLength < expectedSize) return { vertices, triangles };

  for (let i = 0; i < numTriangles; i++) {
    const offset = 84 + i * 50;
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

// ─── GLTF/GLB Parsers ────────────────────────────────────────

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

                if (componentType === 5123) {
                  const arr = new Uint16Array(idxBuf, idxOff, idxCount);
                  indices = Array.from(arr);
                } else if (componentType === 5125) {
                  const arr = new Uint32Array(idxBuf, idxOff, idxCount);
                  indices = Array.from(arr);
                } else if (componentType === 5121) {
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

// ─── SKP Parser (SketchUp) ────────────────────────────────────
// SKP files are binary archives. Modern SKP (v2021+) uses protobuf internally.
// We extract float64 coordinate triples from the binary data by scanning for
// patterns of sequential IEEE-754 doubles that form valid 3D coordinates.
// This heuristic approach works for most SketchUp models without needing
// a full protobuf decoder.

function parseSKP(buffer: ArrayBuffer): { vertices: Vertex3D[]; triangles: Triangle[] } {
  const vertices: Vertex3D[] = [];
  const view = new DataView(buffer);
  const byteLen = buffer.byteLength;

  // SKP magic check: files start with "FF FE FF 0E" or similar SketchUp headers
  // We'll scan for float64 triples that look like valid coordinates

  const MIN_COORD = -100000;
  const MAX_COORD = 100000;

  // Strategy 1: Scan for sequential float64 triples (SketchUp stores coords as doubles)
  const step = 8; // float64 = 8 bytes
  const coordCandidates: Vertex3D[] = [];

  for (let offset = 0; offset + 24 <= byteLen; offset += step) {
    try {
      const x = view.getFloat64(offset, true);
      const y = view.getFloat64(offset + 8, true);
      const z = view.getFloat64(offset + 16, true);

      // Filter: valid finite numbers in reasonable range
      if (
        isFinite(x) && isFinite(y) && isFinite(z) &&
        x > MIN_COORD && x < MAX_COORD &&
        y > MIN_COORD && y < MAX_COORD &&
        z > MIN_COORD && z < MAX_COORD &&
        // At least one coordinate should be non-zero
        (Math.abs(x) > 0.001 || Math.abs(y) > 0.001 || Math.abs(z) > 0.001) &&
        // Filter out common non-coordinate patterns (like bit patterns that decode to tiny values)
        (Math.abs(x) > 0.0001 || Math.abs(y) > 0.0001 || Math.abs(z) > 0.0001)
      ) {
        coordCandidates.push({ x, y, z });
        offset += 16; // Skip past this triple (will be incremented by step in loop)
      }
    } catch {
      continue;
    }
  }

  // Strategy 2: Also try float32 triples (some SKP sections use single precision)
  if (coordCandidates.length < 10) {
    for (let offset = 0; offset + 12 <= byteLen; offset += 4) {
      try {
        const x = view.getFloat32(offset, true);
        const y = view.getFloat32(offset + 4, true);
        const z = view.getFloat32(offset + 8, true);

        if (
          isFinite(x) && isFinite(y) && isFinite(z) &&
          x > MIN_COORD && x < MAX_COORD &&
          y > MIN_COORD && y < MAX_COORD &&
          z > MIN_COORD && z < MAX_COORD &&
          (Math.abs(x) > 0.01 || Math.abs(y) > 0.01 || Math.abs(z) > 0.01)
        ) {
          coordCandidates.push({ x, y, z });
          offset += 8;
        }
      } catch {
        continue;
      }
    }
  }

  // De-duplicate using spatial hashing
  const seen = new Set<string>();
  for (const v of coordCandidates) {
    // SketchUp uses inches internally — convert to meters
    const mx = v.x * 0.0254;
    const my = v.y * 0.0254;
    const mz = v.z * 0.0254;
    const key = `${mx.toFixed(3)},${my.toFixed(3)},${mz.toFixed(3)}`;
    if (!seen.has(key)) {
      seen.add(key);
      vertices.push({ x: mx, y: my, z: mz });
    }
  }

  // Build triangles from sequential vertex triples (best-effort)
  const triangles: Triangle[] = [];
  for (let i = 0; i + 2 < vertices.length; i += 3) {
    const a = vertices[i], b = vertices[i + 1], c = vertices[i + 2];
    // Only add if triangle has reasonable area (not degenerate)
    const ax = b.x - a.x, ay = b.y - a.y, az = b.z - a.z;
    const bx = c.x - a.x, by = c.y - a.y, bz = c.z - a.z;
    const cx = ay * bz - az * by, cy = az * bx - ax * bz, cz = ax * by - ay * bx;
    const area = 0.5 * Math.sqrt(cx * cx + cy * cy + cz * cz);
    if (area > 0.0001) {
      triangles.push({ a, b, c });
    }
  }

  return { vertices, triangles };
}

// ─── Collada (DAE) Parser ─────────────────────────────────────
// SketchUp can export to .DAE (Collada) which is XML-based and reliable

function parseDAE(text: string): { vertices: Vertex3D[]; triangles: Triangle[] } {
  const vertices: Vertex3D[] = [];
  const triangles: Triangle[] = [];
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, 'text/xml');

  // Extract float arrays from <float_array> elements
  const floatArrays = doc.querySelectorAll('float_array');
  for (const fa of floatArrays) {
    const id = fa.getAttribute('id') || '';
    // Position arrays typically have "positions" or "mesh-positions" in their ID
    if (!id.toLowerCase().includes('position') && !id.toLowerCase().includes('mesh')) continue;

    const count = parseInt(fa.getAttribute('count') || '0');
    if (count < 3) continue;

    const text = fa.textContent?.trim() || '';
    const values = text.split(/\s+/).map(Number);

    for (let i = 0; i + 2 < values.length; i += 3) {
      const x = values[i], y = values[i + 1], z = values[i + 2];
      if (isFinite(x) && isFinite(y) && isFinite(z)) {
        vertices.push({ x, y, z });
      }
    }
  }

  // If no position-labeled arrays found, try all float arrays
  if (vertices.length === 0) {
    for (const fa of floatArrays) {
      const text = fa.textContent?.trim() || '';
      const values = text.split(/\s+/).map(Number);
      for (let i = 0; i + 2 < values.length; i += 3) {
        const x = values[i], y = values[i + 1], z = values[i + 2];
        if (isFinite(x) && isFinite(y) && isFinite(z)) {
          vertices.push({ x, y, z });
        }
      }
      if (vertices.length > 0) break;
    }
  }

  // Build triangles from <triangles> or <polylist> elements
  const triElements = doc.querySelectorAll('triangles, polylist');
  for (const triEl of triElements) {
    const pEl = triEl.querySelector('p');
    if (!pEl) continue;
    const indices = (pEl.textContent?.trim() || '').split(/\s+/).map(Number);
    
    // Count inputs to determine stride
    const inputs = triEl.querySelectorAll('input');
    const stride = inputs.length || 1;
    
    // Find VERTEX input offset
    let vertexOffset = 0;
    inputs.forEach(inp => {
      if (inp.getAttribute('semantic') === 'VERTEX') {
        vertexOffset = parseInt(inp.getAttribute('offset') || '0');
      }
    });

    for (let i = 0; i + stride * 2 < indices.length; i += stride * 3) {
      const ai = indices[i + vertexOffset];
      const bi = indices[i + stride + vertexOffset];
      const ci = indices[i + stride * 2 + vertexOffset];
      const a = vertices[ai], b = vertices[bi], c = vertices[ci];
      if (a && b && c) triangles.push({ a, b, c });
    }
  }

  return { vertices, triangles };
}

// ─── PLY Parser ───────────────────────────────────────────────

function parsePLY(text: string): { vertices: Vertex3D[]; triangles: Triangle[] } {
  const vertices: Vertex3D[] = [];
  const triangles: Triangle[] = [];
  const lines = text.split('\n');

  let vertexCount = 0;
  let faceCount = 0;
  let headerEnd = 0;
  let propOrder: string[] = [];

  // Parse header
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === 'end_header') { headerEnd = i + 1; break; }
    const vertMatch = line.match(/element vertex (\d+)/);
    if (vertMatch) vertexCount = parseInt(vertMatch[1]);
    const faceMatch = line.match(/element face (\d+)/);
    if (faceMatch) faceCount = parseInt(faceMatch[1]);
    if (line.startsWith('property float') || line.startsWith('property double')) {
      propOrder.push(line.split(/\s+/).pop() || '');
    }
  }

  const xIdx = propOrder.indexOf('x');
  const yIdx = propOrder.indexOf('y');
  const zIdx = propOrder.indexOf('z');

  // Parse vertices
  for (let i = headerEnd; i < headerEnd + vertexCount && i < lines.length; i++) {
    const parts = lines[i].trim().split(/\s+/).map(Number);
    vertices.push({
      x: parts[xIdx >= 0 ? xIdx : 0] || 0,
      y: parts[yIdx >= 0 ? yIdx : 1] || 0,
      z: parts[zIdx >= 0 ? zIdx : 2] || 0,
    });
  }

  // Parse faces
  const faceStart = headerEnd + vertexCount;
  for (let i = faceStart; i < faceStart + faceCount && i < lines.length; i++) {
    const parts = lines[i].trim().split(/\s+/).map(Number);
    const n = parts[0];
    if (n >= 3) {
      for (let j = 1; j < n - 1; j++) {
        const a = vertices[parts[1]];
        const b = vertices[parts[j + 1]];
        const c = vertices[parts[j + 2]];
        if (a && b && c) triangles.push({ a, b, c });
      }
    }
  }

  return { vertices, triangles };
}

// ─── Surface Sampling ─────────────────────────────────────────

function sampleTriangleSurface(triangles: Triangle[], targetCount: number): Vertex3D[] {
  if (triangles.length === 0) return [];

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

function extractEdgePoints(triangles: Triangle[], targetCount: number): Vertex3D[] {
  if (triangles.length === 0) return [];

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

  let totalLength = 0;
  const lengths: number[] = [];
  for (const [a, b] of edges) {
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
    const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
    lengths.push(len);
    totalLength += len;
  }

  if (totalLength === 0) return [];

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

/** Extract silhouette/outline points — projects to 2D then traces contour */
function extractSilhouettePoints(vertices: Vertex3D[], projection: ProjectionMode, targetCount: number): Vertex3D[] {
  if (vertices.length === 0) return [];
  
  // Project to 2D
  const projected = vertices.map(v => {
    switch (projection) {
      case 'top-down': return { x: v.x, y: v.z, orig: v };
      case 'front': return { x: v.x, y: v.y, orig: v };
      case 'side': return { x: v.z, y: v.y, orig: v };
      case 'isometric': return {
        x: (v.x - v.z) * Math.cos(Math.PI / 6),
        y: (v.x + v.z) * Math.sin(Math.PI / 6) - v.y,
        orig: v,
      };
    }
  });

  // Grid-based boundary detection
  const gridSize = Math.ceil(Math.sqrt(targetCount) * 2);
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of projected) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
  }
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;
  const cellW = spanX / gridSize;
  const cellH = spanY / gridSize;

  // For each column, find min/max Y (outline)
  const colMinMax = new Map<number, { minY: number; maxY: number; minV: Vertex3D; maxV: Vertex3D }>();
  for (const p of projected) {
    const col = Math.floor((p.x - minX) / cellW);
    const existing = colMinMax.get(col);
    if (!existing) {
      colMinMax.set(col, { minY: p.y, maxY: p.y, minV: p.orig, maxV: p.orig });
    } else {
      if (p.y < existing.minY) { existing.minY = p.y; existing.minV = p.orig; }
      if (p.y > existing.maxY) { existing.maxY = p.y; existing.maxV = p.orig; }
    }
  }

  // For each row, find min/max X (outline)
  const rowMinMax = new Map<number, { minX: number; maxX: number; minV: Vertex3D; maxV: Vertex3D }>();
  for (const p of projected) {
    const row = Math.floor((p.y - minY) / cellH);
    const existing = rowMinMax.get(row);
    if (!existing) {
      rowMinMax.set(row, { minX: p.x, maxX: p.x, minV: p.orig, maxV: p.orig });
    } else {
      if (p.x < existing.minX) { existing.minX = p.x; existing.minV = p.orig; }
      if (p.x > existing.maxX) { existing.maxX = p.x; existing.maxV = p.orig; }
    }
  }

  const outline: Vertex3D[] = [];
  for (const v of colMinMax.values()) { outline.push(v.minV, v.maxV); }
  for (const v of rowMinMax.values()) { outline.push(v.minV, v.maxV); }

  return outline;
}

// ─── Projection & Normalization ───────────────────────────────

export type ProjectionMode = 'top-down' | 'front' | 'side' | 'isometric';
export type SamplingMode = 'vertices' | 'surface' | 'edges' | 'silhouette';

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

// ─── Quality Metrics ──────────────────────────────────────────

export interface QualityMetrics {
  /** Average nearest-neighbor distance */
  avgSpacing: number;
  /** Std dev of nearest-neighbor distance — lower = more uniform */
  spacingUniformity: number;
  /** Coverage ratio: bounding area of points / bounding area of model */
  coverage: number;
  /** 0-100 quality score */
  score: number;
}

function computeQualityMetrics(points: FormationPoint[]): QualityMetrics {
  if (points.length < 3) return { avgSpacing: 0, spacingUniformity: 0, coverage: 0, score: 0 };

  // Nearest-neighbor distances
  const nnDists: number[] = [];
  for (let i = 0; i < Math.min(points.length, 500); i++) {
    let minDist = Infinity;
    for (let j = 0; j < points.length; j++) {
      if (i === j) continue;
      const dx = points[i].x - points[j].x;
      const dz = points[i].z - points[j].z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < minDist) minDist = d;
    }
    nnDists.push(minDist);
  }

  const avgSpacing = nnDists.reduce((s, d) => s + d, 0) / nnDists.length;
  const variance = nnDists.reduce((s, d) => s + (d - avgSpacing) ** 2, 0) / nnDists.length;
  const spacingUniformity = Math.sqrt(variance);
  const cv = avgSpacing > 0 ? spacingUniformity / avgSpacing : 1;

  // Coverage: convex hull area approximation
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
  }
  const boundingArea = (maxX - minX) * (maxZ - minZ);
  const idealArea = points.length * avgSpacing * avgSpacing;
  const coverage = boundingArea > 0 ? Math.min(1, idealArea / boundingArea) : 0;

  // Score: penalize high CV and low coverage
  const uniformityScore = Math.max(0, 100 - cv * 100);
  const coverageScore = coverage * 100;
  const score = Math.round(uniformityScore * 0.6 + coverageScore * 0.4);

  return { avgSpacing: +avgSpacing.toFixed(3), spacingUniformity: +spacingUniformity.toFixed(3), coverage: +coverage.toFixed(3), score };
}

// ─── Public API ───────────────────────────────────────────────

export interface ModelParseResult {
  points: FormationPoint[];
  originalVertexCount: number;
  triangleCount: number;
  modelName: string;
  samplingUsed: SamplingMode;
  quality: QualityMetrics;
  format: string;
  boundingBox: { width: number; height: number; depth: number };
}

export const SUPPORTED_EXTENSIONS = ['obj', 'stl', 'gltf', 'glb', 'skp', 'dae', 'ply', 'kml'] as const;
export type SupportedExtension = typeof SUPPORTED_EXTENSIONS[number];

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
  } else if (ext === 'skp') {
    const buffer = await file.arrayBuffer();
    const parsed = parseSKP(buffer);
    vertices = parsed.vertices;
    triangles = parsed.triangles;
  } else if (ext === 'dae') {
    const text = await file.text();
    const parsed = parseDAE(text);
    vertices = parsed.vertices;
    triangles = parsed.triangles;
  } else if (ext === 'ply') {
    const text = await file.text();
    const parsed = parsePLY(text);
    vertices = parsed.vertices;
    triangles = parsed.triangles;
  } else {
    throw new Error(`Formato não suportado: .${ext}. Use .OBJ, .STL, .GLTF, .GLB, .SKP, .DAE ou .PLY`);
  }

  if (vertices.length === 0) {
    throw new Error('Nenhum vértice encontrado no modelo 3D. Para arquivos .SKP, exporte como .OBJ ou .DAE no SketchUp para melhores resultados.');
  }

  // Compute bounding box
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const v of vertices) {
    minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x);
    minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y);
    minZ = Math.min(minZ, v.z); maxZ = Math.max(maxZ, v.z);
  }
  const boundingBox = {
    width: +(maxX - minX).toFixed(2),
    height: +(maxY - minY).toFixed(2),
    depth: +(maxZ - minZ).toFixed(2),
  };

  // Choose sampling strategy
  let sampledVertices: Vertex3D[];
  let actualSampling = sampling;

  if (sampling === 'silhouette') {
    sampledVertices = extractSilhouettePoints(vertices, projection, targetCount * 2);
  } else if (sampling === 'surface' && triangles.length > 0) {
    sampledVertices = sampleTriangleSurface(triangles, targetCount * 2);
  } else if (sampling === 'edges' && triangles.length > 0) {
    sampledVertices = extractEdgePoints(triangles, targetCount * 2);
  } else {
    sampledVertices = vertices;
    actualSampling = 'vertices';
  }

  let points = projectVertices(sampledVertices, projection);
  points = normalizePoints(points, radius);
  points = downsamplePoints(points, targetCount);

  const quality = computeQualityMetrics(points);

  return {
    points,
    originalVertexCount: vertices.length,
    triangleCount: triangles.length,
    modelName,
    samplingUsed: actualSampling,
    quality,
    format: ext.toUpperCase(),
    boundingBox,
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

  const quality = computeQualityMetrics(points);

  return {
    points,
    originalVertexCount: vertices.length,
    triangleCount: 0,
    modelName: fileName.replace(/\.[^.]+$/, ''),
    samplingUsed: 'vertices',
    quality,
    format: 'KML',
    boundingBox: { width: 0, height: 0, depth: 0 },
  };
}
